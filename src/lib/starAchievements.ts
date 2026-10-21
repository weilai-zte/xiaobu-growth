import { skyBonus } from '../../server/honor-catalog.mjs'
import type { AdventureRun, BuddyCareState, RoutineCheck, TaskRecord } from '../db/types'
import { countCompletedCheckins, ZODIAC_SIGNS } from './constellations'
import { isDayKey, todayKey } from './date'
import { uniqueAdventures } from './adventure'

export type StarClaims = Record<string, string>
export const STAR_REWARD = 2
const goals = [
  ['完成1次打卡',1], ['完成5次打卡',5], ['完成10次打卡',10],
  ['在3个不同日子打卡',3], ['在7个不同日子打卡',7],
  ['独立完成1次学习',1], ['独立完成5次学习',5],
  ['陪小步冒险1次',1], ['陪小步冒险3次',3], ['探索2条冒险路线',2],
  ['照料小步，亲密值达到10',10], ['陪小步冒险14次',14],
] as const
export function achievementBonus(claims: StarClaims = {}) {
  return ZODIAC_SIGNS.filter(sign => typeof claims[sign.key] === 'string' && Number.isFinite(Date.parse(claims[sign.key]))).length * STAR_REWARD + skyBonus(claims)
}
export function evaluateStars(childId: string, tasks: TaskRecord[], checks: RoutineCheck[], adventures: AdventureRun[], care: BuddyCareState | null = null, claims: StarClaims = {}) {
  const validDate=(date:string)=>isDayKey(date)&&date<=todayKey()
  const ownTasks=tasks.filter(t=>t.childId===childId&&!t.deleted&&t.completion==='independent'&&validDate(t.date))
  const ownChecks=checks.filter(c=>c.childId===childId&&!c.deleted&&c.status==='done'&&validDate(c.date))
  const count=countCompletedCheckins(childId,tasks,checks)
  const days=new Set([...ownTasks,...ownChecks].map(r=>r.date)).size
  const study=countCompletedCheckins(childId,ownTasks,[])
  const runs=uniqueAdventures(adventures.filter(a=>a.childId===childId&&validDate(a.date)))
  const values=[count,count,count,days,days,study,study,runs.length,runs.length,new Set(runs.map(r=>r.route)).size,Math.max(0,care?.xp??0),runs.length]
  return ZODIAC_SIGNS.map((sign,i)=>({...sign,requirement:goals[i][0],target:goals[i][1],value:values[i],eligible:values[i]>=goals[i][1],lit:achievementBonus({[sign.key]:claims[sign.key]})>0,reward:STAR_REWARD}))
}
