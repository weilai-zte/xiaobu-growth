import { afterEach, expect, it, vi } from 'vitest'
import { GrowthDB } from '../src/db/db'
import { createRepo } from '../src/db/repo'
import { buildExportBundle, importBundle } from '../src/lib/transfer'
const dbs:GrowthDB[]=[]
function database(){const db=new GrowthDB(`backup-repair-${Math.random()}`);dbs.push(db);return db}
afterEach(async()=>{vi.restoreAllMocks();for(const db of dbs.splice(0))await db.delete()})
it('导入新记录原子入队，重复导入不重复排队，服务器专管记录只恢复本机',async()=>{
 const source=database(),repo=createRepo(source),child=await repo.createProfile({name:'测试'})
 await repo.createStrength({childId:child.id,date:'2026-10-24',category:'sport',event:'骑车',childAction:'自己骑',outcome:'完成'})
 await source.adventureRuns.put({id:`adventure:${child.id}:2026-10-24`,childId:child.id,date:'2026-10-24',route:'meadow',scene:0,material:'leaf',bonusStars:2,createdAt:'',updatedAt:''})
 const bundle=await buildExportBundle(source),target=database()
 const report=await importBundle(target,bundle)
 expect(report.added).toBeGreaterThan(1)
 const outbox=await target.syncQueue.toArray()
 expect(outbox.some(r=>r.recordId===child.id)).toBe(true)
 expect(outbox.some(r=>r.entity==='strengthMoments')).toBe(true)
 expect(outbox.some(r=>r.entity==='adventureRuns')).toBe(false)
 expect((report as unknown as {localOnly:number}).localOnly).toBe(1)
 expect(await target.adventureRuns.count()).toBe(1)
 await importBundle(target,bundle);expect(await target.syncQueue.count()).toBe(outbox.length)
})
it('覆盖导入保留本机连接与水位，不带走另一设备的连接配置',async()=>{
 const source=database(),r=createRepo(source);await r.createProfile({name:'测试'})
 await r.setSetting('sync.endpoint','https://other.invalid');await r.setSetting('sync.seq',999)
 const bundle=await buildExportBundle(source),target=database(),repo=createRepo(target)
 await repo.setSetting('sync.familyKey','fixture-only');await repo.setSetting('sync.endpoint','https://current.invalid');await repo.setSetting('sync.seq',12);await repo.setSetting('sync.resetSeq',4)
 await importBundle(target,bundle,'replace')
 expect(await repo.getSetting('sync.familyKey','')).toBe('fixture-only')
 expect(await repo.getSetting('sync.endpoint','')).toBe('https://current.invalid')
 expect(await repo.getSetting('sync.seq',0)).toBe(12)
 expect(await repo.getSetting('sync.resetSeq',0)).toBe(4)
 expect(await target.syncQueue.count()).toBeGreaterThan(0)
})
it('任何入队存储失败都会回滚导入记录和覆盖前数据',async()=>{
 const source=database(),repo=createRepo(source);await repo.createProfile({name:'备份档案'})
 const target=database(),targetRepo=createRepo(target),old=await targetRepo.createProfile({name:'原档案'})
 const bundle=await buildExportBundle(source)
 vi.spyOn(target.syncQueue,'put').mockRejectedValue(new Error('queue unavailable'))
 await expect(importBundle(target,bundle,'replace')).rejects.toThrow('queue unavailable')
 expect((await target.childProfiles.get(old.id))?.name).toBe('原档案')
 expect(await target.childProfiles.count()).toBe(1)
})
