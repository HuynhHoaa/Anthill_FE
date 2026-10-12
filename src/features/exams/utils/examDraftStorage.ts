/**
 * Giữ tạm form soạn đề khi giáo viên rời trang đi bổ sung câu hỏi cho ngân hàng.
 * Dùng sessionStorage vì bản nháp chỉ có nghĩa trong đúng phiên làm việc đó.
 */

export interface ExamFormState {
  title: string
  description: string
  durationMinutes: number
  totalQuestions: number
  pointEasy: number
  pointMedium: number
  pointHard: number
  topic: string
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  showResultAfterSubmit: boolean
  openAtLocal: string
  closeAtLocal: string
}

export interface ExamBuilderDraft {
  /** null nghĩa là bản nháp của trang tạo mới, số là mã đề đang sửa. */
  examId: number | null
  form: ExamFormState
  savedAt: number
}

const DRAFT_STORAGE_PREFIX = 'anthill.exam-builder-draft:'
const DRAFT_MAX_AGE_MS = 2 * 3600_000

/**
 * Mỗi đề một key riêng.
 *
 * Dùng chung một key thì lưu nháp của đề này là ghi đè nháp của đề kia, và vì trang soạn đề xoá
 * nháp ngay khi mở, chỉ cần ghé qua một đề khác là nháp đang làm dở biến mất — không cảnh báo,
 * không hoàn tác. Tách key ra thì hai bản nháp sống song song được, đúng như người dùng tưởng.
 */
function draftKey(examId: number | null): string {
  return `${DRAFT_STORAGE_PREFIX}${examId ?? 'new'}`
}

const stringFields: (keyof ExamFormState)[] = [
  'title', 'description', 'topic', 'openAtLocal', 'closeAtLocal',
]
const numberFields: (keyof ExamFormState)[] = [
  'durationMinutes', 'totalQuestions', 'pointEasy', 'pointMedium', 'pointHard',
  'easyPercentage', 'mediumPercentage', 'hardPercentage',
]
const booleanFields: (keyof ExamFormState)[] = [
  'shuffleQuestions', 'shuffleAnswers', 'showResultAfterSubmit',
]

/** Bản ghi cũ sau khi đổi cấu trúc form phải bị loại thay vì hydrate ra 'undefined'. */
function isExamFormState(value: unknown): value is ExamFormState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    stringFields.every(field => typeof candidate[field] === 'string')
    && numberFields.every(field => typeof candidate[field] === 'number' && Number.isFinite(candidate[field]))
    && booleanFields.every(field => typeof candidate[field] === 'boolean')
  )
}

export function saveExamBuilderDraft(draft: ExamBuilderDraft): void {
  try {
    window.sessionStorage.setItem(draftKey(draft.examId), JSON.stringify(draft))
  } catch {
    // Không lưu được thì luồng vẫn đi tiếp, chỉ mất phần khôi phục.
  }
}

/** Trả về bản nháp đúng bài kiểm tra đang mở và còn hạn, ngoài ra luôn là undefined. */
export function readExamBuilderDraft(examId: number | null): ExamBuilderDraft | undefined {
  try {
    const raw = window.sessionStorage.getItem(draftKey(examId))
    if (!raw) return undefined

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return undefined

    const candidate = parsed as Partial<ExamBuilderDraft>
    const savedExamId = candidate.examId
    const savedAt = candidate.savedAt
    const savedForm = candidate.form

    if (savedExamId !== null && typeof savedExamId !== 'number') return undefined
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return undefined
    if (!isExamFormState(savedForm)) return undefined

    if (savedExamId !== examId) return undefined
    if (Date.now() - savedAt > DRAFT_MAX_AGE_MS) return undefined

    return { examId: savedExamId, form: savedForm, savedAt }
  } catch {
    return undefined
  }
}

/** Chỉ xoá nháp của đúng đề đang mở. Xoá tất cả là làm mất bản nháp của đề khác. */
export function clearExamBuilderDraft(examId: number | null): void {
  try {
    window.sessionStorage.removeItem(draftKey(examId))
  } catch {
    // Không cần xử lý thêm.
  }
}
