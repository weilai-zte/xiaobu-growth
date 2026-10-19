import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import { repo } from '../db/repo'
import { ActionCard, Celebration, TinyStar } from '../components/PlayCards'
import { BuddyBird, WishGoal } from '../components/GrowthJourney'
import { focusedWish, starBalance } from '../lib/rewards'
import { FeedbackSound } from '../components/FeedbackSound'
import { PRAISE_TEXT } from '../lib/praise'
import { Adventure, useAdventureDay } from '../components/Adventure'
import { birdStage, uniqueAdventures } from '../lib/adventure'

export function ChildToday() {
  const { profile } = useApp()
  const adventureDate = useAdventureDay()
  const { tasks, rules, checks, childId, date, loading } = useToday(adventureDate)
  const [message, setMessage] = useState('')
  const [chosenId, setChosenId] = useState('')
  const growth = useLiveQuery(async () => childId ? {
    tasks: await repo.listTaskRecords(childId), checks: await repo.listChecks(childId), wishes: await repo.listWishes(childId), adventures: await repo.listAdventures(childId),
  } : undefined, [childId])
  const balance = starBalance(growth?.tasks ?? [], growth?.checks ?? [], growth?.wishes ?? [], growth?.adventures ?? [])
  const stage = birdStage(uniqueAdventures(growth?.adventures ?? []).length)
  const wish = focusedWish(growth?.wishes ?? [], profile?.focusWishId)
  const allCards = [
    ...tasks.map(task => ({ id: task.id, title: task.name, done: task.completion === 'independent', save: () => repo.updateTaskRecord(task.id, { completion: 'independent', status: 'finished', timer: null }) })),
    ...rules.filter(r => r.active).map(rule => ({ id: rule.id, title: rule.title, done: checks.some(c => c.ruleId === rule.id && c.status === 'done'), save: () => repo.setCheck(childId!, rule.id, date, 'done') })),
  ]
  const cards = [...allCards].sort((a, b) => Number(a.done) - Number(b.done) || Number(b.id === chosenId) - Number(a.id === chosenId)).slice(0, 5)
  const doneToday = allCards.filter(card => card.done).length
  return <div className="play-world">
    <section className="play-hero buddy-hero"><div className="buddy-intro"><span className="play-eyebrow">今天的小冒险 · 自己选一小步</span><h1>{profile?.nickname || profile?.name}，出发！</h1><p>{stage.key === 'egg' || stage.key === 'crack' ? '小步还在蛋里，我们一起等它长大。' : stage.text}</p><Link className="star-wallet" to="/child/progress"><TinyStar /><strong>{growth ? balance.available : '…'}</strong><span>我的星星</span><span aria-hidden="true">→</span></Link></div><div className="buddy-stage"><BuddyBird stage={stage.key} celebrating={doneToday > 0} /><span className="buddy-speech">{stage.name}</span></div></section>
    {growth && childId && <Adventure key={date} childId={childId} date={date} tasks={growth.tasks} checks={growth.checks} runs={growth.adventures} />}
    {growth && <WishGoal wish={wish} available={balance.available} compact />}
    <Celebration message={message} />
    <div className="journey-section-heading"><div><span className="journey-kicker">做完后，点图片收下这一步</span><h2>今天先做哪一件？</h2></div><span className="today-leaves">已点亮 {doneToday} 张</span></div>
    {loading ? <p role="status">正在准备你的任务卡…</p> : cards.length === 0 ? <p>请爸爸妈妈帮你选几个小任务吧。</p> : <div className="action-grid">{cards.map(card => <div className={`action-choice ${chosenId === card.id && !card.done ? 'is-current' : ''}`} key={card.id}><ActionCard {...card} onComplete={async () => {
      try { await card.save(); setChosenId(current => current === card.id ? '' : current); setMessage(`${PRAISE_TEXT} 你做到了：${card.title}！`); return true }
      catch { setMessage('这次没记上，请再点一下。'); return false }
    }} />{!card.done && <button type="button" className="choose-task" aria-label={`我先做：${card.title}`} aria-pressed={chosenId === card.id} onClick={() => setChosenId(current => current === card.id ? '' : card.id)}>{chosenId === card.id ? '先做这一件' : '我先做这个'}</button>}</div>)}</div>}
    <div className="journey-footer"><Link to="/child/rules" className="btn">看看全部生活图卡</Link><span>做一件也很好，休息后再回来。</span></div>
    <FeedbackSound />
  </div>
}
