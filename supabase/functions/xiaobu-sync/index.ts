// 部署时替换哈希占位符；家庭连接码明文不进入源码或构建产物。
const FAMILY_KEY_SHA256 = '__FAMILY_KEY_SHA256__'
const allowedOrigins = ['https://weilai-zte.github.io']

export async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = !origin || allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Headers': 'content-type, x-family-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (allowed && origin) headers['Access-Control-Allow-Origin'] = origin
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (!allowed) return json({ error: '此网页来源未获允许' }, 403)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  const key = req.headers.get('x-family-key') ?? ''
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('')
  if (key.length < 24 || hash !== FAMILY_KEY_SHA256) return json({ error: '家庭连接码不正确，请重新连接' }, 401)
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, '')
  const clear = path.endsWith('/clear-all')
  if (!(path.endsWith('/sync') || clear) || !['GET','POST'].includes(req.method) || (clear && req.method !== 'POST')) return json({ error: '未知接口' }, 404)
  try {
    if (Number(req.headers.get('content-length') ?? 0) > 4_000_000) return json({ error: '同步内容过大' }, 413)
    const text = req.method === 'POST' ? await req.text() : ''
    if (text.length > 4_000_000) return json({ error: '同步内容过大' }, 413)
    const body = text ? JSON.parse(text) : {}
    const since = Number(req.method === 'GET' ? url.searchParams.get('since') ?? 0 : body.since ?? 0)
    if (!Number.isSafeInteger(since) || since < 0) return json({ error: '同步水位线无效' }, 400)
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const result = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/xiaobu_exchange`, {
      method: 'POST', headers: { 'Content-Type':'application/json', apikey: secret, Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ p_action: clear ? 'clear' : 'sync', p_since: since, p_changes: body.changes ?? {} }),
    })
    const data = await result.json()
    if (!result.ok) return json({ error: data.message ?? '云端保存失败，请重试' }, 400)
    return json(data)
  } catch { return json({ error: '云端暂时不可用，请稍后重试；本机待同步记录会保留。' }, 503) }
}

Deno.serve(handle)
