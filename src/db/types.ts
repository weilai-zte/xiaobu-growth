/**
 * 数据模型。所有实体都有稳定 ID、创建时间、更新时间。
 * 日期统一使用「本地自然日」字符串 YYYY-MM-DD（不用 toISOString，避免时区跨日错乱）；
 * 时刻统一使用本地时间字符串 HH:mm；时间戳统一使用 ISO 8601 字符串。
 */

export type ID = string
/** 本地自然日，格式 YYYY-MM-DD */
export type DayKey = string
/** 本地时刻，格式 HH:mm */
export type ClockTime = string
/** ISO 8601 时间戳 */
export type ISOTime = string

export type AdventureRoute = 'meadow' | 'stream' | 'forest'
export interface AdventureRun extends Base {
  childId: ID
  date: DayKey
  route: AdventureRoute
  scene: number
  material: 'leaf' | 'twig' | 'pebble'
  bonusStars: number
}

export const BUDDY_CARE_ACTIONS = ['feed', 'play', 'groom', 'sleep'] as const
export type BuddyCareAction = (typeof BUDDY_CARE_ACTIONS)[number]
export type BuddyActivity = 'idle' | BuddyCareAction | 'adventure'

/** 每日陪伴动作；只累计正向亲密值，不设饥饿或连续签到惩罚。 */
export interface BuddyCareState {
  date: DayKey
  completed: BuddyCareAction[]
  xp: number
  sleepingSince: ISOTime | null
}

export interface Base {
  id: ID
  createdAt: ISOTime
  updatedAt: ISOTime
  /**
   * 软删除墓碑。删除不是真的抹掉这一行，而是打上标记，
   * 这样「删除」这件事本身才能同步到其他设备。
   * 列表查询一律过滤掉带这个标记的记录。
   */
  deleted?: boolean
  /** 服务端分配的同步序号；本地刚写入、还没同步时为空 */
  syncSeq?: number
}

export interface BankAccount extends Base {
  childId: ID
  balance: number
  eligibleBalance: number
  remainder: number
  enabled: boolean
  weeklyRateBps: number
  configuredRateBps: number
  nextInterestDate: DayKey
}
export interface BankEntry extends Base {
  childId: ID
  kind: 'deposit' | 'withdraw' | 'interest' | 'configure'
  amount: number
  date: DayKey
  rateBps?: number
  eligibleBalance?: number
}

export interface Wish extends Base {
  childId: ID
  name: string
  picture: string
  cost: number | null
  status: 'proposed' | 'approved' | 'requested' | 'redeemed'
}

/* ---------- 在线同步 ---------- */

/** 待推送队列里的一条：本地改过、还没成功写回服务端的记录 */
export interface OutboxEntry {
  seq?: number
  entity: string
  recordId: ID
  payload: Record<string, unknown>
  enqueuedAt: ISOTime
}

/** 同步元数据（水位线、上次同步时间等），key-value 存储 */
export interface SyncStateRow {
  key: string
  value: string
}

export interface ChildProfile extends Base {
  honorClaims?: Record<string, string>
  honorsSeenAt?: string

  /** 已手动领取的星座成就，键为星座标识，值为点亮时间。 */
  starClaims?: Record<string, string>
  buddyAccessory?: string | null
  /** 小步的每日照料与累计亲密值，随儿童档案同步。 */
  buddyCare?: BuddyCareState | null
  /** 孩子选中的小屋摆件；只保存标识，物品本身由冒险记录派生。 */
  buddyHomeDecor?: string | null
  name: string
  /** 孩子选择优先攒的心愿，随档案跨设备同步。 */
  focusWishId?: ID | null
  nickname?: string
  birthDate?: DayKey | null
  gradeLabel?: string | null
  avatarEmoji?: string | null
  isPrimary: boolean
  note?: string | null
}

/* ---------- 页面 B：身体与睡眠 ---------- */

export const NIGHT_CONGESTION = ['none', 'mild', 'moderate', 'severe'] as const
export const NIGHT_COUGH = ['none', 'once', 'several', 'frequent'] as const
export const SNORING = ['no', 'sometimes', 'often'] as const
export const NIGHT_WAKING = ['none', 'once', 'twice', 'three_plus'] as const
export const MORNING_STATE = ['refreshed', 'ok', 'tired', 'very_tired'] as const
export const DAYTIME_SLEEPINESS = ['none', 'slight', 'obvious', 'severe'] as const

export type NightCongestion = (typeof NIGHT_CONGESTION)[number]
export type NightCough = (typeof NIGHT_COUGH)[number]
export type Snoring = (typeof SNORING)[number]
export type NightWaking = (typeof NIGHT_WAKING)[number]
export type MorningState = (typeof MORNING_STATE)[number]
export type DaytimeSleepiness = (typeof DAYTIME_SLEEPINESS)[number]

export interface DailyLog extends Base {
  childId: ID
  /** 记录日：以「起床那一天」为归属日 */
  date: DayKey
  /** 入睡时间（昨夜） */
  sleepTime: ClockTime | null
  wakeTime: ClockTime | null
  nightCongestion: NightCongestion | null
  nightCough: NightCough | null
  /** 打鼾或张口呼吸（可选） */
  snoring: Snoring | null
  nightWaking: NightWaking | null
  morningState: MorningState | null
  daytimeSleepiness: DaytimeSleepiness | null
  note?: string | null
}

/* ---------- 页面 C：学习任务 ---------- */

export const DIFFICULTY = ['easy', 'medium', 'hard'] as const
export const START_MODE = ['independent', 'one_reminder', 'multi_reminder'] as const
export const COMPLETION = ['independent', 'partial', 'not_done'] as const
export const BARRIERS = [
  'cannot_do',
  'hard_to_start',
  'distracted',
  'tired',
  'emotion',
  'other',
] as const
export const TASK_STATUS = ['planned', 'running', 'paused', 'finished'] as const

export type Difficulty = (typeof DIFFICULTY)[number]
export type StartMode = (typeof START_MODE)[number]
export type Completion = (typeof COMPLETION)[number]
export type Barrier = (typeof BARRIERS)[number]
export type TaskStatus = (typeof TASK_STATUS)[number]

/** 任务模板：可复用、可拆分步骤的学习任务定义 */
export interface TaskTemplate extends Base {
  childId: ID
  name: string
  subject: string
  defaultDifficulty: Difficulty
  defaultMinutes?: number | null
  steps: string[]
  archived: boolean
}

export interface TaskTimer {
  phase: 'focus' | 'break'
  /** 累计已计时毫秒（不含正在跑的这一段） */
  accumulatedMs: number
  /** 正在计时的起点 ISO 时间；暂停/结束时为 null */
  runningSince: ISOTime | null
}

export interface TaskRecord extends Base {
  /** 缺省为旧版每项5星；新学习任务为2星。 */
  rewardStars?: 1 | 2
  childId: ID
  templateId: ID | null
  date: DayKey
  name: string
  subject: string
  difficulty: Difficulty
  plannedMinutes: number | null
  startMode: StartMode | null
  completion: Completion | null
  barriers: Barrier[]
  actualMinutes: number | null
  parentNote?: string | null
  status: TaskStatus
  timer: TaskTimer | null
  /** 孩子自己选的感受（儿童视图中可选填） */
  childFeeling: string | null
}

/** 孩子可以选择的感受，用词尽量中性 */
export const CHILD_FEELINGS = ['还行', '有点难', '很好玩', '很累', '不想做'] as const

/* ---------- 页面 D：家庭规则与日常流程 ---------- */

export const RULE_TRIGGER = [
  'morning',
  'mealtime',
  'bedtime',
  'screen',
  'anytime',
  'custom',
] as const
export const RULE_STATUS = ['done', 'partial', 'not_done', 'not_applicable'] as const

export type RuleTrigger = (typeof RULE_TRIGGER)[number]
export type RuleStatus = (typeof RULE_STATUS)[number]
export type HabitCategory = 'life' | 'sport' | 'study'
export type HabitKey = 'body' | 'meal' | 'clothes' | 'rope' | 'cycle' | 'picture_words'

export interface RoutineRule extends Base {
  picture?: string
  description?: string
  habitKey?: HabitKey
  category?: HabitCategory
  rewardStars?: 1 | 2
  minMinutes?: number
  childId: ID
  /** 内置规则的稳定 key（自定义规则为 null） */
  builtinKey: string | null
  title: string
  steps: string[]
  trigger: RuleTrigger
  customTrigger?: string | null
  active: boolean
  order: number
}

/** 每天每条规则一条执行记录（childId + ruleId + date 唯一） */
export interface RoutineCheck extends Base {
  rewardStars?: 1 | 2
  minutes?: number
  studyLevel?: Difficulty
  studyWords?: string[]
  stepsDone?: string[]
  childId: ID
  ruleId: ID
  date: DayKey
  status: RuleStatus
  parentNote?: string | null
}

/* ---------- 页面 E：家庭冲突复盘 ---------- */

export const CONFLICT_TRIGGER = [
  'toy',
  'attention',
  'rule_inconsistency',
  'screen',
  'study',
  'other',
] as const
export const REPAIR_STATE = ['yes', 'partly', 'no'] as const

export type ConflictTrigger = (typeof CONFLICT_TRIGGER)[number]
export type RepairState = (typeof REPAIR_STATE)[number]

export interface ConflictLog extends Base {
  childId: ID
  occurredAt: ISOTime
  trigger: ConflictTrigger
  triggerOther?: string | null
  /** 孩子如何描述事情 */
  childDescription: string
  /** 另一方如何描述事情（可选） */
  otherDescription?: string | null
  /** 家长采取了什么处理方式 */
  parentResponse: string
  /** 最终如何解决 */
  resolution: string
  /** 下次可以尝试什么不同的方法 */
  nextIdea: string
  /** 家长自己是否连续催促（仅记录，不评判） */
  parentNagging: boolean | null
  /** 家长自己是否出现兄弟比较（仅记录，不评判） */
  parentComparison: boolean | null
  /** 冲突是否得到修复 */
  repaired: RepairState | null
}

/* ---------- 页面 F：优势与成长事例 ---------- */

export const STRENGTH_CATEGORY = [
  'sport',
  'create',
  'care',
  'organize',
  'solve',
  'other',
] as const

export type StrengthCategory = (typeof STRENGTH_CATEGORY)[number]

export interface StrengthMoment extends Base {
  childId: ID
  date: DayKey
  category: StrengthCategory
  categoryOther?: string | null
  /** 具体事件 */
  event: string
  /** 孩子做了什么 */
  childAction: string
  /** 结果如何 */
  outcome: string
  childFeeling?: string | null
}

/* ---------- 页面 G：每周复盘 ---------- */

export interface WeeklyReview extends Base {
  childId: ID
  /** 周一，YYYY-MM-DD */
  weekStart: DayKey
  improvements?: string | null
  difficulties?: string | null
  effectiveSupport?: string | null
  conflictSources?: string | null
  nextAdjustments?: string | null
}

/* ---------- 实验机制 ---------- */

export const EXPERIMENT_RESULT = ['improved', 'no_change', 'insufficient'] as const
export type ExperimentResult = (typeof EXPERIMENT_RESULT)[number]

export interface Experiment extends Base {
  childId: ID
  problem: string
  hypothesis: string
  adjustment: string
  startDate: DayKey
  endDate: DayKey
  metrics: string[]
  result: ExperimentResult | null
  parentNote?: string | null
}

/* ---------- 设置 ---------- */

export interface SettingRow {
  key: string
  value: string
}

/* ---------- 选项中文标签 ---------- */

export const LABELS = {
  difficulty: { easy: '容易', medium: '适中', hard: '困难' } as Record<Difficulty, string>,
  startMode: {
    independent: '独立启动',
    one_reminder: '一次提醒',
    multi_reminder: '多次提醒',
  } as Record<StartMode, string>,
  completion: {
    independent: '独立完成',
    partial: '部分完成',
    not_done: '未完成',
  } as Record<Completion, string>,
  barrier: {
    cannot_do: '不会做',
    hard_to_start: '难以开始',
    distracted: '容易分心',
    tired: '疲倦',
    emotion: '情绪冲突',
    other: '其他',
  } as Record<Barrier, string>,
  status: {
    planned: '待开始',
    running: '进行中',
    paused: '已暂停',
    finished: '已结束',
  } as Record<TaskStatus, string>,
  ruleTrigger: {
    morning: '早上',
    mealtime: '进餐',
    bedtime: '睡前',
    screen: '使用手机/视频时',
    anytime: '随时',
    custom: '自定义',
  } as Record<RuleTrigger, string>,
  ruleStatus: {
    done: '做到了',
    partial: '做了一部分',
    not_done: '这次没有做到',
    not_applicable: '今天不适用',
  } as Record<RuleStatus, string>,
  conflictTrigger: {
    toy: '物品争抢',
    attention: '父母关注',
    rule_inconsistency: '规则不一致',
    screen: '手机',
    study: '学习',
    other: '其他',
  } as Record<ConflictTrigger, string>,
  repair: { yes: '已经修复', partly: '修复了一部分', no: '还没修复' } as Record<
    RepairState,
    string
  >,
  strength: {
    sport: '运动',
    create: '创造与动手',
    care: '关心他人',
    organize: '组织与合作',
    solve: '独立解决问题',
    other: '其他优势',
  } as Record<StrengthCategory, string>,
  experimentResult: {
    improved: '有所改善',
    no_change: '无明显变化',
    insufficient: '证据不足',
  } as Record<ExperimentResult, string>,
  nightCongestion: {
    none: '没有',
    mild: '轻微',
    moderate: '明显',
    severe: '严重',
  } as Record<NightCongestion, string>,
  nightCough: {
    none: '没有',
    once: '1 次',
    several: '2-3 次',
    frequent: '3 次以上',
  } as Record<NightCough, string>,
  snoring: { no: '没有', sometimes: '偶尔', often: '经常' } as Record<Snoring, string>,
  nightWaking: {
    none: '没有醒来',
    once: '1 次',
    twice: '2 次',
    three_plus: '3 次以上',
  } as Record<NightWaking, string>,
  morningState: {
    refreshed: '精神不错',
    ok: '一般',
    tired: '有点累',
    very_tired: '很累',
  } as Record<MorningState, string>,
  daytimeSleepiness: {
    none: '不明显',
    slight: '偶尔困',
    obvious: '经常困',
    severe: '一直很困',
  } as Record<DaytimeSleepiness, string>,
}

/** 内置家庭规则（第一版自带，可编辑、可暂停） */
export const BUILTIN_RULES: Array<{
  builtinKey: string
  title: string
  steps: string[]
  trigger: RuleTrigger
}> = [
  {
    builtinKey: 'clothes_away',
    title: '换下的衣物放回固定位置',
    steps: ['脱下的衣服放进脏衣篮', '干净衣服叠好放回原处'],
    trigger: 'anytime',
  },
  {
    builtinKey: 'trash_bin',
    title: '垃圾放入垃圾桶',
    steps: ['先找到垃圾桶', '把垃圾丢进去', '需要时把袋子系好'],
    trigger: 'anytime',
  },
  {
    builtinKey: 'meal_safe',
    title: '进餐时安全、整洁地吃饭',
    steps: ['坐稳再吃', '嘴里有食物不说话、不跑动', '吃完把碗筷放到指定位置'],
    trigger: 'mealtime',
  },
  {
    builtinKey: 'bedtime_prep',
    title: '睡前准备衣物和书包',
    steps: ['挑好明天穿的衣服', '书包按课表装好', '把东西放到门口'],
    trigger: 'bedtime',
  },
  {
    builtinKey: 'screen_deal',
    title: '按约定使用手机和视频',
    steps: ['开始前确认看什么、看多久', '到时间后主动交出手机', '交出后选一件替代的事做'],
    trigger: 'screen',
  },
]

/* ---------- 家庭共同成长（v5，旧记录不改写） ---------- */
export interface FamilyMember extends Base {
  childId: ID
  name: string
  role: 'parent' | 'child'
}
export interface GrowthPact extends Base {
  replacesPactId?: ID
  ruleIds?: ID[]
  childId: ID
  title: string
  clauses: { memberId: ID; text: string }[]
  authorId: ID
  sealed: boolean
  archived: boolean
  /** 心愿仍是兑换奖励；这里只引用已有打卡，不另建计星记录。旧公约没有此字段。 */
  wishPlan?: { wishId: ID; ruleIds: ID[]; rewardName: string; rewardCost: number | null }
}
export interface PactSignature extends Base {
  childId: ID
  pactId: ID
  memberId: ID
}
export interface FamilyCheck extends Base {
  childId: ID
  pactId: ID
  clause: number
  memberId: ID
  date: DayKey
}
export interface FamilyReaction extends Base {
  childId: ID
  checkId: ID
  memberId: ID
}
