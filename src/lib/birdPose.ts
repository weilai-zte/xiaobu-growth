import type { BuddyActivity } from '../db/types'
export const ORIGINAL_BIRD_SHEET='xiaobu-flap-sheet-v1.webp'
export const BIRD_ACTION_SHEET='xiaobu-care-actions-v2.webp'
export function birdPose(activity:BuddyActivity,seconds:number,flapping=false,reduced=false) {
 const t=Number.isFinite(seconds)?Math.max(0,seconds):0
 if(activity==='sleep')return {sheet:'actions' as const,column:reduced?3:Math.min(3,Math.floor(t*3)),row:0}
 if(activity==='feed')return {sheet:'actions' as const,column:reduced?0:[0,1,2,3,1,2,3,0][Math.floor(t*5)%8],row:1}
 if(activity==='play')return {sheet:'actions' as const,column:reduced?0:Math.floor(t*4)%4,row:2}
 if(flapping||activity==='adventure')return {sheet:'original' as const,column:reduced?0:[0,1,2,3,1][Math.floor(t*9)%5]%2,row:reduced?0:Math.floor([0,1,2,3,1][Math.floor(t*9)%5]/2)}
 return {sheet:'original' as const,column:0,row:0}
}
