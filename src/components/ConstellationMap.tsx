import { buildHonorSky } from '../lib/honors'
import { HonorLedger } from './HonorNotice'
import { repo } from '../db/repo'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { AdventureRun, ChildProfile, RoutineCheck, TaskRecord } from '../db/types'
import { countCompletedCheckins, ZODIAC_SIGNS, type ZodiacSign } from '../lib/constellations'

function SignArt({ sign, count, large = false }: { sign: ZodiacSign; count: number; large?: boolean }) {
  const id = useId()
  return <svg className={`zodiac-art ${large ? 'large' : ''}`} viewBox="0 0 240 200" role="img" aria-labelledby={`${id}-title`}>
    <title id={`${id}-title`}>{sign.name}主题插画，已点亮{count}颗，共5颗</title><desc>原创星座主题图案和连线示意。进度也显示在下方文字中。</desc>
    <defs><radialGradient id={`${id}-aura`}><stop stopColor={sign.color} stopOpacity=".24"/><stop offset="1" stopColor={sign.color} stopOpacity="0"/></radialGradient></defs>
    <circle cx="120" cy="100" r="92" fill={`url(#${id}-aura)`}/><circle className="zodiac-orbit" cx="120" cy="100" r="76"/><ellipse className="zodiac-orbit" cx="120" cy="100" rx="104" ry="34" transform="rotate(-28 120 100)"/>
    <path className={`zodiac-motif ${count === 5 ? 'lit' : ''}`} d={sign.motif}/>
    {sign.points.slice(1).map(([x,y],i)=><line className={`zodiac-line ${i+1<count?'lit':''}`} key={i} x1={sign.points[i][0]*2.4} y1={sign.points[i][1]*2.2+12} x2={x*2.4} y2={y*2.2+12}/>)}
    {sign.points.map(([x,y],i)=><g key={i} className={`zodiac-point ${i<count?'lit':''}`}><circle cx={x*2.4} cy={y*2.2+12} r={i<count?4:2.5}/>{i<count&&<path d={`M${x*2.4-6} ${y*2.2+12}h12M${x*2.4} ${y*2.2+6}v12`}/>}</g>)}
    {large && <g className="zodiac-sparks" aria-hidden="true"><path d="M29 23v12M23 29h12M207 164v12M201 170h12M195 26v8M191 30h8"/><circle cx="36" cy="151" r="1.5"/><circle cx="183" cy="17" r="1.5"/></g>}
  </svg>
}
function CosmicArt({ index }: { index: number }) {
  return <span className="cosmic-card-art" aria-hidden="true" style={{backgroundImage:`url(${import.meta.env.BASE_URL}images/zodiac/card-${index}.webp)`}} />
}
function CollectorCard({ sign, index, lit = true }: { sign: ZodiacSign; index: number; lit?: boolean }) {
  return <article className={`zodiac-collector cosmic-collector ${lit?'is-lit':'is-preview'}`} style={{'--sign-color':sign.color} as CSSProperties} aria-label={`${sign.name}闪耀收藏卡`}>
    <CosmicArt index={index}/><div className="cosmic-card-vignette"/><div className="cosmic-card-frame"/>
    <div className="cosmic-card-heading"><span>小步成长 · 星光珍藏</span><span>NO.{String(index+1).padStart(2,'0')}</span></div>
    <div className="cosmic-card-constellation"><SignArt sign={sign} count={lit?5:0}/></div>
    <div className="cosmic-card-caption"><span className="cosmic-card-tag">{lit?'✦ 成就已收藏':'✧ 等待你点亮'}</span><p className="zodiac-card-english">{sign.english}</p><h3>{sign.name}</h3><p className="zodiac-card-title">{sign.title}</p><p className="zodiac-card-motto">{sign.motto}</p></div>
  </article>
}

const EMPTY_TASKS:TaskRecord[]=[]
const EMPTY_CHECKS:RoutineCheck[]=[]
const EMPTY_RUNS:AdventureRun[]=[]

export function ConstellationMap({ childId, tasks = EMPTY_TASKS, checks = EMPTY_CHECKS, adventures = EMPTY_RUNS, profile, focusStarId }: { childId: string; tasks?: TaskRecord[]; checks?: RoutineCheck[]; adventures?: AdventureRun[]; profile?: ChildProfile; focusStarId?:string }) {
  const id = useId()
  const saved = useLiveQuery(() => repo.db.childProfiles.get(childId), [childId])
  const current = saved ?? profile
  const stars = buildHonorSky(current?.honorClaims,current?.starClaims)
  const [index,setIndex] = useState(0)
  const [slot,setSlot] = useState(0)
  const [message,setMessage] = useState('')
  const [honorError,setHonorError] = useState('')
  const [busy,setBusy] = useState(false)
  const sign = ZODIAC_SIGNS[index]
  const nodes=stars.filter(s=>s.signKey===sign.key)
  const selected=nodes[slot]
  const legacy = selected.slot===0 && !!current?.starClaims?.[sign.key]
  const litCount=nodes.filter(s=>s.lit).length
  const collected=ZODIAC_SIGNS.filter(s=>stars.filter(n=>n.signKey===s.key).every(n=>n.lit)).length
  const starPanel = useRef<HTMLDivElement>(null)
  const detailDialog = useRef<HTMLDialogElement>(null)
  const detailTrigger = useRef<HTMLButtonElement | null>(null)
  const detailClose = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(()=>{setIndex(0);setSlot(0);setMessage('');if(dialog.current?.open)dialog.current.close();if(detailDialog.current?.open)detailDialog.current.close()},[childId])
  useEffect(()=>{
    const target=buildHonorSky(current?.honorClaims,current?.starClaims).find(s=>s.id===focusStarId)
    if(!target)return
    setIndex(ZODIAC_SIGNS.findIndex(s=>s.key===target.signKey));setSlot(target.slot)
    const frame=requestAnimationFrame(()=>{detailTrigger.current=starPanel.current?.closest('section')?.querySelectorAll<HTMLButtonElement>('.zodiac-tile')[ZODIAC_SIGNS.findIndex(s=>s.key===target.signKey)]??null;if(!detailDialog.current?.open)detailDialog.current?.showModal();starPanel.current?.scrollIntoView?.({block:'start',behavior:'auto'});starPanel.current?.querySelector<HTMLButtonElement>(`button[aria-label*="第${target.slot+1}颗星"]`)?.focus({preventScroll:true})})
    return()=>cancelAnimationFrame(frame)
  },[focusStarId,childId])
  function openCard(button: HTMLButtonElement) { trigger.current=button; dialog.current?.showModal(); closeButton.current?.focus() }
  async function light(button: HTMLButtonElement) {
    setBusy(true);setMessage('')
    try {await repo.lightHonorStar(childId,selected.id);setMessage(`${sign.name}的${selected.name}点亮啦！获得2颗奖励星。`);if(litCount===4)openCard(button)}
    catch(error){setMessage(error instanceof Error?error.message:'点亮没有保存，请重试。')}
    finally{setBusy(false)}
  }
  // 来源变化时刷新荣誉；全局消息也会监听每日打卡与小布照料变化。
  useEffect(()=>{void repo.refreshHonors(childId).then(()=>setHonorError('')).catch(()=>setHonorError('荣誉暂未准备好，请稍后重试。'))},[childId,tasks,checks,adventures,current?.buddyCare?.xp])
  return <section className="constellation-map zodiac-map dream-sky cosmic-album honor-sky" aria-labelledby={`${id}-title`}>
    <header className="constellation-heading"><div><span className="journey-kicker">每一份成长，都藏着一颗星</span><h2 id={`${id}-title`}>我的成长星空</h2><p className="zodiac-intro">获得勋章，发现隐藏星星，再亲手点亮。</p></div><div className="zodiac-totals"><strong>{countCompletedCheckins(childId,tasks,checks)} 次有效打卡</strong><span>已点亮 {stars.filter(s=>s.lit).length} / 60 颗 · 集齐 {collected} / 12 张</span></div></header>
    <dialog className="zodiac-star-dialog" ref={detailDialog} aria-labelledby={`${id}-detail-title`} onClose={()=>detailTrigger.current?.focus()}><header className="zodiac-detail-heading"><h2 id={`${id}-detail-title`}>{sign.name} · 星轨详情</h2><button ref={detailClose} type="button" className="zodiac-reveal" onClick={()=>detailDialog.current?.close()}>返回星空总览</button></header><div className="zodiac-showcase"><div className="zodiac-feature-art" style={{'--sign-color':sign.color} as CSSProperties}><CollectorCard sign={sign} index={index} lit={litCount===5}/><button type="button" className="zodiac-reveal" onClick={e=>openCard(e.currentTarget)}>欣赏{sign.name}星卡</button></div><div className="zodiac-feature-copy" ref={starPanel}><span className="zodiac-edition">{sign.english} · 成长星轨</span><h3>{sign.name} · {sign.title}</h3>
      <div className="honor-star-chart" role="group" aria-label={`${sign.name}星图，已点亮${litCount}颗，共5颗`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{sign.points.slice(1).map(([x,y],i)=><line key={i} x1={sign.points[i][0]} y1={sign.points[i][1]} x2={x} y2={y} className={nodes[i].lit&&nodes[i+1].lit?'lit':''}/>)}</svg>
        {nodes.map((star,i)=><button type="button" key={star.id} disabled={busy} style={{left:`${sign.points[i][0]}%`,top:`${sign.points[i][1]}%`}} className={`honor-star ${star.lit?'lit':star.revealed?'revealed':'hidden-star'}`} aria-pressed={slot===i} aria-label={`${sign.name}第${i+1}颗星，${star.lit?'已点亮':star.revealed?'可以点亮':'神秘星影'}`} onClick={()=>{setSlot(i);setMessage('')}}><span aria-hidden="true">{star.lit||star.revealed?'★':'✧'}</span><small>{star.revealed?star.name:'神秘星影'}</small></button>)}
      </div>
      <div className="honor-star-detail"><p>{selected.lit?`✦ ${selected.name} · 已点亮`:selected.revealed?`✧ ${selected.name} · 等你点亮`:'这是一颗隐藏的星星'}</p>{selected.revealed?<><strong>{legacy?'旧版星光纪念':selected.honor.title}</strong><p>{legacy?'来自旧版收藏，原有星光和奖励已保留。':`${selected.honor.requirement}，勋章唤醒了这颗星。`}</p><button type="button" className="zodiac-reveal" disabled={busy||selected.lit} onClick={e=>void light(e.currentTarget)}>{selected.lit?'已经点亮':busy?'正在保存…':`点亮${sign.name}第${slot+1}颗星 · 获得2星`}</button></>:<p>在生活里认真尝试，和小布一起探索。获得新勋章时，它就会显现。</p>}</div>
    </div></div><p role="status">{message}</p></dialog>
    {honorError&&<p role="status">{honorError}</p>}
    <h3 className="zodiac-album-title">十二星座图鉴 <small>每张卡里都藏着五颗星</small></h3>
    <ol className="zodiac-grid">{ZODIAC_SIGNS.map((item,i)=>{const own=stars.filter(s=>s.signKey===item.key),lit=own.filter(s=>s.lit).length,ready=own.filter(s=>s.revealed&&!s.lit).length;return <li key={item.key}><button type="button" disabled={busy} className={`zodiac-tile ${lit===5?'collected':ready?'ready':''}`} style={{'--sign-color':item.color} as CSSProperties} aria-pressed={index===i} aria-label={`查看${item.name}，已点亮${lit}颗，共5颗`} onClick={e=>{setIndex(i);setSlot(own.findIndex(s=>s.revealed&&!s.lit)>=0?own.findIndex(s=>s.revealed&&!s.lit):0);setMessage('');detailTrigger.current=e.currentTarget;detailDialog.current?.showModal();detailClose.current?.focus()}}><CosmicArt index={i}/><span className="cosmic-tile-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span className="cosmic-tile-copy"><strong>{item.name}</strong><span className="cosmic-tile-english">{item.english}</span><span className="cosmic-tile-state">{lit===5?'✦ 已集齐':ready?`✧ ${ready}星待点亮`:'✧ 等待发现'}</span><small>{lit} / 5 颗星</small></span></button></li>})}</ol>
    <div className="zodiac-overview-tools"><HonorLedger profile={current} childId={childId} expandOnArrival={typeof window!=='undefined'&&window.location.hash.includes('honors=1')}/><details className="zodiac-rules"><summary>星星和勋章怎么获得？</summary><p>生活、运动、学习打卡，小布照料和冒险发现，都能获得荣誉。获得勋章后，隐藏星星会显现；点亮每颗星可领取2颗奖励星。点亮五颗星，就能集齐一张星座卡。</p><p>已获得的荣誉和星光会一直保留。兑换礼物不会熄灭星星，同一颗星只发一次奖励。旧版已点亮的星座保留为第一颗星，原有奖励不变。星轨为原创成长示意图。</p></details></div>
    <dialog className="zodiac-dialog" ref={dialog} aria-labelledby={`${id}-card-title`} onClose={()=>trigger.current?.focus()}><h2 id={`${id}-card-title`}>{sign.name} · 星光收藏卡</h2><CollectorCard sign={sign} index={index} lit={litCount===5}/><p>已点亮 {litCount} / 5 颗 · {litCount===5?'珍藏已集齐':'每一次成长都让星卡更闪耀'}</p><button ref={closeButton} type="button" className="zodiac-reveal" onClick={()=>dialog.current?.close()}>收好卡片</button></dialog>
  </section>
}
