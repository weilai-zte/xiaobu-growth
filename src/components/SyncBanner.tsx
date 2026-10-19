import { useSync } from '../app/SyncProvider'

/**
 * 同步状态横幅。
 * 只在「出了问题」或「还有改动没上去」时出现，正常的同步过程不打扰用户。
 */
export function SyncBanner() {
  const { snapshot, engine } = useSync()
  const { status, lastError, pending } = snapshot

  if (status === 'syncing' && pending === 0) return null
  if (status === 'idle' && pending === 0) return null

  const isProblem = status === 'error' || status === 'offline'
  const title =
    status === 'offline'
      ? '现在没有网络，改动先存在这台设备上'
      : status === 'error'
        ? '同步没有成功'
        : '正在同步'

  const detail =
    status === 'offline'
      ? '联网后会自动补传，不需要重新录入。'
      : status === 'error'
        ? (lastError ?? '请稍后重试。')
        : pending > 0
          ? `还有 ${pending} 条改动正在上传。`
          : ''

  return (
    <div
      className={`sync-banner ${isProblem ? 'sync-banner-problem' : 'sync-banner-info'}`}
      role={isProblem ? 'alert' : 'status'}
      aria-live={isProblem ? 'assertive' : 'polite'}
    >
      <div className="sync-banner-text">
        <strong>{title}</strong>
        {detail && <span className="sync-banner-detail">{detail}</span>}
        {pending > 0 && status !== 'idle' && (
          <span className="sync-banner-detail">待同步 {pending} 条</span>
        )}
      </div>
      {isProblem && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            void engine.syncNow()
          }}
        >
          重试
        </button>
      )}
    </div>
  )
}
