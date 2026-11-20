import { simulations, type Fault } from './faultDatabase';

const unclassified: Fault = {
 ...simulations[4], id:'unknown', name:'No clear signature', short:'No clear match',
 description:'No known signature matched the dominant frequency. This does not establish machine health.'
};

export class DSPEngine {
 context?:AudioContext;
 analyser?:AnalyserNode;
 filter?:BiquadFilterNode;
 lowCut?:BiquadFilterNode;
 notch?:BiquadFilterNode;
 stream?:MediaStream;
 nodes:AudioNode[]=[];
 source='';
 monitor?:GainNode;
 private generation=0;

 async start(mode:'mic'|'simulation', fault:Fault){
  this.stop();
  const generation=++this.generation;
  const ctx=new AudioContext();
  this.context=ctx;
  const analyser=ctx.createAnalyser();
  this.analyser=analyser;
  analyser.fftSize=2048;
  analyser.minDecibels=-100;
  analyser.maxDecibels=-10;
  analyser.smoothingTimeConstant=.75;
  this.lowCut=ctx.createBiquadFilter();
  this.lowCut.type='highpass';
  this.lowCut.frequency.value=50;
  this.notch=ctx.createBiquadFilter();
  this.notch.type='allpass';
  this.filter=ctx.createBiquadFilter();
  this.filter.type='bandpass';
  this.filter.frequency.value=2650;
  this.filter.Q.value=1;
  this.monitor=ctx.createGain();
  this.monitor.gain.value=0;
  analyser.connect(this.lowCut);
  this.lowCut.connect(this.filter);
  this.filter.connect(this.notch);
  this.notch.connect(this.monitor);
  this.monitor.connect(ctx.destination);
  this.source=mode;
  try {
   if(mode==='mic'){
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    // Permission prompts can outlive the input selection. Never leak a late stream
    // or attach it to a newer session.
    if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());throw new DOMException('Input request was cancelled','AbortError');}
    this.stream=stream;
    const input=ctx.createMediaStreamSource(stream);
    input.connect(analyser);
    this.nodes.push(input);
   } else {
    const add=(frequency:number,gain:number,type:OscillatorType='sine')=>{
     const osc=ctx.createOscillator(),amp=ctx.createGain();
     osc.type=type;osc.frequency.value=frequency;amp.gain.value=gain;
     osc.connect(amp);amp.connect(analyser);osc.start();this.nodes.push(osc,amp);
     return amp;
    };
    add(80,.035);add(160,.025);
    if(fault.id==='healthy'){add(200,.13);add(400,.05);}
    else if(fault.id==='hvac'){add(60,.15);add(120,.25);add(240,.1);}
    else {
     const amp=add(fault.frequency,.22,fault.id==='knock'?'triangle':'sine');
     add(fault.frequency-35,.04);add(fault.frequency+35,.04);
     const lfo=ctx.createOscillator(),depth=ctx.createGain();
     lfo.frequency.value=fault.id==='belt'?4:fault.id==='knock'?8:12;
     depth.gain.value=.12;lfo.connect(depth);depth.connect(amp.gain);lfo.start();this.nodes.push(lfo,depth);
    }
   }
   await ctx.resume();
   if(generation!==this.generation)throw new DOMException('Input request was cancelled','AbortError');
  }catch(error){
   if(generation===this.generation)this.stop();
   else if(ctx.state!=='closed')void ctx.close();
   throw error;
  }
 }
 setFilter(freq:number,q:number,listen:boolean,lowCut:number,notchHz:number,notchOn:boolean){
  if(this.filter){this.filter.frequency.value=freq;this.filter.Q.value=q;}
  if(this.lowCut)this.lowCut.frequency.value=lowCut;
  if(this.notch){this.notch.type=notchOn?'notch':'allpass';this.notch.frequency.value=notchHz;this.notch.Q.value=8;}
  if(this.monitor&&this.context)this.monitor.gain.setTargetAtTime(listen?.12:0,this.context.currentTime,.03);
 }
 data(){const data=new Uint8Array(this.analyser?.frequencyBinCount??1024);this.analyser?.getByteFrequencyData(data);return data;}
 peak(){const data=this.data();let index=0;for(let i=1;i<data.length;i++)if(data[i]>data[index])index=i;return {frequency:Math.round(index*(this.context?.sampleRate??44100)/2048),level:data[index]??0};}
 classify(){
  const peak=this.peak();
  if(peak.level<35)return {fault:unclassified,confidence:0,...peak};
  const tolerance=Math.max(90,(this.context?.sampleRate??44100)/2048*3);
  const best=simulations.slice(0,4).map(f=>({fault:f,difference:Math.abs(f.frequency-peak.frequency)})).sort((a,b)=>a.difference-b.difference)[0];
  if(best.difference>tolerance)return {fault:unclassified,confidence:0,...peak};
  return {fault:best.fault,confidence:Math.min(95,Math.max(35,Math.round((1-best.difference/(tolerance*2))*peak.level/255*100))),...peak};
 }
 stop(){
  this.generation++;
  this.stream?.getTracks().forEach(track=>track.stop());
  this.nodes.forEach(node=>{try{if(node instanceof OscillatorNode)node.stop();node.disconnect();}catch{/* already stopped */}});
  this.nodes=[];
  if(this.context&&this.context.state!=='closed')void this.context.close();
  this.context=undefined;this.analyser=undefined;this.filter=undefined;this.lowCut=undefined;this.notch=undefined;this.monitor=undefined;this.stream=undefined;
 }
}
