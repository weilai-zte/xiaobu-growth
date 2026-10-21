import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { familyRepo, pactIsActive } from '../lib/family'
import { todayKey } from '../lib/date'
import { FingerprintSign } from '../components/FingerprintSign'
export function PactSigning(){
 const {pactId}=useParams(),{profile}=useApp(),[selected,setSelected]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const data=useLiveQuery(async()=>profile?{pacts:await familyRepo.listPacts(profile.id),members:await familyRepo.listMembers(profile.id),signatures:await familyRepo.listSignatures(profile.id),checks:await familyRepo.listChecks(profile.id),reactions:await familyRepo.listReactions(profile.id)}:undefined,[profile?.id])
 const pact=data?.pacts.find(p=>p.id===pactId&&!p.archived&&p.sealed),members=data?.members.filter(m=>pact?.clauses.some(c=>c.memberId===m.id))??[],actor=members.find(m=>m.id===selected)??members.find(m=>!data?.signatures.some(s=>s.pactId===pactId&&s.memberId===m.id))??members[0]
 if(!data)return <p role="status">正在打开公约…</p>
 if(!pact)return <section><h1>这份公约还未发起或已收起</h1><Link to="/parent/family">回到公约管理</Link></section>
 const signed=actor&&data.signatures.some(s=>s.pactId===pact.id&&s.memberId===actor.id)
 return <section className="signing-page"><h1>一起签订公约</h1><h2>{pact.title}</h2><ol>{pact.clauses.map((c,i)=><li key={i}>{data.members.find(m=>m.id===c.memberId)?.name}：{c.text}</li>)}</ol><p>签好这一次，今后按约定打卡。每位家人轮流亲自盖章。</p><label>现在轮到谁<select value={actor?.id??''} onChange={e=>setSelected(e.target.value)}>{members.map(m=><option key={m.id} value={m.id}>{m.name}{data.signatures.some(s=>s.pactId===pact.id&&s.memberId===m.id)?'（已签）':''}</option>)}</select></label>{actor&&!signed&&<FingerprintSign name={actor.name} disabled={busy} onComplete={async()=>{setBusy(true);try{await familyRepo.signPact(pact.id,actor.id);setSelected('');setMessage(`${actor.name}已盖章`)}catch(e){setMessage(e instanceof Error?e.message:'请重试')}finally{setBusy(false)}}}/>}<p role="status">{pactIsActive(pact,data.signatures)?'全员已签订，公约持续有效。':signed?'你已签好，轮到其他家人了。':message}</p>{pactIsActive(pact,data.signatures)&&actor&&<details><summary>查看家人互动</summary><p>各自完成约定，也可以鼓励家人。这里不另发兑换星星。</p>{pact.clauses.map((c,i)=>{const check=data.checks.find(v=>v.pactId===pact.id&&v.clause===i&&v.date===todayKey());return <article key={i}><p>{data.members.find(m=>m.id===c.memberId)?.name}：{c.text}</p>{check?<><p>今天做到了</p>{c.memberId!==actor.id&&<button className="btn" disabled={busy||data.reactions.some(r=>r.checkId===check.id&&r.memberId===actor.id)} onClick={()=>{setBusy(true);void familyRepo.encourage(check.id,actor.id).catch(e=>setMessage(String(e))).finally(()=>setBusy(false))}}>给家人送鼓励</button>}</>:c.memberId===actor.id&&<button className="btn" disabled={busy} onClick={()=>{setBusy(true);void familyRepo.checkIn(pact.id,i,actor.id).catch(e=>setMessage(String(e))).finally(()=>setBusy(false))}}>我今天做到了</button>}</article>})}</details>}<Link className="btn" to="/parent/family">返回公约管理</Link></section>
}
