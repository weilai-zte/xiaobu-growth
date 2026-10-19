import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { BADGES, starBalance } from '../lib/rewards'
import { Card } from '../components/ui'
import { PlayPicture, Celebration, TinyStar } from '../components/PlayCards'

const PICTURES = [{ key: 'gift', label: '礼物' }, { key: 'ball', label: '运动' }, { key: 'book', label: '图书' }, { key: 'paint', label: '画画' }, { key: 'rocket', label: '出游' }]

export function ChildProgress({ parent = false }: { parent?: boolean }) {
  const { profile } = useApp()
  const childId = profile?.id
  const data = useLiveQuery(async () => childId ? {
    tasks: await repo.listTaskRecords(childId), checks: await repo.listChecks(childId), wishes: await repo.listWishes(childId), strengths: await repo.listStrengths(childId),
  } : undefined, [childId])
  const [name, setName] = useState('')
  const [picture, setPicture] = useState('gift')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [costs, setCosts] = useState<Record<string, string>>({})
  const balance = starBalance(data?.tasks ?? [], data?.checks ?? [], data?.wishes ?? [])
  const nextBadge = BADGES.find(b => b.at > balance.earned)
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try { await action(); setMessage(success) } catch (error) { setMessage(error instanceof Error ? error.message : '没有保存成功，请再试一次') } finally { setBusy(false) }
  }
  return <div className="play-world">
    <section className="play-hero wish-hero"><div><span className="play-eyebrow">{parent ? '家长管理' : `${profile?.nickname || profile?.name || '我'}的心愿小屋`}</span><h1>{parent ? '星星与礼物' : '每一小步，都在发光'}</h1><p>攒星星，点亮图标，选一个自己的心愿。</p><div className="star-total"><span><TinyStar /></span> {balance.available}<small>颗可用星星</small></div></div><PlayPicture kind="gift" /></section>
    <Celebration message={message} />
    {!data && <p role="status">正在打开星星盒子…</p>}
    <Card title="我的成长花园"><div className="badge-garden">{BADGES.map(b => <div key={b.at} className={`growth-badge ${balance.earned >= b.at ? 'lit' : ''}`}><PlayPicture kind={b.picture} /><strong>{b.name}</strong><small>{balance.earned >= b.at ? '已点亮' : `${b.at} 颗星点亮`}</small></div>)}</div>
      <p className="muted">{nextBadge ? `再攒 ${nextBadge.at - balance.earned} 颗星，就能点亮${nextBadge.name}。` : '花园里的图标都点亮了！'}兑换礼物不会熄灭图标。</p>
    </Card>
    <Card title="我想要的礼物"><div className="wish-grid">{(data?.wishes ?? []).filter(w => w.status !== 'redeemed').map(w => <article className="wish-card" key={w.id}><PlayPicture kind={w.picture} /><h3>{w.name}</h3>
      <p>{w.cost ? `${w.cost} 颗星` : '等爸爸妈妈一起定星数'}</p>
      {w.status === 'approved' && <><progress max={w.cost!} value={Math.min(balance.available, w.cost!)} aria-label={`${w.name}，已攒${balance.available}颗，共需${w.cost}颗`} /><p className="muted">{balance.available >= w.cost! ? '可以许愿啦！' : `还差 ${w.cost! - balance.available} 颗星`}</p><button className="btn btn-primary" disabled={busy || balance.available < w.cost!} onClick={() => run(() => repo.changeWish(w.id, 'request'), '申请记好了，等爸爸妈妈来兑现。')}>我要兑换</button></>}
      {w.status === 'requested' && <><p className="tag tag-soft">星星已留好，等家长兑现</p>{parent && <button className="btn btn-primary" disabled={busy} onClick={() => run(() => repo.changeWish(w.id, 'redeem'), '礼物已兑现，记录好了！')}>确认已送出礼物</button>}<button className="btn" disabled={busy} onClick={() => run(() => repo.changeWish(w.id, 'cancel'), '星星已放回盒子')}>暂时不换</button></>}
      {parent && w.status === 'proposed' && <form onSubmit={e => { e.preventDefault(); run(() => repo.changeWish(w.id, 'approve', Number(costs[w.id])), '约定好了，开始攒星星吧！') }}><label>约定兑换星数<input type="number" min="1" max="100000" step="1" required value={costs[w.id] ?? ''} onChange={e => setCosts({ ...costs, [w.id]: e.target.value })} /></label><button className="btn btn-primary" disabled={busy}>确认心愿</button></form>}
    </article>)}</div>
      <form className="wish-form" onSubmit={e => { e.preventDefault(); if (childId) run(async () => { await repo.proposeWish(childId, name, picture); setName('') }, '心愿放进小屋啦！和爸爸妈妈一起看看。') }}>
        <h3>加一个我的心愿</h3><fieldset><legend>先选一张图</legend><div className="picture-picker">{PICTURES.map(p => <button key={p.key} type="button" aria-label={p.label} aria-pressed={picture === p.key} className={picture === p.key ? 'selected' : ''} onClick={() => setPicture(p.key)}><PlayPicture kind={p.key} /></button>)}</div></fieldset>
        <label>我想要…<input maxLength={80} required placeholder="例如：一盒积木、一起去露营" value={name} onChange={e => setName(e.target.value)} /></label><button className="btn btn-primary" disabled={busy || !data}>放进心愿小屋</button><p className="muted">可以请爸爸妈妈帮忙写，礼物由你来选。</p>
      </form>
    </Card>
    {(data?.wishes ?? []).some(w => w.status === 'redeemed') && <Card title="已经实现的心愿"><div className="wish-grid">{data!.wishes.filter(w => w.status === 'redeemed').map(w => <div className="wish-card" key={w.id}><PlayPicture kind={w.picture} /><strong>{w.name}</strong><p>已兑现 · {w.cost} 颗星</p></div>)}</div></Card>}
    {!!data?.strengths.length && <Card title="被记住的闪光时刻">{data.strengths.slice(0, 5).map(s => <article key={s.id}><p>{s.childAction}</p><p className="muted">{s.event}</p></article>)}</Card>}
    <details className="play-steps"><summary>星星怎么攒？</summary><p>每项学习任务或生活图卡完成得 5 颗星；同一任务当天只算一次。历史有效记录和补记也参与计算。漏做不扣星，不要求连续打卡。撤回或删除完成记录后，对应星星也会撤回。没有每日额外奖励。</p><p>累计获得 5、25、60、120 颗星时，依次点亮小芽、小花、小树和火箭。礼物由孩子提出、家长确定星数；申请后先留住星星，家长送出后正式兑换。</p></details>
    {!parent && <Link className="btn" to="/rewards">请家长一起看心愿</Link>}
  </div>
}
