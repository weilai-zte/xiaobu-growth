import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { buildHeatmap } from '../src/lib/heatmap'
import { CheckinHeatmap } from '../src/components/CheckinHeatmap'
import type { RoutineCheck } from '../src/db/types'

const check = (patch: Partial<RoutineCheck> = {}) => ({ date: '2026-10-20', status: 'done', rewardStars: 1, ...patch }) as RoutineCheck

describe('打卡热力图', () => {
  it('生成周一到周日排列的12周84格，包含今天', () => {
    const cells = buildHeatmap([], '2026-10-20')
    expect(cells).toHaveLength(84)
    expect(cells[0].date).toBe('2026-08-03')
    expect(cells[83].date).toBe('2026-10-25')
    expect(cells.every(c => c.stars === 0)).toBe(true)
  })
  it('只累加有效完成记录的1或2星，忽略删除、未完成、异常和未来记录', () => {
    const cells = buildHeatmap([
      check(), check({ rewardStars: 2 }), check(),
      check({ deleted: true }), check({ status: 'skipped' as RoutineCheck['status'] }),
      check({ rewardStars: 5 as 1 }), check({ rewardStars: undefined }),
      check({ date: '2026-10-19', rewardStars: 2 }), check({ date: '2026-10-21' }),
    ], '2026-10-20')
    expect(cells.find(c => c.date === '2026-10-20')).toMatchObject({ stars: 4, bucket: 3 })
    expect(cells.find(c => c.date === '2026-10-19')).toMatchObject({ stars: 2, bucket: 2 })
    expect(cells.find(c => c.date === '2026-10-21')?.stars).toBe(0)
  })
  it('空数据有温和提示，每格可以聚焦并用点击查看数值', () => {
    const { container } = render(<CheckinHeatmap checks={[]} date="2026-10-20" />)
    expect(screen.getByText('小小的脚印，从今天开始慢慢留下。')).toBeInTheDocument()
    expect(container.querySelectorAll('rect')).toHaveLength(84)
    const cell = screen.getByRole('gridcell', { name: '2026-10-20, 0 星' })
    expect(cell).toHaveAttribute('tabindex', '0')
    fireEvent.click(cell)
    expect(screen.getByRole('status')).toHaveTextContent('2026-10-20 · 0 颗星')
  })
})
