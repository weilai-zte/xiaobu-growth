import { adventureDay } from './adventure'
import type { RoutineCheck, TaskRecord } from '../db/types'
import { isDayKey } from './date'

export const CHECKINS_PER_SIGN = 5
/** 原创星座主题插画和连线示意，不按生日限制收藏。 */
export const ZODIAC_SIGNS = [
 {key:'aries',name:'白羊座',english:'ARIES',symbol:'♈',title:'勇敢启程',motto:'愿意试一试，就是勇敢的第一步。',color:'#ffb5ad',points:[[20,62],[32,35],[50,25],[68,35],[80,62]],motif:'M86 98C62 92 47 70 60 54C74 38 94 50 98 73M154 98C178 92 193 70 180 54C166 38 146 50 142 73M98 73L100 123L120 143L140 123L142 73M104 103L110 106M136 103L130 106M114 126H126'},
 {key:'taurus',name:'金牛座',english:'TAURUS',symbol:'♉',title:'稳稳向前',motto:'每天做好一小件，慢慢也能走很远。',color:'#f7d28a',points:[[16,24],[34,41],[50,65],[66,41],[84,24]],motif:'M69 44C66 77 82 89 100 88M171 44C174 77 158 89 140 88M100 88Q120 73 140 88L150 124L120 148L90 124ZM100 107L108 110M140 107L132 110M112 132H128'},
 {key:'gemini',name:'双子座',english:'GEMINI',symbol:'♊',title:'好奇双翼',motto:'多问一个为什么，多发现一点新鲜。',color:'#a9e2ff',points:[[28,20],[25,68],[50,43],[72,20],[77,68]],motif:'M82 48Q120 65 158 48M82 145Q120 128 158 145M95 57V137M145 57V137M108 87L120 77L132 87L120 99Z'},
 {key:'cancer',name:'巨蟹座',english:'CANCER',symbol:'♋',title:'温柔守护',motto:'照顾好自己，也把温柔送给家人。',color:'#b9c5ff',points:[[18,46],[36,27],[52,48],[68,64],[84,43]],motif:'M83 105Q120 72 157 105Q158 139 120 143Q82 139 83 105ZM80 114L60 100L53 78M160 114L180 100L187 78M58 79L44 65L62 57L68 74M182 79L196 65L178 57L172 74M92 131L75 143M148 131L165 143M108 100V88M132 100V88'},
 {key:'leo',name:'狮子座',english:'LEO',symbol:'♌',title:'闪耀勇气',motto:'把做过的努力，大大方方地记下来。',color:'#ffd28a',points:[[20,67],[35,38],[55,20],[73,35],[62,65]],motif:'M120 38L141 54L165 57L170 84L182 106L165 126L155 150L130 151L110 161L89 146L65 139L64 113L54 91L72 71L80 48L104 50ZM94 85Q120 65 146 85L148 117L120 139L92 117ZM101 100L108 103M139 100L132 103M113 119H127L120 128Z'},
 {key:'virgo',name:'处女座',english:'VIRGO',symbol:'♍',title:'认真小步',motto:'认真做好眼前这一步，就很了不起。',color:'#c4efb4',points:[[19,25],[33,53],[53,38],[68,62],[83,30]],motif:'M120 145V69M120 115Q87 121 87 95Q107 92 120 115M120 92Q146 97 153 72Q131 67 120 92M120 70Q99 62 108 42Q130 43 120 70M105 145H135'},
 {key:'libra',name:'天秤座',english:'LIBRA',symbol:'♎',title:'平衡之光',motto:'学习、运动和休息，都值得好好安排。',color:'#f0bded',points:[[16,58],[32,31],[50,20],[68,31],[84,58]],motif:'M120 49V143M78 73H162M120 49L78 73M120 49L162 73M78 73L58 113H98ZM162 73L142 113H182ZM58 113Q78 138 98 113M142 113Q162 138 182 113M97 145H143'},
 {key:'scorpio',name:'天蝎座',english:'SCORPIUS',symbol:'♏',title:'专注力量',motto:'专心做一件小事，让努力慢慢发光。',color:'#e5b1ff',points:[[17,23],[35,37],[48,64],[70,70],[83,48]],motif:'M85 89Q120 62 141 95Q158 123 132 140Q103 157 85 135L77 110ZM140 125Q178 131 179 101Q180 79 160 78L174 63M79 92L62 72L48 78L51 98M64 73L69 57M87 118L62 124M97 137L83 153M126 142L134 158'},
 {key:'sagittarius',name:'射手座',english:'SAGITTARIUS',symbol:'♐',title:'探索远方',motto:'带着好奇出发，每一小步都有发现。',color:'#9cdeed',points:[[20,65],[38,46],[55,28],[73,18],[78,47]],motif:'M74 143L163 54M129 54H163V88M81 109L111 139M79 63Q143 90 173 154M79 63L108 105L173 154'},
 {key:'capricorn',name:'摩羯座',english:'CAPRICORN',symbol:'♑',title:'向上攀登',motto:'歇一歇再继续，你走过的路都算数。',color:'#b9d2ff',points:[[17,25],[34,65],[51,44],[70,65],[84,25]],motif:'M87 88Q69 66 82 42Q104 51 106 78M153 88Q171 66 158 42Q136 51 134 78M106 78Q120 69 134 78L146 119L121 141L94 119ZM140 127Q176 120 170 143Q163 161 144 149M103 101L110 104M137 101L130 104'},
 {key:'aquarius',name:'水瓶座',english:'AQUARIUS',symbol:'♒',title:'灵感之泉',motto:'你的新想法，值得被认真听见。',color:'#a6e5ec',points:[[16,31],[34,51],[52,29],[69,53],[85,33]],motif:'M97 47H143L138 71Q157 92 151 126Q149 149 120 152Q91 149 89 126Q83 92 102 71ZM100 73H140M95 103Q109 92 121 103Q133 114 147 103M91 124Q106 113 121 124Q134 136 151 124'},
 {key:'pisces',name:'双鱼座',english:'PISCES',symbol:'♓',title:'想象海洋',motto:'把好奇和想象，装进下一段旅程。',color:'#c6c0ff',points:[[17,42],[36,23],[50,48],[66,67],[84,45]],motif:'M52 74Q89 38 119 74Q89 110 52 74L36 55V93ZM188 126Q151 90 121 126Q151 162 188 126L204 107V145ZM78 68V70M162 120V122M92 90Q119 120 148 110'},
] as const
export type ZodiacSign = typeof ZODIAC_SIGNS[number]

export function countCompletedCheckins(childId: string, tasks: TaskRecord[], checks: RoutineCheck[], until = adventureDay()) {
  const actions = new Set<string>()
  const validDate = (date: string) => isDayKey(date) && date <= until
  for (const task of tasks) if (!task.deleted && task.childId === childId && task.completion === 'independent' && validDate(task.date) && (task.templateId || task.name?.trim())) actions.add(`task:${task.date}:${task.templateId || task.name.trim()}`)
  for (const check of checks) if (!check.deleted && check.childId === childId && check.status === 'done' && validDate(check.date) && check.ruleId?.trim()) actions.add(`rule:${check.date}:${check.ruleId}`)
  return actions.size
}
export function zodiacProgress(total: number) {
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  const unlocked = Math.min(ZODIAC_SIGNS.length, Math.floor(count / CHECKINS_PER_SIGN))
  return { count, unlocked, lit: Math.min(60, count), complete: unlocked === 12, remaining: unlocked === 12 ? 0 : CHECKINS_PER_SIGN - count % CHECKINS_PER_SIGN }
}
