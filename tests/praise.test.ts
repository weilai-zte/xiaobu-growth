import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRAISE_AUDIO, preparePraise, setSoundEnabled } from '../src/lib/praise'

let audios: Array<{ muted: boolean; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; currentTime: number; volume: number; preload: string }>
beforeEach(() => {
  localStorage.clear()
  audios = []
  vi.stubGlobal('Audio', vi.fn(function () {
    const audio = { muted: false, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), currentTime: 0, volume: 1, preload: '' }
    audios.push(audio)
    return audio
  }))
})
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe('打卡语音', () => {
  it('用户点击时只静音解锁，确认成功后才出声', async () => {
    const play = preparePraise()
    expect(Audio).toHaveBeenCalledWith(PRAISE_AUDIO)
    expect(audios[0].muted).toBe(true)
    await play()
    expect(audios[0].muted).toBe(false)
    expect(audios[0].play).toHaveBeenCalledTimes(2)
  })
  it('关闭声音后不创建播放器，关闭时停止现有音频', async () => {
    preparePraise()
    setSoundEnabled(false)
    expect(audios[0].pause).toHaveBeenCalled()
    expect(await preparePraise()()).toBe(false)
    expect(audios).toHaveLength(1)
  })
  it('浏览器禁止播放时返回失败，不影响打卡记录', async () => {
    const play = preparePraise()
    audios[0].play.mockRejectedValue(new Error('NotAllowedError'))
    expect(await play()).toBe(false)
  })
})
