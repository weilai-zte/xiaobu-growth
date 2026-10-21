import { lazy, Suspense } from 'react'
const ParkScene=lazy(()=>import('./ParkScene'))
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { repo } from '../db/repo'
import type { AdventureRun, BuddyActivity } from '../db/types'
import {
  birdInventory,
  BIRD_ITEMS,
  HOME_TREASURES,
  homeTreasureInventory,
  latestHomeTreasure,
} from '../lib/birdCompanion'
import { birdStage, uniqueAdventures } from '../lib/adventure'
import { preparePraise, stopPraise, soundEnabled } from '../lib/praise'
import { BuddyBird } from './GrowthJourney'
import { BirdMusic } from './BirdMusic'
import { BirdItemPicture } from './BirdItemPicture'

function useBirdSpeech() {
  const [speech, setSpeech] = useState({ speaking: false, text: '' })
  useEffect(() => {
    const listen = (event: Event) => setSpeech((event as CustomEvent<{ speaking: boolean; text: string }>).detail)
    window.addEventListener('xiaobu:bird-speech', listen)
    return () => window.removeEventListener('xiaobu:bird-speech', listen)
  }, [])
  return speech
}

/** 全局说话气泡，打卡按钮在页面下方时仍能看到是谁在鼓励。 */
export function BirdSpeaker() {
  const speech = useBirdSpeech()
  const { profile } = useApp()
  const runs = useLiveQuery(() => profile ? repo.listAdventures(profile.id) : Promise.resolve([]), [profile?.id])
  const { pathname } = useLocation()
  useEffect(() => { stopPraise() }, [pathname])
  useEffect(()=>{const hide=()=>{if(document.hidden)stopPraise()};document.addEventListener('visibilitychange',hide);return ()=>{document.removeEventListener('visibilitychange',hide);stopPraise()}},[])
  if (!speech.speaking || !pathname.startsWith('/child')) return null
  return <aside className="bird-speaker" aria-label="小步在说话"><BuddyBird stage={birdStage(uniqueAdventures(runs ?? []).length).key} speaking /><div><strong>小步啾啾</strong><p>{speech.text}</p><button className="btn btn-sm" type="button" onClick={stopPraise}>停止声音</button></div></aside>
}

export function BirdCompanion({ stage, runs, wardrobe = false, habitat = false, adventureHint, activity = 'idle', carePanel, children }: { stage: string; runs: AdventureRun[]; wardrobe?: boolean; habitat?: boolean; adventureHint?: string; activity?: BuddyActivity; carePanel?: ReactNode; children?: ReactNode }) {
  const { profile } = useApp()
  const panelId=useId()
  const panelRef=useRef<HTMLDivElement>(null)
  const {search}=useLocation()
  const initialBirdPanel=new URLSearchParams(search).get('bird')
  const [panel,setPanel]=useState<'gear'|'adventure'|null>(initialBirdPanel==='gear'||initialBirdPanel==='decor'?'gear':null)
  useEffect(()=>{const target=new URLSearchParams(search).get('bird');if(target==='gear'||target==='decor')setPanel('gear')},[search])
  useEffect(()=>{
    if(!panel)return
    const frame=requestAnimationFrame(()=>panelRef.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'}))
    return()=>cancelAnimationFrame(frame)
  },[panel])
  const speech = useBirdSpeech()
  const [message, setMessage] = useState('')
  const [audioError, setAudioError] = useState('')
  const [flapping,setFlapping]=useState(false)
  const flapTimer=useRef<ReturnType<typeof setTimeout>>()
  useEffect(()=>()=>{clearTimeout(flapTimer.current)},[])
  const [action, setAction] = useState(0)
  const [busy, setBusy] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const inventory = birdInventory(runs)
  const homeInventory = homeTreasureInventory(runs)
  const accessory = inventory.some(i => i.key === profile?.buddyAccessory) ? profile?.buddyAccessory ?? '' : ''
  const storedDecor = homeInventory.some(item => item.key === profile?.buddyHomeDecor) ? profile?.buddyHomeDecor ?? '' : ''
  const activeDecor = storedDecor || latestHomeTreasure(runs)?.key || ''
  const activeDecorItem = HOME_TREASURES.find(item => item.key === activeDecor)
  const egg = stage === 'egg' || stage === 'crack'
  const sleeping = activity === 'sleep'
  function moveScene(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - .5) * 2))
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - .5) * 2))
    sceneRef.current?.style.setProperty('--scene-x', x.toFixed(3))
    sceneRef.current?.style.setProperty('--scene-y', y.toFixed(3))
  }
  function resetScene() {
    sceneRef.current?.style.setProperty('--scene-x', '0')
    sceneRef.current?.style.setProperty('--scene-y', '0')
  }
  function interact(item?: typeof BIRD_ITEMS[number]) {
    if (sleeping) {
      setMessage(`嘘，${profile?.nickname || profile?.name || '小主人'}，小步正在做甜甜的梦，叫醒它就能一起玩啦。`)
      return
    }
    const actions = egg ? ['我听到你啦！我在蛋里轻轻动一动。', '谢谢你来看我！我们一起慢慢长大。', '咚咚！我也想和你一起看看世界。'] : ['啾啾！击个掌，今天也要一起玩！', '看我的翅膀！扑扑，我在和你打招呼！', '歪歪头，看见你真高兴！']
    const toy = item ?? (action % 3 === 2 ? BIRD_ITEMS.find(i => i.key === accessory) : undefined)
    const text = `${profile?.nickname || profile?.name || '全全'}，${egg ? actions[action % actions.length] : toy?.action ?? actions[action % actions.length]}`
    clearTimeout(flapTimer.current);setFlapping(!egg);flapTimer.current=setTimeout(()=>setFlapping(false),2400)
    setAction(a => a + 1); setMessage(text); setAudioError('')
    const clickMood = item ? 'happy' : (['hello','happy','celebrate'] as const)[action % 3]
    void preparePraise({ name: profile?.name ?? '全全', title: '', text, mood:clickMood })().then(ok => { if (!ok && soundEnabled()) setAudioError('声音暂时没有播出来，可以在声音设置中试听；仍然可以和小步玩。') })
  }
  async function equip(key: string) {
    if (!profile || busy) return
    setBusy(true)
    try {
      await repo.updateProfile(profile.id, { buddyAccessory: key || null })
      if (key) interact(BIRD_ITEMS.find(i => i.key === key))
      else setMessage('小步换回轻轻松松的样子啦。')
    } catch { setMessage('这次没有保存好，请再选一次。') }
    finally { setBusy(false) }
  }
  async function decorate(key: string) {
    if (!profile || busy) return
    setBusy(true)
    try {
      await repo.updateProfile(profile.id, { buddyHomeDecor: key })
      const treasure=HOME_TREASURES.find(item => item.key===key)
      setMessage(treasure ? `把${treasure.name}摆进乐园啦，小步一眼就看见啦！` : '小屋换好新样子啦。')
    } catch { setMessage('这次没有摆好，请再选一次。') }
    finally { setBusy(false) }
  }
  const gear=<section className="bird-wardrobe" aria-label="小步的玩具和装备"><h3>小步的百宝箱</h3><p>冒险带回的小礼物，都好好放在这里。点一件，和小步一起玩。</p>
    {inventory.length ? <div className="bird-items bird-owned">{BIRD_ITEMS.filter(item=>inventory.some(owned=>owned.key===item.key)).map(item=>{const owned=inventory.find(i=>i.key===item.key)!;return <button key={item.key} type="button" disabled={busy} aria-pressed={accessory===item.key} onClick={()=>void equip(item.key)}><BirdItemPicture kind={item.key}/><strong>{item.name}</strong><small>{accessory===item.key?'正在用':'点一下换上'} · {owned.count}件</small></button>})}</div>:<p>百宝箱还空着，去冒险时会带回小礼物。</p>}
    {accessory&&<button type="button" className="btn" disabled={busy} onClick={()=>void equip('')}>收好装备</button>}
    <section className="home-decoration-picker" aria-label="装点小步的家"><h4>装点乐园</h4><p>找到的美味、宝物和摆件都能摆进乐园。小屋建成后，会一起搬进家里。选一个最喜欢的。</p>
      {homeInventory.length ? <div className="home-decor-options" role="group" aria-label="选择小屋摆件">{homeInventory.map(item=><button key={item.key} type="button" disabled={busy} aria-pressed={activeDecor===item.key} aria-label={`把小屋装饰换成${item.name}`} onClick={()=>void decorate(item.key)}><BirdItemPicture kind={item.key}/><strong>{item.name}</strong><small>{item.category} · 已找到{item.count}件</small></button>)}</div> : <p className="home-decor-empty">第一次冒险后，就能带一件小摆件回来。</p>}
    </section>
    <details className="bird-discover"><summary>冒险还能发现什么？</summary><dl><div><dt>百宝箱</dt><dd>{BIRD_ITEMS.filter(item=>!inventory.some(owned=>owned.key===item.key)).map(item=>item.name).join('、')||'全部找到啦'}</dd></div><div><dt>小屋摆件</dt><dd>{HOME_TREASURES.filter(item=>!homeInventory.some(owned=>owned.key===item.key)).map(item=>item.name).join('、')||'全部找到啦'}</dd></div></dl></details>
  </section>
  return <div className={`bird-companion ${habitat?'bird-habitat':''} bird-activity-${activity}`}>
    {habitat?<><Suspense fallback={<p role="status">正在打开小布的森林岛…</p>}><ParkScene stage={stage} count={uniqueAdventures(runs).length} activity={activity} flapping={flapping} interactionId={action} accessory={accessory} decor={activeDecor} onInteract={()=>interact()} carePanel={carePanel}/></Suspense><p className="bird-chat park-chat" role="status">{sleeping?'嘘，小布正在做甜甜的梦。':speech.speaking?speech.text:message||(egg?'我还在蛋里，也能听见你！':'陪小布照料、探索，慢慢建起自己的乐园。')}</p></>:(<div ref={sceneRef} className={`habitat-scene habitat-scene-${activity}`} onPointerMove={moveScene} onPointerLeave={resetScene}>{habitat&&<><div className="habitat-glow" aria-hidden="true"/><div className="habitat-sky" aria-hidden="true"><i/><i/><i/><i/><i/></div><img className={`habitat-house ${stage!=='home'?'house-building':''}`} src={`${import.meta.env.BASE_URL}images/xiaobu-home-3d-v1.webp`} alt="" aria-hidden="true" width="1000" height="667"/><span className="habitat-house-label">{stage==='home'?'温暖的小屋':'小屋预览 · 冒险21次建好'}</span><div className="habitat-foreground" aria-hidden="true"><i/><i/><i/><i/></div>{activeDecorItem&&<figure className={`habitat-decoration habitat-decoration-${activeDecorItem.key}`}><BirdItemPicture kind={activeDecorItem.key}/><figcaption>{activeDecorItem.name}</figcaption></figure>}</>}
    {habitat&&<HabitatActivity activity={activity}/>}
    <button type="button" className={`bird-touch bird-action-${action % 3} ${action ? 'bird-touched' : ''}`} aria-label={sleeping ? '看看正在睡觉的小步' : egg ? '轻轻和小蛋打招呼' : '和虎皮鹦鹉小步互动'} onClick={() => interact()}><span key={action} className="bird-motion"><BuddyBird stage={stage} accessory={accessory} speaking={speech.speaking} flapping={flapping || activity==='adventure'} />{flapping&&<span className="bird-sparkles" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></span>}</span><span>{sleeping ? '小步睡得香香的' : egg ? '轻轻点我，打个招呼' : '点点我，一起玩'}</span></button>
    <p className="bird-chat" role="status">{sleeping && !speech.speaking ? (message || '嘘…小步盖好小毯子，正在做甜甜的梦。') : speech.speaking ? speech.text : message || (egg ? '我还在蛋里，也能听见你！' : '我是小步，你的虎皮鹦鹉搭档！')}</p>
    {audioError && <p className="muted" role="status">{audioError}</p>}
    </div>)}

    {habitat&&<BirdMusic/>}
    {!habitat&&carePanel}
    {wardrobe&&<div className="habitat-actions"><button type="button" aria-expanded={panel==='gear'} aria-controls={`${panelId}-gear`} onClick={()=>setPanel(panel==='gear'?null:'gear')}><span aria-hidden="true">✧</span><strong>百宝箱</strong><small>{inventory.length+homeInventory.length}种发现</small></button>{children&&<button type="button" disabled={sleeping} aria-expanded={panel==='adventure'} aria-controls={`${panelId}-adventure`} onClick={()=>setPanel(panel==='adventure'?null:'adventure')}><span aria-hidden="true">↗</span><strong>去冒险</strong><small>{sleeping ? '先叫醒小步' : adventureHint || '带回新故事'}</small></button>}</div>}
    {wardrobe&&<div ref={panelRef} id={`${panelId}-gear`} className="habitat-panel" hidden={panel!=='gear'}>{gear}</div>}
    {children&&<div ref={panel==='adventure'?panelRef:null} id={`${panelId}-adventure`} className="habitat-panel" hidden={panel!=='adventure'}>{children}</div>}
  </div>
}

function HabitatActivity({ activity }: { activity: BuddyActivity }) {
  if (activity === 'feed') {
    return <div className="habitat-action-layer habitat-feed-layer" aria-hidden="true">
      <svg className="habitat-activity-prop habitat-food" viewBox="0 0 100 78"><ellipse cx="50" cy="65" rx="30" ry="7" fill="#78664733"/><path d="M22 43h56l-7 25H29Z" fill="#f8d89e" stroke="#8f6848" strokeWidth="3"/><path d="M18 41q32-12 64 0l-7 8H25Z" fill="#fff3d3" stroke="#8f6848" strokeWidth="3"/>{[34,45,56,67].map((x,i)=><circle key={x} cx={x} cy={i%2?36:31} r="4" fill={i%2?'#b47fbd':'#dfac55'}/>)}</svg>
      <i className="habitat-seed habitat-seed-1"/><i className="habitat-seed habitat-seed-2"/><i className="habitat-seed habitat-seed-3"/>
      <span className="habitat-affection habitat-affection-1">♥</span><span className="habitat-affection habitat-affection-2">♥</span>
    </div>
  }
  if (activity === 'play') {
    return <div className="habitat-action-layer habitat-play-layer" aria-hidden="true">
      <svg className="habitat-activity-prop habitat-ball" viewBox="0 0 90 90"><ellipse cx="45" cy="78" rx="27" ry="6" fill="#78664733"/><circle cx="45" cy="43" r="31" fill="#f2b9a4" stroke="#916757" strokeWidth="3"/><path d="M16 36q29 5 54 25M39 13q4 31 27 57" fill="none" stroke="#fff2d9" strokeWidth="7"/><circle cx="29" cy="28" r="7" fill="#ffe8a7"/></svg>
      <span className="habitat-bounce-ring"/><span className="habitat-play-spark habitat-play-spark-1">✦</span><span className="habitat-play-spark habitat-play-spark-2">✦</span>
    </div>
  }
  if (activity === 'groom') {
    return <div className="habitat-action-layer habitat-groom-layer" aria-hidden="true">
      <div className="habitat-brush"><span/><i/><i/><i/></div>
      <svg className="habitat-activity-prop habitat-feather" viewBox="0 0 92 100"><path d="M72 13C38 15 19 40 28 72c27-3 48-27 44-59Z" fill="#c9dced" stroke="#687b9b" strokeWidth="3"/><path d="M29 80 69 20M41 62l-2-24M54 48l19 2" fill="none" stroke="#687b9b" strokeWidth="3" strokeLinecap="round"/><path d="m21 90 8-10" stroke="#687b9b" strokeWidth="5" strokeLinecap="round"/></svg>
      <span className="habitat-loose-feather habitat-loose-feather-1"/><span className="habitat-loose-feather habitat-loose-feather-2"/>
    </div>
  }
  if (activity === 'adventure') {
    return <div className="habitat-action-layer habitat-adventure-layer" aria-hidden="true">
      <div className="habitat-adventure-path"><i/><i/><i/><i/></div>
      <div className="habitat-activity-prop habitat-adventure-sign"><span>森林探险</span><i>✦</i></div>
      <span className="habitat-flight-star habitat-flight-star-1">✦</span><span className="habitat-flight-star habitat-flight-star-2">✦</span><span className="habitat-flight-star habitat-flight-star-3">✧</span>
    </div>
  }
  if (activity === 'sleep') {
    return <div className="habitat-action-layer habitat-sleep-layer" aria-hidden="true">
      <div className="bird-sleep-blanket"><span/><i/></div>
      <div className="habitat-activity-prop habitat-sleep-sign"><span className="habitat-moon"/><strong>Z z z</strong><small>小步在做甜甜的梦</small></div>
      <span className="habitat-dream-bubble habitat-dream-bubble-1">✦</span><span className="habitat-dream-bubble habitat-dream-bubble-2">★</span>
    </div>
  }
  return null
}
