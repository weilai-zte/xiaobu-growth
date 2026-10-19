import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { BADGES, focusedWish, starBalance } from '../lib/rewards'
import { Card } from '../components/ui'
import { PlayPicture, Celebration, TinyStar } from '../components/PlayCards'
import { BirdGrowth, GrowthTrail, WishGoal } from '../components/GrowthJourney'
import { uniqueAdventures, birdStage } from '../lib/adventure'
import { BirdCompanion } from '../components/BirdCompanion'
import { todayKey } from '../lib/date'

const PICTURES = [{ key: 'gift', label: '礼物' }, { key: 'ball', label: '运动' }, { key: 'book', label: '图书' }, { key: 'paint', label: '画画' }, { key: 'picnic', label: '出游' }]
const WISH_IDEAS = [
  { name: '一起去公园野餐', picture: 'picnic' },
  { name: '一起做小饼干', picture: 'bake' },
  { name: '和家人一起骑车', picture: 'bicycle' },
  { name: '挑一本喜欢的绘本', picture: 'book' },
]

export function ChildProgress({ parent = false }: { parent?: boolean }) {
  const { profile } = useApp()
  const childId = profile?.id
  const data = useLiveQuery(async () => childId ? {
    tasks: await repo.listTaskRecords(childId), checks: await repo.listChecks(childId), wishes: await repo.listWishes(childId), strengths: await repo.listStrengths(childId), adventures: await repo.listAdventures(childId),
  } : undefined, [childId])
  const [name, setName] = useState('')
  const [picture, setPicture] = useState('gift')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [costs, setCosts] = useState<Record<string, string>>({})
  const balance = starBalance(data?.tasks ?? [], data?.checks ?? [], data?.wishes ?? [], data?.adventures ?? [])
  const nextBadge = BADGES.find(b => b.at > balance.earned)
  const focus = focusedWish(data?.wishes ?? [], profile?.focusWishId)
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try { await action(); setMessage(success) } catch (error) { setMessage(error instanceof Error ? error.message : '没有保存成功，请再试一次') } finally { setBusy(false) }
  }
  return <div className="play-world">
    <section className="play-hero wish-hero"><div><span className="play-eyebrow">{parent ? '家长管理' : `${profile?.nickname || profile?.name || '我'}的心愿小屋`}</span><h1>{parent ? '星星与礼物' : '每一小步，都在发光'}</h1><p>攒星星，点亮图标，选一个自己的心愿。</p><div className="star-total"><span><TinyStar /></span> {balance.available}<small>颗可用星星</small></div></div><PlayPicture kind="gift" /></section>
    <Celebration message={message} />
    {!data && <p role="status">正在打开星星盒子…</p>}
    {data && <BirdGrowth count={uniqueAdventures(data.adventures).length} runs={data.adventures} />}
    {!parent && data && <BirdCompanion stage={birdStage(uniqueAdventures(data.adventures).length).key} runs={data.adventures} wardrobe />}
    {!parent && data && <WishGoal wish={focus} available={balance.available} />}
    {data && <GrowthTrail tasks={data.tasks} checks={data.checks} date={todayKey()} />}
    <Card title="我的成长花园"><div className="badge-garden">{BADGES.map(b => <div key={b.at} className={`growth-badge ${balance.earned >= b.at ? 'lit' : ''}`}><PlayPicture kind={b.picture} /><strong>{b.name}</strong><small>{balance.earned >= b.at ? '已点亮' : `${b.at} 颗星点亮`}</small></div>)}</div>
      <p className="muted">{nextBadge ? `再攒 ${nextBadge.at - balance.earned} 颗星，就能点亮${nextBadge.name}。` : '花园里的图标都点亮了！'}兑换礼物不会熄灭图标。</p>
    </Card>
    <Card title="我想要的礼物"><div className="wish-grid">{(data?.wishes ?? []).filter(w => w.status !== 'redeemed').map(w => <article className={`wish-card ${focus?.id === w.id ? 'focused-wish' : ''}`} key={w.id}><PlayPicture kind={w.picture} /><h3>{w.name}</h3>
      <p>{w.cost ? `${w.cost} 颗星` : '等爸爸妈妈一起定星数'}</p>
      {!parent && <button type="button" className="wish-focus-button" disabled={busy} aria-pressed={focus?.id === w.id} aria-label={`优先攒：${w.name}`} onClick={() => childId && run(() => repo.updateProfile(childId, { focusWishId: w.id }), '选好啦！就先朝这个小心愿出发。')}>{focus?.id === w.id ? '我的优先小心愿' : '我想先攒这个'}</button>}
      {w.status === 'approved' && <><progress max={w.cost!} value={Math.min(balance.available, w.cost!)} aria-label={`${w.name}，已攒${balance.available}颗，共需${w.cost}颗`} /><p className="muted">{balance.available >= w.cost! ? '可以许愿啦！' : `还差 ${w.cost! - balance.available} 颗星`}</p><button className="btn btn-primary" disabled={busy || balance.available < w.cost!} onClick={() => run(() => repo.changeWish(w.id, 'request'), '申请记好了，等爸爸妈妈来兑现。')}>我要兑换</button></>}
      {w.status === 'requested' && <><p className="tag tag-soft">星星已留好，等家长兑现</p>{parent && <button className="btn btn-primary" disabled={busy} onClick={() => run(() => repo.changeWish(w.id, 'redeem'), '礼物已兑现，记录好了！')}>确认已送出礼物</button>}<button className="btn" disabled={busy} onClick={() => run(() => repo.changeWish(w.id, 'cancel'), '星星已放回盒子')}>暂时不换</button></>}
      {parent && w.status === 'proposed' && <form onSubmit={e => { e.preventDefault(); run(() => repo.changeWish(w.id, 'approve', Number(costs[w.id])), '约定好了，开始攒星星吧！') }}><label>约定兑换星数<input type="number" min="1" max="100000" step="1" required value={costs[w.id] ?? ''} onChange={e => setCosts({ ...costs, [w.id]: e.target.value })} /></label><button className="btn btn-primary" disabled={busy}>确认心愿</button></form>}
    </article>)}</div>
      <form className="wish-form" onSubmit={e => { e.preventDefault(); if (childId) run(async () => { await repo.proposeWish(childId, name, picture); setName('') }, '心愿放进小屋啦！和爸爸妈妈一起看看。') }}>
        <h3>加一个我的心愿</h3><p className="muted">点一张喜欢的图，也可以自己想。星数和爸爸妈妈一起定。</p><div className="wish-ideas">{WISH_IDEAS.map(idea => <button type="button" key={idea.name} className={name === idea.name ? 'selected' : ''} aria-pressed={name === idea.name} onClick={() => { setName(idea.name); setPicture(idea.picture) }}><PlayPicture kind={idea.picture} /><span>{idea.name}</span></button>)}</div>
        <fieldset><legend>给心愿换张图</legend><div className="picture-picker">{PICTURES.map(p => <button key={p.key} type="button" aria-label={p.label} aria-pressed={picture === p.key} className={picture === p.key ? 'selected' : ''} onClick={() => setPicture(p.key)}><PlayPicture kind={p.key} /></button>)}</div></fieldset>
        <label>我想要…<input maxLength={80} required placeholder="例如：一盒积木、一起去露营" value={name} onChange={e => setName(e.target.value)} /></label><button className="btn btn-primary" disabled={busy || !data}>放进心愿小屋</button><p className="muted">可以请爸爸妈妈帮忙写，礼物由你来选。</p>
      </form>
    </Card>
    {(data?.wishes ?? []).some(w => w.status === 'redeemed') && <Card title="已经实现的心愿"><div className="wish-grid">{data!.wishes.filter(w => w.status === 'redeemed').map(w => <div className="wish-card" key={w.id}><PlayPicture kind={w.picture} /><strong>{w.name}</strong><p>已兑现 · {w.cost} 颗星</p></div>)}</div></Card>}
    {!!data?.strengths.length && <Card title="被记住的闪光时刻">{data.strengths.slice(0, 5).map(s => <article key={s.id}><p>{s.childAction}</p><p className="muted">{s.event}</p></article>)}</Card>}
    <details className="play-steps"><summary>星星怎么攒？</summary><p>生活图卡整组完成得1星，运动和学习完成得2星；旧版记录保留原有5星；同一任务当天只算一次。历史有效记录和补记也参与计算。漏做不扣星，不要求连续打卡。撤回或删除完成记录后，对应星星也会撤回。每日冒险获得的奖励星星另计，不计入当天5星出发门槛。</p><p>累计获得 5、25、60、120 颗星时，依次点亮小芽、小花、小树和火箭。礼物由孩子提出、家长确定星数；申请后先留住星星，家长送出后正式兑换。</p></details>
    {!parent && <Link className="btn" to="/rewards">请家长一起看心愿</Link>}
  </div>
}
