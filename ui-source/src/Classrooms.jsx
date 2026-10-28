import {useEffect,useState} from 'react';
import {ArrowLeft,BookOpen,KeyRound,Plus,Users} from 'lucide-react';
import './classrooms.css';

export default function Classrooms({call,userId,onBack,isDesktop=false}) {
  const [classes,setClasses]=useState([]),[selected,setSelected]=useState(null),[students,setStudents]=useState([]);
  const [name,setName]=useState(''),[code,setCode]=useState(''),[displayName,setDisplayName]=useState('');
  const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [deviceCode,setDeviceCode]=useState(()=>sessionStorage.getItem('beebright-connect-code')||'');
  const load=async()=>setClasses(await call('/api/classrooms'));
  useEffect(()=>{let stopped=false;call('/api/classrooms').then(v=>!stopped&&setClasses(v)).catch(e=>!stopped&&setNotice(e.message));return()=>{stopped=true};},[call]);
  useEffect(()=>{
    if(!selected)return;
    let stopped=false;
    const refresh=()=>{if(document.hidden)return;call('/api/classrooms/'+selected+'/students').then(v=>!stopped&&setStudents(v)).catch(e=>!stopped&&setNotice(e.message));};
    refresh();const timer=setInterval(refresh,15000);
    return()=>{stopped=true;clearInterval(timer);};
  },[call,selected]);
  async function action(fn){if(busy)return;setBusy(true);setNotice('');try{await fn();await load();}catch(e){setNotice(e.message)}finally{setBusy(false)}}
  return <main className="settings-page classrooms-page">
    <header className="topbar classroom-topbar"><div className="classroom-wordmark"><BookOpen size={21} aria-hidden="true"/><span>Classrooms</span></div><button type="button" className="classroom-button classroom-quiet" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>Back to practice</button></header>
    <section className="classroom-content">
      <header className="classroom-intro"><p className="eyebrow">LEARN TOGETHER</p><h1>A place to practice together.</h1><p>Create a classroom for your students, or join one with a code from your teacher.</p></header>
      {notice&&<div className="classroom-notice" role="status">{notice}</div>}
      {!isDesktop&&<article className="classroom-panel"><h2>Connect the local app</h2><p>Only approve a code shown by your own BeeBright app. It gives that computer access to your account for 30 days.</p><label>Device code<input value={deviceCode} maxLength={8} onChange={e=>setDeviceCode(e.target.value.toUpperCase())}/></label><button className="classroom-button classroom-primary" disabled={busy||deviceCode.length!==8} onClick={()=>action(async()=>{await call('/api/devices/approve','POST',{code:deviceCode});sessionStorage.removeItem('beebright-connect-code');setDeviceCode('');setNotice('Computer connected. Return to the local app.');})}>Approve my computer</button></article>}
      <div className="classroom-forms">
        <form className="classroom-panel classroom-form" aria-busy={busy} onSubmit={e=>{e.preventDefault();action(async()=>{await call('/api/classrooms','POST',{name});setName('')})}}>
          <div className="classroom-icon classroom-icon-create"><Plus size={24} aria-hidden="true"/></div>
          <div className="classroom-form-heading"><h2>Create a classroom</h2><p>Bring your students together in one shared space.</p></div>
          <label>Classroom name<input value={name} required maxLength={80} disabled={busy} placeholder="e.g. Friday Spelling Group" onChange={e=>setName(e.target.value)}/></label>
          <div className="classroom-tip"><KeyRound size={18} aria-hidden="true"/><p>You’ll get a unique join code to share with your students.</p></div>
          <button type="submit" className="classroom-button classroom-primary classroom-submit" disabled={busy}><Plus size={17} aria-hidden="true"/>Create classroom</button>
        </form>
        <form className="classroom-panel classroom-form" aria-busy={busy} onSubmit={e=>{e.preventDefault();action(async()=>{await call('/api/classrooms/join','POST',{code:code.trim().toUpperCase(),display_name:displayName});setCode('');setNotice('You joined the classroom. Your teacher can now see cloud-mode activity.');})}}>
          <div className="classroom-icon classroom-icon-join"><Users size={24} aria-hidden="true"/></div>
          <div className="classroom-form-heading"><h2>Join a classroom</h2><p>Enter your teacher’s code and the name they’ll see.</p></div>
          <label>Classroom code<input className="classroom-code-input" required minLength={8} maxLength={8} value={code} disabled={busy} placeholder="ABCD2345" autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={e=>setCode(e.target.value.toUpperCase())}/></label>
          <label>Your classroom name<input required maxLength={60} value={displayName} disabled={busy} placeholder="Your name" autoComplete="nickname" onChange={e=>setDisplayName(e.target.value)}/></label>
          <button type="submit" className="classroom-button classroom-secondary classroom-submit" disabled={busy}><Users size={17} aria-hidden="true"/>Join and share activity</button>
        </form>
      </div>
      <aside className="classroom-sharing"><BookOpen size={18} aria-hidden="true"/><p>Joining shares your BeeBright screen, practice mode, level, session answer count and score with your teacher while cloud mode is active. Display names are chosen by students. Local-only activity is not shared.</p></aside>
      <section className="classroom-list"><div className="classroom-section-heading"><h2>Your classrooms</h2><span>{classes.length} {classes.length===1?'classroom':'classrooms'}</span></div>
        {classes.length===0?<div className="classroom-empty"><Users size={28} aria-hidden="true"/><h3>No classrooms yet.</h3><p>Create one above, or ask your teacher for a join code.</p></div>:
        <div className="classroom-room-grid">{classes.map(c=><article className="classroom-panel classroom-room" key={c.id}><div className="classroom-room-heading"><h3>{c.name}</h3><span className={'classroom-role '+(c.teacher?'is-teacher':'')}>{c.teacher?'Teacher':'Student'}</span></div>{c.teacher?<><div className="classroom-join-code"><span>Join code</span><strong>{c.code}</strong></div><div className="classroom-actions"><button className="classroom-button classroom-primary" disabled={busy} onClick={()=>{setStudents([]);setSelected(c.id)}}>View students</button><button className="classroom-button classroom-quiet" disabled={busy} onClick={()=>action(()=>call('/api/classrooms/'+c.id+'/rotate-code','POST'))}>New join code</button><button className="classroom-button classroom-danger" disabled={busy} onClick={()=>{if(confirm('Delete this classroom? Saved student progress will remain.'))action(async()=>{await call('/api/classrooms/'+c.id,'DELETE');setSelected(null);})}}>Delete classroom</button></div></>:<><p className="classroom-room-description">Activity sharing is on in cloud mode.</p><div className="classroom-actions"><button className="classroom-button classroom-quiet" disabled={busy} onClick={()=>action(()=>call('/api/classrooms/'+c.id+'/members/'+encodeURIComponent(userId),'DELETE'))}>Leave classroom</button></div></>}</article>)}</div>}
      </section>
      {selected&&<section className="classroom-panel classroom-roster"><h2>Student activity</h2><p>Refreshes every 15 seconds. Last seen is the last report received; an old report does not mean a student is still active.</p><div className="classroom-table-scroll"><table><thead><tr><th>Student</th><th>Activity</th><th>Mode / Level</th><th>Answers / Correct</th><th>Source</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>{students.map(s=><tr key={s.user_id}><td>{s.name}</td><td>{s.activity?.screen||'No activity received'}</td><td>{s.activity?.mode} {s.activity?.level}</td><td>{s.activity?s.activity.answered+' / '+s.activity.correct:'—'}</td><td>{s.activity?.source}</td><td>{s.last_seen?new Date(s.last_seen).toLocaleString():'—'}</td><td><button className="classroom-button classroom-quiet" disabled={busy} onClick={()=>action(async()=>{await call('/api/classrooms/'+selected+'/members/'+encodeURIComponent(s.user_id),'DELETE');setStudents(await call('/api/classrooms/'+selected+'/students'));})}>Remove</button></td></tr>)}</tbody></table></div>{students.length===0&&<div className="classroom-empty classroom-roster-empty"><Users size={24} aria-hidden="true"/><p>No students have joined.</p></div>}</section>}
    </section>
  </main>;
}
