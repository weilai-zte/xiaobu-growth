import { useEffect, useId, useRef, useState } from 'react'

/** 按压签约仪式，不读取或保存生物指纹。 */
export function FingerprintSign({ name, disabled = false, onComplete }: { name: string; disabled?: boolean; onComplete: () => Promise<unknown> }) {
  const hintId = useId()
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const pending = useRef(false)
  const [holding, setHolding] = useState(false)
  const [saving, setSaving] = useState(false)
  function cancel() { clearTimeout(timer.current); timer.current = undefined; setHolding(false) }
  async function complete() {
    if (disabled || pending.current) return
    cancel(); pending.current = true; setSaving(true)
    try { await onComplete() } finally { pending.current = false; setSaving(false) }
  }
  function begin() {
    if (disabled || pending.current || timer.current) return
    setHolding(true)
    timer.current = setTimeout(() => { void complete() }, 1000)
  }
  useEffect(() => {
    const stop = () => cancel()
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => { clearTimeout(timer.current); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop) }
  }, [])
  useEffect(() => { if (disabled) cancel() }, [disabled])
  return <div className="fingerprint-sign">
    <button type="button" className={`fingerprint-button ${holding ? 'holding' : ''}`} disabled={disabled || saving} aria-label={`${name}按指纹，长按1秒签订公约`} aria-describedby={hintId}
      onPointerDown={e => { if (e.button === 0) { e.preventDefault(); begin() } }} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel} onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) begin() } if (e.key === 'Escape') cancel() }}
      onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cancel() } }}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="fingerprint-track" cx="50" cy="50" r="44" /><circle className="fingerprint-ring" cx="50" cy="50" r="44" /><g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M29 53c0-30 42-30 42 0M36 55c0-21 28-21 28 0 0 10-2 17-5 23M43 57c0-14 14-14 14 0 0 8-1 14-3 20M50 57c0 9-1 15-3 21M29 61c0 5-1 9-3 13M36 63c0 7-1 12-3 16M43 65c0 6-1 11-2 15M71 61c0 6-1 10-2 14" /></g></svg>
      <strong>{name}按指纹</strong><span>{saving ? '正在收好签名…' : holding ? '保持按住…' : '长按 1 秒'}</span>
    </button>
    <p id={hintId} className="muted">我读懂了，愿意一起做到。松开可以重来。</p>
    <details className="fingerprint-alternative"><summary>不方便长按？</summary><p>也可以聚焦指纹，按住空格或回车 1 秒。</p><button type="button" className="btn" disabled={disabled || saving} onClick={() => void complete()}>我已读懂，确认签订</button></details>
  </div>
}
