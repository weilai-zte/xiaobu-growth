import { evaluateHonors, buildHonorSky } from '../lib/honors'
import { evaluateStars } from '../lib/starAchievements'
import type { Table } from 'dexie'
import { db, ENTITY_NAMES, type EntityName, type GrowthDB } from './db'
import {
  BUILTIN_RULES,
  type ChildProfile,
  type ConflictLog,
  type DailyLog,
  type DayKey,
  type Experiment,
  type ID,
  type RoutineCheck,
  type RoutineRule,
  type RuleStatus,
  type StrengthMoment,
  type TaskRecord,
  type TaskTemplate,
  type WeeklyReview,
  type Wish,
  type OutboxEntry,
} from './types'
import { nowISO } from '../lib/date'
import { adventureDay } from '../lib/adventure'
import { starBalance, validWish } from '../lib/rewards'
import { HABIT_PLAN } from '../lib/habits'
import { dailyWordPlan, WORDS } from '../lib/words'
import type { StudyAttempt } from './types'
import {
  birdInventory,
  changeBuddyCare,
  homeTreasureInventory,
  type BuddyCareCommand,
} from '../lib/birdCompanion'
import {
  validateChildProfile,
  validateConflictLog,
  validateDailyLog,
  validateExperiment,
  validateRoutineRule,
  validateRoutineCheck,
  validateStrengthMoment,
  validateTaskRecord,
  validateTaskTemplate,
  validateWeeklyReview,
  type Draft,
  type ValidationResult,
} from '../lib/validate'

export class ValidationError extends Error {
  errors: string[]
  constructor(errors: string[]) {
    super(errors.join('；'))
    this.name = 'ValidationError'
    this.errors = errors
  }
}

function check(result: ValidationResult): void {
  if (!result.ok) throw new ValidationError(result.errors)
}

export function newId(): ID {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

type Timestamped = { createdAt: string; updatedAt: string }

function stamp<T extends object>(input: T): T & Timestamped {
  const ts = nowISO()
  return { ...input, createdAt: ts, updatedAt: ts }
}

export interface SyncRejection {
  entity: string
  id: string
  code: 'WISH_CONFLICT' | 'INVALID_RECORD'
  error: string
  canonical: Record<string, unknown> | null
}

export function createRepo(database: GrowthDB) {
  async function ensureHabitPlan(childId: ID) {
    // ID由孩子和项目决定，跨设备重复升级不会重复创建；旧记录不动。
    await database.transaction('rw', database.routineRules, database.syncQueue, database.settings, async () => {
      const existing = await listRules(childId)
      for (const [order, habit] of HABIT_PLAN.entries()) {
        const id = `habit-v2:${childId}:${habit.key}`
        if (await database.routineRules.get(id)) continue
        await write('routineRules', stamp({ id, childId, builtinKey: `habit_v2_${habit.key}`, habitKey: habit.key, category: habit.category, rewardStars: habit.stars, minMinutes: habit.minutes, title: habit.title, steps: habit.steps.slice(), trigger: habit.key === 'meal' ? 'mealtime' : 'anytime', active: true, order }))
      }
      if (!existing.some(r => r.habitKey)) for (const rule of existing) if (rule.active && BUILTIN_RULES.some(b => b.builtinKey === rule.builtinKey)) await write('routineRules', { ...rule, active: false, updatedAt: nowISO() })
      for (const rule of existing) if (!rule.builtinKey && rule.rewardStars === undefined) await write('routineRules', { ...rule, category: 'life', rewardStars: 1, updatedAt: nowISO() })
    })
  }
  const honorTables = [database.childProfiles, database.taskRecords, database.routineChecks, database.routineRules, database.adventureRuns, database.syncQueue]
  async function refreshHonors(childId: ID) {
    return database.transaction('rw', honorTables, async () => {
      const profile = await database.childProfiles.get(childId)
      if (!profile || profile.deleted) return []
      const honors = evaluateHonors(childId, await listTaskRecords(childId), await listChecks(childId), await listAdventures(childId), profile.buddyCare, await listRules(childId), profile.honorClaims)
      const added = honors.filter(h => h.eligible && !h.earned)
      if (added.length) await write('childProfiles', {...profile, honorClaims:{...profile.honorClaims,...Object.fromEntries(added.map(h=>[h.id,nowISO()]))}, updatedAt:nowISO()})
      return added
    })
  }
  async function lightHonorStar(childId: ID, starId: string) {
    return database.transaction('rw', honorTables, async () => {
      await refreshHonors(childId)
      const profile = await database.childProfiles.get(childId)
      if (!profile || profile.deleted) throw new Error('找不到儿童档案')
      const star = buildHonorSky(profile.honorClaims, profile.starClaims).find(s=>s.id===starId)
      if (!star) throw new Error('找不到这颗星')
      if (star.lit) return
      if (!star.revealed) throw new Error('这颗星还没有被勋章唤醒')
      await write('childProfiles', {...profile, starClaims:{...profile.starClaims,[starId]:nowISO()}, updatedAt:nowISO()})
    })
  }
  async function lightStar(childId: ID, key: string) {
    return database.transaction('rw', [database.childProfiles, database.taskRecords, database.routineChecks, database.adventureRuns, database.syncQueue], async () => {
      const profile = await database.childProfiles.get(childId)
      if (!profile || profile.deleted) throw new Error('找不到儿童档案')
      const star = evaluateStars(childId, await listTaskRecords(childId), await listChecks(childId), await listAdventures(childId), profile.buddyCare, profile.starClaims).find(s => s.key === key)
      if (!star) throw new Error('找不到这颗星')
      if (star.lit) return
      if (!star.eligible) throw new Error('还没有达到这颗星的条件')
      await write('childProfiles', {...profile, starClaims: {...profile.starClaims, [key]: nowISO()}, updatedAt: nowISO()})
    })
  }
  async function listBankEntries(childId: ID) { return alive(await database.bankEntries.where('childId').equals(childId).toArray()) }
  async function getBankAccount(childId: ID) { return database.bankAccounts.get(`bank:${childId}`) }
  async function listAdventures(childId: ID) { return alive(await database.adventureRuns.where('childId').equals(childId).toArray()) }
  async function listWishes(childId: ID): Promise<Wish[]> {
    return alive(await database.wishes.where('childId').equals(childId).toArray())
  }

  async function proposeWish(childId: ID, name: string, picture: string, approvedCost?: number): Promise<Wish> {
    // 家长上架将奖励和价格一起保存，不留下已创建却未定价的中间记录。
    const row: Wish = stamp({ id: newId(), childId, name: name.trim(), picture, cost: approvedCost ?? null, status: approvedCost === undefined ? 'proposed' : 'approved' })
    if (!validWish(row)) throw new Error('请填写 1–80 字的心愿名称，上架星数须为正整数')
    return write('wishes', row)
  }

  async function editWish(id: ID, name: string, picture: string, cost: number) {
    await database.transaction('rw', [database.wishes,database.syncQueue], async () => {
      const old=await database.wishes.get(id)
      if(!old || old.deleted || !['proposed','approved'].includes(old.status)) throw new Error('已申请或已兑现的奖励不能修改，请先取消申请')
      const next={...old,name:name.trim(),picture,cost,status:'approved' as const,updatedAt:nowISO()}
      if(!validWish(next))throw new Error('请填写心愿名称和正整数星数')
      await write('wishes',next)
    })
  }

  async function changeWish(id: ID, action: 'approve' | 'request' | 'redeem' | 'cancel', cost?: number) {
    // 单设备内串行校验并写入，重复点击不会重复预留或兑换。
    await database.transaction('rw', [database.wishes, database.childProfiles, database.taskRecords, database.routineChecks, database.adventureRuns, database.bankEntries, database.syncQueue], async () => {
      const old = await database.wishes.get(id)
      if (!old || old.deleted) throw new Error('找不到这个心愿')
      const next = { ...old, updatedAt: nowISO() }
      if (action === 'approve' && old.status === 'proposed') {
        next.cost = cost ?? null; next.status = 'approved'
      } else if (action === 'request' && old.status === 'approved') {
        const balance = starBalance(await listTaskRecords(old.childId), await listChecks(old.childId), await listWishes(old.childId), await listAdventures(old.childId), await listBankEntries(old.childId), (await database.childProfiles.get(old.childId))?.starClaims)
        if (balance.available < (old.cost ?? Infinity)) throw new Error('星星还没攒够，再做一点点就更近了')
        next.status = 'requested'
      } else if (action === 'redeem' && old.status === 'requested') {
        const balance = starBalance(await listTaskRecords(old.childId), await listChecks(old.childId), await listWishes(old.childId), await listAdventures(old.childId), await listBankEntries(old.childId), (await database.childProfiles.get(old.childId))?.starClaims)
        if (balance.earned + balance.bankTransfer - balance.spent < balance.reserved) throw new Error('记录有变动，当前星星不足，请先取消申请')
        next.status = 'redeemed'
      } else if (action === 'cancel' && old.status === 'requested') next.status = 'approved'
      else throw new Error('心愿状态已变化，请刷新后查看')
      if (!validWish(next)) throw new Error('兑换星数需要是正整数')
      await write('wishes', next)
    })
  }
  /* ---------- 统一写入入口 ---------- */

  /**
   * 写入完成通知；记录与待传队列由 write() 原子保存，回调仅调度同步和刷新界面。
   */
  let writeHook:
    | ((entity: EntityName, row: Record<string, unknown>) => void | Promise<void>)
    | null = null

  function setWriteHook(hook: typeof writeHook): void {
    writeHook = hook
  }

  function tableOf(entity: EntityName): Table<Record<string, unknown>, string> {
    return database[entity] as unknown as Table<Record<string, unknown>, string>
  }

  async function write<T extends object>(entity: EntityName, row: T): Promise<T> {
    await database.transaction('rw', tableOf(entity), database.syncQueue, async () => {
      await tableOf(entity).put(row as unknown as Record<string, unknown>)
      await enqueue(entity, row as unknown as Record<string, unknown>)
    })
    // Hooks schedule sync only; durability no longer depends on a running engine.
    await writeHook?.(entity, row as unknown as Record<string, unknown>)
    return row
  }

  /** 列表查询一律用它过滤软删除墓碑 */
  function alive<T extends { deleted?: boolean }>(rows: T[]): T[] {
    return rows.filter((row) => !row.deleted)
  }

  /* ---------- 儿童档案 ---------- */

  async function listProfiles(): Promise<ChildProfile[]> {
    return alive(await database.childProfiles.toArray())
  }

  async function getPrimaryProfile(): Promise<ChildProfile | undefined> {
    const profiles = alive(await database.childProfiles.toArray())
    return profiles.find((p) => p.isPrimary) ?? profiles[0]
  }

  async function createProfile(
    draft: Draft<ChildProfile>,
  ): Promise<ChildProfile> {
    check(validateChildProfile(draft))
    const profiles = await listProfiles()
    const profile: ChildProfile = stamp({
      id: newId(),
      name: `${draft.name}`.trim(),
      nickname: (draft.nickname as string) ?? null,
      birthDate: (draft.birthDate as DayKey) ?? null,
      gradeLabel: (draft.gradeLabel as string) ?? null,
      avatarEmoji: (draft.avatarEmoji as string) ?? null,
      isPrimary: profiles.length === 0,
      note: (draft.note as string) ?? null,
    })
    await write('childProfiles', profile)
    await seedBuiltinRules(profile.id)
    return profile
  }

  async function updateProfile(
    id: ID,
    patch: Draft<ChildProfile>,
  ): Promise<void> {
    await database.transaction('rw', [database.childProfiles,database.adventureRuns,database.syncQueue], async () => {
      const existing = await database.childProfiles.get(id)
      if (!existing) throw new Error('找不到这条儿童档案')
      const next = { ...existing, ...patch, starClaims: existing.starClaims, honorClaims: existing.honorClaims, id: existing.id } as ChildProfile
      check(validateChildProfile(next))
      if (patch.buddyAccessory && !birdInventory(await listAdventures(id)).some(item => item.key === patch.buddyAccessory)) throw new Error('这件装备还没有在冒险中发现')
      if (patch.buddyHomeDecor && !homeTreasureInventory(await listAdventures(id)).some(item => item.key === patch.buddyHomeDecor)) throw new Error('这件小屋摆件还没有在冒险中发现')
      await write('childProfiles', { ...next, updatedAt: nowISO() })
    })
  }

  /** 小步照料走独立入口，避免页面拼一份不完整的儿童档案覆盖其他字段。 */
  async function recordBuddyCare(id: ID, command: BuddyCareCommand, at = nowISO()) {
    return database.transaction('rw', [database.childProfiles,database.syncQueue], async () => {
      const existing = await database.childProfiles.get(id)
      if (!existing || existing.deleted) throw new Error('找不到这条儿童档案')
      const care = changeBuddyCare(existing.buddyCare, command, at, adventureDay(new Date(at)))
      const next = { ...existing, buddyCare: care, updatedAt: nowISO() }
      check(validateChildProfile(next))
      await write('childProfiles', next)
      return care
    })
  }

  /* ---------- 每日睡眠与身体记录 ---------- */

  async function saveDailyLog(draft: Draft<DailyLog>): Promise<DailyLog> {
    check(validateDailyLog(draft))
    const childId = draft.childId as ID
    const date = draft.date as DayKey
    const existing = await database.dailyLogs
      .where('[childId+date]')
      .equals([childId, date])
      .first()
    const next: DailyLog = {
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
      childId,
      date,
      sleepTime: (draft.sleepTime as DailyLog['sleepTime']) ?? null,
      wakeTime: (draft.wakeTime as DailyLog['wakeTime']) ?? null,
      nightCongestion: (draft.nightCongestion as DailyLog['nightCongestion']) ?? null,
      nightCough: (draft.nightCough as DailyLog['nightCough']) ?? null,
      snoring: (draft.snoring as DailyLog['snoring']) ?? null,
      nightWaking: (draft.nightWaking as DailyLog['nightWaking']) ?? null,
      morningState: (draft.morningState as DailyLog['morningState']) ?? null,
      daytimeSleepiness:
        (draft.daytimeSleepiness as DailyLog['daytimeSleepiness']) ?? null,
      note: (draft.note as string) ?? null,
    }
    await write('dailyLogs', next)
    return next
  }

  async function getDailyLog(childId: ID, date: DayKey): Promise<DailyLog | undefined> {
    const row = await database.dailyLogs.where('[childId+date]').equals([childId, date]).first()
    return row && !row.deleted ? row : undefined
  }

  async function listDailyLogs(childId: ID, from?: DayKey, to?: DayKey) {
    const rows = alive(await database.dailyLogs.where('childId').equals(childId).toArray())
    return rows
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  }

  /* ---------- 学习任务 ---------- */

  async function listTaskTemplates(childId: ID, includeArchived = false) {
    const rows = alive(await database.taskTemplates.where('childId').equals(childId).toArray())
    return rows
      .filter((r) => includeArchived || !r.archived)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  }

  async function createTaskTemplate(draft: Draft<TaskTemplate>) {
    check(validateTaskTemplate(draft))
    const row: TaskTemplate = stamp({
      id: newId(),
      childId: draft.childId as ID,
      name: `${draft.name}`.trim(),
      subject: `${draft.subject}`.trim(),
      defaultDifficulty: draft.defaultDifficulty as TaskTemplate['defaultDifficulty'],
      defaultMinutes: (draft.defaultMinutes as number) ?? null,
      steps: ((draft.steps as string[]) ?? []).map((s) => s.trim()).filter(Boolean),
      archived: false,
    })
    await write('taskTemplates', row)
    return row
  }

  async function updateTaskTemplate(id: ID, patch: Draft<TaskTemplate>) {
    const existing = await database.taskTemplates.get(id)
    if (!existing) throw new Error('找不到这个任务模板')
    const next = { ...existing, ...patch, id } as TaskTemplate
    check(validateTaskTemplate(next))
    await write('taskTemplates', { ...next, updatedAt: nowISO() })
  }

  async function listTaskRecords(childId: ID, from?: DayKey, to?: DayKey) {
    const rows = alive(await database.taskRecords.where('childId').equals(childId).toArray())
    return rows
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
  }

  async function createTaskRecord(draft: Draft<TaskRecord>) {
    check(validateTaskRecord(draft))
    const row: TaskRecord = stamp({
      id: newId(),
      childId: draft.childId as ID,
      templateId: (draft.templateId as ID) ?? null,
      date: draft.date as DayKey,
      name: `${draft.name}`.trim(),
      subject: `${draft.subject}`.trim(),
      difficulty: draft.difficulty as TaskRecord['difficulty'],
      plannedMinutes: (draft.plannedMinutes as number) ?? null,
      startMode: (draft.startMode as TaskRecord['startMode']) ?? null,
      completion: (draft.completion as TaskRecord['completion']) ?? null,
      barriers: ((draft.barriers as TaskRecord['barriers']) ?? []).slice(),
      actualMinutes: (draft.actualMinutes as number) ?? null,
      parentNote: (draft.parentNote as string) ?? null,
      status: (draft.status as TaskRecord['status']) ?? 'planned',
      timer: (draft.timer as TaskRecord['timer']) ?? null,
      childFeeling: (draft.childFeeling as string) ?? null,
      rewardStars: 2,
    })
    await write('taskRecords', row)
    return row
  }

  async function updateTaskRecord(id: ID, patch: Draft<TaskRecord>) {
    const existing = await database.taskRecords.get(id)
    if (!existing) throw new Error('找不到这条任务记录')
    const next = { ...existing, ...patch, id } as TaskRecord
    check(validateTaskRecord(next))
    await write('taskRecords', { ...next, updatedAt: nowISO() })
    return next
  }

  /* ---------- 家庭规则 ---------- */

  async function seedBuiltinRules(childId: ID) {
    const existing = await database.routineRules.where('childId').equals(childId).count()
    if (existing > 0) return
    const rows: RoutineRule[] = BUILTIN_RULES.map((rule, index) =>
      stamp({
        id: newId(),
        childId,
        builtinKey: rule.builtinKey,
        title: rule.title,
        steps: rule.steps.slice(),
        trigger: rule.trigger,
        customTrigger: null,
        active: true,
        order: index,
      }),
    )
    for (const row of rows) await write('routineRules', row)
  }

  async function listRules(childId: ID) {
    const rows = alive(await database.routineRules.where('childId').equals(childId).toArray())
    return rows.sort((a, b) => a.order - b.order)
  }

  async function createRule(draft: Draft<RoutineRule>) {
    check(validateRoutineRule(draft))
    const all = await listRules(draft.childId as ID)
    const row: RoutineRule = stamp({
      id: newId(),
      childId: draft.childId as ID,
      builtinKey: null,
      category: draft.category ?? 'life',
      rewardStars: draft.rewardStars ?? 1,
      picture: draft.picture ?? undefined,
      description: draft.description?.trim(),
      title: `${draft.title}`.trim(),
      steps: ((draft.steps as string[]) ?? []).map((s) => s.trim()).filter(Boolean),
      trigger: draft.trigger as RoutineRule['trigger'],
      customTrigger: (draft.customTrigger as string) ?? null,
      active: draft.active === undefined ? true : Boolean(draft.active),
      order: all.length,
    })
    await write('routineRules', row)
    return row
  }

  async function updateRule(id: ID, patch: Draft<RoutineRule>) {
    const existing = await database.routineRules.get(id)
    if (!existing) throw new Error('找不到这条规则')
    const next = { ...existing, ...patch, id } as RoutineRule
    check(validateRoutineRule(next))
    await write('routineRules', { ...next, updatedAt: nowISO() })
    return next
  }

  async function listChecks(childId: ID, from?: DayKey, to?: DayKey) {
    const rows = alive(await database.routineChecks.where('childId').equals(childId).toArray())
    return rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
  }

  async function setCheck(
    childId: ID,
    ruleId: ID,
    date: DayKey,
    status: RuleStatus,
    parentNote?: string | null,
    details: Pick<RoutineCheck, 'minutes' | 'studyLevel' | 'studyWords' | 'studyPlan' | 'studyHints' | 'studyAttempts' | 'stepsDone'> = {},
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式不正确')
    const rule = await database.routineRules.get(ruleId)
    if (!rule || rule.childId !== childId) throw new Error('找不到这张打卡图卡')
    if (status === 'done' && rule.minMinutes && (!Number.isFinite(details.minutes) || Number(details.minutes) < rule.minMinutes || Number(details.minutes) > 600)) throw new Error(`请确认累计运动至少${rule.minMinutes}分钟，可以分段休息`)
    const existing = await database.routineChecks
      .where('[ruleId+date]')
      .equals([ruleId, date])
      .first()
    // 准备题目/答题中的partial不是获星快照；首次真正完成才锁定当时的奖励。
    const firstStudyCompletion = existing?.studyPlan && existing.status !== 'done' && !existing.studyWords && status === 'done'
    const row: RoutineCheck = {
      id: existing?.id ?? `check:${childId}:${ruleId}:${date}`,
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
      childId,
      ruleId,
      date,
      status,
      parentNote: parentNote ?? existing?.parentNote ?? null,
      rewardStars: firstStudyCompletion ? rule.rewardStars : existing ? existing.rewardStars : rule.rewardStars,
      minutes: existing?.minutes,
      studyLevel: existing?.studyLevel,
      studyWords: existing?.studyWords,
      studyPlan: existing?.studyPlan,
      studyHints: existing?.studyHints,
      studyAttempts: existing?.studyAttempts,
      stepsDone: existing?.stepsDone,
      ...details,
    }
    check(validateRoutineCheck(row))
    await write('routineChecks', row)
    return row
  }

  async function ensureStudyPlan(childId: ID, ruleId: ID, date: DayKey) {
    return database.transaction('rw', database.routineChecks, database.routineRules, database.syncQueue, async () => {
      const rule = await database.routineRules.get(ruleId)
      if (!rule || rule.childId !== childId || rule.habitKey !== 'picture_words') throw new Error('找不到英语学习图卡')
      const history = await listChecks(childId)
      const existing = history.find(c => c.ruleId === ruleId && c.date === date)
      if (existing?.studyPlan?.length === 8 && new Set(existing.studyPlan).size === 8 && existing.studyPlan.every(word => WORDS.some(w => w.word === word))) return existing.studyPlan
      const plan = dailyWordPlan(date, history)
      await setCheck(childId, ruleId, date, existing?.status ?? 'partial', undefined, { studyPlan: plan })
      return plan
    })
  }

  async function recordStudyHint(childId: ID, ruleId: ID, date: DayKey, word: string) {
    return database.transaction('rw', database.routineChecks, database.routineRules, database.syncQueue, async () => {
      const plan = await ensureStudyPlan(childId, ruleId, date)
      if (!plan.includes(word)) throw new Error('学习单词不在本次练习中')
      const existing = await database.routineChecks.where('[ruleId+date]').equals([ruleId, date]).first()
      if (existing?.studyHints?.includes(word)) return
      await setCheck(childId, ruleId, date, existing?.status ?? 'partial', undefined, { studyHints: [...(existing?.studyHints ?? []), word] })
    })
  }

  async function recordStudyAttempt(childId: ID, ruleId: ID, date: DayKey, attempt: StudyAttempt) {
    return database.transaction('rw', database.routineChecks, database.routineRules, database.syncQueue, async () => {
      const plan = await ensureStudyPlan(childId, ruleId, date)
      if (!plan.includes(attempt.word) || !WORDS.some(w => w.word === attempt.selectedWord)) throw new Error('学习单词不在本次练习中')
      const existing = await database.routineChecks.where('[ruleId+date]').equals([ruleId, date]).first()
      const attempts = existing?.studyAttempts ?? []
      if (attempts.some(a => a.id === attempt.id)) return
      // 只保留每词当天首次作答与首次答错；重做不无限膨胀记录，也不能覆盖曾经答错的事实。
      const sameWord = attempts.filter(a => a.word === attempt.word)
      if (sameWord.length && (attempt.word === attempt.selectedWord || sameWord.some(a => a.word !== a.selectedWord))) return
      await setCheck(childId, ruleId, date, existing?.status ?? 'partial', undefined, { studyAttempts: [...attempts, { ...attempt, revealed: attempt.revealed || Boolean(existing?.studyHints?.includes(attempt.word)) }] })
    })
  }

  /* ---------- 冲突复盘 ---------- */

  async function listConflicts(childId: ID, from?: DayKey, to?: DayKey) {
    const rows = alive(await database.conflictLogs.where('childId').equals(childId).toArray())
    return rows
      .filter((r) => {
        const day = r.occurredAt.slice(0, 10)
        return (!from || day >= from) && (!to || day <= to)
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }

  async function createConflict(draft: Draft<ConflictLog>) {
    check(validateConflictLog(draft))
    const row: ConflictLog = stamp({
      id: newId(),
      childId: draft.childId as ID,
      occurredAt: draft.occurredAt as string,
      trigger: draft.trigger as ConflictLog['trigger'],
      triggerOther: (draft.triggerOther as string) ?? null,
      childDescription: `${draft.childDescription}`.trim(),
      otherDescription: (draft.otherDescription as string) ?? null,
      parentResponse: `${draft.parentResponse}`.trim(),
      resolution: `${draft.resolution}`.trim(),
      nextIdea: `${draft.nextIdea}`.trim(),
      parentNagging: (draft.parentNagging as boolean) ?? null,
      parentComparison: (draft.parentComparison as boolean) ?? null,
      repaired: (draft.repaired as ConflictLog['repaired']) ?? null,
    })
    await write('conflictLogs', row)
    return row
  }

  async function updateConflict(id: ID, patch: Draft<ConflictLog>) {
    const existing = await database.conflictLogs.get(id)
    if (!existing) throw new Error('找不到这条冲突记录')
    const next = { ...existing, ...patch, id } as ConflictLog
    check(validateConflictLog(next))
    await write('conflictLogs', { ...next, updatedAt: nowISO() })
    return next
  }

  /* ---------- 优势事例 ---------- */

  async function listStrengths(childId: ID, from?: DayKey, to?: DayKey) {
    const rows = alive(await database.strengthMoments.where('childId').equals(childId).toArray())
    return rows
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  async function createStrength(draft: Draft<StrengthMoment>) {
    check(validateStrengthMoment(draft))
    const row: StrengthMoment = stamp({
      id: newId(),
      childId: draft.childId as ID,
      date: draft.date as DayKey,
      category: draft.category as StrengthMoment['category'],
      categoryOther: (draft.categoryOther as string) ?? null,
      event: `${draft.event}`.trim(),
      childAction: `${draft.childAction}`.trim(),
      outcome: `${draft.outcome}`.trim(),
      childFeeling: (draft.childFeeling as string) ?? null,
    })
    await write('strengthMoments', row)
    return row
  }

  async function updateStrength(id: ID, patch: Draft<StrengthMoment>) {
    const existing = await database.strengthMoments.get(id)
    if (!existing) throw new Error('找不到这条优势记录')
    const next = { ...existing, ...patch, id } as StrengthMoment
    check(validateStrengthMoment(next))
    await write('strengthMoments', { ...next, updatedAt: nowISO() })
    return next
  }

  /* ---------- 每周复盘 ---------- */

  async function listWeeklyReviews(childId: ID) {
    const rows = alive(await database.weeklyReviews.where('childId').equals(childId).toArray())
    return rows.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  }

  async function saveWeeklyReview(draft: Draft<WeeklyReview>) {
    check(validateWeeklyReview(draft))
    const childId = draft.childId as ID
    const weekStart = draft.weekStart as DayKey
    const existing = await database.weeklyReviews
      .where('[childId+weekStart]')
      .equals([childId, weekStart])
      .first()
    const row: WeeklyReview = {
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
      childId,
      weekStart,
      improvements: (draft.improvements as string) ?? null,
      difficulties: (draft.difficulties as string) ?? null,
      effectiveSupport: (draft.effectiveSupport as string) ?? null,
      conflictSources: (draft.conflictSources as string) ?? null,
      nextAdjustments: (draft.nextAdjustments as string) ?? null,
    }
    await write('weeklyReviews', row)
    return row
  }

  /* ---------- 实验 ---------- */

  async function listExperiments(childId: ID) {
    const rows = alive(await database.experiments.where('childId').equals(childId).toArray())
    return rows.sort((a, b) => b.startDate.localeCompare(a.startDate))
  }

  async function createExperiment(draft: Draft<Experiment>) {
    check(validateExperiment(draft))
    const row: Experiment = stamp({
      id: newId(),
      childId: draft.childId as ID,
      problem: `${draft.problem}`.trim(),
      hypothesis: `${draft.hypothesis}`.trim(),
      adjustment: `${draft.adjustment}`.trim(),
      startDate: draft.startDate as DayKey,
      endDate: draft.endDate as DayKey,
      metrics: ((draft.metrics as string[]) ?? []).map((m) => m.trim()).filter(Boolean),
      result: (draft.result as Experiment['result']) ?? null,
      parentNote: (draft.parentNote as string) ?? null,
    })
    await write('experiments', row)
    return row
  }

  async function updateExperiment(id: ID, patch: Draft<Experiment>) {
    const existing = await database.experiments.get(id)
    if (!existing) throw new Error('找不到这个实验')
    const next = { ...existing, ...patch, id } as Experiment
    check(validateExperiment(next))
    await write('experiments', { ...next, updatedAt: nowISO() })
    return next
  }

  /* ---------- 通用删除 / 清空 ---------- */

  /**
   * 软删除：不真的抹掉这一行，只打上墓碑标记。
   * 这样「删除」本身才能同步到其他设备，也不会被别的设备重新同步回来。
   */
  async function deleteRecord(entity: EntityName, id: ID) {
    if (['familyMembers', 'growthPacts', 'pactSignatures', 'familyChecks', 'familyReactions'].includes(entity)) throw new Error('请在家庭公约中管理，保留签订和打卡记录')
    if (entity === 'bankAccounts' || entity === 'bankEntries') throw new Error('银行记录只能通过银行操作，不能直接删除')
    if (entity === 'adventureRuns') throw new Error('冒险奖励由云端保存，不能单独撤回或重新领取')
    const existing = await tableOf(entity).get(id)
    if (!existing) return
    await write(entity, { ...existing, deleted: true, updatedAt: nowISO() })
  }

  /** 清掉这台设备上的本地数据（含待同步队列）。服务端由同步层另行清空。 */
  async function clearAll() {
    await database.transaction('rw', database.tables, async () => {
      for (const name of [...ENTITY_NAMES, 'settings'] as const) {
        await database[name].clear()
      }
      await database.syncQueue.clear()
    })
  }

  /* ---------- 同步：入队与合并远程 ---------- */

  /** 把一条本地改动放进待同步队列；同一条记录只保留最新一份 */
  async function enqueue(entity: EntityName, row: Record<string, unknown>) {
    const id = String(row.id ?? '')
    if (!id) return
    const payload = JSON.parse(JSON.stringify(row)) as Record<string, unknown>
    const existing = await database.syncQueue
      .where('[entity+recordId]')
      .equals([entity, id])
      .first()
    if (existing?.seq !== undefined) {
      await database.syncQueue.put({ ...existing, payload, enqueuedAt: nowISO() })
    } else {
      await database.syncQueue.add({ entity, recordId: id, payload, enqueuedAt: nowISO() })
    }
  }

  async function listOutbox() {
    return database.syncQueue.orderBy('seq').toArray()
  }

  async function dropFromOutbox(seqs: number[]) {
    if (seqs.length === 0) return
    await database.syncQueue.bulkDelete(seqs)
  }

  /** Acknowledge only the exact snapshot sent; concurrent edits remain queued. */
  async function settleSyncBatch(sent: OutboxEntry[], rejected: SyncRejection[]) {
    await database.transaction('rw', database.syncQueue, database.wishes, async () => {
      for (const item of sent) {
        if (item.seq === undefined) continue
        const current = await database.syncQueue.get(item.seq)
        if (!current || current.enqueuedAt !== item.enqueuedAt || JSON.stringify(current.payload) !== JSON.stringify(item.payload)) continue
        const failure = rejected.find(r => r.entity === item.entity && r.id === item.recordId)
        if (failure) {
          if (failure.entity !== 'wishes' || failure.code !== 'WISH_CONFLICT') continue
          const canonical = failure.canonical
          if (canonical && (canonical.id !== item.recordId || canonical.childId !== item.payload.childId || !validWish(canonical as unknown as Wish))) throw new Error('服务端返回的心愿冲突记录无效，请重试同步。')
          const restored = canonical ?? {...item.payload, status:'approved'}
          if (!validWish(restored as unknown as Wish)) throw new Error('本次申请无法自动退回，请联系家长核对。')
          await database.wishes.put(restored as unknown as Wish)
          if (!canonical) {
            // The gift itself never reached the server. Keep its approved form
            // queued while releasing only the rejected reservation.
            await enqueue('wishes', restored)
            continue
          }
        }
        await database.syncQueue.delete(item.seq)
      }
    })
  }

  async function outboxCount() {
    return database.syncQueue.count()
  }

  /**
   * 把服务端返回的记录合并进本地。
   * 两种情况下不动本地：本地还有没推上去的改动；本地这份不比服务端旧。
   */
  async function applyRemote(entity: EntityName, rows: Record<string, unknown>[]) {
    const table = tableOf(entity)
    return database.transaction('rw', table, database.syncQueue, async () => {
    const pending = new Set(
      (await database.syncQueue.where('entity').equals(entity).toArray()).map((e) => e.recordId),
    )
    let applied = 0
    for (const row of rows) {
      const id = String(row.id ?? '')
      if (!id || pending.has(id)) continue
      const existing = await table.get(id)
      const remoteSeq = Number(row.syncSeq) || 0
      const localSeq = Number(existing?.syncSeq) || 0
      if (existing && (remoteSeq > 0
        ? localSeq > remoteSeq
        : String(existing.updatedAt ?? '') >= String(row.updatedAt ?? ''))) continue
      const next = entity === 'childProfiles' && existing ? {...row, honorClaims: {...(existing.honorClaims as Record<string,string> | undefined), ...(row.honorClaims as Record<string,string> | undefined)}, starClaims: {...(existing.starClaims as Record<string,string> | undefined), ...(row.starClaims as Record<string,string> | undefined)}} : row
      await table.put(next)
      applied += 1
    }
    return applied
    })
  }

  async function setSetting(key: string, value: unknown) {
    await database.settings.put({ key, value: JSON.stringify(value) })
  }

  async function getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await database.settings.get(key)
    if (!row) return fallback
    try {
      return JSON.parse(row.value) as T
    } catch {
      return fallback
    }
  }

  async function countAll(): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const name of ENTITY_NAMES) {
      const rows = await database[name].toArray()
      out[name] = rows.filter((row) => !row.deleted).length
    }
    return out
  }

  return {
    refreshHonors, lightHonorStar,
    lightStar,
    listBankEntries, getBankAccount,
    ensureHabitPlan,
    listAdventures,
    listWishes,
    proposeWish, editWish,
    changeWish,
    db: database,
    setWriteHook,
    listProfiles,
    getPrimaryProfile,
    createProfile,
    updateProfile,
    recordBuddyCare,
    saveDailyLog,
    getDailyLog,
    listDailyLogs,
    listTaskTemplates,
    createTaskTemplate,
    updateTaskTemplate,
    listTaskRecords,
    createTaskRecord,
    updateTaskRecord,
    seedBuiltinRules,
    listRules,
    createRule,
    updateRule,
    listChecks,
    setCheck,
    ensureStudyPlan,
    recordStudyAttempt,
    recordStudyHint,
    listConflicts,
    createConflict,
    updateConflict,
    listStrengths,
    createStrength,
    updateStrength,
    listWeeklyReviews,
    saveWeeklyReview,
    listExperiments,
    createExperiment,
    updateExperiment,
    deleteRecord,
    clearAll,
    setSetting,
    getSetting,
    countAll,
    enqueue,
    listOutbox,
    dropFromOutbox, settleSyncBatch,
    outboxCount,
    applyRemote,
  }
}

export type Repo = ReturnType<typeof createRepo>

export const repo = createRepo(db)
