import type { AdventureRun } from '../db/types'
import { uniqueAdventures } from './adventure'

export const BIRD_ITEMS = [
  { key: 'bell', name: '叮当小铃铛', action: '叮叮！我给你唱一小段！' },
  { key: 'ball', name: '彩色小皮球', action: '接住啦！我们一起滚球吧！' },
  { key: 'swing', name: '树枝小秋千', action: '一、二、三，轻轻荡起来！' },
  { key: 'scarf', name: '探险小围巾', action: '系好围巾，我们是探险搭档！' },
  { key: 'backpack', name: '叶子小背包', action: '背包准备好啦，下次一起出发！' },
  { key: 'pin', name: '星星小徽章', action: '这枚小星星，记着我们的每一小步！' },
] as const
export function birdLoot(run: AdventureRun) {
  const route = ['meadow', 'stream', 'forest'].indexOf(run.route)
  const material = ['leaf', 'twig', 'pebble'].indexOf(run.material)
  return BIRD_ITEMS[(route * 3 + run.scene + material) % BIRD_ITEMS.length]
}
/** 基于已确认的冒险结果派生，不再抽奖、不生成第二份奖励记录。 */
export function birdInventory(runs: AdventureRun[]) {
  const counts = new Map<string, number>()
  for (const run of uniqueAdventures(runs)) {
    const key = birdLoot(run).key
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return BIRD_ITEMS.filter(item => counts.has(item.key)).map(item => ({ ...item, count: counts.get(item.key)! }))
}
