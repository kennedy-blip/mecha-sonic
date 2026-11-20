import Dexie, { type Table } from 'dexie';

export interface Scan {
 id?:number;date:string;faultId:string;frequency:number;confidence:number;source:string;
 asset:string;resolved?:boolean;bins?:number[];sampleRate?:number;
}
export interface Asset { id?:number;name:string;type:string }
export type Entity = 'scan' | 'asset' | 'estimate';
export interface QueueItem { id?:number;date:string;description:string;status:string;ownerId?:string;deviceId?:string;entity?:Entity;localId?:number;payload?:Scan|Asset|Estimate;deleted?:boolean;lastError?:string }
export interface MetaItem { key:string;value:string }
export interface Estimate {
 id?:number;date:string;faultId:string;asset:string;labor:number;vehicle:string;
 quote:string;fairLow:number;fairHigh:number;checks:boolean[];
}
export class GarageDB extends Dexie {
 scans!:Table<Scan>;
 assets!:Table<Asset>;
 queue!:Table<QueueItem>;
 estimates!:Table<Estimate>;
 meta!:Table<MetaItem>;
 constructor(name='MechaSonicGarage'){
  super(name);
  this.version(1).stores({scans:'++id,date,faultId,asset',assets:'++id,name',queue:'++id,date,status'});
  this.version(2).stores({scans:'++id,date,faultId,asset',assets:'++id,name',queue:'++id,date,status',estimates:'++id,date,faultId,asset'});
  this.version(3).stores({scans:'++id,date,faultId,asset',assets:'++id,name',queue:'++id,date,status,ownerId',estimates:'++id,date,faultId,asset',meta:'&key'});
 }
}
export const db=new GarageDB();
