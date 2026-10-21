import { Link, NavLink } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useApp } from '../app/AppProvider'
import {
  IconBook,
  IconBird,
  IconCheckCircle,
  IconChecklist,
  IconHome,
  IconMoon,
  IconMore,
  IconSprout,
  type IconProps,
} from './icons'

type IconComponent = (props: IconProps) => ReactElement

interface NavItem {
  to: string
  label: string
  icon: IconComponent
}

const PARENT_ITEMS: NavItem[] = [
  { to: '/parent', label: '管理首页', icon: IconHome },
  { to: '/parent/checkins', label: '打卡设置', icon: IconChecklist },
  { to: '/parent/family', label: '家庭公约', icon: IconChecklist },
  { to: '/parent/rewards', label: '心愿奖励', icon: IconSprout },
  { to: '/parent/bank', label: '银行设置', icon: IconBook },
  { to: '/parent/more', label: '更多', icon: IconMore },
]

const CHILD_ITEMS: NavItem[] = [
  { to: '/child', label: '每日打卡', icon: IconCheckCircle },
  { to: '/child/growth', label: '梦幻星空', icon: IconMoon },
  { to: '/child/buddy', label: '小步乐园', icon: IconBird },
  { to: '/child/progress', label: '小小心愿', icon: IconSprout },
]

/**
 * 三档形态共用一套结构：
 * 手机是底部 Tab，平板是顶部横向导航，桌面是左侧固定边栏。切换交给 CSS。
 */
export function AppNav() {
  const { childView } = useApp()
  const items = childView ? CHILD_ITEMS : PARENT_ITEMS
  return (
    <nav className="app-nav" aria-label="主导航">
      <ul className="app-nav-list">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/parent' || item.to === '/child'} className="nav-link">
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function TopBar() {
  const { profile, childView, setChildView } = useApp()
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <IconSprout size={20} />
          </span>
          <span>
            小步成长
            <small>
              {childView ? '儿童视图' : '家长模式'}
              {profile ? ` · ${profile.nickname || profile.name}` : ''}
            </small>
          </span>
        </div>
        {childView ? <Link className="parent-entry" to="/parent">家长</Link> : <button type="button" className="btn btn-sm" onClick={() => void setChildView(true)}>返回儿童端</button>}
      </div>
    </header>
  )
}
