import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import { repo } from '../db/repo'
import { TinyStar } from '../components/PlayCards'
import { HabitBoard } from '../components/HabitBoard'
import { starBalance } from '../lib/rewards'
import { useAdventureDay } from '../components/Adventure'

export function ChildToday() {
  const { profile } = useApp()
  const date = useAdventureDay()
  const { tasks, rules, checks, childId } = useToday(date)
  const growth = useLiveQuery(async () => childId ? {
    tasks: await repo.listTaskRecords(childId), checks: await repo.listChecks(childId), wishes: await repo.listWishes(childId), adventures: await repo.listAdventures(childId), bankEntries: await repo.listBankEntries(childId),
  } : undefined, [childId])
  const balance = starBalance(growth?.tasks ?? [], growth?.checks ?? [], growth?.wishes ?? [], growth?.adventures ?? [], growth?.bankEntries ?? [], profile?.starClaims)
  return <div className="play-world child-home">
    <header className="child-today-hero">
      <div>
        <span className="play-eyebrow">今天也慢慢来</span>
        <h1>每日打卡</h1>
        <p>{profile?.nickname || profile?.name || '小主人'}，出发！选一件想做的小事，一步一步完成。</p>
      </div>
      <div className="star-wallet"><TinyStar /><strong>{growth ? balance.available : '…'}</strong><span>我的星星</span></div>
    </header>
    <HabitBoard rules={rules} tasks={tasks} checks={checks} date={date} limit={99} />
  </div>
}
