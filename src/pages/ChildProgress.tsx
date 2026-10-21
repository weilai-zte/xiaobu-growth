import { Bank } from '../components/Bank'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { BADGES, focusedWish, starBalance } from '../lib/rewards'
import { Card } from '../components/ui'
import { PlayPicture, Celebration, TinyStar } from '../components/PlayCards'
import { BirdGrowth, GrowthTrail, WishGoal } from '../components/GrowthJourney'
import { uniqueAdventures } from '../lib/adventure'
import { todayKey } from '../lib/date'
import { ConstellationMap } from '../components/ConstellationMap'
import { familyRepo } from '../lib/family'
import { Link } from 'react-router-dom'
import { CheckinHeatmap } from '../components/CheckinHeatmap'

const PICTURES = [{ key: 'gift', label: '礼物' }, { key: 'ball', label: '运动' }, { key: 'book', label: '图书' }, { key: 'paint', label: '画画' }, { key: 'picnic', label: '出游' }]
const WISH_IDEAS = [
  { name: '一起去公园野餐', picture: 'picnic' },
  { name: '一起做小饼干', picture: 'bake' },
  { name: '和家人一起骑车', picture: 'bicycle' },
  { name: '挑一本喜欢的绘本', picture: 'book' },
]

export function ChildProgress({ parent = false }: { parent?: boolean }) {
  const { profile } = useApp()
  const [params] = useSearchParams()
  const childId = profile?.id
  const data = useLiveQuery(async () => childId ? {
    rules: await repo.listRules(childId), members: await familyRepo.listMembers(childId), pacts: await familyRepo.listPacts(childId), signatures: await familyRepo.listSignatures(childId), familyChecks: await familyRepo.listChecks(childId), tasks: await repo.listTaskRecords(childId), checks: await repo.listChecks(childId), wishes: await repo.listWishes(childId), strengths: await repo.listStrengths(childId), adventures: await repo.listAdventures(childId), bankEntries: await repo.listBankEntries(childId),
  } : undefined, [childId])
  useEffect(() => { if (childId) void familyRepo.ensureMembers(childId).catch(() => setMessage('家庭成员没有准备好，请刷新后重试。')) }, [childId])
  const [editWishId,setEditWishId]=useState('')
  const [name, setName] = useState('')
  const [picture, setPicture] = useState('gift')
  const [shopCost, setShopCost] = useState('10')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [costs, setCosts] = useState<Record<string, string>>({})
  const balance = starBalance(data?.tasks ?? [], data?.checks ?? [], data?.wishes ?? [], data?.adventures ?? [], data?.bankEntries ?? [], profile?.starClaims)
  const nextBadge = BADGES.find(b => b.at > balance.earned)
  const focus = focusedWish(data?.wishes ?? [], profile?.focusWishId)
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try { await action(); setMessage(success) } catch (error) { setMessage(error instanceof Error ? error.message : '没有保存成功，请再试一次') } finally { setBusy(false) }
  }
  return <div className="play-world">
    <section className="play-hero wish-hero shop-compact-hero"><div><span className="play-eyebrow">{parent ? '家长管理' : `${profile?.nickname || profile?.name || '我'}的心愿小屋`}</span><h1>{parent ? '星星与礼物' : '小小心愿'}</h1><p>攒够星星，换一个喜欢的心愿。</p><div className="star-total"><span><TinyStar /></span> {balance.available}<small>颗可用星星</small></div></div><PlayPicture kind="gift" /></section>
    {parent && <div className="shop-ledger" role="group" aria-label="星星账本"><div><strong>{balance.available}</strong><span>可用星星</span></div><div><strong>{balance.reserved}</strong><span>兑换已预留</span></div><div><strong>{balance.spent}</strong><span>已兑现使用</span></div></div>}
    <Celebration message={message} />
    {!data && <p role="status">正在打开星星盒子…</p>}
    {!parent && focus && <details className="child-fold"><summary>我在攒的心愿</summary><WishGoal wish={focus} available={balance.available} compact /></details>}
    {!parent && <Bank />}
    <Card title="心愿商店 · 我想要的礼物">
      <p>{parent ? '礼物可随时追加或修改星数，与攒星公约分开管理，不需要重新签订。孩子攒够后申请，送出礼物时确认兑现。' : '打卡赚星星，攒够就能换奖励。不用为每件礼物重新签公约。'}</p>
      <div className="shop-table-wrap"><table className="wish-table"><caption className="sr-only">心愿奖励列表</caption><thead><tr><th scope="col">礼物</th><th scope="col">星星</th><th scope="col">状态</th><th scope="col">操作</th></tr></thead><tbody>{(data?.wishes ?? []).filter(w => w.status !== 'redeemed').map(w => <tr key={w.id} className={focus?.id === w.id ? 'shop-focused' : ''}>
        <th scope="row"><span className="shop-item"><PlayPicture kind={w.picture} /><span>{w.name}</span></span>{!parent && <button type="button" className="shop-focus" disabled={busy} aria-pressed={focus?.id === w.id} aria-label={`优先攒：${w.name}`} onClick={() => childId && run(() => repo.updateProfile(childId, { focusWishId: w.id }), '选好啦！就先朝这个小心愿出发。')}>{focus?.id === w.id ? '★ 优先心愿' : '☆ 优先攒'}</button>}</th>
        <td>{w.cost ?? '待定'}</td><td>{w.status === 'proposed' ? '等家长定价' : w.status === 'requested' ? '等待兑现' : balance.available >= w.cost! ? '可以兑换' : `还差${w.cost! - balance.available}星`}</td>
        <td className="shop-actions">{parent&&w.status==='approved'&&<button type="button" className="btn" disabled={busy} onClick={()=>{setEditWishId(w.id);setName(w.name);setPicture(w.picture);setShopCost(String(w.cost));document.getElementById('parent-reward-editor')?.scrollIntoView()}}>修改奖励</button>}{w.status === 'approved' && <button type="button" className="btn btn-primary" disabled={busy || balance.available < w.cost!} onClick={() => run(() => repo.changeWish(w.id, 'request'), '申请记好了，等爸爸妈妈来兑现。')}>我要兑换</button>}
        {w.status === 'requested' && <>{parent && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => repo.changeWish(w.id, 'redeem'), '礼物已兑现，记录好了！')}>确认已送出礼物</button>}<button type="button" className="btn" disabled={busy} onClick={() => run(() => repo.changeWish(w.id, 'cancel'), '星星已放回盒子')}>暂时不换</button></>}
        {w.status === 'proposed' && (parent ? <form onSubmit={e => { e.preventDefault(); void run(() => repo.changeWish(w.id, 'approve', Number(costs[w.id])), '约定好了，开始攒星星吧！') }}><label><span className="sr-only">约定兑换星数</span><input aria-label={`约定兑换星数：${w.name}`} type="number" min="1" max="100000" step="1" required value={costs[w.id] ?? ''} onChange={e => setCosts({ ...costs, [w.id]: e.target.value })} /></label><button className="btn btn-primary" disabled={busy}>确认心愿</button></form> : <span>待上架</span>)}</td>
      </tr>)}{data && !data.wishes.some(w => w.status !== 'redeemed') && <tr><td colSpan={4}>还没有奖励，和家长一起选一个吧。</td></tr>}</tbody></table></div>
      {data && params.get('wish') && data.pacts.filter(p => p.wishPlan?.wishId === params.get('wish') && !p.archived).map(p => <details className="shop-previous-pact" key={p.id}><summary>查看以前的心愿约定</summary><p>这份旧约定仅保留记录。新礼物独立上架，攒星公约在家庭管理中签订。</p><ol>{p.clauses.map((c,i)=><li key={i}>{data.members.find(m=>m.id===c.memberId)?.name}：{c.text}</li>)}</ol><Link className="btn" to={parent?'/parent/family':'/parent'}>查看家庭攒星公约</Link></details>)}
      <details id="parent-reward-editor" className="child-wish-compose" open={parent || undefined}><summary>{parent ? '上架心愿奖励' : '许一个新心愿'}</summary><form className="wish-form" onSubmit={e => { e.preventDefault(); if (childId) run(async () => { if(parent&&editWishId)await repo.editWish(editWishId,name,picture,Number(shopCost));else await repo.proposeWish(childId, name, picture, parent ? Number(shopCost) : undefined); setName('');setEditWishId('') }, parent ? '奖励已上架心愿商店，孩子可以开始攒星兑换啦！' : '心愿放进小屋啦！和爸爸妈妈一起看看。') }}>
        <h3>{parent ? editWishId ? '修改这个心愿奖励' : '上架一个心愿奖励' : '加一个我的心愿'}</h3><p className="muted">点一张喜欢的图，也可以自己想。星数和爸爸妈妈一起定。</p><div className="wish-ideas">{WISH_IDEAS.map(idea => <button type="button" key={idea.name} className={name === idea.name ? 'selected' : ''} aria-pressed={name === idea.name} onClick={() => { setName(idea.name); setPicture(idea.picture) }}><PlayPicture kind={idea.picture} /><span>{idea.name}</span></button>)}</div>
        <fieldset><legend>给心愿换张图</legend><div className="picture-picker">{PICTURES.map(p => <button key={p.key} type="button" aria-label={p.label} aria-pressed={picture === p.key} className={picture === p.key ? 'selected' : ''} onClick={() => setPicture(p.key)}><PlayPicture kind={p.key} /></button>)}</div></fieldset>
        <label>我想要…<input maxLength={80} required placeholder="例如：一盒积木、一起去露营" value={name} onChange={e => setName(e.target.value)} /></label>{parent && <label>上架所需星数（必填）<input required type="number" min="1" max="100000" step="1" value={shopCost} onChange={e => setShopCost(e.target.value)} /></label>}<button className="btn btn-primary" disabled={busy || !data}>{parent ? editWishId ? '保存奖励修改' : '上架心愿商店' : '放进心愿小屋'}</button>{parent&&editWishId&&<button type="button" className="btn" onClick={()=>{setEditWishId('');setName('')}}>取消修改</button>}<p className="muted">可以请爸爸妈妈帮忙写，礼物由你来选。</p>
      </form></details>
    </Card>
    {(data?.wishes ?? []).some(w => w.status === 'redeemed') && <Card title="已经实现的心愿"><div className="shop-table-wrap"><table className="wish-table"><caption className="sr-only">已兑现奖励列表</caption><thead><tr><th scope="col">礼物</th><th scope="col">星星</th><th scope="col">状态</th></tr></thead><tbody>{data!.wishes.filter(w => w.status === 'redeemed').map(w => <tr key={w.id}><th scope="row">{w.name}</th><td>{w.cost}</td><td>已兑现</td></tr>)}</tbody></table></div></Card>}
    {parent && <details className="child-fold"><summary>查看星星与成长记录</summary>    {parent && data && <ConstellationMap childId={childId ?? ''} tasks={data.tasks} checks={data.checks} />}
    {parent && data && <BirdGrowth count={uniqueAdventures(data.adventures).length} runs={data.adventures} />}
    {parent && data && <GrowthTrail tasks={data.tasks} checks={data.checks} date={todayKey()} />}
    {parent && data && <CheckinHeatmap checks={data.checks} date={todayKey()} />}
    {parent && <Card title="我的成长花园"><div className="badge-garden">{BADGES.map(b => <div key={b.at} className={`growth-badge ${balance.earned >= b.at ? 'lit' : ''}`}><PlayPicture kind={b.picture} /><strong>{b.name}</strong><small>{balance.earned >= b.at ? '已点亮' : `${b.at} 颗星点亮`}</small></div>)}</div>
      <p className="muted">{nextBadge ? `再攒 ${nextBadge.at - balance.earned} 颗星，就能点亮${nextBadge.name}。` : '花园里的图标都点亮了！'}兑换礼物不会熄灭图标。</p>
    </Card>}
</details>}
    {parent && !!data?.strengths.length && <Card title="被记住的闪光时刻">{data.strengths.slice(0, 5).map(s => <article key={s.id}><p>{s.childAction}</p><p className="muted">{s.event}</p></article>)}</Card>}
    <details className="play-steps"><summary>星星怎么攒？</summary><p>生活图卡整组完成得1星，运动和学习完成得2星；旧版记录保留原有5星；同一任务当天只算一次。历史有效记录和补记也参与计算。漏做不扣星，不要求连续打卡。撤回或删除完成记录后，对应星星也会撤回。每日冒险获得的奖励星星另计，不计入当天5星出发门槛。</p><p>累计获得 5、25、60、120 颗星时，依次点亮小芽、小花、小树和火箭。礼物由孩子提出、家长确定星数；申请后先留住星星，家长送出后正式兑换。</p></details>

  </div>
}
