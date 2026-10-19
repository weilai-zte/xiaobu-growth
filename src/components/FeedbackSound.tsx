import { useState } from 'react'
import { setSoundEnabled, soundEnabled } from '../lib/praise'
import { preparePraise } from '../lib/praise'
import { useApp } from '../app/AppProvider'

export function FeedbackSound() {
  const { profile } = useApp()
  const [enabled, setEnabled] = useState(soundEnabled)
  const [message, setMessage] = useState('')
  return <div className="feedback-sound">
    <div className="row"><button type="button" className="btn btn-sm" aria-pressed={enabled} onClick={() => {
      setSoundEnabled(!enabled); setEnabled(!enabled)
    }}>声音反馈：{enabled ? '开' : '关'}</button>
      <button type="button" className="btn btn-sm" disabled={!enabled} onClick={async () => {
        const play = preparePraise({ name: profile?.name ?? '全全', title: '今天的小任务' })
        setMessage(play.text ?? '')
        if (!await play()) setMessage(`${play.text} 暂时无法播放，请检查音量及设备中文语音后重试。`)
      }}>试听鼓励</button></div>
    <small>图卡完成后，随机朗读带名字的鼓励。使用设备内置中文声音，不上传姓名；设备不支持时仍显示文字。</small>
    {message && <p role="status">{message}</p>}
  </div>
}
