import { HonorMedal } from './HonorMedal'
import { HonorDetail } from './HonorDetail'
import type { ChildProfile } from '../db/types'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../app/AppProvider'
import { repo } from '../db/repo'
import { HONORS, evaluateHonors } from '../lib/honors'

export function HonorNotice() {
 const {profile}=useApp(),childId=profile?.id
 const location=useLocation(),[error,setError]=useState('')
 const source=useLiveQuery(async()=>childId?JSON.stringify([
  await repo.listTaskRecords(childId),await repo.listChecks(childId),await repo.listRules(childId),
  await repo.listAdventures(childId),(await repo.db.childProfiles.get(childId))?.buddyCare,
 ]):undefined,[childId])
 useEffect(()=>{if(!childId||!source)return;let active=true;void repo.refreshHonors(childId).then(()=>{if(active)setError('')}).catch(()=>{if(active)setError('荣誉暂时没有保存，原记录仍保留。')});return()=>{active=false}},[childId,source])
 const [surprise,setSurprise]=useState(false)
 const celebrated=useRef(new Set<string>())
 const [newDetail,setNewDetail]=useState<string|null>(null)
 const noticeTrigger=useRef<HTMLElement|null>(null)
 const unread=HONORS.filter(h=>profile?.honorClaims?.[h.id]&&profile.honorClaims[h.id]>(profile.honorsSeenAt??''))
 useEffect(()=>{
  if(!childId||location.pathname.startsWith('/parent'))return
  const key=`honor-surprise:${childId}`
  let previous:string[]=[]
  try{const stored=JSON.parse(sessionStorage.getItem(key)??'[]');previous=Array.isArray(stored)?stored:[]}catch{previous=[]}
  const fresh=unread.filter(h=>!previous.includes(h.id)&&!celebrated.current.has(`${childId}:${h.id}`))
  if(!fresh.length)return
  const ids=unread.map(h=>h.id)
  fresh.forEach(h=>celebrated.current.add(`${childId}:${h.id}`))
  try{sessionStorage.setItem(key,JSON.stringify([...new Set([...previous,...ids])]))}catch{/* 无会话存储时仍保留当前组件内去重 */}
  setSurprise(true)
 },[childId,location.pathname,unread.map(h=>h.id).join('|')])
 useEffect(()=>{if(!surprise)return;const timer=setTimeout(()=>setSurprise(false),3200);return()=>clearTimeout(timer)},[surprise])
 if(location.pathname.startsWith('/parent')||(!unread.length&&!error))return null
 const notice = <>{!!unread.length&&<div className="notice-medal"><HonorMedal honorId={unread[0].id}/></div>}{surprise&&<div className="honor-confetti" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--i':i} as import('react').CSSProperties}/>)}</div>}<div role="status">{error||`✦ 发现 ${unread.length} 枚成长勋章！新的星星正在等你点亮。`}</div>{!!unread.length&&<><button type="button" onClick={e=>{noticeTrigger.current=e.currentTarget;setNewDetail(unread[0].id)}}>打开惊喜勋章</button><Link to="/child/growth?honors=1">去看新荣誉</Link><button type="button" onClick={()=>void repo.updateProfile(childId!,{honorsSeenAt:new Date().toISOString()}).catch(()=>setError('消息已读状态没有保存，请重试。'))}>知道啦</button></>}</>
 const compact = location.pathname==='/child/growth'&&!error
 return <><aside className={`honor-notice ${surprise?'honor-surprise':''}`} aria-label="成长消息">{compact?<details className="sky-honor-notice"><summary><span role="status">✦ 发现 {unread.length} 枚新勋章 · 点开看看</span></summary><div className="sky-honor-body">{notice}</div></details>:notice}</aside><HonorDetail honorId={newDetail} profile={profile} trigger={noticeTrigger.current} onClose={()=>setNewDetail(null)}/></>

}
export function HonorLedger({revealAll=false,profile,childId=profile?.id,expandOnArrival=false}:{revealAll?:boolean;profile?:ChildProfile;childId?:string;expandOnArrival?:boolean}) {
 const detail=useRef<HTMLDetailsElement>(null)
 useEffect(()=>{if(expandOnArrival&&detail.current)detail.current.open=true},[expandOnArrival])
 const data=useLiveQuery(async()=>childId?{
  tasks:await repo.listTaskRecords(childId),checks:await repo.listChecks(childId),rules:await repo.listRules(childId),runs:await repo.listAdventures(childId),
 }:undefined,[childId])
 const honors=data?evaluateHonors(childId!,data.tasks,data.checks,data.runs,profile?.buddyCare,data.rules,profile?.honorClaims):[]
 const [group,setGroup]=useState('全部')
 const earned=honors.filter(h=>h.earned)
 const [selected,setSelected]=useState<string|null>(null)
 const trigger=useRef<HTMLElement|null>(null)
 return <><details className="honor-ledger medal-gallery" ref={detail}><summary>我的荣誉册 · 已获得 {earned.length} 枚勋章</summary><div className="honor-gallery-hero"><div><span className="honor-gallery-kicker">成长的每一步，都值得珍藏</span><h3>{profile?.nickname||profile?.name||'我'}的荣誉馆</h3><p>生活 · 运动 · 学习 · 陪伴 · 探索</p></div><div className="honor-collection-count"><strong>{earned.length}</strong><span>/ {honors.length||HONORS.length} 枚</span></div><progress max={HONORS.length} value={earned.length} aria-label="勋章收集进度"/></div><div className="honor-filters" role="group" aria-label="荣誉分类">{['全部','生活','运动','学习','打卡','陪伴','探索'].map(g=><button type="button" key={g} aria-pressed={g===group} onClick={()=>setGroup(g)}>{g}</button>)}</div><ul className="honor-badges">{honors.filter(h=>(revealAll||h.earned)&&(group==='全部'||h.group===group)).map(h=><li key={h.id} className={h.earned?'earned':'locked'}><button type="button" aria-label={`查看${h.title}勋章`} onClick={e=>{trigger.current=e.currentTarget;setSelected(h.id)}}><HonorMedal honorId={h.id} mystery={!h.earned}/><strong>{h.title}</strong><span>{h.earned?'✦ 已珍藏 · 点开看看':'等待发现'}</span>{!h.earned&&revealAll&&<><small>{h.requirement}</small><progress max={h.target} value={Math.min(h.value,h.target)} aria-label={`${h.title}进度`}/><small>{Math.min(h.value,h.target)} / {h.target}</small></>}</button></li>)}</ul>{!revealAll&&<p>还有 {honors.length-earned.length} 枚神秘勋章，等待成长中的惊喜。</p>}</details><HonorDetail honorId={selected} profile={profile} trigger={trigger.current} onClose={()=>setSelected(null)}/></>
}
