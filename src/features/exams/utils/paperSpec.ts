/**
 * Cấu hình chia đề lớn thành nhiều đề nhỏ trong form soạn đề theo danh sách.
 *
 * Danh sách câu giáo viên duyệt là "đề lớn". Khi `count` từ 2 trở lên, mỗi lớp được chia thành `count` đề nhỏ rút từ đề lớn:
 * mỗi đề `questionsPerPaper` câu theo `ratios`, và mọi câu cùng mức có cùng điểm (`points`) để các đề có chung tổng điểm.
 * `count` = 1 là đề thường: các trường còn lại không được gửi lên server.
 */
import type { DifficultyLevel } from '../../../types'
import { balanceRatios, clampPercentage, orderedDifficultyLevels, type DifficultyRatios } from './blueprintRatio'
import { calculateRequiredCounts, suggestPointsWithBonus, totalScoreOf, type LevelCounts } from './examScoring'
import { MAX_PAPER_COUNT, MAX_QUESTIONS_PER_PAPER } from './paperPlan'
import { countsOfItems, type QuestionListItem } from './questionListScoring'

export interface PaperSpec {
  /** Số đề nhỏ mỗi lớp nhận; 1 = cả lớp làm chung một đề. */
  count: number
  /** Số câu của MỘT đề nhỏ. */
  questionsPerPaper: number
  /** Tỷ lệ ba mức độ trong MỘT đề nhỏ, cộng 100. */
  ratios: DifficultyRatios
  /** Điểm của một câu ở từng mức. Chỉ có tác dụng khi `count` > 1. */
  points: Record<DifficultyLevel, number>
  /**
   * Số đơn vị 0,01 điểm cộng thêm cho các câu mức cao nhất của MỖI đề nhỏ, để đề cộng đúng 10 khi điểm theo mức không chia ra
   * đúng (như 3 / 3 / 3 câu). Hệ thống tự tính cùng điểm theo mức; 0 khi không cần.
   */
  bonusUnits: number
}

export const DEFAULT_PAPER_SPEC: PaperSpec = {
  count: 1,
  questionsPerPaper: 30,
  ratios: { easy: 33, medium: 33, hard: 34 },
  points: { easy: 0.3, medium: 0.3, hard: 0.4 },
  bonusUnits: 0,
}

export const isMultiPaper = (spec: PaperSpec): boolean => spec.count > 1

export const clampPaperCount = (value: number): number =>
  Number.isFinite(value) ? Math.min(MAX_PAPER_COUNT, Math.max(1, Math.round(value))) : 1

export const clampQuestionsPerPaper = (value: number): number =>
  Number.isFinite(value) ? Math.min(MAX_QUESTIONS_PER_PAPER, Math.max(0, Math.round(value))) : 0

/** Số câu mỗi mức của một đề nhỏ theo cấu hình. */
export function perPaperCounts(spec: PaperSpec): LevelCounts {
  return calculateRequiredCounts(spec.questionsPerPaper, spec.ratios.easy, spec.ratios.medium)
}

/** Tỷ lệ ba mức theo số câu của đề lớn; chưa có câu nào thì giữ tỷ lệ mặc định. */
export function ratiosOfPool(pool: LevelCounts): DifficultyRatios {
  const size = pool.easy + pool.medium + pool.hard
  if (size === 0) return { ...DEFAULT_PAPER_SPEC.ratios }

  const easy = clampPercentage((pool.easy * 100) / size)
  const medium = clampPercentage((pool.medium * 100) / size)
  return balanceRatios({ easy, medium, hard: 100 - easy - medium }, 'hard')
}

/**
 * Cách chia điểm tự tính cho một đề nhỏ: điểm mỗi câu từng mức, điểm cộng thêm, tổng, và có đúng 10 không. `null` khi đề nhỏ
 * chưa có câu nào.
 *
 * Giáo viên không nhập điểm khi chia đề. Với số câu ba mức của một đề, hệ thống tìm ba điểm (có hai chữ số thập phân, câu khó
 * không ít điểm hơn câu dễ, tỷ trọng điểm của ba mức sát 1 : 1,5 : 2 nhất) để cả đề cộng ĐÚNG 10; số câu từng mức vẫn đúng
 * tỷ lệ giáo viên đặt. Số câu mà điểm theo mức không chia ra đúng 10 (như 3 / 3 / 3) thì phần lẻ được cộng thêm 0,01 cho vài
 * câu mức cao nhất của mỗi đề (`bonusUnits`), nên mọi cấu hình đều ra đúng 10.
 */
export function paperPointSuggestion(spec: PaperSpec) {
  return suggestPointsWithBonus(perPaperCounts(spec))
}

/** Mức độ nhận điểm cộng thêm: mức cao nhất mà một đề nhỏ có câu (Khó, rồi Trung bình, rồi Dễ). `null` khi đề nhỏ trống. */
export function bonusLevelOf(counts: LevelCounts): DifficultyLevel | null {
  if (counts.hard > 0) return 'hard'
  if (counts.medium > 0) return 'medium'
  return counts.easy > 0 ? 'easy' : null
}

/** Tổng điểm MỘT đề nhỏ theo cấu hình, đã tính điểm cộng thêm, chính xác tới 0,01. */
export function paperTotalScore(spec: PaperSpec): number {
  const base = Math.round(totalScoreOf(perPaperCounts(spec), spec.points) * 100)
  return (base + spec.bonusUnits) / 100
}

/** Đổi số câu hay tỷ lệ của một đề nhỏ: điểm mỗi mức và điểm cộng thêm luôn được tính lại để một đề đủ 10 điểm. */
export function withAutoPoints(next: PaperSpec): PaperSpec {
  const suggestion = paperPointSuggestion(next)
  return suggestion
    ? { ...next, points: { ...suggestion.points }, bonusUnits: suggestion.bonusUnits }
    : { ...next, points: { ...DEFAULT_PAPER_SPEC.points }, bonusUnits: 0 }
}

/**
 * Cấu hình ban đầu khi bật chia đề: mỗi đề nhỏ có số câu bằng đề lớn chia đều cho các đề (làm tròn xuống), cùng tỷ lệ ba
 * mức với đề lớn, và điểm tự tính để một đề đủ 10. Đề lớn còn trống thì dùng số mặc định. Mọi số câu đều chia được đủ 10
 * (nhờ điểm cộng thêm) nên không cần chọn lại cỡ đề.
 */
export function seedPaperSpec(items: readonly QuestionListItem[], count: number): PaperSpec {
  const pool = countsOfItems(items)
  const ratios = ratiosOfPool(pool)
  const questionsPerPaper = items.length > 0
    ? clampQuestionsPerPaper(Math.max(1, Math.floor(items.length / count)))
    : DEFAULT_PAPER_SPEC.questionsPerPaper

  return withAutoPoints({ ...DEFAULT_PAPER_SPEC, count, ratios, questionsPerPaper })
}

/** Ba tỷ lệ có cộng đúng 100 không. */
export const ratiosAddUp = (ratios: DifficultyRatios): boolean =>
  orderedDifficultyLevels.reduce((sum, level) => sum + clampPercentage(ratios[level]), 0) === 100

/** Hai cấu hình có cùng cách chia đề không (so từng số, điểm so tới 0,01). */
export function samePaperSpec(left: PaperSpec, right: PaperSpec): boolean {
  if (left.count !== right.count) return false
  if (left.count <= 1) return true

  return left.questionsPerPaper === right.questionsPerPaper
    && left.bonusUnits === right.bonusUnits
    && orderedDifficultyLevels.every(level =>
      clampPercentage(left.ratios[level]) === clampPercentage(right.ratios[level])
      && Math.round(left.points[level] * 100) === Math.round(right.points[level] * 100))
}

/** Đề đã lưu → cấu hình trong form. Đề một đề giữ số mặc định để lần bật chia đề sau có chỗ bắt đầu. */
export function paperSpecOfExam(exam: {
  paperCount: number
  totalQuestions: number
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
  pointEasy: number
  pointMedium: number
  pointHard: number
  paperBonusUnits: number
}): PaperSpec {
  if (exam.paperCount <= 1) return { ...DEFAULT_PAPER_SPEC, ratios: { ...DEFAULT_PAPER_SPEC.ratios }, points: { ...DEFAULT_PAPER_SPEC.points } }

  return {
    count: exam.paperCount,
    questionsPerPaper: exam.totalQuestions,
    ratios: { easy: exam.easyPercentage, medium: exam.mediumPercentage, hard: exam.hardPercentage },
    points: { easy: exam.pointEasy, medium: exam.pointMedium, hard: exam.pointHard },
    bonusUnits: exam.paperBonusUnits,
  }
}

/** Đưa điểm theo mức của cấu hình xuống từng câu: khi chia đề, điểm của câu là điểm của mức nó thuộc về. */
export function withLevelPoints(items: readonly QuestionListItem[], spec: PaperSpec): QuestionListItem[] {
  if (!isMultiPaper(spec)) return items as QuestionListItem[]
  return items.map(item => ({ ...item, point: spec.points[item.question.difficulty] }))
}
