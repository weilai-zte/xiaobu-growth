import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import { useAdventureDay } from '../components/Adventure'
import { FingerprintSign } from '../components/FingerprintSign'
import { HabitBoard } from '../components/HabitBoard'
import { familyRepo, pactIsActive } from '../lib/family'
import type { GrowthPact, FamilyMember } from '../db/types'
import { Card } from '../components/ui'
import { todayKey } from '../lib/date'
import { BirdCompanion } from '../components/BirdCompanion'
import { ConstellationMap } from '../components/ConstellationMap'
import { repo } from '../db/repo'
import { birdStage } from '../lib/adventure'

export function Family({ parent = false, embedded = false }: { parent?: boolean; embedded?: boolean }) {
  const { profile, startSigning } = useApp()
  const childId = profile?.id
  const habitDate = useAdventureDay()
  const habits = useToday(habitDate)
  const [ready, setReady] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState('')
  const [proposal, setProposal] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState<FamilyMember['role']>('parent')
  const [editing, setEditing] = useState('')
  const [replaces,setReplaces]=useState<string|undefined>()
  const [selectedRules,setSelectedRules]=useState<string[]>([])
  const [title, setTitle] = useState('我们的攒星星公约')
  const [clauses, setClauses] = useState<GrowthPact['clauses']>([])
  const [composing, setComposing] = useState(false)
  const [rename, setRename] = useState<Record<string, string>>({})
  const date = todayKey()
  useEffect(() => {
    let cancelled = false
    if (childId) void familyRepo.ensureMembers(childId).then(() => { if (!cancelled) setReady(childId) }).catch(() => { if (!cancelled) setMessage('家庭成员还没有准备好，请刷新后重试。') })
    return () => { cancelled = true }
  }, [childId])
  const data = useLiveQuery(async () => childId && ready === childId ? {
    members: await familyRepo.listMembers(childId), pacts: await familyRepo.listPacts(childId),
    signatures: await familyRepo.listSignatures(childId), checks: await familyRepo.listChecks(childId), reactions: await familyRepo.listReactions(childId),
    tasks: await repo.listTaskRecords(childId), routineChecks: await repo.listChecks(childId), wishes: await repo.listWishes(childId), adventures: await repo.listAdventures(childId),
  } : undefined, [childId, ready])
  const choices = data?.members.filter(m => parent ? m.role === 'parent' : m.role === 'child') ?? []
  const actor = choices.find(m => m.id === selected) ?? choices[0]
  const memberLabel = (id: string) => data?.members.find(m => m.id === id)?.name ?? '家人'
  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(true)
    try { await action(); setMessage(success) } catch (error) { setMessage(error instanceof Error ? error.message : '还没有保存好，请重试') } finally { setBusy(false) }
  }
  function jumpTo(id: string) {
    const target = document.getElementById(id)
    if (!target) return
    target.tabIndex = -1
    target.focus({ preventScroll: true })
    target.scrollIntoView()
  }
  function compose(pact?: GrowthPact) {
    setEditing(pact && !pact.sealed ? pact.id : '')
    setReplaces(pact?.sealed?pact.id:pact?.replacesPactId)
    setSelectedRules(pact?.ruleIds??[])
    setTitle(pact ? pact.sealed ? `${pact.title.slice(0, 50)} · 新约定` : pact.title : '我们的攒星星公约')
    setClauses(pact ? pact.clauses.map(c => ({ ...c })) : (data?.members ?? []).map(m => ({ memberId: m.id, text: '' })))
    setComposing(true)
  }
  const regularPacts = data?.pacts.filter(p => !p.wishPlan) ?? []
  const wishPacts = data?.pacts.filter(p => p.wishPlan && !p.archived) ?? []
  const wishLinks = <>{wishPacts.map(p => <article className="pact-paper" key={p.id}><h3>{p.wishPlan!.rewardName}的攒星公约</h3><p>{pactIsActive(p, data?.signatures ?? []) ? '全员已签订' : p.sealed ? '等待家人各自按指纹' : '一起商量中'}</p><div className="pact-stamps">{[...new Set(p.clauses.map(c => c.memberId))].map(id => <span key={id} className={data?.signatures.some(s => s.pactId === p.id && s.memberId === id) ? 'signed' : ''}>{memberLabel(id)} · {data?.signatures.some(s => s.pactId === p.id && s.memberId === id) ? '已签订' : '等待签订'}</span>)}</div><Link className="btn" to={`${parent ? '/rewards' : '/child/progress'}?wish=${encodeURIComponent(p.wishPlan!.wishId)}`}>查看并一起签订心愿公约</Link></article>)}</>
  if (embedded) return <div className="family-world family-inline">
    {regularPacts.some(p => pactIsActive(p, data?.signatures ?? [])) ? <details className="pact-adjust"><summary>需要调整公约？</summary><Link className="btn" to="/family">和家长一起制定公约</Link></details> : <Link className="btn" to="/family">和家长一起制定公约</Link>}
    <p className="family-status" role="status">{message}</p>
    {!data || !actor ? <p>正在打开我们的小约定…</p> : <>
      {choices.length > 1 && <label>我是谁？<select value={actor.id} onChange={e => setSelected(e.target.value)}>{choices.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
      {!regularPacts.some(p => !p.archived) && !wishPacts.length && <p>和家人商量一个小约定，再一起盖章。</p>}
      {regularPacts.filter(p => !p.archived).map(p => {
        const active = pactIsActive(p, data.signatures)
        const signed = data.signatures.some(s => s.pactId === p.id && s.memberId === actor.id)
        return <article className={`pact-paper ${active ? 'pact-ongoing' : ''}`} key={p.id}><h3>{p.title}</h3>
          <span className="pact-state">{active ? '已签订 · 持续有效，不用每天重签' : p.sealed ? '等待家人各自按指纹' : '一起商量中'}</span>
          <div className="pact-stamps">{[...new Set(p.clauses.map(c => c.memberId))].map(id => <span key={id} className={data.signatures.some(s => s.pactId === p.id && s.memberId === id) ? 'signed' : ''}>{memberLabel(id)} · {data.signatures.some(s => s.pactId === p.id && s.memberId === id) ? '已签订' : '等待签订'}</span>)}</div>
          <details className="pact-content" open={!active}><summary>{active ? '查看已签订公约和家人互动' : '约定内容与签订'}</summary>
          <ol>{p.clauses.map((c,i) => <li key={i}><strong>{memberLabel(c.memberId)}</strong>：{c.text}</li>)}</ol>
          {!p.sealed ? <p>还在和家长一起商量。</p> : !active ? <>
            <p>{[...new Set(p.clauses.map(c => c.memberId))].map(id => `${memberLabel(id)}${data.signatures.some(s => s.pactId === p.id && s.memberId === id) ? '已盖章' : '还没盖章'}`).join('，')}</p>
            {p.clauses.some(c => c.memberId === actor.id) && !signed && <FingerprintSign name={actor.name} disabled={busy} onComplete={() => run(() => familyRepo.signPact(p.id, actor.id), `${actor.name}盖章啦！这份承诺也有你的一份。`)} />}
          </> : <div className="family-check-grid">{p.clauses.map((c,i) => {
            const check = data.checks.find(r => r.pactId === p.id && r.clause === i && r.date === date)
            const encouraged = check && data.reactions.some(r => r.checkId === check.id && r.memberId === actor.id)
            return <div className="family-check-card" key={i}><strong>{memberLabel(c.memberId)}：{c.text}</strong>
              {check ? <><p>✓ 今天做到了</p>{c.memberId !== actor.id && <button className="btn" disabled={busy || !!encouraged} onClick={() => void run(() => familyRepo.encourage(check.id, actor.id), `把鼓励送给${memberLabel(c.memberId)}啦！`)}>{encouraged ? '已送出鼓励 ♥' : `给${memberLabel(c.memberId)}送鼓励`}</button>}</> : c.memberId === actor.id ? <button className="btn btn-primary" disabled={busy} onClick={() => void run(() => familyRepo.checkIn(p.id,i,actor.id,date), '今天的小约定完成了，星空多了一束光！')}>我今天做到了</button> : <p>等{memberLabel(c.memberId)}来打卡。</p>}
            </div>
          })}</div>}
          {active && <p className="muted">上面的家庭互动记录陪伴，不另发兑换星星。选择下方生活、运动、学习图卡，完成后攒星。</p>}</details>
        </article>
      })}
      {wishPacts.length > 0 && <details className="past-wish-pacts"><summary>以前的心愿约定（{wishPacts.length}份）</summary><p>以前签过的约定保留；兑换新奖励不用再签一份。</p>{wishLinks}</details>}
      {!regularPacts.some(p => pactIsActive(p, data.signatures)) && <details className="child-proposal"><summary>我有一个小提议</summary><form onSubmit={e => { e.preventDefault(); void run(async () => { await familyRepo.createPact(childId!,actor.id,'一起商量的小提议',data.members.map(m => ({memberId:m.id,text:m.id === actor.id ? proposal : m.role === 'parent' ? '我愿意一起商量、陪伴和鼓励。' : '我愿意一起商量、鼓励家人。'}))); setProposal('') },'提议记好啦，和家长一起商量吧。') }}><label>我想试着做到<input required maxLength={120} value={proposal} onChange={e => setProposal(e.target.value)} /></label><button className="btn" disabled={busy}>和家长一起商量</button></form></details>}
    </>}
  </div>
  return <div className="play-world family-world">
    <section className="play-hero family-hero"><div><span className="play-eyebrow">孩子和大人，都在一起长大</span><h1>我们家的小约定</h1><p>先一起商量，再各自盖章。你做好自己的事，也看见家人的努力。</p><nav className="family-shortcuts" aria-label="共同成长入口"><a href={`#/${parent ? 'family' : 'child/family'}`} onClick={e => { e.preventDefault(); jumpTo('family-pacts') }}>一起定公约</a><a href={`#/${parent ? 'family' : 'child/family'}`} onClick={e => { e.preventDefault(); jumpTo('family-today') }}>今天一起做</a><Link to={parent ? '/rewards' : '/child/progress'}>逛心愿商店 →</Link></nav></div>{!parent && data && <BirdCompanion stage={birdStage(data.adventures.length).key} runs={data.adventures} />}</section>
    <p className="family-status" role="status">{message}</p>
    {!data && <p>正在打开我们的家庭…</p>}
    {data && actor && <>
      {!parent && <Card title="我的日常习惯"><p>原来的生活、运动和学习习惯都在这里，继续按原来的内容打卡。</p><HabitBoard rules={habits.rules} tasks={habits.tasks} checks={habits.checks} date={habitDate} limit={99} /><Link className="btn" to="/child/rules">打开完整打卡清单</Link></Card>}
      <Card title="今天，我来参与"><label>现在是谁在操作？<select value={actor.id} onChange={e => { setSelected(e.target.value); setMessage('') }}>{choices.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role === 'parent' ? '家长' : '孩子'}</option>)}</select></label><p className="muted">每个人签自己的名字，完成自己的约定。家长管理成员和发起签订；孩子在签订页面亲自盖章。</p>{parent ? <p>选择公约的“全家轮流签订”，把页面轮流交给孩子和家人。已签公约一直有效，修改会建立新版本。</p> : <Link className="btn" to="/family">请家长来参与</Link>}</Card>
      {parent && <Card title="我们家的成员"><ul className="family-member-list">{data.members.map(m => <li key={m.id}><span className={`family-avatar ${m.role}`} aria-hidden="true">{m.role === 'parent' ? '☀' : '✦'}</span><div><strong>{m.name}</strong><small>{m.role === 'parent' ? '家长 · 管理成员、确认公约和兑现心愿' : '孩子 · 提议、签订、打卡和鼓励家人'}</small></div><form onSubmit={e => { e.preventDefault(); void run(() => familyRepo.renameMember(m.id, actor.id, rename[m.id] ?? m.name), '称呼改好啦') }}><label>修改{m.name}的称呼<input maxLength={30} required value={rename[m.id] ?? m.name} onChange={e => setRename({ ...rename, [m.id]: e.target.value })} /></label><button type="submit" className="btn btn-sm" disabled={busy}>保存称呼</button></form></li>)}</ul>
        <form className="family-inline-form" onSubmit={e => { e.preventDefault(); void run(async () => { await familyRepo.addMember(childId!, actor.id, memberName, memberRole); setMemberName('') }, '欢迎家人一起参与！') }}><label>新家人的称呼（必填）<input required maxLength={30} value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="例如：妈妈、爸爸、姐姐" /></label><label>角色<select value={memberRole} onChange={e => setMemberRole(e.target.value as FamilyMember['role'])}><option value="parent">家长</option><option value="child">孩子</option></select></label><button className="btn btn-primary" disabled={busy}>添加家庭成员</button></form><p className="muted">这里添加家庭称呼。同一台设备可以轮流参与，另一台设备仍使用原有家庭连接方式。</p>
      </Card>}
      {wishPacts.length > 0 && <Card title="心愿攒星公约">{wishLinks}</Card>}
      <Card title="一起制定成长公约" id="family-pacts"><p>公约只约定打卡、攒星和家人的承诺，签订一次持续有效。心愿礼物在商店单独管理，以后可以随时追加，不用修改或重签公约。</p><Link className="btn" to="/rewards">管理心愿礼物</Link><button className="btn btn-primary" type="button" disabled={busy} onClick={() => compose()}>一起写一份公约</button>
        {composing && <form className="pact-composer" onSubmit={e => { e.preventDefault(); void run(async () => { if (editing) await familyRepo.updateDraft(editing, actor.id, title, clauses,selectedRules); else await familyRepo.createPact(childId!, actor.id, title, clauses,replaces,selectedRules); setComposing(false) }, '草稿保存好了，大家可以继续商量。') }}><h3>{editing ? '继续商量草稿' : '把约定写下来'}</h3><p>名称和每条约定都要填写，最多 12 条。</p><label>公约名称（必填）<input required maxLength={60} value={title} onChange={e => setTitle(e.target.value)} /></label><fieldset><legend>关联已有打卡（可选）</legend>{habits.rules.filter(r=>r.active).map(r=><label key={r.id}><input type="checkbox" checked={selectedRules.includes(r.id)} onChange={e=>setSelectedRules(e.target.checked?[...selectedRules,r.id]:selectedRules.filter(id=>id!==r.id))}/>{r.title}</label>)}</fieldset>{clauses.map((c,i) => <fieldset key={i}><legend>第 {i+1} 条约定</legend><label>谁来做？<select value={c.memberId} onChange={e => setClauses(clauses.map((x,j) => j === i ? { ...x, memberId: e.target.value } : x))}>{data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>我愿意做到（必填）<input required maxLength={120} value={c.text} onChange={e => setClauses(clauses.map((x,j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="例如：陪伴时放下手机 15 分钟" /></label><button type="button" className="btn btn-sm" disabled={clauses.length <= 1} onClick={() => setClauses(clauses.filter((_,j) => i !== j))}>移除第 {i+1} 条</button></fieldset>)}<div className="family-actions"><button type="button" className="btn" disabled={clauses.length >= 12} onClick={() => setClauses([...clauses, { memberId: actor.id, text: '' }])}>再加一条</button><button className="btn btn-primary" disabled={busy}>保存公约草稿</button><button type="button" className="btn" onClick={() => setComposing(false)}>先收起</button></div></form>}
        {regularPacts.filter(p => !p.archived).length === 0 && <p className="muted">还没有共同公约。可以写“孩子收好玩具，家长专心陪伴”。原来的打卡图卡照常使用。</p>}
        <div className="pact-list">{regularPacts.filter(p => !p.archived).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(p => {
          const active = pactIsActive(p, data.signatures)
          const participants = [...new Set(p.clauses.map(c => c.memberId))]
          const signed = (id: string) => data.signatures.some(s => s.pactId === p.id && s.memberId === id)
          return <article className="pact-paper" key={p.id}><span className="pact-state">{active ? '全员已签订 · 正在实行' : p.sealed ? '内容已确认 · 等待各自签订' : '共同商量中'}</span><h3>{p.title}</h3><ol>{p.clauses.map((c,i) => <li key={i}><strong>{memberLabel(c.memberId)}</strong>：{c.text}</li>)}</ol><div className="pact-stamps">{participants.map(id => <span key={id} className={signed(id) ? 'signed' : ''}>{signed(id) ? '✓ 已盖章' : '待签订'}<strong>{memberLabel(id)}</strong></span>)}</div>
            <div className="family-actions">{!p.sealed && <><button className="btn" type="button" disabled={busy} onClick={() => compose(p)}>一起修改草稿</button>{parent && <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void run(() => familyRepo.sealPact(p.id, actor.id), '内容固定好了，轮到每个人亲自盖章。')}>确认内容，发起签订</button>}</>}{p.sealed && !active && <Link className="btn btn-primary" to={`/sign/${p.id}`} onClick={e=>{e.preventDefault();startSigning(p.id)}}>全家轮流签订</Link>}{!parent && p.sealed && participants.includes(actor.id) && !signed(actor.id) && <FingerprintSign name={actor.name} disabled={busy} onComplete={() => run(() => familyRepo.signPact(p.id, actor.id), `${actor.name}盖章啦！这份承诺也有你的一份。`)} />}{p.sealed && <button type="button" className="btn" onClick={() => compose(p)}>商量一份新约定</button>}{parent && <button type="button" className="btn" disabled={busy} onClick={() => void run(() => familyRepo.archivePact(p.id, actor.id), '公约已收进回忆，原签订和打卡记录都保留。')}>收进回忆</button>}</div>
          </article>
        })}</div>
      </Card>
      <Card title="今天，一起做到" id="family-today"><p>{date} · 每个人完成自己的约定，孩子也能给父母送鼓励。</p>{!regularPacts.some(p => pactIsActive(p, data.signatures)) && <p className="muted">等大家都盖章，今天的共同打卡就会出现在这里。</p>}
        <div className="family-check-grid">{regularPacts.filter(p => pactIsActive(p, data.signatures)).flatMap(p => p.clauses.map((c,i) => {
          const check = data.checks.find(r => r.pactId === p.id && r.clause === i && r.date === date)
          const reactions = check ? data.reactions.filter(r => r.checkId === check.id) : []
          const encouraged = reactions.some(r => r.memberId === actor.id)
          return <article key={`${p.id}:${i}`} className={`family-check-card ${check ? 'done' : ''}`}><span>{memberLabel(c.memberId)}的约定</span><h3>{c.text}</h3><small>{p.title}</small>{check ? <><p>✓ 今天做到了</p>{reactions.length > 0 && <p className="muted">{reactions.map(r => memberLabel(r.memberId)).join('、')}送来了鼓励</p>}{c.memberId !== actor.id && <button type="button" className="btn" disabled={busy || encouraged} onClick={() => void run(() => familyRepo.encourage(check.id, actor.id), `把鼓励送给${memberLabel(c.memberId)}啦！`)}>{encouraged ? '已送出鼓励 ♥' : `给${memberLabel(c.memberId)}送鼓励`}</button>}</> : c.memberId === actor.id ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => familyRepo.checkIn(p.id, i, actor.id, date), '今天的小约定完成了，星空多了一束光！')}>我今天做到了</button> : <p className="muted">等{memberLabel(c.memberId)}自己来打卡</p>}</article>
        }))}</div>
      </Card>
      {!parent && <ConstellationMap childId={childId ?? ''} tasks={data.tasks} checks={data.routineChecks} />}
      {(data.checks.length > 0 || regularPacts.some(p => p.archived)) && <Card title="一起走过的小脚印"><ul className="family-history">{[...data.checks].sort((a,b) => b.date.localeCompare(a.date)).slice(0,20).map(c => <li key={c.id}><time>{c.date}</time><span>{memberLabel(c.memberId)} · {regularPacts.find(p => p.id === c.pactId)?.clauses[c.clause]?.text ?? '完成了一条约定'}</span></li>)}</ul>{regularPacts.filter(p => p.archived).map(p => <details key={p.id}><summary>{p.title} · 已收进回忆</summary><ol>{p.clauses.map((c,i) => <li key={i}>{memberLabel(c.memberId)}：{c.text}</li>)}</ol><p>{data.signatures.filter(s => s.pactId === p.id).map(s => `${memberLabel(s.memberId)}已签订`).join('，') || '尚未签订'}</p></details>)}</Card>}
    </>}
  </div>
}
