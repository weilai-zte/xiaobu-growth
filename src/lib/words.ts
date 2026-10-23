import {stopPraise} from './praise'
import type { Difficulty, RoutineCheck } from '../db/types'

import { WORDS } from './wordCatalog'
export { WORDS } from './wordCatalog'
export type { Word } from './wordCatalog'
export const WORD_LEVELS = [
  { key: 'easy', name: '轻松看看', count: 4, choices: 2 },
  { key: 'medium', name: '试试更多', count: 6, choices: 3 },
  { key: 'hard', name: '小小挑战', count: 8, choices: 4 },
] as const

export interface WordProgress {
  word: string
  lastSeen: string
  mistakes: number
  cleanDays: number
  needsReview: boolean
}

/** 按实际练习日期合并；同题纠正、同日重练和翻卡都不能抹掉当天的错误。 */
export function wordProgress(history: readonly RoutineCheck[]): WordProgress[] {
  const known = new Set<string>(WORDS.map(w => w.word))
  const days = new Map<string, Map<string, { wrong: boolean; clean: boolean; attempted?: boolean }>>()
  for (const row of history) {
    if (row.deleted) continue
    const day = days.get(row.date) ?? new Map<string, { wrong: boolean; clean: boolean; attempted?: boolean }>()
    days.set(row.date, day)
    for (const word of [...(row.studyWords ?? []), ...(row.studyHints ?? [])]) if (known.has(word) && !day.has(word)) day.set(word, { wrong: false, clean: false })
    for (const a of row.studyAttempts ?? []) {
      if (!known.has(a.word)) continue
      const old = day.get(a.word)
      day.set(a.word, {
        wrong: Boolean(old?.wrong || a.word !== a.selectedWord),
        clean: old?.attempted ? old.clean && !a.revealed && a.word === a.selectedWord : !a.revealed && a.word === a.selectedWord,
        attempted: true,
      })
    }
  }
  const result = new Map<string, WordProgress>()
  for (const [date, words] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    for (const [word, day] of words) {
      const state = result.get(word) ?? { word, lastSeen: date, mistakes: 0, cleanDays: 0, needsReview: false }
      state.lastSeen = date
      if (day.wrong) { state.mistakes++; state.cleanDays = 0; state.needsReview = true }
      else if (day.clean && state.needsReview) { state.cleanDays++; if (state.cleanDays >= 2) state.needsReview = false }
      result.set(word, state)
    }
  }
  return [...result.values()]
}

function shuffled<T>(items: readonly T[], key: string): T[] {
  let seed = [...key].reduce((v, c) => (Math.imul(v, 31) + c.charCodeAt(0)) >>> 0, 1)
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 每日固定8词，轻松/适中/挑战共享前4/6/8词；优先复习但留出新词位置。 */
export function dailyWordPlan(date: string, history: readonly RoutineCheck[]): string[] {
  const known = new Set<string>(WORDS.map(w => w.word))
  const saved = history.find(c => !c.deleted && c.date === date && c.studyPlan?.length === 8 && new Set(c.studyPlan).size === 8 && c.studyPlan.every(w => known.has(w)))?.studyPlan
  if (saved) return [...saved]
  const progress = wordProgress(history.filter(c => c.date < date))
  const seen = new Map(progress.map(p => [p.word, p]))
  const pool = shuffled(WORDS.map(w => w.word), date)
  const review = progress.filter(p => p.needsReview).sort((a, b) => a.lastSeen.localeCompare(b.lastSeen) || b.mistakes - a.mistakes || a.word.localeCompare(b.word)).map(p => p.word)
  const fresh = pool.filter(w => !seen.has(w))
  const familiar = pool.filter(w => seen.has(w) && !seen.get(w)!.needsReview).sort((a, b) => seen.get(a)!.lastSeen.localeCompare(seen.get(b)!.lastSeen))
  const plan: string[] = []
  // 复习、新词交错，4张的轻松档也有新词。
  for (let i = 0; i < 4; i++) {
    if (review.length) plan.push(review.shift()!)
    if (fresh.length) plan.push(fresh.shift()!)
  }
  for (const word of [...fresh, ...review, ...familiar]) if (plan.length < 8 && !plan.includes(word)) plan.push(word)
  return plan
}

export function wordDeck(date: string, level: Difficulty, history: readonly RoutineCheck[] = [], fixedPlan?: readonly string[]) {
  const config = WORD_LEVELS.find(l => l.key === level)!
  return (fixedPlan ?? dailyWordPlan(date, history)).slice(0, config.count).map(word => {
    const correct = WORDS.find(w => w.word === word)!
    const others = shuffled(WORDS.filter(w => w.word !== word), `${date}:${word}:choices`).slice(0, config.choices - 1)
    return { correct, options: shuffled([correct, ...others], `${date}:${word}:order`) }
  })
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
