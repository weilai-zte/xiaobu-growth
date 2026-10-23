import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { SETTINGS_KEYS } from '../src/lib/settings'
import { adventureDay } from '../src/lib/adventure'
import { WORDS, wordDeck } from '../src/lib/words'
import { starBalance } from '../src/lib/rewards'
import { readFile } from 'node:fs/promises'

beforeEach(async () => { await repo.clearAll(); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
describe('学习打卡', () => {
  it('家长自建的学习图卡显示说明和步骤，不误跳到英语练习', async () => {
    const child = await repo.createProfile({ name: '全全' })
    await repo.ensureHabitPlan(child.id)
    await repo.createRule({ childId: child.id, title: '画一只小鸟', category: 'study', picture: 'paint', description: '选三种颜色', rewardStars: 1, steps: ['准备画笔'], trigger: 'anytime' })
    await repo.setSetting(SETTINGS_KEYS.childView, true)
    window.location.hash = '#/child'
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /学习打卡/ }))
    await user.click(await screen.findByRole('button', { name: '画一只小鸟，查看步骤，完成得1星' }))
    expect(screen.getByText('选三种颜色')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: '准备画笔' }))
    await user.click(screen.getByRole('button', { name: '我做到了，收下1星' }))
    await waitFor(async () => expect((await repo.listChecks(child.id))[0]?.rewardStars).toBe(1))
    expect(window.location.hash).toBe('#/child')
  })
  it('三档题量和选项正确，题目不重复、答案不缺失，每个词有本地音频', async () => {
    for (const [level, count, choices] of [['easy', 4, 2], ['medium', 6, 3], ['hard', 8, 4]] as const) {
      const deck = wordDeck('2026-10-20', level)
      expect(deck).toEqual(wordDeck('2026-10-20', level))
      expect(new Set(deck.map(q => q.correct.word)).size).toBe(count)
      for (const q of deck) { expect(new Set(q.options.map(o => o.word)).size).toBe(choices); expect(q.options).toContain(q.correct) }
    }
    for (const word of WORDS) expect((await readFile(`public/audio/words/${word.word}.mp3`)).byteLength).toBeGreaterThan(1000)
  })
  it('没做完就离开，重新进入仍保留错词与同一份题目', async () => {
    const child = await repo.createProfile({ name: '复习测试' })
    await repo.ensureHabitPlan(child.id)
    window.location.hash = '#/child/study'
    const user = userEvent.setup()
    const first = render(<App />)
    const deck = wordDeck(adventureDay(), 'easy')
    const wrong = deck[0].options.find(o => o.word !== deck[0].correct.word)!
    await user.click(await screen.findByRole('button', { name: `选择 ${wrong.word}` }))
    await screen.findByText(/复习小篮子 · 1个词/)
    first.unmount()
    render(<App />)
    await user.click(await screen.findByText(/复习小篮子 · 1个词/))
    expect(await screen.findByRole('button', { name: `复习 ${deck[0].correct.word} 发音` })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: `选择 ${wrong.word}` })).toBeInTheDocument()
    const checks = await repo.listChecks(child.id)
    expect(checks[0].status).toBe('partial')
    expect(starBalance([], checks, []).earned).toBe(0)
  })
  it('翻卡后重选当前难度仍保留提示事实', async () => {
    const child = await repo.createProfile({ name: '提示测试' })
    await repo.ensureHabitPlan(child.id)
    window.location.hash = '#/child/study'
    const user = userEvent.setup()
    render(<App />)
    const deck = wordDeck(adventureDay(), 'easy')
    await user.click(await screen.findByRole('button', { name: '翻卡看一眼答案' }))
    await screen.findByRole('button', { name: '收起答案，继续看图' })
    await user.click(screen.getByRole('button', { name: /轻松看看/ }))
    await user.click(await screen.findByRole('button', { name: `选择 ${deck[0].correct.word}` }))
    await waitFor(async () => expect((await repo.listChecks(child.id))[0].studyAttempts?.[0].revealed).toBe(true))
  })
  it('先练完一组才获2星，发音不提交答案，重复练习不重复计分', async () => {
    const child = await repo.createProfile({ name: '全全' })
    await repo.ensureHabitPlan(child.id)
    await repo.setSetting(SETTINGS_KEYS.childView, true)
    window.location.hash = '#/child/study'
    const user = userEvent.setup()
    render(<App />)
    const deck = wordDeck(adventureDay(), 'easy')
    await screen.findByRole('button', { name: '翻卡看一眼答案' })
    await user.click(screen.getByRole('button', { name: `听 ${deck[0].correct.word} 发音` }))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    expect((await repo.listChecks(child.id)).filter(c => c.status === 'done')).toHaveLength(0)
    const wrong = deck[0].options.find(o => o.word !== deck[0].correct.word)!
    await user.click(screen.getByRole('button', { name: `选择 ${wrong.word}` }))
    expect(await screen.findByRole('button', { name: '下一张图片' })).toBeDisabled()
    expect((await repo.listChecks(child.id))[0].studyAttempts?.[0].word).toBe(deck[0].correct.word)
    await user.click(await screen.findByText(/复习小篮子 · 1个词/))
    expect(await screen.findByRole('button', { name: `复习 ${deck[0].correct.word} 发音` })).toBeInTheDocument()
    for (let i = 0; i < deck.length; i++) {
      await user.click(await screen.findByRole('button', { name: `选择 ${deck[i].correct.word}` }))
      await screen.findByText(`找到了！${deck[i].correct.word}，${deck[i].correct.cn}。`)
      if (i < deck.length - 1) await user.click(screen.getByRole('button', { name: '下一张图片' }))
    }
    expect((await repo.listChecks(child.id)).filter(c => c.status === 'done')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '完成这一组，收下2星' }))
    await waitFor(async () => expect((await repo.listChecks(child.id)).filter(c => c.status === 'done')).toHaveLength(1))
    const check = (await repo.listChecks(child.id))[0]
    expect(check.rewardStars).toBe(2)
    expect(check.studyWords).toHaveLength(4)
    await repo.setCheck(child.id, check.ruleId, check.date, 'done', null, { studyLevel: 'easy', studyWords: check.studyWords })
    expect(starBalance([], await repo.listChecks(child.id), []).earned).toBe(2)
    expect(await repo.listChecks(child.id)).toHaveLength(1)
  })
})
