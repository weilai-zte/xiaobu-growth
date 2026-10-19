import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../db/repo'
import { useApp } from './AppProvider'
import { todayKey } from '../lib/date'
import type { DayKey } from '../db/types'

export function useChildId(): string | undefined {
  return useApp().profile?.id
}

export function useToday(date: DayKey = todayKey()) {
  const childId = useChildId()
  const tasks = useLiveQuery(
    () => (childId ? repo.listTaskRecords(childId, date, date) : Promise.resolve([])),
    [childId, date],
  )
  const rules = useLiveQuery(
    () => (childId ? repo.listRules(childId) : Promise.resolve([])),
    [childId],
  )
  const checks = useLiveQuery(
    () => (childId ? repo.listChecks(childId, date, date) : Promise.resolve([])),
    [childId, date],
  )
  return {
    childId,
    date,
    tasks: tasks ?? [],
    rules: rules ?? [],
    checks: checks ?? [],
    loading: childId === undefined || tasks === undefined || rules === undefined,
  }
}
