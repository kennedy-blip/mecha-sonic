import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GarageDB } from '../src/services/db';
import { appendMutation, queueBaseline } from '../src/services/mutations';
import { flushBackup, isPublicProjectKey } from '../src/services/cloudBackup';
if(typeof globalThis.CustomEvent==='undefined')vi.stubGlobal('CustomEvent',class CustomEvent extends Event {});
let database:GarageDB|undefined;
afterEach(async()=>{if(database){await database.delete();database=undefined;}});
const account='user-a';
const client=(user:string,send:(args:Record<string,unknown>)=>Promise<{error:{message:string}|null}>)=>({
 auth:{getSession:async()=>({data:{session:{user:{id:user}}}})},
 rpc:(_name:string,args:Record<string,unknown>)=>send(args),
});
describe('opt-in cloud backup queue',()=>{
 it('rejects obvious secret and legacy service-role keys',()=>{
  expect(isPublicProjectKey('sb_secret_test')).toBe(false);
  const payload=btoa(JSON.stringify({role:'service_role'}));
  expect(isPublicProjectKey(`header.${payload}.signature`)).toBe(false);
  expect(isPublicProjectKey('sb_publishable_test')).toBe(true);
 });
 it('queues an initial snapshot and sends only the signed-in owner’s records',async()=>{
  database=new GarageDB(`cloud-${crypto.randomUUID()}`);const db=database;
  await db.assets.add({name:'Honda',type:'Car'});
  await db.scans.add({date:'2026-01-01',faultId:'bearing',asset:'Honda',frequency:2650,confidence:70,source:'mic',bins:[4,5]});
  await queueBaseline(db,account);
  await db.transaction('rw',db.queue,db.meta,async()=>appendMutation(db,'asset',{id:99,name:'Other',type:'Car'},false,'Other account','user-b'));
  const calls:Record<string,unknown>[]=[];
  const result=await flushBackup(db,client(account,async args=>{calls.push(args);return {error:null};}),account,()=>true);
  expect(result).toEqual({sent:2,remaining:0});
  expect(calls.map(x=>x.p_entity)).toEqual(['scan','asset']);
  expect(calls[0].p_sequence).toBeLessThan(calls[1].p_sequence as number);
  expect((await db.queue.toArray()).filter(q=>q.ownerId==='user-b')[0].status).toBe('Pending');
  expect(calls[0].p_payload).toMatchObject({bins:[4,5]});
 });
 it('keeps the failed event and later events pending for retry',async()=>{
  database=new GarageDB(`cloud-${crypto.randomUUID()}`);const db=database;
  await db.assets.bulkAdd([{name:'One',type:'Machine'},{name:'Two',type:'Machine'}]);await queueBaseline(db,account);
  let calls=0;
  const result=await flushBackup(db,client(account,async()=>{calls++;return {error:{message:'network unavailable'}};}),account,()=>true);
  expect(result.sent).toBe(0);expect(result.remaining).toBe(2);expect(calls).toBe(1);
  expect((await db.queue.toArray()).every(q=>q.status==='Pending')).toBe(true);
  const retry=await flushBackup(db,client(account,async()=>({error:null})),account,()=>true);
  expect(retry.sent).toBe(2);
 });
 it('never sends if the session changes or backup is paused',async()=>{
  database=new GarageDB(`cloud-${crypto.randomUUID()}`);const db=database;
  await db.assets.add({name:'One',type:'Machine'});await queueBaseline(db,account);
  const send=vi.fn().mockResolvedValue({error:null});
  await flushBackup(db,client('different-user',send),account,()=>true);
  await flushBackup(db,client(account,send),account,()=>false);
  expect(send).not.toHaveBeenCalled();expect((await db.queue.toArray())[0].status).toBe('Pending');
 });
 it('queues a tombstone instead of uploading deleted data',async()=>{
  database=new GarageDB(`cloud-${crypto.randomUUID()}`);const db=database;
  await db.transaction('rw',db.queue,db.meta,async()=>appendMutation(db,'scan',{id:1,date:'2026-01-01',faultId:'belt',asset:'Private',frequency:1,confidence:0,source:'mic'},true,'Deleted',account));
  const send=vi.fn().mockResolvedValue({error:null});await flushBackup(db,client(account,send),account,()=>true);
  expect(send.mock.calls[0][0]).toMatchObject({p_deleted:true,p_payload:null});
 });
});
