import { mergeProfileCollections } from './profile-merge.mjs'
import { achievementBonus } from './star-achievements.mjs'
/**
 * 「小步成长」的在线数据层。
 *
 * 十一张实体表在服务端统一落成一张通用记录表 records：
 *   entity + id 作为主键，payload 存这条记录的全部字段（JSON）。
 * 这样新增实体不需要改服务端表结构，同时保留同步需要的三件事：
 *   updated_at（业务时间，用于「后写覆盖」判断）、sync_seq（全局递增序号，用于增量同步）、
 *   deleted（墓碑，删除也能同步到其他设备）。
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FAMILY_ENTITIES, validateFamilyRecord } from './family.mjs'
import { bankChange, bankWalletDelta, bankToday, newBankAccount } from './bank.mjs'
import { randomInt } from 'node:crypto'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export const DB_PATH = process.env.XB_DB ?? join(ROOT, 'data', 'sync.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

export const ENTITIES = [
  'bankAccounts', 'bankEntries',
  ...FAMILY_ENTITIES,
  'adventureRuns',
  'wishes',
  'childProfiles',
  'dailyLogs',
  'taskTemplates',
  'taskRecords',
  'routineRules',
  'routineChecks',
  'conflictLogs',
  'strengthMoments',
  'weeklyReviews',
  'experiments',
]

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_seq INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (entity, id)
  );
  CREATE INDEX IF NOT EXISTS idx_records_seq ON records(sync_seq);
  CREATE INDEX IF NOT EXISTS idx_records_entity ON records(entity, deleted);
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

export function nowIso() {
  return new Date().toISOString()
}

function assertEntity(entity) {
  if (!ENTITIES.includes(entity)) throw new Error(`未知数据表：${entity}`)
}

function maxSeqFromDb() {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'sync_seq'").get()
  let current = row ? Number(JSON.parse(row.value)) : 0
  if (!Number.isFinite(current)) current = 0
  const max = db.prepare('SELECT MAX(sync_seq) AS s FROM records').get()
  if (max?.s != null && Number(max.s) > current) current = Number(max.s)
  return current
}

let seqCache = null
function nextSeq() {
  if (seqCache === null) seqCache = maxSeqFromDb()
  seqCache += 1
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('sync_seq', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(seqCache))
  return seqCache
}

export function maxSeq() {
  return maxSeqFromDb()
}

export function fromRow(row) {
  if (!row) return null
  let payload = {}
  try {
    payload = JSON.parse(row.payload)
  } catch {
    payload = {}
  }
  return {
    ...payload,
    id: row.id,
    updatedAt: row.updated_at,
    syncSeq: Number(row.sync_seq),
    deleted: Boolean(row.deleted),
  }
}

export function getRecord(entity, id) {
  assertEntity(entity)
  return fromRow(
    db.prepare('SELECT * FROM records WHERE entity = ? AND id = ?').get(entity, id),
  )
}

/**
 * 写入一条记录。
 * 客户端带上它写这条记录的时间；如果早于库里已有的 updatedAt，说明别的设备先改了，
 * 判为 stale：不回写，把库里那份返回给客户端对齐。
 */
export function upsertRecord(entity, input) {
  assertEntity(entity)
  if (!input?.id) throw new Error('缺少 id')
  const existing = getRecord(entity, input.id)
  if (entity === 'bankAccounts' || entity === 'bankEntries') {
    if (existing) return { row: existing, applied: false, reason: 'same' }
    throw new Error('银行记录只能通过存取与周息接口生成')
  }
  if (['taskRecords', 'routineChecks'].includes(entity)) {
    if (input.rewardStars != null && ![1, 2].includes(input.rewardStars)) throw new Error('新打卡星数只能为1或2')
    if (entity === 'routineChecks') {
      const rule = getRecord('routineRules', input.ruleId)
      if (!existing && rule?.rewardStars) input = { ...input, rewardStars: rule.rewardStars }
      if (!input.deleted && input.status === 'done' && rule?.minMinutes && (!Number.isFinite(input.minutes) || input.minutes < rule.minMinutes || input.minutes > 600)) throw new Error(`请确认运动至少${rule.minMinutes}分钟`)
    }
  }
  if (entity === 'adventureRuns') {
    if (existing) return { row: existing, applied: false, reason: 'same' }
    throw new Error('冒险奖励只能通过每日冒险领取')
  }
  // 荣誉和星星是永久收藏；跨版本或跨设备更新采用并集。
  if (entity === 'childProfiles' && existing) {
    const newer = (input.updatedAt ?? '') > existing.updatedAt
    const merged = mergeProfileCollections(existing, input, newer)
    const monotonicChanged = ['starClaims','honorClaims','buddyCare','honorsSeenAt'].some(key => JSON.stringify(merged[key]) !== JSON.stringify(existing[key]))
    input = monotonicChanged ? {...merged, updatedAt:new Date(Math.max(Date.now(), Date.parse(existing.updatedAt)+1)).toISOString()} : merged
  }
  const clientUpdatedAt = input.updatedAt ?? input.updated_at ?? nowIso()

  if (existing && clientUpdatedAt < existing.updatedAt) {
    return { row: existing, applied: false, reason: 'stale' }
  }
  if (existing && clientUpdatedAt === existing.updatedAt) {
    return { row: existing, applied: false, reason: 'same' }
  }

  validateFamilyRecord(entity, input, existing, getRecord, listEntity)

  if (entity === 'wishes') {
    if(existing?.status==='requested'&&(input.cost!==existing.cost||input.name!==existing.name||input.picture!==existing.picture))throw new Error('已申请的奖励不能修改价格或内容，请先取消申请')
    if (existing?.status === 'redeemed' && !input.deleted) return { row: existing, applied: false, reason: 'stale' }
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 ||
        typeof input.childId !== 'string' || !input.childId ||
        !['proposed', 'approved', 'requested', 'redeemed'].includes(input.status) ||
        (input.status !== 'proposed' && (!Number.isSafeInteger(input.cost) || input.cost <= 0))) {
      throw new Error('心愿内容或兑换星数无效')
    }
    if (input.status === 'requested' || input.status === 'redeemed') {
      const actions = new Map()
      for (const task of listEntity('taskRecords')) {
        if (task.childId === input.childId && task.completion === 'independent') { const key = `task:${task.date}:${task.templateId || task.name}`; actions.set(key, Math.max(actions.get(key) ?? 0, actionStars(task))) }
      }
      for (const check of listEntity('routineChecks')) {
        if (check.childId === input.childId && check.status === 'done') { const key = `rule:${check.date}:${check.ruleId}`; actions.set(key, Math.max(actions.get(key) ?? 0, actionStars(check))) }
      }
      const committed = listEntity('wishes').filter(w => w.childId === input.childId && w.id !== input.id && ['requested', 'redeemed'].includes(w.status)).reduce((sum, w) => sum + w.cost, 0)
      const bonus = listEntity('adventureRuns').filter(r => r.childId === input.childId).reduce((sum, r) => sum + r.bonusStars, 0)
      if ([...actions.values()].reduce((sum, stars) => sum + stars, 0) + bonus + achievementBonus(getRecord('childProfiles',input.childId)?.starClaims) + bankWalletDelta(listEntity('bankEntries').filter(e => e.childId === input.childId)) < committed + input.cost) throw Object.assign(new Error('星星余额不足，本次申请已退回，请同步后重新选择礼物。'), {code:'WISH_CONFLICT'})
    }
  }

  const { syncSeq, updatedAt, ...payload } = { ...existing, ...input }
  const deleted = payload.deleted ? 1 : 0
  const stamp = new Date(Math.max(Date.now(), Date.parse(existing?.updatedAt ?? '') + 1 || 0)).toISOString()
  const seq = nextSeq()
  db.prepare(
    `INSERT INTO records (entity, id, payload, updated_at, sync_seq, deleted)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity, id) DO UPDATE SET
       payload = excluded.payload, updated_at = excluded.updated_at,
       sync_seq = excluded.sync_seq, deleted = excluded.deleted`,
  ).run(entity, input.id, JSON.stringify(payload), stamp, seq, deleted)
  return {
    row: getRecord(entity, input.id),
    applied: true,
    reason: existing ? 'updated' : 'created',
  }
}

/** A rejected business record must not block unrelated accepted records. */
export function syncBatch(changes) {
  const applied = {created:0, updated:0, stale:0, same:0}
  const rejected = []
  const touched = {}
  const priority = entity => ({childProfiles:0,routineRules:1,familyMembers:2,wishes:4,growthPacts:5,pactSignatures:6,familyChecks:7,familyReactions:8}[entity] ?? 3)
  for (const [entity, rows] of Object.entries(changes ?? {}).sort(([a],[b])=>priority(a)-priority(b))) {
    if (!ENTITIES.includes(entity) || !Array.isArray(rows)) continue
    for (const row of rows) {
      db.exec('SAVEPOINT sync_record')
      try {
        const result = upsertRecord(entity, row)
        db.exec('RELEASE sync_record')
        ;(touched[entity] ??= new Set()).add(result.row.id)
        applied[result.applied ? result.reason : result.reason === 'stale' ? 'stale' : 'same'] += 1
      } catch (error) {
        db.exec('ROLLBACK TO sync_record'); db.exec('RELEASE sync_record')
        // Storage errors are retryable service failures, never acknowledgements.
        if (String(error.code ?? '').includes('SQLITE')) throw error
        rejected.push({entity, id:typeof row?.id==='string'?row.id:'', code:error.code==='WISH_CONFLICT'?'WISH_CONFLICT':'INVALID_RECORD', error:error.message ?? '记录校验失败', canonical:typeof row?.id==='string'?getRecord(entity,row.id):null})
      }
    }
  }
  const confirmed = Object.fromEntries(Object.entries(touched).map(([entity, ids]) => [entity, [...ids].map(id => getRecord(entity,id))]))
  return {applied, rejected, confirmed}
}

/** 增量拉取：sync_seq 大于客户端水位线的记录（含删除墓碑） */
export function listChangedSince(entity, sinceSeq = 0) {
  assertEntity(entity)
  return db
    .prepare('SELECT * FROM records WHERE entity = ? AND sync_seq > ? ORDER BY sync_seq')
    .all(entity, Number(sinceSeq) || 0)
    .map(fromRow)
}

export function listEntity(entity, { includeDeleted = false } = {}) {
  assertEntity(entity)
  const where = includeDeleted ? '' : 'AND deleted = 0'
  return db
    .prepare(`SELECT * FROM records WHERE entity = ? ${where} ORDER BY sync_seq`)
    .all(entity)
    .map(fromRow)
}

export function softDelete(entity, id) {
  if (entity === 'bankAccounts' || entity === 'bankEntries') throw new Error('银行记录不能直接删除')
  if (FAMILY_ENTITIES.includes(entity)) throw new Error('请收起公约，保留签订和打卡记录')
  if (entity === 'adventureRuns') throw new Error('冒险奖励不能单独删除或重抽')
  const existing = getRecord(entity, id)
  if (!existing) return null
  const { syncSeq, updatedAt, ...payload } = { ...existing, deleted: true }
  db.prepare(
    'UPDATE records SET payload = ?, deleted = 1, updated_at = ?, sync_seq = ? WHERE entity = ? AND id = ?',
  ).run(JSON.stringify(payload), nowIso(), nextSeq(), entity, id)
  return getRecord(entity, id)
}

/** 同步执行，无 await；每日固定主键使并发请求和响应丢失后的重试得到同一结果。 */
export function claimAdventure(childId, date, route) {
  if (typeof childId !== 'string' || !getRecord('childProfiles', childId) || getRecord('childProfiles', childId).deleted) throw new Error('请先建立儿童档案')
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
  if (date !== today || !['meadow', 'stream', 'forest'].includes(route)) throw new Error('只能参加今天的冒险，请刷新页面后重试')
  const id = `adventure:${childId}:${date}`
  const existing = getRecord('adventureRuns', id)
  if (existing) return existing
  const actions = new Map()
  for (const task of listEntity('taskRecords')) if (task.childId === childId && task.date === date && task.completion === 'independent') { const key = `task:${task.templateId || task.name}`; actions.set(key, Math.max(actions.get(key) ?? 0, actionStars(task))) }
  for (const check of listEntity('routineChecks')) if (check.childId === childId && check.date === date && check.status === 'done') { const key = `rule:${check.ruleId}`; actions.set(key, Math.max(actions.get(key) ?? 0, actionStars(check))) }
  if ([...actions.values()].reduce((sum, stars) => sum + stars, 0) < 5) throw new Error('今天完成任务获得满5颗星，再来出发吧')
  const stamp = nowIso()
  const seq = nextSeq()
  const row = { id, childId, date, route, scene: randomInt(3), material: ['leaf', 'twig', 'pebble'][randomInt(3)], bonusStars: [2, 3, 5][randomInt(3)], createdAt: stamp, updatedAt: stamp, syncSeq: seq }
  db.prepare('INSERT INTO records(entity,id,payload,updated_at,sync_seq,deleted) VALUES(?,?,?,?,?,0)').run('adventureRuns', id, JSON.stringify(row), stamp, seq)
  return row
}

function actionStars(row) { return row.rewardStars === 1 || row.rewardStars === 2 ? row.rewardStars : 5 }

export function deleteEverything() {
  const result = db.prepare('DELETE FROM records').run()
  nextSeq()
  return Number(result.changes ?? 0)
}

export function counts() {
  const out = {}
  for (const entity of ENTITIES) {
    const rows = db
      .prepare('SELECT COUNT(*) AS n FROM records WHERE entity = ? AND deleted = 0')
      .get(entity)
    const last = db
      .prepare('SELECT MAX(updated_at) AS t FROM records WHERE entity = ?')
      .get(entity)
    out[entity] = { rows: Number(rows.n), lastWrite: last.t ?? null }
  }
  return out
}

export function setMeta(key, value) {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, JSON.stringify(value))
}

export function getMeta(key, fallback = null) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key)
  if (!row) return fallback
  try {
    return JSON.parse(row.value)
  } catch {
    return fallback
  }
}

/** 银行操作与周息在同一个SQLite事务中提交。请求ID使超时重试不重复划转。 */
export function bankOperation(input) {
  const { childId, action, requestId } = input
  if (typeof childId !== 'string' || !getRecord('childProfiles',childId) || getRecord('childProfiles',childId).deleted) throw new Error('请先建立孩子档案')
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) throw new Error('银行请求编号无效，请重试')
  const stamp = nowIso(), today = bankToday(), receiptId = `bank-action:${childId}:${requestId}`
  db.exec('BEGIN IMMEDIATE')
  try {
    const old = getRecord('bankAccounts',`bank:${childId}`) ?? { ...newBankAccount(childId,today), createdAt: stamp, updatedAt: stamp }
    const receipt = getRecord('bankEntries',receiptId)
    if (receipt) { db.exec('COMMIT'); return old }
    const actions = new Map()
    for (const t of listEntity('taskRecords')) if (t.childId === childId && t.completion === 'independent') { const key=`task:${t.date}:${t.templateId || t.name}`; actions.set(key,Math.max(actions.get(key)??0,actionStars(t))) }
    for (const c of listEntity('routineChecks')) if (c.childId === childId && c.status === 'done') { const key=`rule:${c.date}:${c.ruleId}`; actions.set(key,Math.max(actions.get(key)??0,actionStars(c))) }
    const earned=achievementBonus(getRecord('childProfiles',childId)?.starClaims)+[...actions.values()].reduce((a,b)=>a+b,0)+listEntity('adventureRuns').filter(r=>r.childId===childId).reduce((s,r)=>s+r.bonusStars,0)
    const committed=listEntity('wishes').filter(w=>w.childId===childId&&['requested','redeemed'].includes(w.status)).reduce((s,w)=>s+w.cost,0)
    const available=earned+bankWalletDelta(listEntity('bankEntries').filter(e=>e.childId===childId))-committed
    const result=bankChange(old,action,input,available,today)
    const save=(entity,row)=>{
      db.prepare('INSERT INTO records(entity,id,payload,updated_at,sync_seq,deleted) VALUES(?,?,?,?,?,0) ON CONFLICT(entity,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,sync_seq=excluded.sync_seq').run(entity,row.id,JSON.stringify({...row,createdAt:row.createdAt??stamp,updatedAt:stamp}),stamp,nextSeq())
    }
    for(const entry of result.entries) save('bankEntries',entry)
    if(action !== 'settle') save('bankEntries',{id:receiptId,childId,kind:action,amount:['deposit','withdraw'].includes(action)?input.amount:0,date:today,rateBps:result.account.configuredRateBps})
    save('bankAccounts',result.account)
    db.exec('COMMIT'); return getRecord('bankAccounts',old.id)
  } catch(error) { db.exec('ROLLBACK'); seqCache=null; throw error }
}
