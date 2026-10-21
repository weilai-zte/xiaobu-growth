export const BIRD_MOODS={hello:'打招呼',happy:'开心',celebrate:'庆祝'} as const
export type BirdMood=keyof typeof BIRD_MOODS
export const BIRD_CALLS=(Object.keys(BIRD_MOODS) as BirdMood[]).flatMap(mood=>[1,2].map(variant=>({id:`${mood}-${variant}`,mood,src:`${import.meta.env.BASE_URL}audio/bird/${mood}-${variant}.mp3`})))
let previous=''
/** 情绪是游戏场景分类，不是对真实鸟类情绪的判断。 */
export function chooseBirdCall(mood?:BirdMood){const choices=BIRD_CALLS.filter(c=>(!mood||c.mood===mood)&&c.id!==previous);const call=choices[Math.floor(Math.random()*choices.length)];previous=call.id;return call}
