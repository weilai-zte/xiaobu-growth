import type { DailyLog, RoutineCheck, RoutineRule, StrengthMoment, TaskRecord } from '../db/types'
import { LABELS } from '../db/types'
import { formatDuration, sleepDurationMinutes } from './date'

/**
 * 反馈文案生成。硬性约束（有测试守着）：
 * - 不比较（哥哥/弟弟/别人/排名），不贴标签（懒/磨蹭/不专心/故意/不自律），
 * - 不评价速度或正确率，不用「失败」「又没」这类否定措辞，
 * - 不做疾病诊断、不给用药建议，只做中性描述。
 */
export const FORBIDDEN_WORDS = [
  '哥哥',
  '弟弟',
  '姐姐',
  '妹妹',
  '别的孩子',
  '别人家',
  '排名',
  '第一名',
  '最快',
  '比谁',
  '懒',
  '磨蹭',
  '拖拉',
  '不专心',
  '故意',
  '不自律',
  '不听话',
  '失败',
  '又没',
  '退步',
  '差劲',
  '惩罚',
  '扣分',
  '连击',
  '打卡中断',
  '诊断',
  '确诊',
  '用药',
  '吃药',
  '剂量',
  '治疗方法',
  '多动症',
  'ADHD',
]

export function containsForbidden(text: string): string[] {
  return FORBIDDEN_WORDS.filter((word) => text.includes(word))
}

export interface TodayFeedbackInput {
  profileName?: string
  tasks: TaskRecord[]
  checks: Array<{ check: RoutineCheck; rule: RoutineRule }>
  strengths: StrengthMoment[]
}

/** 今日一句积极且具体的反馈 */
export function todayFeedback(input: TodayFeedbackInput): string {
  const name = input.profileName ?? '孩子'
  const parts: string[] = []

  const independentTasks = input.tasks.filter((t) => t.startMode === 'independent')
  const oneReminderTasks = input.tasks.filter((t) => t.startMode === 'one_reminder')
  const finishedTasks = input.tasks.filter(
    (t) => t.completion === 'independent' || t.completion === 'partial',
  )

  if (independentTasks.length > 0) {
    const sample = independentTasks[0]
    parts.push(`“${sample.name}”是自己开始做的`)
  }
  if (finishedTasks.length > 0 && parts.length === 0) {
    parts.push(`完成了 “${finishedTasks[0].name}”`)
  }
  if (oneReminderTasks.length > 0 && parts.length < 2) {
    parts.push(`提醒一次以后就接着做了 “${oneReminderTasks[0].name}”`)
  }

  const doneRules = input.checks.filter((c) => c.check.status === 'done')
  if (doneRules.length > 0 && parts.length < 2) {
    parts.push(`做到了「${doneRules[0].rule.title}」`)
  }
  if (input.strengths.length > 0 && parts.length < 2) {
    const s = input.strengths[0]
    parts.push(`记录到一件${LABELS.strength[s.category]}的事：${s.event}`)
  }

  if (parts.length === 0) {
    return `今天还没有记录，可以先从一件小事开始，比如今天的睡眠时间或者一个已经完成的任务。`
  }
  return `${name}今天有这些值得记下来的地方：${parts.join('；')}。`
}

/** 任务结束后给孩子的具体、温和的反馈 */
export function taskFeedback(record: TaskRecord): string {
  const bits: string[] = []
  if (record.startMode === 'independent') bits.push('你自己决定开始，这一点被记下来了')
  if (record.startMode === 'one_reminder') bits.push('提醒一次之后你接着做了')
  if (record.completion === 'independent') bits.push('这次是自己做完的')
  if (record.completion === 'partial') bits.push('做了一部分，剩下的可以留到下一次')
  if (record.barriers.length > 0) {
    const list = record.barriers.map((b) => LABELS.barrier[b]).join('、')
    bits.push(`这次遇到的困难是${list}，记下来是为了下次能换个办法`)
  }
  if (record.actualMinutes !== null && record.actualMinutes !== undefined) {
    bits.push(`实际用了 ${record.actualMinutes} 分钟`)
  }
  if (bits.length === 0) return '这条记录已经存下来了。'
  return `${bits.join('；')}。`
}

/** 睡眠记录的中性描述，只复述观察到的事实，不做推断 */
export function sleepObservation(log: DailyLog): string {
  const bits: string[] = []
  const duration = sleepDurationMinutes(log.sleepTime, log.wakeTime)
  if (log.sleepTime && log.wakeTime) {
    bits.push(`入睡 ${log.sleepTime}，起床 ${log.wakeTime}，记录到的夜间时长约 ${formatDuration(duration)}`)
  } else if (log.sleepTime) {
    bits.push(`记录到入睡时间 ${log.sleepTime}`)
  } else if (log.wakeTime) {
    bits.push(`记录到起床时间 ${log.wakeTime}`)
  }
  if (log.nightCongestion && log.nightCongestion !== 'none') {
    bits.push(`夜间鼻塞：${LABELS.nightCongestion[log.nightCongestion]}`)
  }
  if (log.nightCough && log.nightCough !== 'none') {
    bits.push(`夜间咳嗽：${LABELS.nightCough[log.nightCough]}`)
  }
  if (log.snoring && log.snoring !== 'no') {
    bits.push(`打鼾或张口呼吸：${LABELS.snoring[log.snoring]}`)
  }
  if (log.nightWaking && log.nightWaking !== 'none') {
    bits.push(`夜间醒来：${LABELS.nightWaking[log.nightWaking]}`)
  }
  if (log.morningState) {
    bits.push(`晨起状态：${LABELS.morningState[log.morningState]}`)
  }
  if (log.daytimeSleepiness && log.daytimeSleepiness !== 'none') {
    bits.push(`白天困倦：${LABELS.daytimeSleepiness[log.daytimeSleepiness]}`)
  }
  if (bits.length === 0) return '这条记录已保存。'
  return `${bits.join('；')}。`
}

export function ruleStatusFeedback(rule: RoutineRule, status: RoutineCheck['status']): string {
  const nextStep = rule.steps[0] ? `下次可以从「${rule.steps[0]}」开始。` : ''
  switch (status) {
    case 'done':
      return `「${rule.title}」这次按步骤完成了，可以一起看一眼是哪一步最顺。`
    case 'partial':
      return `「${rule.title}」这次完成了一部分。${nextStep}`
    case 'not_done':
      return `「${rule.title}」这次没有做。记录这件事本身有用，明天可以再看看哪一步最难。`
    case 'not_applicable':
      return `「${rule.title}」今天不适用，已经标记，不影响任何统计。`
  }
}
