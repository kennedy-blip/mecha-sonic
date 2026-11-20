import { useEffect, useRef, useState } from 'react';
import { Cloud, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { db, type QueueItem } from '../services/db';
import { backupOwner, backupPaused, BACKUP_OWNER_KEY, BACKUP_PAUSED_KEY, queueBaseline, wakeBackup } from '../services/mutations';
import { cloudClient, flushBackup, pendingFor } from '../services/cloudBackup';

export function CloudBackup({online,queue,reload}:{online:boolean;queue:QueueItem[];reload:()=>Promise<void>}){
 const allowEmailLink=import.meta.env.VITE_ENABLE_MAGIC_LINK==='true';
 const [user,setUser]=useState<User|null>(null);
 const [owner,setOwner]=useState(backupOwner);
 const [paused,setPaused]=useState(backupPaused);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [syncing,setSyncing]=useState(false);
 const lock=useRef(false);
 const userRef=useRef(user);userRef.current=user;
 const reloadRef=useRef(reload);reloadRef.current=reload;
 useEffect(()=>{
  if(!cloudClient)return;
  let alive=true;
  void cloudClient.auth.getSession().then(({data})=>{if(alive)setUser(data.session?.user??null);});
  const {data:{subscription}}=cloudClient.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null));
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  const onStorage=(event:StorageEvent)=>{if(event.key===BACKUP_OWNER_KEY)setOwner(backupOwner());if(event.key===BACKUP_PAUSED_KEY)setPaused(backupPaused());};
  window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);
 },[]);
 useEffect(()=>{
  if(!cloudClient||!online||!owner||paused||!user||user.id!==owner)return;
  let alive=true;
  const flush=async()=>{
   if(lock.current||!alive||!cloudClient)return;
   lock.current=true;setSyncing(true);
   try{
    const result=await flushBackup(db,cloudClient,owner,()=>alive&&navigator.onLine&&!backupPaused()&&backupOwner()===owner&&userRef.current?.id===owner);
    if(alive){if(result.error)setMessage(`Backup paused: ${result.error}`);else if(result.sent)setMessage(`${result.sent} change${result.sent===1?'':'s'} uploaded.`);await reloadRef.current();}
   }catch{if(alive)setMessage('Backup could not connect. Changes remain queued.');}
   finally{lock.current=false;if(alive)setSyncing(false);}
  };
  void flush();const timer=window.setInterval(()=>void flush(),30000);
  const wake=()=>void flush();window.addEventListener('ms:local-change',wake);window.addEventListener('online',wake);
  return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('ms:local-change',wake);window.removeEventListener('online',wake);};
 },[online,owner,paused,user?.id]);
 const signIn=async()=>{
  if(!cloudClient||!email.trim()||!password)return;
  setBusy(true);setMessage('');
  try{const {error}=await cloudClient.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('');setMessage('Signed in. Cloud backup remains off until you enable it.');}catch(e){setPassword('');setMessage(e instanceof Error?e.message:'Could not sign in.');}finally{setBusy(false);}
 };
 const sendLink=async()=>{
  if(!cloudClient||!email.trim())return;
  setBusy(true);setMessage('');
  try{const {error}=await cloudClient.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin}});if(error)throw error;setMessage('Check your email for a sign-in link.');}catch(e){setMessage(e instanceof Error?e.message:'Could not send sign-in link.');}finally{setBusy(false);}
 };
 const enable=async()=>{
  if(!user)return;
  if(!confirm('Enable cloud backup for this account? All local asset names, scans including FFT snapshots, repair estimates, and quotes will be uploaded when online. Raw audio is not uploaded. Backups are per-device; automatic restore and cross-device merging are not yet supported.'))return;
  const previous=backupOwner(),wasPaused=backupPaused();setBusy(true);
  try{localStorage.setItem(BACKUP_PAUSED_KEY,'1');localStorage.setItem(BACKUP_OWNER_KEY,user.id);setOwner(user.id);setPaused(true);if(previous!==user.id)await queueBaseline(db,user.id);localStorage.removeItem(BACKUP_PAUSED_KEY);setPaused(false);await reloadRef.current();setMessage('Backup enabled. Local records are queued for this account.');wakeBackup();}catch{if(previous)localStorage.setItem(BACKUP_OWNER_KEY,previous);else localStorage.removeItem(BACKUP_OWNER_KEY);if(wasPaused)localStorage.setItem(BACKUP_PAUSED_KEY,'1');else localStorage.removeItem(BACKUP_PAUSED_KEY);setOwner(previous);setPaused(wasPaused);setMessage('Could not queue local records; backup was not enabled.');}finally{setBusy(false);}
 };
 const pause=()=>{localStorage.setItem(BACKUP_PAUSED_KEY,'1');setPaused(true);setMessage('Backup paused. New changes are queued locally for the linked account.');};
 const signOut=async()=>{if(!cloudClient)return;setBusy(true);try{const {error}=await cloudClient.auth.signOut({scope:'local'});if(error)throw error;setUser(null);setMessage('Signed out. Pending changes remain on this device.');}catch{setMessage('Could not sign out. Please retry when online.');}finally{setBusy(false);}};
 const enabled=!!user&&owner===user.id&&!paused;
 return <section className="panel module-panel cloud-backup"><div className="panel-title"><span className="title-icon"><Cloud size={17}/></span><h2>Optional cloud backup</h2><span className="live-pill">{!cloudClient?'NOT CONFIGURED':enabled?'ENABLED':'PAUSED'}</span></div>
 <p className="module-desc">Opt-in, account-scoped upload of local records. This is a per-device backup, not automatic restore or cross-device sync.</p>
 {!cloudClient?<div className="note-box"><ShieldCheck size={17}/> Add a Supabase project URL and public key and apply the included migration to enable backup. No data is uploaded until you sign in and opt in.</div>:<>
 {!user?<><label className="field-label" htmlFor="backup-email">EXISTING APP ACCOUNT EMAIL</label><input id="backup-email" className="field" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/><label className="field-label" htmlFor="backup-password">PASSWORD</label><input id="backup-password" className="field" type="password" autoComplete="current-password" placeholder="App account password (not your dashboard password)" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&online&&!busy)void signIn();}}/><button className="button primary full" disabled={busy||!online||!email.trim()||!password} onClick={()=>void signIn()}>Sign in to backup</button>{allowEmailLink&&<button className="button secondary full" disabled={busy||!online||!email.trim()} onClick={()=>void sendLink()}>Send email sign-in link instead</button>}<p className="fine-print">Use an existing Supabase Auth app account, not your Supabase dashboard password. Email links require an explicitly allowed redirect origin.</p></>:<><div className="backup-account"><ShieldCheck size={17}/><div><b>Signed in</b><span>{user.email||user.id}</span></div><button className="icon-btn" title="Sign out" disabled={busy} onClick={()=>void signOut()}><LogOut size={16}/></button></div><div className="breakdown"><div><span>Backup state</span><b>{enabled?online?'Active':'Waiting for network':owner?(owner===user.id?'Paused':'Paused · different account'):'Not enabled'}</b></div><div><span>Pending for this account</span><b>{pendingFor(queue,user.id)}</b></div></div>{enabled?<button className="button secondary full" disabled={busy} onClick={pause}>Pause backup</button>:<button className="button primary full" disabled={busy} onClick={()=>void enable()}><Cloud size={15}/> Enable backup for this account</button>}{enabled&&<button className="button secondary full" disabled={!online||syncing} onClick={wakeBackup}><RefreshCw size={15}/> {syncing?'Uploading…':'Retry pending changes'}</button>}</>}
 {message&&<p className="backup-message" role="status">{message}</p>}
 </>}
 <p className="fine-print">Uploaded data can include asset names, FFT snapshots, repair estimates and quotes. Raw audio remains on-device. While paused or signed out, changes continue to queue locally for the last linked account. Pausing does not erase already uploaded data.</p></section>;
}
