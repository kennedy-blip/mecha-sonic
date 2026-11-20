import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GarageDB } from '../src/services/db';

// Dexie emits a CustomEvent when closing; Node doesn't provide it in all versions.
if(typeof globalThis.CustomEvent==='undefined')vi.stubGlobal('CustomEvent',class CustomEvent extends Event {});
let database:GarageDB|undefined;
afterEach(async()=>{if(database){await database.delete();database=undefined;}});

describe('local garage',()=>{
 it('upgrades a v1 vault without losing scans',async()=>{
  const name=`migration-${crypto.randomUUID()}`;
  const old=new Dexie(name);
  old.version(1).stores({scans:'++id,date,faultId,asset',assets:'++id,name',queue:'++id,date,status'});
  await old.table('scans').add({date:'2026-01-01',faultId:'bearing',asset:'Civic',frequency:2650,confidence:70,source:'mic'});
  old.close();
  database=new GarageDB(name);
  expect(await database.scans.count()).toBe(1);
  expect((await database.scans.toArray())[0].asset).toBe('Civic');
  expect(await database.estimates.count()).toBe(0);
 });
 it('persists an estimate and its queued local mutation together',async()=>{
  database=new GarageDB(`estimate-${crypto.randomUUID()}`);
  const current=database;
  await current.transaction('rw',current.estimates,current.queue,async()=>{
   await current.estimates.add({date:'2026-01-01',faultId:'belt',asset:'Garage',labor:110,vehicle:'Economy Car',quote:'250',fairLow:80,fairHigh:250,checks:[true,false,false,false]});
   await current.queue.add({date:'2026-01-01',description:'Estimate: Belt friction',status:'Local only'});
  });
  expect((await current.estimates.toArray())[0].checks).toEqual([true,false,false,false]);
  expect((await current.queue.toArray())[0].status).toBe('Local only');
 });
});
