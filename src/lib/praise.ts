import {chooseBirdCall,type BirdMood} from './birdSounds'
export const PRAISE_TEXT = '你太棒了！又完成了一小步。'
const KEY = 'xiaobu.sound.enabled'
let current: HTMLAudioElement | null = null
let previousPhrase = -1
function announceBird(speaking: boolean, text = '') { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('xiaobu:bird-speech', { detail: { speaking, text } })) }
export function stopPraise() {
  current?.pause(); current = null
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
export function preparePraise(context?: { name: string; title: string; text?: string; mood?:BirdMood }): (() => Promise<boolean>) & { text?: string } {
  const text = context?.text ?? (context ? praiseText(context.name, context.title) : PRAISE_TEXT)
  return Object.assign(prepareBirdCall(text,context?.mood??(context?.title?'celebrate':undefined)), {text})
}

export async function previewPraise(): Promise<boolean> { return preparePraise()() }

/** 真实短鸣叫；每次互动替换上一段，鼓励内容仍以文字呈现。 */
function prepareBirdCall(text: string,mood?:BirdMood): () => Promise<boolean> {
  stopPraise()
  if (!soundEnabled() || typeof Audio === 'undefined') return async () => false
  const audio = new Audio(chooseBirdCall(mood).src)
  current = audio
  audio.preload = 'auto'; audio.muted = true; audio.volume = .55
  const finish = () => { if (current === audio) { current = null; announceBird(false, text) } }
  audio.onended = finish; audio.onerror = finish
  const ready = audio.play().then(() => { if (current === audio) { audio.pause(); audio.currentTime = 0 } }).catch(() => {})
  return async () => {
    await ready
    if (current !== audio || !soundEnabled()) return false
    audio.muted = false
    announceBird(true, text)
    try { await audio.play(); return true } catch { finish(); return false }
  }
}
