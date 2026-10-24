import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GrowthDB } from '../src/db/db'
import { createRepo } from '../src/db/repo'
import { createSyncEngine } from '../src/db/sync'

const databases: GrowthDB[] = []
function device() {
 const db = new GrowthDB(`repair-${Math.random()}`);databases.push(db)
 return {db,repo:createRepo(db)}
}
afterEach(async()=>{for(const db of databases.splice(0))await db.delete()})
const stamp='2026-10-24T00:00:00.000Z'
const wish={id:'w',childId:'c',name:'绘本',picture:'gift',cost:2,status:'requested' as const,createdAt:stamp,updatedAt:stamp}
const task={id:'t',childId:'c',date:'2026-10-24',name:'读书',subject:'语文',difficulty:'easy',plannedMinutes:5,status:'finished',completion:'independent',createdAt:stamp,updatedAt:stamp,rewardStars:2}

describe('F1 服务端版本优先',()=>{
 it('没有待传改动时，更高syncSeq覆盖快一分钟的本地时间戳',async()=>{
  const {repo,db}=device()
  await db.wishes.put({...wish,updatedAt:'2026-10-24T00:01:00.000Z',syncSeq:1} as never)
  expect(await repo.applyRemote('wishes',[{...wish,status:'approved',syncSeq:2}])).toBe(1)
  expect((await db.wishes.get('w'))?.status).toBe('approved')
  expect(await repo.applyRemote('wishes',[{...wish,updatedAt:'2099-01-01T00:00:00Z',syncSeq:1}])).toBe(0)
 })
 it('未携带服务端版本的旧本地镜像也接受有版本的远端；待传记录仍受保护',async()=>{
  const {repo,db}=device();await db.wishes.put({...wish,updatedAt:'2099-01-01T00:00:00Z'})
  expect(await repo.applyRemote('wishes',[{...wish,status:'approved',syncSeq:2}])).toBe(1)
  await repo.enqueue('wishes',{...wish})
  expect(await repo.applyRemote('wishes',[{...wish,status:'redeemed',syncSeq:3}])).toBe(0)
  expect(await repo.outboxCount()).toBe(1)
 })
})

describe('F3 同步响应逐条处理',()=>{
 it('兑换冲突释放预留，其他有效打卡落地，普通无效记录不丢失',async()=>{
  const {repo,db}=device();await db.wishes.put(wish)
  await repo.enqueue('wishes',wish);await repo.enqueue('taskRecords',task)
  const invalid={...task,id:'bad',rewardStars:999};await repo.enqueue('taskRecords',invalid)
  const engine=createSyncEngine({repo,endpoint:'/fixture',fetchImpl:async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'?{
   seq:5,tables:{taskRecords:[{...task,syncSeq:5}]},rejected:[
    {entity:'wishes',id:'w',code:'WISH_CONFLICT',error:'余额不足',canonical:{...wish,status:'approved',syncSeq:4}},
    {entity:'taskRecords',id:'bad',code:'INVALID_RECORD',error:'无效星数',canonical:null},
   ],
  }:{seq:3,tables:{}}),{status:200})})
  expect(await engine.syncNow()).toBe(false)
  expect((await db.wishes.get('w'))?.status).toBe('approved')
  expect(await db.taskRecords.get('t')).toBeTruthy()
  expect((await repo.listOutbox()).map(r=>r.recordId)).toEqual(['bad'])
  expect(engine.getSnapshot().lastError).toContain('无效星数')
 })
 it('仅兑换冲突也要留下清楚提示；不存在远端奖励时释放本地预留且不伪造兑现',async()=>{
  const {repo,db}=device();await db.wishes.put(wish);await repo.enqueue('wishes',wish)
  const engine=createSyncEngine({repo,endpoint:'/fixture',fetchImpl:async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'?{seq:1,tables:{},rejected:[{entity:'wishes',id:'w',code:'WISH_CONFLICT',error:'余额不足',canonical:null}]}:{seq:0,tables:{}}),{status:200})})
  expect(await engine.syncNow()).toBe(false)
  expect((await db.wishes.get('w'))?.status).toBe('approved')
  expect(await repo.outboxCount()).toBe(1)
  expect((await repo.listOutbox())[0].payload.status).toBe('approved')
  expect(engine.getSnapshot().lastError).toContain('余额不足')
 })
 it('响应在途时产生的新改动不能被旧请求确认删除',async()=>{
  const {repo,db}=device();await db.wishes.put(wish);await repo.enqueue('wishes',wish)
  const newer={...wish,status:'approved' as const,updatedAt:'2026-10-24T00:02:00Z'}
  const engine=createSyncEngine({repo,endpoint:'/fixture',fetchImpl:async(_url,init)=>{
   if(init?.method==='POST'){await db.wishes.put(newer);await repo.enqueue('wishes',newer)}
   return new Response(JSON.stringify({seq:3,tables:{wishes:[{...wish,syncSeq:3}]}}),{status:200})
  }})
  await engine.syncNow()
  expect((await repo.listOutbox())[0]?.payload.status).toBe('approved')
  expect((await db.wishes.get('w'))?.status).toBe('approved')
 })
 it('断网/HTTP500不能确认任何队列记录',async()=>{
  const {repo}=device();await repo.enqueue('wishes',wish)
  const engine=createSyncEngine({repo,endpoint:'/fixture',fetchImpl:async()=>new Response('{"error":"故障"}',{status:500})})
  expect(await engine.syncNow()).toBe(false);expect(await repo.outboxCount()).toBe(1)
 })
})

it('F2/F3 SQLite: 合并照料不回退/不重复加分，逐条拒绝不挡合法打卡',()=>{
 const dir=mkdtempSync(join(tmpdir(),'xb-repair-'))
 try{
 const run=spawnSync(process.execPath,['--input-type=module','-e',`
 import assert from 'node:assert/strict';
 const {upsertRecord:u,getRecord:g,syncBatch,db}=await import('./server/db.mjs');
 const t='2026-10-24T00:00:00Z',later='2099-01-01T00:00:00Z';
 u('childProfiles',{id:'c',name:'测试',createdAt:t,updatedAt:t,buddyCare:{date:'2026-10-24',xp:10,completed:['feed'],sleepingSince:null},honorsSeenAt:'2026-10-24T00:00:00Z'});
 const old=g('childProfiles','c');
 u('childProfiles',{...old,updatedAt:later,buddyCare:{date:'2026-10-24',xp:5,completed:['play'],sleepingSince:null},honorsSeenAt:'2020-01-01T00:00:00Z'});
 const merged=g('childProfiles','c');
 assert.equal(merged.buddyCare.xp,11);assert.deepEqual(merged.buddyCare.completed.sort(),['feed','play']);assert.equal(merged.honorsSeenAt,old.honorsSeenAt);
 u('childProfiles',{...merged,updatedAt:later,buddyCare:{...old.buddyCare,xp:10}});
 assert.equal(g('childProfiles','c').buddyCare.xp,11);
 const base={childId:'c',name:'书',picture:'gift',cost:2,status:'approved',createdAt:t,updatedAt:t};
 u('wishes',{...base,id:'w'});
 const response=syncBatch({wishes:[{...g('wishes','w'),status:'requested',updatedAt:later}],taskRecords:[{id:'good',childId:'c',date:'2026-10-24',name:'读书',completion:'independent',rewardStars:1,createdAt:t,updatedAt:t},{id:'bad',childId:'c',rewardStars:999,createdAt:t,updatedAt:t}]});
 assert.equal(response.rejected.length,2);assert.equal(response.rejected.find(r=>r.id==='w').code,'WISH_CONFLICT');assert.equal(response.rejected.find(r=>r.id==='w').canonical.status,'approved');assert.equal(g('taskRecords','good').rewardStars,1);assert.equal(g('wishes','w').status,'approved');
 db.close();
 `],{cwd:process.cwd(),env:{...process.env,XB_DB:join(dir,'test.db')},encoding:'utf8'})
 expect(run.status,run.stderr||run.stdout).toBe(0)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
it('F1 写本地与加入待传队列必须一起成功，入队失败不能留下静默未同步记录',async()=>{
 const {repo,db}=device()
 const add=vi.spyOn(db.syncQueue,'add').mockRejectedValue(new Error('queue storage unavailable'))
 await expect(repo.createProfile({name:'测试'})).rejects.toThrow('queue storage unavailable')
 expect(await db.childProfiles.count()).toBe(0)
 add.mockRestore()
 const child=await repo.createProfile({name:'测试'})
 expect((await repo.listOutbox()).some(r=>r.recordId===child.id)).toBe(true)
})
