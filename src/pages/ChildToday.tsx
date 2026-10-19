import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import { repo } from '../db/repo'
import { TinyStar } from '../components/PlayCards'
import { WishGoal } from '../components/GrowthJourney'
import { BirdCompanion } from '../components/BirdCompanion'
import { HabitBoard } from '../components/HabitBoard'
import { focusedWish, starBalance } from '../lib/rewards'
import { FeedbackSound } from '../components/FeedbackSound'
import { Adventure, useAdventureDay } from '../components/Adventure'
import { birdStage, uniqueAdventures } from '../lib/adventure'

export function ChildToday() {
  const { profile } = useApp()
  const date = useAdventureDay()
  const { tasks, rules, checks, childId } = useToday(date)
  const growth = useLiveQuery(async () => childId ? {
    tasks: await repo.listTaskRecords(childId), checks: await repo.listChecks(childId), wishes: await repo.listWishes(childId), adventures: await repo.listAdventures(childId),
  } : undefined, [childId])
  const balance = starBalance(growth?.tasks ?? [], growth?.checks ?? [], growth?.wishes ?? [], growth?.adventures ?? [])
  const stage = birdStage(uniqueAdventures(growth?.adventures ?? []).length)
  const wish = focusedWish(growth?.wishes ?? [], profile?.focusWishId)
  return <div className="play-world">
    <section className="play-hero buddy-hero"><div className="buddy-intro"><span className="play-eyebrow">生活 · 运动 · 学习，每天一小步</span><h1>{profile?.nickname || profile?.name}，出发！</h1><p>{stage.key === 'egg' || stage.key === 'crack' ? '小步还在蛋里，我们一起等它长大。' : stage.text}</p><Link className="star-wallet" to="/child/progress"><TinyStar /><strong>{growth ? balance.available : '…'}</strong><span>我的星星</span><span aria-hidden="true">→</span></Link></div><div className="buddy-stage"><BirdCompanion stage={stage.key} runs={growth?.adventures ?? []} /><span className="buddy-speech">{stage.name}</span></div></section>
    <HabitBoard rules={rules} tasks={tasks} checks={checks} date={date} />
    {growth && childId && <Adventure key={date} childId={childId} childName={profile?.nickname || profile?.name} date={date} tasks={growth.tasks} checks={growth.checks} runs={growth.adventures} />}
    {growth && <WishGoal wish={wish} available={balance.available} compact />}
    <div className="journey-footer"><Link to="/child/rules" className="btn">看看全部打卡图卡</Link><span>做一件也很好，休息后再回来。</span></div>
    <FeedbackSound />
  </div>
}
