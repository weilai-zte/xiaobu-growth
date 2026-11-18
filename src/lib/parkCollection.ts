import {BIRD_ITEMS,HOME_TREASURES} from './birdCompanion'
import type {ParkArea} from './park'

/** 物品来源仍是已保存的冒险：重复收藏只放一件，穿戴装备不占地面位置。 */
export function parkCollection(treasures:readonly string[]=[],items:readonly string[]=[],favorite=''){
 const owned=HOME_TREASURES.filter(item=>treasures.includes(item.key)).map(item=>item.key)
 const toys=BIRD_ITEMS.filter(item=>['bell','ball','swing'].includes(item.key)&&items.includes(item.key)).map(item=>item.key)
 return {treasures:owned,toys,favorite:owned.some(key=>key===favorite)?favorite:''}
}
const positions:Record<string,[number,number,number]>={honey:[-.5,.12,2.7],berry:[-1.4,.12,2.8],gem:[.5,.12,2.7],shell:[1.4,.12,2.8],acorn:[2.3,.12,2.7],mushroom:[-3.6,.12,1.9],chime:[-3.5,.12,-.2],flower:[-2.6,.12,2.7]}
const focus:Record<ParkArea,[number,number]>={meadow:[-1.1,.25],nest:[-2.6,-.9],home:[.3,.65],garden:[-3.1,1.1],pool:[3.2,1.5]}
export function treasurePlacement(key:string,count:number,area:ParkArea,favorite:boolean){
 let position:[number,number,number]=[...(positions[key]??[0,.12,2.7])]
 if(count>=21){
  if(key==='honey')position=[2.65,.12,.2]
  if(key==='berry')position=[3.25,.12,.65]
  if(key==='chime')position=[2.8,.12,-.2]
 }
 if(favorite)position=[focus[area][0]+1,.12,focus[area][1]+1.2]
 return {position,scale:favorite?1.65:1.25}
}
