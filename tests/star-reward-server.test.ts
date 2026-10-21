import { it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
it('服务端接受成就奖励兑换，并与银行预留互斥',()=>{
 const dir=mkdtempSync(join(tmpdir(),'xiaobu-stars-'))
 try {
 const run=spawnSync(process.execPath,['--input-type=module','-e',`
 import assert from 'node:assert/strict';
 const {bankOperation,upsertRecord:u,getRecord,db}=await import('./server/db.mjs');
 const now=new Date().toISOString();
 u('childProfiles',{id:'c',name:'测试',isPrimary:true,createdAt:now,updatedAt:now,honorClaims:{'honor:sport:1':now},starClaims:{aries:now,'sky:taurus:0':now}});
 u('wishes',{id:'w',childId:'c',name:'奖励',picture:'gift',cost:4,status:'requested',createdAt:now,updatedAt:now});
 assert.equal(getRecord('wishes','w').status,'requested');
 bankOperation({childId:'c',action:'configure',requestId:'config',enabled:true,rateBps:100});
 assert.throws(()=>bankOperation({childId:'c',action:'deposit',requestId:'deposit',amount:1}),/不足/);
 u('wishes',{...getRecord('wishes','w'),status:'redeemed',updatedAt:new Date(Date.now()+1000).toISOString()});
 assert.equal(getRecord('wishes','w').status,'redeemed');db.close();
 `],{cwd:process.cwd(),env:{...process.env,XB_DB:join(dir,'test.db')},encoding:'utf8'})
 expect(run.status,run.stderr||run.stdout).toBe(0)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
