import { useToday } from '../app/hooks'
import { HabitBoard } from '../components/HabitBoard'
import { FeedbackSound } from '../components/FeedbackSound'
import { useAdventureDay } from '../components/Adventure'
export function ChildRules() {
  const date = useAdventureDay()
  const { tasks, rules, checks } = useToday(date)
  return <div className="play-world"><header><h1>我的打卡清单</h1><p className="page-intro">生活1星，运动和学习2星。选喜欢的一件，慢慢做。</p></header><HabitBoard rules={rules} tasks={tasks} checks={checks} date={date} limit={99} /><FeedbackSound /></div>
}
