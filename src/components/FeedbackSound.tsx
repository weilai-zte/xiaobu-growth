import { useEffect, useState } from 'react'
import { setSoundEnabled, soundEnabled } from '../lib/praise'
import { preparePraise, getVoiceSettings, setVoiceSettings, stopPraise } from '../lib/praise'
import { useApp } from '../app/AppProvider'

export function FeedbackSound() {
  const { profile } = useApp()
  const [enabled, setEnabled] = useState(soundEnabled)
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useState(getVoiceSettings)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const refresh = () => setVoices(speechSynthesis.getVoices().filter(v => v.localService && /^zh/i.test(v.lang)))
    refresh(); speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])
  function change(value: typeof settings) { stopPraise(); setVoiceSettings(value); setSettings(getVoiceSettings()) }
  return <div className="feedback-sound">
    <div className="row"><button type="button" className="btn btn-sm" aria-pressed={enabled} onClick={() => {
      setSoundEnabled(!enabled); setEnabled(!enabled)
    }}>声音反馈：{enabled ? '开' : '关'}</button>
      <button type="button" className="btn btn-sm" disabled={!enabled} onClick={async () => {
        const play = preparePraise({ name: profile?.name ?? '全全', title: '今天的小任务' })
        setMessage(play.text ?? '')
        if (!await play()) setMessage(`${play.text} 暂时无法播放，请检查音量及设备中文语音后重试。`)
      }}>试听鼓励</button></div>
    <details><summary>给小步换个声音</summary><div className="bird-voice-controls">
      <label>设备中文音色<select value={settings.voiceURI} onChange={e => change({ ...settings, voiceURI: e.target.value })}><option value="">自动选择本机中文音色</option>{voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}（{v.lang}）</option>)}</select></label>
      <div className="row">{[{ name: '活力小鸟', rate: 1.2, pitch: 1.45 }, { name: '明快伙伴', rate: 1.15, pitch: 1.15 }, { name: '温柔朋友', rate: 1.05, pitch: 1.1 }].map(preset => <button className="btn btn-sm" type="button" key={preset.name} aria-pressed={settings.rate === preset.rate && settings.pitch === preset.pitch} onClick={() => change({ ...settings, rate: preset.rate, pitch: preset.pitch })}>{preset.name}</button>)}</div>
      <label>语速<input type="range" min="0.9" max="1.4" step="0.05" value={settings.rate} onChange={e => change({ ...settings, rate: Number(e.target.value) })} />{settings.rate.toFixed(2)}倍</label>
      <button className="btn btn-sm" type="button" onClick={stopPraise}>停止声音</button>
      <small>{voices.length > 1 ? '选择音色后点「试听鼓励」比较。' : '本机可选中文音色较少；可先切换小鸟风格、调快语速。'}音色设置只保存在这台设备，因为手机和电脑拥有的声音不同。</small>
    </div></details>
    <small>图卡完成后，随机朗读带名字的鼓励。使用设备内置中文声音，不上传姓名；设备不支持时仍显示文字。</small>
    {message && <p role="status">{message}</p>}
  </div>
}
