import {stopPraise} from './praise'
import type { Difficulty } from '../db/types'

// 选自用户英语打卡项目 data/content.json 的具象基础词；orange 在此取水果义。
export const WORDS = [
  { word: 'apple', cn: '苹果' }, { word: 'banana', cn: '香蕉' }, { word: 'orange', cn: '橙子' },
  { word: 'cat', cn: '猫' }, { word: 'dog', cn: '狗' }, { word: 'fish', cn: '鱼' },
  { word: 'bird', cn: '鸟' }, { word: 'rabbit', cn: '兔子' }, { word: 'bear', cn: '熊' },
  { word: 'ball', cn: '球' }, { word: 'book', cn: '书' }, { word: 'tree', cn: '树' },
  { word: 'sun', cn: '太阳' }, { word: 'moon', cn: '月亮' }, { word: 'star', cn: '星星' },
  { word: 'flower', cn: '花' }, { word: 'car', cn: '小汽车' }, { word: 'bus', cn: '公共汽车' },
  { word: 'train', cn: '火车' }, { word: 'hat', cn: '帽子' }, { word: 'shirt', cn: '衬衫' },
  { word: 'bicycle', cn: '自行车' }, { word: 'elephant', cn: '大象' }, { word: 'shoe', cn: '鞋' },
] as const
export type Word = (typeof WORDS)[number]
export const WORD_LEVELS = [
  { key: 'easy', name: '轻松看看', count: 4, choices: 2 },
  { key: 'medium', name: '试试更多', count: 6, choices: 3 },
  { key: 'hard', name: '小小挑战', count: 8, choices: 4 },
] as const

// 借鉴原项目的每日选词和四选一方式；同日期同档位固定，重试不换题刷星。
export function wordDeck(date: string, level: Difficulty) {
  let seed = [...`${date}:${level}`].reduce((v, c) => (Math.imul(v, 31) + c.charCodeAt(0)) >>> 0, 1)
  function shuffle<T>(list: readonly T[]) { const result = [...list]; for (let i = result.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [result[i], result[j]] = [result[j], result[i]] } return result }
  const config = WORD_LEVELS.find(l => l.key === level)!
  return shuffle(WORDS).slice(0, config.count).map(correct => ({ correct, options: shuffle([correct, ...shuffle(WORDS.filter(w => w.word !== correct.word)).slice(0, config.choices - 1)]) }))
}
let playing: HTMLAudioElement | null = null
export function stopWord() { playing?.pause(); playing = null; if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }
export async function speakWord(word: string): Promise<boolean> {
  if (!WORDS.some(w => w.word === word)) return false
  stopWord(); stopPraise()
  window.dispatchEvent(new Event('xiaobu:study-audio'))
  try { const audio = new Audio(`${import.meta.env.BASE_URL}audio/words/${word}.mp3`); playing = audio; await audio.play(); return true }
  catch { return false }
}
