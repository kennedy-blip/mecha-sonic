import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GarageDB, QueueItem } from './db';
import { defaultCloudUrl, defaultCloudPublicKey } from '../config/cloud';

const url=import.meta.env.VITE_SUPABASE_URL || defaultCloudUrl;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY || defaultCloudPublicKey;
// This is a guardrail, not a way to keep a secret safe: Vite embeds every
// VITE_ variable in the browser bundle. Never supply a secret to the build.
export function isPublicProjectKey(value:string){
 if(value.startsWith('sb_secret_'))return false;
 const parts=value.split('.');
 if(parts.length===3){try{const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role==='service_role')return false;}catch{/* Non-JWT public keys are accepted by the SDK. */}}
 return true;
}
function configuredClient():SupabaseClient|null{
 if(!url||!key||!isPublicProjectKey(key))return null;
 try{return createClient(url,key);}catch{console.warn('Invalid Supabase backup configuration.');return null;}
}
export const cloudClient=configuredClient();

type BackupClient={
 auth:{getSession:()=>Promise<{data:{session:{user:{id:string}}|null}}>};
 rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{error:{message:string}|null}>;
};
export interface BackupResult {sent:number;remaining:number;error?:string}

/** Push one account's pending mutations in local ID order. Retrying is safe because
 * the server rejects an older or duplicate sequence for each device record. */
export async function flushBackup(database:GarageDB,client:BackupClient,owner:string,isStillEnabled:()=>boolean):Promise<BackupResult>{
 const pending=(await database.queue.toArray()).filter(item=>item.status==='Pending'&&item.ownerId===owner).sort((a,b)=>(a.id??0)-(b.id??0));
 let sent=0;
 for(const item of pending){
  if(!isStillEnabled())break;
  const {data}=await client.auth.getSession();
  if(data.session?.user.id!==owner)break;
  if(!item.id||!item.deviceId||!item.entity||!item.localId||(!item.deleted&&!item.payload)){
   if(item.id)await database.queue.update(item.id,{lastError:'Incomplete queued mutation; not uploaded.'});
   return {sent,remaining:pending.length-sent,error:'Incomplete queued mutation; not uploaded.'};
  }
  try{
   const {error}=await client.rpc('mechasonic_apply_change',{
    p_device_id:item.deviceId,p_entity:item.entity,p_local_id:item.localId,p_sequence:item.id,
    p_payload:item.deleted?null:item.payload,p_deleted:!!item.deleted
   });
   if(error)throw new Error(error.message);
   await database.queue.update(item.id,{status:'Uploaded',lastError:undefined});sent++;
  }catch(error){
   const message=error instanceof Error?error.message:'Backup request failed';
   await database.queue.update(item.id,{lastError:message});
   return {sent,remaining:pending.length-sent,error:message};
  }
 }
 return {sent,remaining:pending.length-sent};
}
export function pendingFor(queue:QueueItem[],owner:string|null){return queue.filter(item=>item.status==='Pending'&&item.ownerId===owner).length;}
