/**
 * Điểm và đếm câu cho một đề soạn theo danh sách câu hỏi.
 *
 * Khác `examScoring.ts` (điểm theo mức độ, cho đề ma trận): ở đây mỗi câu có điểm riêng nên tổng là tổng điểm
 * từng câu. Mọi phép cộng đi qua đơn vị 0,01 để 0,1 + 0,2 không ra 0,30000000000000004 rồi bị server (làm tròn
 * hai chữ số) coi là con số khác với con số giáo viên đang nhìn.
 */
import type { DifficultyLevel, Question } from '../../../types'
import { EXAM_TOTAL_SCORE, suggestPoints, type LevelCounts } from './examScoring'

/** Một câu đã vào danh sách của đề đang soạn, kèm điểm giáo viên đặt cho nó. */
export interface QuestionListItem {
  question: Question
  point: number
}

const toUnits = (value: number) => Math.round(value * 100)

/** Tổng điểm, đã làm tròn tới 0,01. */
export function totalOfItems(items: readonly QuestionListItem[]): number {
  return items.reduce((sum, item) => sum + toUnits(item.point), 0) / 100
}

export function countsOfItems(items: readonly QuestionListItem[]): LevelCounts {
  const counts: LevelCounts = { easy: 0, medium: 0, hard: 0 }
  items.forEach(item => {
    counts[item.question.difficulty] += 1
  })
  return counts
}

/** Tổng điểm của từng mức độ — để hiện "Dễ 6 câu · 24 điểm". */
export function pointsByLevel(items: readonly QuestionListItem[]): Record<DifficultyLevel, number> {
  const totals: Record<DifficultyLevel, number> = { easy: 0, medium: 0, hard: 0 }
  items.forEach(item => {
    totals[item.question.difficulty] += toUnits(item.point)
  })
  return { easy: totals.easy / 100, medium: totals.medium / 100, hard: totals.hard / 100 }
}

/**
 * Điểm ban đầu của một câu vừa đưa vào đề: điểm mặc định giáo viên đã đặt cho câu đó trong ngân hàng. Đề không
 * tự chia lại điểm khi thêm bớt câu — muốn chia đều hay chia theo mức độ thì giáo viên bấm nút.
 *
 * Kẹp ở tổng điểm chuẩn để câu có điểm mặc định lớn hơn cả bài (ví dụ đặt từ thời chuẩn còn là 100) không vào đề
 * với một điểm phi lý ngay.
 */
export function initialPointOf(question: Question): number {
  const value = question.defaultPoint
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(value, EXAM_TOTAL_SCORE)
}

/**
 * Chia `total` điểm đều cho `count` câu, tới 0,01, phần dư (từng 0,01) dồn vào những câu đầu — nên tổng luôn
 * đúng `total`: 3 câu chia 10 ra 3,34 / 3,33 / 3,33.
 */
export function splitEvenly(count: number, total: number = EXAM_TOTAL_SCORE): number[] {
  if (count <= 0) return []

  const units = toUnits(total)
  const base = Math.floor(units / count)
  const extra = units - base * count

  return Array.from({ length: count }, (_, index) => (base + (index < extra ? 1 : 0)) / 100)
}

/**
 * Điểm từng câu theo mức độ (câu Khó đáng nhiều hơn câu Dễ), dùng cách gợi ý chia điểm của đề ma trận.
 * Trả `null` khi danh sách rỗng.
 */
export function splitByDifficulty(items: readonly QuestionListItem[]): number[] | null {
  const suggestion = suggestPoints(countsOfItems(items))
  if (!suggestion) return null

  return items.map(item => suggestion.points[item.question.difficulty])
}

/** Có câu nào đang bị ẩn khỏi ngân hàng không — đề chứa câu bị ẩn thì không xuất bản được. */
export function hiddenCount(items: readonly QuestionListItem[]): number {
  return items.filter(item => item.question.status === 'hidden').length
}
