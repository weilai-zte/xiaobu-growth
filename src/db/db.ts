import Dexie, { type Table } from 'dexie'
import type {
  AdventureRun, BankAccount, BankEntry,
  FamilyMember, GrowthPact, PactSignature, FamilyCheck, FamilyReaction,
  ChildProfile,
  ConflictLog,
  DailyLog,
  Experiment,
  OutboxEntry,
  RoutineCheck,
  RoutineRule,
  SettingRow,
  StrengthMoment,
  SyncStateRow,
  TaskRecord,
  TaskTemplate,
  WeeklyReview,
  Wish,
} from './types'

export class GrowthDB extends Dexie {
  bankAccounts!: Table<BankAccount, string>
  bankEntries!: Table<BankEntry, string>
  familyMembers!: Table<FamilyMember, string>
  growthPacts!: Table<GrowthPact, string>
  pactSignatures!: Table<PactSignature, string>
  familyChecks!: Table<FamilyCheck, string>
  familyReactions!: Table<FamilyReaction, string>
  adventureRuns!: Table<AdventureRun, string>
  wishes!: Table<Wish, string>
  childProfiles!: Table<ChildProfile, string>
  dailyLogs!: Table<DailyLog, string>
  taskTemplates!: Table<TaskTemplate, string>
  taskRecords!: Table<TaskRecord, string>
  routineRules!: Table<RoutineRule, string>
  routineChecks!: Table<RoutineCheck, string>
  conflictLogs!: Table<ConflictLog, string>
  strengthMoments!: Table<StrengthMoment, string>
  weeklyReviews!: Table<WeeklyReview, string>
  experiments!: Table<Experiment, string>
  settings!: Table<SettingRow, string>
  /** 待同步队列：本地写入后先落这里，推给服务端成功后删除 */
  syncQueue!: Table<OutboxEntry, number>
  /** 同步元数据：水位线、上次同步时间、最近错误 */
  syncState!: Table<SyncStateRow, string>

  constructor(name = 'xiaobu-growth') {
    super(name)
    this.version(1).stores({
      childProfiles: 'id, name, isPrimary',
      dailyLogs: 'id, childId, date, &[childId+date]',
      taskTemplates: 'id, childId, name, archived',
      taskRecords: 'id, childId, date, templateId, status',
      routineRules: 'id, childId, trigger, active, order',
      routineChecks: 'id, childId, ruleId, date, &[ruleId+date]',
      conflictLogs: 'id, childId, occurredAt, trigger',
      strengthMoments: 'id, childId, date, category',
      weeklyReviews: 'id, childId, weekStart, &[childId+weekStart]',
      experiments: 'id, childId, startDate, endDate',
      settings: 'key',
    })
    // v2：把本地库从「唯一存储」降级成「本地镜像 + 离线队列」。
    // 同一条记录在队列里只保留最新一份（&[entity+recordId] 唯一索引）。
    this.version(2).stores({
      childProfiles: 'id, name, isPrimary',
      dailyLogs: 'id, childId, date, &[childId+date]',
      taskTemplates: 'id, childId, name, archived',
      taskRecords: 'id, childId, date, templateId, status',
      routineRules: 'id, childId, trigger, active, order',
      routineChecks: 'id, childId, ruleId, date, &[ruleId+date]',
      conflictLogs: 'id, childId, occurredAt, trigger',
      strengthMoments: 'id, childId, date, category',
      weeklyReviews: 'id, childId, weekStart, &[childId+weekStart]',
      experiments: 'id, childId, startDate, endDate',
      settings: 'key',
      syncQueue: '++seq, entity, &[entity+recordId]',
      syncState: 'key',
    })
    this.version(3).stores({ wishes: 'id, childId, status' })
    this.version(4).stores({ adventureRuns: 'id, childId, date, &[childId+date]' })
    this.version(6).stores({ bankAccounts: 'id, childId', bankEntries: 'id, childId, date' })
    this.version(5).stores({
      familyMembers: 'id, childId, role',
      growthPacts: 'id, childId',
      pactSignatures: 'id, childId, pactId',
      familyChecks: 'id, childId, pactId, date',
      familyReactions: 'id, childId, checkId',
    })
  }
}

export const DB_NAME = 'xiaobu-growth'
export const db = new GrowthDB()

export type EntityName =
  | 'bankAccounts' | 'bankEntries'
  | 'familyMembers' | 'growthPacts' | 'pactSignatures' | 'familyChecks' | 'familyReactions'
  | 'adventureRuns'
  | 'wishes'
  | 'childProfiles'
  | 'dailyLogs'
  | 'taskTemplates'
  | 'taskRecords'
  | 'routineRules'
  | 'routineChecks'
  | 'conflictLogs'
  | 'strengthMoments'
  | 'weeklyReviews'
  | 'experiments'

export const ENTITY_NAMES: EntityName[] = [
  'bankAccounts', 'bankEntries',
  'familyMembers', 'growthPacts', 'pactSignatures', 'familyChecks', 'familyReactions',
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

export const ENTITY_LABELS: Record<EntityName, string> = {
  bankAccounts: '星星银行账户', bankEntries: '银行存取与周息',
  familyMembers: '家庭成员', growthPacts: '成长公约', pactSignatures: '公约签订', familyChecks: '家庭打卡', familyReactions: '家庭鼓励',
  adventureRuns: '小步冒险',
  wishes: '心愿礼物',
  childProfiles: '儿童档案',
  dailyLogs: '睡眠与身体记录',
  taskTemplates: '学习任务模板',
  taskRecords: '学习任务记录',
  routineRules: '家庭规则',
  routineChecks: '规则执行记录',
  conflictLogs: '家庭冲突记录',
  strengthMoments: '优势与成长事例',
  weeklyReviews: '每周复盘',
  experiments: '家庭改进实验',
}
