import type { EntityName, GrowthDB } from '../db/db'
import { ENTITY_LABELS, ENTITY_NAMES } from '../db/db'
import { LABELS } from '../db/types'
import { validWish } from './rewards'
import { validAdventure } from './adventure'
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
} from './validate'
import { formatDateTime, isDayKey } from './date'

export const EXPORT_VERSION = 1
export const EXPORT_APP_ID = 'xiaobu-growth'

export interface ExportBundle {
  app: string
  version: number
  exportedAt: string
  counts: Record<string, number>
  data: Record<string, Record<string, unknown>[]>
}

/** 各实体在合并导入时的自然唯一键，用于避免重复数据 */
const NATURAL_KEYS: Partial<Record<EntityName, string[]>> = {
  adventureRuns: ['childId', 'date'],
  dailyLogs: ['childId', 'date'],
  routineChecks: ['ruleId', 'date'],
  weeklyReviews: ['childId', 'weekStart'],
}

const VALIDATORS: Partial<Record<EntityName, (row: Draft<never>) => ValidationResult>> = {
  routineChecks: validateRoutineCheck as never,
  adventureRuns: (row) => validAdventure(row) ? { ok: true, errors: [] } : { ok: false, errors: ['冒险记录无效'] },
  wishes: (row) => validWish(row) ? { ok: true, errors: [] } : { ok: false, errors: ['心愿内容或星数无效'] },
  childProfiles: validateChildProfile as never,
  dailyLogs: validateDailyLog as never,
  taskTemplates: validateTaskTemplate as never,
  taskRecords: validateTaskRecord as never,
  routineRules: validateRoutineRule as never,
  conflictLogs: validateConflictLog as never,
  strengthMoments: validateStrengthMoment as never,
  weeklyReviews: validateWeeklyReview as never,
  experiments: validateExperiment as never,
}

export async function buildExportBundle(database: GrowthDB): Promise<ExportBundle> {
  const data: Record<string, Record<string, unknown>[]> = {}
  const counts: Record<string, number> = {}
  for (const name of ENTITY_NAMES) {
    // 墓碑只是同步用的标记，不该出现在导出的备份里
    const rows = ((await database[name].toArray()) as unknown as Record<string, unknown>[]).filter(
      (row) => !row.deleted,
    )
    data[name] = rows
    counts[name] = rows.length
  }
  const settings = (await database.settings.toArray()).filter(row => row.key !== 'sync.familyKey')
  data.settings = settings as unknown as Record<string, unknown>[]
  counts.settings = settings.length
  return {
    app: EXPORT_APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    data,
  }
}

export function bundleToJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2)
}

export function parseBundle(text: string): ExportBundle {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('这个文件不是有效的 JSON，无法恢复。')
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('备份文件内容为空。')
  const bundle = raw as Partial<ExportBundle>
  if (bundle.app !== EXPORT_APP_ID) {
    throw new Error('这不是「小步成长」导出的备份文件。')
  }
  if (typeof bundle.version !== 'number' || bundle.version > EXPORT_VERSION) {
    throw new Error('备份文件版本比当前应用新，请先升级应用再恢复。')
  }
  if (!bundle.data || typeof bundle.data !== 'object') {
    throw new Error('备份文件缺少数据部分，无法恢复。')
  }
  return {
    app: EXPORT_APP_ID,
    version: bundle.version,
    exportedAt: bundle.exportedAt ?? '',
    counts: bundle.counts ?? {},
    data: bundle.data as Record<string, Record<string, unknown>[]>,
  }
}

export interface ImportReport {
  mode: 'merge' | 'replace'
  added: number
  skippedDuplicate: number
  skippedInvalid: number
  perEntity: Record<
    string,
    { added: number; skippedDuplicate: number; skippedInvalid: number }
  >
  invalidMessages: string[]
}

function naturalKeyOf(entity: EntityName, row: Record<string, unknown>): string | null {
  const keys = NATURAL_KEYS[entity]
  if (!keys) return null
  const values = keys.map((k) => `${row[k] ?? ''}`)
  if (values.some((v) => v === '')) return null
  return `${entity}:${values.join('|')}`
}

export async function importBundle(
  database: GrowthDB,
  bundle: ExportBundle,
  mode: 'merge' | 'replace' = 'merge',
): Promise<ImportReport> {
  const report: ImportReport = {
    mode,
    added: 0,
    skippedDuplicate: 0,
    skippedInvalid: 0,
    perEntity: {},
    invalidMessages: [],
  }

  await database.transaction('rw', database.tables, async () => {
    if (mode === 'replace') {
      for (const table of database.tables) await table.clear()
    }

    const existingNaturalKeys = new Set<string>()
    const existingIds = new Set<string>()
    for (const name of ENTITY_NAMES) {
      const rows = await database[name].toArray()
      for (const row of rows) {
        existingIds.add(`${name}:${row.id}`)
        const key = naturalKeyOf(name, row as unknown as Record<string, unknown>)
        if (key) existingNaturalKeys.add(key)
      }
    }

    for (const name of ENTITY_NAMES) {
      const rows = bundle.data[name] ?? []
      const bucket = { added: 0, skippedDuplicate: 0, skippedInvalid: 0 }
      report.perEntity[name] = bucket
      for (const row of rows) {
        const id = row.id
        if (typeof id !== 'string' || id.length === 0) {
          bucket.skippedInvalid += 1
          report.invalidMessages.push(`${ENTITY_LABELS[name]}：有一条记录缺少 ID，已跳过`)
          continue
        }
        if (existingIds.has(`${name}:${id}`)) {
          bucket.skippedDuplicate += 1
          continue
        }
        const natural = naturalKeyOf(name, row)
        if (natural && existingNaturalKeys.has(natural)) {
          bucket.skippedDuplicate += 1
          continue
        }
        const validator = VALIDATORS[name]
        if (validator) {
          const result = validator(row as never)
          if (!result.ok) {
            bucket.skippedInvalid += 1
            report.invalidMessages.push(
              `${ENTITY_LABELS[name]}：一条记录校验不通过（${result.errors[0]}），已跳过`,
            )
            continue
          }
        }
        await database[name].put(row as never)
        existingIds.add(`${name}:${id}`)
        if (natural) existingNaturalKeys.add(natural)
        bucket.added += 1
      }
      report.added += bucket.added
      report.skippedDuplicate += bucket.skippedDuplicate
      report.skippedInvalid += bucket.skippedInvalid
    }
  })

  return report
}

/* ---------------- CSV ---------------- */

type ColumnKind = 'text' | 'day' | 'time' | 'datetime' | 'bool' | 'number' | 'array' | 'enum'

interface Column {
  key: string
  label: string
  kind?: ColumnKind
  labels?: Record<string, string>
}

export const CSV_COLUMNS: Record<string, Column[]> = {
  adventureRuns: [
    { key: 'id', label: 'ID' }, { key: 'date', label: '冒险日期', kind: 'day' },
    { key: 'route', label: '路线' }, { key: 'scene', label: '故事编号', kind: 'number' },
    { key: 'material', label: '筑巢材料' }, { key: 'bonusStars', label: '奖励星星', kind: 'number' },
    { key: 'createdAt', label: '记录时间', kind: 'datetime' },
  ],
  wishes: [
    { key: 'id', label: 'ID' }, { key: 'name', label: '心愿' },
    { key: 'cost', label: '兑换星数', kind: 'number' }, { key: 'status', label: '状态' },
    { key: 'updatedAt', label: '更新时间', kind: 'datetime' },
  ],
  childProfiles: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '名字' },
    { key: 'nickname', label: '小名' },
    { key: 'focusWishId', label: '优先心愿 ID' },
    { key: 'birthDate', label: '出生日期', kind: 'day' },
    { key: 'gradeLabel', label: '年级' },
    { key: 'isPrimary', label: '主要档案', kind: 'bool' },
    { key: 'note', label: '备注' },
    { key: 'createdAt', label: '创建时间', kind: 'datetime' },
    { key: 'updatedAt', label: '更新时间', kind: 'datetime' },
  ],
  dailyLogs: [
    { key: 'id', label: 'ID' },
    { key: 'date', label: '记录日期', kind: 'day' },
    { key: 'sleepTime', label: '入睡时间' },
    { key: 'wakeTime', label: '起床时间' },
    {
      key: 'nightCongestion',
      label: '夜间鼻塞',
      kind: 'enum',
      labels: LABELS.nightCongestion,
    },
    { key: 'nightCough', label: '夜间咳嗽', kind: 'enum', labels: LABELS.nightCough },
    { key: 'snoring', label: '打鼾或张口呼吸', kind: 'enum', labels: LABELS.snoring },
    { key: 'nightWaking', label: '夜间醒来', kind: 'enum', labels: LABELS.nightWaking },
    { key: 'morningState', label: '晨起精神状态', kind: 'enum', labels: LABELS.morningState },
    {
      key: 'daytimeSleepiness',
      label: '白天困倦',
      kind: 'enum',
      labels: LABELS.daytimeSleepiness,
    },
    { key: 'note', label: '备注' },
    { key: 'updatedAt', label: '更新时间', kind: 'datetime' },
  ],
  taskTemplates: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '任务名称' },
    { key: 'subject', label: '学科/领域' },
    { key: 'defaultDifficulty', label: '默认难度', kind: 'enum', labels: LABELS.difficulty },
    { key: 'defaultMinutes', label: '建议时长（分钟）', kind: 'number' },
    { key: 'steps', label: '步骤', kind: 'array' },
    { key: 'archived', label: '已归档', kind: 'bool' },
  ],
  taskRecords: [
    { key: 'rewardStars', label: '完成星数（空为旧版5星）', kind: 'number' },
    { key: 'id', label: 'ID' },
    { key: 'date', label: '日期', kind: 'day' },
    { key: 'name', label: '任务名称' },
    { key: 'subject', label: '学科/领域' },
    { key: 'difficulty', label: '难度', kind: 'enum', labels: LABELS.difficulty },
    { key: 'plannedMinutes', label: '计划时长（分钟）', kind: 'number' },
    { key: 'startMode', label: '启动情况', kind: 'enum', labels: LABELS.startMode },
    { key: 'completion', label: '完成状态', kind: 'enum', labels: LABELS.completion },
    { key: 'barriers', label: '主要障碍', kind: 'array', labels: LABELS.barrier },
    { key: 'actualMinutes', label: '实际用时（分钟）', kind: 'number' },
    { key: 'parentNote', label: '家长备注' },
    { key: 'childFeeling', label: '孩子的感受' },
    { key: 'updatedAt', label: '更新时间', kind: 'datetime' },
  ],
  routineRules: [
    { key: 'picture', label: '图片' }, { key: 'description', label: '打卡说明' },
    { key: 'category', label: '打卡分类' }, { key: 'rewardStars', label: '星数', kind: 'number' },
    { key: 'id', label: 'ID' },
    { key: 'title', label: '规则' },
    { key: 'steps', label: '步骤', kind: 'array' },
    { key: 'trigger', label: '触发时机', kind: 'enum', labels: LABELS.ruleTrigger },
    { key: 'customTrigger', label: '自定义时机' },
    { key: 'active', label: '启用中', kind: 'bool' },
  ],
  routineChecks: [
    { key: 'rewardStars', label: '完成星数（空为旧版5星）', kind: 'number' },
    { key: 'minutes', label: '运动分钟数', kind: 'number' }, { key: 'studyLevel', label: '学习难度' },
    { key: 'studyWords', label: '练习单词', kind: 'array' }, { key: 'stepsDone', label: '完成步骤', kind: 'array' },
    { key: 'id', label: 'ID' },
    { key: 'ruleId', label: '规则 ID' },
    { key: 'date', label: '日期', kind: 'day' },
    { key: 'status', label: '执行情况', kind: 'enum', labels: LABELS.ruleStatus },
    { key: 'parentNote', label: '备注' },
  ],
  conflictLogs: [
    { key: 'id', label: 'ID' },
    { key: 'occurredAt', label: '发生时间', kind: 'datetime' },
    { key: 'trigger', label: '触发情境', kind: 'enum', labels: LABELS.conflictTrigger },
    { key: 'triggerOther', label: '其他情境' },
    { key: 'childDescription', label: '孩子的描述' },
    { key: 'otherDescription', label: '另一方的描述' },
    { key: 'parentResponse', label: '家长处理方式' },
    { key: 'resolution', label: '如何解决' },
    { key: 'nextIdea', label: '下次可以尝试的方法' },
    { key: 'parentNagging', label: '家长连续催促', kind: 'bool' },
    { key: 'parentComparison', label: '家长出现比较', kind: 'bool' },
    { key: 'repaired', label: '是否修复', kind: 'enum', labels: LABELS.repair },
  ],
  strengthMoments: [
    { key: 'id', label: 'ID' },
    { key: 'date', label: '日期', kind: 'day' },
    { key: 'category', label: '优势类别', kind: 'enum', labels: LABELS.strength },
    { key: 'categoryOther', label: '其他说明' },
    { key: 'event', label: '具体事件' },
    { key: 'childAction', label: '孩子做了什么' },
    { key: 'outcome', label: '结果如何' },
    { key: 'childFeeling', label: '孩子的感受' },
  ],
  weeklyReviews: [
    { key: 'id', label: 'ID' },
    { key: 'weekStart', label: '周起始（周一）', kind: 'day' },
    { key: 'improvements', label: '本周的改善' },
    { key: 'difficulties', label: '仍然困难的情境' },
    { key: 'effectiveSupport', label: '有效的支持方式' },
    { key: 'conflictSources', label: '增加冲突的方法' },
    { key: 'nextAdjustments', label: '下周准备调整的事' },
  ],
  experiments: [
    { key: 'id', label: 'ID' },
    { key: 'problem', label: '问题' },
    { key: 'hypothesis', label: '假设' },
    { key: 'adjustment', label: '调整措施' },
    { key: 'startDate', label: '开始日期', kind: 'day' },
    { key: 'endDate', label: '结束日期', kind: 'day' },
    { key: 'metrics', label: '观察指标', kind: 'array' },
    {
      key: 'result',
      label: '结果',
      kind: 'enum',
      labels: LABELS.experimentResult,
    },
    { key: 'parentNote', label: '家长备注' },
  ],
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = `${value}`
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function formatCell(value: unknown, column: Column): string {
  if (value === null || value === undefined) return ''
  switch (column.kind) {
    case 'bool':
      return value === true ? '是' : '否'
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? formatDateTime(value)
        : `${value}`
    case 'enum':
      return column.labels?.[`${value}`] ?? `${value}`
    case 'array':
      return Array.isArray(value)
        ? value.map((v) => column.labels?.[`${v}`] ?? `${v}`).join('；')
        : `${value}`
    case 'number':
      return Number.isFinite(Number(value)) ? `${value}` : ''
    default:
      return `${value}`
  }
}

export function rowsToCsv(rows: Record<string, unknown>[], entity: EntityName): string {
  const columns = CSV_COLUMNS[entity]
  if (!columns) throw new Error(`没有为 ${entity} 定义导出列`)
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const lines = rows.map((row) =>
    columns.map((column) => csvCell(formatCell(row[column.key], column))).join(','),
  )
  // 加 BOM，Excel 打开中文不乱码
  return `\ufeff${[header, ...lines].join('\r\n')}\r\n`
}

export function csvFileName(entity: EntityName, exportedAt: string): string {
  const day = exportedAt.slice(0, 10)
  return `xiaobu-growth-${entity}-${day}.csv`
}

export function jsonFileName(exportedAt: string): string {
  const stamp = exportedAt.slice(0, 16).replace(/[:T]/g, '-')
  return `xiaobu-growth-backup-${stamp}.json`
}

export function summarizeBundle(bundle: ExportBundle): string {
  const parts: string[] = []
  for (const name of [...ENTITY_NAMES, 'settings' as const]) {
    const count = bundle.counts[name] ?? 0
    if (count > 0) parts.push(`${ENTITY_LABELS[name as EntityName] ?? '设置'} ${count} 条`)
  }
  return parts.length > 0 ? parts.join('，') : '备份里没有任何记录'
}

export function isSupportedDayKey(value: unknown): boolean {
  return isDayKey(value)
}
