/**
 * Tính trước việc chia một đề lớn thành N đề nhỏ cho mỗi lớp.
 *
 * Phải khớp từng con số với `PaperPlanner` ở server (cùng công thức, không rút ngẫu nhiên): con số giáo viên thấy lúc
 * soạn là con số lúc server sinh đề. Mỗi câu của đề lớn được dùng đều nhau — chênh nhiều nhất một lần — nên chỉ cần
 * số câu của đề lớn (`pool`) và số câu mỗi đề nhỏ (`need`) là biết trùng bao nhiêu, dư bao nhiêu.
 */
import { difficultyLabels, type DifficultyLevel } from '../../../types'
import { calculateRequiredCounts, type LevelCounts } from './examScoring'
import { countsOfItems, type QuestionListItem } from './questionListScoring'

/** Trần số đề, bằng `PaperPlanner.MaxPaperCount`. */
export const MAX_PAPER_COUNT = 10

/** Trần số câu của một đề, bằng `SaveExamRequestValidator.MaxTotalQuestions`. */
export const MAX_QUESTIONS_PER_PAPER = 500

const LEVELS: DifficultyLevel[] = ['easy', 'medium', 'hard']

/** Ngược lại của `paperLabelOf`: "A" → 0, "B" → 1, "27" → 26. `undefined` khi nhãn không đọc được. */
export function paperIndexOfLabel(label: string): number | undefined {
  if (/^[A-Z]$/.test(label)) return label.charCodeAt(0) - 65
  const number = Number(label)
  return Number.isInteger(number) && number >= 27 ? number - 1 : undefined
}

/** Mã đề hiện cho giáo viên, cùng quy ước với server (`PaperLabels.Of`): 0 → "A", 1 → "B"… quá 26 thì dùng số thứ tự. */
export function paperLabelOf(index: number): string {
  return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

export interface PaperLevelPlan {
  level: DifficultyLevel
  /** Số câu mức này trong đề lớn. */
  pool: number
  /** Số câu mức này mỗi đề nhỏ cần. */
  need: number
  /** Đề lớn có đủ câu để một đề nhỏ không lặp câu. */
  sufficient: boolean
  /** Số câu nằm ở từ hai đề nhỏ trở lên. */
  shared: number
  /** Số câu không nằm ở đề nhỏ nào. */
  unused: number
  /** Một câu được dùng nhiều nhất bao nhiêu lần (qua tất cả đề của một lớp). */
  maxCopies: number
}

export interface PaperPlan {
  paperCount: number
  levels: PaperLevelPlan[]
  /** Mọi mức đều đủ câu — điều kiện để lưu thành đề đã xuất bản. */
  feasible: boolean
}

export function evaluatePaperPlan(pool: LevelCounts, perPaper: LevelCounts, paperCount: number): PaperPlan {
  const levels = LEVELS.map<PaperLevelPlan>(level => {
    const size = pool[level]
    const need = Math.max(0, perPaper[level])
    const demand = paperCount * need

    if (need === 0) {
      return { level, pool: size, need: 0, sufficient: true, shared: 0, unused: size, maxCopies: 0 }
    }
    if (size < need) {
      return { level, pool: size, need, sufficient: false, shared: 0, unused: 0, maxCopies: 0 }
    }

    // demand = quotient × pool + remainder: `remainder` câu dùng quotient + 1 lần, các câu còn lại dùng quotient lần.
    const quotient = Math.floor(demand / size)
    const remainder = demand % size

    return {
      level,
      pool: size,
      need,
      sufficient: true,
      maxCopies: remainder > 0 ? quotient + 1 : quotient,
      shared: quotient >= 2 ? size : quotient === 1 ? remainder : 0,
      unused: quotient === 0 ? size - remainder : 0,
    }
  })

  return { paperCount, levels, feasible: levels.every(level => level.sufficient) }
}

/** Kế hoạch chia đề từ danh sách câu đã duyệt và cấu hình một đề nhỏ. */
export function planPapers(
  items: readonly QuestionListItem[],
  paperCount: number,
  questionsPerPaper: number,
  ratios: { easy: number; medium: number },
): PaperPlan {
  const perPaper = calculateRequiredCounts(questionsPerPaper, ratios.easy, ratios.medium)
  return evaluatePaperPlan(countsOfItems(items), perPaper, paperCount)
}

/** Câu chữ cho một mức không đủ câu — cùng ý với `PaperPlanner.Problems`. */
export function describeShortage(level: PaperLevelPlan): string {
  const label = difficultyLabels[level.level]
  return `Mức ${label}: mỗi đề cần ${level.need} câu nhưng đề lớn chỉ có ${level.pool} câu ${label}.`
}

/**
 * Các mức có hơn một mức điểm trong danh sách. Đề nhiều đề đòi các câu cùng mức cùng điểm, để mọi đề có cùng tổng
 * điểm; mỗi phần tử là tên mức đang lệch.
 */
export function levelsWithMixedPoints(items: readonly QuestionListItem[]): DifficultyLevel[] {
  return LEVELS.filter(level => {
    const points = new Set(items.filter(item => item.question.difficulty === level).map(item => Math.round(item.point * 100)))
    return points.size > 1
  })
}

/** Điểm chung của từng mức trong danh sách; `undefined` khi mức đó chưa có câu nào. */
export function levelPointsOf(items: readonly QuestionListItem[]): Partial<Record<DifficultyLevel, number>> {
  const result: Partial<Record<DifficultyLevel, number>> = {}
  LEVELS.forEach(level => {
    const first = items.find(item => item.question.difficulty === level)
    if (first) result[level] = first.point
  })
  return result
}
