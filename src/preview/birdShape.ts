import * as T from 'three'
/** One continuous, closed head/neck/breast silhouette; dimensions are visual candidates. */
const profile=[
 [.29,.001,.001,.015],[.42,.32,.30,.015],[.67,.55,.45,.01],
 [.98,.68,.54,.01],[1.23,.72,.56,.025],[1.47,.68,.54,.065],
 [1.68,.68,.54,.12],[1.84,.68,.55,.17],[2.00,.655,.53,.22],
 [2.20,.64,.54,.24],[2.39,.59,.51,.22],[2.58,.46,.41,.18],
 [2.73,.25,.24,.13],[2.79,.001,.001,.125],
]
function cubic(a:number,b:number,c:number,d:number,t:number){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)}
export function birdSection(y:number){
 const height=T.MathUtils.clamp(y,profile[0][0],profile[profile.length-1][0]);let i=0
 while(i<profile.length-2&&profile[i+1][0]<height)i++
 const t=(height-profile[i][0])/(profile[i+1][0]-profile[i][0]),a=profile[Math.max(0,i-1)],b=profile[i],c=profile[i+1],d=profile[Math.min(profile.length-1,i+2)]
 return {x:Math.max(.001,cubic(a[1],b[1],c[1],d[1],t)),z:Math.max(.001,cubic(a[2],b[2],c[2],d[2],t)),centerZ:cubic(a[3],b[3],c[3],d[3],t)}
}
export function faceSurface(x:number,y:number){const s=birdSection(y);return s.centerZ+s.z*Math.sqrt(Math.max(0,1-(x*x)/(s.x*s.x)))}
export function continuousBirdSurface(){
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[],rings=64,sides=40
 for(let row=0;row<=rings;row++){
  const v=row/rings,y=.29+v*2.5,s=birdSection(y)
  for(let col=0;col<=sides;col++){const u=col/sides,a=u*Math.PI*2;positions.push(-Math.cos(a)*s.x,y,Math.sin(a)*s.z+s.centerZ);uvs.push(u,v)}
 }
 for(let row=0;row<rings;row++)for(let col=0;col<sides;col++){const a=row*(sides+1)+col,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b)}
 for(const row of [0,rings]){const y=.29+row/rings*2.5,s=birdSection(y),center=positions.length/3;positions.push(0,y,s.centerZ);uvs.push(.25,row/rings);for(let col=0;col<sides;col++){const a=row*(sides+1)+col;if(row===0)indices.push(center,a+1,a);else indices.push(center,a,a+1)}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();g.userData.bodyUV=true;g.userData.continuousBody=true;return g
}
