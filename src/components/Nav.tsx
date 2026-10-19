import { NavLink } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useApp } from '../app/AppProvider'
import {
  IconBook,
  IconCheckCircle,
  IconChecklist,
  IconHome,
  IconLock,
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
  { to: '/', label: '今日', icon: IconHome },
  { to: '/sleep', label: '睡眠', icon: IconMoon },
  { to: '/study', label: '学习', icon: IconBook },
  { to: '/rules', label: '规则', icon: IconChecklist },
  { to: '/more', label: '更多', icon: IconMore },
]

const CHILD_ITEMS: NavItem[] = [
  { to: '/child', label: '我的任务', icon: IconCheckCircle },
  { to: '/child/rules', label: '打卡清单', icon: IconChecklist },
  { to: '/child/progress', label: '心愿小屋', icon: IconSprout },
  { to: '/settings', label: '家长模式', icon: IconLock },
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
              <NavLink to={item.to} end={item.to === '/' || item.to === '/child'} className="nav-link">
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
  const { profile, childView, parentUnlocked, setChildView } = useApp()
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
        {(!childView || parentUnlocked) && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setChildView(!childView)}
          >
            {childView ? '回到家长模式' : '切到儿童视图'}
          </button>
        )}
      </div>
    </header>
  )
}
