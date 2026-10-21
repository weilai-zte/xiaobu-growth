import { describe, expect, it } from 'vitest'
import { countCompletedCheckins, zodiacProgress, ZODIAC_SIGNS } from '../src/lib/constellations'
import type { RoutineCheck, TaskRecord } from '../src/db/types'
const check=(patch:Partial<RoutineCheck>={})=>({id:'check',childId:'c',date:'2026-10-20',ruleId:'r',status:'done',rewardStars:2,...patch}) as RoutineCheck
const task=(patch:Partial<TaskRecord>={})=>({id:'task',childId:'c',date:'2026-10-20',templateId:'t',name:'阅读',completion:'independent',rewardStars:2,...patch}) as TaskRecord
describe('十二星座按打卡次数点亮',()=>{
 it('十二张卡按5次一个解锁，边界和超过60次正确',()=>{
  expect(ZODIAC_SIGNS.map(s=>s.name)).toEqual(['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'])
  expect(zodiacProgress(0)).toMatchObject({count:0,unlocked:0,remaining:5})
  expect(zodiacProgress(4)).toMatchObject({unlocked:0,remaining:1})
  expect(zodiacProgress(5)).toMatchObject({unlocked:1,remaining:5})
  expect(zodiacProgress(59)).toMatchObject({unlocked:11,remaining:1})
  expect(zodiacProgress(60)).toMatchObject({unlocked:12,remaining:0,complete:true})
  expect(zodiacProgress(200)).toMatchObject({count:200,lit:60,unlocked:12,complete:true})
  expect(zodiacProgress(NaN).count).toBe(0)
 })
 it('不同星数都只算一次；同项同日重传去重，不同日可累计',()=>{
  expect(countCompletedCheckins('c',[task(),task({id:'duplicate',rewardStars:1})],[check(),check({id:'another',rewardStars:1}),check({id:'yesterday',date:'2026-10-19'})],'2026-10-20')).toBe(3)
 })
 it('排除删除、未完成、非法/未来日期和其他孩子；不依赖余额或冒险奖励',()=>{
  expect(countCompletedCheckins('c',[task({deleted:true}),task({completion:'partial'}),task({childId:'other'})],[check({status:'partial'}),check({deleted:true}),check({date:'2026-02-30'}),check({date:'2099-01-01'}),check({childId:'other'}),check({ruleId:''})],'2026-10-20')).toBe(0)
  expect(countCompletedCheckins('c',[task({rewardStars:undefined})],[check({rewardStars:1})],'2026-10-20')).toBe(2)
 })
})
