import { beforeAll, afterAll, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GrowthDB } from '../src/db/db'
import { createRepo } from '../src/db/repo'
import { createSyncEngine } from '../src/db/sync'
import { starBalance } from '../src/lib/rewards'

const dir=mkdtempSync(join(tmpdir(),'xb-conflict-e2e-')),databasePath=join(dir,'isolated.db')
let server:ChildProcess,base:string
beforeAll(async()=>{
 const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const port=(listener.address() as {port:number}).port
 await new Promise<void>(r=>listener.close(()=>r()));base=`http://127.0.0.1:${port}`
 server=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',XB_DB:databasePath},stdio:'ignore'})
 let ready=false
 for(let i=0;i<80;i++){
  if(server.exitCode!==null)throw new Error('isolated server failed to start')
  try{const r=await fetch(base+'/api/health');const data=await r.json();if(r.ok){expect(data.dbPath).toBe(databasePath);ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,100))
 }
 if(!ready)throw new Error('isolated server unavailable')
})
afterAll(async()=>{if(server?.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}rmSync(dir,{recursive:true,force:true})})
async function device(){const db=new GrowthDB(`device-${Math.random()}`),repo=createRepo(db),engine=createSyncEngine({repo,endpoint:base+'/api',intervalMs:600000});await engine.start();return {db,repo,engine}}

it('两个离线设备争兑：合法打卡照常上传，失败申请退回，余额不超支且重试幂等',async()=>{
 const a=await device(),b=await device()
 try{
  const child=await a.repo.createProfile({name:'冲突测试'})
  // Explicit fictional rows: six earned stars, two rewards cost four each.
  const stamp=new Date().toISOString()
  for(let i=0;i<3;i++){
   const row={id:`earn-${i}`,childId:child.id,date:'2026-10-23',name:`任务${i}`,completion:'independent',rewardStars:2,createdAt:stamp,updatedAt:stamp}
   await a.db.taskRecords.put(row as never);await a.repo.enqueue('taskRecords',row)
  }
  const w1=await a.repo.proposeWish(child.id,'积木','gift',4),w2=await a.repo.proposeWish(child.id,'绘本','gift',4)
  expect(await a.engine.syncNow()).toBe(true);expect(await b.engine.syncNow()).toBe(true)
  const localGift=await b.repo.proposeWish(child.id,'新礼物','gift',4)
  await a.repo.changeWish(w1.id,'request');await b.repo.changeWish(localGift.id,'request')
  expect(await a.engine.syncNow()).toBe(true)
  const done={id:'offline-good',childId:child.id,date:'2026-10-24',name:'整理书桌',completion:'independent',rewardStars:1,createdAt:stamp,updatedAt:new Date().toISOString()}
  await b.db.taskRecords.put(done as never);await b.repo.enqueue('taskRecords',done)
  expect(await b.engine.syncNow()).toBe(false)
  expect(b.engine.getSnapshot().lastError).toContain('申请已退回')
  expect((await b.db.wishes.get(localGift.id))?.status).toBe('approved')
  expect((await b.db.wishes.get(w2.id))?.status).toBe('approved')
  expect(await b.repo.outboxCount()).toBe(1)
  expect(await b.engine.syncNow()).toBe(true);expect(await a.engine.syncNow()).toBe(true)
  expect(await b.repo.outboxCount()).toBe(0)
  expect((await a.db.wishes.get(localGift.id))?.status).toBe('approved')
  expect(await a.db.taskRecords.get(done.id)).toBeTruthy()
  const balance=starBalance(await b.repo.listTaskRecords(child.id),[],await b.repo.listWishes(child.id))
  expect(balance.reserved).toBe(4);expect(balance.available).toBe(3)
  expect((await a.repo.listWishes(child.id)).filter(w=>w.status==='requested')).toHaveLength(1)
 }finally{for(const d of [a,b]){d.engine.stop();await d.db.delete()}}
})

it('多设备同日照料：不同动作合并，重复动作和陈旧档案不重复加分或回退',async()=>{
 const a=await device(),b=await device()
 try{
  const child=await a.repo.createProfile({name:'照料测试'});await a.engine.syncNow();await b.engine.syncNow()
  await a.repo.recordBuddyCare(child.id,'feed');await b.repo.recordBuddyCare(child.id,'play')
  expect(await a.engine.syncNow()).toBe(true);expect(await b.engine.syncNow()).toBe(true);await a.engine.syncNow()
  expect((await a.db.childProfiles.get(child.id))?.buddyCare?.xp).toBe(2)
  expect((await b.db.childProfiles.get(child.id))?.buddyCare?.completed.sort()).toEqual(['feed','play'])
  await b.repo.recordBuddyCare(child.id,'feed');await b.engine.syncNow();await a.engine.syncNow()
  expect((await a.db.childProfiles.get(child.id))?.buddyCare?.xp).toBe(2)
 }finally{for(const d of [a,b]){d.engine.stop();await d.db.delete()}}
})
it('拉取成功后上传断网，再重试过期本地编辑仍会对齐服务器权威版本',async()=>{
 const a=await device(),b=await device()
 try{
  const child=await a.repo.createProfile({name:'重试测试'});const original=await a.repo.saveDailyLog({childId:child.id,date:'2026-10-24',sleepTime:'21:00'})
  await a.engine.syncNow();await b.engine.syncNow()
  const stale=await b.db.dailyLogs.get(original.id)
  await new Promise(r=>setTimeout(r,5));await a.repo.saveDailyLog({childId:child.id,date:'2026-10-24',sleepTime:'22:00'});await a.engine.syncNow()
  const local={...stale!,sleepTime:'20:00',updatedAt:'2000-01-01T00:00:00Z'}
  await b.db.dailyLogs.put(local);await b.repo.enqueue('dailyLogs',local)
  let fail=true
  const retry=createSyncEngine({repo:b.repo,endpoint:base+'/api',fetchImpl:async(url,init)=>{if(init?.method==='POST'&&fail){fail=false;throw new Error('simulated connection lost')}return fetch(url,init)}})
  expect(await retry.syncNow()).toBe(false)
  expect(await b.repo.outboxCount()).toBe(1)
  expect(await retry.syncNow()).toBe(true)
  expect((await b.db.dailyLogs.get(original.id))?.sleepTime).toBe('22:00')
  expect(await b.repo.outboxCount()).toBe(0)
 }finally{for(const d of [a,b]){d.engine.stop();await d.db.delete()}}
})
