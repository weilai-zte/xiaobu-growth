import { it, expect, vi } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { createRepo, newId } from '../src/db/repo'
import { createSyncEngine, SYNC_KEYS } from '../src/db/sync'
import { buildExportBundle } from '../src/lib/transfer'

it('切换服务重置水位线，重拉保留连接码，备份不含连接码', async () => {
  const database = new GrowthDB(`sync-config-${newId()}`)
  const repo = createRepo(database)
  await repo.setSetting(SYNC_KEYS.familyKey, 'test-family-key-not-a-real-credential')
  const urls: string[] = []
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input))
    expect(new Headers(init?.headers).get('x-family-key')).toBe('test-family-key-not-a-real-credential')
    return new Response(JSON.stringify({ seq: 12, resetSeq: 0, tables: {} }), { status: 200 })
  })
  const engine = createSyncEngine({ repo, endpoint: 'https://old.example/api', fetchImpl, intervalMs: 600000 })
  try {
    await engine.start()
    await repo.setSetting(SYNC_KEYS.seq, 9999)
    await engine.setEndpoint('https://new.example/api/')
    expect(urls).toContain('https://new.example/api/sync?since=0')
    await engine.pullEverything()
    expect(await repo.getSetting(SYNC_KEYS.familyKey, '')).toBe('test-family-key-not-a-real-credential')
    expect((await buildExportBundle(database)).data.settings.some(row => row.key === SYNC_KEYS.familyKey)).toBe(false)
  } finally { engine.stop(); await database.delete() }
})
