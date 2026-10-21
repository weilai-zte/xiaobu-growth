/**
 * 全部图标都用内联 SVG，不依赖字体或图片，也不用 emoji。
 * 统一 24×24 视框、描边式、currentColor，跟着文字颜色走。
 */
import type { ReactNode } from 'react'

export interface IconProps {
  size?: number
  className?: string
}

function Glyph({ size = 24, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 10.8 12 3.6l8.5 7.2" />
      <path d="M5.8 9.7V20a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V9.7" />
      <path d="M10 21v-5.4h4V21" />
    </Glyph>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z" />
      <path d="M17 4.2v2.6M15.7 5.5h2.6" />
    </Glyph>
  )
}

export function IconBook(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 5.6A2.6 2.6 0 0 1 6.6 3H20v15.4H6.6A2.6 2.6 0 0 0 4 21Z" />
      <path d="M4 18.4A2.6 2.6 0 0 1 6.6 15.8H20" />
      <path d="M20 18.4V21H6.6" />
    </Glyph>
  )
}

export function IconChecklist(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9.5 4.2h5a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5.2a1 1 0 0 1 1-1Z" />
      <path d="M15 5.4h1.8A1.8 1.8 0 0 1 18.6 7.2v12A1.8 1.8 0 0 1 16.8 21H7.2a1.8 1.8 0 0 1-1.8-1.8v-12a1.8 1.8 0 0 1 1.8-1.8H9" />
      <path d="m8.6 13.4 1.9 1.9 3.9-4.1" />
    </Glyph>
  )
}

export function IconMore(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="5.4" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.6" cy="12" r="1.4" />
    </Glyph>
  )
}

export function IconCheckCircle(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m8.4 12.2 2.4 2.4 4.8-5" />
    </Glyph>
  )
}

export function IconSprout(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21v-7.4" />
      <path d="M12 13.6C12 10 9.4 7.4 5.8 7.4c0 3.6 2.6 6.2 6.2 6.2Z" />
      <path d="M12 12.4c0-3 2.2-5.2 5.2-5.2 0 3-2.2 5.2-5.2 5.2Z" />
      <path d="M8.6 21h6.8" />
    </Glyph>
  )
}

export function IconBird(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12.5c0-4.3 3.4-7.5 7.8-7.5h1.8c3.3 0 5.9 2.3 5.9 5.2 0 1.2-.4 2.3-1.2 3.2l2.2 2.4h-3.7L15 18.5H9.2a4.2 4.2 0 0 1-4.2-4.2Z" />
      <path d="M9.2 12.8 5.5 10v5.4M17.2 10.8l2.2-.8v2" />
      <circle cx="16.6" cy="9.4" r=".7" fill="currentColor" stroke="none" />
      <path d="m14.4 13.2 2.1 1.2-2.2.8" />
    </Glyph>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7.2 10.6V8.2a4.8 4.8 0 0 1 9.6 0v2.4" />
      <rect x="4.8" y="10.6" width="14.4" height="10.4" rx="2.2" />
      <path d="M12 14.8v2.2" />
    </Glyph>
  )
}

export function IconSync(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20.2 11.4a8.2 8.2 0 0 0-14.3-4.6L3.8 9" />
      <path d="M3.8 4.6V9h4.4" />
      <path d="M3.8 12.6a8.2 8.2 0 0 0 14.3 4.6l2.1-2.2" />
      <path d="M20.2 19.4V15h-4.4" />
    </Glyph>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  )
}

export function IconChart(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 20.2h16" />
      <path d="M7.6 20.2v-6.4" />
      <path d="M12 20.2V6.4" />
      <path d="M16.4 20.2v-4.2" />
    </Glyph>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.8" y="5.4" width="16.4" height="14.8" rx="2.2" />
      <path d="M3.8 10h16.4M8.6 3.4v4M15.4 3.4v4" />
    </Glyph>
  )
}

export function IconHeart(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 20s-7.4-4.4-7.4-9.4A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.4 2.6C19.4 15.6 12 20 12 20Z" />
    </Glyph>
  )
}

export function IconChat(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20.2 12.4c0 3.9-3.7 7-8.2 7a9.6 9.6 0 0 1-2.6-.3L5 20.6l1.1-3.1a6.6 6.6 0 0 1-2.3-5.1c0-3.9 3.7-7 8.2-7s8.2 3.1 8.2 7Z" />
    </Glyph>
  )
}

export function IconFlask(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M10 3.6h4v5.2l4.4 8.3a1.8 1.8 0 0 1-1.6 2.7H7.2a1.8 1.8 0 0 1-1.6-2.7L10 8.8Z" />
      <path d="M8.4 14.6h7.2M9.2 3.6h5.6" />
    </Glyph>
  )
}

export function IconShield(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.4 5 6v5.6c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6Z" />
      <path d="m9.4 12.2 1.9 1.9 3.5-3.7" />
    </Glyph>
  )
}

export function IconArrowRight(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h14M13.4 6.6 19 12l-5.6 5.4" />
    </Glyph>
  )
}

/** 进度环：用 SVG 画，比进度条更能一眼看出「走到哪了」 */
export function ProgressRing({
  value,
  size = 68,
  stroke = 7,
  tone = 'accent',
  label,
}: {
  /** 0–1 */
  value: number
  size?: number
  stroke?: number
  tone?: 'accent' | 'warn' | 'danger' | 'success'
  label?: ReactNode
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = circumference * clamped
  return (
    <div className={`progress-ring progress-ring-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-ring-label">{label ?? `${Math.round(clamped * 100)}%`}</span>
    </div>
  )
}
