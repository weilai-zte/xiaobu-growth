import { achievementBonus, type StarClaims } from './starAchievements'
import type { TaskRecord, RoutineCheck, Wish, AdventureRun, BankEntry } from '../db/types'
import { addDays } from './date'
import { recordStars } from './habits'

export function focusedWish(wishes: Wish[], id?: string | null): Wish | undefined {
  const active = wishes.filter(w => !w.deleted && w.status !== 'redeemed')
  return active.find(w => w.id === id) ?? active.find(w => w.status === 'approved' || w.status === 'requested') ?? active[0]
}

export function growthTrail(tasks: TaskRecord[], checks: RoutineCheck[], until: string) {
  const days = new Set([
    ...tasks.filter(t => !t.deleted && t.completion === 'independent').map(t => t.date),
    ...checks.filter(c => !c.deleted && c.status === 'done').map(c => c.date),
  ])
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(until, i - 6)
    return { date, done: days.has(date) }
  })
}

export const STARS_PER_ACTION = 5
export const BADGES = [
  { at: 5, name: '小芽', picture: 'sprout' },
  { at: 25, name: '小花', picture: 'flower' },
  { at: 60, name: '小树', picture: 'tree' },
  { at: 120, name: '小火箭', picture: 'rocket' },
]

// 星星直接由有效记录计算，重复点击、删除和跨设备合并都不会产生额外流水。
export function starBalance(tasks: TaskRecord[], checks: RoutineCheck[], wishes: Wish[], adventures: AdventureRun[] = [], bankEntries: BankEntry[] = [], starClaims: StarClaims = {}) {
  const actions = new Map<string, number>()
  for (const task of tasks) {
    if (!task.deleted && task.completion === 'independent') {
      const key = `task:${task.date}:${task.templateId || task.name}`
      actions.set(key, Math.max(actions.get(key) ?? 0, recordStars(task)))
    }
  }
  for (const check of checks) {
    if (!check.deleted && check.status === 'done') { const key = `rule:${check.date}:${check.ruleId}`; actions.set(key, Math.max(actions.get(key) ?? 0, recordStars(check))) }
  }
  const bonus = [...new Map(adventures.filter(r => !r.deleted).map(r => [r.id, r])).values()].reduce((sum, r) => sum + r.bonusStars, 0)
  const earned = [...actions.values()].reduce((sum, stars) => sum + stars, 0) + bonus + achievementBonus(starClaims)
  const spent = wishes.filter(w => !w.deleted && w.status === 'redeemed').reduce((sum, w) => sum + (w.cost ?? 0), 0)
  const reserved = wishes.filter(w => !w.deleted && w.status === 'requested').reduce((sum, w) => sum + (w.cost ?? 0), 0)
  const bankTransfer = [...new Map(bankEntries.filter(e => !e.deleted).map(e => [e.id,e])).values()].reduce((sum,e) => sum + (e.kind === 'deposit' ? -e.amount : e.kind === 'withdraw' ? e.amount : 0),0)
  return { earned, bonus, spent, reserved, bankTransfer, available: Math.max(0, earned + bankTransfer - spent - reserved) }
}

export function validWish(row: Partial<Wish>): boolean {
  return typeof row.childId === 'string' && !!row.childId && typeof row.name === 'string' &&
    row.name.trim().length > 0 && row.name.length <= 80 && typeof row.picture === 'string' &&
    ['proposed', 'approved', 'requested', 'redeemed'].includes(row.status ?? '') &&
    (row.status === 'proposed' ? row.cost === null : Number.isSafeInteger(row.cost) && Number(row.cost) > 0)
}
