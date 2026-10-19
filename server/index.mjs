/**
 * 「小步成长」的在线服务：
 *   1) 托管构建产物（dist/，没有构建过就退回 public/）
 *   2) 十一张实体表的 CRUD
 *   3) 按 sync_seq 水位线的双向同步接口
 *
 * 启动：node server/index.mjs      默认 http://0.0.0.0:8788
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'
import {
  DB_PATH,
  claimAdventure,
  ENTITIES,
  counts,
  deleteEverything,
  getMeta,
  getRecord,
  listChangedSince,
  listEntity,
  maxSeq,
  nowIso,
  setMeta,
  softDelete,
  upsertRecord,
} from './db.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST_DIR = join(ROOT, 'dist')
const PUBLIC_DIR = join(ROOT, 'public')
const STATIC_DIR = existsSync(join(DIST_DIR, 'index.html')) ? DIST_DIR : PUBLIC_DIR
const PORT = Number(process.env.PORT ?? 8788)
const HOST = process.env.HOST ?? '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function cors(res) {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type')
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS')
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 4_000_000) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('请求体不是合法 JSON')
  }
}

function changedTables(sinceSeq) {
  const out = {}
  for (const entity of ENTITIES) out[entity] = listChangedSince(entity, sinceSeq)
  return out
}

async function handleApi(req, res, url) {
  cors(res)
  const path = url.pathname.replace(/\/+$/, '') || '/api'
  const method = req.method ?? 'GET'

  if (method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  if (path === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      app: 'xiaobu-growth-sync',
      serverTime: nowIso(),
      seq: maxSeq(),
      resetSeq: getMeta('reset_seq', 0),
      dbPath: DB_PATH,
      counts: counts(),
    })
    return
  }

  if (path === '/api/sync' && method === 'GET') {
    const since = Number(url.searchParams.get('since') ?? 0)
    sendJson(res, 200, {
      serverTime: nowIso(),
      seq: maxSeq(),
      resetSeq: getMeta('reset_seq', 0),
      tables: changedTables(since),
    })
    return
  }

  if (path === '/api/adventure' && method === 'POST') {
    const body = await readBody(req)
    sendJson(res, 200, { adventure: claimAdventure(body.childId, body.date, body.route) })
    return
  }

  if (path === '/api/sync' && method === 'POST') {
    const body = await readBody(req)
    const since = Number(body.since ?? 0)
    const applied = { created: 0, updated: 0, stale: 0, same: 0 }
    // 先保存完成记录，最后处理心愿，余额检查才能包含本次刚打卡的星星。
    for (const [entity, rows] of Object.entries(body.changes ?? {}).sort(([a], [b]) => Number(a === 'wishes') - Number(b === 'wishes'))) {
      if (!ENTITIES.includes(entity) || !Array.isArray(rows)) continue
      for (const row of rows) {
        const result = upsertRecord(entity, row)
        if (result.applied) applied[result.reason] += 1
        else applied[result.reason === 'stale' ? 'stale' : 'same'] += 1
      }
    }
    sendJson(res, 200, {
      serverTime: nowIso(),
      seq: maxSeq(),
      resetSeq: getMeta('reset_seq', 0),
      applied,
      tables: changedTables(since),
    })
    return
  }

  if (path === '/api/clear-all' && method === 'POST') {
    const removed = deleteEverything()
    setMeta('reset_seq', maxSeq())
    sendJson(res, 200, { ok: true, removed, counts: counts() })
    return
  }

  const match = path.match(/^\/api\/([a-zA-Z]+)(?:\/(.+))?$/)
  if (match && ENTITIES.includes(match[1])) {
    const entity = match[1]
    if (entity === 'adventureRuns' && method !== 'GET') return sendJson(res, 400, { error: '冒险奖励不能修改、删除或重新抽取' })
    const id = match[2] ? decodeURIComponent(match[2]) : null
    if (!id && method === 'GET') {
      sendJson(res, 200, { rows: listEntity(entity), seq: maxSeq(), serverTime: nowIso() })
      return
    }
    if (!id && method === 'POST') {
      const body = await readBody(req)
      if (!body.id) return sendJson(res, 400, { error: '缺少 id' })
      const result = upsertRecord(entity, { ...body, updatedAt: body.updatedAt ?? nowIso() })
      sendJson(res, 201, { row: result.row, applied: result.applied, reason: result.reason })
      return
    }
    if (id && method === 'GET') {
      const row = getRecord(entity, id)
      if (!row) return sendJson(res, 404, { error: '找不到这条记录' })
      sendJson(res, 200, { row })
      return
    }
    if (id && method === 'PATCH') {
      const existing = getRecord(entity, id)
      if (!existing) return sendJson(res, 404, { error: '找不到这条记录' })
      const body = await readBody(req)
      const result = upsertRecord(entity, { ...existing, ...body, id, updatedAt: nowIso() })
      sendJson(res, 200, { row: result.row, applied: result.applied })
      return
    }
    if (id && method === 'DELETE') {
      const row = softDelete(entity, id)
      if (!row) return sendJson(res, 404, { error: '找不到这条记录' })
      sendJson(res, 200, { row })
      return
    }
  }

  sendJson(res, 404, { error: `未知接口：${method} ${path}` })
}

async function serveStatic(res, url) {
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(STATIC_DIR, safe)
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403).end('禁止访问')
    return
  }
  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, 'index.html')
    const body = await readFile(filePath)
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': body.length,
    })
    res.end(body)
  } catch {
    // 单页应用：找不到的路径回退到 index.html（前端用 hash 路由）
    try {
      const body = await readFile(join(STATIC_DIR, 'index.html'))
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' })
      res.end(body)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('找不到页面')
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url)
      return
    }
    await serveStatic(res, url)
  } catch (error) {
    cors(res)
    sendJson(res, 500, { error: error instanceof Error ? error.message : '服务器内部错误' })
  }
})

function lanAddresses() {
  const out = []
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) out.push(item.address)
    }
  }
  return out
}

server.listen(PORT, HOST, () => {
  console.log('小步成长在线服务已启动')
  console.log(`  页面：http://localhost:${PORT}/`)
  for (const address of lanAddresses()) {
    console.log(`  手机（同一 Wi-Fi）：http://${address}:${PORT}/`)
  }
  console.log(`  数据：${DB_PATH}`)
  console.log(`  静态目录：${STATIC_DIR}`)
  const rows = counts()
  const total = Object.values(rows).reduce((sum, item) => sum + item.rows, 0)
  console.log(`  在线记录：${total} 条`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
