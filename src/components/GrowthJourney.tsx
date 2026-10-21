import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { AdventureRun, RoutineCheck, TaskRecord, Wish } from '../db/types'
import { PlayPicture, TinyStar } from './PlayCards'
import { growthTrail } from '../lib/rewards'
import { formatDay } from '../lib/date'
import { BIRD_STAGES, birdStage, MATERIAL_NAMES, uniqueAdventures, adventureStory } from '../lib/adventure'
import { BirdItemShape } from './BirdItemPicture'

export function BuddyBird({ stage = 'egg', celebrating = false, accessory = '', speaking = false, flapping = false }: { stage?: string; celebrating?: boolean; accessory?: string; speaking?: boolean; flapping?:boolean }) {
  const artId = useId().replace(/:/g, '')
  const hasHome = ['home','garden','pool'].includes(stage)
  const egg = stage === 'egg' || stage === 'crack'
  const name = BIRD_STAGES.find(s => s.key === stage)?.name ?? '一颗小蛋'
  return <svg className={`buddy-bird ${celebrating ? 'buddy-happy' : ''} ${speaking ? 'budgie-speaking' : ''} ${flapping?'bird-flapping':''}`} viewBox="0 0 260 210" role="img" aria-label={`小步：${name}`}>
    <title>{name}</title><desc>黄头绿身的虎皮鹦鹉小步，有黑色羽毛横纹、蓝紫脸颊、弯钩嘴和蓝色长尾。从蛋慢慢长大，休息或兑换礼物不会倒退。</desc>
    <defs><radialGradient id={`${artId}-egg`} cx="32%" cy="24%" r="80%"><stop offset="0" stopColor="#fffef5"/><stop offset=".55" stopColor="#fff0cd"/><stop offset="1" stopColor="#cbbba8"/></radialGradient></defs>
    <circle className="bird-scene-base" cx="130" cy="101" r="88" fill="#eee8f9" />
    <path className="bird-scene-base" d="M35 162q95-27 190 0l-10 16q-80 30-170 0Z" fill="#d4e7ce" />
    <ellipse className="bird-scene-base" cx="130" cy="174" rx="53" ry="7" fill="#b4c7ad" opacity=".5" />
    {hasHome && <image className="bird-home-art" href={`${import.meta.env.BASE_URL}images/xiaobu-home-3d-v1.webp`} x="0" y="10" width="260" height="190" preserveAspectRatio="xMidYMid meet"/>}
    {egg ? <g stroke="#807294" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M88 125c0-37 22-78 42-78s42 41 42 78c0 30-17 44-42 44s-42-14-42-44Z" fill={`url(#${artId}-egg)`}/><ellipse cx="112" cy="96" rx="6" ry="9" fill="#d5c7e8" stroke="none"/><ellipse cx="145" cy="125" rx="8" ry="5" fill="#d5c7e8" stroke="none"/>{stage === 'crack' && <path d="m129 49-7 22 13 12-12 16 12 10-7 17" fill="none"/>}<path d="M77 157q53 30 106 0m-96 14q43 17 86 0" stroke="#b69c76" fill="none"/></g> : <>
    <g className="bird-rendered" transform={stage === 'hatch' ? 'translate(15 15) scale(.88)' : stage === 'young' ? 'translate(16 15) scale(.88)' : hasHome ? 'translate(38 35) scale(.72)' : undefined}>
      <svg className="bird-sprite" x="17" y={stage==='hatch'?-20:-5} width="225" height="195" viewBox="0 0 1266 1243" overflow="visible" aria-hidden="true">{[
        '0 0 633 621.5',
        '633 0 633 621.5',
        '0 621.5 633 621.5',
        '633 621.5 633 621.5',
      ].map((frame,index)=><svg key={index} className={`bird-frame bird-frame-${index}`} width="1266" height="1243" viewBox={frame} overflow="hidden"><image href={`${import.meta.env.BASE_URL}images/xiaobu-flap-sheet-v1.webp`} width="1266" height="1243"/></svg>)}</svg>
      {accessory === 'scarf' && <path d="M112 103q24 10 46-1l2 10q-23 13-48 0Zm36 11 13 23-14-4-5-18" fill="#ed9c7b" stroke="#af664b" strokeWidth="1.5"/>}
      {accessory === 'pin' && <path d="m154 124 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#ffe397" stroke="#ae7c29"/>}
      {accessory === 'backpack' && <g transform="translate(49 112) scale(.36)"><BirdItemShape kind="backpack" /></g>}
    </g>
    {stage === 'hatch' && <path d="m90 153 12-9 13 11 13-9 13 10 17-10 13 7q-2 28-41 28t-40-28Z" fill="#fff7e5" stroke="#807294" strokeWidth="3"/>}
    {['nest', 'home', 'garden', 'pool'].includes(stage) && <g stroke="#a78b66" fill="#d9bd95" strokeWidth="3"><path d="M73 153q57 31 114 0l-12 29q-45 17-90 0Z"/><path d="m85 168 89 10m-78 4 77-16"/></g>}
    </>}
    <g fill="#c3a159"><path d="m39 57 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="m218 42 2 6 7 2-7 3-2 6-2-6-7-3 7-2Z"/></g>
    {hasHome && <path d="m212 125 4 8 9 2-6 6 1 9-8-4-8 4 1-9-6-6 9-2Z" fill="#f0cf7b" />}
    {accessory && (egg || ['bell', 'ball', 'swing'].includes(accessory)) && <g transform="translate(182 130) scale(.62)"><BirdItemShape kind={accessory} /></g>}
  </svg>
}

function StagePortrait({stage}:{stage:string}){return <img className="bird-stage-portrait" src={`${import.meta.env.BASE_URL}images/xiaobu-stages-v6/${stage}.png`} alt="" width="320" height="300" loading="lazy"/>}

export function BirdGrowth({ count, runs = [] }: { count: number; runs?: AdventureRun[] }) {
  const stage = birdStage(count)
  const next = BIRD_STAGES.find(s => s.at > count)
  return <section className="bird-growth"><div className="growth-current"><StagePortrait stage={stage.key}/><div><span className="journey-kicker">小步的成长故事 · 已一起冒险 {count} 次</span><h2>{stage.name}</h2><p>{stage.text}</p><p className="muted">{next ? `再一起冒险 ${next.at - count} 次，就到「${next.name}」。` : '家已经建好了。每次冒险仍会留下新故事。'}</p></div></div><div className="material-shelf" role="group" aria-label="一路带回的筑巢材料">{(['leaf', 'twig', 'pebble'] as const).map(material => <span key={material}><PlayPicture kind={material} /><small>{MATERIAL_NAMES[material]} × {uniqueAdventures(runs).filter(r => r.material === material).length}</small></span>)}</div><ol className="bird-timeline">{BIRD_STAGES.map(s => <li key={s.key} aria-current={stage.key === s.key ? 'step' : undefined} className={count >= s.at ? 'reached' : ''}><StagePortrait stage={s.key}/><strong>{s.name}</strong><small>{s.at === 0 ? '从这里开始' : `累计 ${s.at} 次冒险`}</small></li>)}</ol><p className="muted">不需要连续打卡。休息不会退回去，兑换礼物也不会让小步变小。</p>{runs.length > 0 && <details className="adventure-album"><summary>翻翻冒险相册</summary><ol>{uniqueAdventures(runs).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map(run => <li key={run.id}><PlayPicture kind={run.material} /><div><strong>{run.date.slice(5)} · +{run.bonusStars} 星</strong><p>{adventureStory(run)}</p></div></li>)}</ol></details>}</section>
}

export function WishGoal({ wish, available, compact = false }: { wish?: Wish; available: number; compact?: boolean }) {
  const reserved = wish?.status === 'requested'
  const collected = reserved ? wish.cost ?? 0 : Math.min(available, wish?.cost ?? 0)
  return <Link to="/child/progress" className={`wish-goal ${compact ? 'wish-goal-compact' : ''}`}>
    <div className="wish-goal-art"><PlayPicture kind={wish?.picture ?? 'picnic'} /></div>
    <div className="wish-goal-content"><span className="journey-kicker">{wish ? '我正在攒的小心愿' : '我的第一个小心愿'}</span>
      <strong>{wish?.name ?? '选一件想和家人一起做的事'}</strong>
      {wish?.cost ? <><span className="wish-goal-meter" role="progressbar" aria-label={`${wish.name}的星星进度`} aria-valuemin={0} aria-valuemax={wish.cost} aria-valuenow={collected}><span style={{ width: `${collected / wish.cost * 100}%` }} /></span>
        <small>{reserved ? '星星留好啦，等家长兑现' : available >= wish.cost ? '攒够啦，可以去兑换了' : `再攒 ${wish.cost - available} 颗星`}</small></> : <small>{wish ? '和爸爸妈妈一起约定星数' : '去公园、做点心，或者你自己想一个'}</small>}
    </div><span className="wish-goal-arrow" aria-hidden="true">→</span>
  </Link>
}

export function GrowthTrail({ tasks, checks, date }: { tasks: TaskRecord[]; checks: RoutineCheck[]; date: string }) {
  const days = growthTrail(tasks, checks, date)
  const count = days.filter(d => d.done).length
  return <section className="trail-section" aria-labelledby="trail-heading"><div className="journey-section-heading"><div><span className="journey-kicker">每一步都留下来了</span><h2 id="trail-heading">最近的小脚印</h2></div><span className="trail-count"><TinyStar />{count} 天有记录</span></div>
    <ol className="growth-trail">{days.map(day => <li key={day.date} className={day.done ? 'has-footprint' : ''} aria-label={`${formatDay(day.date)}，${day.done ? '有完成记录' : '暂无完成记录'}`}><span className="trail-stamp">{day.done ? <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 30q19 0 19-21Q10 8 12 30Z" fill="#91b99a"/><path d="m12 30 13-15" stroke="#486e50" strokeWidth="2" fill="none"/></svg> : <span aria-hidden="true">·</span>}</span><small>{day.date.slice(5).replace('-', '/')}</small></li>)}</ol>
    <p>{count ? '这些小脚印都是真实做过的事。歇一歇，再回来也很好。' : '还没有完成记录。今天做一小件，就会留下第一片叶子。'}</p>
  </section>
}
