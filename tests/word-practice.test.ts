import { describe, expect, it, beforeEach } from 'vitest'
import { WORDS, dailyWordPlan, wordProgress, wordDeck } from '../src/lib/words'
import { repo } from '../src/db/repo'
import type { RoutineCheck, StudyAttempt } from '../src/db/types'
import { starBalance } from '../src/lib/rewards'
import { db } from '../src/db/db'
import { buildExportBundle, importBundle } from '../src/lib/transfer'
import { validateRoutineCheck } from '../src/lib/validate'

const attempt = (word: string, selectedWord = word, revealed = false): StudyAttempt => ({ id: crypto.randomUUID(), word, selectedWord, revealed, answeredAt: '2026-10-20T01:00:00.000Z' })
const record = (date: string, attempts: StudyAttempt[] = [], words: string[] = []): RoutineCheck => ({ id: date, childId: 'c', ruleId: 'r', date, status: 'done', studyWords: words, studyAttempts: attempts, createdAt: '', updatedAt: '' })

describe('每日新词和复习', () => {
  it('每天固定8词，三档共享前缀，次日优先避开已学词', () => {
    const today = dailyWordPlan('2026-10-20', [])
    expect(today).toHaveLength(8)
    expect(new Set(today).size).toBe(8)
    expect(dailyWordPlan('2026-10-20', [])).toEqual(today)
    const history = [record('2026-10-20', today.map(w => attempt(w)), today)]
    expect(dailyWordPlan('2026-10-21', history).every(w => !today.includes(w))).toBe(true)
    expect(wordDeck('2026-10-21', 'easy', history).map(q => q.correct.word)).toEqual(wordDeck('2026-10-21', 'hard', history).slice(0, 4).map(q => q.correct.word))
  })
  it('答错目标词进入候选，次日优先练，同时留出新词', () => {
    const history = [record('2026-10-20', [attempt('apple', 'cat'), attempt('apple')])]
    const pending = wordProgress(history).filter(w => w.needsReview)
    expect(pending.map(w => w.word)).toEqual(['apple'])
    const plan = dailyWordPlan('2026-10-21', history)
    expect(plan[0]).toBe('apple')
    expect(plan.filter(w => w !== 'apple')).toHaveLength(7)
    expect(pending[0].cleanDays).toBe(0)
  })
  it('同天重试、翻卡和重复组不解除复习；两个后续日期独立答对才解除', () => {
    const history = [record('2026-10-20', [attempt('apple', 'cat'), attempt('apple')])]
    history.push(record('2026-10-21', [attempt('apple', 'apple', true)]))
    expect(wordProgress(history)[0].needsReview).toBe(true)
    history.push(record('2026-10-22', [attempt('apple'), attempt('apple')]))
    expect(wordProgress(history)[0].cleanDays).toBe(1)
    history.push(record('2026-10-23', [attempt('apple')]))
    expect(wordProgress(history)[0].needsReview).toBe(false)
  })
  it('大量待复习词也保留一半新词，词库用完后轮换最久未练词', () => {
    const old = WORDS.slice(0, 8).map(w => attempt(w.word, w.word === 'cat' ? 'dog' : 'cat'))
    const plan = dailyWordPlan('2026-10-21', [record('2026-10-20', old)])
    expect(plan.slice(0, 4).filter(w => old.some(a => a.word === w))).toHaveLength(2)
    const history = WORDS.map((w, i) => record(i < 8 ? '2026-10-18' : '2026-10-20', [attempt(w.word)]))
    const exhausted = dailyWordPlan('2026-10-21', history)
    expect(new Set(exhausted).size).toBe(8)
    expect(exhausted.every(w => WORDS.slice(0, 8).some(item => item.word === w))).toBe(true)
  })
  it('完成记录中的studyWords不会遮掉独立答对的证据', () => {
    const history = [record('2026-10-20', [attempt('apple', 'cat')], ['apple']), record('2026-10-21', [attempt('apple')], ['apple']), record('2026-10-22', [attempt('apple')], ['apple'])]
    expect(wordProgress(history)[0]).toMatchObject({ cleanDays: 2, needsReview: false })
  })
  it('再次答错会重新进入候选；删除的历史不参与，未来记录不影响当天', () => {
    const history = [record('2026-10-20', [attempt('apple', 'cat')]), record('2026-10-21', [attempt('apple')]), record('2026-10-22', [attempt('apple')]), record('2026-10-23', [attempt('apple', 'cat')])]
    expect(wordProgress(history)[0].needsReview).toBe(true)
    expect(dailyWordPlan('2026-10-20', history)).toEqual(dailyWordPlan('2026-10-20', []))
    expect(wordProgress([{ ...history[0], deleted: true }])).toHaveLength(0)
  })
  it('保留当天计划，不因答题改变；旧学习记录也能避免重复', () => {
    const plan = dailyWordPlan('2026-10-20', [])
    const saved = { ...record('2026-10-20', [attempt(plan[0], 'cat')]), studyPlan: plan }
    expect(dailyWordPlan('2026-10-20', [saved])).toEqual(plan)
    const next = dailyWordPlan('2026-10-21', [record('2026-10-20', [], plan)])
    expect(next.every(w => !plan.includes(w))).toBe(true)
  })
})

beforeEach(async () => { await repo.clearAll(); repo.setWriteHook((entity, row) => repo.enqueue(entity, row)) })
describe('学习记录持久化与兼容', () => {
  async function setup() {
    const child = await repo.createProfile({ name: '练习测试' })
    await repo.ensureHabitPlan(child.id)
    const rule = (await repo.listRules(child.id)).find(r => r.habitKey === 'picture_words')!
    return { child, rule }
  }
  it('即时保存错词并入同步队列，未完成不发星，重复调用不重复记尝试', async () => {
    const { child, rule } = await setup()
    const plan = await repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')
    const a = attempt(plan[0], plan[1])
    await repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', a)
    await repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', a)
    const checks = await repo.listChecks(child.id)
    expect(checks[0].studyAttempts).toEqual([a])
    expect(checks[0].status).toBe('partial')
    expect(starBalance([], checks, []).earned).toBe(0)
    expect((await repo.listOutbox()).find(e => e.entity === 'routineChecks')?.payload.studyAttempts).toEqual([a])
    expect(await repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')).toEqual(plan)
  })
  it('完成和后续练习保留记录和星数，第二个孩子不会继承学习历史', async () => {
    const { child, rule } = await setup()
    const plan = await repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')
    await repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', attempt(plan[0], plan[1]))
    await repo.setCheck(child.id, rule.id, '2026-10-20', 'done', null, { studyLevel: 'easy', studyWords: plan.slice(0, 4) })
    await repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', attempt(plan[1]))
    const checks = await repo.listChecks(child.id)
    expect(checks).toHaveLength(1)
    expect(checks[0].studyAttempts).toHaveLength(2)
    expect(checks[0].studyPlan).toEqual(plan)
    expect(checks[0].status).toBe('done')
    expect(starBalance([], checks, []).earned).toBe(2)
    const other = await repo.createProfile({ name: '另一孩子' })
    await repo.ensureHabitPlan(other.id)
    const otherRule = (await repo.listRules(other.id)).find(r => r.habitKey === 'picture_words')!
    expect(await repo.ensureStudyPlan(other.id, otherRule.id, '2026-10-21')).toEqual(dailyWordPlan('2026-10-21', []))
  })
  it('翻卡提示立即保存，重选难度或重进页面后答对仍不算独立掌握', async () => {
    const { child, rule } = await setup()
    const plan = await repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')
    await repo.recordStudyHint(child.id, rule.id, '2026-10-20', plan[0])
    await repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', attempt(plan[0]))
    const [check] = await repo.listChecks(child.id)
    expect(check.studyHints).toEqual([plan[0]])
    expect(check.studyAttempts?.[0].revealed).toBe(true)
  })
  it('只准备题目不锁定奖励，首次完成时使用当前星数，以后仍保留快照', async () => {
    const { child, rule } = await setup()
    const plan = await repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')
    await repo.updateRule(rule.id, { rewardStars: 1 })
    await repo.setCheck(child.id, rule.id, '2026-10-20', 'done', null, { studyWords: plan.slice(0, 4) })
    expect((await repo.listChecks(child.id))[0].rewardStars).toBe(1)
    await repo.updateRule(rule.id, { rewardStars: 2 })
    await repo.setCheck(child.id, rule.id, '2026-10-20', 'done')
    expect((await repo.listChecks(child.id))[0].rewardStars).toBe(1)
  })
  it('JSON备份恢复保留计划与错词，不影响旧版记录', async () => {
    const { child, rule } = await setup()
    const plan = await repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')
    await repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', attempt(plan[0], plan[1]))
    const original = await repo.listChecks(child.id)
    const bundle = await buildExportBundle(db)
    await repo.clearAll()
    const report = await importBundle(db, bundle, 'merge')
    expect(report.skippedInvalid).toBe(0)
    expect(await repo.listChecks(child.id)).toEqual(original)
    expect(validateRoutineCheck(record('2026-10-20'))).toMatchObject({ ok: true })
  })
  it('拒绝重复计划、非法尝试和不属于计划的词', async () => {
    const { child, rule } = await setup()
    const plan = await repo.ensureStudyPlan(child.id, rule.id, '2026-10-20')
    await expect(repo.recordStudyAttempt(child.id, rule.id, '2026-10-20', attempt('unknownword'))).rejects.toThrow()
    expect(validateRoutineCheck({ ...record('2026-10-20'), studyPlan: [plan[0], plan[0]] }).ok).toBe(false)
    expect(validateRoutineCheck({ ...record('2026-10-20'), studyAttempts: [{ ...attempt(plan[0]), revealed: 'yes' } as never] }).ok).toBe(false)
  })
})
