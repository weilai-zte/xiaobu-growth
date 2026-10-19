export const PRAISE_TEXT = '你太棒了！又完成了一小步。'
export const PRAISE_AUDIO = `${import.meta.env.BASE_URL}audio/well-done.mp3`
const KEY = 'xiaobu.sound.enabled'
let current: HTMLAudioElement | null = null

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'false' } catch { return true }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, String(enabled)) } catch { /* 存储被禁用时仍可暂停本次播放 */ }
  if (!enabled) current?.pause()
}

/** 在触摸事件内静音解锁；仅在记录成功后播放，适配 iOS 的媒体播放限制。 */
export function preparePraise(): () => Promise<boolean> {
  if (!soundEnabled() || typeof Audio === 'undefined') return async () => false
  current?.pause()
  const audio = new Audio(PRAISE_AUDIO)
  current = audio
  audio.preload = 'auto'
  audio.muted = true
  const ready = audio.play().then(() => {
    audio.pause()
    audio.currentTime = 0
  }).catch(() => { /* 保存成功后尝试播放；失败时文字提示仍保留 */ })
  return async () => {
    await ready
    if (!soundEnabled() || current !== audio) return false
    audio.muted = false
    audio.volume = 0.75
    try { await audio.play(); return true } catch { return false }
  }
}

export async function previewPraise(): Promise<boolean> {
  return preparePraise()()
}
