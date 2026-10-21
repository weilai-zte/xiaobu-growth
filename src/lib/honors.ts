import { HONORS, SKY_STARS, validTime } from '../../server/honor-catalog.mjs'
import type { AdventureRun, BuddyCareState, RoutineCheck, RoutineRule, TaskRecord } from '../db/types'
import { countCompletedCheckins } from './constellations'
import { uniqueAdventures } from './adventure'
import { adventureTreasure } from './birdCompanion'
import { HABIT_PLAN } from './habits'
import { isDayKey, todayKey } from './date'
export { HONORS, SKY_STARS }
export function evaluateHonors(childId:string,tasks:TaskRecord[],checks:RoutineCheck[],adventures:AdventureRun[],care:BuddyCareState|null|undefined,rules:RoutineRule[],claims:Record<string,string>={}) {
 const validDate=(date:string)=>isDayKey(date)&&date<=todayKey()
 const ownTasks=tasks.filter(t=>t.childId===childId&&!t.deleted&&t.completion==='independent'&&validDate(t.date)&&(t.templateId||t.name?.trim()))
 const ownChecks=[...new Map(checks.filter(c=>c.childId===childId&&!c.deleted&&c.status==='done'&&validDate(c.date)&&c.ruleId?.trim()).map(c=>[`${c.date}:${c.ruleId}`,c])).values()]
 const categories=new Map(rules.filter(r=>r.childId===childId).map(r=>[r.id,r.category??HABIT_PLAN.find(h=>h.key===r.habitKey)?.category]))
 const runs=uniqueAdventures(adventures.filter(a=>a.childId===childId&&validDate(a.date)))
 const treasures=runs.map(adventureTreasure)
 const metrics:Record<string,number>={
  life:ownChecks.filter(c=>categories.get(c.ruleId)==='life').length,
  sport:ownChecks.filter(c=>categories.get(c.ruleId)==='sport').length,
  study:ownChecks.filter(c=>categories.get(c.ruleId)==='study').length+countCompletedCheckins(childId,ownTasks,[]),
  total:countCompletedCheckins(childId,tasks,checks),days:new Set([...ownTasks,...ownChecks].map(r=>r.date)).size,
  care:Number.isSafeInteger(care?.xp)?Math.max(0,care?.xp??0):0,
  adventures:runs.length,routes:new Set(runs.map(r=>r.route)).size,
  food:treasures.filter(t=>t.category==='美味').length,gem:treasures.filter(t=>t.key==='gem').length,
  decor:treasures.filter(t=>t.category==='家园').length,collection:new Set(treasures.map(t=>t.key)).size,
 }
 return HONORS.map(h=>({...h,value:metrics[h.metric]??0,eligible:(metrics[h.metric]??0)>=h.target,earned:validTime(claims[h.id])}))
}
export function buildHonorSky(honorClaims:Record<string,string>={},starClaims:Record<string,string>={}) {
 return SKY_STARS.map(star=>{
  const lit=validTime(starClaims[star.id])||(star.slot===0&&validTime(starClaims[star.signKey]))
  return {...star,honor:HONORS.find(h=>h.id===star.honorId)!,lit,revealed:lit||validTime(honorClaims[star.honorId])}
 })
}
