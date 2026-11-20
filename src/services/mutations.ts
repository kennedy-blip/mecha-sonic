import { db, type GarageDB, type Entity, type Scan, type Asset, type Estimate } from './db';

export const BACKUP_OWNER_KEY='ms-backup-user';
export const BACKUP_PAUSED_KEY='ms-backup-paused';
export function backupPaused(){return localStorage.getItem(BACKUP_PAUSED_KEY)==='1';}
export type RecordData=Scan|Asset|Estimate;
export function backupOwner(){return localStorage.getItem(BACKUP_OWNER_KEY);}
function notify(){window.dispatchEvent(new Event('ms:local-change'));}

// Call inside a transaction including queue and meta. A snapshot and its local
// mutation commit together; legacy entries without a payload are never uploaded.
export async function appendMutation(database:GarageDB,entity:Entity,record:RecordData,deleted:boolean,description:string,owner=backupOwner()){
 if(record.id==null)throw new Error('Cannot queue a record without an ID');
 const date=new Date().toISOString();
 if(!owner){await database.queue.add({date,description,status:'Local only'});return;}
 let device=await database.meta.get('deviceId');
 if(!device){device={key:'deviceId',value:crypto.randomUUID()};await database.meta.put(device);}
 await database.queue.add({date,description,status:'Pending',ownerId:owner,deviceId:device.value,entity,localId:record.id,payload:deleted?undefined:record,deleted});
}

export async function saveScan(scan:Scan){
 await db.transaction('rw',db.scans,db.queue,db.meta,async()=>{const id=await db.scans.add(scan);await appendMutation(db,'scan',{...scan,id},false,'Scan saved');});notify();
}
export async function addAsset(asset:Asset){
 await db.transaction('rw',db.assets,db.queue,db.meta,async()=>{const id=await db.assets.add(asset);await appendMutation(db,'asset',{...asset,id},false,`Asset: ${asset.name}`);});notify();
}
export async function saveEstimate(estimate:Estimate){
 await db.transaction('rw',db.estimates,db.queue,db.meta,async()=>{const id=await db.estimates.add(estimate);await appendMutation(db,'estimate',{...estimate,id},false,'Repair estimate saved');});notify();
}
export async function updateScan(scan:Scan,changes:Partial<Scan>){
 if(scan.id==null)return;
 await db.transaction('rw',db.scans,db.queue,db.meta,async()=>{const current=await db.scans.get(scan.id!);if(!current)return;await db.scans.update(scan.id!,changes);await appendMutation(db,'scan',{...current,...changes},false,'Scan updated');});notify();
}
export async function removeScan(scan:Scan){
 if(scan.id==null)return;
 await db.transaction('rw',db.scans,db.queue,db.meta,async()=>{const current=await db.scans.get(scan.id!);if(!current)return;await db.scans.delete(scan.id!);await appendMutation(db,'scan',current,true,'Scan deleted');});notify();
}
export async function removeEstimate(estimate:Estimate){
 if(estimate.id==null)return;
 await db.transaction('rw',db.estimates,db.queue,db.meta,async()=>{const current=await db.estimates.get(estimate.id!);if(!current)return;await db.estimates.delete(estimate.id!);await appendMutation(db,'estimate',current,true,'Estimate deleted');});notify();
}
// Enabling is explicit and makes a snapshot of everything currently local.
export async function queueBaseline(database:GarageDB,owner:string){
 await database.transaction('rw',database.scans,database.assets,database.estimates,database.queue,database.meta,async()=>{
  for(const record of await database.scans.toArray())await appendMutation(database,'scan',record,false,'Existing scan',owner);
  for(const record of await database.assets.toArray())await appendMutation(database,'asset',record,false,`Existing asset: ${record.name}`,owner);
  for(const record of await database.estimates.toArray())await appendMutation(database,'estimate',record,false,'Existing estimate',owner);
 });
}
export function wakeBackup(){notify();}
