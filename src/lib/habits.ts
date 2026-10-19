import type { HabitCategory, HabitKey, RoutineRule } from '../db/types'
export const HABIT_CATEGORIES: { key: HabitCategory; label: string; picture: string }[] = [
  { key: 'life', label: '生活打卡', picture: 'shirt' },
  { key: 'sport', label: '运动打卡', picture: 'ball' },
  { key: 'study', label: '学习打卡', picture: 'book' },
]
export const HABIT_PLAN: { key: HabitKey; category: HabitCategory; title: string; picture: string; steps: string[]; stars: 1 | 2; minutes?: number }[] = [
  { key: 'body', category: 'life', title: '穿好拖鞋和衣裤', picture: 'slippers', stars: 1, steps: ['在家穿好拖鞋', '在公共空间穿好衣裤', '需要换衣服时，到合适的地方'] },
  { key: 'meal', category: 'life', title: '慢慢吃饭，送回碗筷', picture: 'meal', stars: 1, steps: ['坐稳吃饭', '一口一口，慢慢嚼', '吃完把碗筷送回厨房，需要时请家长帮忙'] },
  { key: 'clothes', category: 'life', title: '衣物各回各的家', picture: 'laundry', stars: 1, steps: ['换下的脏衣服送到洗衣房', '干净衣服叠整齐', '把叠好的衣服放回固定位置'] },
  { key: 'rope', category: 'sport', title: '跳绳至少5分钟', picture: 'rope', stars: 2, minutes: 5, steps: ['选好合适的地方', '跳绳累计至少5分钟，可以分段休息'] },
  { key: 'cycle', category: 'sport', title: '骑自行车约20分钟', picture: 'bicycle', stars: 2, minutes: 20, steps: ['和家长约好路线，戴好头盔', '骑车约20分钟，需要时休息'] },
  { key: 'picture_words', category: 'study', title: '英语看图选词', picture: 'book', stars: 2, steps: ['选一组适合自己的图卡', '看看图片，听听单词', '完成这一组，不会的可以再试'] },
]
export function habitDefinition(rule: RoutineRule) { return HABIT_PLAN.find(h => h.key === rule.habitKey) }
export function recordStars(row: { rewardStars?: number }) { return row.rewardStars === 1 || row.rewardStars === 2 ? row.rewardStars : 5 }
