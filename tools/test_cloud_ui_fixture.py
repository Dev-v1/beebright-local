"""Network-free UI fixture for the local account/classroom controls."""
import json
import os
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from beebright_local import cloud, engine
from beebright_local.web import LocalServer

rooms=[]
def fake_remote(path,method='GET',payload=None,token=None):
    if path=='/api/devices/start':
        return {'token':'bb_fixture','code':'ABCDEFGH','url':'https://www.beebright.app/classrooms?connect=ABCDEFGH'}
    if path=='/api/account/me':return {'user_id':'user_fixture'}
    if path=='/api/account/studio':return (payload or {}).get('data',{})
    if path=='/api/account/progress':return {'session':None,'revision':None}
    if path=='/api/classrooms':
        if method=='POST':
            rooms.append({'id':'room','name':payload['name'],'teacher':True,'code':'ABCDEFGH'})
        return rooms if method=='GET' else rooms[-1]
    if path.endswith('/students'):return []
    if path=='/api/activity':return {'saved':True}
    if path=='/api/devices/current':return {'signed_out':True}
    raise ValueError('Unexpected test cloud route '+path)

with tempfile.TemporaryDirectory() as folder,patch.object(engine,'USER_DATA',Path(folder)),patch.object(cloud,'remote',side_effect=fake_remote),patch.object(cloud.webbrowser,'open'):
    server=LocalServer(0)
    print(server.server_address[1],flush=True)
    try:server.serve_forever()
    finally:server.server_close()
