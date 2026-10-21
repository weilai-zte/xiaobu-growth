import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
it.each(['v1','v2','v3','v4','v5'])('实际GLB %s制品包含网格、蒙皮、22关节和两组四元数动画，体积小于1.5MB',(version)=>{
 const data=readFileSync(`public/models/xiaobu-rigged-preview-${version}.glb`);expect(data.readUInt32LE(0)).toBe(0x46546c67);expect(data.readUInt32LE(4)).toBe(2);expect(data.readUInt32LE(8)).toBe(data.length);expect(data.length).toBeLessThan(1.5*1024*1024)
 const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());if(version!=='v1'){expect(json.textures.length).toBeGreaterThan(0);expect(['image/png','image/jpeg']).toContain(json.images[0].mimeType)}expect(json.skins[0].joints).toHaveLength(22);expect(json.meshes[0].primitives).toHaveLength(2);expect(json.animations.map((a:{name:string})=>a.name)).toEqual(['GentleIdle','WingRigPreview']);expect(json.animations.every((a:{channels:{target:{path:string}}[]})=>a.channels.every(c=>c.target.path==='rotation'))).toBe(true)
})
