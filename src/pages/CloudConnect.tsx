import { useState } from 'react'
import { useApp } from '../app/AppProvider'
import { useSync } from '../app/SyncProvider'
import { repo } from '../db/repo'
import { DEFAULT_ENDPOINT, SYNC_KEYS } from '../db/sync'
import { Card, Errors, TextField } from '../components/ui'

export function CloudConnect() {
  const { refreshProfile } = useApp()
  const { engine, snapshot } = useSync()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Card title="连接全全的成长小屋">
    <p>手机和电脑使用同一个家庭连接码，就能看到同一份记录。无需注册不同用户。</p>
    {!DEFAULT_ENDPOINT ? <p role="status">静态页面已准备好，云端数据库尚未完成部署。连接后就能使用原有档案和记录。</p> :
      <form onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError('')
        try {
          await repo.setSetting(SYNC_KEYS.familyKey, key.trim())
          await repo.setSetting('ui.childView', true)
          await engine.setEndpoint(DEFAULT_ENDPOINT)
          const result = engine.getSnapshot()
          if (result.status === 'error' || result.status === 'offline') throw new Error(result.lastError || '连接失败，请重试')
          refreshProfile()
        } catch (err) { setError(err instanceof Error ? err.message : '连接失败，请重试') }
        finally { setBusy(false) }
      }}>
        <TextField type="password" label="家庭连接码" value={key} onChange={setKey} hint="由家长保存，在每台新设备上输入一次。不要发到公开网站。" />
        <button type="submit" className="btn btn-primary" disabled={busy || !key.trim()}>{busy ? '正在连接…' : '连接家庭数据'}</button>
      </form>}
    <Errors errors={error ? [error] : snapshot.lastError && DEFAULT_ENDPOINT ? [snapshot.lastError] : []} />
  </Card>
}
