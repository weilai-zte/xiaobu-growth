export const PRAISE_TEXT = '你太棒了！又完成了一小步。'
export const PRAISE_AUDIO = `${import.meta.env.BASE_URL}audio/well-done.mp3`
const KEY = 'xiaobu.sound.enabled'
let current: HTMLAudioElement | null = null
let speechVersion = 0
let previousPhrase = -1
const VOICE_KEY = 'xiaobu.bird.voice'
export interface VoiceSettings { voiceURI: string; rate: number; pitch: number }
export function getVoiceSettings(): VoiceSettings {
  let value: Partial<VoiceSettings> = {}
  try { value = JSON.parse(localStorage.getItem(VOICE_KEY) ?? '{}') ?? {} } catch { /* 使用明快默认值 */ }
  return { voiceURI: typeof value.voiceURI === 'string' ? value.voiceURI : '', rate: typeof value.rate === 'number' && value.rate >= 0.9 && value.rate <= 1.4 ? value.rate : 1.15, pitch: typeof value.pitch === 'number' && value.pitch >= 0.8 && value.pitch <= 1.6 ? value.pitch : 1.3 }
}
export function setVoiceSettings(value: VoiceSettings) { try { localStorage.setItem(VOICE_KEY, JSON.stringify(value)) } catch { /* 无存储权限时使用默认音色 */ } }
function announceBird(speaking: boolean, text = '') { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('xiaobu:bird-speech', { detail: { speaking, text } })) }
export function stopPraise() {
  speechVersion++; current?.pause()
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  announceBird(false)
}
export function praiseText(name: string, title: string): string {
  const endings = ['哇！你认真完成了这一小步，真不错！', '耶！星星收好啦，我为你高兴！', '你做到了！和小步击个掌吧！']
  const index = (previousPhrase + 1 + Math.floor(Math.random() * (endings.length - 1))) % endings.length
  previousPhrase = index
  return `${name}，你完成了${title}。${endings[index]}`
}

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'false' } catch { return true }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, String(enabled)) } catch { /* 存储被禁用时仍可暂停本次播放 */ }
  if (!enabled) stopPraise()
}

/** 在触摸事件内静音解锁；仅在记录成功后播放，适配 iOS 的媒体播放限制。 */
export function preparePraise(context?: { name: string; title: string; text?: string }): (() => Promise<boolean>) & { text?: string } {
  if (context) {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices()
    const text = context.text ?? praiseText(context.name, context.title)
    const version = ++speechVersion
    current?.pause()
    const play = async () => {
      if (!soundEnabled() || version !== speechVersion || typeof speechSynthesis === 'undefined') return false
      // 仅使用设备内置中文声音，避免将孩子姓名和打卡内容发送给网络语音服务。
      const settings = getVoiceSettings()
      const voices = speechSynthesis.getVoices().filter(v => v.localService && /^zh/i.test(v.lang))
      const voice = voices.find(v => v.voiceURI === settings.voiceURI) ?? voices.find(v => /美嘉|Meijia|婷婷|Tingting|晓晓|Xiaoxiao/i.test(v.name)) ?? voices[0]
      if (!voice) return false
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = settings.rate; utterance.pitch = settings.pitch
      return new Promise<boolean>(resolve => {
        let started = false
        let settled = false
        const timeout = setTimeout(() => { if (version === speechVersion) speechSynthesis.cancel(); finish(false) }, 30000)
        const finish = (ok: boolean) => { if (settled) return; settled = true; clearTimeout(timeout); if (version === speechVersion) announceBird(false, text); resolve(ok) }
        const start = () => { if (!started && version === speechVersion) { started = true; announceBird(true, text) } }
        utterance.onstart = start
        utterance.onend = () => finish(true); utterance.onerror = () => finish(false)
        try { start(); speechSynthesis.speak(utterance) } catch { finish(false) }
      })
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
