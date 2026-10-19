/**
 * 换浏览器端到端验证：数据到底有没有真的存在线上。
 *
 * 做的事：
 *   1. 用一个临时数据库启动数据服务
 *   2. 开一个全新的浏览器上下文，在界面上建档
 *   3. 关掉它，再开另一个全新上下文（等于换浏览器 / 换设备）
 *   4. 断言第二个浏览器没做任何操作就能看到同一份数据
 *
 * 需要先跑过 npm run build。
 * 用法：node scripts/verify-sync.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.XB_VERIFY_PORT ?? 8791)
const BASE = `http://127.0.0.1:${PORT}`
const DEBUG_BASE = 9400

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
}

if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.error('找不到 dist/index.html，请先运行 npm run build')
  process.exit(1)
}
if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}`)
  process.exit(1)
}

/* ---------- 起服务 ---------- */

const dataDir = mkdtempSync(join(tmpdir(), 'xb-verify-db-'))
const server = spawn(process.execPath, [join(ROOT, 'server', 'index.mjs')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), XB_DB: join(dataDir, 'verify.db') },
  stdio: 'ignore',
})

async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return
    } catch {
      /* 还没起来 */
    }
    await sleep(150)
  }
  throw new Error('数据服务启动超时')
}

/* ---------- 浏览器上下文 ---------- */

const browsers = []

async function openBrowser(label) {
  const debugPort = DEBUG_BASE + browsers.length
  const profileDir = mkdtempSync(join(tmpdir(), `xb-verify-${label}-`))
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--window-size=420,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`)
      if (res.ok) break
    } catch {
      /* 还没起来 */
    }
    await sleep(120)
  }

  const target = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })
  ).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })

  const send = (method, params = {}) => {
    const id = (nextId += 1)
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text)
    return out.result?.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  })

  const session = {
    label,
    evaluate,
    async goto(path) {
      await send('Page.navigate', { url: `${BASE}/#${path}` })
      await sleep(2200)
    },
    async text() {
      return (await evaluate('document.body.innerText')) ?? ''
    },
    async close() {
      ws.close()
      proc.kill('SIGTERM')
    },
  }
  browsers.push(session)
  return session
}

/** 等某件事在界面上真的发生了 */
async function waitFor(description, fn, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await fn()) return true
    await sleep(500)
  }
  console.log(`  （等待超时：${description}）`)
  return false
}

async function serverCounts() {
  const res = await fetch(`${BASE}/api/health`)
  const body = await res.json()
  return body.counts
}

/* ---------- 验证流程 ---------- */

try {
  await waitForServer()
  console.log(`\n数据服务：${BASE}\n`)

  // 设备 A：全新浏览器，在界面上建档
  const deviceA = await openBrowser('A')
  await deviceA.goto('/')
  const firstScreen = await deviceA.text()
  check('空数据库下，第一台设备看到建档引导', firstScreen.includes('先建立孩子档案'))

  await deviceA.evaluate(`
    (() => {
      const el = document.querySelector('input[type="text"]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(el, '验证用小朋友')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()
  `)
  await deviceA.evaluate(`
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('建好档案'))?.click()
  `)

  const wroteOnline = await waitFor('档案写进线上数据表', async () => {
    const counts = await serverCounts()
    return counts.childProfiles.rows === 1
  })
  check('界面上建的档案被写进了线上数据表', wroteOnline)

  const rulesOnline = await waitFor('内置规则也写进线上', async () => {
    const counts = await serverCounts()
    return counts.routineRules.rows >= 5
  })
  check('内置家庭规则一并进了线上数据表', rulesOnline)

  await deviceA.close()
  browsers.pop()

  // 设备 B：又一个全新浏览器，什么都不做，只打开页面
  const deviceB = await openBrowser('B')
  await deviceB.goto('/')
  const seenByB = await waitFor('第二台设备看到同一份数据', async () => {
    const text = await deviceB.text()
    return text.includes('验证用小朋友')
  })
  check('换一个全新浏览器打开，不做任何操作就看到同一份数据', seenByB)
  check('第二台设备没有重复要求建档', !(await deviceB.text()).includes('先建立孩子档案'))

  // 设备 B 通过线上接口再写一条，新开的设备 C 应该也能看到
  const childId =
    (await deviceB.evaluate(`
      (async () => {
        const res = await fetch('/api/childProfiles')
        const body = await res.json()
        return body.rows[0]?.id ?? ''
      })()
    `)) || ''
  const stamp = new Date().toISOString()
  const pushed = await deviceB.evaluate(`
    (async () => {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          since: 0,
          changes: {
            strengthMoments: [{
              id: 'verify-strength-1',
              createdAt: ${JSON.stringify(stamp)},
              updatedAt: ${JSON.stringify(stamp)},
              childId: ${JSON.stringify(childId)},
              date: new Date().toISOString().slice(0, 10),
              category: 'care',
              categoryOther: null,
              event: '端到端验证用例',
              childAction: '在第二台设备上写了一条记录',
              outcome: '用来验证换设备可见',
              childFeeling: null,
            }],
          },
        }),
      })
      return res.ok
    })()
  `)
  check('第二台设备能把新记录写回线上', pushed === true)

  await deviceB.close()
  browsers.pop()

  const deviceC = await openBrowser('C')
  await deviceC.goto('/child/progress')
  const seenByC = await waitFor('第三台设备看到第二台写的数据', async () => {
    const text = await deviceC.text()
    return text.includes('端到端验证用例')
  })
  check('再开第三台设备，第二台写的数据同样可见（双向同步）', seenByC)
  await deviceC.close()
  browsers.pop()
} catch (error) {
  check('验证脚本执行', false, error instanceof Error ? error.message : String(error))
} finally {
  for (const browser of browsers) {
    try {
      await browser.close()
    } catch {
      /* 已经关了 */
    }
  }
  server.kill('SIGTERM')
  await sleep(300)
  rmSync(dataDir, { recursive: true, force: true })
}

const failed = results.filter((item) => !item.ok)
console.log(`\n通过 ${results.length - failed.length}/${results.length}`)
process.exit(failed.length === 0 ? 0 : 1)
