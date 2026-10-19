/** 实际云端验证；只输出状态和计数，不输出家庭记录或连接码。 */
import { readFile } from 'node:fs/promises'

const endpoint = 'https://vhetgqujluiofywbjibt.supabase.co/functions/v1/xiaobu-sync'
const secretFile = await readFile(new URL('../data/家庭连接码.txt', import.meta.url), 'utf8')
const key = secretFile.match(/家庭连接码：([^\r\n]+)/)?.[1]
if (!key) throw new Error('请先准备本机的家庭连接码文件')
const counts = data => Object.fromEntries(Object.entries(data.tables ?? {}).map(([entity, rows]) => [entity, rows.filter(r => !r.deleted).length]))
async function request(path, options = {}, authenticated = true) {
  return fetch(`${endpoint}${path}`, { ...options, signal: AbortSignal.timeout(20000), headers: {
    'content-type': 'application/json', ...(authenticated ? { 'x-family-key': key } : {}), ...options.headers,
  } })
}
const denied = await request('/sync?since=0', {}, false)
if (denied.status !== 401) throw new Error('未携带家庭连接码的访问没有被拒绝')
let response = await request('/sync?since=0')
if (!response.ok) throw new Error(`云端连接失败：${response.status} ${await response.text()}`)
let cloud = await response.json()
if (process.argv.includes('--migrate')) {
  if (Object.values(counts(cloud)).some(n => n > 0)) throw new Error('云端已有记录，停止初次迁移以免覆盖')
  const source = await fetch('http://localhost:8788/api/sync?since=0', { signal: AbortSignal.timeout(10000) })
  if (!source.ok) throw new Error('无法读取原有本地数据服务')
  const local = await source.json()
  response = await request('/sync', { method: 'POST', body: JSON.stringify({ since: 0, changes: local.tables }) })
  if (!response.ok) throw new Error(`迁移失败：${await response.text()}`)
  cloud = await response.json()
  const expected = counts(local)
  const actual = counts(cloud)
  for (const [entity, total] of Object.entries(expected)) if (actual[entity] !== total) throw new Error(`${entity} 迁移数量不一致`)
  console.log(JSON.stringify({ migration: 'verified', counts: actual }))
}
// 两次独立的无状态请求，确认服务端持久数据可在新设备读取。
const a = await (await request('/sync?since=0')).json()
const b = await (await request('/sync?since=0')).json()
if (JSON.stringify(a.tables) !== JSON.stringify(b.tables)) throw new Error('两台设备读取的数据不一致')
console.log(JSON.stringify({ auth: 'verified', independentReads: 'verified', seq: b.seq, counts: counts(b) }))
