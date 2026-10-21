/** Frame-rate-independent easing; reduced motion immediately shows the destination. */
export function damping(speed:number,seconds:number,reduced=false){
 return reduced?1:1-Math.exp(-speed*Math.max(0,seconds))
}
/** Only visible time advances gestures and scenery. A new gesture leaves scenery running. */
export function createBirdClock(){
 let previous:number|undefined,wasActive=false,time=0,action=0,delta=0
 return {
  tick(now:number,active:boolean){
   delta=previous===undefined||!active||!wasActive?0:Math.min(.1,Math.max(0,(now-previous)/1000))
   previous=now;wasActive=active;time+=delta;action+=delta
  },
  restart(){action=0},
  get time(){return time},get action(){return action},get delta(){return delta},
 }
}
