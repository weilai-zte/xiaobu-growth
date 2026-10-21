import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BuddyActivity } from '../db/types'
import { parkProgress, type ParkArea } from '../lib/park'
import { BuddyBird } from './GrowthJourney'
import type { ParkState } from './parkWorld'
interface Props {stage:string;count:number;activity:BuddyActivity;flapping:boolean;interactionId?:number;accessory:string;decor:string;onInteract:()=>void;carePanel?:ReactNode}
export default function ParkScene({stage,count,activity,flapping,interactionId=0,accessory,decor,onInteract,carePanel}:Props) {
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<ReturnType<typeof import('./parkWorld').createParkWorld>>()
 const [area,setArea]=useState<ParkArea>('meadow'),[ready,setReady]=useState(false),[fallback,setFallback]=useState(false)
 const drag=useRef<{x:number;start:number}|null>(null)
 const state=useRef<ParkState>({stage,count,activity,area,flapping,interactionId,accessory,decor});state.current={stage,count,activity,area,flapping,interactionId,accessory,decor}
 const zones=parkProgress(count),sleeping=activity==='sleep',egg=['egg','crack'].includes(stage)
 useEffect(()=>{
  if(typeof WebGLRenderingContext==='undefined'){setFallback(true);return}
  let cancelled=false
  void import('./parkWorld').then(({createParkWorld})=>{
   if(cancelled||!canvas.current)return
   try{engine.current=createParkWorld(canvas.current,state.current,()=>{setFallback(true);setReady(false)});setReady(true)}catch{setFallback(true)}
  }).catch(()=>setFallback(true))
  return()=>{cancelled=true;engine.current?.dispose();engine.current=undefined}
 },[])
 useEffect(()=>{engine.current?.update(state.current)},[stage,count,activity,area,flapping,interactionId,accessory,decor])
 useEffect(()=>{if(!zones.some(z=>z.key===area&&z.unlocked))setArea('meadow')},[count,area])
 const current=zones.find(z=>z.key===area)!
 const next=zones.find(z=>!z.unlocked)
 return <div className={`park-world park-mode-${activity}`} data-flapping={flapping||activity==='adventure'}>
  <div className="park-world-title"><div><span>小布的森林岛</span><strong>{sleeping?'月光下的晚安时光':current.name}</strong></div><span>{count}次冒险 · {zones.filter(z=>z.unlocked).length}/5处家园</span></div>
  <div className="park-viewport">
   <canvas ref={canvas} aria-hidden="true" data-scene="budgie-3d" onPointerDown={e=>{drag.current={x:e.clientX,start:e.clientX};e.currentTarget.setPointerCapture?.(e.pointerId)}} onPointerMove={e=>{if(drag.current){engine.current?.rotate((e.clientX-drag.current.x)*.005);drag.current.x=e.clientX}}} onPointerUp={e=>{if(drag.current&&Math.abs(e.clientX-drag.current.start)<6)onInteract();drag.current=null}} onPointerCancel={()=>{drag.current=null}}/>
   {(!ready||fallback)&&<div className="park-fallback">{fallback?<><BuddyBird stage={stage} flapping={flapping}/><small>当前设备使用轻量场景，照料和冒险照常保存。</small></>:<p role="status">小布的森林岛正在醒来…</p>}</div>}
   <div className="park-location-pill">{count>=21?'森林小屋已建成':count>=14?'小窝已经编好':'先在草地上慢慢长大'}</div>
   <div className="park-camera-controls" role="group" aria-label="转动乐园视角"><button type="button" aria-label="向左看看乐园" onClick={()=>engine.current?.rotate(-.2)}>↶</button><button type="button" aria-label="向右看看乐园" onClick={()=>engine.current?.rotate(.2)}>↷</button></div>
   <button type="button" className="park-pet-button" aria-label={sleeping?'看看正在睡觉的小步':egg?'轻轻和小蛋打招呼':'和虎皮鹦鹉小步互动'} onClick={onInteract}>{sleeping?'☾ 小布睡得香香的':egg?'轻轻点我，打个招呼':'✦ 点点小布，扑扑翅膀'}</button>
  </div>
  {carePanel}
  <details className="park-settings"><summary>布置乐园 · {current.name}</summary>
  <div className="park-zones" role="group" aria-label="小布的家园区域">{zones.map(zone=><button type="button" key={zone.key} aria-pressed={zone.key===area} disabled={!zone.unlocked||sleeping||(egg&&zone.key!=='meadow')} onClick={()=>setArea(zone.key)}><span aria-hidden="true">{{meadow:'☀',nest:'◉',home:'⌂',garden:'❀',pool:'≈'}[zone.key]}</span><strong>{zone.name}</strong><small>{zone.unlocked?'去这里玩':`冒险${zone.at}次解锁`}</small></button>)}</div>
  <p className="park-world-description" role="status">{sleeping?'嘘，小布收好翅膀、闭上眼睛，轻轻呼吸。叫醒以后再去探索。':area==='pool'?'小布正在浅水池里拍翅玩水，小鸭子陪着它。':area==='garden'?'小布跟着蝴蝶练习飞行，花朵在身边轻轻摇动。':current.description}</p>
  </details>
  {next&&<p className="park-unlock-hint">下一处惊喜：{next.name} · 再一起冒险{next.remaining}次</p>}
 </div>
}
