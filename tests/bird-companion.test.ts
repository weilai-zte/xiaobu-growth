import { describe, expect, it } from 'vitest'
import { birdLoot, birdInventory } from '../src/lib/birdCompanion'
import { getVoiceSettings, setVoiceSettings, preparePraise } from '../src/lib/praise'
import type { AdventureRun } from '../src/db/types'

const run: AdventureRun = { id: 'adventure:child:2026-10-19', childId: 'child', date: '2026-10-19', route: 'forest', scene: 2, material: 'leaf', bonusStars: 2, createdAt: '', updatedAt: '' }
describe('小鸟伙伴', () => {
  it('冒险玩具确定且重复同步不重复计数，无有效冒险不凭空获得', () => {
    expect(birdLoot(run)).toEqual(birdLoot({ ...run }))
    expect(birdInventory([run, run])).toHaveLength(1)
    expect(birdInventory([run, run])[0].count).toBe(1)
    expect(birdInventory([{ ...run, deleted: true }])).toEqual([])
  })
  it('音色设置有明快默认值并能保存，非法数值不会进入播放', () => {
    localStorage.clear()
    expect(getVoiceSettings().rate).toBeGreaterThan(1)
    setVoiceSettings({ voiceURI: 'local-voice', rate: 1.2, pitch: 1.4 })
    expect(getVoiceSettings()).toMatchObject({ voiceURI: 'local-voice', rate: 1.2, pitch: 1.4 })
    setVoiceSettings({ voiceURI: '', rate: 99, pitch: -5 })
    expect(getVoiceSettings().rate).toBeLessThanOrEqual(1.4)
    expect(getVoiceSettings().pitch).toBeGreaterThanOrEqual(0.8)
    localStorage.clear()
  })
  it('小鸟鼓励仍带姓名和具体任务', () => {
    expect(preparePraise({ name: '全全', title: '整理衣服' }).text).toContain('全全，你完成了整理衣服')
  })
})
