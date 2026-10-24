import { afterEach, expect, it, vi } from 'vitest'
import { adventureDay } from '../src/lib/adventure'
import { countCompletedCheckins } from '../src/lib/constellations'
import { evaluateHonors } from '../src/lib/honors'
import { evaluateStars } from '../src/lib/starAchievements'
import { starBalance } from '../src/lib/rewards'
import type { TaskRecord } from '../src/db/types'
afterEach(()=>vi.useRealTimers())
it('上海次日已打卡时，即使设备自然日仍是昨天，钱包/荣誉/星空统计一致',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T20:00:00Z'))
 const row={id:'t',childId:'c',date:adventureDay(),name:'读书',completion:'independent',rewardStars:2,createdAt:'',updatedAt:''} as TaskRecord
 expect(row.date).toBe('2026-10-24')
 expect(starBalance([row],[],[]).earned).toBe(2)
 expect(countCompletedCheckins('c',[row],[])).toBe(1)
 expect(evaluateStars('c',[row],[],[])[0].eligible).toBe(true)
 expect(evaluateHonors('c',[row],[],[],null,[]).find(h=>h.id==='honor:total:1')?.eligible).toBe(true)
 expect(countCompletedCheckins('c',[{...row,date:'2026-10-25'}],[])).toBe(0)
})
it('统一自然日函数使用上海日期，但不改写历史记录日期',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T15:59:00Z'))
 expect(adventureDay()).toBe('2026-10-23')
 const old={id:'t',childId:'c',date:'2026-10-22',name:'读书',completion:'independent',createdAt:'',updatedAt:''} as TaskRecord
 expect(countCompletedCheckins('c',[old],[])).toBe(1);expect(old.date).toBe('2026-10-22')
})
