import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { useSync } from '../app/SyncProvider'
import { repo, newId } from '../db/repo'
import { starBalance } from '../lib/rewards'

export function Bank({parent=false}:{parent?:boolean}) {
 const {profile}=useApp(),{engine}=useSync(),childId=profile?.id
 const [amount,setAmount]=useState(''),[rate,setRate]=useState('1'),[enabled,setEnabled]=useState(true),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const pending=useRef<{key:string;id:string; action?:string; amount?:number; rateBps?:number; enabled?:boolean}|null>(null)
 const data=useLiveQuery(async()=>childId?{account:await repo.getBankAccount(childId),entries:await repo.listBankEntries(childId),tasks:await repo.listTaskRecords(childId),checks:await repo.listChecks(childId),wishes:await repo.listWishes(childId),runs:await repo.listAdventures(childId)}:undefined,[childId])
 const account=data?.account, balance=starBalance(data?.tasks??[],data?.checks??[],data?.wishes??[],data?.runs??[],data?.entries??[],profile?.starClaims)
 useEffect(()=>{if(account&&!pending.current){setRate(String(account.configuredRateBps/100));setEnabled(account.enabled)}},[account?.configuredRateBps,account?.enabled])
 useEffect(()=>{if(!childId)return;void repo.getSetting<typeof pending.current>(`bank.pending:${childId}`,null).then(saved=>{if(saved){pending.current=saved;setAmount(saved.amount===undefined?'':String(saved.amount));if(saved.rateBps!==undefined)setRate(String(saved.rateBps/100));if(saved.enabled!==undefined)setEnabled(saved.enabled);setMessage('上次操作待确认，请使用相同星数或设置重试。')}});let cancelled=false;void engine.bankOperation({childId,action:'settle',requestId:newId()}).catch(()=>{if(!cancelled)setMessage('暂未连接银行服务，存款记录仍保留。联网后可存取并补结周息。')});return()=>{cancelled=true}},[childId,engine])
 async function act(action:'deposit'|'withdraw'|'configure'){
  if(!childId||busy)return
  const input=action==='configure'?{rateBps:Math.round(Number(rate)*100),enabled}:{amount:Number(amount)}
  if(action==='configure'&&(!Number.isFinite(Number(rate))||Number(rate)<0||Number(rate)>20||Math.abs(Number(rate)*100-Math.round(Number(rate)*100))>1e-7)){setMessage('每周利率请填写0至20%，最多两位小数');return}
  if(action!=='configure'&&(!Number.isSafeInteger(Number(amount))||Number(amount)<=0)){setMessage('存取星数请填写正整数');return}
  const key=JSON.stringify({childId,action,...input});if(pending.current&&pending.current.key!==key){setMessage('上次操作结果尚未确认，请先用相同星数重试，避免重复存取。');return}
  pending.current??={key,id:newId(),action,...input};setBusy(true)
  try{await repo.setSetting(`bank.pending:${childId}`,pending.current);await engine.bankOperation({childId,action,requestId:pending.current.id,...input});pending.current=null;await repo.setSetting(`bank.pending:${childId}`,null);setAmount('');setMessage(action==='configure'?'设置已保存。已有存款的利率从下一完整周期生效。':action==='deposit'?'星星已存入银行。':'星星已取回，可以兑换心愿了。')}
  catch(e){if((e as {definitive?:boolean}).definitive){pending.current=null;await repo.setSetting(`bank.pending:${childId}`,null)}setMessage((e instanceof Error?e.message:'保存失败')+'。可用相同设置重试。')}
  finally{setBusy(false)}
 }
 const content=<><div className="bank-balances"><div><span>可用星星</span><strong>{data?balance.available:'…'} <small>星</small></strong></div><div><span>银行存款</span><strong>{account?.balance??0} <small>星</small></strong></div></div><p>{account?.enabled?`每周利率 ${account.weeklyRateBps/100}%${account.balance?`，下次结息 ${account.nextInterestDate}`:'，存入后满7天结息'}`:'银行尚未开启或已暂停计息，已有存款仍可取出。'}</p>{account?.enabled&&account.weeklyRateBps!==account.configuredRateBps&&<p>下一周期利率：{account.configuredRateBps/100}%</p>}
 <p className="bank-message" role="status">{busy?'正在确认银行操作…':message}</p>
 {parent?<form onSubmit={e=>{e.preventDefault();void act('configure')}}><label className="bank-toggle"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>开启每周计息和存入</label><label>每周利率（%）<input type="number" min="0" max="20" step="0.01" required value={rate} onChange={e=>setRate(e.target.value)}/></label><p>例如存10星，每周10%，满一周得1星。这里只使用应用内星星。</p><button className="btn btn-primary" disabled={busy||!data}>保存银行设置</button></form>:<form onSubmit={e=>{e.preventDefault();void act('deposit')}}><label>存入或取出几颗星<input inputMode="numeric" type="number" required min="1" max="1000000" step="1" value={amount} onChange={e=>setAmount(e.target.value)} /></label><div className="bank-actions"><button className="btn btn-primary" disabled={busy||!data||!account?.enabled}>存入星星</button><button className="btn" type="button" disabled={busy||!data||!account?.balance} onClick={()=>void act('withdraw')}>取出星星</button></div></form>}
 <details><summary>存款和利息怎么计算？</summary><p>每满7天结一次利息，利息留在银行，下周期一起计息。周内追加存款从下周期开始计息；取款会降低本周期计息本金。不足1星的部分累计保留。打开银行时会补结已到期的完整周，同一周不重复结息。</p><p>家长修改利率从下一周期生效；暂停不再产生新利息。暂停后仍可取出存款。存入的钱包星星不能同时兑换礼物，取出后可用。银行不影响星座打卡次数，也不会满足冒险出发的打卡条件。</p></details>
 <details><summary>存取与周息记录</summary><ul className="bank-history">{[...(data?.entries??[])].filter(e=>e.kind!=='configure').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,40).map(e=><li key={e.id}><time>{e.date}</time><span>{{deposit:'存入',withdraw:'取出',interest:'周息',configure:'设置'}[e.kind]}</span><strong>{e.amount}星</strong></li>)}</ul>{!data?.entries.some(e=>e.kind!=='configure')&&<p>还没有记录。</p>}</details></>
 return parent?<section className="bank-panel"><h1>星星银行设置</h1>{content}</section>:<details className="bank-panel"><summary>星星银行 <span>{account?.balance??0}星已存入</span></summary>{content}</details>
}
