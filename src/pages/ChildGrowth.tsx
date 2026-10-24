import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { repo } from '../db/repo'
import { ConstellationMap } from '../components/ConstellationMap'

export function ChildGrowth() {
  const { profile } = useApp()
  const [params]=useSearchParams()
  const childId = profile?.id
  const data = useLiveQuery(async () => childId ? {
    tasks: await repo.listTaskRecords(childId), checks: await repo.listChecks(childId),
    adventures: await repo.listAdventures(childId),
  } : undefined, [childId])
  if (!data) return <p role="status">正在点亮星空…</p>
  return <div className="play-world child-growth"><header><h1>梦幻星空</h1></header>
    <ConstellationMap childId={childId ?? ''} tasks={data.tasks} checks={data.checks} adventures={data.adventures} profile={profile} focusStarId={params.get('star')??undefined} />
  </div>
}
