import { Link } from 'react-router-dom'
import type { RoutineCheck, TaskRecord, Wish } from '../db/types'
import { PlayPicture, TinyStar } from './PlayCards'
import { growthTrail } from '../lib/rewards'
import { formatDay } from '../lib/date'

export function BuddyBird({ earned, celebrating = false }: { earned: number; celebrating?: boolean }) {
  return <svg className={`buddy-bird ${celebrating ? 'buddy-happy' : ''}`} viewBox="0 0 260 210" role="img" aria-label="一直微笑着陪你的小鸟小步">
    <title>小鸟小步</title><desc>小步站在小岛上，张开翅膀陪你出发。攒下星星时会多一条围巾和一片小叶子。</desc>
    <circle cx="130" cy="101" r="88" fill="#eee8f9" />
    <path d="M35 162q95-27 190 0l-10 16q-80 30-170 0Z" fill="#d4e7ce" />
    <ellipse cx="130" cy="174" rx="53" ry="7" fill="#b4c7ad" opacity=".5" />
    <g stroke="#554975" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path className="bird-wing" d="M88 96q-42-6-37 27 19 5 38-11" fill="#ab9cd6" />
      <path className="bird-wing" d="M172 96q42-6 37 27-19 5-38-11" fill="#ab9cd6" />
      <path d="m111 164-3 13m43-13 3 13m-54 0h17m28 0h17" fill="none" stroke="#b38a49" />
      <path d="M76 115c0-52 22-82 54-82s54 30 54 82c0 36-21 55-54 55s-54-19-54-55Z" fill="#c4b5e5" />
      <ellipse cx="130" cy="126" rx="34" ry="34" fill="#faf6ed" stroke="none" />
      <path d="M100 85q6-9 12 0m36 0q6-9 12 0" fill="none" />
      <ellipse cx="97" cy="98" rx="10" ry="5" fill="#e7a6ac" stroke="none" /><ellipse cx="163" cy="98" rx="10" ry="5" fill="#e7a6ac" stroke="none" />
      <path d="m119 96 11-7 11 7-11 12Z" fill="#efc778" />
      {earned >= 25 && <><path d="M87 116q43 16 86 0l-3 13q-40 15-80 0Z" fill="#92c6ae"/><path d="m154 129 10 24-15-4-3-20" fill="#92c6ae"/></>}
      {earned >= 60 && <path d="M129 34q-17-24-29-12 2 17 29 12Zm1-1q8-25 24-22 5 20-24 22Z" fill="#a8d1a4" />}
    </g>
    <g fill="#c3a159"><path d="m39 57 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="m218 42 2 6 7 2-7 3-2 6-2-6-7-3 7-2Z"/></g>
    {earned >= 120 && <path d="m202 118 4 8 9 2-6 6 1 9-8-4-8 4 1-9-6-6 9-2Z" fill="#f0cf7b" />}
  </svg>
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
