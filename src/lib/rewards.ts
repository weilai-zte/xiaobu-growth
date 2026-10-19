import type { TaskRecord, RoutineCheck, Wish } from '../db/types'

export const STARS_PER_ACTION = 5
export const BADGES = [
  { at: 5, name: '小芽', picture: 'sprout' },
  { at: 25, name: '小花', picture: 'flower' },
  { at: 60, name: '小树', picture: 'tree' },
  { at: 120, name: '小火箭', picture: 'rocket' },
]

// 星星直接由有效记录计算，重复点击、删除和跨设备合并都不会产生额外流水。
export function starBalance(tasks: TaskRecord[], checks: RoutineCheck[], wishes: Wish[]) {
  const actions = new Set<string>()
  for (const task of tasks) {
    if (!task.deleted && task.completion === 'independent') {
      actions.add(`task:${task.date}:${task.templateId || task.name}`)
    }
  }
  for (const check of checks) {
    if (!check.deleted && check.status === 'done') actions.add(`rule:${check.date}:${check.ruleId}`)
  }
  const earned = actions.size * STARS_PER_ACTION
  const spent = wishes.filter(w => !w.deleted && w.status === 'redeemed').reduce((sum, w) => sum + (w.cost ?? 0), 0)
  const reserved = wishes.filter(w => !w.deleted && w.status === 'requested').reduce((sum, w) => sum + (w.cost ?? 0), 0)
  return { earned, spent, reserved, available: Math.max(0, earned - spent - reserved) }
}

export function validWish(row: Partial<Wish>): boolean {
  return typeof row.childId === 'string' && !!row.childId && typeof row.name === 'string' &&
    row.name.trim().length > 0 && row.name.length <= 80 && typeof row.picture === 'string' &&
    ['proposed', 'approved', 'requested', 'redeemed'].includes(row.status ?? '') &&
    (row.status === 'proposed' ? row.cost === null : Number.isSafeInteger(row.cost) && Number(row.cost) > 0)
}
