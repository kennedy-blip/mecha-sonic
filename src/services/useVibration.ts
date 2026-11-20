import { useCallback, useEffect, useRef, useState } from 'react';

export interface MotionSample { time: number; x: number; y: number; z: number }
export interface VibrationStats { rms: number; peak: number; rpm: number | null; hz: number | null }
const WINDOW_MS = 5000;

// Rolling vector RMS is computed from linear acceleration (gravity excluded), in g.
export function vibrationStats(samples: MotionSample[]): VibrationStats {
 if (!samples.length) return { rms: 0, peak: 0, rpm: null, hz: null };
 const magnitudes = samples.map(s => Math.hypot(s.x, s.y, s.z));
 const rms = Math.sqrt(magnitudes.reduce((sum, n) => sum + n*n, 0) / magnitudes.length);
 const peak = Math.max(...magnitudes);
 if (samples.length < 30 || samples[samples.length - 1].time - samples[0].time < 1500 || rms < 0.005) return { rms, peak, rpm: null, hz: null };
 // Use the axis with greatest variance; lag is an approximate estimate, not a tachometer.
 const axes = (['x','y','z'] as const).map(axis => {
  const mean = samples.reduce((sum, s) => sum + s[axis], 0) / samples.length;
  const values = samples.map(s => s[axis] - mean);
  return { values, variance: values.reduce((sum, n) => sum + n*n, 0) };
 }).sort((a,b) => b.variance-a.variance);
 const values = axes[0].values;
 const duration = (samples[samples.length - 1].time - samples[0].time) / 1000;
 const rate = (samples.length - 1) / duration;
 const minLag = Math.max(2, Math.ceil(rate / 15)); // at most 15 Hz
 const maxLag = Math.min(Math.floor(rate / 0.5), Math.floor(samples.length / 3));
 const correlations: number[] = [];
 for (let lag = Math.max(1,minLag-1); lag <= maxLag+1; lag++) {
  let cross=0, left=0, right=0;
  for(let i=lag;i<values.length;i++){const a=values[i],b=values[i-lag];cross+=a*b;left+=a*a;right+=b*b;}
  correlations[lag] = cross / Math.sqrt(left*right || 1);
 }
 // Prefer the first strong local maximum, so multiple periods do not masquerade
 // as a lower frequency. Parabolic interpolation reduces integer-lag error.
 let bestLag=0;
 for(let lag=minLag;lag<=maxLag;lag++){
  const before=correlations[lag-1]??-1, current=correlations[lag], after=correlations[lag+1]??-1;
  if(current>=0.65 && current>=before && current>=after){
   const denominator=before-2*current+after;
   const offset=Math.abs(denominator)>1e-9 ? Math.max(-.5,Math.min(.5,.5*(before-after)/denominator)) : 0;
   bestLag=lag+offset;break;
  }
 }
 const hz = bestLag ? rate / bestLag : null;
 return { rms, peak, hz, rpm: hz === null ? null : hz * 60 };
}

export function useVibration(enabled = true) {
 const samplesRef=useRef<MotionSample[]>([]);
 const listenerRef=useRef<((event:DeviceMotionEvent)=>void)|null>(null);
 const modeRef=useRef<'simulation'|'sensor'>('simulation');
 const amplitudeRef=useRef(0.12);
 const [amplitude,setAmplitudeState]=useState(0.12);
 const [mode,setMode]=useState<'simulation'|'sensor'>('simulation');
 const [status,setStatus]=useState('SIMULATED');
 const [samples,setSamples]=useState<MotionSample[]>([]);
 const push=useCallback((x:number,y:number,z:number)=>{
  const time=performance.now();
  const list=samplesRef.current;
  // Cap high-frequency devices to ~100 samples/second to keep rendering bounded.
  if(list.length && time-list[list.length-1].time<10)return;
  list.push({time,x,y,z});
  while(list.length && (list[0].time < time-WINDOW_MS || list.length>500))list.shift();
 },[]);
 const stopSensor=useCallback(()=>{if(listenerRef.current){window.removeEventListener('devicemotion',listenerRef.current);listenerRef.current=null;}},[]);
 const simulate=useCallback((value:number)=>{stopSensor();modeRef.current='simulation';setMode('simulation');setStatus('SIMULATED');amplitudeRef.current=value;setAmplitudeState(value);samplesRef.current=[];},[stopSensor]);
 useEffect(()=>()=>stopSensor(),[stopSensor]);
 useEffect(()=>{if(!enabled)return;const timer=window.setInterval(()=>{
  if(modeRef.current==='simulation'){
   const t=performance.now()/1000, a=amplitudeRef.current;
   push(a*Math.sin(2*Math.PI*3*t),a*.6*Math.sin(2*Math.PI*3*t+1),a*.35*Math.sin(2*Math.PI*3*t+2));
  }
  setSamples([...samplesRef.current]);
 },50);return()=>window.clearInterval(timer);},[push,enabled]);
 const requestSensor=useCallback(async()=>{
  try {
   if(typeof DeviceMotionEvent==='undefined')throw new Error('Motion sensor not supported');
   const D=DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<string>};
   if(D.requestPermission && await D.requestPermission()!=='granted')throw new Error('Motion permission denied');
   stopSensor();samplesRef.current=[];modeRef.current='sensor';setMode('sensor');setStatus('WAITING FOR SENSOR');
   const listener=(event:DeviceMotionEvent)=>{const a=event.acceleration;if(a&&(a.x!=null||a.y!=null||a.z!=null)){push((a.x??0)/9.81,(a.y??0)/9.81,(a.z??0)/9.81);setStatus('LIVE');}};
   listenerRef.current=listener;window.addEventListener('devicemotion',listener);
   return true;
  }catch{simulate(amplitudeRef.current);return false;}
 },[push,simulate,stopSensor]);
 return {samples,stats:vibrationStats(samples),amplitude,mode,status,simulate,requestSensor};
}
