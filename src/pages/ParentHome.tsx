import { HonorLedger } from '../components/HonorNotice'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { repo } from '../db/repo'
import { familyRepo, pactIsActive } from '../lib/family'
import { Card } from '../components/ui'
import { ConstellationMap } from '../components/ConstellationMap'
import { BirdGrowth, GrowthTrail } from '../components/GrowthJourney'
import { CheckinHeatmap } from '../components/CheckinHeatmap'
import { todayKey } from '../lib/date'
import { uniqueAdventures } from '../lib/adventure'
export function ParentHome() {
 const {profile}=useApp()
 const data=useLiveQuery(async()=>profile?{wishes:await repo.listWishes(profile.id),pacts:await familyRepo.listPacts(profile.id),signatures:await familyRepo.listSignatures(profile.id)}:undefined,[profile?.id])
 return <div className="parent-home"><header><h1>家长管理</h1><p>安排好内容，孩子每天安心打卡。</p></header><Card title="待办"><div className="parent-todos"><Link to="/parent/rewards">待确认心愿 <strong>{data?.wishes.filter(w=>w.status==='proposed').length??0}</strong></Link><Link to="/parent/rewards">待兑现奖励 <strong>{data?.wishes.filter(w=>w.status==='requested').length??0}</strong></Link><Link to="/parent/family">待签公约 <strong>{data?.pacts.filter(p=>!p.archived&&!pactIsActive(p,data.signatures)).length??0}</strong></Link></div></Card><section className="parent-menu" aria-label="家长设置分组">{[
 ['/parent/checkins','打卡设置','生活、运动、学习的图片、步骤和星数'],['/parent/family','家庭与公约','成员、共同签订与修改公约'],['/parent/rewards','心愿与奖励','确认心愿、定价上架和送出礼物'],['/parent/bank','星星银行','设置每周利率，查看存取与利息'],['/parent/records','成长记录','打卡热力图、星座与鹦鹉成长'],['/parent/settings','数据与声音','孩子档案、家长门锁、声音和备份'],['/parent/more','其他原有功能','睡眠、学习管理、复盘和改进记录']
 ].map(([to,title,desc])=><Link to={to} key={to}><strong>{title}</strong><span>{desc}</span><span aria-hidden="true">›</span></Link>)}</section><HonorLedger profile={profile} revealAll/></div>
}
export function ParentRecords(){
 const {profile}=useApp();const data=useLiveQuery(async()=>profile?{tasks:await repo.listTaskRecords(profile.id),checks:await repo.listChecks(profile.id),runs:await repo.listAdventures(profile.id)}:undefined,[profile?.id])
 return <div><h1>成长记录</h1>{data&&<><CheckinHeatmap checks={data.checks} date={todayKey()}/><GrowthTrail tasks={data.tasks} checks={data.checks} date={todayKey()}/><BirdGrowth count={uniqueAdventures(data.runs).length} runs={data.runs}/></>}{data&&<ConstellationMap childId={profile!.id} tasks={data.tasks} checks={data.checks}/>}</div>
}
