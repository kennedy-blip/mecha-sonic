import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DSPEngine } from '../src/services/dspEngine';
import { simulations } from '../src/services/faultDatabase';
class MockNode { connect=vi.fn();disconnect=vi.fn(); }
class MockOscillator extends MockNode { type='sine';frequency={value:0};start=vi.fn();stop=vi.fn(); }
class MockGain extends MockNode {gain={value:1,setTargetAtTime:vi.fn()};}
class MockFilter extends MockNode {type='';frequency={value:0};Q={value:0};}
class MockAnalyser extends MockNode {fftSize=2048;frequencyBinCount=1024;smoothingTimeConstant=0;minDecibels=0;maxDecibels=0;peakBin=0;peakLevel=0;getByteFrequencyData(data:Uint8Array){data.fill(0);data[this.peakBin]=this.peakLevel;}}
class MockContext {
 sampleRate=44100;currentTime=0;state='running';destination=new MockNode();analyser=new MockAnalyser();
 createAnalyser(){return this.analyser;}createGain(){return new MockGain();}createOscillator(){return new MockOscillator();}createBiquadFilter(){return new MockFilter();}createMediaStreamSource(){return new MockNode();}resume=vi.fn().mockResolvedValue(undefined);close=vi.fn().mockResolvedValue(undefined);
}
describe('audio engine',()=>{
 let engine:DSPEngine;
 beforeEach(()=>{vi.stubGlobal('AudioContext',MockContext);vi.stubGlobal('OscillatorNode',MockOscillator);engine=new DSPEngine();});
 afterEach(()=>{engine.stop();vi.unstubAllGlobals();});
 it('routes the simulator through the analyser and applies actual filter parameters',async()=>{
  await engine.start('simulation',simulations[0]);
  expect(engine.analyser?.fftSize).toBe(2048);
  expect(engine.nodes.length).toBeGreaterThan(0);
  engine.setFilter(2200,4,true,100,60,true);
  expect(engine.filter?.frequency.value).toBe(2200);
  expect(engine.lowCut?.frequency.value).toBe(100);
  expect(engine.notch?.type).toBe('notch');
  expect(engine.monitor?.gain.setTargetAtTime).toHaveBeenCalled();
  engine.setFilter(2200,4,false,100,60,false);
  expect(engine.notch?.type).toBe('allpass');
 });
 it('matches a known peak but does not claim health for an unknown one',async()=>{
  await engine.start('simulation',simulations[0]);
  const analyser=engine.analyser as unknown as MockAnalyser;
  analyser.peakBin=123;analyser.peakLevel=180;
  expect(engine.classify().fault.id).toBe('bearing');
  analyser.peakBin=70;
  expect(engine.classify().fault.id).toBe('unknown');
  analyser.peakLevel=0;
  expect(engine.classify().confidence).toBe(0);
 });
 it('stops a microphone stream that arrives after a newer input starts',async()=>{
  let resolveStream:(stream:unknown)=>void=()=>{};
  const getUserMedia=vi.fn().mockImplementation(()=>new Promise(resolve=>{resolveStream=resolve;}));
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
  const first=engine.start('mic',simulations[0]);
  const staleResult=first.catch(error=>error);
  await engine.start('simulation',simulations[1]);
  const stop=vi.fn();resolveStream({getTracks:()=>[{stop}]});
  const error=await staleResult;
  expect(error.name).toBe('AbortError');
  expect(stop).toHaveBeenCalledOnce();
  expect(engine.source).toBe('simulation');
  expect(engine.context).toBeDefined();
 });
 it('requests unprocessed microphone audio and stops its tracks',async()=>{
  const stop=vi.fn();const getUserMedia=vi.fn().mockResolvedValue({getTracks:()=>[{stop}]});
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
  await engine.start('mic',simulations[0]);
  expect(getUserMedia).toHaveBeenCalledWith({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  engine.stop();expect(stop).toHaveBeenCalledOnce();
 });
});
