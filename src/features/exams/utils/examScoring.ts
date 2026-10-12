/**
 * Tổng điểm của một đề: chuẩn là 100, điểm gắn theo mức độ khó.
 *
 * Đề là một ma trận (tổng số câu và tỷ lệ ba mức), nên giáo viên đặt ba con số: điểm của MỘT câu Dễ,
 * Trung bình, Khó. Số câu mỗi mức do `calculateRequiredCounts` quyết định, khớp từng đơn vị với
 * `BlueprintCalculator` ở server; tổng điểm là số câu mỗi mức nhân điểm mức đó.
 *
 * 100 là tổng chuẩn chứ không phải điều kiện bắt buộc: giáo viên chọn số câu bất kỳ (56 câu chẳng hạn)
 * và nhiều cấu hình không chia ra đúng 100,00. Giao diện luôn hiện "n / 100", gợi ý cách chia sát 100
 * nhất và hỏi xác nhận lúc chốt một đề chưa đủ; server nhận mọi tổng hợp lệ.
 *
 * Mọi phép tính điểm ở đây đi qua đơn vị 0,01 (số nguyên) để không dính sai số dấu phẩy động:
 * 33,33 × 3 phải ra đúng 99,99 chứ không phải 99,99000000000001.
 */
import type { DifficultyLevel } from '../../../types'

export const EXAM_TOTAL_SCORE = 100

/** Số đơn vị 0,01 trong tổng điểm. */
const TOTAL_UNITS = EXAM_TOTAL_SCORE * 100

export type LevelCounts = Record<DifficultyLevel, number>
export type LevelPoints = Record<DifficultyLevel, number>

const levels: DifficultyLevel[] = ['easy', 'medium', 'hard']

/** Trọng số mong muốn giữa ba mức: một câu Khó đáng gấp đôi một câu Dễ. */
export const DEFAULT_LEVEL_WEIGHTS: LevelPoints = { easy: 1, medium: 1.5, hard: 2 }

/** `Math.round(total * percentage / 100)`, cùng ngữ nghĩa `ScaleAndRound` ở server. */
function scaleAndRound(total: number, percentage: number): number {
  return Math.round((total * Math.max(0, percentage)) / 100)
}

/**
 * Số câu mỗi mức. Mức Khó nhận phần dư nên tổng ba mức luôn bằng `totalQuestions`, kể cả khi ba tỷ lệ lẻ.
 * Phải khớp `BlueprintCalculator.CalculateRequiredCounts`: lệch một câu là giáo viên thấy một tổng điểm
 * trên màn hình và server tính một tổng khác.
 */
export function calculateRequiredCounts(
  totalQuestions: number,
  easyPercentage: number,
  mediumPercentage: number,
): LevelCounts {
  const total = Math.max(0, Math.floor(Number.isFinite(totalQuestions) ? totalQuestions : 0))

  const easy = Math.min(Math.max(scaleAndRound(total, easyPercentage), 0), total)
  const medium = Math.min(total - easy, Math.max(0, scaleAndRound(total, mediumPercentage)))
  const hard = Math.max(0, total - easy - medium)

  return { easy, medium, hard }
}

function toUnits(points: number): number {
  return Number.isFinite(points) ? Math.round(points * 100) : 0
}

/** Tổng điểm của đề theo số câu và điểm từng mức, chính xác tới 0,01. */
export function totalScoreOf(counts: LevelCounts, points: LevelPoints): number {
  const units = levels.reduce((sum, level) => sum + counts[level] * toUnits(points[level]), 0)
  return units / 100
}

/** Nói thẳng đang thiếu hay thừa bao nhiêu; `null` khi đã đúng 100. */
export function describeScoreGap(total: number): string | null {
  const units = Math.round(total * 100)
  if (units === TOTAL_UNITS) return null

  const gap = Math.abs(TOTAL_UNITS - units) / 100
  const direction = units < TOTAL_UNITS ? 'thiếu' : 'thừa'
  return `Tổng điểm đang là ${trimNumber(total)} / ${EXAM_TOTAL_SCORE}, ${direction} ${trimNumber(gap)}.`
}

/** Chỉ phần chênh, để đặt cạnh một con số tổng đã hiện sẵn: "thiếu 4.5 điểm". `null` khi đã đúng 100. */
export function describeScoreDelta(total: number): string | null {
  const units = Math.round(total * 100)
  if (units === TOTAL_UNITS) return null

  const gap = Math.abs(TOTAL_UNITS - units) / 100
  return `${units < TOTAL_UNITS ? 'Thiếu' : 'Thừa'} ${trimNumber(gap)} điểm.`
}

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** Điểm có quá hai chữ số thập phân không (server làm tròn âm thầm nên phải chặn từ đây). */
export function hasTooManyDecimals(points: number): boolean {
  return Math.abs(points * 100 - Math.round(points * 100)) > 1e-6
}

// ── Gợi ý chia điểm ─────────────────────────────────────────────────────────────────────────────────

/** Giá trị nhỏ nhất của điểm một câu: nửa điểm, để đề 100 câu vẫn chia được mà không có câu 0 điểm. */
const MIN_POINT_UNITS = TOTAL_UNITS / 200

/** Một cách chia điểm được gợi ý. */
export interface PointSuggestion {
  points: LevelPoints
  /** Tổng điểm của cách chia này, chính xác tới 0,01. Đúng 100 khi `exact`. */
  total: number
  /**
   * `false` khi số câu này không thể ra đúng 100 (tổng luôn là bội của ước chung lớn nhất của các số
   * câu) và đây là cách chia sát 100 nhất. Giáo viên vẫn lưu được, sau một bước xác nhận.
   */
  exact: boolean
}

/**
 * Gợi ý ba điểm (Dễ ≤ Trung bình ≤ Khó) cho một cách chia số câu.
 *
 * Ưu tiên tổng đúng 100; trong số đó chọn bộ có tỷ trọng điểm của từng mức sát nhất với `weights` và số
 * đẹp nhất (nguyên điểm, rồi nửa điểm, rồi phần mười). Thử bước 0,1 trước, không có nghiệm đúng mới
 * xuống bước 0,01. Không có nghiệm đúng nào (ví dụ 30 câu chia 12/12/6) thì trả cách chia có tổng sát
 * 100 nhất, `exact: false`, để nút gợi ý luôn điền được một con số hợp lý thay vì bỏ trống.
 *
 * `null` chỉ khi đề chưa có câu nào.
 */
export function suggestPoints(
  counts: LevelCounts,
  weights: LevelPoints = DEFAULT_LEVEL_WEIGHTS,
): PointSuggestion | null {
  const active = levels.filter(level => counts[level] > 0)
  if (active.length === 0) return null

  const exact = findExactPoints(counts, weights, active)
  if (exact) {
    return { points: exact, total: EXAM_TOTAL_SCORE, exact: true }
  }

  // Bước 0,1 cho số đẹp. Nó lệch tối đa nửa ước chung lớn nhất của các số câu nhân 0,1, nên với số câu
  // rất không chia được (88 câu toàn Khó lệch 3,2 điểm) thì xuống bước 0,01 cho sát hơn.
  const coarse = solveNearest(counts, weights, active, 10)
  let near = coarse
  if (!coarse || gapUnits(counts, coarse) > COARSE_GAP_LIMIT_UNITS) {
    const fine = solveNearest(counts, weights, active, 1)
    if (fine && (!coarse || gapUnits(counts, fine) < gapUnits(counts, coarse))) near = fine
  }
  if (!near) return null

  const points = unitsToPoints(near)
  return { points, total: totalScoreOf(counts, points), exact: false }
}

/** Lệch tối đa (đơn vị 0,01) chấp nhận ở bước 0,1 để giữ số đẹp: nửa điểm. */
const COARSE_GAP_LIMIT_UNITS = 50

function gapUnits(counts: LevelCounts, units: LevelUnits): number {
  const total = levels.reduce((sum, level) => sum + counts[level] * units[level], 0)
  return Math.abs(total - TOTAL_UNITS)
}

function unitsToPoints(units: Record<DifficultyLevel, number>): LevelPoints {
  return { easy: units.easy / 100, medium: units.medium / 100, hard: units.hard / 100 }
}

/** Cách chia ra đúng 100, hoặc `null` khi số câu này không chia được. */
function findExactPoints(
  counts: LevelCounts,
  weights: LevelPoints,
  active: DifficultyLevel[],
): LevelPoints | null {
  for (const step of [10, 1]) {
    const found = solve(counts, weights, active, step)
    if (found) return unitsToPoints(found)
  }
  return null
}

function firstMultiple(minimum: number, step: number): number {
  return Math.ceil(minimum / step) * step
}

/** Số "đẹp": nguyên điểm không bị phạt, nửa điểm phạt 1, phần mười phạt 2, còn lại phạt 3. */
function ugliness(units: number): number {
  if (units % 100 === 0) return 0
  if (units % 50 === 0) return 1
  if (units % 10 === 0) return 2
  return 3
}

type LevelUnits = Record<DifficultyLevel, number>

/**
 * Chi phí của một bộ điểm: độ lệch so với tỷ trọng mong muốn (nhân 1000) cộng độ xấu của các con số.
 * `null` khi bộ điểm vi phạm ràng buộc: câu khó không được ít điểm hơn câu dễ, và không câu nào dưới
 * mức tối thiểu.
 */
function scorePick(
  counts: LevelCounts,
  weights: LevelPoints,
  active: DifficultyLevel[],
  picked: Partial<Record<DifficultyLevel, number>>,
): { cost: number; totalUnits: number } | null {
  const values = active.map(level => picked[level] as number)
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] < MIN_POINT_UNITS) return null
    if (index > 0 && values[index - 1] > values[index]) return null
  }

  const denominator = active.reduce((sum, level) => sum + counts[level] * weights[level], 0)

  let deviation = 0
  let ugly = 0
  let totalUnits = 0
  for (const level of active) {
    const units = picked[level] as number
    totalUnits += counts[level] * units
    const idealShare = (counts[level] * weights[level]) / denominator
    deviation += ((counts[level] * units) / TOTAL_UNITS - idealShare) ** 2
    ugly += ugliness(units)
  }

  return { cost: 1000 * deviation + ugly, totalUnits }
}

function toLevelUnits(picked: Partial<Record<DifficultyLevel, number>>): LevelUnits {
  return { easy: picked.easy ?? 0, medium: picked.medium ?? 0, hard: picked.hard ?? 0 }
}

/** Nghiệm ra đúng 100 sát tỷ trọng mong muốn nhất. */
function solve(
  counts: LevelCounts,
  weights: LevelPoints,
  active: DifficultyLevel[],
  step: number,
): LevelUnits | null {
  // Giữ trong một đối tượng: TypeScript không thấy phép gán trong hàm lồng nên sẽ thu hẹp biến rời về `null`.
  const result: { best: LevelUnits | null; cost: number } = { best: null, cost: Infinity }

  const consider = (picked: Partial<Record<DifficultyLevel, number>>) => {
    const scored = scorePick(counts, weights, active, picked)
    if (scored && scored.cost < result.cost) {
      result.cost = scored.cost
      result.best = toLevelUnits(picked)
    }
  }

  const start = firstMultiple(MIN_POINT_UNITS, step)

  if (active.length === 1) {
    const [only] = active
    if (TOTAL_UNITS % counts[only] === 0 && (TOTAL_UNITS / counts[only]) % step === 0) {
      consider({ [only]: TOTAL_UNITS / counts[only] })
    }
  } else if (active.length === 2) {
    const [first, second] = active
    const countSum = counts[first] + counts[second]
    for (let a = start; a <= TOTAL_UNITS / countSum; a += step) {
      const rest = TOTAL_UNITS - counts[first] * a
      if (rest > 0 && rest % counts[second] === 0 && (rest / counts[second]) % step === 0) {
        consider({ [first]: a, [second]: rest / counts[second] })
      }
    }
  } else {
    const [first, second, third] = active
    const countSum = counts[first] + counts[second] + counts[third]
    for (let a = start; a <= TOTAL_UNITS / countSum; a += step) {
      const upperB = (TOTAL_UNITS - counts[first] * a) / (counts[second] + counts[third])
      for (let b = a; b <= upperB; b += step) {
        const rest = TOTAL_UNITS - counts[first] * a - counts[second] * b
        if (rest > 0 && rest % counts[third] === 0 && (rest / counts[third]) % step === 0) {
          consider({ [first]: a, [second]: b, [third]: rest / counts[third] })
        }
      }
    }
  }

  return result.best
}

/**
 * Khi không có cách chia nào ra đúng 100: bộ điểm có tổng sát 100 nhất, rồi sát tỷ trọng nhất, rồi đẹp nhất.
 * Mỗi mức chỉ nhận bội của `step`; mức cuối lấy hai giá trị kẹp quanh con số làm tổng đúng 100.
 */
function solveNearest(
  counts: LevelCounts,
  weights: LevelPoints,
  active: DifficultyLevel[],
  step: number,
): LevelUnits | null {
  const result: { best: LevelUnits | null; gap: number; cost: number } = {
    best: null,
    gap: Infinity,
    cost: Infinity,
  }

  const consider = (picked: Partial<Record<DifficultyLevel, number>>) => {
    const scored = scorePick(counts, weights, active, picked)
    if (!scored) return

    const gap = Math.abs(scored.totalUnits - TOTAL_UNITS)
    if (gap < result.gap || (gap === result.gap && scored.cost < result.cost)) {
      result.gap = gap
      result.cost = scored.cost
      result.best = toLevelUnits(picked)
    }
  }

  /** Hai bội của `step` kẹp quanh `exact`, để thử cả hai phía của 100. */
  const around = (exact: number): number[] => {
    const lower = Math.floor(exact / step) * step
    return [lower, lower + step]
  }

  const start = firstMultiple(MIN_POINT_UNITS, step)

  if (active.length === 1) {
    const [only] = active
    for (const value of around(TOTAL_UNITS / counts[only])) {
      consider({ [only]: value })
    }
  } else if (active.length === 2) {
    const [first, second] = active
    const countSum = counts[first] + counts[second]
    for (let a = start; a <= TOTAL_UNITS / countSum; a += step) {
      for (const b of around((TOTAL_UNITS - counts[first] * a) / counts[second])) {
        consider({ [first]: a, [second]: b })
      }
    }
  } else {
    const [first, second, third] = active
    const countSum = counts[first] + counts[second] + counts[third]
    for (let a = start; a <= TOTAL_UNITS / countSum; a += step) {
      const upperB = (TOTAL_UNITS - counts[first] * a) / (counts[second] + counts[third])
      for (let b = a; b <= upperB + step; b += step) {
        const rest = TOTAL_UNITS - counts[first] * a - counts[second] * b
        for (const c of around(rest / counts[third])) {
          consider({ [first]: a, [second]: b, [third]: c })
        }
      }
    }
  }

  return result.best
}

/**
 * Những cách chia lại số câu (cùng tổng số câu) gần cách đang có nhất mà chia được đúng 100.
 * Dùng khi `suggestPoints` trả `exact: false`, để nói với giáo viên "đổi thành 11 / 12 / 7 thì chia được".
 */
export function nearestSolvableCounts(
  counts: LevelCounts,
  weights: LevelPoints = DEFAULT_LEVEL_WEIGHTS,
  limit = 3,
): LevelCounts[] {
  const total = counts.easy + counts.medium + counts.hard
  const candidates: { distance: number; counts: LevelCounts }[] = []

  for (let easy = 0; easy <= total; easy += 1) {
    for (let medium = 0; medium <= total - easy; medium += 1) {
      const hard = total - easy - medium
      const same = easy === counts.easy && medium === counts.medium && hard === counts.hard
      if (same) continue

      const distance =
        Math.abs(easy - counts.easy) + Math.abs(medium - counts.medium) + Math.abs(hard - counts.hard)
      candidates.push({ distance, counts: { easy, medium, hard } })
    }
  }

  // Gần nhất trước; kiểm từng ứng viên theo thứ tự đó và dừng ngay khi đủ, nên thường chỉ kiểm vài cái.
  candidates.sort((left, right) => left.distance - right.distance)

  const found: LevelCounts[] = []
  for (const candidate of candidates) {
    const active = levels.filter(level => candidate.counts[level] > 0)
    if (active.length > 0 && findExactPoints(candidate.counts, weights, active) !== null) {
      found.push(candidate.counts)
      if (found.length >= limit) break
    }
  }
  return found
}

/**
 * Ba tỷ lệ phần trăm cho một cách chia số câu, sao cho `calculateRequiredCounts` trả đúng cách chia đó.
 * `null` khi không có bộ tỷ lệ nguyên nào cho ra đúng nó (hiếm, khi tổng số câu rất lớn).
 */
export function ratiosForCounts(
  counts: LevelCounts,
): { easy: number; medium: number; hard: number } | null {
  const total = counts.easy + counts.medium + counts.hard
  if (total <= 0) return null

  const baseEasy = Math.round((counts.easy * 100) / total)
  const baseMedium = Math.round((counts.medium * 100) / total)

  // Thử độ lệch nhỏ trước: bộ tỷ lệ gần với tỷ lệ tự nhiên nhất là bộ giáo viên nhìn thấy dễ hiểu nhất.
  const deltas: [number, number][] = []
  for (let easyDelta = -3; easyDelta <= 3; easyDelta += 1) {
    for (let mediumDelta = -3; mediumDelta <= 3; mediumDelta += 1) deltas.push([easyDelta, mediumDelta])
  }
  deltas.sort((left, right) => Math.abs(left[0]) + Math.abs(left[1]) - (Math.abs(right[0]) + Math.abs(right[1])))

  for (const [easyDelta, mediumDelta] of deltas) {
    const easy = baseEasy + easyDelta
    const medium = baseMedium + mediumDelta
    const hard = 100 - easy - medium
    if (easy < 0 || medium < 0 || hard < 0) continue

    const check = calculateRequiredCounts(total, easy, medium)
    if (check.easy === counts.easy && check.medium === counts.medium && check.hard === counts.hard) {
      return { easy, medium, hard }
    }
  }
  return null
}
