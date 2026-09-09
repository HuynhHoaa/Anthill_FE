import { difficultyLabels } from '../../../types'
import {
  clampPercentage, difficultyBarColors, orderedDifficultyLevels, sumRatios,
  type DifficultyRatios,
} from '../utils/blueprintRatio'

interface DifficultyRatioBarProps {
  ratios: DifficultyRatios
  /** Ẩn phần chú thích khi thanh được đặt cạnh danh sách đã có nhãn riêng. */
  showLegend?: boolean
}

/**
 * Thanh ba màu biểu diễn tỷ lệ độ khó.
 * Tổng chưa đủ 100% thì phần thiếu để trống màu xám, vượt 100% thì cả ba đoạn co lại
 * theo cùng một tỷ lệ nên người dùng nhìn là biết đang lệch.
 */
export default function DifficultyRatioBar({ ratios, showLegend = true }: DifficultyRatioBarProps) {
  const total = sumRatios(ratios)
  const scale = Math.max(total, 100)

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {orderedDifficultyLevels.map(level => {
          const percentage = clampPercentage(ratios[level])
          if (percentage === 0) return null
          return (
            <div
              key={level}
              className="h-full transition-all duration-300"
              style={{ width: `${(percentage / scale) * 100}%`, background: difficultyBarColors[level] }}
              title={`${difficultyLabels[level]}: ${percentage}%`}
            />
          )
        })}
      </div>

      {showLegend && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {orderedDifficultyLevels.map(level => (
            <span key={level} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: difficultyBarColors[level] }}
              />
              {difficultyLabels[level]} {clampPercentage(ratios[level])}%
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
