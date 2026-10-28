import './account-settings.css';

export default function AccountSettings({account,busy,onAction}) {
  const cloud = account.mode === 'cloud';
  const expired = /expired|invalid/i.test(account.error || '');
  const conflict = /another device|conflict/i.test(account.error || '');
  return <article className="settings-card account-settings">
    <h2>Account and saving</h2>
    <div className="saving-row"><div><h3 id="cloud-saving-label">Cloud saving</h3>
      <p id="cloud-saving-description">{cloud ? 'On · progress saves automatically to your account. Offline changes sync when you reconnect.' : 'Off · practice stays on this computer. No progress or activity is uploaded.'}</p>
    </div><button type="button" className="apple-switch" role="switch" aria-labelledby="cloud-saving-label" aria-describedby="cloud-saving-description"
      aria-checked={cloud} disabled={busy || account.pending}
      onClick={()=>onAction(account.signed_in ? 'mode' : 'login', account.signed_in ? {mode:cloud?'local':'cloud'} : undefined)}>
      <span className="switch-thumb" aria-hidden="true"/>
    </button></div>
    {account.error && <p role="alert">{account.error}</p>}
    {account.pending ? <div className="account-signin"><p role="status">Finish signing in with Clerk in your browser. Complete any verification it requests, then choose Connect this computer.</p>
      {account.login_url && <a href={account.login_url} target="_blank" rel="noopener noreferrer">Open sign-in page again</a>}
      <button className="outline" disabled={busy} onClick={()=>onAction('logout')}>Cancel sign-in</button></div> :
      !account.signed_in ? <button className="primary" disabled={busy} onClick={()=>onAction('login')}>Sign in with Clerk</button> :
      <><div className="saving-row"><p>Your BeeBright account is connected.</p><button className="outline" disabled={busy} onClick={()=>onAction('logout')}>Sign out</button></div>
      {expired && <button disabled={busy} onClick={()=>onAction('login')}>Reconnect with Clerk</button>}
      <div className="saving-row"><div><h3>Import local progress</h3><p>Add this computer’s local history and favorites to your account. You’ll confirm before replacing a cloud resume point.</p></div>
      <button className="outline" disabled={busy} onClick={()=>{if(window.confirm('Add local favorites and history to this account? If local practice has a saved session, it will replace the cloud resume point. Local data stays on this computer.'))onAction('sync')}}>Sync local progress to cloud</button></div>
      {conflict && <button disabled={busy} onClick={()=>{if(window.confirm('Replace the cloud resume point with this computer’s pending cloud progress?'))onAction('resolve')}}>Keep this computer’s cloud progress</button>}</>}
  </article>;
}
