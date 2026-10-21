import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { repo } from '../src/db/repo'
import { familyRepo } from '../src/lib/family'
import { SETTINGS_KEYS, hashPin } from '../src/lib/settings'
import { todayKey } from '../src/lib/date'

beforeEach(async () => { await repo.clearAll(); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
afterEach(cleanup)
describe('家庭公约界面', () => {
  it('家长发起后，全家在独立签订页各自盖章，并能参与和送鼓励', async () => {
    const childProfile=await repo.createProfile({name:'小满'}),[parent,child]=await familyRepo.ensureMembers(childProfile.id)
    const pact=await familyRepo.createPact(childProfile.id,parent.id,'亲子陪伴',[{memberId:parent.id,text:'放下手机专心陪伴'},{memberId:child.id,text:'玩后收玩具'}])
    await familyRepo.sealPact(pact.id,parent.id);window.location.hash='#/parent/family'
    const user=userEvent.setup();render(<App />)
    await user.click(await screen.findByRole('button',{name:'进入家长模式'}))
    await user.click(await screen.findByRole('link',{name:'全家轮流签订'}))
    await user.selectOptions(await screen.findByRole('combobox',{name:'现在轮到谁'}),parent.id)
    fireEvent.keyDown(await screen.findByRole('button',{name:'家长按指纹，长按1秒签订公约'}),{key:'Enter'})
    await waitFor(async()=>expect(await familyRepo.listSignatures(childProfile.id)).toHaveLength(1),{timeout:3000})
    fireEvent.keyDown(await screen.findByRole('button',{name:'小满按指纹，长按1秒签订公约'}),{key:'Enter'})
    expect(await screen.findByText('全员已签订，公约持续有效。',{}, {timeout:3000})).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox',{name:'现在轮到谁'}),child.id)
    await user.click(screen.getByText('查看家人互动'))
    await user.click(await screen.findByRole('button',{name:'我今天做到了'}))
    await waitFor(async()=>expect(await familyRepo.listChecks(childProfile.id)).toHaveLength(1))
    await familyRepo.checkIn(pact.id,0,parent.id,todayKey())
    await user.click(await screen.findByRole('button',{name:'给家人送鼓励'}))
    await waitFor(async()=>expect(await familyRepo.listReactions(childProfile.id)).toHaveLength(1))
    expect(screen.queryByRole('button',{name:'添加家庭成员'})).not.toBeInTheDocument()
    await user.click(screen.getByRole('link',{name:'返回公约管理'}))
    expect(await screen.findByRole('heading',{name:'这部分需要家长查看'})).toBeVisible()
  })
  it('儿童视图直接打开家长家庭入口受密码门锁保护', async () => {
    await repo.createProfile({ name:'小满' })
    await repo.setSetting(SETTINGS_KEYS.childView,true)
    await repo.setSetting(SETTINGS_KEYS.pin,{enabled:true,salt:'test',hash:hashPin('2468','test')})
    window.location.hash = '#/family'
    render(<App />)
    expect(await screen.findByRole('heading',{name:'这部分需要家长查看'})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'添加家庭成员'})).not.toBeInTheDocument()
  })
  it('公约页可以共同新增和修改草稿，刷新后保留', async () => {
    const child = await repo.createProfile({name:'小满'})
    window.location.hash = '#/family'
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button',{name:'进入家长模式'}))
    await user.click(await screen.findByRole('button',{name:'一起写一份公约'}))
    const fields = screen.getAllByRole('textbox',{name:'我愿意做到（必填）'})
    await user.type(fields[0],'睡前一起读书')
    await user.type(fields[1],'自己收好书')
    await user.click(screen.getByRole('button',{name:'保存公约草稿'}))
    await screen.findByText('草稿保存好了，大家可以继续商量。')
    expect((await familyRepo.listPacts(child.id))[0].clauses).toHaveLength(2)
    await user.click(screen.getByRole('button',{name:'一起修改草稿'}))
    const form = screen.getByRole('heading',{name:'继续商量草稿'}).closest('form')!
    await user.clear(within(form).getByRole('textbox',{name:'公约名称（必填）'}))
    await user.type(within(form).getByRole('textbox',{name:'公约名称（必填）'}),'我们的读书约定')
    await user.click(within(form).getByRole('button',{name:'保存公约草稿'}))
    await screen.findByRole('heading',{name:'我们的读书约定'})
    expect(await repo.outboxCount()).toBeGreaterThan(0)
  })
})

describe('心愿商店闭环', () => {
  it('家长上架奖励，孩子申请与取消，家长兑现只扣一次', async () => {
    const child = await repo.createProfile({name:'小满'})
    const [rule] = await repo.listRules(child.id)
    await repo.setCheck(child.id,rule.id,todayKey(),'done')
    window.location.hash = '#/rewards'
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button',{name:'进入家长模式'}))
    const name = await screen.findByRole('textbox',{name:'我想要…'})
    await user.type(name,'一起去公园')
    const cost=screen.getByRole('spinbutton',{name:'上架所需星数（必填）'})
    await user.clear(cost); await user.type(cost,'5')
    await waitFor(()=>expect(screen.getByRole('button',{name:'上架心愿商店'})).toBeEnabled())
    await user.click(screen.getByRole('button',{name:'上架心愿商店'}))
    await screen.findByText('奖励已上架心愿商店，孩子可以开始攒星兑换啦！',{}, {timeout:5000})
    await user.click(screen.getByRole('button',{name:'返回儿童端'}))
    window.location.hash = '#/child/progress'
    await user.click(await screen.findByRole('button',{name:'我要兑换'}))
    await screen.findByText('申请记好了，等爸爸妈妈来兑现。')
    expect((await repo.listWishes(child.id))[0].status).toBe('requested')
    await user.click(screen.getByRole('button',{name:'暂时不换'}))
    await user.click(await screen.findByRole('button',{name:'我要兑换'}))
    window.location.hash = '#/rewards'
    await user.click(await screen.findByRole('button',{name:'进入家长模式'}))
    await user.click(await screen.findByRole('button',{name:'确认已送出礼物'}))
    await screen.findByText('礼物已兑现，记录好了！')
    expect((await repo.listWishes(child.id))[0].status).toBe('redeemed')
    expect(screen.queryByRole('button',{name:'确认已送出礼物'})).not.toBeInTheDocument()
  })
})

describe('原有习惯入口回归', () => {
  it('儿童打卡页保留原有三类习惯和自定义内容，不改写历史', async () => {
    const child = await repo.createProfile({name:'小满'})
    await repo.ensureHabitPlan(child.id)
    const custom = await repo.createRule({childId:child.id,title:'我原来设定的整理桌面',category:'life',rewardStars:1,steps:['书本归位'],trigger:'anytime'})
    const before = await repo.listRules(child.id)
    await repo.setSetting(SETTINGS_KEYS.childView,true)
    window.location.hash = '#/child'
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button',{name:/我原来设定的整理桌面，查看步骤/})
    await user.click(screen.getByRole('button',{name:/运动打卡/}))
    expect(await screen.findByRole('button',{name:/跳绳至少5分钟，查看步骤/})).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/骑自行车约20分钟，查看步骤/})).toBeInTheDocument()
    await user.click(screen.getByRole('button',{name:/学习打卡/}))
    expect(await screen.findByRole('link',{name:/英语看图选词/})).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'每日打卡'})).toHaveAttribute('href','#/child')
    expect(await repo.listRules(child.id)).toEqual(before)
    expect((await repo.listRules(child.id)).some(r=>r.id===custom.id)).toBe(true)
  })
})
