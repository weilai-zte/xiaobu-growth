import {expect,it} from 'vitest'
import {GrowthDB} from '../src/db/db'
import {createRepo} from '../src/db/repo'
import {createSyncEngine} from '../src/db/sync'
it('清空等待已发出的同步结束；清空期间阻止轮询，随后本地与队列为空',async()=>{
 const db=new GrowthDB('clear-race-'+Math.random()),repo=createRepo(db)
 await repo.createProfile({name:'清空并发测试'})
 let release!:()=>void,entered!:()=>void
 const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r),calls:string[]=[]
 let reset=0
 const engine=createSyncEngine({repo,endpoint:'/test',fetchImpl:async(input,init)=>{
  const method=init?.method??'GET',url=String(input);calls.push(method+' '+url)
  if(calls.length===1){entered();await gate}
  if(url.endsWith('/clear-all')){reset=1;return new Response(JSON.stringify({ok:true}))}
  return new Response(JSON.stringify({tables:{},seq:reset,resetSeq:reset}))
 }})
 try{
  const syncing=engine.syncNow();await started
  const clearing=engine.clearEverything();expect(await engine.syncNow()).toBe(false)
  expect(calls.some(s=>s.includes('/clear-all'))).toBe(false)
  release();await syncing;await clearing
  const clearAt=calls.findIndex(s=>s.includes('/clear-all'))
  expect(calls.slice(clearAt+1).some(s=>s.startsWith('POST'))).toBe(false)
  expect(await repo.listProfiles()).toHaveLength(0);expect(await repo.outboxCount()).toBe(0)
  expect(await engine.syncNow()).toBe(true)
 }finally{engine.stop();await db.delete()}
})
