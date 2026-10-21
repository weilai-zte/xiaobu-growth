// 前后端共享的荣誉/星图标识及奖励口径。星轨为成长主题示意，不作天文观测图。
export const HONOR_GROUPS = [
 ['life','生活','生活小能手',[1,3,5,10,20]],
 ['sport','运动','活力小健将',[1,3,5,10,20]],
 ['study','学习','好奇小学者',[1,3,5,10,20]],
 ['total','打卡','成长小脚印',[1,5,10,25,50]],
 ['days','打卡','时光收藏家',[1,3,7,14,30]],
 ['care','陪伴','小布好朋友',[1,4,10,20,40]],
 ['adventures','探索','森林探险家',[1,3,7,14,30]],
 ['routes','探索','远方的来信',[1,2,3]],
 ['food','探索','森林美食家',[1,2,3,5,10]],
 ['gem','探索','宝石发现者',[1,2,3,5,10]],
 ['decor','探索','小屋装饰家',[1,2,3,5,10]],
 ['collection','探索','百宝收藏家',[1,2,3,5,8]],
]
export const SIGN_KEYS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']
const units={life:'次生活打卡',sport:'次运动打卡',study:'次学习打卡',total:'次有效打卡',days:'个不同日子的打卡',care:'次小布照料',adventures:'次冒险',routes:'条冒险路线',food:'份冒险美味',gem:'颗蓝晶宝石',decor:'件家园装饰',collection:'种冒险收藏'}
export const HONORS=HONOR_GROUPS.flatMap(([metric,group,title,levels])=>levels.map((target,i)=>({id:`honor:${metric}:${target}`,metric,group,title:`${title} · ${i+1}阶`,target,requirement:`${['food','gem','decor','collection'].includes(metric)?'发现':'完成'}${target}${units[metric]}`})))
export const SKY_STARS=SIGN_KEYS.flatMap((key,i)=>{
 const metric=HONOR_GROUPS[i][0]
 const badges=HONORS.filter(b=>b.metric===metric)
 return Array.from({length:5},(_,slot)=>{
  // 路线仅有三条，后两颗由冒险经历与百宝收藏补全，不设置无法完成的门槛。
  const honor=badges[slot]??HONORS.find(b=>b.id===(slot===3?'honor:adventures:7':'honor:collection:5'))
  return {id:`sky:${key}:${slot}`,signKey:key,slot,honorId:honor.id,name:`${['启程','微光','闪耀','守护','梦想'][slot]}之星`,reward:2}
 })
})
export function skyBonus(claims={}) {
 return SKY_STARS.filter(s=>!(s.slot===0&&validTime(claims?.[s.signKey]))&&validTime(claims?.[s.id])).length*2
}
export function validTime(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))}
