import Dexie from 'dexie'
import {it,expect} from 'vitest'
import {GrowthDB,ENTITY_NAMES} from '../src/db/db'
import {createRepo,newId} from '../src/db/repo'
import {buildExportBundle,importBundle} from '../src/lib/transfer'
import {starBalance} from '../src/lib/rewards'
it('v5原数据升级到v6只增加银行表；备份恢复银行与打卡后余额一致',async()=>{
 const template=new GrowthDB('schema-'+newId());await template.open()
 const schemas=Object.fromEntries(template.tables.filter(t=>!['bankAccounts','bankEntries'].includes(t.name)).map(t=>[t.name,[t.schema.primKey.src,...t.schema.indexes.map(i=>i.src)].join(',')]))
 await template.delete()
 const name='upgrade-'+newId(),old=new Dexie(name);old.version(5).stores(schemas);await old.open()
 const stamp={createdAt:'2026-10-20T00:00:00Z',updatedAt:'2026-10-20T00:00:00Z'}
 await old.table('childProfiles').put({id:'c',name:'原名字',isPrimary:true,...stamp})
 await old.table('routineRules').put({id:'custom',childId:'c',title:'原有自定义习惯',steps:['收好书'],trigger:'anytime',active:true,order:1,...stamp})
 await old.table('routineChecks').put({id:'done',childId:'c',ruleId:'custom',date:'2026-10-19',status:'done',rewardStars:2,...stamp})
 old.close()
 const upgraded=new GrowthDB(name),copy=new GrowthDB(name+'-copy')
 try{
  await upgraded.open();expect(upgraded.verno).toBe(6);expect((await upgraded.routineRules.get('custom'))?.title).toBe('原有自定义习惯');expect(await upgraded.routineChecks.count()).toBe(1);expect(await upgraded.bankAccounts.count()).toBe(0)
  await upgraded.bankAccounts.put({id:'bank:c',childId:'c',balance:1,eligibleBalance:1,remainder:0,enabled:true,weeklyRateBps:100,configuredRateBps:100,nextInterestDate:'2026-10-27',...stamp})
  await upgraded.bankEntries.put({id:'deposit',childId:'c',kind:'deposit',amount:1,date:'2026-10-20',...stamp})
  const bundle=await buildExportBundle(upgraded);expect(bundle.version).toBe(3)
  const result=await importBundle(copy,bundle);expect(result.skippedInvalid).toBe(0)
  const repo=createRepo(copy);expect(starBalance([],await repo.listChecks('c'),[],[],await repo.listBankEntries('c')).available).toBe(1)
  expect((await repo.getBankAccount('c'))?.balance).toBe(1)
  for(const entity of ENTITY_NAMES)expect(await copy[entity].count()).toBe(await upgraded[entity].count())
 }finally{await upgraded.delete();await copy.delete()}
})
