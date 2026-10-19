export const PRAISE_TEXT = '你太棒了！又完成了一小步。'
export const PRAISE_AUDIO = `${import.meta.env.BASE_URL}audio/well-done.mp3`
const KEY = 'xiaobu.sound.enabled'
let current: HTMLAudioElement | null = null
let speechVersion = 0
let previousPhrase = -1
export function praiseText(name: string, title: string): string {
  const endings = ['你认真完成了这一小步，真不错！', '谢谢你的努力，星星收好啦！', '你做到了，为自己高兴一下吧！']
  const index = (previousPhrase + 1 + Math.floor(Math.random() * (endings.length - 1))) % endings.length
  previousPhrase = index
  return `${name}，你完成了${title}。${endings[index]}`
}

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'false' } catch { return true }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, String(enabled)) } catch { /* 存储被禁用时仍可暂停本次播放 */ }
  if (!enabled) { current?.pause(); speechVersion++; if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }
}

/** 在触摸事件内静音解锁；仅在记录成功后播放，适配 iOS 的媒体播放限制。 */
export function preparePraise(context?: { name: string; title: string }): (() => Promise<boolean>) & { text?: string } {
  if (context) {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices()
    const text = praiseText(context.name, context.title)
    const version = ++speechVersion
    current?.pause()
    const play = async () => {
      if (!soundEnabled() || version !== speechVersion || typeof speechSynthesis === 'undefined') return false
      // 仅使用设备内置中文声音，避免将孩子姓名和打卡内容发送给网络语音服务。
      const voice = speechSynthesis.getVoices().find(v => v.localService && /^zh/i.test(v.lang))
      if (!voice) return false
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.9
      return new Promise<boolean>(resolve => { utterance.onend = () => resolve(true); utterance.onerror = () => resolve(false); speechSynthesis.speak(utterance) })
    }
    return Object.assign(play, { text })
  }
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
