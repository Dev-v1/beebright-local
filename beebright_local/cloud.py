"""Optional cloud account; offline data never uploads until explicitly imported."""
from __future__ import annotations
import json
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from . import engine, studio

API = 'https://beebright-api.onrender.com'
_lock = threading.RLock()
_login_threads = set()
_worker_started = False


def remote(path, method='GET', payload=None, token=None):
    if not path.startswith('/api/') or '://' in path or '..' in path:
        raise ValueError('Invalid cloud route.')
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(API+path, data=body, method=method,
        headers={'Content-Type':'application/json', **({'Authorization':'Bearer '+token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            raw = response.read(5_000_001)
            if len(raw) > 5_000_000:
                raise ValueError('Cloud response is too large.')
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        try: message = json.loads(exc.read(2048)).get('detail','Cloud request failed.')
        except (ValueError, AttributeError): message = 'Cloud request failed.'
        raise ValueError(str(message)) from None
    except OSError:
        raise ValueError('Cloud connection unavailable. Your changes remain saved on this computer.') from None


def config():
    path = studio.profile_path('account-private.json')
    return {**(engine.read_json(path,{}) or {}),'_path':path}


def save_config(value, path=None):
    name = path or value.get('_path') or studio.profile_path('account-private.json')
    engine.save_json(name, {k:v for k,v in value.items() if k != '_path'})
    # Tokens never enter browser storage or portable backups.
    (engine.USER_DATA / name).chmod(0o600)


def status():
    c = config()
    return {'signed_in':bool(c.get('user_id')), 'user_id':c.get('user_id'),
            'mode':c.get('mode','local'), 'error':c.get('error',''),
            'pending':bool(c.get('pending')), 'code':c.get('code','') if c.get('pending') else ''}


def cache_name(c, name):
    import hashlib
    account = hashlib.sha256(c['user_id'].encode()).hexdigest()
    prefix = c.get('_path',studio.profile_path('account-private.json')).removesuffix('account-private.json')
    return prefix+'cloud/'+account+'/'+name+'.json'


def login():
    path = studio.profile_path('account-private.json')
    with _lock:
        if path in _login_threads:
            return status()
        old = config()
        if old.get('user_id'):
            try:
                remote('/api/account/me',token=old['token'])
                return status()
            except ValueError as exc:
                if 'expired' not in str(exc).lower() and 'invalid' not in str(exc).lower():
                    raise
        pending = remote('/api/devices/start','POST')
        save_config({'mode':'local','pending':True,'code':pending['code']},path)
        _login_threads.add(path)
    def poll():
        try:
            for _ in range(150):
                time.sleep(4)
                # Cancelling login prevents the poller from restoring a signed-out account.
                with _lock:
                    current = engine.read_json(path,{}) or {}
                    if current.get('code') != pending['code'] or not current.get('pending'):
                        return
                try: user = remote('/api/account/me',token=pending['token'])
                except ValueError: continue
                with _lock:
                    current = engine.read_json(path,{}) or {}
                    if current.get('code') != pending['code'] or not current.get('pending'):
                        return
                    save_config({'token':pending['token'],'user_id':user['user_id'],'mode':'cloud','error':''},path)
                return
            with _lock:
                current = engine.read_json(path,{}) or {}
                if current.get('code') == pending['code']:
                    save_config({'mode':'local','error':'Login timed out. Try again.'},path)
        finally:
            with _lock: _login_threads.discard(path)
    threading.Thread(target=poll,daemon=True).start()
    webbrowser.open(pending['url'])
    return status()


def start_worker():
    global _worker_started
    with _lock:
        if _worker_started: return
        _worker_started = True
    def run():
        while True:
            time.sleep(10)
            try:
                with _lock:
                    c = config()
                    if c.get('mode') == 'cloud' and c.get('user_id'):
                        flush(c)
            except Exception:
                pass  # Error is kept in status; the durable cache remains queued.
    threading.Thread(target=run,daemon=True).start()


def flush(c):
    state = engine.read_json(cache_name(c,'pending'),{}) or {}
    try:
        if state.get('studio'):
            data = engine.read_json(cache_name(c,'studio'),{}) or {}
            result = remote('/api/account/studio','PUT',{'data':data,'merge_favorites':False},c['token'])
            engine.save_json(cache_name(c,'studio'),result)
            state.pop('studio',None)
            engine.save_json(cache_name(c,'pending'),state)
        if 'progress' in state:
            session = engine.read_json(cache_name(c,'progress'),None)
            saved = remote('/api/account/progress','PUT',{'session':session,'base_revision':engine.read_json(cache_name(c,'revision'),None)},c['token'])
            engine.save_json(cache_name(c,'revision'),saved['revision'])
            state.pop('progress',None)
            engine.save_json(cache_name(c,'pending'),state)
        c['error'] = ''
        save_config(c)
    except ValueError as exc:
        c['error'] = str(exc)
        save_config(c)
        raise


def request(path, method='GET', payload=None):
    start_worker()
    with _lock:
        c = config()
        if path == '/api/account/status': return status()
        if path == '/api/account/login': return login()
        if path == '/api/account/mode' and method == 'PUT':
            mode = (payload or {}).get('mode')
            if mode not in ('local','cloud') or (mode == 'cloud' and not c.get('user_id')):
                raise ValueError('Sign in before switching to cloud mode.')
            c['mode'] = mode; save_config(c)
            return status()
        if path == '/api/account/logout' and method == 'PUT':
            if c.get('token'):
                try: remote('/api/devices/current','DELETE',token=c['token'])
                except ValueError: pass
            save_config({'mode':'local'})
            return status()
        if not c.get('user_id'):
            raise ValueError('Run beebright login to connect your account.')
        if path == '/api/account/sync' and method == 'PUT':
            # Flush account-cache changes first so an import cannot discard queued cloud answers.
            flush(c)
            # Explicit import is the ONLY path that reads local-only progress for upload.
            prefix = c.get('_path',studio.profile_path('account-private.json')).removesuffix('account-private.json')
            local_studio = engine.read_json(prefix+'studio.json',{}) or {}
            result = remote('/api/account/studio','PUT',{'data':local_studio,'merge_favorites':True},c['token'])
            engine.save_json(cache_name(c,'studio'),result)
            session = engine.read_json(prefix+'progress.json',None)
            if session:
                latest = remote('/api/account/progress',token=c['token'])
                saved = remote('/api/account/progress','PUT',{'session':session,'base_revision':latest['revision']},c['token'])
                engine.save_json(cache_name(c,'progress'),session)
                engine.save_json(cache_name(c,'revision'),saved['revision'])
            return {'synced':True}
        if path == '/api/account/resolve' and method == 'PUT':
            latest = remote('/api/account/progress',token=c['token'])
            engine.save_json(cache_name(c,'revision'),latest['revision'])
            flush(c)
            return status()
        if c.get('mode') != 'cloud':
            raise ValueError('Switch to cloud mode to use classrooms. Local-only activity is private.')
        if path in ('/api/progress','/api/studio'):
            name = 'progress' if path == '/api/progress' else 'studio'
            pending = engine.read_json(cache_name(c,'pending'),{}) or {}
            if method in ('PUT','DELETE'):
                value = None if method == 'DELETE' else payload.get('session') if name == 'progress' else payload
                engine.save_json(cache_name(c,name),value)
                pending[name] = True
                engine.save_json(cache_name(c,'pending'),pending)
            elif method == 'GET' and name not in pending:
                try:
                    value = remote('/api/account/progress' if name == 'progress' else '/api/account/studio',token=c['token'])
                    if name == 'progress': engine.save_json(cache_name(c,'revision'),value['revision'])
                    engine.save_json(cache_name(c,name),value.get('session') if name == 'progress' else value)
                    c['error']='';save_config(c)
                except ValueError as exc:
                    c['error']=str(exc);save_config(c)
            value = engine.read_json(cache_name(c,name),None if name == 'progress' else {})
            return {'session':value} if name == 'progress' else value
        if path == '/api/activity' or path.startswith('/api/classrooms'):
            return remote(path,method,payload,c['token'])
        raise ValueError('Unsupported cloud operation.')
