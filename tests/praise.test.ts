import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRAISE_AUDIO, preparePraise, setSoundEnabled, praiseText } from '../src/lib/praise'

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
  it('鼓励带名字和具体内容，连续两句不相同', () => {
    const first = praiseText('全全', '穿好拖鞋')
    expect(first).toContain('全全，你完成了穿好拖鞋')
    expect(praiseText('全全', '穿好拖鞋')).not.toBe(first)
  })
  it('具名语音仅在成功回调调用后播放，并拒绝网络声音', async () => {
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', { getVoices: () => [{ lang: 'zh-CN', localService: false }], speak, cancel: vi.fn() })
    const play = preparePraise({ name: '全全', title: '跳绳' })
    expect(speak).not.toHaveBeenCalled()
    expect(await play()).toBe(false)
    expect(speak).not.toHaveBeenCalled()
    expect(play.text).toContain('跳绳')
  })
  it('本机指定音色和明快语速生效，开始和结束通知小鸟', async () => {
    const events: boolean[] = []
    const listener = (event: Event) => events.push((event as CustomEvent).detail.speaking)
    window.addEventListener('xiaobu:bird-speech', listener)
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
    const voice = { name: '本地中文', voiceURI: 'bird', lang: 'zh-CN', localService: true }
    let utterance: SpeechSynthesisUtterance | undefined
    vi.stubGlobal('speechSynthesis', { getVoices: () => [voice], cancel: vi.fn(), speak: vi.fn(u => { utterance = u; u.onstart(); u.onend() }) })
    localStorage.setItem('xiaobu.bird.voice', JSON.stringify({ voiceURI: 'bird', rate: 1.2, pitch: 1.4 }))
    expect(await preparePraise({ name: '全全', title: '慢慢吃饭' })()).toBe(true)
    expect(utterance).toMatchObject({ voice, rate: 1.2, pitch: 1.4 })
    expect(events).toEqual([true, false])
    window.removeEventListener('xiaobu:bird-speech', listener)
  })
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
