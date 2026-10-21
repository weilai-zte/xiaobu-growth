import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const migration = readFileSync('supabase/migrations/20261021_launch_compat.sql', 'utf8')
const acceptance = readFileSync('supabase/tests/launch_compat.sql', 'utf8')
const edge = readFileSync('supabase/functions/xiaobu-sync/index.ts', 'utf8')

// 仅在内存中替换占位符，使用虚构测试密钥；不读取家庭连接码或环境密钥。
function edgeHarness() {
  const fixtureKey = 'fixture-only-family-key-for-unit-tests'
  const digest = createHash('sha256').update(fixtureKey).digest('hex')
  const rpc = vi.fn(async () => new Response(JSON.stringify({ account: { id: 'bank:c', balance: 2 }, tables: { bankAccounts: [], bankEntries: [] }, seq: 7 }), { status: 200 }))
  const exports: { handle?: (req: Request) => Promise<Response> } = {}
  const serve = vi.fn()
  const source = ts.transpileModule(edge.replace('__FAMILY_KEY_SHA256__', digest), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  runInNewContext(source, {
    exports, Request, Response, URL, TextEncoder, Uint8Array,
    crypto: webcrypto, fetch: rpc,
    Deno: { serve, env: { get: (name: string) => ({ SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-key' })[name] } },
  })
  return {
    rpc,
    call: (path: string, body: unknown = {}, options: { method?: string; key?: string; origin?: string } = {}) => {
      const method = options.method ?? 'POST'
      return exports.handle!(new Request(`https://fixture.invalid/functions/v1/xiaobu-sync${path}`, {
        method,
        headers: { 'x-family-key': options.key ?? fixtureKey, origin: options.origin ?? 'https://weilai-zte.github.io' },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      }))
    },
  }
}

describe('云端发布兼容：Edge内存执行，不连接云端', () => {
  it('POST /bank转发有限参数并完整返回账户与同步水位', async () => {
    const h = edgeHarness()
    const res = await h.call('/bank', { childId: 'c', action: 'deposit', requestId: 'once', amount: 2, since: 3, balance: 999, date: '2000-01-01' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ account: { id: 'bank:c', balance: 2 }, tables: { bankEntries: [] }, seq: 7 })
    expect(h.rpc).toHaveBeenCalledTimes(1)
    const [url, init] = h.rpc.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://fixture.invalid/rest/v1/rpc/xiaobu_bank')
    expect(JSON.parse(init.body as string)).toEqual({ p_child_id: 'c', p_action: 'deposit', p_request_id: 'once', p_input: { amount: 2 }, p_since: 3 })
  })
  it('配置/取款/结息沿用同一路由，保留现有冒险和同步接口', async () => {
    const h = edgeHarness()
    for (const action of ['configure', 'withdraw', 'settle']) {
      expect((await h.call('/bank', { childId: 'c', action, requestId: action, enabled: true, rateBps: 100 })).status).toBe(200)
    }
    expect((await h.call('/adventure', { childId: 'c', date: '2026-10-21', route: 'meadow' })).status).toBe(200)
    expect((await h.call('/sync?since=5', {}, { method: 'GET' })).status).toBe(200)
    const calls = h.rpc.mock.calls as unknown as [string, RequestInit][]
    expect(calls[3][0]).toContain('/rpc/xiaobu_adventure')
    expect(JSON.parse(calls[4][1].body as string)).toEqual({ p_action: 'sync', p_since: 5, p_changes: {} })
  })
  it('拒绝GET银行、错误来源、错误连接码和非法水位，不访问RPC', async () => {
    const h = edgeHarness()
    expect((await h.call('/bank', {}, { method: 'GET' })).status).toBe(404)
    expect((await h.call('/bank', {}, { origin: 'https://untrusted.invalid' })).status).toBe(403)
    expect((await h.call('/bank', {}, { key: 'wrong' })).status).toBe(401)
    expect((await h.call('/bank', { since: -1 })).status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
    expect(edge).toContain("const FAMILY_KEY_SHA256 = '__FAMILY_KEY_SHA256__'")
  })
  it('数据库业务错误返回400，网络失败返回503且不暴露服务端密钥', async () => {
    const h = edgeHarness()
    h.rpc.mockImplementationOnce(async () => new Response(JSON.stringify({ message: '可用星星不足' }), { status: 400 }))
    const insufficient = await h.call('/bank', { childId: 'c' })
    expect(insufficient.status).toBe(400)
    expect(await insufficient.json()).toEqual({ error: '可用星星不足' })
    h.rpc.mockRejectedValueOnce(new Error('fixture-service-key'))
    const failure = await h.call('/bank')
    expect(failure.status).toBe(503)
    expect(await failure.text()).not.toContain('fixture-service-key')
  })
})

describe('增量SQL静态契约（不代表已在Supabase执行）', () => {
  it('保留旧家庭、运动与奖励保护；银行账户与流水允许同步回读', () => {
    for (const fragment of ['validate_family', 'wishPlan', '全员签订', 'minMinutes', 'rewardStars', '冒险奖励只能', "'bankAccounts','bankEntries'", '银行记录只能', '已签版本关联不能修改', '已申请的奖励不能修改']) expect(migration).toContain(fragment)
    expect(migration).not.toMatch(/drop\s+(table|schema)|truncate\s/i)
    expect(migration).not.toContain('security definer')
    expect(migration).not.toContain('create table')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to service_role')
  })
  it('共用meta锁；按钱包流水扣预留，利息只在取款时进入钱包', () => {
    expect(migration.match(/where id=1 for update/g)?.length).toBeGreaterThanOrEqual(2)
    expect(migration).toContain("when 'deposit' then -(payload->>'amount')::bigint when 'withdraw' then (payload->>'amount')::bigint else 0")
    expect(migration).toContain("payload->>'status' in ('requested','redeemed')")
    expect(migration).toContain("v_receipt text := 'bank-action:'")
    expect(migration).toContain("v_entry_id := 'interest:'")
    expect(migration).toContain('v_next := v_next+7')
    expect(migration).toContain('9007199254740991')
    expect(migration).toContain('v_eligible := least(v_eligible,v_balance)')
  })
  it('catalog星座键和5个槽位一致；收藏并集先于过期判断', () => {
    const catalog = readFileSync('server/honor-catalog.mjs', 'utf8')
    const keys = catalog.match(/export const SIGN_KEYS=\[([^\]]+)\]/)![1].match(/'[^']+'/g)!
    for (const key of keys) expect(migration).toContain(key)
    expect(migration).toContain('generate_series(0,4)')
    expect(migration).toContain('slot=0 and xiaobu_private.valid_claim(p_claims->sign)')
    expect(migration.indexOf('v_row := xiaobu_private.merge_collections')).toBeLessThan(migration.indexOf("if v_old is not null and coalesce(v_row->>'updatedAt'"))
    expect(migration).toContain("array['starClaims','honorClaims']")
  })
  it('SQL验收自身含回滚、签约后礼物、重复存取、防超额与正确两次到期边界', () => {
    expect(acceptance.trim()).toMatch(/rollback;$/)
    for (const fragment of ['begin;', '签约后新增礼物', '重复操作', '余额不足', 'replacesPactId', '全员签约', 'has_function_privilege', '(today::date)-7', "'七天复利及余数'"]) expect(acceptance).toContain(fragment)
    expect(acceptance).not.toContain('(today::date)-14')
    expect(acceptance).not.toContain('placeholder')
  })
})
