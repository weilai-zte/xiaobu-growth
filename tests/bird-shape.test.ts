import {expect,it} from 'vitest'
import {birdSection,continuousBirdSurface,faceSurface} from '../src/preview/birdShape'
it('头颈衔接没有突然跳变或细杆状颈部，五官落点沿曲面计算',()=>{
 for(const y of [1.47,1.68,1.84,2,2.2]){
  const a=birdSection(y-.0001),b=birdSection(y+.0001)
  expect(Math.abs(a.x-b.x)).toBeLessThan(.001);expect(Math.abs(a.centerZ-b.centerZ)).toBeLessThan(.001)
  expect(b.x).toBeGreaterThan(birdSection(2.2).x*.9)
 }
 expect(faceSurface(0,2.155)).toBeGreaterThan(faceSurface(.337,2.155))
 expect(Number.isFinite(faceSurface(.435,2.025))).toBe(true)
})
it('从头顶到腹部是同一闭合曲面，不靠两个球体相交遮住接缝',()=>{
 const g=continuousBirdSurface(),p=g.getAttribute('position'),idx=g.index!,edges=new Map<string,number>()
 const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>(Math.round(v*1e6)/1e6).toFixed(6)).join(',')
 for(let i=0;i<idx.count;i+=3){const v=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)].map(key);for(let k=0;k<3;k++){const edge=[v[k],v[(k+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1)}}
 expect([...edges.values()].every(count=>count===2)).toBe(true);expect(g.userData.continuousBody).toBe(true);g.dispose()
})
