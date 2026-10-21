import * as T from 'three'
/** Shared rounded shell, used in the park and its stage portraits. */
export function createBirdEgg(){
 const group=new T.Group(),shellMat=new T.MeshStandardMaterial({color:'#fff0cd',roughness:.7})
 const shell=new T.Mesh(new T.SphereGeometry(1,24,20),shellMat);shell.scale.set(.45,.6,.45);shell.position.y=.7;shell.castShadow=true;group.add(shell)
 const spotMat=new T.MeshStandardMaterial({color:'#c9b9dd',roughness:.8})
 for(const [x,y] of [[-.18,.83],[.18,.65],[-.09,.48]]){const z=.45*Math.sqrt(Math.max(0,1-(x/.45)**2-((y-.7)/.6)**2));const dot=new T.Mesh(new T.SphereGeometry(1,10,8),spotMat);dot.position.set(x,y,z+.003);dot.scale.set(.055,.075,.012);group.add(dot)}
 const points=[[-.02,1.28],[-.07,1.12],[.035,1.03],[-.04,.92],[.055,.82],[.015,.68]].map(([x,y])=>new T.Vector3(x,y,.45*Math.sqrt(Math.max(0,1-(x/.45)**2-((y-.7)/.6)**2))+.012))
 const crack=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.014,5,false),new T.MeshStandardMaterial({color:'#887261',roughness:1}));group.add(crack)
 return {group,crack}
}
