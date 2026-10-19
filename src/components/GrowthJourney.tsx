import { Link } from 'react-router-dom'
import type { AdventureRun, RoutineCheck, TaskRecord, Wish } from '../db/types'
import { PlayPicture, TinyStar } from './PlayCards'
import { growthTrail } from '../lib/rewards'
import { formatDay } from '../lib/date'
import { BIRD_STAGES, birdStage, MATERIAL_NAMES, uniqueAdventures, adventureStory } from '../lib/adventure'

export function BuddyBird({ stage = 'egg', celebrating = false }: { stage?: string; celebrating?: boolean }) {
  const egg = stage === 'egg' || stage === 'crack'
  const grown = ['adult', 'nest', 'home'].includes(stage)
  const name = BIRD_STAGES.find(s => s.key === stage)?.name ?? '一颗小蛋'
  return <svg className={`buddy-bird ${celebrating ? 'buddy-happy' : ''}`} viewBox="0 0 260 210" role="img" aria-label={`小步：${name}`}>
    <title>{name}</title><desc>小步从蛋到小鸟，再到拥有自己的家。成长不会因为休息或兑换礼物而倒退。</desc>
    <circle cx="130" cy="101" r="88" fill="#eee8f9" />
    <path d="M35 162q95-27 190 0l-10 16q-80 30-170 0Z" fill="#d4e7ce" />
    <ellipse cx="130" cy="174" rx="53" ry="7" fill="#b4c7ad" opacity=".5" />
    {stage === 'home' && <g stroke="#806b55" strokeWidth="3" strokeLinejoin="round"><path d="M48 95h164v84H48Z" fill="#ead7b4"/><path d="m32 95 98-74 98 74Z" fill="#b4c9b1"/><path d="M91 180v-49a39 39 0 0 1 78 0v49" fill="#f9f1df"/></g>}
    {egg ? <g stroke="#807294" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M88 125c0-37 22-78 42-78s42 41 42 78c0 30-17 44-42 44s-42-14-42-44Z" fill="#fff7e5"/><ellipse cx="112" cy="96" rx="6" ry="9" fill="#d5c7e8" stroke="none"/><ellipse cx="145" cy="125" rx="8" ry="5" fill="#d5c7e8" stroke="none"/>{stage === 'crack' && <path d="m129 49-7 22 13 12-12 16 12 10-7 17" fill="none"/>}<path d="M77 157q53 30 106 0m-96 14q43 17 86 0" stroke="#b69c76" fill="none"/></g> : <>
    <g transform={stage === 'hatch' ? 'translate(39 52) scale(.7)' : stage === 'young' ? 'translate(20 25) scale(.85)' : stage === 'home' ? 'translate(39 46) scale(.7)' : undefined}>
    <g stroke="#554975" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path className="bird-wing" d="M88 96q-42-6-37 27 19 5 38-11" fill="#ab9cd6" />
      <path className="bird-wing" d="M172 96q42-6 37 27-19 5-38-11" fill="#ab9cd6" />
      <path d="m111 164-3 13m43-13 3 13m-54 0h17m28 0h17" fill="none" stroke="#b38a49" />
      <path d="M76 115c0-52 22-82 54-82s54 30 54 82c0 36-21 55-54 55s-54-19-54-55Z" fill="#c4b5e5" />
      <ellipse cx="130" cy="126" rx="34" ry="34" fill="#faf6ed" stroke="none" />
      <path d="M100 85q6-9 12 0m36 0q6-9 12 0" fill="none" />
      <ellipse cx="97" cy="98" rx="10" ry="5" fill="#e7a6ac" stroke="none" /><ellipse cx="163" cy="98" rx="10" ry="5" fill="#e7a6ac" stroke="none" />
      <path d="m119 96 11-7 11 7-11 12Z" fill="#efc778" />
      {grown && <><path d="M87 116q43 16 86 0l-3 13q-40 15-80 0Z" fill="#92c6ae"/><path d="m154 129 10 24-15-4-3-20" fill="#92c6ae"/></>}
      {stage !== 'hatch' && <path d="M129 34q-17-24-29-12 2 17 29 12Zm1-1q8-25 24-22 5 20-24 22Z" fill="#a8d1a4" />}
    </g>
    </g>
    {stage === 'hatch' && <path d="m90 153 12-9 13 11 13-9 13 10 17-10 13 7q-2 28-41 28t-40-28Z" fill="#fff7e5" stroke="#807294" strokeWidth="3"/>}
    {['nest', 'home'].includes(stage) && <g stroke="#a78b66" fill="#d9bd95" strokeWidth="3"><path d="M73 153q57 31 114 0l-12 29q-45 17-90 0Z"/><path d="m85 168 89 10m-78 4 77-16"/></g>}
    </>}
    <g fill="#c3a159"><path d="m39 57 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="m218 42 2 6 7 2-7 3-2 6-2-6-7-3 7-2Z"/></g>
    {stage === 'home' && <path d="m212 125 4 8 9 2-6 6 1 9-8-4-8 4 1-9-6-6 9-2Z" fill="#f0cf7b" />}
  </svg>
}

export function BirdGrowth({ count, runs = [] }: { count: number; runs?: AdventureRun[] }) {
  const stage = birdStage(count)
  const next = BIRD_STAGES.find(s => s.at > count)
  return <section className="bird-growth"><div className="growth-current"><BuddyBird stage={stage.key} /><div><span className="journey-kicker">小步的成长故事 · 已一起冒险 {count} 次</span><h2>{stage.name}</h2><p>{stage.text}</p><p className="muted">{next ? `再一起冒险 ${next.at - count} 次，就到「${next.name}」。` : '家已经建好了。每次冒险仍会留下新故事。'}</p></div></div><div className="material-shelf" aria-label="一路带回的筑巢材料">{(['leaf', 'twig', 'pebble'] as const).map(material => <span key={material}><PlayPicture kind={material} /><small>{MATERIAL_NAMES[material]} × {uniqueAdventures(runs).filter(r => r.material === material).length}</small></span>)}</div><ol className="bird-timeline">{BIRD_STAGES.map(s => <li key={s.key} aria-current={stage.key === s.key ? 'step' : undefined} className={count >= s.at ? 'reached' : ''}><BuddyBird stage={s.key} /><strong>{s.name}</strong><small>{s.at === 0 ? '从这里开始' : `累计 ${s.at} 次冒险`}</small></li>)}</ol><p className="muted">不需要连续打卡。休息不会退回去，兑换礼物也不会让小步变小。</p>{runs.length > 0 && <details className="adventure-album"><summary>翻翻冒险相册</summary><ol>{uniqueAdventures(runs).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map(run => <li key={run.id}><PlayPicture kind={run.material} /><div><strong>{run.date.slice(5)} · +{run.bonusStars} 星</strong><p>{adventureStory(run)}</p></div></li>)}</ol></details>}</section>
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
