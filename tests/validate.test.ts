import { describe, expect, it } from 'vitest'
import {
  validateChildProfile,
  validateConflictLog,
  validateDailyLog,
  validateExperiment,
  validatePin,
  validateRoutineRule,
  validateStrengthMoment,
  validateTaskRecord,
  validateTaskTemplate,
  validateWeeklyReview,
} from '../src/lib/validate'

describe('数据校验', () => {
  it('儿童档案必须有名字，出生日期格式要合法', () => {
    expect(validateChildProfile({ name: '  ' }).ok).toBe(false)
    expect(validateChildProfile({ name: '小满', birthDate: '2020-13-01' }).ok).toBe(false)
    expect(validateChildProfile({ name: '小满', birthDate: '2018-05-01' }).ok).toBe(true)
  })

  it('小步照料数据只接受当天动作、非负整数亲密值和合法入睡时间', () => {
    expect(validateChildProfile({
      name: '小满',
      buddyCare: {
        date: '2026-10-20',
        completed: ['feed', 'sleep'],
        xp: 2,
        sleepingSince: '2026-10-20T21:30:00+08:00',
      },
    }).ok).toBe(true)
    expect(validateChildProfile({
      name: '小满',
      buddyCare: {
        date: '2026-13-20',
        completed: ['feed', 'feed'],
        xp: -1,
        sleepingSince: '昨晚',
      },
    }).errors).toEqual(expect.arrayContaining([
      '小步照料日期格式不正确',
      '小步照料记录无效',
      '小步亲密值无效',
      '小步入睡时间格式不正确',
    ]))
  })

  it('睡眠记录：时刻格式、枚举与空记录', () => {
    expect(
      validateDailyLog({ date: '2026-10-16', sleepTime: '25:00', morningState: 'ok' }).ok,
    ).toBe(false)
    expect(
      validateDailyLog({ date: '2026-10-16', sleepTime: '22:10', wakeTime: '06:40' }).ok,
    ).toBe(true)
    expect(validateDailyLog({ date: '2026-10-16' }).errors).toContain('至少填写一项记录内容')
    expect(
      validateDailyLog({ date: 'x', morningState: 'good' as never, sleepTime: '22:00' }).ok,
    ).toBe(false)
  })

  it('任务模板：名称、时长范围与空步骤', () => {
    expect(
      validateTaskTemplate({
        name: '口算',
        subject: '数学',
        defaultDifficulty: 'medium',
        defaultMinutes: 15,
        steps: ['拿出本子'],
      }).ok,
    ).toBe(true)
    expect(
      validateTaskTemplate({ name: '', subject: '数学', defaultDifficulty: 'medium' }).ok,
    ).toBe(false)
    expect(
      validateTaskTemplate({
        name: '口算',
        subject: '数学',
        defaultDifficulty: 'medium',
        defaultMinutes: 999,
      }).ok,
    ).toBe(false)
    expect(
      validateTaskTemplate({
        name: '口算',
        subject: '数学',
        defaultDifficulty: 'medium',
        steps: ['第一步', '   '],
      }).errors,
    ).toContain('任务步骤里有空步骤，请填写或删除')
  })

  it('任务记录：难度必填、障碍取值受限', () => {
    expect(
      validateTaskRecord({
        name: '听写',
        subject: '语文',
        date: '2026-10-16',
        difficulty: 'hard',
        barriers: ['distracted'],
      }).ok,
    ).toBe(true)
    expect(validateTaskRecord({ name: '听写', subject: '语文', date: '2026-10-16' }).ok).toBe(
      false,
    )
    expect(
      validateTaskRecord({
        name: '听写',
        subject: '语文',
        date: '2026-10-16',
        difficulty: 'hard',
        barriers: ['lazy' as never],
      }).ok,
    ).toBe(false)
  })

  it('家庭规则：自定义触发时机必须填写', () => {
    expect(
      validateRoutineRule({ title: '放学后放书包', trigger: 'custom', steps: ['放书包'] }).errors,
    ).toContain('自定义触发时机不能为空')
    expect(
      validateRoutineRule({
        title: '放学后放书包',
        trigger: 'custom',
        customTrigger: '放学回家',
      }).ok,
    ).toBe(true)
  })

  it('冲突复盘：时间、情境与必填描述', () => {
    const base = {
      occurredAt: new Date().toISOString(),
      trigger: 'toy' as const,
      childDescription: '他说是我先拿的',
      parentResponse: '我先把两个人分开',
      resolution: '约定轮流玩',
      nextIdea: '下一次先定顺序',
    }
    expect(validateConflictLog(base).ok).toBe(true)
    expect(validateConflictLog({ ...base, occurredAt: 'not-a-date' }).ok).toBe(false)
    expect(validateConflictLog({ ...base, resolution: '' }).ok).toBe(false)
    expect(validateConflictLog({ ...base, trigger: 'other', triggerOther: '' }).ok).toBe(false)
  })

  it('优势事例：不接受只有标签没有事实', () => {
    expect(
      validateStrengthMoment({
        date: '2026-10-16',
        category: 'care',
        event: '',
        childAction: '扶起弟弟',
        outcome: '弟弟不哭了',
      }).ok,
    ).toBe(false)
    expect(
      validateStrengthMoment({
        date: '2026-10-16',
        category: 'care',
        event: '弟弟摔倒',
        childAction: '扶起弟弟',
        outcome: '弟弟不哭了',
      }).ok,
    ).toBe(true)
  })

  it('每周复盘：周起点必须是周一', () => {
    expect(validateWeeklyReview({ weekStart: '2026-10-12' }).ok).toBe(true)
    expect(validateWeeklyReview({ weekStart: '2026-10-14' }).errors).toContain(
      '一周的起点必须是周一',
    )
  })

  it('实验：结束日期不能早于开始日期，且必须有观察指标', () => {
    const base = {
      problem: '睡前很难开始',
      hypothesis: '拆小步骤会有帮助',
      adjustment: '每次只给一个指令',
      startDate: '2026-10-12',
      endDate: '2026-10-18',
      metrics: ['独立启动次数'],
    }
    expect(validateExperiment(base).ok).toBe(true)
    expect(validateExperiment({ ...base, endDate: '2026-10-01' }).errors).toContain(
      '结束日期不能早于开始日期',
    )
    expect(validateExperiment({ ...base, metrics: [] }).ok).toBe(false)
  })

  it('家长密码必须是 4 位数字', () => {
    expect(validatePin('1234').ok).toBe(true)
    expect(validatePin('123').ok).toBe(false)
    expect(validatePin('12a4').ok).toBe(false)
  })
})
