import { skyBonus } from './honor-catalog.mjs'
const KEYS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']
export function achievementBonus(claims={}) {
 return KEYS.filter(key=>typeof claims?.[key]==='string'&&Number.isFinite(Date.parse(claims[key]))).length*2+skyBonus(claims)
}
