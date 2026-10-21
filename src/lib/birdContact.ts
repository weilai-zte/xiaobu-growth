/** Frame 2 lifts the foot halfway through the one-second play cycle. */
export function ballPush(seconds:number,reduced=false){
 if(reduced)return 0
 const phase=Math.max(0,Number.isFinite(seconds)?seconds:0)%1
 const smooth=(x:number)=>x*x*(3-2*x)
 // Ease out after contact, then return gently before the next kick (no wrap jump).
 if(phase<.5)return 0
 return phase<.82?1.1*smooth((phase-.5)/.32):1.1*(1-smooth((phase-.82)/.18))
}
export function frameSize(width:number,height:number,standingHeight:number){
 const unit=2.65/standingHeight
 return {width:width*unit,height:height*unit}
}
