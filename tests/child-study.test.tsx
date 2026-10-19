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
  it('三档题量和选项正确，题目不重复、答案不缺失，每个词有本地音频', async () => {
    for (const [level, count, choices] of [['easy', 4, 2], ['medium', 6, 3], ['hard', 8, 4]] as const) {
      const deck = wordDeck('2026-10-20', level)
      expect(deck).toEqual(wordDeck('2026-10-20', level))
      expect(new Set(deck.map(q => q.correct.word)).size).toBe(count)
      for (const q of deck) { expect(new Set(q.options.map(o => o.word)).size).toBe(choices); expect(q.options).toContain(q.correct) }
    }
    for (const word of WORDS) expect((await readFile(`public/audio/words/${word.word}.mp3`)).byteLength).toBeGreaterThan(1000)
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
    expect(await repo.listChecks(child.id)).toHaveLength(0)
    const wrong = deck[0].options.find(o => o.word !== deck[0].correct.word)!
    await user.click(screen.getByRole('button', { name: `选择 ${wrong.word}` }))
    expect(screen.getByRole('button', { name: '下一张图片' })).toBeDisabled()
    for (let i = 0; i < deck.length; i++) {
      await user.click(screen.getByRole('button', { name: `选择 ${deck[i].correct.word}` }))
      if (i < deck.length - 1) await user.click(screen.getByRole('button', { name: '下一张图片' }))
    }
    expect(await repo.listChecks(child.id)).toHaveLength(0)
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
