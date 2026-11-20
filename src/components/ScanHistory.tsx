import { Check, Download, Printer, Trash2 } from 'lucide-react';
import type { Scan } from '../services/db';
import { updateScan, removeScan } from '../services/mutations';
import { faults } from '../services/faultDatabase';

function name(scan:Scan){return faults.find(f=>f.id===scan.faultId)?.short || 'No clear match';}
function report(scan:Scan){
 return {
  title:'Mecha Sonic diagnostic snapshot', recordedAt:scan.date, asset:scan.asset,
  input:scan.source, possibleSignature:name(scan), dominantFrequencyHz:scan.frequency,
  heuristicMatchScore:scan.confidence, resolved:!!scan.resolved,
  sampleRateHz:scan.sampleRate ?? null, fftSize:2048, fftMagnitudeBins:scan.bins ?? null,
  disclaimer:'This is an illustrative frequency match, not a confirmed diagnosis. Have a qualified technician verify any repair.'
 };
}
function download(scan:Scan){
 const url=URL.createObjectURL(new Blob([JSON.stringify(report(scan),null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=`mechasonic-scan-${scan.id??'report'}.json`;link.click();URL.revokeObjectURL(url);
}
function print(scan:Scan){
 const page=window.open('','_blank');if(!page)return;
 page.document.title='Mecha Sonic scan report';
 const heading=page.document.createElement('h1');heading.textContent='Mecha Sonic · Scan report';
 const note=page.document.createElement('p');note.textContent='Use your browser’s print dialog to save this report as a PDF.';
 const content=page.document.createElement('pre');const data=report(scan);
 // The full FFT is in the JSON export; a compact summary is easier to print.
 content.textContent=JSON.stringify({...data,fftMagnitudeBins:data.fftMagnitudeBins ? `${data.fftMagnitudeBins.length} bins available in JSON export` : null},null,2);
 content.style.whiteSpace='pre-wrap';content.style.fontFamily='monospace';
 page.document.body.append(heading,note,content);page.focus();page.print();
}
export function ScanHistory({scans,reload}:{scans:Scan[];reload:()=>Promise<void>}){
 return <div className="scan-history">{scans.map((scan,index)=>{
  const previous=scans.slice(index+1).find(s=>s.asset===scan.asset&&s.faultId===scan.faultId);
  const drift=previous?scan.frequency-previous.frequency:null;
  return <article className="scan-card" key={scan.id}>
   <div className="scan-card-head"><div><b>{name(scan)}</b><small>{scan.asset} · {new Date(scan.date).toLocaleString()} · {scan.source}</small></div><span className={scan.resolved?'resolved-badge':'muted-tag'}>{scan.resolved?'RESOLVED':'OPEN'}</span></div>
   <div className="scan-metrics"><span><b>{scan.frequency.toLocaleString()} Hz</b> dominant</span><span>{drift===null?'First comparable scan':`${drift>=0?'+':''}${drift} Hz vs prior`}</span><span>Match {scan.confidence}%</span></div>
   <div className="scan-actions"><button onClick={async()=>{if(scan.id!=null){await updateScan(scan,{resolved:!scan.resolved});await reload();}}}><Check size={13}/>{scan.resolved?'Reopen':'Mark resolved'}</button><button onClick={()=>download(scan)}><Download size={13}/> JSON</button><button onClick={()=>print(scan)}><Printer size={13}/> Print / PDF</button><button className="delete-scan" aria-label="Delete scan" title="Delete scan" onClick={async()=>{if(scan.id!=null&&confirm('Delete this saved scan?')){await removeScan(scan);await reload();}}}><Trash2 size={13}/></button></div>
  </article>;
 })}</div>;
}
