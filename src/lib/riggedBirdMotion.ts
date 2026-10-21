import * as T from 'three'
import type {BuddyActivity} from '../db/types'
import type {createXiaobuModel} from '../preview/xiaobuModel'
type Model=ReturnType<typeof createXiaobuModel>
/** Pose one continuous skeleton. No sprite or action-picture substitution. */
export function poseRiggedBird(model:Model,activity:BuddyActivity,time:number,flap=false,reduced=false){
 for(const bone of model.bones)bone.rotation.set(0,0,0)
 const bone=(name:string)=>model.bones.find(b=>b.name===name)!
 const t=reduced?0:time
 if(activity==='feed'){
  // Reach the same food point at every peck, then lift the head to swallow.
  const peck=reduced?1:Math.pow(Math.sin(Math.PI*(time%1.1)/1.1),2)
  bone('Chest').rotation.x=.08*peck;bone('Head').rotation.x=.55*peck
  bone('Jaw').rotation.x=.24*peck
 }else if(activity==='play'){
  const kick=reduced?0:Math.sin(Math.PI*T.MathUtils.clamp(time/.65,0,1))
  bone('LegL').rotation.x=-.45*kick;bone('FootL').rotation.x=.25*kick
  bone('Head').rotation.z=.09*Math.sin(t*3)
 }else if(activity==='sleep'){
  const settle=reduced?1:T.MathUtils.smoothstep(time,1.1,2.2)
  bone('Head').rotation.y=-.85*settle;bone('Head').rotation.x=.25*settle
  bone('Neck').rotation.x=.16*settle;bone('Chest').rotation.z=Math.sin(t*1.8)*.007
 }else if(activity==='groom'){
  bone('Head').rotation.y=.5*Math.sin(t*2);bone('Head').rotation.z=.15*Math.sin(t*2)
  bone('WingR').rotation.z=-.15*(1+Math.sin(t*2))
 }else{bone('Head').rotation.y=Math.sin(t*.9)*.06;bone('Chest').rotation.z=Math.sin(t*2)*.008}
 if(flap&&activity!=='sleep'){
  const swing=reduced?.2:.3+.45*Math.sin(t*13)
  bone('WingL').rotation.z=swing;bone('WingR').rotation.z=-swing
  bone('WingTipL').rotation.z=swing*.5;bone('WingTipR').rotation.z=-swing*.5
 }
 model.mesh.updateMatrixWorld(true);model.mesh.skeleton.update()
}
/** Fixed food landmark sampled at full reach, in model space. */
export function riggedFoodPoint(model:Model){
 poseRiggedBird(model,'feed',.55)
 const point=model.mesh.worldToLocal(model.contacts.beak.getWorldPosition(new T.Vector3()))
 poseRiggedBird(model,'idle',0)
 return point
}
export function riggedBallTravel(time:number,reduced=false){return reduced?.7:.7*T.MathUtils.smoothstep(time,.65,1.5)}
