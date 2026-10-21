export const PARK_AREAS = [
 {key:'meadow',name:'阳光草地',at:0,description:'小布出生的地方，轻轻打招呼，陪它慢慢长大。'},
 {key:'nest',name:'温暖小窝',at:14,description:'把冒险带回的材料，编成柔软的小窝。'},
 {key:'home',name:'森林小屋',at:21,description:'小屋建好啦，小布有了自己的家。'},
 {key:'garden',name:'蝴蝶花园',at:28,description:'跟着蝴蝶，闻闻花香，练习飞行。'},
 {key:'pool',name:'星光泳池',at:35,description:'在浅水池里拍拍水花，享受清凉时光。'},
] as const
export type ParkArea = typeof PARK_AREAS[number]['key']
export function parkProgress(count:number) {
 const n=Number.isFinite(count)?Math.max(0,Math.floor(count)):0
 return PARK_AREAS.map(area=>({...area,unlocked:n>=area.at,remaining:Math.max(0,area.at-n)}))
}
