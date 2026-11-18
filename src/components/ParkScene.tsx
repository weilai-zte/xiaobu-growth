import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BuddyActivity } from '../db/types'
import { latestParkArea, parkProgress, type ParkArea } from '../lib/park'
import { BirdItemPicture } from './BirdItemPicture'
import { parkCollection } from '../lib/parkCollection'
import { HOME_TREASURES, BIRD_ITEMS } from '../lib/birdCompanion'
import { BIRD_STAGES } from '../lib/adventure'
import type { ParkState } from './parkWorld'
interface Props {stage:string;count:number;activity:BuddyActivity;flapping:boolean;interactionId?:number;accessory:string;decor:string;treasures?:string[];items?:string[];onInteract:()=>void;carePanel?:ReactNode}
function ParkBackdrop({area}:{area:ParkArea}) {
 return <svg className="park-flat-scenery" viewBox="0 0 600 320" aria-hidden="true" focusable="false">
  <ellipse cx="300" cy="265" rx="270" ry="45" fill="#acc893"/>
  {area==='nest'&&<g><path d="M290 235V105m190 130V105" stroke="#a77e53" strokeWidth="9"/><path d="M265 110q120-85 240 0-105 50-240 0Z" fill="#a8c580"/><ellipse cx="290" cy="159" rx="12" ry="18" fill="#ffe7a6"/></g>}
  {area==='nest'&&<g fill="none" stroke="#ab7849" strokeWidth="12"><ellipse cx="380" cy="237" rx="110" ry="42" fill="#e9d6a5"/><path d="M270 237q110 125 220 0M280 255l190 22M295 282l176-37"/></g>}
  {area==='home'&&<g><rect x="330" y="108" width="164" height="154" rx="12" fill="#f0d3a0"/><path d="m305 118 107-90 107 90Z" fill="#a17da2"/><rect x="357" y="179" width="48" height="83" rx="15" fill="#a67d57"/><circle cx="452" cy="160" r="23" fill="#fff2ac" stroke="#b88c61" strokeWidth="6"/><rect x="450" y="47" width="22" height="48" fill="#b39178"/><path d="M340 175h80l-8-18h-64Z" fill="#b7c991"/>{[320,505].map(x=><g key={x}><path d={`M${x-13} 240h26l-4 25h-18Z`} fill="#be987b"/><circle cx={x} cy="227" r="16" fill="#91b77e"/><circle cx={x} cy="214" r="10" fill="#f1c3ce"/></g>)}</g>}
  {area==='garden'&&<g><path d="M290 260V140a100 100 0 0 1 200 0v120" fill="none" stroke="#b5c290" strokeWidth="8"/>{[0,1,2,3,4].map(i=><circle key={`arch${i}`} cx={390+Math.cos(i*Math.PI/4)*100} cy={140-Math.sin(i*Math.PI/4)*100} r="12" fill={i%2?'#ecc5d4':'#f8e6b5'}/>)}{[0,1,2,3,4,5].map(i=><g key={i} transform={`translate(${290+i*42} ${225-(i%2)*40})`}><path d="M0 0v48" stroke="#62915b" strokeWidth="6"/>{[0,1,2,3,4].map(k=><ellipse key={k} cx="0" cy="-13" rx="10" ry="17" transform={`rotate(${k*72})`} fill={i%2?'#e9b0d2':'#ffe2a1'}/>)}<circle r="8" fill="#fff3a1"/></g>)}<path d="M375 95q-47-51-37-5t37 5q47-51 37-5t-37 5" fill="#d99ed5"/></g>}
  {area==='pool'&&<g><path d="M515 260V100" stroke="#bda17f" strokeWidth="6"/><path d="m440 115 75-55 75 55Z" fill="#b5aed6"/><ellipse cx="390" cy="245" rx="136" ry="53" fill="#f7e6c4"/><ellipse cx="390" cy="237" rx="122" ry="40" fill="#77cadf"/><ellipse cx="390" cy="237" rx="78" ry="23" fill="none" stroke="#e9ffff" strokeWidth="3"/><ellipse cx="320" cy="238" rx="26" ry="15" fill="none" stroke="#f0bbc5" strokeWidth="12"/>{[0,1,2,3].map(i=><path key={i} d="m0-12 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" transform={`translate(${290+i*68} ${100+(i%2)*35})`} fill="#fff2a4"/>)}</g>}
 </svg>
}
export default function ParkScene({stage,count,activity,flapping,interactionId=0,accessory,decor,treasures,items,onInteract,carePanel}:Props) {
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<ReturnType<typeof import('./parkWorld').createParkWorld>>()
 const [area,setArea]=useState<ParkArea>(()=>latestParkArea(count)),[ready,setReady]=useState(false),[fallback,setFallback]=useState(false)
 const drag=useRef<{x:number;start:number}|null>(null)
 const state=useRef<ParkState>({stage,count,activity,area,flapping,interactionId,accessory,decor,treasures,items});state.current={stage,count,activity,area,flapping,interactionId,accessory,decor,treasures,items}
 const latestArea=latestParkArea(count)
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
 useEffect(()=>{engine.current?.update(state.current)},[stage,count,activity,area,flapping,interactionId,accessory,decor,treasures,items])
 useEffect(()=>{setArea(latestArea)},[latestArea])
 const collection=parkCollection(treasures,items,decor)
 const collectionKeys=[...collection.treasures,...collection.toys]
 const collectionNames=collectionKeys.map(key=>[...HOME_TREASURES,...BIRD_ITEMS].find(item=>item.key===key)?.name).join('、')
 const growth=BIRD_STAGES.find(s=>s.key===stage)??BIRD_STAGES[0]
 const current=zones.find(z=>z.key===area)!
 const artStage=['egg','crack','hatch','young'].includes(stage)?stage:'adult'
 const next=zones.find(z=>!z.unlocked)
 return <div className={`park-world park-area-${area} park-stage-${stage} park-mode-${activity}`} data-flapping={flapping||activity==='adventure'}>
  <div className="park-world-title"><div><span>小布的森林岛</span><strong>{sleeping?'月光下的晚安时光':current.name}</strong></div><span>{count}次冒险 · {zones.filter(z=>z.unlocked).length}/5处家园</span></div>
  <div className="park-viewport">
   <canvas ref={canvas} style={{visibility:fallback?'hidden':undefined}} aria-hidden="true" data-scene="budgie-3d" onPointerDown={e=>{drag.current={x:e.clientX,start:e.clientX};e.currentTarget.setPointerCapture?.(e.pointerId)}} onPointerMove={e=>{if(drag.current){engine.current?.rotate((e.clientX-drag.current.x)*.005);drag.current.x=e.clientX}}} onPointerUp={e=>{if(drag.current&&Math.abs(e.clientX-drag.current.start)<6)onInteract();drag.current=null}} onPointerCancel={()=>{drag.current=null}}/>
   {(!ready||fallback)&&<div className="park-fallback">{fallback?<><ParkBackdrop area={area}/><div className="park-fallback-collection" aria-hidden="true">{[...collectionKeys.filter(key=>key!==collection.favorite),...(collection.favorite?[collection.favorite]:[])].map((key,i)=><span key={key} className={key===collection.favorite?'favorite':undefined} style={{left:key===collection.favorite?'62%':`${[8,23,40,82,94,8,25,42,59,76,93][i]}%`,top:key===collection.favorite?'76%':`${i<5?73:60}%`}}><BirdItemPicture kind={key}/></span>)}</div><img key={interactionId} className="park-stage-art" src={`${import.meta.env.BASE_URL}images/xiaobu-stages-v7/${artStage}.png`} alt={`小布：${growth.name}`} width="320" height="300"/><small role="status">{flapping?'小布扑扑翅膀，回应你啦。':'当前设备使用轻量场景，照料和冒险照常保存。'}</small></>:<p role="status">小布的森林岛正在醒来…</p>}</div>}
   <div className="park-location-pill">{growth.name===current.name?current.name:`${growth.name} · ${current.name}`}</div>
   <div className="park-camera-controls" role="group" aria-label="转动乐园视角"><button type="button" aria-label="向左看看乐园" onClick={()=>engine.current?.rotate(-.2)}>↶</button><button type="button" aria-label="向右看看乐园" onClick={()=>engine.current?.rotate(.2)}>↷</button></div>
   <button type="button" className="park-pet-button" aria-label={sleeping?'看看正在睡觉的小步':egg?'轻轻和小蛋打招呼':'和虎皮鹦鹉小步互动'} onClick={onInteract}>{sleeping?'☾ 小布睡得香香的':egg?'轻轻点我，打个招呼':'✦ 点点小布，扑扑翅膀'}</button>
  </div>
  {carePanel}
  {!!collectionKeys.length&&<p className="park-collection-note" role="status">乐园里摆着 {collection.treasures.length} 件收藏、{collection.toys.length} 件玩具<span className="sr-only">：{collectionNames}</span></p>}
  <p className="park-growth-description">{growth.text}</p>
  <details className="park-settings"><summary>布置乐园 · {current.name}</summary>
  <div className="park-zones" role="group" aria-label="小布的家园区域">{zones.map(zone=><button type="button" key={zone.key} aria-pressed={zone.key===area} disabled={!zone.unlocked||sleeping||(egg&&zone.key!=='meadow')} onClick={()=>setArea(zone.key)}><span aria-hidden="true">{{meadow:'☀',nest:'◉',home:'⌂',garden:'❀',pool:'≈'}[zone.key]}</span><strong>{zone.name}</strong><small>{zone.unlocked?'去这里玩':`冒险${zone.at}次解锁`}</small></button>)}</div>
  <p className="park-world-description" role="status">{sleeping?'嘘，小布收好翅膀、闭上眼睛，轻轻呼吸。叫醒以后再去探索。':area==='pool'?'小布正在浅水池里拍翅玩水，小鸭子陪着它。':area==='garden'?'小布跟着蝴蝶练习飞行，花朵在身边轻轻摇动。':current.description}</p>
  </details>
  {next&&<p className="park-unlock-hint">下一处惊喜：{next.name} · 再一起冒险{next.remaining}次</p>}
 </div>
}
