/**
 * Phần tính toán thuần tuý cho tỷ lệ độ khó của Exam Blueprint.
 * Tách khỏi giao diện để logic dễ đọc và dễ kiểm chứng.
 */
import type { DifficultyLevel } from '../../../types'

export type DifficultyRatios = Record<DifficultyLevel, number>

export const orderedDifficultyLevels: DifficultyLevel[] = ['easy', 'medium', 'hard']

/** Màu biểu diễn từng mức độ, dùng chung cho thanh tỷ lệ và chú thích. */
export const difficultyBarColors: Record<DifficultyLevel, string> = {
  easy: '#10B981',
  medium: '#F59E0B',
  hard: '#EF4444',
}

/** Kẹp về khoảng 0–100 và loại bỏ giá trị không phải số. */
export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function sumRatios(ratios: DifficultyRatios): number {
  return orderedDifficultyLevels.reduce((total, level) => total + clampPercentage(ratios[level]), 0)
}

/**
 * Đưa tổng tỷ lệ về đúng 100%: giữ nguyên mức vừa được chỉnh (anchorLevel)
 * rồi chia phần còn lại cho hai mức kia theo đúng tỷ lệ hiện có của chúng.
 * Khi hai mức kia đều bằng 0 thì chia đôi phần còn lại.
 */
export function balanceRatios(ratios: DifficultyRatios, anchorLevel: DifficultyLevel): DifficultyRatios {
  const anchorValue = clampPercentage(ratios[anchorLevel])
  const otherLevels = orderedDifficultyLevels.filter(level => level !== anchorLevel)
  const [firstLevel, secondLevel] = otherLevels
  const remaining = 100 - anchorValue

  const otherSum = clampPercentage(ratios[firstLevel]) + clampPercentage(ratios[secondLevel])
  const firstValue =
    otherSum > 0
      ? Math.round((remaining * clampPercentage(ratios[firstLevel])) / otherSum)
      : Math.round(remaining / 2)

  const safeFirstValue = Math.min(Math.max(firstValue, 0), remaining)

  const balanced: DifficultyRatios = { ...ratios }
  balanced[anchorLevel] = anchorValue
  balanced[firstLevel] = safeFirstValue
  balanced[secondLevel] = remaining - safeFirstValue
  return balanced
}
