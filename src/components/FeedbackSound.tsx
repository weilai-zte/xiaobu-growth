import { useState } from 'react'
import { PRAISE_TEXT, previewPraise, setSoundEnabled, soundEnabled } from '../lib/praise'

export function FeedbackSound() {
  const [enabled, setEnabled] = useState(soundEnabled)
  const [message, setMessage] = useState('')
  return <div className="feedback-sound">
    <div className="row"><button type="button" className="btn btn-sm" aria-pressed={enabled} onClick={() => {
      setSoundEnabled(!enabled); setEnabled(!enabled)
    }}>声音反馈：{enabled ? '开' : '关'}</button>
      <button type="button" className="btn btn-sm" disabled={!enabled} onClick={async () => {
        setMessage(await previewPraise() ? '' : '暂时无法播放声音，可检查手机音量后再试。')
      }}>试听鼓励</button></div>
    <small>打卡成功后会说：“{PRAISE_TEXT}”</small>
    {message && <p role="status">{message}</p>}
  </div>
}
