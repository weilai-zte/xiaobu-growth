import { useEffect, useId, useRef } from 'react'
import { HONORS, buildHonorSky } from '../lib/honors'
import { ZODIAC_SIGNS } from '../lib/constellations'
import type { ChildProfile } from '../db/types'
import { HonorMedal } from './HonorMedal'

export function HonorDetail({honorId,profile,onClose,trigger}:{honorId:string|null;profile?:ChildProfile;onClose:()=>void;trigger:HTMLElement|null}) {
 const dialog=useRef<HTMLDialogElement>(null),close=useRef<HTMLButtonElement>(null),id=useId()
 const honor=HONORS.find(h=>h.id===honorId),earnedAt=honorId?profile?.honorClaims?.[honorId]:undefined
 useEffect(()=>{if(honorId){dialog.current?.showModal();close.current?.focus()}else if(dialog.current?.open)dialog.current.close()},[honorId])
 const targets=buildHonorSky(profile?.honorClaims,profile?.starClaims).filter(s=>s.honorId===honorId)
 return <dialog className="honor-detail-dialog" ref={dialog} aria-labelledby={`${id}-title`} onClose={()=>{onClose();trigger?.focus()}} onCancel={onClose}>
  <h2 id={`${id}-title`}>{honor?.title??'成长勋章'}</h2>
  {honor&&<><HonorMedal honorId={honor.id} mystery={!earnedAt}/><p className="honor-detail-tag">{earnedAt?'✦ 这是你努力的纪念':'✧ 未来的成长惊喜'}</p><h3>这枚勋章怎么获得？</h3><p>{honor.requirement}</p>{earnedAt?<><p>获得于 <time dateTime={earnedAt}>{new Date(earnedAt).toLocaleString('zh-CN')}</time></p><p className="honor-detail-note">系统根据已保存的成长记录授予。即使后来调整记录，这份荣誉也会保留。</p><h3>它唤醒的星星</h3><div className="honor-star-links">{targets.map(star=><a key={star.id} href={`#/child/growth?star=${encodeURIComponent(star.id)}`} onClick={()=>dialog.current?.close()}>{star.lit?'查看':'去点亮'}{ZODIAC_SIGNS.find(s=>s.key===star.signKey)?.name} · {star.name}<span>{star.lit?'已点亮':'等待点亮 →'}</span></a>)}</div></>:<p>获得这枚勋章后，就能唤醒对应的星星。</p>}</>}
  <button ref={close} type="button" className="zodiac-reveal" onClick={()=>dialog.current?.close()}>收好勋章</button>
 </dialog>
}
