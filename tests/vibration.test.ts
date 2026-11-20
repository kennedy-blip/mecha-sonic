import { describe, expect, it } from 'vitest';
import { vibrationStats, type MotionSample } from '../src/services/useVibration';

describe('rolling vibration statistics', () => {
 it('returns zero values and no RPM for an empty or silent window', () => {
  expect(vibrationStats([])).toEqual({rms:0,peak:0,rpm:null,hz:null});
  const silent = Array.from({length:100},(_,i)=>({time:i*50,x:0,y:0,z:0}));
  expect(vibrationStats(silent).rpm).toBeNull();
 });
 it('computes vector RMS, peak, and approximate periodicity', () => {
  const samples:MotionSample[]=Array.from({length:100},(_,i)=>{
   const t=i*.05;
   return {time:i*50,x:0.2*Math.sin(2*Math.PI*3*t),y:0,z:0};
  });
  const result=vibrationStats(samples);
  expect(result.rms).toBeCloseTo(0.2/Math.sqrt(2),2);
  expect(result.peak).toBeCloseTo(0.2,2);
  expect(result.rpm).not.toBeNull();
  expect(result.rpm!).toBeGreaterThan(165);
  expect(result.rpm!).toBeLessThan(195);
 });
 it('does not report RPM without enough history',()=>{
  const short=Array.from({length:10},(_,i)=>({time:i*50,x:.1,y:.1,z:.1}));
  expect(vibrationStats(short).rpm).toBeNull();
 });
});
