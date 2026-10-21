import type { AdventureRun, RoutineCheck, TaskRecord } from '../db/types'
import { isDayKey } from './date'
import { starBalance } from './rewards'

export const ADVENTURE_THRESHOLD = 5
export const BIRD_STAGES = [
  { key: 'egg', name: '一颗小蛋', at: 0, text: '里面住着谁呢？陪小蛋一起去看看世界。' },
  { key: 'crack', name: '蛋壳有动静啦', at: 1, text: '轻轻的，听到里面的声音了吗？' },
  { key: 'hatch', name: '小步出生啦', at: 2, text: '你好呀！我们慢慢长大。' },
  { key: 'young', name: '练习飞的小鸟', at: 5, text: '翅膀长大了一点，来认识新朋友。' },
  { key: 'adult', name: '长大的小步', at: 9, text: '可以飞得更远了，也想有个自己的家。' },
  { key: 'nest', name: '有一个小窝啦', at: 14, text: '一路带回的小材料，变成了柔软的小窝。' },
  { key: 'home', name: '温暖的小家', at: 21, text: '小家建好了，接下来一起种出蝴蝶花园。' },
  { key: 'garden', name: '蝴蝶花园', at: 28, text: '花园开花啦，跟着蝴蝶练习飞行。' },
  { key: 'pool', name: '星光泳池', at: 35, text: '泳池也建好了，小布的森林乐园越来越热闹。' },
] as const
export function birdStage(count: number) { return [...BIRD_STAGES].reverse().find(s => count >= s.at) ?? BIRD_STAGES[0] }
export function adventureDay(now = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now) }
export function dailyActionStars(tasks: TaskRecord[], checks: RoutineCheck[], date: string) {
  return starBalance(tasks.filter(t => t.date === date), checks.filter(c => c.date === date), []).earned
}
export function validAdventure(row: Partial<AdventureRun> | Record<string, unknown>): boolean {
  return typeof row.childId === 'string' && !!row.childId && typeof row.date === 'string' && isDayKey(row.date) &&
    row.id === `adventure:${row.childId}:${row.date}` && ['meadow', 'stream', 'forest'].includes(String(row.route)) &&
    Number.isInteger(row.scene) && Number(row.scene) >= 0 && Number(row.scene) < 3 &&
    ['leaf', 'twig', 'pebble'].includes(String(row.material)) && [2, 3, 5].includes(Number(row.bonusStars)) && typeof row.bonusStars === 'number'
}
export function uniqueAdventures(runs: AdventureRun[]) {
  return [...new Map(runs.filter(r => !r.deleted && validAdventure(r)).map(r => [r.id, r])).values()]
}
export const MATERIAL_NAMES = { leaf: '柔软叶子', twig: '小树枝', pebble: '圆圆石头' }
export const ROUTES = [
  { key: 'meadow', name: '花草原', picture: 'flower', preview: '花香、莓果和宝石' },
  { key: 'stream', name: '小溪边', picture: 'stream', preview: '贝壳、水花和小惊喜' },
  { key: 'forest', name: '小树林', picture: 'tree', preview: '橡果、蘑菇和风铃' },
] as const
export function adventureStory(run: AdventureRun) {
  const stories = {
    meadow: ['蝴蝶带路，找到了藏在花丛里的小礼物。', '帮蜗牛找到阴凉地，它送来一份谢礼。', '风吹过草地，一份小礼物轻轻落下来。'],
    stream: ['沿着小溪听水声，发现了岸边的小礼物。', '帮小鸭找到回家的路，收到一份谢礼。', '阳光照着小桥，桥边有一份小礼物。'],
    forest: ['跟着松鼠认树叶，收到了森林的小礼物。', '帮刺猬把果子放好，它送来一份谢礼。', '在树下听完一个故事，找到一份小礼物。'],
  }
  return stories[run.route][run.scene]
}
