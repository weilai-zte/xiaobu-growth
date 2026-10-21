import {
  BUDDY_CARE_ACTIONS,
  type AdventureRun,
  type BuddyCareAction,
  type BuddyCareState,
  type DayKey,
} from '../db/types'
import { uniqueAdventures } from './adventure'

export const BIRD_ITEMS = [
  { key: 'bell', name: '叮当小铃铛', action: '叮叮！我给你唱一小段！' },
  { key: 'ball', name: '彩色小皮球', action: '接住啦！我们一起滚球吧！' },
  { key: 'swing', name: '树枝小秋千', action: '一、二、三，轻轻荡起来！' },
  { key: 'scarf', name: '探险小围巾', action: '系好围巾，我们是探险搭档！' },
  { key: 'backpack', name: '叶子小背包', action: '背包准备好啦，下次一起出发！' },
  { key: 'pin', name: '星星小徽章', action: '这枚小星星，记着我们的每一小步！' },
] as const

export const HOME_TREASURES = [
  { key: 'honey', name: '桂花蜂蜜罐', category: '美味', description: '甜丝丝的森林味道，放在小屋窗边刚刚好。' },
  { key: 'berry', name: '月光莓果篮', category: '美味', description: '像小灯笼一样亮晶晶的莓果，是探险路上找到的惊喜。' },
  { key: 'gem', name: '蓝晶宝石', category: '宝物', description: '会映出蓝色星光的宝物，能让小屋闪闪发亮。' },
  { key: 'shell', name: '彩虹贝壳', category: '宝物', description: '贴着耳朵能听见小溪唱歌，适合摆在软软的垫子上。' },
  { key: 'acorn', name: '金色橡果', category: '宝物', description: '松鼠帮忙找到的金橡果，是练习勇敢的小奖杯。' },
  { key: 'mushroom', name: '发光蘑菇', category: '家园', description: '晚上会亮起暖光，给小步照亮回家的台阶。' },
  { key: 'chime', name: '星星风铃', category: '家园', description: '风一吹就轻轻响，挂在屋檐下最合适。' },
  { key: 'flower', name: '会唱歌的花', category: '家园', description: '花瓣会跟着森林音乐摆动，让小屋每天都很热闹。' },
] as const
export const HOME_TREASURE_KEYS = HOME_TREASURES.map(item => item.key) as [
  'honey', 'berry', 'gem', 'shell', 'acorn', 'mushroom', 'chime', 'flower',
]
export type HomeTreasureKey = (typeof HOME_TREASURES)[number]['key']
export type HomeTreasure = (typeof HOME_TREASURES)[number]

export function isHomeTreasureKey(value: unknown): value is HomeTreasureKey {
  return typeof value === 'string' && (HOME_TREASURE_KEYS as readonly string[]).includes(value)
}

export function birdLoot(run: AdventureRun) {
  const route = ['meadow', 'stream', 'forest'].indexOf(run.route)
  const material = ['leaf', 'twig', 'pebble'].indexOf(run.material)
  return BIRD_ITEMS[(route * 3 + run.scene + material) % BIRD_ITEMS.length]
}

/** 从已保存的冒险结果稳定派生额外发现，不另建奖励记录。 */
export function adventureTreasure(run: AdventureRun): HomeTreasure {
  const route = ['meadow', 'stream', 'forest'].indexOf(run.route)
  const material = ['leaf', 'twig', 'pebble'].indexOf(run.material)
  return HOME_TREASURES[(route * 6 + run.scene * 2 + material) % HOME_TREASURES.length]
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

/** 小屋摆件同样从同一批冒险记录派生，旧数据无需迁移。 */
export function homeTreasureInventory(runs: AdventureRun[]) {
  const counts = new Map<HomeTreasureKey, number>()
  for (const run of uniqueAdventures(runs)) {
    const key = adventureTreasure(run).key
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return HOME_TREASURES.filter(item => counts.has(item.key)).map(item => ({ ...item, count: counts.get(item.key)! }))
}

/** 最近一次冒险发现的摆件可以先自动放上，不要求孩子额外设置。 */
export function latestHomeTreasure(runs: AdventureRun[]): HomeTreasure | undefined {
  const latest = uniqueAdventures(runs).sort((a, b) => b.date.localeCompare(a.date))[0]
  return latest ? adventureTreasure(latest) : undefined
}

export function normalizeBuddyCare(care: BuddyCareState | null | undefined, today: DayKey): BuddyCareState {
  const completed = care?.date === today && Array.isArray(care.completed)
    ? care.completed.filter((action, index, values) => BUDDY_CARE_ACTIONS.includes(action) && values.indexOf(action) === index)
    : []
  return {
    date: today,
    completed,
    xp: Math.max(0, Number.isInteger(care?.xp) ? care?.xp ?? 0 : 0),
    sleepingSince: care?.date === today ? care.sleepingSince ?? null : null,
  }
}

export function completeBuddyCare(care: BuddyCareState, action: BuddyCareAction, completedAt: string, today: DayKey): BuddyCareState {
  const current = normalizeBuddyCare(care, today)
  const firstToday = !current.completed.includes(action)
  return {
    ...current,
    completed: firstToday ? [...current.completed, action] : current.completed,
    xp: current.xp + (firstToday ? 1 : 0),
    sleepingSince: action === 'sleep' ? completedAt : null,
  }
}

export type BuddyCareCommand = BuddyCareAction | 'wake'

/**
 * 睡前和醒来是两个动作。重复点睡觉不会继续加亲密值；
 * 喂食、玩耍和梳理羽毛也不会把熟睡的小步强行叫醒。
 */
export function changeBuddyCare(
  care: BuddyCareState | null | undefined,
  command: BuddyCareCommand,
  completedAt: string,
  today: DayKey,
): BuddyCareState {
  const current = normalizeBuddyCare(care, today)
  if (command === 'wake') return { ...current, sleepingSince: null }
  const firstToday = !current.completed.includes(command)
  return {
    ...current,
    completed: firstToday ? [...current.completed, command] : current.completed,
    xp: current.xp + (firstToday ? 1 : 0),
    sleepingSince: command === 'sleep' ? completedAt : current.sleepingSince,
  }
}

const BOND_LEVELS = [
  { at: 0, name: '刚认识' },
  { at: 3, name: '好朋友' },
  { at: 8, name: '默契搭档' },
  { at: 16, name: '森林伙伴' },
  { at: 28, name: '冒险搭档' },
  { at: 44, name: '守护伙伴' },
  { at: 64, name: '星星知己' },
  { at: 90, name: '永远的好朋友' },
] as const

export function buddyBond(runs: AdventureRun[], care: BuddyCareState) {
  const careXp = Math.max(0, care.xp)
  const adventureXp = uniqueAdventures(runs).length * 3
  const totalXp = careXp + adventureXp
  let currentIndex = 0
  BOND_LEVELS.forEach((level, index) => {
    if (totalXp >= level.at) currentIndex = index
  })
  const current = BOND_LEVELS[Math.max(0, currentIndex)]
  const next = BOND_LEVELS[currentIndex + 1]
  return {
    level: Math.max(1, currentIndex + 1),
    name: current.name,
    totalXp,
    nextAt: next?.at ?? null,
    nextName: next?.name ?? null,
    progress: next ? Math.min(1, Math.max(0, (totalXp - current.at) / (next.at - current.at))) : 1,
  }
}
