import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, FileText, Flag, LayoutGrid, Loader2, Save, Send,
} from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import {
  clearAttemptProgress, readAttemptProgress, saveAttemptProgress,
} from '../utils/examProgressStorage'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Modal from '../../../components/common/Modal'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { resolveMediaUrl } from '../../../lib/apiClient'
import { formatClock } from '../../../lib/format'
import { getAttemptTime, saveAnswers, startAttempt, submitAttempt } from '../../../services/attemptService'
import type { AttemptQuestion, AttemptSession } from '../../../types'
import { hasReached, secondsUntil } from '../utils/examClock'

/** Chờ học sinh ngừng đổi đáp án rồi mới lưu nháp, tránh gọi service ở mỗi lần bấm. */
const AUTO_SAVE_DELAY_MS = 800

/**
 * Khoảng chờ giữa hai lần thử nộp tự động.
 *
 * Nộp tự động hỏng — mạng chập, server bận — thì phải thử lại, vì học sinh lúc đó có thể đã rời
 * máy và không còn ai bấm nút nữa. Năm giây đủ để qua một trục trặc thoáng qua mà không biến
 * thành trận bão request lên một server đang chật vật.
 */
const AUTO_SUBMIT_RETRY_MS = 5000
const WARNING_SECONDS = 5 * 60
const CRITICAL_SECONDS = 60

/**
 * Đồng hồ chạy trên `performance.now()` nên không nghe theo giờ máy, nhưng có thể đứng lại khi máy ngủ hay
 * tab bị treo. Chỉnh lại theo server khi tab hiện lại, khi cửa sổ được chú ý, khi có mạng lại, và khi nhịp
 * đồng hồ nhận ra hai đồng hồ của máy đã lệch nhau (máy vừa ngủ dậy mà trình duyệt không bắn sự kiện nào).
 * Cộng thêm một nhịp thưa phòng hờ.
 *
 * `RESYNC_MIN_GAP_MS` là van chặn việc chuyển tab liên tục thành một chuỗi lời gọi. Một lần chỉnh lỗi thì được
 * thử lại tối đa `RESYNC_MAX_RETRIES` lần, mỗi lần cách `RESYNC_RETRY_AFTER_FAILURE_MS`, và mỗi lời gọi bị cắt sau
 * `RESYNC_TIMEOUT_MS` để một kết nối chết sau khi ngủ không giữ chỗ mãi.
 */
const RESYNC_MIN_GAP_MS = 10_000
const RESYNC_RETRY_AFTER_FAILURE_MS = 2_000
const RESYNC_MAX_RETRIES = 4
const RESYNC_TIMEOUT_MS = 8_000
const RESYNC_FALLBACK_MS = 5 * 60_000

/** Đồng hồ bị chỉnh lùi ít nhất chừng này giây thì học sinh thấy con số tụt, nên phải được giải thích. */
const CLOCK_CORRECTION_NOTICE_SECONDS = 10

/** Giờ treo tường và đồng hồ đơn điệu lệch nhau quá chừng này giữa hai nhịp thì máy đã ngủ hoặc bị chỉnh giờ. */
const CLOCK_DRIFT_THRESHOLD_MS = 3_000

/** Số giây còn lại theo mốc đang lưu trong ref; 0 khi chưa có mốc. */
function remainingFromRef(deadlineRef: { readonly current: number | null }): number {
  return deadlineRef.current === null ? 0 : secondsUntil(deadlineRef.current)
}

/**
 * Lỗi lưu nháp đứng yên bao lâu thì đổi từ dòng chữ nhỏ sang một dải cảnh báo hẳn hoi.
 *
 * Đủ ngắn để không bỏ sót một sự cố kéo dài trong lúc học sinh cắm cúi đọc câu hỏi, đủ dài để
 * không doạ học sinh vì một lượt lưu chập chờn tự phục hồi ngay sau đó.
 */
const DRAFT_SAVE_ERROR_BANNER_DELAY_MS = 20_000

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type SaveErrorReason = 'network' | 'expired'
type QuestionMarkState = 'current' | 'flagged' | 'answered' | 'pending'

function formatTimeOfDay(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getMarkClass(state: QuestionMarkState): string {
  if (state === 'current') return 'bg-indigo-600 text-white border border-indigo-600 shadow-sm shadow-indigo-200'
  if (state === 'flagged') return 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
  if (state === 'answered') return 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
  return 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
}

const legendItems: { state: QuestionMarkState; label: string }[] = [
  { state: 'current', label: 'Câu hiện tại' },
  { state: 'answered', label: 'Đã trả lời' },
  { state: 'flagged', label: 'Đánh dấu xem lại' },
  { state: 'pending', label: 'Chưa làm' },
]

interface QuestionNavigatorProps {
  questions: AttemptQuestion[]
  currentIndex: number
  answers: Record<number, number>
  flaggedQuestionIds: number[]
  onSelect: (index: number) => void
}

/** Lưới số câu hỏi kèm chú thích màu, dùng chung cho cột bên phải và khối thu gọn trên tablet. */
function QuestionNavigator({
  questions, currentIndex, answers, flaggedQuestionIds, onSelect,
}: QuestionNavigatorProps) {
  return (
    <div>
      <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
        {questions.map((question, index) => {
          const isCurrent = index === currentIndex
          const isAnswered = answers[question.id] !== undefined
          const isFlagged = flaggedQuestionIds.includes(question.id)
          const state: QuestionMarkState = isCurrent
            ? 'current'
            : isFlagged
              ? 'flagged'
              : isAnswered
                ? 'answered'
                : 'pending'

          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Câu ${index + 1}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={`relative aspect-square rounded-xl text-sm font-bold flex items-center justify-center transition-all ${getMarkClass(state)}`}
            >
              {index + 1}
              {isFlagged && (
                <Flag
                  size={9}
                  className={`absolute top-1 right-1 ${isCurrent ? 'text-white' : 'text-amber-500'}`}
                />
              )}
              {isAnswered && !isCurrent && isFlagged && (
                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
        {legendItems.map(item => (
          <span key={item.state} className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`w-4 h-4 rounded-md flex-shrink-0 ${getMarkClass(item.state)}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Đồng hồ trong hộp xác nhận nộp bài.
 *
 * Phải tiếp tục chạy chứ không đứng ở con số lúc mở hộp: học sinh quyết định nộp sớm hay quay lại
 * soát bài dựa đúng vào con số này, và một con số đứng yên thì nói dối mỗi giây hộp còn mở.
 */
function RemainingClock({ deadlineRef }: { deadlineRef: { readonly current: number | null } }) {
  const [seconds, setSeconds] = useState(() => remainingFromRef(deadlineRef))

  // Đọc mốc từ ref ở mỗi nhịp, không chụp một lần: màn hình làm bài có thể chỉnh lại mốc theo server khi hộp
  // xác nhận đang mở, và con số trong hộp phải theo kịp.
  useEffect(() => {
    const timerId = window.setInterval(() => setSeconds(remainingFromRef(deadlineRef)), 1000)
    return () => window.clearInterval(timerId)
  }, [deadlineRef])

  return <strong className="font-bold text-slate-800 tabular-nums">{formatClock(seconds)}</strong>
}

function TakeExamSkeleton() {
  return (
    <div className="animate-fade-in-up">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2.5 flex-1">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-5 w-2/3" />
            <SkeletonBlock className="h-3 w-40" />
          </div>
          <div className="flex gap-3">
            <SkeletonBlock className="h-11 w-28 rounded-xl" />
            <SkeletonBlock className="h-11 w-32 rounded-xl" />
          </div>
        </div>
        <SkeletonBlock className="h-2 w-full mt-5 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-5 w-4/5" />
          <div className="space-y-3 pt-3">
            {[0, 1, 2, 3].map(row => (
              <SkeletonBlock key={row} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <SkeletonBlock className="h-4 w-32 mb-4" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 20 }, (_, index) => index).map(cell => (
              <SkeletonBlock key={cell} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TakeExamPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const parsedAssignmentId = Number(assignmentId)
  const isValidAssignmentId = Number.isFinite(parsedAssignmentId) && parsedAssignmentId > 0

  const { data: session, loading, error, reload } = useAsync<AttemptSession>(
    () =>
      isValidAssignmentId
        ? startAttempt(parsedAssignmentId)
        : Promise.reject(new Error('Đường dẫn bài kiểm tra không hợp lệ.')),
    [parsedAssignmentId, isValidAssignmentId],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<number[]>([])
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveStateRef = useRef<SaveState>('idle')
  saveStateRef.current = saveState
  const [lastSavedLabel, setLastSavedLabel] = useState('')
  /** Lý do lưu nháp thất bại, khi tự suy ra được rẻ — dùng để đổi câu chữ, không bắt buộc phải có. */
  const [saveErrorReason, setSaveErrorReason] = useState<SaveErrorReason | null>(null)
  /** Lỗi lưu nháp đã đứng yên đủ lâu để đáng lên một dải cảnh báo, không chỉ dòng chữ nhỏ. */
  const [saveErrorPersistent, setSaveErrorPersistent] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  /** Số lần nộp tự động đã thất bại. Khác 0 thì giao diện phải nói thẳng, không im lặng. */
  const [autoSubmitFailures, setAutoSubmitFailures] = useState(0)
  /** Mốc sớm nhất được phép thử nộp tự động lần nữa, theo thang `performance.now()` (0 nghĩa là được thử ngay). */
  const autoSubmitRetryAtRef = useRef(0)
  /** Hàm chỉnh đồng hồ theo server, do effect bên dưới gắn vào để nhịp đồng hồ cũng gọi được. */
  const resyncClockRef = useRef<(force: boolean) => void>(() => undefined)
  /** Tăng lên để bắt lưu nháp chạy lại, ví dụ khi có mạng trở lại sau một lần lưu hỏng. */
  const [saveRetryTick, setSaveRetryTick] = useState(0)

  // Chặn nộp hai lần khi đồng hồ về 0 đúng lúc học sinh cũng bấm nộp.
  const hasSubmittedRef = useRef(false)
  // Chỉ lưu nháp sau khi học sinh thực sự đổi đáp án, không lưu ngay lúc nạp bài cũ.
  const answersDirtyRef = useRef(false)
  const expiresAtRef = useRef<number | null>(null)
  /**
   * Số thứ tự tăng dần gắn vào mỗi lượt ghi gửi lên server.
   *
   * Hai lần lưu nháp không nhất thiết về đích đúng thứ tự gửi đi; server so số này với lần ghi
   * cuối nó đã nhận để bỏ qua gói đến muộn, thay vì để bản cũ đè lên lựa chọn mới hơn.
   */
  const clientSeqRef = useRef(0)

  const questions = useMemo(() => session?.questions ?? [], [session])
  const totalQuestions = questions.length
  const answeredCount = useMemo(
    () => questions.filter(question => answers[question.id] !== undefined).length,
    [questions, answers],
  )
  const unansweredCount = totalQuestions - answeredCount
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const safeIndex = totalQuestions > 0 ? Math.min(currentIndex, totalQuestions - 1) : 0
  const currentQuestion = totalQuestions > 0 ? questions[safeIndex] : undefined
  const secondsLeft = remainingSeconds ?? session?.remainingSeconds ?? 0
  const isCritical = secondsLeft <= CRITICAL_SECONDS
  const isWarning = secondsLeft <= WARNING_SECONDS

  // Nạp lại toàn bộ trạng thái làm bài mỗi khi có phiên mới.
  useEffect(() => {
    if (!session) return
    hasSubmittedRef.current = false
    answersDirtyRef.current = false
    // Mốc hết giờ lấy thẳng từ phiên: nó đã trừ đi chênh lệch giữa đồng hồ máy và đồng hồ server,
    // nên máy đặt sai giờ vẫn đếm ngược đúng bằng thời gian server thật sự còn cho phép.
    expiresAtRef.current = session.expiresAtMonotonic
    // Nối tiếp số thứ tự server đã ghi nhận, để những lượt ghi tiếp theo luôn lớn hơn nó.
    clientSeqRef.current = session.lastAppliedSeq
    autoSubmitRetryAtRef.current = 0
    setAutoSubmitFailures(0)
    setAnswers({ ...session.savedAnswers })

    // Khôi phục vị trí đang đọc và các câu đã đánh dấu. Đặt lại về câu 1 với danh sách cờ rỗng
    // nghĩa là mỗi lần F5 giữa giờ thi, học sinh phải tự nhớ mình đang làm tới đâu và định quay
    // lại những câu nào — đáp án thì còn nguyên nên sự mất mát này càng khó hiểu.
    const progress = readAttemptProgress(session.attemptId, session.questions.length)
    setFlaggedQuestionIds(progress.flaggedQuestionIds)
    setCurrentIndex(progress.currentIndex)
    setRemainingSeconds(session.remainingSeconds)
    setSaveState('idle')
    setLastSavedLabel('')
    setSaveErrorReason(null)
    setLightboxImage(null)
  }, [session])

  const finishAttempt = useCallback(
    async (autoSubmitted: boolean) => {
      if (!session || hasSubmittedRef.current) return
      hasSubmittedRef.current = true
      setSubmitting(true)
      if (autoSubmitted) {
        // Đóng hộp xác nhận đang mở để không chồng hai lớp phủ lên nhau khi hết giờ.
        confirm.dismiss()
        setAutoSubmitting(true)
      }

      try {
        clientSeqRef.current += 1
        const result = await submitAttempt(session.attemptId, answers, clientSeqRef.current)
        clearAttemptProgress(session.attemptId)

        // Server có thể đã nhận ít câu hơn số câu học sinh vừa chọn (nộp chạm ngưỡng cuối cửa sổ
        // gia hạn ở lateSubmit). answeredCount ở đây là bộ đếm tại-thời-điểm-nộp, chụp trước khi
        // effect nạp lại session nào khác có thể chạy — so nó với con số server trả về là cách duy
        // nhất để biết có bị rớt câu hay không, vì response 200 không tự nói điều đó.
        const missingAnswers = Math.max(0, answeredCount - result.answeredCount)

        if (missingAnswers > 0) {
          // Đây là phần trung thực: đừng để một toast ba giây làm chỗ duy nhất nói sự thật này,
          // vì học sinh auto-submit có thể đã rời máy. Trang "đã nộp" mang cảnh báo bền hơn qua
          // query param; toast chỉ là tín hiệu tức thời cho ai còn đang ngồi nhìn màn hình.
          toast.error(
            `Nộp bài chưa trọn vẹn: hệ thống chỉ ghi nhận được ${result.answeredCount}/${answeredCount} câu bạn đã chọn.`,
          )
        } else if (autoSubmitted) {
          toast.info('Đã hết thời gian làm bài, hệ thống tự động nộp bài giúp bạn.')
        } else {
          toast.success('Nộp bài thành công.')
        }

        const query = new URLSearchParams()
        if (autoSubmitted) query.set('tu-dong', '1')
        if (missingAnswers > 0) query.set('thieu-dap-an', String(missingAnswers))
        const queryString = query.toString()

        navigate(
          `/hoc-sinh/bai-kiem-tra/${result.attemptId}/da-nop${queryString ? `?${queryString}` : ''}`,
          { replace: true },
        )
      } catch (caught) {
        hasSubmittedRef.current = false
        setSubmitting(false)
        setAutoSubmitting(false)

        if (autoSubmitted) {
          // Toast tắt sau ba giây, mà lúc này học sinh có thể đã rời máy. Đếm số lần hỏng để
          // giao diện giữ lại một thông báo không tự biến mất, và đồng hồ sẽ tự thử lại.
          setAutoSubmitFailures(count => count + 1)
          return
        }

        // Nộp tay thì ném tiếp cho hộp xác nhận: lỗi hiện ngay trong hộp, hộp không đóng, và học
        // sinh bấm "Nộp bài" lần nữa ngay tại chỗ thay vì phải tìm lại nút giữa trang.
        throw caught
      }
    },
    [session, answers, answeredCount, navigate, toast, confirm],
  )

  // Giữ tham chiếu mới nhất tới hàm nộp bài để đồng hồ không phải khởi động lại
  // mỗi khi học sinh đổi đáp án.
  const finishAttemptRef = useRef(finishAttempt)
  finishAttemptRef.current = finishAttempt

  // Ghi lại tiến độ mỗi khi học sinh chuyển câu hoặc đổi cờ. Rẻ và đồng bộ, không cần debounce:
  // đây là một dòng localStorage, không phải một lượt gọi mạng.
  useEffect(() => {
    if (!session || hasSubmittedRef.current) return
    saveAttemptProgress(session.attemptId, { currentIndex, flaggedQuestionIds })
  }, [session, currentIndex, flaggedQuestionIds])

  // Đếm ngược theo mốc hết giờ thay vì trừ dần, để chuyển tab không làm lệch đồng hồ.
  // Việc tự động nộp bài phải nằm ngay trong nhịp đồng hồ: nếu đợi state đổi rồi mới nộp thì
  // React sẽ bỏ qua lần setRemainingSeconds trùng giá trị 0 và hàm nộp không bao giờ được gọi.
  useEffect(() => {
    if (!session) return
    let timerId = 0
    let lastWall = Date.now()
    let lastMono = performance.now()

    const tick = () => {
      // Hai đồng hồ của máy phải đi cùng tốc độ. Giờ treo tường chạy nhanh hơn đồng hồ đơn điệu quá vài giây
      // nghĩa là máy vừa ngủ (đồng hồ đơn điệu đứng lại) hoặc ai đó chỉnh giờ: hỏi lại server thay vì chờ một
      // sự kiện mà trình duyệt có thể không bắn. Giờ treo tường ở đây chỉ làm tín hiệu, không dùng để đếm.
      const wallNow = Date.now()
      const monoNow = performance.now()
      if (Math.abs(wallNow - lastWall - (monoNow - lastMono)) > CLOCK_DRIFT_THRESHOLD_MS) {
        // Cưỡng bức, bỏ qua khoảng chặn: lệch này chỉ bị nhịp sau không còn thấy nữa, nên bỏ lỡ là bỏ lỡ hẳn.
        resyncClockRef.current(true)
      }
      lastWall = wallNow
      lastMono = monoNow

      const expiresAt = expiresAtRef.current
      if (expiresAt === null) return
      // Làm tròn lên để đồng hồ chỉ hiện 00:00 khi thời gian đã thực sự hết.
      const remaining = secondsUntil(expiresAt)
      setRemainingSeconds(remaining)
      if (remaining > 0) return
      // Hết giờ thì tự động nộp, đúng yêu cầu nghiệp vụ. Cờ hasSubmittedRef bên trong
      // finishAttempt đảm bảo không nộp chồng lên lần nộp thủ công đang chạy.
      // KHÔNG tắt đồng hồ ở đây. Tắt rồi mà lần nộp đó hỏng thì hasSubmittedRef được đặt lại
      // nhưng không còn nhịp nào gọi lại nữa: đồng hồ đứng im ở 00:00, bài không bao giờ được
      // nộp, và thứ duy nhất báo cho học sinh là một toast biến mất sau ba giây.
      // Để đồng hồ chạy tiếp và thử lại theo nhịp giãn cách; hasSubmittedRef bên trong
      // finishAttempt chặn việc nộp chồng lên nhau.
      const now = performance.now()
      if (now < autoSubmitRetryAtRef.current) return
      autoSubmitRetryAtRef.current = now + AUTO_SUBMIT_RETRY_MS
      void finishAttemptRef.current(true)
    }

    timerId = window.setInterval(tick, 1000)
    return () => window.clearInterval(timerId)
  }, [session])

  // Chỉnh lại đồng hồ theo server khi tab hiện lại (sau khi máy ngủ hay tab bị treo, đồng hồ đơn điệu có thể đã
  // đứng lại) và khi có mạng lại, cộng thêm một nhịp thưa phòng hờ. Hỏng thì im lặng: đồng hồ đang chạy vẫn đúng
  // tới mức chưa cần chỉnh, và server mới là nơi quyết định hạn nộp.
  useEffect(() => {
    if (!session) return
    const attemptId = session.attemptId
    let cancelled = false
    let inFlight = false
    let lastSyncAt = Number.NEGATIVE_INFINITY
    let failureStreak = 0
    let retryTimer = 0

    const resync = (force: boolean) => {
      if (inFlight || hasSubmittedRef.current) return
      const now = performance.now()
      if (!force && now - lastSyncAt < RESYNC_MIN_GAP_MS) return
      inFlight = true
      lastSyncAt = now

      getAttemptTime(attemptId, AbortSignal.timeout(RESYNC_TIMEOUT_MS))
        .then(result => {
          if (cancelled || hasSubmittedRef.current) return

          // Bài đã kết thúc ở nơi khác (nộp ở tab khác, đã chấm): đừng để học sinh làm tiếp trên một bài đã đóng.
          if (result.status !== 'inprogress') {
            hasSubmittedRef.current = true
            clearAttemptProgress(attemptId)
            toast.info('Bài này đã được nộp rồi.')
            navigate(`/hoc-sinh/bai-kiem-tra/${attemptId}/da-nop`, { replace: true })
            return
          }

          const secondsBefore = remainingFromRef(expiresAtRef)
          // Hạn của lượt làm bài chốt lúc bắt đầu và không đổi, nên mốc thật chỉ có thể sớm hơn mốc đang giữ (máy
          // ngủ làm đồng hồ đơn điệu đứng lại). Mốc mới MUỘN hơn chỉ là nhiễu độ trễ mạng: ước lượng này luôn muộn
          // hơn thật đúng bằng độ trễ chiều về. Lấy mốc nhỏ hơn để không bao giờ cho thêm giờ oan.
          const next = Math.min(expiresAtRef.current ?? Number.POSITIVE_INFINITY, result.expiresAtMonotonic)
          expiresAtRef.current = next
          setRemainingSeconds(secondsUntil(next))
          failureStreak = 0

          // Con số vừa tụt một đoạn (máy ngủ, mạng đứt lâu): nói một câu để học sinh không tưởng máy lỗi.
          if (secondsBefore - secondsUntil(next) >= CLOCK_CORRECTION_NOTICE_SECONDS) {
            toast.info('Đồng hồ vừa được chỉnh lại cho khớp giờ của hệ thống.')
          }
        })
        .catch(() => {
          // Lỗi thì im lặng (đồng hồ đang chạy vẫn dùng được), nhưng thử lại vài lần ngắn: máy vừa dậy mà mạng
          // chưa lên là chuyện thường, và lệch giờ do ngủ chỉ được nhịp đồng hồ báo MỘT lần.
          if (cancelled || failureStreak >= RESYNC_MAX_RETRIES) return
          failureStreak += 1
          retryTimer = window.setTimeout(() => resync(true), RESYNC_RETRY_AFTER_FAILURE_MS)
        })
        .finally(() => {
          inFlight = false
        })
    }
    resyncClockRef.current = resync

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resync(false)
    }
    const handleFocus = () => resync(false)
    const handleOnline = () => resync(true)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)
    const fallbackTimer = window.setInterval(() => resync(false), RESYNC_FALLBACK_MS)

    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      resyncClockRef.current = () => undefined
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
      window.clearInterval(fallbackTimer)
    }
  }, [session, navigate, toast])

  // Có mạng lại sau một lần lưu hỏng thì thử lưu lại ngay, không chờ học sinh đổi đáp án tiếp: không thì dải cảnh
  // báo cứ nằm đó dù mạng đã ổn, và đáp án chọn lúc mất mạng mất theo nếu học sinh tải lại trang.
  useEffect(() => {
    if (!session) return
    const handleOnline = () => {
      if (saveStateRef.current === 'error' && answersDirtyRef.current && !hasSubmittedRef.current) {
        setSaveRetryTick(tick => tick + 1)
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [session])

  // Lưu nháp tự động sau mỗi lần đổi đáp án, có chờ 800ms để không gọi service ở mỗi lần bấm.
  useEffect(() => {
    if (!session || !answersDirtyRef.current || hasSubmittedRef.current) return
    let cancelled = false
    setSaveState('saving')

    const attemptId = session.attemptId

    // Gửi một lượt lưu và đọc `applied` trong response thay vì tin vào HTTP 200: server trả 200
    // ngay cả khi bỏ qua gói vì `clientSeq` đã lệch (ví dụ cùng lượt làm bài đang mở ở tab khác).
    // Gặp `applied: false` thì chỉnh lại clientSeqRef theo đúng số server đang giữ và gửi lại
    // ngay — không để giao diện hiện "đã lưu" cho một gói thật ra chưa hề được ghi. Giới hạn số
    // lần thử lại để một cuộc đua dai dẳng giữa hai tab không biến thành vòng lặp vô tận.
    const send = (retriesLeft: number): void => {
      const seq = clientSeqRef.current
      saveAnswers(attemptId, answers, seq)
        .then(response => {
          if (cancelled) return
          if (!response.applied) {
            if (retriesLeft <= 0) {
              setSaveState('error')
              return
            }
            clientSeqRef.current = response.lastAppliedSeq + 1
            send(retriesLeft - 1)
            return
          }
          setSaveState('saved')
          setLastSavedLabel(formatTimeOfDay(new Date()))
          setSaveErrorReason(null)
        })
        .catch((caught: unknown) => {
          if (cancelled) return
          setSaveState('error')

          // 410 (hết giờ) và 409 (bài đã kết thúc) là server nói thẳng bài đã đóng, không phải mạng chập chờn: hỏi
          // ngay xem còn bao nhiêu giờ thay vì để học sinh làm tiếp trên một đồng hồ đã cũ.
          const failedStatus = (caught as { status?: number } | null)?.status
          if (failedStatus === 410 || failedStatus === 409) resyncClockRef.current(true)
          // Không có mã lỗi riêng cho "hết hạn" từ service lưu nháp, nhưng mốc hết giờ phía client
          // (đã trừ lệch đồng hồ máy/server) là dữ liệu rẻ có sẵn: đủ hết giờ rồi thì gần như chắc
          // chắn lỗi này là do bài đã đóng, không phải một trục trặc mạng thoáng qua.
          const expiresAt = expiresAtRef.current
          setSaveErrorReason(
            failedStatus === 410 || (expiresAt !== null && hasReached(expiresAt)) ? 'expired' : 'network',
          )
        })
    }

    const timer = window.setTimeout(() => {
      // Bài đã nộp thì phiên làm bài không còn, gọi lưu nháp chỉ sinh ra lỗi giả trên giao diện.
      if (hasSubmittedRef.current) return
      clientSeqRef.current += 1
      send(3)
    }, AUTO_SAVE_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [session, answers, saveRetryTick])

  // Lỗi lưu nháp chỉ đổi từ dòng chữ nhỏ sang dải cảnh báo sau khi đứng yên đủ lâu — một lượt lưu
  // hỏng rồi tự phục hồi ngay ở lần đổi đáp án kế tiếp không đáng để làm phiền bằng một banner.
  useEffect(() => {
    if (saveState !== 'error') {
      setSaveErrorPersistent(false)
      return
    }
    const timer = window.setTimeout(() => setSaveErrorPersistent(true), DRAFT_SAVE_ERROR_BANNER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [saveState])

  // Cảnh báo khi học sinh tải lại hoặc đóng tab giữa chừng.
  useEffect(() => {
    if (!session) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasSubmittedRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session])

  const handleSelectAnswer = (questionId: number, answerId: number) => {
    if (submitting) return
    answersDirtyRef.current = true
    setAnswers(current => ({ ...current, [questionId]: answerId }))
  }

  const openLightbox = (url: string, alt: string) => setLightboxImage({ url, alt })

  const handleToggleFlag = (questionId: number) => {
    setFlaggedQuestionIds(current =>
      current.includes(questionId)
        ? current.filter(id => id !== questionId)
        : [...current, questionId],
    )
  }

  const requestSubmit = () => {
    // Hỏi lại server khi mở hộp: học sinh quyết định nộp sớm hay soát thêm dựa vào con số này, nên nó không được cũ.
    resyncClockRef.current(true)
    const clock = <RemainingClock deadlineRef={expiresAtRef} />
    void confirm({
      title: 'Xác nhận nộp bài',
      message:
        unansweredCount > 0 ? (
          <>
            Bạn đã trả lời <strong className="text-slate-800">{answeredCount}/{totalQuestions}</strong> câu — còn{' '}
            <strong className="text-slate-800">{unansweredCount}</strong> câu bỏ trống sẽ không được tính điểm.
            Thời gian còn lại: {clock}. Sau khi nộp bạn không thể sửa lại bài làm.
          </>
        ) : (
          <>
            Bạn đã trả lời đủ <strong className="text-slate-800">{answeredCount}/{totalQuestions}</strong> câu.
            Thời gian còn lại: {clock} — bạn vẫn có thể quay lại soát bài. Sau khi nộp bạn không thể sửa lại
            bài làm.
          </>
        ),
      confirmLabel: 'Nộp bài',
      cancelLabel: 'Tiếp tục làm bài',
      tone: unansweredCount > 0 ? 'danger' : 'primary',
      onConfirm: () => finishAttempt(false),
    })
  }

  // Đổi câu thì cuộn lên đầu để trên tablet không phải kéo ngược lên tìm đề bài.
  const goToQuestion = (index: number) => {
    if (totalQuestions === 0) return
    setCurrentIndex(Math.min(Math.max(index, 0), totalQuestions - 1))
    setNavigatorOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading && !session) {
    return (
      <StudentLayout>
        <TakeExamSkeleton />
      </StudentLayout>
    )
  }

  if (error || !session) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto">
          <ErrorState message={error} onRetry={reload} />
          <div className="mt-4 text-center">
            <NavLink
              to="/hoc-sinh/bai-kiem-tra"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <ChevronLeft size={16} /> Về danh sách bài kiểm tra
            </NavLink>
          </div>
        </div>
      </StudentLayout>
    )
  }

  if (!currentQuestion) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto">
          <EmptyState
            icon={FileText}
            title="Đề kiểm tra chưa có câu hỏi nào"
            description="Ngân hàng câu hỏi chưa đủ dữ liệu để sinh đề. Vui lòng liên hệ giáo viên phụ trách."
            action={
              <NavLink
                to="/hoc-sinh/bai-kiem-tra"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                <ChevronLeft size={16} /> Về danh sách bài kiểm tra
              </NavLink>
            }
          />
        </div>
      </StudentLayout>
    )
  }

  const isCurrentFlagged = flaggedQuestionIds.includes(currentQuestion.id)
  const isLastQuestion = safeIndex === totalQuestions - 1
  const questionImageUrl = resolveMediaUrl(currentQuestion.imageUrl)
  const clockToneClass = isCritical
    ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
    : isWarning
      ? 'bg-amber-50 text-amber-600 border-amber-200'
      : 'bg-indigo-50 text-indigo-600 border-indigo-100'

  const navigatorPanel = (
    <QuestionNavigator
      questions={questions}
      currentIndex={safeIndex}
      answers={answers}
      flaggedQuestionIds={flaggedQuestionIds}
      onSelect={goToQuestion}
    />
  )

  return (
    // examMode: giấu toàn bộ điều hướng trong lúc thi. Chạm nhầm một liên kết là rời phòng thi
    // trong khi đồng hồ vẫn chạy, mà component đã unmount nên không còn ai tự nộp hộ nữa.
    <StudentLayout examMode>
      {/*
        Nộp tự động đã hỏng ít nhất một lần. Dải này KHÔNG tự tắt: học sinh có thể đã rời máy lúc
        hết giờ, và một toast ba giây thì họ quay lại chỉ thấy màn hình yên ắng rồi tưởng bài đã
        nộp xong. Đồng hồ vẫn đang tự thử lại phía sau; nút bấm là đường tắt cho người còn ngồi đó.
      */}
      {autoSubmitFailures > 0 && !autoSubmitting && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-700">Chưa nộp được bài</p>
            <p className="text-sm text-red-600 mt-0.5">
              Đã hết giờ nhưng hệ thống chưa gửi được bài làm của bạn
              {autoSubmitFailures > 1 ? ` (đã thử ${autoSubmitFailures} lần)` : ''}.
              Bài làm vẫn được giữ nguyên và hệ thống đang tự thử lại. Đừng đóng trang này.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              autoSubmitRetryAtRef.current = 0
              void finishAttempt(true)
            }}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Thử nộp lại ngay
          </button>
        </div>
      )}

      {/*
        Dòng chữ nhỏ đổi màu trong thanh trạng thái dễ lọt qua mắt khi đang tập trung đọc câu hỏi.
        Dải cảnh báo này chỉ nổi lên sau khi lỗi lưu nháp đứng yên đủ lâu (không phải ngay lập
        tức), để một lượt lưu chập chờn rồi tự phục hồi không biến thành một cảnh báo giả.
      */}
      {saveState === 'error' && saveErrorPersistent && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 animate-fade-in-up"
        >
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-amber-700">
              {saveErrorReason === 'expired'
                ? 'Bài đã hết hạn, không lưu được bản nháp nữa'
                : 'Chưa lưu được bản nháp trong ít lâu'}
            </p>
            <p className="text-sm text-amber-600 mt-0.5">
              {saveErrorReason === 'expired'
                ? 'Khung giờ làm bài đã kết thúc. Nếu bạn vẫn đang làm bài, hãy nộp ngay để không mất thêm bài làm.'
                : 'Có thể do mất kết nối mạng. Hệ thống sẽ tự lưu lại khi bạn đổi đáp án tiếp theo và mạng ổn định trở lại.'}
            </p>
          </div>
        </div>
      )}

      {/* Thanh điều khiển: đồng hồ, tiến độ, nộp bài */}
      <div className="mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sticky top-16 z-20 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">{session.examTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Đã trả lời <strong className="text-slate-700">{answeredCount}</strong>/{totalQuestions} câu
              {flaggedQuestionIds.length > 0 && (
                <span className="text-amber-600"> · {flaggedQuestionIds.length} câu đánh dấu xem lại</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {saveState !== 'idle' && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${
                  saveState === 'error' ? 'text-red-500' : 'text-slate-400'
                }`}
              >
                {saveState === 'saving' && (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Đang lưu nháp…
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <Save size={13} className="text-emerald-500" /> Đã lưu lúc {lastSavedLabel}
                  </>
                )}
                {saveState === 'error' && (
                  <>
                    <AlertTriangle size={13} />
                    {saveErrorReason === 'expired' ? 'Bài đã hết hạn, không lưu được' : 'Chưa lưu được bản nháp'}
                  </>
                )}
              </span>
            )}

            <div
              aria-live="polite"
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold tabular-nums ${clockToneClass}`}
            >
              <Clock size={17} /> {formatClock(secondsLeft)}
            </div>

            <button
              type="button"
              onClick={requestSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              <Send size={16} /> Nộp bài
            </button>
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%`, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
          />
        </div>
      </div>

      {isWarning && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 flex items-start gap-3 animate-fade-in-up ${
            isCritical ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <AlertTriangle
            size={18}
            className={`flex-shrink-0 mt-0.5 ${isCritical ? 'text-red-500' : 'text-amber-500'}`}
          />
          <p className={`text-sm font-semibold ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
            {isCritical
              ? 'Chỉ còn dưới 1 phút! Hết giờ hệ thống sẽ tự động nộp bài của bạn.'
              : `Bài làm sắp hết thời gian.${unansweredCount > 0 ? ` Bạn còn ${unansweredCount} câu chưa trả lời.` : ' Bạn đã trả lời hết các câu hỏi.'}`}
          </p>
        </div>
      )}

      {/* Dưới 1024px: lưới câu hỏi nằm trên đầu dưới dạng khối thu gọn */}
      <div className="lg:hidden mb-5">
        <button
          type="button"
          onClick={() => setNavigatorOpen(current => !current)}
          aria-expanded={navigatorOpen}
          className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5 flex items-center justify-between hover:shadow-md transition-all"
        >
          <span className="flex items-center gap-2.5 text-sm font-bold text-slate-800">
            <LayoutGrid size={16} className="text-indigo-500" />
            Danh sách câu hỏi
            <span className="text-xs font-semibold text-slate-400">
              {answeredCount}/{totalQuestions}
            </span>
          </span>
          {navigatorOpen ? (
            <ChevronUp size={18} className="text-slate-400" />
          ) : (
            <ChevronDown size={18} className="text-slate-400" />
          )}
        </button>
        {navigatorOpen && (
          <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in">
            {navigatorPanel}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 animate-fade-in-up">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Câu {safeIndex + 1} / {totalQuestions}
              </p>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mt-1.5 leading-relaxed">
                {currentQuestion.content}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
                  {currentQuestion.point} điểm
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggleFlag(currentQuestion.id)}
              aria-pressed={isCurrentFlagged}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-colors ${
                isCurrentFlagged
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Flag size={15} />
              <span className="hidden sm:inline">
                {isCurrentFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}
              </span>
            </button>
          </div>

          {questionImageUrl && (
            <button
              type="button"
              onClick={() => openLightbox(questionImageUrl, 'Hình minh hoạ câu hỏi')}
              aria-label="Xem hình minh hoạ câu hỏi cỡ lớn"
              className="mb-5 block rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            >
              <img
                src={questionImageUrl}
                alt="Hình minh hoạ câu hỏi"
                className="max-h-72 rounded-xl border border-slate-100 cursor-zoom-in hover:opacity-90 transition-opacity"
              />
            </button>
          )}

          <div className="space-y-3">
            {currentQuestion.answers.map((answer, index) => {
              const isSelected = answers[currentQuestion.id] === answer.id
              const answerImageUrl = resolveMediaUrl(answer.imageUrl)
              const answerLetter = String.fromCharCode(65 + index)
              return (
                <button
                  key={answer.id}
                  type="button"
                  disabled={submitting}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectAnswer(currentQuestion.id, answer.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all disabled:opacity-60 ${
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50 ring-4 ring-indigo-50'
                      : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-slate-700 leading-relaxed">
                        {answer.content}
                      </span>
                      {answerImageUrl && (
                        // Đáp án bên ngoài đã là một <button> chọn đáp án; HTML không cho phép lồng
                        // <button> trong <button>, nên ảnh tự đóng vai trò phần tử bấm được qua
                        // role="button" thay vì bọc thêm một <button> thật.
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Xem hình minh hoạ đáp án ${answerLetter} cỡ lớn`}
                          onClick={event => {
                            event.stopPropagation()
                            openLightbox(answerImageUrl, `Hình minh hoạ đáp án ${answerLetter}`)
                          }}
                          onKeyDown={event => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            event.stopPropagation()
                            openLightbox(answerImageUrl, `Hình minh hoạ đáp án ${answerLetter}`)
                          }}
                          className="mt-2.5 inline-block rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                        >
                          <img
                            src={answerImageUrl}
                            alt={answer.content ? '' : `Hình minh hoạ đáp án ${answerLetter}`}
                            className="max-h-40 rounded-lg border border-slate-100 cursor-zoom-in"
                          />
                        </span>
                      )}
                    </span>
                    {isSelected && <CheckCircle2 size={18} className="text-indigo-600 flex-shrink-0 mt-1" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={safeIndex === 0}
              onClick={() => goToQuestion(safeIndex - 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Câu trước
            </button>

            {isLastQuestion ? (
              <button
                type="button"
                onClick={requestSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                <Send size={16} /> Nộp bài
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToQuestion(safeIndex + 1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                Câu sau <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>

        <aside className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit sticky top-52">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">Danh sách câu hỏi</h2>
            <span className="text-xs font-semibold text-slate-400">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
          {navigatorPanel}
          {unansweredCount > 0 && (
            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              Còn <strong className="text-slate-600">{unansweredCount}</strong> câu chưa trả lời.
              Hãy kiểm tra lại trước khi nộp bài.
            </p>
          )}
        </aside>
      </div>

      {autoSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/45 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-7 max-w-sm text-center animate-modal-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <Clock size={26} />
            </div>
            <h3 className="text-base font-bold text-slate-800">Đã hết thời gian làm bài</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Hệ thống đang tự động nộp bài của bạn. Vui lòng không tắt trình duyệt.
            </p>
            <Loader2 size={20} className="animate-spin text-indigo-500 mx-auto mt-4" />
          </div>
        </div>
      )}

      {/*
        Lightbox đơn giản cho ảnh câu hỏi/đáp án: chụm ngón tay phóng to cả trang kéo theo cả thanh
        tiêu đề, đồng hồ đếm giờ và danh sách đáp án — bấm vào ảnh mở riêng nó, cỡ lớn, có nút đóng.
      */}
      <Modal
        open={lightboxImage !== null}
        title={lightboxImage?.alt ?? 'Hình minh hoạ'}
        onClose={() => setLightboxImage(null)}
        size="lg"
      >
        {lightboxImage && (
          <img src={lightboxImage.url} alt={lightboxImage.alt} className="w-full h-auto rounded-xl" />
        )}
      </Modal>
    </StudentLayout>
  )
}
