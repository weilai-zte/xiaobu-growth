import { it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
it('服务端银行事务：重复请求、余额互斥、跨孩子隔离、流水保护和旧数据保留',()=>{
 const dir=mkdtempSync(join(tmpdir(),'xiaobu-bank-'))
 try{
 const run=spawnSync(process.execPath,['--input-type=module','-e',`
 import assert from 'node:assert/strict';
 const {bankOperation:b,upsertRecord:u,listEntity,db,getRecord}=await import('./server/db.mjs');
 const now=new Date().toISOString();
 u('childProfiles',{id:'c',name:'测试',isPrimary:true,createdAt:now,updatedAt:now});
 u('childProfiles',{id:'other',name:'另一个孩子',isPrimary:false,createdAt:now,updatedAt:now});
 for(let i=0;i<20;i++)u('routineChecks',{id:'check'+i,childId:'c',ruleId:'r'+i,date:'2026-10-20',status:'done',rewardStars:1,createdAt:now,updatedAt:now});
 const b1=(action,requestId,extra={})=>b({childId:'c',action,requestId,...extra});
 b1('configure','config',{enabled:true,rateBps:1000});
 b1('deposit','one',{amount:10});b1('deposit','one',{amount:10});assert.equal(getRecord('bankAccounts','bank:c').balance,10);
 assert.equal(listEntity('bankEntries').filter(e=>e.kind==='deposit').length,1);
 assert.throws(()=>b1('deposit','bad',{amount:11}),/不足/);
 assert.throws(()=>u('wishes',{id:'w',childId:'c',name:'积木',picture:'gift',cost:11,status:'requested',createdAt:now,updatedAt:now}),/不足/);
 u('wishes',{id:'w',childId:'c',name:'积木',picture:'gift',cost:10,status:'requested',createdAt:now,updatedAt:now});
 assert.throws(()=>b1('deposit','reserved',{amount:1}),/不足/);
 assert.throws(()=>b({childId:'other',action:'withdraw',requestId:'other',amount:1}),/不足/);
 b1('withdraw','take',{amount:5});assert.equal(getRecord('bankAccounts','bank:c').balance,5);
 assert.throws(()=>u('bankEntries',{id:'forged',childId:'c',kind:'withdraw',amount:100}),/只能/);
 assert.equal(listEntity('routineChecks').length,20);
 assert.equal(listEntity('childProfiles').length,2);
 // 模拟已到期账户，只在独立测试数据库直接设置日期。
 const account=getRecord('bankAccounts','bank:c');account.nextInterestDate='2020-01-01';account.enabled=false;
 db.prepare('UPDATE records SET payload=? WHERE entity=? AND id=?').run(JSON.stringify(account),'bankAccounts','bank:c');
 assert.equal(b1('settle','s1').balance,5);
 db.close();console.log('bank transaction assertions passed');
 `],{cwd:process.cwd(),env:{...process.env,XB_DB:join(dir,'test.db')},encoding:'utf8'})
 expect(run.status,run.stderr||run.stdout).toBe(0)
 expect(run.stdout).toContain('bank transaction assertions passed')
 }finally{rmSync(dir,{recursive:true,force:true})}
})
