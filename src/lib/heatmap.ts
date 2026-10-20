import type { DayKey, RoutineCheck } from '../db/types'
import { addDays, startOfWeek } from './date'

export type StarBucket = 0 | 1 | 2 | 3
export interface HeatmapCell { date: DayKey; stars: number; bucket: StarBucket }
export function bucketFor(stars: number): StarBucket {
  return stars >= 3 ? 3 : stars >= 2 ? 2 : stars >= 1 ? 1 : 0
}

/** 当前周保留到周日的空位，未来日期不计星。日期均为本地自然日。 */
export function buildHeatmap(checks: RoutineCheck[], endDate: DayKey): HeatmapCell[] {
  const start = addDays(startOfWeek(endDate), -77)
  const totals = new Map<DayKey, number>()
  for (const check of checks) {
    if (check.deleted === true || check.status !== 'done' || check.date > endDate) continue
    const stars = check.rewardStars === 1 || check.rewardStars === 2 ? check.rewardStars : 0
    totals.set(check.date, (totals.get(check.date) ?? 0) + stars)
  }
  return Array.from({ length: 84 }, (_, i) => {
    const date = addDays(start, i)
    const stars = totals.get(date) ?? 0
    return { date, stars, bucket: bucketFor(stars) }
  })
}
