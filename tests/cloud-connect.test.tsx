import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFile } from 'node:fs/promises'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { SYNC_KEYS } from '../src/db/sync'

vi.mock('../src/db/sync', async importOriginal => ({
  ...await importOriginal<typeof import('../src/db/sync')>(),
  IS_GITHUB_PAGES: true,
  DEFAULT_ENDPOINT: 'https://vhetgqujluiofywbjibt.supabase.co/functions/v1/xiaobu-sync',
}))

describe.skipIf(process.env.XB_CLOUD_VERIFY !== '1')('线上首次连接界面', () => {
  it('空设备输入家庭连接码后进入原有儿童档案，不要求重建档案', async () => {
    const file = await readFile('data/家庭连接码.txt', 'utf8')
    const key = file.match(/家庭连接码：([^\r\n]+)/)?.[1]
    if (!key) throw new Error('缺少本机家庭连接码')
    await repo.clearAll()
    await repo.setSetting(SYNC_KEYS.endpoint, 'https://vhetgqujluiofywbjibt.supabase.co/functions/v1/xiaobu-sync')
    window.location.hash = '#/child'
    const user = userEvent.setup()
    const view = render(<App />)
    try {
      const input = await screen.findByLabelText('家庭连接码', {}, { timeout: 20000 })
      await user.type(input, key)
      await user.click(screen.getByRole('button', { name: '连接家庭数据' }))
      expect(await screen.findByRole('heading', { name: /全全.*出发/ }, { timeout: 20000 })).toBeInTheDocument()
      expect(await repo.listProfiles()).toHaveLength(1)
      expect(await repo.getSetting('ui.childView', false)).toBe(true)
      expect(screen.queryByRole('button', { name: '试听鼓励' })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: '家长' })).toBeInTheDocument()
      expect(screen.queryByText('先建立孩子档案')).not.toBeInTheDocument()
    } finally { view.unmount(); await repo.clearAll() }
  }, 60000)
})
