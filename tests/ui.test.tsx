import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { defaultLogDate, todayKey } from '../src/lib/date'
import { containsForbidden } from '../src/lib/feedback'
import { SETTINGS_KEYS } from '../src/lib/settings'

beforeEach(async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  await repo.clearAll()
  window.location.hash = '#/'
})

async function makeChild(name = '小满') {
  return repo.createProfile({ name, nickname: name })
}

describe('引导与档案', () => {
  it('第一次打开时引导建立档案，建好后进入今日首页', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('先建立孩子档案')).toBeInTheDocument()

    await user.type(screen.getByLabelText('名字或称呼'), '小满')
    await user.click(screen.getByRole('button', { name: '建好档案，开始使用' }))

    await waitFor(() => {
      const titles = screen.getAllByRole('heading', { level: 1 })
      expect(titles.some((node) => node.textContent?.includes('小满'))).toBe(true)
    })
    const profiles = await repo.listProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].isPrimary).toBe(true)
  })

  it('档案名字为空时会给出中文提示，不会写入', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('先建立孩子档案')
    await user.click(screen.getByRole('button', { name: '建好档案，开始使用' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('孩子名字不能为空')
    expect(await repo.listProfiles()).toHaveLength(0)
  })
})

describe('今日首页', () => {
  it('最多突出 5 项任务，措辞里没有排名、比较和扣分', async () => {
    const child = await makeChild()
    for (let i = 1; i <= 6; i += 1) {
      await repo.createTaskRecord({
        childId: child.id,
        date: todayKey(),
        name: `任务${i}`,
        subject: '数学',
        difficulty: 'medium',
        status: 'planned',
      })
    }
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('小满')
    await waitFor(() => {
      const shown = screen
        .getAllByRole('heading', { level: 3 })
        .filter((node) => /^任务\d$/.test(node.textContent ?? ''))
      expect(shown).toHaveLength(5)
    })
    expect(screen.getByText(/另外还有 1 项/)).toBeInTheDocument()

    const feedbackCard = document.getElementById('feedback')
    expect(feedbackCard).not.toBeNull()
    const text = feedbackCard?.textContent ?? ''
    expect(containsForbidden(text)).toEqual([])
    expect(text).not.toContain('扣分')
  })

  it('可以记录任务的启动、完成与障碍，并写入数据库', async () => {
    const child = await makeChild()
    const task = await repo.createTaskRecord({
      childId: child.id,
      date: todayKey(),
      name: '口算 20 题',
      subject: '数学',
      difficulty: 'medium',
      status: 'planned',
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '记完成情况' }))
    await user.click(screen.getByLabelText('一次提醒'))
    await user.click(screen.getByLabelText('部分完成'))
    await user.click(screen.getByLabelText('难以开始'))
    await user.type(screen.getByLabelText('实际用时（分钟，可选）'), '12')
    await user.click(screen.getByRole('button', { name: '保存记录' }))

    await waitFor(async () => {
      const records = await repo.listTaskRecords(child.id, todayKey(), todayKey())
      expect(records[0].completion).toBe('partial')
      expect(records[0].startMode).toBe('one_reminder')
      expect(records[0].barriers).toEqual(['hard_to_start'])
      expect(records[0].actualMinutes).toBe(12)
    })
    expect(task.id).toBeTruthy()
  })
})

describe('睡眠记录', () => {
  it('新记录预选无不适，确认保存前不产生记录', async () => {
    const child = await makeChild()
    window.location.hash = '#/sleep'
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('身体与睡眠记录')
    for (const [group, label] of [
      ['夜间鼻塞', '没有'], ['夜间咳嗽', '没有'], ['打鼾或张口呼吸（可选）', '没有'],
      ['夜间醒来情况', '没有醒来'], ['晨起精神状态', '精神不错'], ['白天困倦情况', '不明显'],
    ]) {
      expect(within(screen.getByRole('group', { name: group })).getByRole('radio', { name: label })).toBeChecked()
    }
    expect(await repo.listDailyLogs(child.id)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '保存这天的记录' }))
    await waitFor(async () => {
      expect((await repo.listDailyLogs(child.id))[0]).toMatchObject({
        nightCongestion: 'none', nightCough: 'none', snoring: 'no', nightWaking: 'none',
        morningState: 'refreshed', daytimeSleepiness: 'none', sleepTime: null, wakeTime: null,
      })
    })
  })

  it('已有记录保留原来的不适及未填写选项，不被默认值覆盖', async () => {
    const child = await makeChild()
    await repo.saveDailyLog({ childId: child.id, date: defaultLogDate(), nightCough: 'several', morningState: 'tired' })
    window.location.hash = '#/sleep'
    render(<App />)
    await screen.findByRole('button', { name: '保存修改' })
    await waitFor(() => expect(within(screen.getByRole('group', { name: '夜间咳嗽' })).getByRole('radio', { name: '2-3 次' })).toBeChecked())
    expect(within(screen.getByRole('group', { name: '晨起精神状态' })).getByRole('radio', { name: '有点累' })).toBeChecked()
    expect(within(screen.getByRole('group', { name: '夜间鼻塞' })).getAllByRole('radio').every(r => !(r as HTMLInputElement).checked)).toBe(true)
  })

  it('可以补录、修改和删除某一天的记录', async () => {
    const child = await makeChild()
    window.location.hash = '#/sleep'
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('身体与睡眠记录')

    await user.type(screen.getByLabelText('入睡时间'), '22:10')
    await user.type(screen.getByLabelText('起床时间'), '06:40')
    const coughGroup = screen.getByRole('group', { name: '夜间咳嗽' })
    await user.click(within(coughGroup).getByLabelText('2-3 次'))
    await user.click(screen.getByRole('button', { name: '保存这天的记录' }))

    await waitFor(async () => {
      const logs = await repo.listDailyLogs(child.id)
      expect(logs).toHaveLength(1)
      expect(logs[0].sleepTime).toBe('22:10')
      expect(logs[0].nightCough).toBe('several')
    })
    expect((await screen.findAllByText(/入睡 22:10/)).length).toBeGreaterThan(0)

    // 修改：同一天再存一次是覆盖
    await user.clear(screen.getByLabelText('起床时间'))
    await user.type(screen.getByLabelText('起床时间'), '07:30')
    await user.click(screen.getByRole('button', { name: '保存修改' }))
    await waitFor(async () => {
      const logs = await repo.listDailyLogs(child.id)
      expect(logs).toHaveLength(1)
      expect(logs[0].wakeTime).toBe('07:30')
    })

    // 删除需要确认
    await user.click(screen.getAllByRole('button', { name: '删除' })[0])
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('删除这条记录？')
    await user.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(async () => {
      expect(await repo.listDailyLogs(child.id)).toHaveLength(0)
    })
  })

  it('睡眠表单的无效输入不会写入数据库', async () => {
    const child = await makeChild()
    window.location.hash = '#/sleep'
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('身体与睡眠记录')

    await user.clear(screen.getByLabelText('记录日期'))
    await user.click(screen.getByRole('button', { name: '保存这天的记录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('记录日期格式不正确')
    expect(await repo.listDailyLogs(child.id)).toHaveLength(0)
  })
})

describe('儿童视图与隐私', () => {
  it('孩子选择先做哪件事不产生打卡，点图卡才记录完成', async () => {
    const child = await makeChild('全全')
    await repo.setSetting(SETTINGS_KEYS.childView, true)
    window.location.hash = '#/child'
    const user = userEvent.setup()
    render(<App />)
    const choose = await screen.findByRole('button', { name: /我先做：.*垃圾/ })
    await user.click(choose)
    expect(choose).toHaveAttribute('aria-pressed', 'true')
    expect(await repo.listChecks(child.id)).toHaveLength(0)
    expect(await screen.findByRole('img', { name: '一直微笑着陪你的小鸟小步' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /垃圾放入垃圾桶，点一下完成/ }))
    await waitFor(async () => expect((await repo.listChecks(child.id)).filter(c => c.status === 'done')).toHaveLength(1))
  })
  it('图片心愿可一键选填，选择优先心愿后首页显示同一个目标', async () => {
    const child = await makeChild('全全')
    await repo.setSetting(SETTINGS_KEYS.childView, true)
    window.location.hash = '#/child/progress'
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '一起做小饼干' }))
    expect(screen.getByRole('textbox', { name: '我想要…' })).toHaveValue('一起做小饼干')
    expect(await repo.listWishes(child.id)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '放进心愿小屋' }))
    await user.click(await screen.findByRole('button', { name: '优先攒：一起做小饼干' }))
    const wishes = await repo.listWishes(child.id)
    await waitFor(async () => expect((await repo.getPrimaryProfile())?.focusWishId).toBe(wishes[0].id))
    await user.click(screen.getByRole('link', { name: '我的任务' }))
    expect(await screen.findByText('一起做小饼干')).toBeInTheDocument()
    expect(screen.getByText('和爸爸妈妈一起约定星数')).toBeInTheDocument()
  })
  it('儿童图卡点击即可记录，随后心愿小屋显示星星并保存自选礼物', async () => {
    const child = await makeChild('全全')
    const user = userEvent.setup()
    await repo.setSetting(SETTINGS_KEYS.childView, true)
    window.location.hash = '#/child/rules'
    render(<App />)
    const card = await screen.findByRole('button', { name: /衣物放回固定位置，点一下完成/ })
    await user.click(card)
    expect(await screen.findByRole('button', { name: /衣物放回固定位置，已完成/ })).toBeDisabled()
    const checks = await repo.listChecks(child.id)
    expect(checks.filter(c => c.status === 'done')).toHaveLength(1)
    await user.click(screen.getByRole('link', { name: '心愿小屋' }))
    expect(await screen.findByText('全全的心愿小屋')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: '我想要…' }), '一盒积木')
    await user.click(screen.getByRole('button', { name: '放进心愿小屋' }))
    expect(await screen.findByRole('heading', { name: '一盒积木' })).toBeInTheDocument()
    expect((await repo.listWishes(child.id))[0].status).toBe('proposed')
    expect(screen.queryByRole('button', { name: '确认心愿' })).not.toBeInTheDocument()
  })
  it('儿童视图下打开睡眠页会被挡住，家长模式不受影响', async () => {
    await makeChild()
    await repo.setSetting(SETTINGS_KEYS.childView, true)
    window.location.hash = '#/sleep'
    render(<App />)
    expect(await screen.findByText('这部分需要家长查看')).toBeInTheDocument()
    expect(screen.queryByText('身体与睡眠记录')).toBeNull()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '进入家长模式' }))
    expect(await screen.findByText('身体与睡眠记录')).toBeInTheDocument()
  })
})

describe('数据与隐私设置', () => {
  it('清空全部数据必须输入确认词', async () => {
    const child = await makeChild()
    await repo.createStrength({
      childId: child.id,
      date: todayKey(),
      category: 'care',
      event: '弟弟摔倒',
      childAction: '扶他起来',
      outcome: '弟弟不哭了',
    })
    window.location.hash = '#/settings'
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('数据与隐私设置')

    await user.click(screen.getByRole('button', { name: '清空全部数据' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('清空全部数据？')

    await user.click(screen.getByRole('button', { name: '确认清空' }))
    expect(await screen.findByText('请先输入「清空」两个字')).toBeInTheDocument()
    expect(await repo.listStrengths(child.id)).toHaveLength(1)

    await user.type(screen.getByLabelText('请输入「清空」两个字确认'), '清空')
    await user.click(screen.getByRole('button', { name: '确认清空' }))
    await waitFor(async () => {
      const counts = await repo.countAll()
      expect(Object.values(counts).every((v) => v === 0)).toBe(true)
    })
    expect(await screen.findByText('先建立孩子档案')).toBeInTheDocument()
  })

  it('家长密码只接受 4 位数字，设置后儿童视图需要密码', async () => {
    await makeChild()
    window.location.hash = '#/settings'
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('数据与隐私设置')

    await user.type(screen.getByLabelText('设置或修改家长密码（4 位数字）'), '12')
    await user.click(screen.getByRole('button', { name: '保存密码' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('家长密码需要 4 位数字')

    await user.clear(screen.getByLabelText('设置或修改家长密码（4 位数字）'))
    await user.type(screen.getByLabelText('设置或修改家长密码（4 位数字）'), '2048')
    await user.type(screen.getByLabelText('再输入一次确认'), '2048')
    await user.click(screen.getByRole('button', { name: '保存密码' }))
    await waitFor(async () => {
      const stored = await repo.getSetting(SETTINGS_KEYS.pin, { enabled: false })
      expect(stored.enabled).toBe(true)
    })

    // 切到儿童视图后，敏感页面需要密码
    await user.click(screen.getByRole('button', { name: '儿童视图已关闭' }))
    window.location.hash = '#/weekly'
    expect(await screen.findByLabelText('家长密码')).toBeInTheDocument()
  })
})
