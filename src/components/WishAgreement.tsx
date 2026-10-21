import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FamilyMember, GrowthPact, PactSignature, RoutineRule, Wish } from '../db/types'
import { familyRepo, pactIsActive } from '../lib/family'
import { HABIT_CATEGORIES, habitDefinition, recordStars } from '../lib/habits'
import { FingerprintSign } from './FingerprintSign'

export function WishAgreement({ wish, rules, members, pacts, signatures, parent, startOpen = false }: {
  wish: Wish; rules: RoutineRule[]; members: FamilyMember[]; pacts: GrowthPact[]; signatures: PactSignature[]; parent: boolean; startOpen?: boolean
}) {
  const pact = pacts.find(p => !p.archived && p.wishPlan?.wishId === wish.id)
  const [selected, setSelected] = useState<string[]>(pact?.wishPlan?.ruleIds ?? [])
  const [actorId, setActorId] = useState('')
  const [expanded, setExpanded] = useState(startOpen)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const summary = useRef<HTMLElement>(null)
  useEffect(() => { setSelected(pact?.wishPlan?.ruleIds ?? []) }, [pact?.id, pact?.updatedAt])
  useEffect(() => { if (startOpen) { setExpanded(true); summary.current?.focus() } }, [startOpen])
  const choices = members.filter(m => m.role === (parent ? 'parent' : 'child'))
  const actor = choices.find(m => m.id === actorId) ?? choices[0]
  const available = rules.filter(r => r.active && (habitDefinition(r) || !r.builtinKey))
  const active = pact && pactIsActive(pact, signatures)
  const signed = pact && signatures.some(s => s.pactId === pact.id && s.memberId === actor?.id)
  const dirty = JSON.stringify(selected) !== JSON.stringify(pact?.wishPlan?.ruleIds ?? [])
  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(true)
    try { await action(); setExpanded(true); setMessage(success) } catch(e) { setMessage(e instanceof Error ? e.message : '没有保存成功，请再试一次') } finally { setBusy(false) }
  }
  return <details className="wish-agreement" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}>
    <summary ref={summary}>{active ? '我们的攒星公约 · 已签订' : pact?.sealed ? '一起按指纹签公约' : '选打卡，一起定公约'}</summary>
    <p className="wish-plan-status" role="status">{message}</p>
    {choices.length > 1 && <label>现在轮到谁？<select value={actor?.id ?? ''} onChange={e=>setActorId(e.target.value)}>{choices.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>}
    {!pact?.sealed ? <>
      <p>为了「{wish.name}」，我想做好哪些事？</p>
      <form onSubmit={e => { e.preventDefault(); if (!actor) return; void run(() => pact ? familyRepo.updateWishPact(pact.id,actor.id,selected) : familyRepo.createWishPact(wish.childId,actor.id,wish.id,selected), '打卡选好了，和家人一起看看公约。') }}>
        <fieldset disabled={busy || !actor}><legend>选择已有打卡</legend>{HABIT_CATEGORIES.map(category => <div className="wish-rule-group" key={category.key}><strong>{category.label}</strong>{available.filter(r=>(r.category ?? 'life')===category.key).map(r=><label className="wish-rule-choice" key={r.id}><input type="checkbox" checked={selected.includes(r.id)} onChange={()=>setSelected(ids=>ids.includes(r.id)?ids.filter(id=>id!==r.id):[...ids,r.id])}/><span>{r.title}<small>完成得 {recordStars(r)} 星{r.minMinutes ? ` · 至少${r.minMinutes}分钟` : ''}</small></span></label>)}</div>)}</fieldset>
        <button type="submit" className="btn btn-primary" disabled={busy || !actor || !selected.length || selected.length>10 || (!!pact && !dirty)}>{pact ? '保存打卡选择' : '选好了，生成公约'}</button>
      </form>
      <details className="wish-missing-rule"><summary>没有合适的打卡？</summary><p>请家长在原有打卡管理里新增，回来后就能选择。</p><Link className="btn" to="/rules">请家长添加打卡</Link></details>
    </> : null}
    {pact && <section className="wish-pact-paper" aria-label={`${wish.name}的攒星公约`}>
      <h4>我们一起约好</h4><p><strong>心愿：{pact.wishPlan!.rewardName}</strong></p><p>{pact.sealed ? `约定兑换：${pact.wishPlan!.rewardCost} 颗星` : wish.cost ? `兑换需要 ${wish.cost} 颗星，等家长确认公约。` : '请家长先约定兑换星数。'}</p>
      <ol>{pact.clauses.map((c,i)=><li key={i}><strong>{members.find(m=>m.id===c.memberId)?.name ?? '家人'}</strong>：{c.text}</li>)}</ol>
      {!pact.sealed ? parent ? <button type="button" className="btn btn-primary" disabled={busy || !actor || !wish.cost || dirty} onClick={()=>actor && void run(()=>familyRepo.sealPact(pact.id,actor.id),'内容确认好了，轮到家人各自按指纹。')}>确认内容，开始签订</button> : <><p>请家长确认星数和内容，再一起按指纹。</p><Link className="btn" to="/rewards">请家长一起确认</Link></> : <>
        <div className="pact-stamps">{[...new Set(pact.clauses.map(c=>c.memberId))].map(id=><span key={id} className={signatures.some(s=>s.pactId===pact.id&&s.memberId===id)?'signed':''}>{members.find(m=>m.id===id)?.name ?? '家人'} · {signatures.some(s=>s.pactId===pact.id&&s.memberId===id)?'已按指纹':'等待签订'}</span>)}</div>
        {actor && pact.clauses.some(c=>c.memberId===actor.id) && !signed && <FingerprintSign key={`${pact.id}:${actor.id}`} name={actor.name} disabled={busy} onComplete={()=>run(()=>familyRepo.signPact(pact.id,actor.id),`${actor.name}签订好了！`)}/>}
        {active ? <><p>大家都签好啦！回到原图卡打卡，攒够星星就能申请兑换。</p><Link className="btn btn-primary" to="/child">去打卡攒星</Link></> : <p>{parent ? '家长签好后，请孩子到“心愿”里亲自按指纹。' : '每个人都签好后，我们就一起出发。'}</p>}
      </>}
    </section>}
    <p className="muted">星星共用一个小盒子，同一项打卡当天只计一次。公约不会额外发星。</p>
  </details>
}
