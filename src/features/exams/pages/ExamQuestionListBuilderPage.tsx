import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, CalendarClock, CheckCircle2, Copy, FileText, ListChecks, Loader2, Lock, Plus,
  Save, Scale, Send, Settings, Shuffle, Wand2, type LucideIcon,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import SlidingSegments from '../../../components/common/SlidingSegments'
import EmptyState from '../../../components/common/EmptyState'
import DateTimeInput from '../../../components/common/DateTimeInput'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard'
import {
  assignExam, createExam, duplicateExam, getExam, getExamQuestions, publishExam, updateExam,
  type AssignExamResult, type ComposeQuestionsResult, type ExamPayload,
} from '../../../services/examService'
import { listOpenGroups } from '../../../services/groupService'
import { difficultyLabels, type DifficultyLevel, type Exam, type Question } from '../../../types'
import { formatDateTime, parseDateTime } from '../../../lib/format'
import type { ApiError } from '../../../lib/apiClient'
import ComposeQuestionsDialog from '../components/ComposeQuestionsDialog'
import ExamClassAssignment from '../components/ExamClassAssignment'
import ExamPaperSplitPanel from '../components/ExamPaperSplitPanel'
import ExamQuestionCard from '../components/ExamQuestionCard'
import FieldError from '../components/FieldError'
import QuestionPickerDialog from '../components/QuestionPickerDialog'
import ComposeShortfallNotice, { type ComposeShortfall } from '../components/ComposeShortfallNotice'
import {
  classAssignmentProblems, createEmptyClassAssignment, effectiveGroupIds, toAssignClassTargets,
  type ClassAssignmentDraft,
} from '../utils/classAssignment'
import {
  examAssignTargetsDetails, examDuplicateConfirmCopy, examPublishAndAssignConfirmCopy, examPublishConfirmCopy,
  publishedExamEditConfirmCopy,
} from '../utils/examConfirmations'
import {
  clearExamListDraft, readExamListDraft, saveExamListDraft, type ExamListFormState,
} from '../utils/examListDraftStorage'
import {
  describeScoreGap, describeScoreDelta, EXAM_TOTAL_SCORE, hasTooManyDecimals, MAX_QUESTION_POINT, totalScoreOf,
} from '../utils/examScoring'
import { clampPercentage } from '../utils/blueprintRatio'
import { evaluatePaperPlan } from '../utils/paperPlan'
import {
  DEFAULT_PAPER_SPEC, isMultiPaper, paperSpecOfExam, paperTotalScore, perPaperCounts, ratiosAddUp, samePaperSpec, withAutoPoints,
  withLevelPoints, type PaperSpec,
} from '../utils/paperSpec'
import {
  buildDefaultSchedule, describeScheduleLock, isCloseAfterOpen, minutesBetween, opensWithinLockWindow,
  SCHEDULE_LOCK_WARNING, toDateTimeLocalValue, toServiceDateTime,
} from '../utils/examScheduleFormat'
import {
  countsOfItems, hiddenCount, initialPointOf, pointsByLevel, splitByDifficulty, splitEvenly, totalOfItems,
  type QuestionListItem,
} from '../utils/questionListScoring'

type SaveMode = 'draft' | 'publish'
type ListTab = 'config' | 'content' | 'assign'

type ListErrorKey = keyof ExamListFormState | 'questions'
type ListErrors = Partial<Record<ListErrorKey, string>>

const tabOfError: Record<ListErrorKey, ListTab> = {
  title: 'config',
  description: 'config',
  openAtLocal: 'config',
  closeAtLocal: 'config',
  durationMinutes: 'config',
  shuffleQuestions: 'config',
  shuffleAnswers: 'config',
  showResultAfterSubmit: 'config',
  paper: 'config',
  questions: 'content',
}

const inputBaseClass = 'w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-4'
const inputNormalClass = `${inputBaseClass} border-slate-200 focus:border-indigo-400 focus:ring-indigo-50`
const inputInvalidClass = `${inputBaseClass} border-red-300 focus:border-red-400 focus:ring-red-50`
const lockedFieldClass = 'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'
const labelClass = 'block text-xs font-semibold text-slate-600 mb-1'
const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const primaryGradient = 'linear-gradient(135deg,#6366F1,#8B5CF6)'

const levels: readonly DifficultyLevel[] = ['easy', 'medium', 'hard']
const levelColor: Record<DifficultyLevel, string> = { easy: '#10B981', medium: '#F59E0B', hard: '#EF4444' }

function fieldClass(message: string | undefined): string {
  return message ? inputInvalidClass : inputNormalClass
}

function createInitialForm(): ExamListFormState {
  const schedule = buildDefaultSchedule()

  return {
    title: '',
    description: '',
    durationMinutes: 45,
    shuffleQuestions: true,
    shuffleAnswers: true,
    showResultAfterSubmit: true,
    openAtLocal: schedule.openAtLocal,
    closeAtLocal: schedule.closeAtLocal,
    paper: { ...DEFAULT_PAPER_SPEC, ratios: { ...DEFAULT_PAPER_SPEC.ratios }, points: { ...DEFAULT_PAPER_SPEC.points } },
  }
}

function toErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

function isConflictError(caught: unknown): boolean {
  return typeof caught === 'object' && caught !== null && (caught as Partial<ApiError>).status === 409
}

/** Điểm một câu có hợp lệ không; trả câu báo lỗi hoặc `undefined`. */
function pointProblem(point: number): string | undefined {
  if (!Number.isFinite(point)) return 'Điểm không hợp lệ.'
  if (point < 0) return 'Điểm không được âm.'
  if (point > MAX_QUESTION_POINT) return `Tối đa ${MAX_QUESTION_POINT} điểm.`
  if (hasTooManyDecimals(point)) return 'Tối đa 2 chữ số thập phân.'
  return undefined
}

/** Lỗi của cấu hình chia đề; `undefined` khi hợp lệ hoặc đề không chia. Nháp được miễn tỷ lệ và số câu đề lớn. */
function paperProblem(spec: PaperSpec, items: readonly QuestionListItem[], mode: SaveMode): string | undefined {
  if (!isMultiPaper(spec)) return undefined

  if (spec.questionsPerPaper < 1) return 'Mỗi đề cần ít nhất một câu. Hãy nhập số câu mỗi đề.'

  const badPoint = levels.map(level => pointProblem(spec.points[level])).find(problem => problem !== undefined)
  if (badPoint) return `Điểm mỗi câu theo mức chưa hợp lệ. ${badPoint}`

  if (mode === 'draft') return undefined

  if (!ratiosAddUp(spec.ratios)) return 'Ba tỷ lệ Dễ, Trung bình, Khó của mỗi đề phải cộng đúng 100%.'

  const perPaper = perPaperCounts(spec)
  const plan = evaluatePaperPlan(countsOfItems(items), perPaper, spec.count)
  if (!plan.feasible) {
    const lacking = plan.levels
      .filter(level => !level.sufficient)
      .map(level => `${difficultyLabels[level.level]} thiếu ${level.need - level.pool}`)
    return `Đề lớn chưa đủ câu cho mỗi đề: ${lacking.join(', ')}. Hãy thêm câu vào đề lớn hoặc giảm số câu mỗi đề.`
  }

  if (totalScoreOf(perPaper, spec.points) <= 0) return 'Tổng điểm của một đề phải lớn hơn 0. Hãy đặt điểm cho từng mức.'
  return undefined
}

function validateList(
  form: ExamListFormState,
  items: readonly QuestionListItem[],
  mode: SaveMode,
  frozen: boolean,
): ListErrors {
  const errors: ListErrors = {}
  const isDraft = mode === 'draft'
  const title = form.title.trim()

  if (!title) errors.title = 'Vui lòng nhập tên bài kiểm tra.'
  else if (title.length < 5) errors.title = 'Tên bài kiểm tra cần ít nhất 5 ký tự.'

  if (form.durationMinutes < 1) errors.durationMinutes = 'Thời gian làm bài phải lớn hơn 0 phút.'
  else if (form.durationMinutes > 300) errors.durationMinutes = 'Thời gian làm bài tối đa 300 phút.'

  if (!isDraft && !form.openAtLocal) errors.openAtLocal = 'Vui lòng chọn thời gian mở bài.'
  if (!isDraft && !form.closeAtLocal) errors.closeAtLocal = 'Vui lòng chọn thời gian đóng bài.'
  if (form.openAtLocal && form.closeAtLocal && !isCloseAfterOpen(form.openAtLocal, form.closeAtLocal)) {
    errors.closeAtLocal = 'Thời gian đóng bài phải sau thời gian mở bài.'
  }

  const split = isMultiPaper(form.paper)
  const paperError = paperProblem(form.paper, items, mode)
  if (paperError) errors.paper = paperError

  // Chia đề thì điểm câu là điểm của mức (đã kiểm ở `paperProblem`), không có ô điểm riêng từng câu để đánh dấu đỏ.
  if (!split && items.some(item => pointProblem(item.point))) {
    errors.questions = 'Có câu hỏi đang để điểm không hợp lệ. Hãy xem các ô được đánh dấu đỏ.'
  } else if (!isDraft) {
    if (items.length === 0) {
      errors.questions = 'Đề chưa có câu hỏi nào. Hãy thêm câu hỏi từ ngân hàng hoặc bấm "Soạn tự động".'
    } else if (!frozen && hiddenCount(items) > 0) {
      // Đề đã khoá thì danh sách không đổi được nữa, và server vẫn cho lưu tên, mô tả, tuỳ chọn hiện kết quả
      // khi cấu hình đề không đổi: bắt thay câu ở đây chỉ dồn người dùng vào ngõ cụt.
      errors.questions = `Đề có ${hiddenCount(items)} câu đang bị ẩn khỏi ngân hàng. Hãy thay các câu đó bằng câu khác.`
    } else if (!split && totalOfItems(items) <= 0) {
      errors.questions = 'Tổng điểm của đề phải lớn hơn 0. Hãy đặt điểm cho từng câu hỏi.'
    }
  }

  return errors
}

function firstTabWithError(errors: ListErrors): ListTab | undefined {
  const order: ListTab[] = ['config', 'content']
  const withError = new Set(
    (Object.keys(errors) as ListErrorKey[]).filter(key => errors[key]).map(key => tabOfError[key]),
  )
  return order.find(tab => withError.has(tab))
}

/** Danh sách đang soạn có khác danh sách đã lưu không (câu, thứ tự hay điểm). */
function listDiffers(items: readonly QuestionListItem[], saved: readonly { point: number; question: Question }[]) {
  if (items.length !== saved.length) return true
  return items.some((item, index) =>
    item.question.id !== saved[index].question.id || Math.round(item.point * 100) !== Math.round(saved[index].point * 100),
  )
}

/** Dấu vết những gì đang soạn (câu chỉ lấy mã và điểm cho nhẹ): so với dấu vết lúc mở để biết còn thay đổi chưa lưu. */
function snapshotOf(form: ExamListFormState, items: readonly QuestionListItem[], assignment: ClassAssignmentDraft): string {
  return JSON.stringify({
    form,
    items: items.map(item => [item.question.id, Math.round(item.point * 100)]),
    assignment,
  })
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

export default function ExamQuestionListBuilderPage() {
  const { id } = useParams()
  const navigateRaw = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const examId = id === undefined ? undefined : Number(id)
  const isEditing = examId !== undefined

  // Nháp chỉ được đọc một lần lúc gắn trang; hàm xoá chạy ngay sau đó (StrictMode chạy initializer hai lần).
  const [restoredDraft] = useState(() => readExamListDraft(examId ?? null))
  const keepFormEditsRef = useRef(restoredDraft !== undefined)

  // Form "chưa nhập gì" của đề mới: giờ mở mặc định tính một lần để dấu vết so sánh không lệch vì một phút trôi qua.
  const [pristineForm] = useState(createInitialForm)
  const [form, setForm] = useState<ExamListFormState>(() => restoredDraft?.form ?? pristineForm)
  const [items, setItems] = useState<QuestionListItem[]>(() => restoredDraft?.items ?? [])
  const [assignment, setAssignment] = useState<ClassAssignmentDraft>(
    () => restoredDraft?.assignment ?? createEmptyClassAssignment(),
  )
  // Dấu vết "sạch": form trống của đề mới, hoặc đề đã lưu sau khi nạp xong. Đề cũ chưa nạp xong thì chưa có gì để so (null).
  const [cleanSnapshot, setCleanSnapshot] = useState<string | null>(() => (isEditing
    ? null
    : snapshotOf(pristineForm, [], createEmptyClassAssignment())))
  const [errors, setErrors] = useState<ListErrors>({})
  const [activeTab, setActiveTab] = useState<ListTab>('config')
  const [savingMode, setSavingMode] = useState<SaveMode | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  // Lần "Soạn tự động" gần nhất rút không đủ số câu yêu cầu. Toast mờ sau vài giây nên dễ bị bỏ sót, khiến giáo viên tưởng đề đã
  // đủ; khung này nằm lại trên danh sách cho tới khi bấm "Đã hiểu" hoặc soạn lần khác.
  const [composeShortfall, setComposeShortfall] = useState<ComposeShortfall | null>(null)
  // Các câu vừa được thêm (chọn từ ngân hàng hay soạn tự động): sáng viền vài giây rồi tắt.
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(() => new Set())
  const freshTimerRef = useRef<number | undefined>(undefined)

  const examQuery = useAsync<Exam | null>(
    () => (examId === undefined ? Promise.resolve(null) : getExam(examId)),
    [examId ?? 0],
  )
  const questionsQuery = useAsync(
    () => (examId === undefined ? Promise.resolve([]) : getExamQuestions(examId)),
    [examId ?? 0],
  )
  const groupsQuery = useAsync(() => listOpenGroups(), [])

  const loadedExam = examQuery.data
  const savedItems = questionsQuery.data

  useEffect(() => {
    clearExamListDraft(examId ?? null)
  }, [examId])

  // Nạp đề đã lưu vào form. Những gì giáo viên đã soạn mà chưa lưu thắng dữ liệu nạp về, trừ phần server đã
  // khoá: gửi lại phần đó thì lần lưu nào cũng nhận 409 mà ô đã tắt nên giáo viên không tự chỉnh về được.
  useEffect(() => {
    if (!loadedExam || !savedItems) return

    const savedAsItems = savedItems.map(row => ({ question: row.question, point: row.point }))

    const serverForm: ExamListFormState = {
      title: loadedExam.title,
      description: loadedExam.description,
      durationMinutes: loadedExam.durationMinutes,
      shuffleQuestions: loadedExam.shuffleQuestions,
      shuffleAnswers: loadedExam.shuffleAnswers,
      showResultAfterSubmit: loadedExam.showResultAfterSubmit,
      openAtLocal: toDateTimeLocalValue(loadedExam.openAt),
      closeAtLocal: toDateTimeLocalValue(loadedExam.closeAt),
      // Đề chưa khoá thì điểm theo mức tính lại bằng cách tự chia hiện hành (đề lưu từ bản cũ có thể mang điểm nhập tay);
      // đề đã khoá giữ đúng điểm đã lưu, vì server không cho đổi.
      paper: loadedExam.blueprintFrozen || loadedExam.paperCount <= 1
        ? paperSpecOfExam(loadedExam)
        : withAutoPoints(paperSpecOfExam(loadedExam)),
    }
    // Mốc "đã lưu" để biết còn thay đổi chưa lưu — kể cả khi form đang giữ bản nháp khôi phục khác với đề trên server.
    setCleanSnapshot(snapshotOf(serverForm, savedAsItems, createEmptyClassAssignment()))

    if (keepFormEditsRef.current) {
      if (loadedExam.blueprintFrozen) {
        setItems(savedAsItems)
        setForm(current => ({
          ...current,
          durationMinutes: loadedExam.durationMinutes,
          shuffleQuestions: loadedExam.shuffleQuestions,
          shuffleAnswers: loadedExam.shuffleAnswers,
          paper: paperSpecOfExam(loadedExam),
        }))
      }
      return
    }

    setForm(serverForm)
    setItems(savedAsItems)
  }, [loadedExam, savedItems])

  const hasUnsavedChanges = cleanSnapshot !== null && snapshotOf(form, items, assignment) !== cleanSnapshot
  const guard = useUnsavedChangesGuard(hasUnsavedChanges)
  // Mọi lần chính trang này chủ động chuyển đi (lưu xong, sang soạn câu hỏi, sang bản sao) không bị hỏi "thoát mà chưa lưu".
  const navigate = (to: string) => guard.leaveWithoutAsking(() => navigateRaw(to))

  const isFrozen = isEditing && loadedExam?.blueprintFrozen === true
  const isScheduleLocked = isEditing && loadedExam?.scheduleLocked === true
  const canSaveDraft = !isEditing || loadedExam?.lifecycle === 'draft'
  const canAssignHere = canSaveDraft
  const isSaving = savingMode !== null

  const spec = form.paper
  const isSplit = isMultiPaper(spec)
  // Chia đề thì điểm câu là điểm của mức (đặt ở tab Cấu hình); mọi con số hiện ra và gửi đi đều đọc từ danh sách này.
  const listItems = useMemo(() => withLevelPoints(items, spec), [items, spec])
  const counts = useMemo(() => countsOfItems(listItems), [listItems])
  const levelPoints = useMemo(() => pointsByLevel(listItems), [listItems])
  const perPaper = useMemo(() => perPaperCounts(spec), [spec])
  // Tổng điểm của MỘT đề: danh sách đề lớn có nhiều câu hơn nên tổng cả danh sách không còn là con số để canh.
  const total = useMemo(
    () => (isSplit ? paperTotalScore(spec) : totalOfItems(listItems)),
    [isSplit, spec, listItems],
  )
  const scoreGap = describeScoreGap(total)
  const hidden = hiddenCount(items)
  const existingIds = useMemo(() => new Set(items.map(item => item.question.id)), [items])
  // Đề nhiều chương: mỗi chương bao nhiêu câu, theo thứ tự chương xuất hiện trong đề.
  const topicBreakdown = useMemo(() => {
    const byTopic = new Map<string, number>()
    items.forEach(item => {
      const topic = item.question.topic.trim()
      byTopic.set(topic, (byTopic.get(topic) ?? 0) + 1)
    })
    return Array.from(byTopic, ([topic, count]) => ({ topic, count }))
  }, [items])

  const availableGroups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const chosenGroupIds = useMemo(
    () => (canAssignHere ? effectiveGroupIds(assignment, availableGroups.map(group => group.id)) : []),
    [canAssignHere, assignment, availableGroups],
  )
  const assignmentProblems = useMemo(
    () => classAssignmentProblems(
      assignment,
      chosenGroupIds,
      groupId => availableGroups.find(group => group.id === groupId)?.name ?? `Lớp ${groupId}`,
      form.durationMinutes,
    ),
    [assignment, chosenGroupIds, availableGroups, form.durationMinutes],
  )

  // Chỉ cảnh báo: nháp được miễn, và đề đã xuất bản mà chỉ đổi tên hay lịch thì không đụng bộ câu nào.
  const scoreNeedsConfirmation = !(
    loadedExam && loadedExam.lifecycle !== 'draft' && savedItems && !listDiffers(listItems, savedItems)
    && samePaperSpec(spec, paperSpecOfExam(loadedExam))
  )

  const scheduleWindowMinutes = minutesBetween(form.openAtLocal, form.closeAtLocal)
  const closeAtDate = parseDateTime(form.closeAtLocal)
  const isCloseInPast = closeAtDate !== null && closeAtDate.getTime() <= Date.now()
  const isDurationTooLong = scheduleWindowMinutes > 0 && form.durationMinutes > scheduleWindowMinutes

  const visibleTabs: { id: ListTab; label: string; icon: LucideIcon }[] = [
    { id: 'config', label: 'Cấu hình', icon: Settings },
    { id: 'content', label: 'Nội dung', icon: ListChecks },
    ...(canAssignHere ? [{ id: 'assign' as const, label: 'Giao bài', icon: Send }] : []),
  ]

  const clearError = (key: ListErrorKey) => {
    setErrors(current => {
      if (current[key] === undefined) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const updateField = <Key extends keyof ExamListFormState>(key: Key, value: ExamListFormState[Key]) => {
    setForm(current => ({ ...current, [key]: value }))
    clearError(key)
  }

  // ── Thao tác trên danh sách câu ──────────────────────────────────────────────────────────────────
  // Thêm hay bớt câu không đụng tới điểm của các câu khác: điểm chỉ đổi khi giáo viên sửa một ô, hoặc bấm
  // "Chia đều điểm" / "Chia theo mức độ". Câu mới vào đề mang điểm mặc định của nó trong ngân hàng.
  const withEvenPoints = (next: QuestionListItem[]): QuestionListItem[] => {
    const split = splitEvenly(next.length)
    return next.map((item, index) => ({ ...item, point: split[index] }))
  }

  /**
   * Thêm câu vào cuối đề; trả về số câu thật sự được thêm (bỏ câu đã có). Câu mới sáng viền một nhịp; `scrollToNew` đưa câu mới
   * đầu tiên vào tầm nhìn — bỏ khi trên đầu danh sách còn khung báo thiếu câu, kẻo cuộn đi làm giáo viên không đọc được nó.
   */
  const addQuestions = (questions: Question[], scrollToNew = true) => {
    const fresh = questions.filter(question => !existingIds.has(question.id))
    if (fresh.length === 0) return 0

    setItems(current => [
      ...current,
      ...fresh.map(question => ({ question, point: initialPointOf(question) })),
    ])
    clearError('questions')

    setFreshIds(new Set(fresh.map(question => question.id)))
    window.clearTimeout(freshTimerRef.current)
    freshTimerRef.current = window.setTimeout(() => setFreshIds(new Set()), 2600)

    if (scrollToNew) {
      const firstId = fresh[0].id
      window.setTimeout(() => {
        document.getElementById(`exam-question-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 120)
    }
    return fresh.length
  }

  const removeItem = (index: number) => {
    setItems(current => current.filter((_, position) => position !== index))
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems(current => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current

      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const changePoint = (index: number, rawValue: string) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue)
    setItems(current => current.map((item, position) =>
      position === index ? { ...item, point: Number.isFinite(parsed) ? parsed : 0 } : item,
    ))
    clearError('questions')
  }

  const applyEvenSplit = () => {
    setItems(current => withEvenPoints(current))
    clearError('questions')
  }

  const applyDifficultySplit = () => {
    setItems(current => {
      const split = splitByDifficulty(current)
      if (!split) return current
      return current.map((item, index) => ({ ...item, point: split[index] }))
    })
    clearError('questions')
  }

  const handleComposed = (result: ComposeQuestionsResult) => {
    setComposeOpen(false)
    const missingBefore = levels.reduce((sum, level) => sum + result.missing[level], 0)
    const added = addQuestions(result.questions, missingBefore === 0)

    const shortage = levels
      .filter(level => result.missing[level] > 0)
      .map(level => `${result.missing[level]} câu ${difficultyLabels[level]}`)

    // Câu bị bỏ vì lớp đã nhận: nói ra, nếu không giáo viên thấy "thiếu câu" mà không hiểu ngân hàng còn nhiều câu cùng chương.
    const skipped = result.skippedAlreadyAssigned ?? 0
    const skippedNote = skipped > 0 ? ` Đã bỏ ${skipped} câu mà các lớp đã chọn đã nhận ở đề trước.` : ''

    // Thiếu câu thì để lại một khung vàng ngay trên danh sách (không tự mất như toast); đủ câu thì xoá khung của lần trước.
    const missingTotal = levels.reduce((sum, level) => sum + result.missing[level], 0)
    setComposeShortfall(missingTotal > 0
      ? { missing: result.missing, found: result.questions.length, skipped }
      : null)

    if (added === 0) {
      toast.info(`Không rút được câu nào mới. Chương này có thể đã hết câu phù hợp, hoặc các câu đều đã có trong đề.${skippedNote}`)
    } else if (shortage.length > 0) {
      toast.error(`Chưa đủ số câu bạn yêu cầu: đã thêm ${added} câu, còn thiếu ${shortage.join(', ')}.${skippedNote}`)
    } else {
      toast.success(`Đã thêm ${added} câu vào đề. Hãy duyệt lại trước khi lưu.${skippedNote}`)
    }
  }

  const handlePicked = (questions: Question[]) => {
    setPickerOpen(false)
    const added = addQuestions(questions)
    if (added > 0) toast.success(`Đã thêm ${added} câu vào đề.`)
  }

  // Rời trang để soạn thêm câu hỏi thì phải giữ nháp lại, nếu không toàn bộ đề đang soạn mất.
  const goToQuestionEditor = () => {
    saveExamListDraft({
      examId: examId ?? null, form, items, assignment, savedAt: Date.now(),
    })

    const params = new URLSearchParams({ 'quay-lai': 'de' })
    if (examId !== undefined && Number.isFinite(examId)) params.set('de', String(examId))
    navigate(`/giao-vien/cau-hoi/tao?${params.toString()}`)
  }

  // Lối ra khi đề đã khoá: tạo bản nháp cùng danh sách rồi sang sửa ngay bản đó.
  const handleDuplicate = async () => {
    if (!loadedExam) return
    const source = loadedExam
    const outcome: { copy?: Exam } = {}
    const confirmed = await confirm({
      ...examDuplicateConfirmCopy(source, true),
      onConfirm: async () => {
        outcome.copy = await duplicateExam(source.id)
      },
    })
    const copy = outcome.copy
    if (!confirmed || !copy) return

    toast.success(`Đã tạo bản sao "${copy.title}". Bản sao đang là bản nháp, chưa giao cho ai.`)
    keepFormEditsRef.current = false
    setErrors({})
    navigate(`/giao-vien/bai-kiem-tra/${copy.id}/sua`)
  }

  // ── Lưu ───────────────────────────────────────────────────────────────────────────────────────────
  const handleSave = async (mode: SaveMode) => {
    const nextErrors = validateList(form, items, mode, isFrozen)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const target = firstTabWithError(nextErrors)
      if (target) setActiveTab(target)
      toast.error(nextErrors.questions ?? nextErrors.paper ?? 'Vui lòng kiểm tra lại các trường được đánh dấu đỏ.')
      return
    }

    if (canAssignHere && mode === 'publish' && assignment.groupIds.length > 0 && groupsQuery.data === undefined) {
      toast.error(
        groupsQuery.error
          ? 'Không tải được danh sách lớp nên chưa giao được. Hãy tải lại danh sách ở tab Giao bài.'
          : 'Đang tải danh sách lớp, hãy bấm lưu lại sau giây lát.',
      )
      return
    }

    // Khung giờ riêng của lớp sai thì chặn trước khi đề được lưu: để server từ chối ở bước giao thì đề đã nằm
    // trong hệ thống mà lớp vẫn chưa nhận bài.
    const assignsNow = mode === 'publish' && chosenGroupIds.length > 0
    if (assignsNow && assignmentProblems.length > 0) {
      setActiveTab('assign')
      toast.error('Khung giờ riêng của lớp chưa hợp lệ. Hãy xem lại tab Giao bài.')
      return
    }

    // Lịch không đổi thì gửi lại nguyên giá trị đã lưu (ô nhập giờ chỉ tới phút): một đề đã khoá lịch mà bị coi
    // là "đổi giờ" chỉ vì mất vài giây là bị từ chối khi giáo viên chỉ muốn sửa tên.
    const keepSavedSchedule = loadedExam !== null && loadedExam !== undefined
      && form.openAtLocal === toDateTimeLocalValue(loadedExam.openAt)
      && form.closeAtLocal === toDateTimeLocalValue(loadedExam.closeAt)

    const payload: ExamPayload = {
      title: form.title,
      description: form.description,
      durationMinutes: form.durationMinutes,
      shuffleQuestions: form.shuffleQuestions,
      shuffleAnswers: form.shuffleAnswers,
      showResultAfterSubmit: form.showResultAfterSubmit,
      openAt: keepSavedSchedule ? loadedExam.openAt : toServiceDateTime(form.openAtLocal),
      closeAt: keepSavedSchedule ? loadedExam.closeAt : toServiceDateTime(form.closeAtLocal),
      questions: listItems.map(item => ({ questionId: item.question.id, point: item.point })),
      // Luôn gửi: đưa đề đang chia về một đề cũng phải nói rõ là 1.
      paperCount: spec.count,
      // Chia đề thì số câu và ba tỷ lệ là của MỘT đề nhỏ; đề một đề để server tự dẫn xuất từ danh sách.
      ...(isSplit
        ? {
          totalQuestions: spec.questionsPerPaper,
          easyPercentage: clampPercentage(spec.ratios.easy),
          mediumPercentage: clampPercentage(spec.ratios.medium),
          hardPercentage: clampPercentage(spec.ratios.hard),
          // Điểm cộng thêm để mỗi đề nhỏ cộng đúng 10; server tự chọn các câu nhận.
          paperBonusUnits: spec.bonusUnits,
        }
        : {}),
      // Bỏ trống nghĩa là đề CÓ HIỆU LỰC THẬT, nên "Lưu nháp" bắt buộc phải gửi cờ này.
      lifecycle: mode === 'draft' ? 'draft' : undefined,
    }

    const outcome: { saved?: Exam; final?: Exam; conflict?: string; assigned?: AssignExamResult } = {}

    const persist = async () => {
      // Thử lại trong hộp xác nhận sau khi đề đã lưu mà bước sau hỏng thì không được tạo thêm một đề nữa.
      if (!outcome.saved) {
        try {
          outcome.saved = examId === undefined ? await createExam(payload) : await updateExam(examId, payload)
        } catch (caught) {
          // 409 khi sửa: đề vừa đổi trạng thái ở server (thường có em vừa bắt đầu làm nên bị khoá). Đóng hộp,
          // nạp lại đề để hiện dải khoá, giữ tên và lịch vừa gõ.
          if (examId === undefined || !isConflictError(caught)) throw caught
          outcome.conflict = toErrorMessage(caught, 'Đề vừa thay đổi ở phía máy chủ nên chưa lưu được.')
          keepFormEditsRef.current = true
          examQuery.reload()
          questionsQuery.reload()
          return
        }
      }
      const saved = outcome.saved

      outcome.final = mode !== 'draft' && saved.lifecycle === 'draft' ? await publishExam(saved.id) : saved

      // Bước giao đi sau cùng và có thể hỏng riêng. Đề đã xuất bản rồi nên lần thử lại chỉ chạy đúng bước này.
      if (assignsNow && outcome.final && !outcome.assigned) {
        outcome.assigned = await assignExam(outcome.final.id, {
          groupIds: [],
          classes: toAssignClassTargets(assignment, chosenGroupIds),
          notify: true,
        })
      }
    }

    const publishSummary = {
      title: form.title,
      totalQuestions: isSplit ? spec.questionsPerPaper : items.length,
      paperCount: spec.count,
      durationMinutes: form.durationMinutes,
      openAt: formatDateTime(form.openAtLocal),
      closeAt: formatDateTime(form.closeAtLocal),
    }

    const assignTargets = chosenGroupIds.map(groupId => {
      const group = availableGroups.find(item => item.id === groupId)
      const window = assignment.windows[groupId]
      return {
        name: group?.name ?? `Lớp ${groupId}`,
        studentCount: group?.studentCount ?? 0,
        windowText: window?.enabled
          ? `${formatDateTime(window.openAtLocal)} – ${formatDateTime(window.closeAtLocal)}`
          : undefined,
      }
    })

    const papersWillChange = savedItems !== undefined && (
      listDiffers(listItems, savedItems)
      || (loadedExam !== null && loadedExam !== undefined && !samePaperSpec(spec, paperSpecOfExam(loadedExam)))
      || (loadedExam !== null && loadedExam !== undefined
        && (form.shuffleQuestions !== loadedExam.shuffleQuestions || form.shuffleAnswers !== loadedExam.shuffleAnswers))
    )

    const confirmCopy =
      mode === 'draft'
        ? undefined
        : loadedExam && loadedExam.lifecycle !== 'draft'
          ? publishedExamEditConfirmCopy(loadedExam, false, papersWillChange)
          : assignsNow
            ? examPublishAndAssignConfirmCopy(publishSummary, assignTargets)
            : examPublishConfirmCopy(publishSummary, false)

    // Chốt một đề có tổng khác 10 điểm: nói thẳng con số và hỏi lại, cùng hộp với bước xuất bản hay lưu.
    const scoreWarning = mode !== 'draft' && scoreNeedsConfirmation && scoreGap !== null

    if (confirmCopy) {
      // Hộp "xuất bản và giao bài" đã tự liệt kê các lớp; ở hộp khác (lưu đề đã xuất bản kèm giao thêm) thì thêm khối "Giao cho".
      const copyListsTargets = assignsNow && !(loadedExam && loadedExam.lifecycle !== 'draft')
      const classDetails = assignsNow && !copyListsTargets ? examAssignTargetsDetails(assignTargets) : undefined

      const confirmed = await confirm({
        ...confirmCopy,
        details: (
          <div className="space-y-3">
            {confirmCopy.details}
            {classDetails}
            {scoreWarning && (
              <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-800">
                {scoreGap} Học sinh sẽ làm bài tối đa {formatNumber(total)} điểm. Muốn đủ {EXAM_TOTAL_SCORE}, quay lại
                chỉnh điểm từng câu.
              </p>
            )}
          </div>
        ),
        ...(scoreWarning
          ? {
            confirmLabel: `Vẫn ${confirmCopy.confirmLabel.charAt(0).toLowerCase()}${confirmCopy.confirmLabel.slice(1)}`,
            cancelLabel: 'Quay lại chỉnh',
            enterConfirms: false,
          }
          : {}),
        onConfirm: persist,
      })

      if (!confirmed) {
        // Đề đã lưu và xuất bản nhưng bước giao hỏng rồi giáo viên đóng hộp: không để họ ở lại form tạo mới
        // (bấm Lưu lần nữa sẽ tạo đề thứ hai). Đưa tới đề vừa lưu, ngay tab Giao bài để giao lại.
        if (assignsNow && outcome.final && !outcome.assigned) {
          toast.info('Đã lưu bài kiểm tra nhưng chưa giao được cho lớp. Chọn lớp và giao lại ở tab Giao bài.')
          navigate(`/giao-vien/bai-kiem-tra/${outcome.final.id}?tab=giao-bai`)
          return
        }
        if (scoreWarning) setActiveTab('content')
        return
      }
    } else {
      setSavingMode(mode)
      try {
        await persist()
      } catch (caught) {
        toast.error(toErrorMessage(caught, 'Không lưu được bài kiểm tra. Vui lòng thử lại.'))
        return
      } finally {
        setSavingMode(null)
      }
    }

    if (outcome.conflict) {
      toast.error(`Chưa lưu được. ${outcome.conflict}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const published = outcome.final
    if (!published) return

    if (mode === 'draft') {
      toast.success('Đã lưu bản nháp. Đề chưa phát cho học sinh.')
    } else if (outcome.assigned) {
      const given = outcome.assigned
      const skipped = given.skippedAlreadyAssigned + given.skippedLocked + given.skippedRetired
        + given.skippedOutOfScope
      toast.success(
        `${isEditing ? 'Đã lưu bài kiểm tra' : 'Đã tạo bài kiểm tra'} và giao cho ${given.assignedCount} học sinh.`
        + (skipped > 0 ? ` Bỏ qua ${skipped} em (tài khoản bị khoá, chờ xoá hoặc ngoài phạm vi của bạn).` : '')
        + (given.skippedOutOfScopeGroups > 0
          ? ` ${given.skippedOutOfScopeGroups} lớp không thuộc quyền của bạn nên chưa giao.`
          : ''),
      )
    } else {
      toast.success(isEditing ? 'Đã cập nhật bài kiểm tra.' : 'Đã tạo bài kiểm tra thành công.')
    }

    navigate(`/giao-vien/bai-kiem-tra/${published.id}`)
  }

  // ── Dựng trang ────────────────────────────────────────────────────────────────────────────────────
  const pageTitle = isEditing ? 'Sửa bài kiểm tra' : 'Tạo bài kiểm tra'
  const pageSubtitle = isEditing
    ? loadedExam?.title ?? 'Đang tải bài kiểm tra'
    : 'Chọn câu hỏi, duyệt lại rồi mới lưu. Bấm "Soạn tự động" nếu muốn hệ thống rút giúp.'

  const hasValidExamId = examId !== undefined && Number.isFinite(examId)
  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to={hasValidExamId ? `/giao-vien/bai-kiem-tra/${examId}` : '/giao-vien/bai-kiem-tra'}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} />
        {hasValidExamId ? 'Quay lại chi tiết bài kiểm tra' : 'Quay lại danh sách bài kiểm tra'}
      </NavLink>
    </div>
  )

  if (isEditing && (examQuery.error || questionsQuery.error)) {
    return (
      <TeacherLayout pageTitle={pageTitle} pageSubtitle="Không tải được bài kiểm tra" compactContent headerTools={backLink}>
        <ErrorState
          message={examQuery.error ?? questionsQuery.error ?? 'Không tải được bài kiểm tra.'}
          onRetry={() => {
            examQuery.reload()
            questionsQuery.reload()
          }}
        />
      </TeacherLayout>
    )
  }

  if (isEditing && (!loadedExam || !savedItems)) {
    return (
      <TeacherLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle} compactContent headerTools={backLink}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="space-y-6">
            {[0, 1, 2].map(block => (
              <div key={block} className={`${cardClass} p-6 space-y-4`}>
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-11 w-full rounded-xl" />
                <SkeletonBlock className="h-24 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <SkeletonBlock className="h-72 rounded-2xl" />
        </div>
      </TeacherLayout>
    )
  }

  const totalTone = scoreGap === null
    ? 'from-emerald-50 to-teal-50 text-emerald-700'
    : 'from-amber-50 to-orange-50 text-amber-700'

  const submitLabel = chosenGroupIds.length > 0
    ? `Lưu và giao cho ${chosenGroupIds.length} lớp`
    : canSaveDraft ? 'Lưu bài kiểm tra' : 'Lưu thay đổi'

  const summaryCard = (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <Scale size={18} className="text-indigo-600" />
        <h2 className="text-base font-bold text-slate-800">Tổng quan đề</h2>
      </div>

      {/* Hai con số giáo viên canh nhiều nhất — tổng điểm và số câu — cùng một cỡ chữ, cạnh nhau. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className={`rounded-xl px-4 py-3 bg-gradient-to-br ${totalTone}`}>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {isSplit ? 'Điểm mỗi đề' : 'Tổng điểm'}
          </p>
          <p className="text-3xl font-bold mt-0.5 leading-tight">
            <span key={formatNumber(total)} className="inline-block animate-pop">{formatNumber(total)}</span>
            <span className="text-lg font-semibold opacity-70"> / {EXAM_TOTAL_SCORE}</span>
          </p>
          <p className="text-xs font-semibold mt-1">
            {items.length === 0 ? 'Chưa có câu nào' : describeScoreDelta(total) ?? 'Đã đủ điểm'}
          </p>
        </div>

        <div className="rounded-xl px-4 py-3 bg-indigo-50 text-indigo-700 text-center min-w-[5.5rem]">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{isSplit ? 'Mỗi đề' : 'Số câu'}</p>
          <p className="text-3xl font-bold mt-0.5 leading-tight">
            <span key={isSplit ? spec.questionsPerPaper : items.length} className="inline-block animate-pop">
              {isSplit ? spec.questionsPerPaper : items.length}
            </span>
          </p>
          <p className="text-xs font-semibold mt-1">câu hỏi</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {levels.map(level => (
          <div key={level} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: levelColor[level] }} />
              {difficultyLabels[level]}
            </span>
            <span className="font-semibold text-slate-700">
              {isSplit ? perPaper[level] : counts[level]} câu
              <span className="text-slate-400 font-medium">
                {isSplit
                  ? ` · đề lớn ${counts[level]}`
                  : ` · ${formatNumber(levelPoints[level])} điểm`}
              </span>
            </span>
          </div>
        ))}
      </div>

      {isSplit && (
        <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
          Chia {items.length} câu của đề lớn thành {spec.count} đề cho mỗi lớp.
        </p>
      )}
    </div>
  )

  return (
    <TeacherLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle} compactContent headerTools={backLink}>
      <form
        onSubmit={event => {
          event.preventDefault()
          void handleSave('publish')
        }}
        // Enter trong một ô nhập (nhất là ô điểm của từng câu) không được ngầm "xuất bản": hộp xác nhận mở ra
        // và Enter lần nữa là chốt đề. Xuất bản chỉ đi qua nút bấm.
        onKeyDown={event => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
        }}
        className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start animate-fade-in-up"
      >
        <div className="space-y-6 min-w-0">
          {isFrozen && loadedExam && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <Lock size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">Câu hỏi và điểm đã khoá</p>
                <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
                  {loadedExam.startedCount} học sinh đã bắt đầu làm nên không đổi được câu hỏi, điểm, thời gian
                  làm bài hay tuỳ chọn trộn. Tên, mô tả và tuỳ chọn hiện kết quả vẫn sửa được. Muốn dùng bộ câu
                  khác, hãy nhân bản đề.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDuplicate()}
                disabled={isSaving}
                className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-800 bg-white border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <Copy size={15} /> Nhân bản đề
              </button>
            </div>
          )}

          <SlidingSegments activeKey={activeTab} className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 w-full sm:w-fit">
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id
              const hasError = tab.id === 'assign'
                ? chosenGroupIds.length > 0 && assignmentProblems.length > 0
                : (Object.keys(errors) as ListErrorKey[]).some(key => errors[key] && tabOfError[key] === tab.id)

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  data-tab-active={isActive}
                  className={`relative z-10 inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <tab.icon size={16} className="flex-shrink-0" aria-hidden="true" />
                  {tab.label}
                  {tab.id === 'content' && items.length > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {items.length}
                    </span>
                  )}
                  {hasError && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-red-500"
                      title="Tab này còn ô chưa hợp lệ"
                      aria-label="còn ô chưa hợp lệ"
                    />
                  )}
                </button>
              )
            })}
          </SlidingSegments>

          {activeTab === 'config' && (
            <div className="space-y-6 animate-tab-in">
              <section className={`${cardClass} p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-800">Thông tin chung</h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="exam-title" className={labelClass}>
                      Tên bài kiểm tra <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="exam-title"
                      value={form.title}
                      onChange={event => updateField('title', event.target.value)}
                      className={fieldClass(errors.title)}
                      placeholder="Ví dụ: Kiểm tra 15 phút - Điện học"
                    />
                    <FieldError message={errors.title} />
                  </div>

                  <div>
                    <label htmlFor="exam-description" className={labelClass}>Mô tả</label>
                    <textarea
                      id="exam-description"
                      rows={2}
                      value={form.description}
                      onChange={event => updateField('description', event.target.value)}
                      className={`${inputNormalClass} resize-y`}
                      placeholder="Mô tả phạm vi kiến thức và lưu ý cho học sinh"
                    />
                  </div>
                </div>
              </section>

              {/* Chia đề nằm ngay dưới thông tin chung: đây là quyết định đầu tiên về cách ra đề, không phải một tuỳ chọn
                  chôn ở cuối trang. */}
              <ExamPaperSplitPanel
                spec={spec}
                items={items}
                locked={isFrozen}
                error={errors.paper}
                onChange={next => updateField('paper', next)}
                onOpenContent={() => setActiveTab('content')}
              />

              {/* Lịch mở bài và thiết lập bài làm gộp một khối, hai cột: giờ mở và giờ đóng xếp trên dưới ở bên trái,
                  thời lượng cùng các tuỳ chọn xếp chồng ở bên phải. */}
              <section className={`${cardClass} p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock size={16} className="text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-800">Lịch mở bài và thiết lập bài làm</h2>
                </div>

                {/* Hai cột: bên trái giờ mở, giờ đóng và thời lượng làm bài xếp trên dưới; bên phải các tuỳ chọn xếp chồng. */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-x-8 gap-y-4">
                  <div className="space-y-3 min-w-0">
                    <div>
                      <label htmlFor="exam-open-at" className={labelClass}>
                        Mở bài lúc <span className="text-red-500">*</span>
                      </label>
                      <DateTimeInput
                        id="exam-open-at"
                        value={form.openAtLocal}
                        onChange={value => updateField('openAtLocal', value)}
                        disabled={isScheduleLocked}
                        className={`${fieldClass(errors.openAtLocal)} ${lockedFieldClass}`}
                      />
                      <FieldError message={errors.openAtLocal} />
                    </div>

                    <div>
                      <label htmlFor="exam-close-at" className={labelClass}>
                        Đóng bài lúc <span className="text-red-500">*</span>
                      </label>
                      <DateTimeInput
                        id="exam-close-at"
                        value={form.closeAtLocal}
                        onChange={value => updateField('closeAtLocal', value)}
                        disabled={isScheduleLocked}
                        className={`${fieldClass(errors.closeAtLocal)} ${lockedFieldClass}`}
                      />
                      <FieldError message={errors.closeAtLocal} />
                    </div>

                    <div className="max-w-[10rem]">
                      <label htmlFor="exam-duration" className={labelClass}>
                        Làm bài (phút) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="exam-duration"
                        type="number"
                        min={1}
                        max={300}
                        value={form.durationMinutes}
                        onChange={event => updateField('durationMinutes', Number(event.target.value) || 0)}
                        disabled={isFrozen}
                        className={`${fieldClass(errors.durationMinutes)} ${lockedFieldClass}`}
                      />
                      <FieldError message={errors.durationMinutes} />
                    </div>
                  </div>

                  <div className="space-y-3 min-w-0">
                    <div className="space-y-2.5 pt-6">
                      <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.shuffleQuestions}
                          onChange={event => updateField('shuffleQuestions', event.target.checked)}
                          disabled={isFrozen}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        Trộn thứ tự câu hỏi
                      </label>
                      <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.shuffleAnswers}
                          onChange={event => updateField('shuffleAnswers', event.target.checked)}
                          disabled={isFrozen}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        Trộn thứ tự đáp án
                      </label>
                      <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.showResultAfterSubmit}
                          onChange={event => updateField('showResultAfterSubmit', event.target.checked)}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        Hiện kết quả sau khi nộp
                      </label>
                    </div>

                    {!form.showResultAfterSubmit && (
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Đang tắt: học sinh không thấy điểm và đáp án. Sau khi hết giờ, bấm "Mở đáp án" ở trang chi tiết
                        của bài để mở.
                      </p>
                    )}
                  </div>
                </div>

                {isScheduleLocked && loadedExam && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 leading-relaxed">
                    <Lock size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      {describeScheduleLock('Lịch chung của đề', loadedExam.openAt)} Hết giờ đóng bài mới đổi lại
                      được. Cần dời gấp thì nhân bản đề rồi giao lại.
                    </span>
                  </p>
                )}

                {!isScheduleLocked && isEditing && (loadedExam?.assignedCount ?? 0) > 0
                  && opensWithinLockWindow(form.openAtLocal, form.closeAtLocal) && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 leading-relaxed">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{SCHEDULE_LOCK_WARNING}</span>
                  </p>
                )}

                {scheduleWindowMinutes > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Học sinh có thể vào làm từ{' '}
                    <strong className="text-slate-700 font-semibold">{formatDateTime(form.openAtLocal)}</strong>{' '}
                    đến <strong className="text-slate-700 font-semibold">{formatDateTime(form.closeAtLocal)}</strong>.
                  </p>
                )}

                {isDurationTooLong && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 leading-relaxed">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Thời gian làm bài ({form.durationMinutes} phút) đang dài hơn cửa sổ mở bài, học sinh vào
                      muộn sẽ không kịp hoàn thành.
                    </span>
                  </p>
                )}

                {isCloseInPast && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 leading-relaxed">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Thời gian đóng bài đã qua nên học sinh không vào làm được. Hãy dời giờ đóng sang sau thời
                      điểm hiện tại.
                    </span>
                  </p>
                )}
              </section>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6 animate-tab-in">
              <section className="space-y-4">
                <div className={`${cardClass} p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <ListChecks size={20} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-800">
                          {isSplit ? 'Câu hỏi của đề lớn' : 'Câu hỏi của đề'}
                        </h2>
                        <p className="text-sm text-slate-500">
                          {items.length} câu
                          {items.length > 0 && (
                            <>
                              {' · '}
                              {levels.map(level => `${difficultyLabels[level]} ${counts[level]}`).join(' · ')}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Từ cỡ xl cột bên đã có tổng điểm và dính theo khi cuộn; hiện thêm ở đây là hai con số giống
                        hệt nhau trên cùng một màn hình. Hẹp hơn thì cột bên rơi xuống cuối trang nên cần ở đây. */}
                    <div className={`xl:hidden rounded-2xl px-5 py-2.5 bg-gradient-to-br ${totalTone} text-right`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                        {isSplit ? 'Điểm mỗi đề' : 'Tổng điểm'}
                      </p>
                      <p className="text-2xl font-bold leading-tight">
                        {formatNumber(total)}
                        <span className="text-base font-semibold opacity-70"> / {EXAM_TOTAL_SCORE}</span>
                      </p>
                    </div>
                  </div>

                  {composeShortfall && (
                    <ComposeShortfallNotice shortfall={composeShortfall} onDismiss={() => setComposeShortfall(null)} />
                  )}

                  {topicBreakdown.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Số câu theo chương">
                      <span className="text-xs font-semibold text-slate-500">Theo chương:</span>
                      {topicBreakdown.map(entry => (
                        <span
                          key={entry.topic || '(không có)'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
                        >
                          {entry.topic || 'Chưa có chủ đề'}
                          <span className="text-indigo-600">{entry.count} câu</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {isSplit && (
                    <p className="mt-3 text-sm text-indigo-700 bg-indigo-50 rounded-xl px-4 py-2.5">
                      Danh sách này là đề lớn: mỗi lớp nhận {spec.count} đề nhỏ, mỗi đề {spec.questionsPerPaper} câu rút từ
                      đây. Số câu, tỷ lệ và điểm mỗi mức chỉnh ở tab Cấu hình, mục Chia đề.
                    </p>
                  )}

                  {items.length > 0 && scoreGap && (
                    <p className="mt-3 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-2.5">
                      {scoreGap}
                      {!isSplit && items.length > 1 ? ' Bấm “Chia đều điểm” hoặc sửa từng câu.' : ''}
                      {' '}Vẫn lưu được; hệ thống sẽ hỏi xác nhận lúc bạn chốt đề.
                    </p>
                  )}

                  {!isFrozen && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                        style={{ background: primaryGradient }}
                      >
                        <Plus size={16} /> Thêm từ ngân hàng
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        <Wand2 size={16} /> Soạn tự động
                      </button>
                      <button
                        type="button"
                        onClick={goToQuestionEditor}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        Tạo câu hỏi mới
                      </button>

                      {!isSplit && items.length > 1 && (
                        <div className="flex items-center gap-2 sm:ml-auto">
                          <button
                            type="button"
                            onClick={applyEvenSplit}
                            title={`Chia đều ${EXAM_TOTAL_SCORE} điểm cho mọi câu`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                            <Shuffle size={14} /> Chia đều điểm
                          </button>
                          <button
                            type="button"
                            onClick={applyDifficultySplit}
                            title="Câu Khó đáng nhiều điểm hơn câu Dễ (tỷ lệ 1 : 1,5 : 2)"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                            <Scale size={14} /> Chia theo mức độ
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {errors.questions && (
                  <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {errors.questions}
                  </p>
                )}

                {hidden > 0 && !errors.questions && (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {isFrozen
                      ? `Có ${hidden} câu đang bị ẩn khỏi ngân hàng. Đề đã khoá nên không thay được; các bản đề đã sinh giữ nguyên.`
                      : `Có ${hidden} câu đang bị ẩn khỏi ngân hàng. Lưu nháp được, nhưng phải thay các câu đó trước khi xuất bản.`}
                  </p>
                )}

                {questionsQuery.loading && items.length === 0 && isEditing && (
                  <SkeletonBlock className="h-40 w-full rounded-2xl" />
                )}

                {items.length === 0 ? (
                  <EmptyState
                    icon={ListChecks}
                    title="Đề chưa có câu hỏi nào"
                    description='Thêm câu từ ngân hàng, hoặc bấm "Soạn tự động" để hệ thống rút theo số câu từng mức rồi bạn duyệt lại.'
                  />
                ) : (
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <ExamQuestionCard
                        key={item.question.id}
                        number={index + 1}
                        question={item.question}
                        point={listItems[index]?.point ?? item.point}
                        locked={isFrozen}
                        pointFromLevel={isSplit}
                        pointError={isSplit ? undefined : pointProblem(item.point)}
                        highlight={freshIds.has(item.question.id)}
                        isFirst={index === 0}
                        isLast={index === items.length - 1}
                        onPointChange={rawValue => changePoint(index, rawValue)}
                        onRemove={() => removeItem(index)}
                        onMove={direction => moveItem(index, direction)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'assign' && canAssignHere && (
            <div className="animate-tab-in">
            <ExamClassAssignment
              groups={availableGroups}
              loading={groupsQuery.loading}
              error={groupsQuery.error}
              onRetry={groupsQuery.reload}
              value={assignment}
              onChange={setAssignment}
              durationMinutes={form.durationMinutes}
              defaultOpenAtLocal={form.openAtLocal}
              defaultCloseAtLocal={form.closeAtLocal}
              problems={chosenGroupIds.length > 0 ? assignmentProblems : []}
              showLockWarning={opensWithinLockWindow(form.openAtLocal, form.closeAtLocal)}
              canSaveDraft={canSaveDraft}
              allowRandomize={false}
            />
            </div>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 min-w-0">
          {summaryCard}

          <div className={`${cardClass} p-5 space-y-2.5`}>
            <button
              type="submit"
              disabled={isSaving || (!isFrozen && items.length === 0)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: primaryGradient }}
            >
              {savingMode === 'publish' ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {submitLabel}
            </button>

            {canSaveDraft && (
              <button
                type="button"
                onClick={() => void handleSave('draft')}
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingMode === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Lưu nháp
              </button>
            )}

            {!isFrozen && items.length === 0 && (
              <p className="text-xs text-slate-400 leading-relaxed pt-1 flex items-start gap-1.5">
                <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
                Thêm ít nhất một câu hỏi để lưu bài. Lưu nháp thì không cần.
              </p>
            )}
          </div>
        </aside>
      </form>

      <QuestionPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingIds={existingIds}
        existingCounts={counts}
        groups={availableGroups}
        onConfirm={handlePicked}
        onCreateNew={() => {
          setPickerOpen(false)
          goToQuestionEditor()
        }}
      />

      <ComposeQuestionsDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        existingIds={Array.from(existingIds)}
        groups={availableGroups}
        onComposed={handleComposed}
      />
    </TeacherLayout>
  )
}
