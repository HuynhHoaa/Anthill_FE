/**
 * Giữ tạm form soạn đề theo danh sách khi giáo viên rời trang đi soạn thêm một câu hỏi vào ngân hàng.
 * Dùng sessionStorage vì bản nháp chỉ có nghĩa trong đúng phiên làm việc đó.
 *
 * Tách khỏi `examDraftStorage.ts` (đề theo ma trận): hai kiểu form khác hẳn nhau và dùng chung một khoá thì
 * bản nháp của kiểu này bị kiểu kia đọc ra thành một form thiếu trường.
 */
import type { Question } from '../../../types'
import { isClassAssignmentDraft, type ClassAssignmentDraft } from './classAssignment'
import { DEFAULT_PAPER_SPEC, type PaperSpec } from './paperSpec'

export interface ExamListFormState {
  title: string
  description: string
  durationMinutes: number
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  showResultAfterSubmit: boolean
  openAtLocal: string
  closeAtLocal: string
  /** Cách chia đề lớn thành nhiều đề nhỏ cho mỗi lớp; `count` = 1 là đề thường. */
  paper: PaperSpec
}

export interface ExamListDraftItem {
  question: Question
  point: number
}

export interface ExamListDraft {
  /** null nghĩa là bản nháp của trang tạo mới, số là mã đề đang sửa. */
  examId: number | null
  form: ExamListFormState
  items: ExamListDraftItem[]
  assignment?: ClassAssignmentDraft
  savedAt: number
}

const KEY_PREFIX = 'anthill.exam-list-builder-draft:'
const MAX_AGE_MS = 2 * 3600_000

const keyOf = (examId: number | null) => `${KEY_PREFIX}${examId ?? 'new'}`

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function isPaperSpec(value: unknown): value is PaperSpec {
  if (!value || typeof value !== 'object') return false
  const spec = value as Record<string, unknown>
  const ratios = spec.ratios as Record<string, unknown> | undefined
  const points = spec.points as Record<string, unknown> | undefined
  const levels = ['easy', 'medium', 'hard']

  return isFiniteNumber(spec.count)
    && isFiniteNumber(spec.questionsPerPaper)
    && isFiniteNumber(spec.bonusUnits)
    && !!ratios && levels.every(level => isFiniteNumber(ratios[level]))
    && !!points && levels.every(level => isFiniteNumber(points[level]))
}

/** Bản nháp lưu trước khi có chia đề không mang `paper`: đọc như đề một đề. */
function isForm(value: unknown): value is Omit<ExamListFormState, 'paper'> & { paper?: unknown } {
  if (!value || typeof value !== 'object') return false
  const form = value as Record<string, unknown>

  return ['title', 'description', 'openAtLocal', 'closeAtLocal'].every(key => typeof form[key] === 'string')
    && typeof form.durationMinutes === 'number'
    && ['shuffleQuestions', 'shuffleAnswers', 'showResultAfterSubmit'].every(key => typeof form[key] === 'boolean')
    && (form.paper === undefined || isPaperSpec(form.paper))
}

function isItem(value: unknown): value is ExamListDraftItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  const question = item.question as Record<string, unknown> | undefined

  return typeof item.point === 'number'
    && Number.isFinite(item.point)
    && !!question
    && typeof question.id === 'number'
    && typeof question.content === 'string'
    && Array.isArray(question.answers)
}

export function saveExamListDraft(draft: ExamListDraft): void {
  try {
    window.sessionStorage.setItem(keyOf(draft.examId), JSON.stringify(draft))
  } catch {
    // Không lưu được thì luồng vẫn đi tiếp, chỉ mất phần khôi phục.
  }
}

/** Bản nháp đúng đề đang mở và còn hạn; ngoài ra luôn là undefined. */
export function readExamListDraft(examId: number | null): ExamListDraft | undefined {
  try {
    const raw = window.sessionStorage.getItem(keyOf(examId))
    if (!raw) return undefined

    const parsed = JSON.parse(raw) as Partial<ExamListDraft> | null
    if (!parsed || typeof parsed !== 'object') return undefined
    if (parsed.examId !== examId) return undefined
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) return undefined
    if (!isForm(parsed.form)) return undefined
    if (!Array.isArray(parsed.items) || !parsed.items.every(isItem)) return undefined

    return {
      examId,
      form: { ...parsed.form, paper: parsed.form.paper ?? { ...DEFAULT_PAPER_SPEC } } as ExamListFormState,
      items: parsed.items,
      assignment: isClassAssignmentDraft(parsed.assignment) ? parsed.assignment : undefined,
      savedAt: parsed.savedAt,
    }
  } catch {
    return undefined
  }
}

export function clearExamListDraft(examId: number | null): void {
  try {
    window.sessionStorage.removeItem(keyOf(examId))
  } catch {
    // Không cần xử lý thêm.
  }
}
