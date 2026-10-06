import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, CalendarClock, CheckCircle2, Clock, Copy, FileText,
  Info, Layers, Loader2, Lock, Plus, Save, Send, Target,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import {
  createExam, duplicateExam, getExam, previewBlueprint, publishExam, updateExam,
  type BlueprintPreview, type ExamPayload,
} from '../../../services/examService'
import { listTopics } from '../../../services/questionService'
import { difficultyLabels, type DifficultyLevel, type Exam } from '../../../types'
import DifficultyRatioEditor from '../components/DifficultyRatioEditor'
import FieldError from '../components/FieldError'
import {
  clampPercentage, difficultyBarColors, orderedDifficultyLevels, sumRatios,
  type DifficultyRatios,
} from '../utils/blueprintRatio'
import {
  clearExamBuilderDraft, readExamBuilderDraft, saveExamBuilderDraft,
  type ExamFormState,
} from '../utils/examDraftStorage'
import {
  examDuplicateConfirmCopy, examPublishConfirmCopy, publishedExamEditConfirmCopy,
} from '../utils/examConfirmations'
import {
  buildDefaultSchedule, describeScheduleLock, isCloseAfterOpen, minutesBetween, toDateTimeLocalValue,
  toServiceDateTime,
} from '../utils/examScheduleFormat'
import { formatDateTime, parseDateTime } from '../../../lib/format'
import type { ApiError } from '../../../lib/apiClient'

type SaveMode = 'draft' | 'publish' | 'assign'

type FormErrorKey = keyof ExamFormState | 'ratio'
type FormErrors = Partial<Record<FormErrorKey, string>>

type BuilderTab = 'general' | 'blueprint'

/**
 * Ô nhập nào thuộc tab nào.
 *
 * Tồn tại vì chia form thành tab sinh ra một cái bẫy: người dùng đang ở tab 2 bấm Lưu, form báo
 * lỗi ở một ô nằm tab 1, và họ nhìn quanh không thấy ô nào sai. Bảng này cho phép nhảy thẳng về
 * tab đầu tiên có lỗi và chấm dấu lên nhãn tab còn lại.
 */
const errorKeyToTab: Record<FormErrorKey, BuilderTab> = {
  title: 'general',
  description: 'general',
  topic: 'general',
  openAtLocal: 'general',
  closeAtLocal: 'general',

  durationMinutes: 'blueprint',
  totalQuestions: 'blueprint',
  pointPerQuestion: 'blueprint',
  easyPercentage: 'blueprint',
  mediumPercentage: 'blueprint',
  hardPercentage: 'blueprint',
  ratio: 'blueprint',

  // Ba tuỳ chọn này nằm ở thanh bên, luôn nhìn thấy được ở cả hai tab. Xếp vào tab đầu chỉ để
  // Record không thiếu khoá — chúng không sinh lỗi validate nào.
  shuffleQuestions: 'general',
  shuffleAnswers: 'general',
  showResultAfterSubmit: 'general',
}

const builderTabs: { id: BuilderTab; label: string }[] = [
  { id: 'general', label: 'Thông tin chung' },
  { id: 'blueprint', label: 'Cấu hình đề' },
]

/** Tab đầu tiên đang có lỗi, theo đúng thứ tự hiển thị. */
function firstTabWithError(errors: FormErrors): BuilderTab | undefined {
  const withError = new Set(
    (Object.keys(errors) as FormErrorKey[])
      .filter(key => errors[key])
      .map(key => errorKeyToTab[key]),
  )

  return builderTabs.find(tab => withError.has(tab.id))?.id
}

const inputBaseClass =
  'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-4'
const inputNormalClass = `${inputBaseClass} border-slate-200 focus:border-indigo-400 focus:ring-indigo-50`
const inputInvalidClass = `${inputBaseClass} border-red-300 focus:border-red-400 focus:ring-red-50`
const lockedFieldClass = 'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'
const labelClass = 'block text-sm font-semibold text-slate-700 mb-2'
const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'

function fieldClass(message: string | undefined): string {
  return message ? inputInvalidClass : inputNormalClass
}

function createInitialForm(): ExamFormState {
  const schedule = buildDefaultSchedule()
  return {
    title: '',
    description: '',
    durationMinutes: 45,
    totalQuestions: 20,
    pointPerQuestion: 0.5,
    topic: '',
    easyPercentage: 30,
    mediumPercentage: 50,
    hardPercentage: 20,
    shuffleQuestions: true,
    shuffleAnswers: true,
    showResultAfterSubmit: true,
    openAtLocal: schedule.openAtLocal,
    closeAtLocal: schedule.closeAtLocal,
  }
}

function toSafeNumber(rawValue: string): number {
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : 0
}

function toErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

/** Độ dài cửa sổ mở bài, viết thành 'N ngày M giờ' cho dễ đọc. */
function formatScheduleWindow(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'Chưa xác định'
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} ngày`)
  if (hours > 0) parts.push(`${hours} giờ`)
  if (minutes > 0 && days === 0) parts.push(`${minutes} phút`)
  return parts.length > 0 ? parts.join(' ') : 'Dưới 1 phút'
}

function validateForm(state: ExamFormState, mode: SaveMode): FormErrors {
  const nextErrors: FormErrors = {}
  const isDraft = mode === 'draft'
  const title = state.title.trim()

  if (!title) {
    nextErrors.title = 'Vui lòng nhập tên bài kiểm tra.'
  } else if (title.length < 5) {
    nextErrors.title = 'Tên bài kiểm tra cần ít nhất 5 ký tự.'
  }

  if (state.durationMinutes < 1) {
    nextErrors.durationMinutes = 'Thời gian làm bài phải lớn hơn 0 phút.'
  } else if (state.durationMinutes > 300) {
    nextErrors.durationMinutes = 'Thời gian làm bài tối đa 300 phút.'
  }

  if (state.totalQuestions < 1) {
    nextErrors.totalQuestions = 'Đề phải có ít nhất 1 câu hỏi.'
  } else if (state.totalQuestions > 100) {
    nextErrors.totalQuestions = 'Một đề chỉ nên có tối đa 100 câu hỏi.'
  }

  if (state.pointPerQuestion <= 0) {
    nextErrors.pointPerQuestion = 'Điểm mỗi câu phải lớn hơn 0.'
  } else if (state.pointPerQuestion > 10) {
    nextErrors.pointPerQuestion = 'Điểm mỗi câu tối đa là 10.'
  }

  if (!isDraft && !state.openAtLocal) {
    nextErrors.openAtLocal = 'Vui lòng chọn thời gian mở bài.'
  }
  if (!isDraft && !state.closeAtLocal) {
    nextErrors.closeAtLocal = 'Vui lòng chọn thời gian đóng bài.'
  }
  if (state.openAtLocal && state.closeAtLocal && !isCloseAfterOpen(state.openAtLocal, state.closeAtLocal)) {
    nextErrors.closeAtLocal = 'Thời gian đóng bài phải sau thời gian mở bài.'
  }

  const ratioTotal = sumRatios({
    easy: state.easyPercentage,
    medium: state.mediumPercentage,
    hard: state.hardPercentage,
  })
  if (!isDraft && ratioTotal !== 100) {
    nextErrors.ratio = `Tổng tỷ lệ ba mức độ phải bằng 100%, hiện tại là ${ratioTotal}%.`
  }

  return nextErrors
}

/**
 * Form có đổi thứ gì mà bộ sinh đề đọc không.
 *
 * Chỉ dùng để hộp xác nhận nói đúng việc server sắp làm: sinh lại đề của các em, hay giữ nguyên bộ câu.
 * Danh sách khớp từng trường với `ExamEditPolicy.ChangesGeneratedPaper` ở server — thời lượng, lịch,
 * tên và cờ hiện điểm không có mặt vì chúng không đổi bộ câu nào.
 */
function blueprintDiffers(state: ExamFormState, exam: Exam): boolean {
  return (
    state.totalQuestions !== exam.totalQuestions ||
    state.easyPercentage !== exam.easyPercentage ||
    state.mediumPercentage !== exam.mediumPercentage ||
    state.hardPercentage !== exam.hardPercentage ||
    state.pointPerQuestion !== exam.pointPerQuestion ||
    state.topic.trim() !== exam.topic.trim() ||
    state.shuffleQuestions !== exam.shuffleQuestions ||
    state.shuffleAnswers !== exam.shuffleAnswers
  )
}

/**
 * Form có đổi trường nào mà server khoá khi đã có em bắt đầu làm không.
 *
 * Rộng hơn `blueprintDiffers` đúng một trường là thời lượng, khớp `ExamEditPolicy.ChangedFrozenFields`:
 * bộ sinh đề không đọc thời lượng, nhưng em đã vào thi có hạn nộp chốt theo thời lượng cũ.
 */
function frozenFieldsDiffer(state: ExamFormState, exam: Exam): boolean {
  return blueprintDiffers(state, exam) || state.durationMinutes !== exam.durationMinutes
}

/**
 * Lấy lại các trường bị khoá từ đề đã lưu, giữ nguyên phần còn sửa được (tên, mô tả, lịch, hiện kết quả).
 *
 * Dùng khi form đang giữ những gì giáo viên soạn mà chưa lưu, trên một đề vừa bị khoá. Gửi nguyên form
 * thì server trả 409 mãi, còn các ô bị khoá đã tắt nên giáo viên không tự chỉnh về được — nạp lại cả
 * form từ server thì mất luôn tên và lịch họ vừa gõ, là những thứ vẫn lưu được.
 */
function withFrozenFieldsFrom(state: ExamFormState, exam: Exam): ExamFormState {
  return {
    ...state,
    totalQuestions: exam.totalQuestions,
    durationMinutes: exam.durationMinutes,
    pointPerQuestion: exam.pointPerQuestion,
    topic: exam.topic,
    easyPercentage: exam.easyPercentage,
    mediumPercentage: exam.mediumPercentage,
    hardPercentage: exam.hardPercentage,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleAnswers: exam.shuffleAnswers,
  }
}

/** Form có đang giữ một lịch khác lịch đã lưu không, so ở độ chính xác phút như ô nhập giờ. */
function scheduleDiffers(state: ExamFormState, exam: Exam): boolean {
  return state.openAtLocal !== toDateTimeLocalValue(exam.openAt)
    || state.closeAtLocal !== toDateTimeLocalValue(exam.closeAt)
}

/** Lấy lại lịch đã lưu, dùng khi lịch bị khoá mà form đang giữ một lịch khác. */
function withScheduleFrom(state: ExamFormState, exam: Exam): ExamFormState {
  return {
    ...state,
    openAtLocal: toDateTimeLocalValue(exam.openAt),
    closeAtLocal: toDateTimeLocalValue(exam.closeAt),
  }
}

function isConflictError(caught: unknown): boolean {
  return typeof caught === 'object' && caught !== null && (caught as Partial<ApiError>).status === 409
}

interface BlueprintPreviewCardProps {
  preview: BlueprintPreview | undefined
  loading: boolean
  error: string | undefined
  totalQuestions: number
  pointPerQuestion: number
  /** Cấu hình đề đã khoá vì có em bắt đầu làm — thiếu câu lúc này không phải lỗi cần sửa. */
  frozen: boolean
  onRetry: () => void
  onAddQuestion: () => void
  onOpenQuestionBank: () => void
}

/** Kết quả sinh đề luôn lấy từ examService.previewBlueprint để logic nằm đúng tầng nghiệp vụ. */
function BlueprintPreviewCard({
  preview, loading, error, totalQuestions, pointPerQuestion, frozen, onRetry, onAddQuestion, onOpenQuestionBank,
}: BlueprintPreviewCardProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (!preview) {
    return (
      <div className={`${cardClass} p-5 space-y-3`}>
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="h-14 w-full rounded-xl" />
        <SkeletonBlock className="h-16 w-full rounded-xl" />
        <SkeletonBlock className="h-16 w-full rounded-xl" />
        <SkeletonBlock className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  const totalPoints = Math.round(totalQuestions * pointPerQuestion * 10) / 10

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Xem trước số câu</h2>
        </div>
        {loading && (
          <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">
            Đang tính lại…
          </span>
        )}
      </div>

      <div
        className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3"
        style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' }}
      >
        <div>
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Tổng điểm của đề</p>
          <p className="text-xl font-bold text-indigo-700 mt-0.5">{totalPoints} điểm</p>
        </div>
        <p className="text-xs text-indigo-500 text-right leading-relaxed">
          {totalQuestions} câu × {pointPerQuestion} điểm
        </p>
      </div>

      <div className="space-y-3">
        {orderedDifficultyLevels.map(level => {
          const requiredCount = preview.required[level]
          const availableCount = preview.available[level]
          // Đề đã khoá thì không tô đỏ: giáo viên không đổi được cấu hình, và bộ câu các em đang cầm
          // đã sinh xong từ trước nên ngân hàng vơi đi không làm hỏng gì.
          const isEnough = frozen || requiredCount <= availableCount
          const usage =
            availableCount > 0
              ? Math.min(100, (requiredCount / availableCount) * 100)
              : requiredCount > 0 ? 100 : 0

          return (
            <div
              key={level}
              className={`rounded-xl border p-3.5 ${isEnough ? 'border-slate-100' : 'border-red-200 bg-red-50/40'}`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: difficultyBarColors[level] }}
                  />
                  {difficultyLabels[level]}
                </span>
                <span className={`text-sm font-bold ${isEnough ? 'text-slate-700' : 'text-red-500'}`}>
                  {requiredCount}
                  <span className="font-medium text-slate-400"> / {availableCount} câu</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${usage}%`,
                    background: isEnough ? difficultyBarColors[level] : '#EF4444',
                  }}
                />
              </div>
              <p className={`text-xs mt-1.5 ${isEnough ? 'text-slate-400' : 'text-red-500 font-medium'}`}>
                {requiredCount <= availableCount
                  ? `Ngân hàng còn dư ${availableCount - requiredCount} câu`
                  : frozen
                    ? `Ngân hàng hiện ít hơn cấu hình ${requiredCount - availableCount} câu`
                    : `Còn thiếu ${requiredCount - availableCount} câu trong ngân hàng`}
              </p>
            </div>
          )
        })}
      </div>

      {preview.isValid ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-emerald-700 leading-relaxed">
            Ngân hàng đủ câu hỏi để sinh đề. Mặc định cả lớp dùng chung một đề; bật "Sinh đề riêng cho
            từng học sinh" ở trang giao bài nếu muốn mỗi em nhận một đề khác nhau.
          </p>
        </div>
      ) : frozen ? (
        // Thay khối đỏ "Ma trận đề chưa hợp lệ": với đề đã khoá thì không có gì để sửa, và nút thêm câu
        // hỏi đặt ở đây khiến giáo viên tưởng bài của các em đang hỏng. Vẫn nói rõ lúc nào ngân hàng
        // còn quan trọng — giao thêm cho em mới thì server rút câu từ ngân hàng hiện tại.
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3">
          <Info size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 leading-relaxed">
            Đề của các em đã được giao được sinh từ trước, nên ngân hàng câu hỏi thay đổi không ảnh hưởng tới
            bài các em đang có. Chỉ khi giao thêm cho học sinh mới, hệ thống mới rút câu từ ngân hàng hiện tại
            — lúc đó ngân hàng cần đủ câu.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3">
          <p className="text-sm font-bold text-red-600 flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            Ma trận đề chưa hợp lệ
          </p>
          <ul className="space-y-1.5">
            {preview.errors.map(message => (
              <li key={message} className="text-sm text-red-600 leading-relaxed flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{message}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 pt-3 border-t border-red-100 space-y-2">
            <button
              type="button"
              onClick={onAddQuestion}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              <Plus size={16} />
              Thêm câu hỏi vào ngân hàng
            </button>
            <p className="text-xs text-red-500 leading-relaxed text-center">
              Cấu hình đang nhập được giữ lại, bạn sẽ quay về đây ngay sau khi lưu câu hỏi.{' '}
              <button
                type="button"
                onClick={onOpenQuestionBank}
                className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
              >
                Mở ngân hàng câu hỏi
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  // useParams luôn trả về chuỗi nên phải ép về số trước khi dùng làm id.
  // Đường dẫn '/sua' có id không đọc được vẫn phải ở chế độ sửa để báo lỗi,
  // tuyệt đối không được rơi âm thầm sang chế độ tạo mới.
  const examId = id === undefined ? undefined : Number(id)
  const isEditing = examId !== undefined

  // Nháp chỉ được đọc đúng một lần lúc gắn trang: hàm xoá chạy ngay sau đó nên các
  // render sau không còn đọc lại được nữa.
  const [restoredForm] = useState(() => readExamBuilderDraft(examId ?? null)?.form)
  // Bật khi form đang giữ những gì giáo viên soạn mà chưa lưu — nháp vừa khôi phục, hoặc lần lưu vừa bị
  // từ chối vì đề bị khoá giữa chừng. Khi đó dữ liệu nạp từ server không được đè cả form.
  const keepFormEditsRef = useRef(restoredForm !== undefined)
  // Lý do form phải bỏ phần cấu hình đang soạn, để ghi chú nói đúng chuyện vừa xảy ra.
  const frozenMergeReasonRef = useRef<'draft' | 'conflict'>('draft')
  const [frozenNotice, setFrozenNotice] = useState<string | null>(null)

  const [form, setForm] = useState<ExamFormState>(() => restoredForm ?? createInitialForm())
  // Effect nạp đề chỉ chạy lại khi đề đổi, nhưng cần so với form mới nhất chứ không phải bản lúc gắn trang.
  const formRef = useRef(form)
  formRef.current = form
  const [errors, setErrors] = useState<FormErrors>({})
  const [activeTab, setActiveTab] = useState<BuilderTab>('general')
  const [anchorLevel, setAnchorLevel] = useState<DifficultyLevel>('easy')
  const [savingMode, setSavingMode] = useState<SaveMode | null>(null)

  const examQuery = useAsync<Exam | null>(
    () => (examId === undefined ? Promise.resolve(null) : getExam(examId)),
    [examId ?? 0],
  )
  const topicsQuery = useAsync(() => listTopics(), [])
  const loadedExam = examQuery.data

  // Xoá ở effect riêng chứ không xoá trong initializer, vì StrictMode chạy initializer hai lần.
  // Chỉ xoá nháp của đúng đề này: bản nháp vừa được đọc vào state ở trên rồi, còn nháp của đề khác
  // thì không liên quan gì tới lần mở này.
  useEffect(() => {
    clearExamBuilderDraft(examId ?? null)
  }, [examId])

  useEffect(() => {
    if (!loadedExam) return
    // Những gì giáo viên soạn mà chưa lưu phải thắng dữ liệu nạp từ service, nếu không form bị đè ngay.
    // Trừ các trường server đã khoá: giữ bản đang soạn của chúng thì lần lưu nào cũng nhận 409, mà ô đã
    // tắt nên giáo viên không tự chỉnh về được.
    if (keepFormEditsRef.current) {
      const resetBlueprint = loadedExam.blueprintFrozen && frozenFieldsDiffer(formRef.current, loadedExam)
      const resetSchedule = loadedExam.scheduleLocked && scheduleDiffers(formRef.current, loadedExam)
      if (!resetBlueprint && !resetSchedule) return

      setForm(current => {
        const merged = resetBlueprint ? withFrozenFieldsFrom(current, loadedExam) : current
        return resetSchedule ? withScheduleFrom(merged, loadedExam) : merged
      })

      const isConflict = frozenMergeReasonRef.current === 'conflict'
      const notices: string[] = []

      if (resetBlueprint) {
        const lockedPart =
          'số câu, tỷ lệ độ khó, chủ đề, điểm mỗi câu, thời gian làm bài và tuỳ chọn trộn đã trở về cấu hình đang áp dụng'
        notices.push(
          isConflict
            ? `Chưa lưu được: trong lúc bạn sửa, đã có học sinh bắt đầu làm bài nên cấu hình đề vừa bị khoá. Vì vậy ${lockedPart}.`
            : `Bản nháp chưa lưu đã được khôi phục, trừ phần cấu hình đề: đã có ${loadedExam.startedCount} học sinh bắt đầu làm bài nên ${lockedPart}.`,
        )
      }

      if (resetSchedule) {
        const scheduleNotice = `${describeScheduleLock('Đề này', loadedExam.openAt)} Lịch mở bài đã trở về lịch đang áp dụng.`
        notices.push(
          resetBlueprint
            ? scheduleNotice
            : isConflict
              ? `Chưa lưu được. ${scheduleNotice}`
              : `Bản nháp chưa lưu đã được khôi phục, trừ lịch mở bài. ${scheduleNotice}`,
        )
      }

      // Lịch chỉ được nhắc là "giữ bản đang soạn" khi nó thật sự còn sửa được và không vừa bị đưa về bản đã lưu.
      const keptPart = loadedExam.scheduleLocked
        ? 'Tên, mô tả và tuỳ chọn hiện kết quả vẫn giữ bản bạn đang soạn.'
        : 'Tên, mô tả, lịch mở bài và tuỳ chọn hiện kết quả vẫn giữ bản bạn đang soạn.'
      notices.push(keptPart)

      if (isConflict) {
        notices.push(
          resetBlueprint
            ? 'Kiểm tra lại rồi bấm lưu lần nữa, hoặc nhân bản đề nếu cần cấu hình khác.'
            : 'Kiểm tra lại rồi bấm lưu lần nữa.',
        )
      }

      setFrozenNotice(notices.join(' '))
      return
    }
    setForm({
      title: loadedExam.title,
      description: loadedExam.description,
      durationMinutes: loadedExam.durationMinutes,
      totalQuestions: loadedExam.totalQuestions,
      pointPerQuestion: loadedExam.pointPerQuestion,
      topic: loadedExam.topic,
      easyPercentage: loadedExam.easyPercentage,
      mediumPercentage: loadedExam.mediumPercentage,
      hardPercentage: loadedExam.hardPercentage,
      shuffleQuestions: loadedExam.shuffleQuestions,
      shuffleAnswers: loadedExam.shuffleAnswers,
      showResultAfterSubmit: loadedExam.showResultAfterSubmit,
      openAtLocal: toDateTimeLocalValue(loadedExam.openAt),
      closeAtLocal: toDateTimeLocalValue(loadedExam.closeAt),
    })
  }, [loadedExam])

  const ratios = useMemo<DifficultyRatios>(
    () => ({
      easy: form.easyPercentage,
      medium: form.mediumPercentage,
      hard: form.hardPercentage,
    }),
    [form.easyPercentage, form.mediumPercentage, form.hardPercentage],
  )
  const ratioTotal = sumRatios(ratios)

  // Chỉ gọi lại preview khi cấu hình đã ngưng thay đổi, tránh bắn request ở mỗi lần kéo thanh trượt.
  const blueprintKey = [
    form.totalQuestions, form.easyPercentage, form.mediumPercentage, form.hardPercentage, form.topic,
  ].join('|')
  const debouncedBlueprintKey = useDebouncedValue(blueprintKey, 400)
  const blueprintQuery = useAsync(
    () => previewBlueprint({
      totalQuestions: form.totalQuestions,
      easyPercentage: form.easyPercentage,
      mediumPercentage: form.mediumPercentage,
      hardPercentage: form.hardPercentage,
      topic: form.topic,
    }),
    [debouncedBlueprintKey],
  )

  const topicChoices = useMemo(() => {
    const choices = new Set(topicsQuery.data ?? [])
    if (form.topic) choices.add(form.topic)
    return Array.from(choices).sort((left, right) => left.localeCompare(right, 'vi'))
  }, [topicsQuery.data, form.topic])

  const scheduleWindowMinutes = minutesBetween(form.openAtLocal, form.closeAtLocal)
  const isDurationTooLong = scheduleWindowMinutes > 0 && form.durationMinutes > scheduleWindowMinutes
  // Chỉ cảnh báo, không chặn: sửa tên một đề đã đóng là việc hợp lệ. Nhưng bản sao chép nguyên lịch của
  // đề gốc, nên giao một bản sao của đề cũ mà quên dời lịch là giao một bài các em không vào được.
  const closeAtDate = parseDateTime(form.closeAtLocal)
  const isCloseInPast = closeAtDate !== null && closeAtDate.getTime() <= Date.now()
  const isSaving = savingMode !== null
  // Server khoá cấu hình đề khi đã có em bắt đầu làm. Đọc thẳng cờ của server thay vì tự suy từ số
  // liệu, để luật khoá chỉ nằm ở một nơi.
  const isFrozen = isEditing && loadedExam?.blueprintFrozen === true
  // Lịch khoá riêng, theo giờ: đề đã giao và còn dưới 2 giờ nữa là mở, hoặc đang mở. Tên và mô tả vẫn sửa được.
  const isScheduleLocked = isEditing && loadedExam?.scheduleLocked === true
  // Cấu hình đã khoá thì không đổi được, nên cũng không có gì để chặn: ngân hàng có vơi đi sau lúc sinh
  // đề thì bộ câu các em đang cầm vẫn nguyên, và server không kiểm lại ngân hàng khi cấu hình giữ
  // nguyên. Chặn ở đây là khoá luôn cả việc sửa tên hay dời lịch.
  const isBlueprintBlocked =
    !isFrozen &&
    (ratioTotal !== 100 || (blueprintQuery.data !== undefined && !blueprintQuery.data.isValid))
  // Đề đã xuất bản mà lưu nháp lại thì học sinh đang được giao sẽ mất quyền vào làm,
  // nên chỉ cho lưu nháp khi tạo mới hoặc khi đề vẫn còn là bản nháp.
  const canSaveDraft = !isEditing || loadedExam?.lifecycle === 'draft'

  const clearError = (key: FormErrorKey) => {
    setErrors(current => {
      if (current[key] === undefined) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const updateField = <Key extends keyof ExamFormState>(key: Key, value: ExamFormState[Key]) => {
    setForm(current => {
      const next: ExamFormState = { ...current }
      next[key] = value
      return next
    })
    clearError(key)
  }

  const applyRatios = (nextRatios: DifficultyRatios) => {
    setForm(current => ({
      ...current,
      easyPercentage: clampPercentage(nextRatios.easy),
      mediumPercentage: clampPercentage(nextRatios.medium),
      hardPercentage: clampPercentage(nextRatios.hard),
    }))
    clearError('ratio')
  }

  const changeRatios = (nextRatios: DifficultyRatios, nextAnchorLevel: DifficultyLevel) => {
    setAnchorLevel(nextAnchorLevel)
    applyRatios(nextRatios)
  }

  // Rời trang để bổ sung ngân hàng thì phải giữ nháp lại, nếu không toàn bộ cấu hình đang nhập sẽ mất.
  const saveDraftAndNavigate = (targetPath: string) => {
    saveExamBuilderDraft({ examId: examId ?? null, form, savedAt: Date.now() })
    navigate(targetPath)
  }

  const goToQuestionEditor = () => {
    const params = new URLSearchParams()
    if (form.topic) params.set('chu-de', form.topic)
    params.set('quay-lai', 'de')
    if (examId !== undefined && Number.isFinite(examId)) params.set('de', String(examId))
    saveDraftAndNavigate(`/giao-vien/cau-hoi/tao?${params.toString()}`)
  }

  const goToQuestionBank = () => {
    saveDraftAndNavigate('/giao-vien/cau-hoi')
  }

  // Lối ra khi cấu hình đã khoá: tạo bản nháp cùng cấu hình rồi sang sửa ngay bản đó.
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
    // Trang này được dùng lại cho bản sao (cùng route, khác id) nên state không tự làm mới. Bỏ cờ
    // "giữ phần đang soạn" để cấu hình của bản sao được nạp vào form, và xoá lỗi, ghi chú của đề cũ.
    keepFormEditsRef.current = false
    setErrors({})
    setFrozenNotice(null)
    navigate(`/giao-vien/bai-kiem-tra/${copy.id}/sua`)
  }

  const handleSave = async (mode: SaveMode) => {
    const nextErrors = validateForm(form, mode)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      // Nhảy về tab chứa lỗi trước khi báo. Không có bước này thì người dùng đang ở tab 2 sẽ nhận
      // một dòng "kiểm tra lại các trường đánh dấu đỏ" rồi nhìn quanh không thấy ô đỏ nào — ô đó
      // nằm ở tab họ không mở.
      const target = firstTabWithError(nextErrors)
      if (target) {
        setActiveTab(target)
      }

      toast.error('Vui lòng kiểm tra lại các trường được đánh dấu đỏ.')
      return
    }

    const payload: ExamPayload = {
      title: form.title,
      description: form.description,
      durationMinutes: form.durationMinutes,
      totalQuestions: form.totalQuestions,
      easyPercentage: form.easyPercentage,
      mediumPercentage: form.mediumPercentage,
      hardPercentage: form.hardPercentage,
      pointPerQuestion: form.pointPerQuestion,
      topic: form.topic,
      shuffleQuestions: form.shuffleQuestions,
      shuffleAnswers: form.shuffleAnswers,
      // Lịch không đổi thì gửi lại nguyên giá trị đã lưu, không qua ô nhập giờ (chỉ tới phút). Một đề đã khoá lịch
      // mà bị coi là "đổi giờ" chỉ vì mất vài giây là bị từ chối khi giáo viên chỉ muốn sửa tên.
      openAt: loadedExam && !scheduleDiffers(form, loadedExam) ? loadedExam.openAt : toServiceDateTime(form.openAtLocal),
      closeAt: loadedExam && !scheduleDiffers(form, loadedExam) ? loadedExam.closeAt : toServiceDateTime(form.closeAtLocal),
      showResultAfterSubmit: form.showResultAfterSubmit,

      // Bỏ trống trường này nghĩa là đề CÓ HIỆU LỰC THẬT — server nói rõ như vậy. Nên nút "Lưu
      // nháp" bắt buộc phải gửi cờ 'draft', nếu không giáo viên cất tạm một cấu hình đang dở lại
      // hoá ra phát đề cho cả lớp. Bản nháp cũng được miễn hai điều kiện nặng nhất (tổng tỷ lệ
      // bằng 100 và ngân hàng đủ câu), đúng bằng mục đích của việc lưu dở.
      lifecycle: mode === 'draft' ? 'draft' : undefined,
    }

    const outcome: { saved?: Exam; final?: Exam; conflict?: string } = {}
    const persist = async () => {
      // Lần thử lại trong hộp xác nhận sau khi tạo đề xong mà bước xuất bản hỏng thì không được
      // tạo thêm một đề nữa — dùng lại bản vừa lưu và chỉ thử lại bước còn thiếu.
      if (!outcome.saved) {
        try {
          outcome.saved = examId === undefined
            ? await createExam(payload)
            : await updateExam(examId, payload)
        } catch (caught) {
          // 409 khi sửa nghĩa là đề vừa đổi trạng thái ở phía server — thường là có em vừa bắt đầu làm nên
          // cấu hình bị khoá. Hộp xác nhận vừa hiện đã nói sai chuyện sẽ xảy ra, nên không để nó mở cho thử
          // lại: đóng hộp, nạp lại đề để hiện dải khoá và nút nhân bản, rồi báo cho giáo viên. Cờ giữ phần
          // đang soạn khiến lần nạp này chỉ lấy lại các trường bị khoá, tên và lịch vừa gõ không mất.
          if (examId === undefined || !isConflictError(caught)) throw caught
          outcome.conflict = toErrorMessage(caught, 'Đề vừa thay đổi ở phía máy chủ nên chưa lưu được.')
          keepFormEditsRef.current = true
          frozenMergeReasonRef.current = 'conflict'
          examQuery.reload()
          return
        }
      }
      const saved = outcome.saved

      // Rời khỏi nháp là một HÀNH ĐỘNG riêng, không phải một trường dữ liệu: server kiểm lại đầy
      // đủ những điều kiện mà bản nháp vừa được miễn. Chỉ gọi khi đề thật sự còn là nháp — gọi
      // trên một đề đã xuất bản sẽ nhận 409.
      outcome.final = mode !== 'draft' && saved.lifecycle === 'draft'
        ? await publishExam(saved.id)
        : saved
    }

    // Lưu nháp không đụng tới ai nên không hỏi. Hai trường hợp còn lại thì có: xuất bản là bước
    // không quay lại được, còn sửa một đề đã xuất bản là sửa thứ học sinh đang cầm trên tay.
    const goingToAssign = mode === 'assign'
    const confirmCopy =
      mode === 'draft'
        ? undefined
        : loadedExam && loadedExam.lifecycle !== 'draft'
          ? publishedExamEditConfirmCopy(loadedExam, goingToAssign, blueprintDiffers(form, loadedExam))
          : examPublishConfirmCopy(
              {
                title: form.title,
                totalQuestions: form.totalQuestions,
                durationMinutes: form.durationMinutes,
                // Hộp xác nhận là chỗ để người dùng đọc, nên in giờ địa phương. Chuỗi ISO theo giờ
                // UTC chỉ dành cho server — in ra đây là lệch bảy tiếng với giờ Việt Nam.
                openAt: formatDateTime(form.openAtLocal),
                closeAt: formatDateTime(form.closeAtLocal),
              },
              goingToAssign,
            )

    if (confirmCopy) {
      const confirmed = await confirm({ ...confirmCopy, onConfirm: persist })
      if (!confirmed) return
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
      toast.error(`${outcome.conflict} Trang đã tải lại đề để bạn xem lại trước khi lưu.`)
      return
    }

    const published = outcome.final
    if (!published) return

    if (mode === 'draft') {
      toast.success('Đã lưu bản nháp. Đề chưa phát cho học sinh.')
    } else {
      toast.success(isEditing ? 'Đã cập nhật bài kiểm tra.' : 'Đã tạo bài kiểm tra thành công.')
    }

    navigate(
      mode === 'assign'
        ? `/giao-vien/bai-kiem-tra/${published.id}/giao-bai`
        : `/giao-vien/bai-kiem-tra/${published.id}`,
    )
  }

  const pageTitle = isEditing ? 'Sửa bài kiểm tra' : 'Tạo bài kiểm tra'
  const pageSubtitle = isEditing
    ? loadedExam?.title ?? 'Đang tải cấu hình bài kiểm tra'
    : 'Cấu hình ma trận đề. Mặc định cả lớp dùng chung một đề (câu hỏi và đáp án vẫn xáo trộn theo tuỳ chọn bên dưới); bật "Sinh đề riêng cho từng học sinh" ở bước giao bài nếu muốn mỗi em một đề khác nhau.'

  // Chỉ quay về trang chi tiết khi id thật sự là số, tránh dẫn tới '/bai-kiem-tra/NaN'.
  const hasValidExamId = examId !== undefined && Number.isFinite(examId)
  const backLink = (
    <div className="mb-5">
      <NavLink
        to={hasValidExamId ? `/giao-vien/bai-kiem-tra/${examId}` : '/giao-vien/bai-kiem-tra'}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft size={16} />
        {hasValidExamId ? 'Quay lại chi tiết bài kiểm tra' : 'Quay lại danh sách bài kiểm tra'}
      </NavLink>
    </div>
  )

  if (isEditing && examQuery.error) {
    return (
      <TeacherLayout pageTitle={pageTitle} pageSubtitle="Không tải được bài kiểm tra">
        {backLink}
        <ErrorState message={examQuery.error} onRetry={examQuery.reload} />
      </TeacherLayout>
    )
  }

  if (isEditing && !loadedExam) {
    return (
      <TeacherLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle}>
        {backLink}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="space-y-6">
            {[0, 1, 2].map(blockIndex => (
              <div key={blockIndex} className={`${cardClass} p-6 space-y-4`}>
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-11 w-full rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SkeletonBlock className="h-11 w-full rounded-xl" />
                  <SkeletonBlock className="h-11 w-full rounded-xl" />
                  <SkeletonBlock className="h-11 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className={`${cardClass} p-5 space-y-3`}>
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-16 w-full rounded-xl" />
              <SkeletonBlock className="h-16 w-full rounded-xl" />
              <SkeletonBlock className="h-16 w-full rounded-xl" />
            </div>
            <div className={`${cardClass} p-5 space-y-3`}>
              <SkeletonBlock className="h-10 w-full rounded-2xl" />
              <SkeletonBlock className="h-10 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </TeacherLayout>
    )
  }

  return (
    <TeacherLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle}>
      {backLink}

      <form
        onSubmit={event => {
          event.preventDefault()
          void handleSave('publish')
        }}
        className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start animate-fade-in-up"
      >
        <div className="space-y-6 min-w-0">
          {/* Nói rõ phần cấu hình đang soạn đã bị bỏ: các ô tự đổi số dưới tay mà không một lời giải thích
              thì giáo viên sẽ tưởng trang hỏng, hoặc lưu mà không biết mình vừa mất gì. */}
          {frozenNotice && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <Info size={18} className="text-sky-600 flex-shrink-0 mt-0.5" />
              <p className="flex-1 min-w-0 text-sm text-sky-800 leading-relaxed">{frozenNotice}</p>
              <button
                type="button"
                onClick={() => setFrozenNotice(null)}
                className="self-start px-3 py-1.5 rounded-lg text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors whitespace-nowrap"
              >
                Đã hiểu
              </button>
            </div>
          )}

          {/* Đặt trên dải tab để nhìn thấy ở cả hai tab: giáo viên mở tab "Cấu hình đề" thấy mọi ô bị
              mờ thì phải biết ngay vì sao, và lối ra nằm ngay cạnh lời giải thích. */}
          {isFrozen && loadedExam && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <Lock size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">Cấu hình đề đã khoá</p>
                <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                  Đã có {loadedExam.startedCount} học sinh bắt đầu làm bài, nên số câu, tỷ lệ độ khó, chủ đề, điểm
                  mỗi câu, thời gian làm bài và tuỳ chọn trộn không đổi được nữa — đổi lúc này thì các em trong
                  cùng lớp làm hai đề khác nhau. Tên, mô tả{isScheduleLocked ? '' : ', lịch mở bài'} và tuỳ chọn hiện kết quả vẫn sửa được.
                  Muốn dùng cấu hình khác, hãy nhân bản đề rồi sửa trên bản sao.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDuplicate()}
                disabled={isSaving}
                className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-800 bg-white border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Copy size={15} /> Nhân bản đề
              </button>
            </div>
          )}

          {/* Chia form dài thành hai tab thay vì một trang cuộn: mỗi tab vừa một màn hình nên
              không phải kéo lên kéo xuống để đối chiếu hai ô liên quan nhau. Dấu chấm đỏ trên
              nhãn tab là thứ khiến việc ẩn bớt nội dung không giấu mất lỗi. */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 w-fit">
            {builderTabs.map(tab => {
              const isActive = activeTab === tab.id
              const hasError = (Object.keys(errors) as FormErrorKey[])
                .some(key => errors[key] && errorKeyToTab[key] === tab.id)

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
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
          </div>


          {activeTab === 'general' && (
            <>
            <section className={`${cardClass} p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <FileText size={18} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800">Thông tin chung</h2>
              </div>

              <div className="space-y-5">
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
                  <label htmlFor="exam-topic" className={labelClass}>Chủ đề câu hỏi</label>
                  <select
                    id="exam-topic"
                    value={form.topic}
                    onChange={event => updateField('topic', event.target.value)}
                    disabled={isFrozen}
                    title={isFrozen ? 'Đã khoá vì có học sinh bắt đầu làm bài' : undefined}
                    className={`${inputNormalClass} bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
                  >
                    <option value="">Tổng hợp (mọi chủ đề)</option>
                    {topicChoices.map(topic => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                  {topicsQuery.error ? (
                    <p className="mt-1.5 text-xs text-red-500 flex flex-wrap items-center gap-1.5">
                      Không tải được danh sách chủ đề.
                      <button
                        type="button"
                        onClick={topicsQuery.reload}
                        className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                      >
                        Thử lại
                      </button>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-400">
                      Chọn một chủ đề để giới hạn ngân hàng sinh đề. Tổng hợp nghĩa là lấy câu hỏi từ mọi chủ đề.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="exam-description" className={labelClass}>Mô tả</label>
                  <textarea
                    id="exam-description"
                    rows={3}
                    value={form.description}
                    onChange={event => updateField('description', event.target.value)}
                    className={inputNormalClass}
                    placeholder="Mô tả phạm vi kiến thức và lưu ý cho học sinh"
                  />
                </div>
              </div>
            </section>
            <section className={`${cardClass} p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <CalendarClock size={18} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800">Lịch mở bài</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exam-open-at" className={labelClass}>
                    Thời gian mở bài <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exam-open-at"
                    type="datetime-local"
                    value={form.openAtLocal}
                    onChange={event => updateField('openAtLocal', event.target.value)}
                    disabled={isScheduleLocked}
                    className={`${fieldClass(errors.openAtLocal)} ${lockedFieldClass}`}
                  />
                  <FieldError message={errors.openAtLocal} />
                </div>

                <div>
                  <label htmlFor="exam-close-at" className={labelClass}>
                    Thời gian đóng bài <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exam-close-at"
                    type="datetime-local"
                    value={form.closeAtLocal}
                    onChange={event => updateField('closeAtLocal', event.target.value)}
                    disabled={isScheduleLocked}
                    className={`${fieldClass(errors.closeAtLocal)} ${lockedFieldClass}`}
                  />
                  <FieldError message={errors.closeAtLocal} />
                </div>
              </div>

              {isScheduleLocked && loadedExam && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 leading-relaxed">
                  <Lock size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{describeScheduleLock('Đề này', loadedExam.openAt)} Hết giờ đóng bài thì đổi lại được.</span>
                </p>
              )}

              {scheduleWindowMinutes > 0 && (
                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Học sinh có thể vào làm từ{' '}
                  <strong className="text-slate-800 font-semibold">{formatDateTime(form.openAtLocal)}</strong>{' '}
                  đến <strong className="text-slate-800 font-semibold">{formatDateTime(form.closeAtLocal)}</strong>{' '}
                  — cửa sổ mở bài kéo dài {formatScheduleWindow(scheduleWindowMinutes)}.
                </div>
              )}

              {isDurationTooLong && (
                <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Thời gian làm bài ({form.durationMinutes} phút) đang dài hơn cửa sổ mở bài, học sinh vào
                    muộn sẽ không kịp hoàn thành.
                  </span>
                </div>
              )}

              {isCloseInPast && (
                <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Thời gian đóng bài đã qua nên học sinh không vào làm được. Muốn các em làm bài thì hãy dời
                    giờ đóng (và giờ mở nếu cần) sang sau thời điểm hiện tại.
                  </span>
                </div>
              )}
            </section>
            </>
          )}

          {/* Một fieldset tắt được mọi ô bên trong, kể cả thanh trượt và nút mẫu nhanh của khối tỷ lệ,
              mà không phải luồn cờ khoá xuống từng component. */}
          {activeTab === 'blueprint' && (
            <fieldset
              disabled={isFrozen}
              title={isFrozen ? 'Đã khoá vì có học sinh bắt đầu làm bài' : undefined}
              className="space-y-6 min-w-0 border-0 p-0 m-0 disabled:opacity-60"
            >
            <section className={`${cardClass} p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <Target size={18} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800">Cấu hình đề</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="exam-total-questions" className={labelClass}>
                    Tổng số câu <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exam-total-questions"
                    type="number"
                    min={1}
                    max={100}
                    value={form.totalQuestions}
                    onChange={event => updateField('totalQuestions', toSafeNumber(event.target.value))}
                    className={fieldClass(errors.totalQuestions)}
                  />
                  <FieldError message={errors.totalQuestions} />
                </div>

                <div>
                  <label htmlFor="exam-duration" className={labelClass}>
                    Thời gian làm bài (phút) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="exam-duration"
                      type="number"
                      min={1}
                      max={300}
                      value={form.durationMinutes}
                      onChange={event => updateField('durationMinutes', toSafeNumber(event.target.value))}
                      className={`${fieldClass(errors.durationMinutes)} pl-10`}
                    />
                  </div>
                  <FieldError message={errors.durationMinutes} />
                </div>

                <div>
                  <label htmlFor="exam-point" className={labelClass}>
                    Điểm mỗi câu <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exam-point"
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={form.pointPerQuestion}
                    onChange={event => updateField('pointPerQuestion', toSafeNumber(event.target.value))}
                    className={fieldClass(errors.pointPerQuestion)}
                  />
                  <FieldError message={errors.pointPerQuestion} />
                </div>
              </div>
            </section>
            <DifficultyRatioEditor
              ratios={ratios}
              anchorLevel={anchorLevel}
              errorMessage={errors.ratio}
              onChange={changeRatios}
            />
            </fieldset>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 min-w-0">
          <BlueprintPreviewCard
            preview={blueprintQuery.data}
            loading={blueprintQuery.loading}
            error={blueprintQuery.error}
            totalQuestions={form.totalQuestions}
            pointPerQuestion={form.pointPerQuestion}
            frozen={isFrozen}
            onRetry={blueprintQuery.reload}
            onAddQuestion={goToQuestionEditor}
            onOpenQuestionBank={goToQuestionBank}
          />

          <div className={`${cardClass} p-5`}>
            <h2 className="text-base font-bold text-slate-800 mb-2">Tuỳ chọn</h2>
            <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
              <span className="text-sm text-slate-600">Trộn thứ tự câu hỏi</span>
              <input
                type="checkbox"
                checked={form.shuffleQuestions}
                onChange={event => updateField('shuffleQuestions', event.target.checked)}
                disabled={isFrozen}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
            <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
              <span className="text-sm text-slate-600">Trộn thứ tự đáp án</span>
              <input
                type="checkbox"
                checked={form.shuffleAnswers}
                onChange={event => updateField('shuffleAnswers', event.target.checked)}
                disabled={isFrozen}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
            <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
              <span className="text-sm text-slate-600">Hiện kết quả sau khi nộp</span>
              <input
                type="checkbox"
                checked={form.showResultAfterSubmit}
                onChange={event => updateField('showResultAfterSubmit', event.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
          </div>

          <div className={`${cardClass} p-5 space-y-2.5`}>
            <button
              type="submit"
              disabled={isSaving || isBlueprintBlocked}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              {savingMode === 'publish'
                ? <Loader2 size={17} className="animate-spin" />
                : <Save size={17} />}
              {isEditing ? 'Lưu thay đổi' : 'Lưu bài kiểm tra'}
            </button>

            <button
              type="button"
              onClick={() => void handleSave('assign')}
              disabled={isSaving || isBlueprintBlocked}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingMode === 'assign'
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />}
              Lưu và giao bài
            </button>

            {canSaveDraft && (
              <button
                type="button"
                onClick={() => void handleSave('draft')}
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingMode === 'draft'
                  ? <Loader2 size={16} className="animate-spin" />
                  : <FileText size={16} />}
                Lưu nháp
              </button>
            )}

            {isBlueprintBlocked && (
              <p className="text-xs text-red-500 leading-relaxed pt-1">
                {canSaveDraft
                  ? 'Ma trận đề chưa hợp lệ nên chưa thể xuất bản. Hãy bấm "Thêm câu hỏi vào ngân hàng" ở khối xem trước, chỉnh lại tỷ lệ, hoặc lưu nháp để hoàn thiện sau.'
                  : 'Ma trận đề chưa hợp lệ nên chưa thể lưu thay đổi. Hãy bấm "Thêm câu hỏi vào ngân hàng" ở khối xem trước, hoặc chỉnh lại tỷ lệ và số câu cho khớp ngân hàng.'}
              </p>
            )}
          </div>
        </aside>
      </form>
    </TeacherLayout>
  )
}
