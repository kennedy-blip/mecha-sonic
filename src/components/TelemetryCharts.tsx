import { useEffect, useRef } from 'react';
import type { DSPEngine } from '../services/dspEngine';
import type { MotionSample } from '../services/useVibration';

export function Waterfall({engine,active}:{engine:DSPEngine;active:boolean}) {
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const history=document.createElement('canvas');history.width=300;history.height=110;
  const hctx=history.getContext('2d');if(!hctx)return;
  hctx.fillStyle='#0c1715';hctx.fillRect(0,0,history.width,history.height);
  let frame=0,last=0;
  const draw=(now:number)=>{
   const ctx=canvas.getContext('2d');if(!ctx)return;
   if(active&&now-last>=100){
    last=now;hctx.drawImage(history,0,0,300,109,0,1,300,109);
    const data=engine.data(),rate=engine.context?.sampleRate||44100;
    const image=hctx.createImageData(300,1);
    for(let x=0;x<300;x++){
     const start=Math.floor((x/300*6000)/(rate/2048)),end=Math.max(start+1,Math.floor(((x+1)/300*6000)/(rate/2048)));
     let value=0;for(let i=start;i<end;i++)value=Math.max(value,data[i]||0);
     const v=value/255;const idx=x*4;
     image.data[idx]=Math.round(8+v*v*164);image.data[idx+1]=Math.round(22+v*210);image.data[idx+2]=Math.round(20+v*130);image.data[idx+3]=255;
    }
    hctx.putImageData(image,0,0);
   }
   const dpr=window.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=w*dpr;canvas.height=h*dpr;}
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(history,0,0,canvas.width,canvas.height);
   frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
 },[engine,active]);
 return <canvas ref={ref} className="waterfall" aria-label="Live spectrogram, frequency from 0 to 6000 hertz left to right, time from newest at the top to oldest at the bottom"/>;
}
export function Seismograph({samples}:{samples:MotionSample[]}) {
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;const dpr=window.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;
  canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);
  ctx.strokeStyle='rgba(139,170,173,.12)';ctx.lineWidth=1;
  for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(0,i*h/4);ctx.lineTo(w,i*h/4);ctx.stroke();}
  for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(i*w/5,0);ctx.lineTo(i*w/5,h);ctx.stroke();}
  if(!samples.length)return;
  const end=samples[samples.length-1].time,start=end-5000;
  const scale=Math.max(0.1,...samples.map(s=>Math.max(Math.abs(s.x),Math.abs(s.y),Math.abs(s.z))));
  (['x','y','z'] as const).forEach((axis,index)=>{ctx.beginPath();ctx.lineWidth=1.4;ctx.strokeStyle=['#76efb6','#69c1f0','#e7b072'][index];samples.forEach((s,i)=>{const x=(s.time-start)/5000*w,y=h/2-s[axis]/scale*h*.42;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();});
 },[samples]);
 return <canvas ref={ref} className="seismograph" aria-label="Five second three axis vibration trace"/>;
}
