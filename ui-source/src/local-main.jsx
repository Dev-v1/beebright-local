import {useCallback} from 'react';
import Classrooms from './Classrooms.jsx';
import {desktopRequest} from './local-api.js';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Moon, Sun, Trash2 } from 'lucide-react';
import App from './App.jsx';
import { desktopSettings } from './local-api.js';
import { deleteSavedProgress } from './api.js';
import './styles.css';

const getLocalToken = async () => 'local-device';
function LocalApp() {
  const [settings, setSettings] = useState(false);
  const [classrooms,setClassrooms]=useState(false);
  const [account,setAccount]=useState({mode:'local',signed_in:false});
  const [accountBusy,setAccountBusy]=useState(false);
  const classCall=useCallback((path,method='GET',data)=>desktopRequest(path,{method,...(data===undefined?{}:{body:JSON.stringify(data)})}),[]);
  useEffect(()=>{let stopped=false;const load=()=>classCall('/api/account/status').then(v=>{if(!stopped)setAccount(v)}).catch(e=>!stopped&&setNotice(e.message));load();const t=setInterval(load,3000);return()=>{stopped=true;clearInterval(t)};},[classCall]);
  async function accountAction(path,value){if(accountBusy)return;setAccountBusy(true);try{const result=await classCall('/api/account/'+path,'PUT',value);if(path==='sync'){setNotice('Offline progress added to your cloud account.');}else setAccount(result);setGeneration(v=>v+1);}catch(e){setNotice(e.message)}finally{setAccountBusy(false)}}
  const [profileId, setProfileId] = useState('default');
  const [theme, setTheme] = useState('light');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [startupError, setStartupError] = useState('');
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    desktopSettings().then((value) => { setTheme(value.theme || 'light'); setProfileId(value.profileId || 'default'); setReady(true); })
      .catch((error) => setStartupError(error.message || 'Could not connect to local practice.'));
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  async function changeTheme(value) {
    setTheme(value);
    await desktopSettings({ theme: value });
  }
  async function clearProgress() {
    if (!window.confirm(account.mode === 'cloud' ? 'Clear this account’s saved cloud session?' : 'Clear the saved practice on this laptop?')) return;
    await deleteSavedProgress('local-device');
    localStorage.removeItem('beebright-session-v2:' + (account.mode==='cloud'?'cloud:'+account.user_id:'local-device:'+profileId));
    setGeneration((value) => value + 1);
    setNotice(account.mode==='cloud'?'Cloud resume point queued for deletion.':'Your local practice was cleared.');
  }
  if (!ready) return <main className="configuration-page"><div><span className="bee-mark">🐝</span><h1>{startupError ? "Could not open your spelling studio" : "Opening your spelling studio…"}</h1>{startupError && <><p role="alert">{startupError}</p><p>Close BeeBright, run beebright update in your terminal, then open it again.</p><button className="primary" onClick={() => window.location.reload()}>Try again</button></>}</div></main>;
  return <>
    <div hidden={settings||classrooms}><App key={generation+account.mode+(account.user_id||"")} userId={account.mode==="cloud"?"cloud:"+account.user_id:"local-device:" + profileId} cloudEnabled={account.mode==="cloud"} onClassrooms={()=>{if(account.mode==="cloud")setClassrooms(true);else{setSettings(true);setNotice("Sign in and switch to cloud mode to use classrooms.");}}} getToken={getLocalToken} isAdmin={false} localMode inactive={settings||classrooms} onOpenSettings={() => setSettings(true)} /></div>
    {classrooms&&account.mode==="cloud"&&<Classrooms isDesktop call={classCall} userId={account.user_id} onBack={()=>setClassrooms(false)}/>}
    {settings && <main className="settings-page">
      <header className="topbar"><button className="brand" onClick={() => setSettings(false)}><span>bee</span>bright</button><button className="outline" onClick={() => setSettings(false)}><ArrowLeft size={15} /> Back to practice</button></header>
      <section className="settings-content"><div className="settings-main"><p className="eyebrow">APPEARANCE & LOCAL PRACTICE</p><h1>Settings</h1><p className="settings-intro">Choose how your spelling studio looks. Choose local-only or automatic cloud saving below.</p>
        {notice && <div className="settings-notice">{notice}</div>}
        <div className="settings-grid">
          <article className="settings-card"><h2>Account and saving</h2><p>{account.mode==="cloud"?"Cloud mode: automatic saving is ON. Offline changes wait on this computer until the connection returns.":"Local-only mode: no login required and no progress or activity is uploaded."}</p>{account.error&&<p role="alert">{account.error}</p>}{account.pending&&<p>Approve code <strong>{account.code}</strong> at https://www.beebright.app/classrooms</p>}{notice&&<p role="status">{notice}</p>}{!account.signed_in?<>{account.pending&&<button disabled={accountBusy} onClick={()=>accountAction("logout")}>Cancel login</button>}<button disabled={accountBusy||account.pending} onClick={()=>accountAction("login")}>Sign in to cloud</button></>:<><p>Connected account: {account.user_id}</p><button disabled={accountBusy} onClick={()=>accountAction("mode",{mode:account.mode==="cloud"?"local":"cloud"})}>{account.mode==="cloud"?"Use local-only mode":"Use cloud mode (automatic sync)"}</button><button disabled={accountBusy} onClick={()=>{if(confirm("Add local favorites and history to this account? If local practice has a saved session, it will replace the cloud resume point. Local data stays on this computer."))accountAction("sync")}}>Sync local progress to cloud</button><button disabled={accountBusy} onClick={()=>accountAction("logout")}>Sign out</button></>}</article>
          <article className="settings-card"><div className="settings-icon"><Sun size={19} /></div><div><h2>Appearance</h2><p>Switch between light and dark mode.</p></div><div className="theme-switch" role="group" aria-label="App theme"><button className={theme === 'light' ? 'selected' : ''} onClick={() => changeTheme('light')}><Sun size={16} /> Light</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => changeTheme('dark')}><Moon size={16} /> Dark</button></div></article>
          <article className="settings-card danger-card"><div className="settings-icon"><Trash2 size={19} /></div><div><h2>Saved practice</h2><p>{account.mode==="cloud"?"Clear your account’s cloud resume point.":"Clear your saved session on this laptop."}</p></div><button className="danger-button" onClick={clearProgress}><Trash2 size={15} /> Clear saved practice</button></article>
        </div>
      </div></section>
    </main>}
  </>;
}
createRoot(document.getElementById('root')).render(<LocalApp />);
