export interface HonorDefinition {id:string;metric:string;group:string;title:string;target:number;requirement:string}
export interface SkyStarDefinition {id:string;signKey:string;slot:number;honorId:string;name:string;reward:number}
export const HONORS: HonorDefinition[]
export const SKY_STARS: SkyStarDefinition[]
export const SIGN_KEYS: string[]
export const HONOR_GROUPS: [string,string,string,number[]][]
export function skyBonus(claims?:Record<string,string>):number
export function validTime(value:unknown):boolean
