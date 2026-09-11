import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, PlayCircle, Clock, FileText, Trophy, Award,
  CalendarClock, Lock, Timer, ListChecks, Save, Shuffle, Eye,
  AlertTriangle, CheckCircle2, ShieldCheck, Hourglass, RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { StatusBadge, TopicBadge } from '../../../components/common/Badge'
import { useAsync } from '../../../hooks/useAsync'
import { getAssignment, listMyExams } from '../../../services/attemptService'
import { getExam } from '../../../services/examService'
import { formatDateTime, formatDuration, formatScore, parseDateTime, roundToOneDecimal } from '../../../lib/format'
import { useCountdown } from '../hooks/useCountdown'

const urgentThresholdMs = 3 * 3600000

interface InfoTileProps {
  icon: LucideIcon
  label: string
  value: string
  iconBg: string
  iconColor: string
}

function InfoTile({ icon: Icon, label, value, iconBg, iconColor }: InfoTileProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3.5">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  )
}

function IntroSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-6 w-2/3" />
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(tileKey => (
            <SkeletonBlock key={tileKey} className="h-16 rounded-2xl" />
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <SkeletonBlock className="h-4 w-48" />
          {[0, 1, 2, 3].map(lineKey => (
            <SkeletonBlock key={lineKey} className="h-3 w-full" />
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 h-fit">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-11 w-full rounded-2xl" />
        <SkeletonBlock className="h-3 w-full" />
      </div>
    </div>
  )
}

export default function ExamIntroPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const navigate = useNavigate()
  const numericAssignmentId = Number(assignmentId)
  const confirm = useConfirm()
  const toast = useToast()

  const { data, loading, error, reload } = useAsync(async () => {
    if (!Number.isInteger(numericAssignmentId) || numericAssignmentId <= 0) {
      throw new Error('Đường dẫn bài kiểm tra không hợp lệ.')
    }
    // Bản demo chưa có tầng xác thực phía máy chủ, nên trang tự đối chiếu với danh sách bài
    // được giao để học sinh không mở được bài của bạn khác bằng cách sửa đường dẫn.
    const [assignment, myExams] = await Promise.all([
      getAssignment(numericAssignmentId),
      listMyExams({}),
    ])
    if (!myExams.some(item => item.assignmentId === assignment.assignmentId)) {
      throw new Error('Bài kiểm tra này không được giao cho bạn nên bạn không thể xem hoặc làm bài.')
    }
    const exam = await getExam(assignment.examId)
    return { assignment, exam }
  }, [numericAssignmentId])

  const assignment = data?.assignment
  const exam = data?.exam
  const openDate = assignment ? parseDateTime(assignment.openAt) : null
  const closeDate = assignment ? (parseDateTime(assignment.closeAt) ?? assignment.deadline) : null
  const closeCountdown = useCountdown(closeDate, 'Đã hết hạn')
  const openCountdown = useCountdown(openDate, 'Đã mở')

  const requestStart = async () => {
    if (!exam) return
    const ready = await confirm({
      title: 'Bắt đầu làm bài ngay?',
      message: `Đồng hồ sẽ chạy ngay khi bạn xác nhận và không thể tạm dừng, kể cả khi bạn đóng trang. Bạn có ${formatDuration(exam.durationMinutes)} để hoàn thành ${exam.totalQuestions} câu hỏi; hết giờ hệ thống tự động nộp phần bài bạn đã làm.`,
      confirmLabel: 'Bắt đầu ngay',
      cancelLabel: 'Để sau',
    })
    if (!ready) return

    // Cửa sổ làm bài có thể đóng ngay trong lúc hộp xác nhận đang mở. Đồng hồ trên trang đã tắt
    // nút, nhưng hộp thì vẫn nằm đó — kiểm lại lần cuối để không đưa học sinh vào một bài đã đóng,
    // nơi em chỉ gặp một trang báo lỗi.
    if (closeDate !== null && closeDate.getTime() <= Date.now()) {
      toast.error('Bài kiểm tra vừa hết hạn làm bài nên không bắt đầu được nữa.')
      return
    }
    navigate(`/hoc-sinh/bai-kiem-tra/${numericAssignmentId}/lam-bai`)
  }

  const renderBody = () => {
    if (error) {
      return <ErrorState message={error} onRetry={reload} />
    }
    if (loading || !assignment || !exam) {
      return <IntroSkeleton />
    }

    const isUpcoming = assignment.status === 'upcoming'
    const isSubmitted = assignment.status === 'submitted'
    const isGraded = assignment.status === 'graded'
    const isDone = isSubmitted || isGraded
    // Đồng hồ đếm ngược nhịp mỗi giây, nên các mốc so với hiện tại luôn được tính lại khi render.
    const remainingMs = closeDate !== null ? closeDate.getTime() - Date.now() : Number.POSITIVE_INFINITY
    const justClosed = assignment.status === 'open' && remainingMs <= 0
    // Quyền vào làm do server chốt: nó biết cả những điều kiện trang này không thấy. `justClosed`
    // chỉ để nút tắt ngay khi đồng hồ đếm về 0 mà không phải chờ tải lại trang.
    const canStart = assignment.canStart && !justClosed
    const isExpired = assignment.status === 'expired' || justClosed
    const isUrgent = canStart && remainingMs < urgentThresholdMs
    const openTimeReached = openDate !== null && openDate.getTime() <= Date.now()
    const maxScore = assignment.maxScore ?? roundToOneDecimal(exam.totalQuestions * exam.pointPerQuestion)
    // Bài đã chấm vẫn có thể bị giấu điểm, nên "đã chấm" chưa đủ để kết luận là có điểm để hiện.
    const hasVisibleScore = isGraded && assignment.score !== null
    const resultLink = assignment.attemptId ? `/hoc-sinh/ket-qua/${assignment.attemptId}` : '/hoc-sinh/ket-qua'

    const notes: { icon: LucideIcon; text: string }[] = [
      {
        icon: Timer,
        text: 'Bấm "Bắt đầu làm bài" là hệ thống tính giờ ngay. Đồng hồ vẫn chạy kể cả khi bạn đóng trang, nên chỉ bắt đầu khi bạn đã sẵn sàng.',
      },
      {
        icon: AlertTriangle,
        text: `Hết ${formatDuration(exam.durationMinutes)} làm bài, hệ thống sẽ tự động nộp phần bài bạn đã làm.`,
      },
      {
        icon: ListChecks,
        text: 'Bạn được chuyển qua lại giữa các câu hỏi và sửa đáp án bao nhiêu lần tùy ý trước khi nộp.',
      },
      {
        icon: Save,
        text: 'Đáp án được lưu tự động trong lúc làm, nếu lỡ tải lại trang thì bài làm vẫn còn nguyên.',
      },
    ]
    if (exam.shuffleQuestions || exam.shuffleAnswers) {
      notes.push({
        icon: Shuffle,
        text: 'Thứ tự câu hỏi và đáp án được xáo trộn riêng cho từng học sinh, đề của bạn không giống bạn bên cạnh.',
      })
    }
    notes.push({
      icon: Eye,
      text: exam.showResultAfterSubmit
        ? 'Điểm và đáp án đúng sẽ hiển thị ngay sau khi bạn nộp bài.'
        : 'Điểm sẽ hiển thị sau khi giáo viên chấm bài, không xem được đáp án ngay khi nộp.',
    })

    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-6">
            {/* Thông tin bài kiểm tra */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up">
              <div className="h-1.5 w-full" style={{ background: assignment.topicColor }} />
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <TopicBadge topic={assignment.topic} />
                  {isUrgent && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600 inline-flex items-center gap-1">
                      <AlertTriangle size={11} /> Sắp hết hạn
                    </span>
                  )}
                  {isSubmitted && <StatusBadge status="submitted" />}
                  {isGraded && <StatusBadge status="graded" />}
                  {isExpired && <StatusBadge status="expired" />}
                </div>

                <h1 className="text-2xl font-bold text-slate-800 leading-snug">{assignment.name}</h1>
                <p className="text-sm text-slate-400 mt-1.5">Giáo viên: {assignment.teacher}</p>
                {assignment.description && (
                  <p className="text-sm text-slate-500 leading-relaxed mt-4">{assignment.description}</p>
                )}
              </div>
            </section>

            {/* Cấu trúc đề */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up">
              <h2 className="text-base font-bold text-slate-800 mb-4">Thông tin đề bài</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <InfoTile
                  icon={FileText}
                  label="Số câu hỏi"
                  value={`${exam.totalQuestions} câu`}
                  iconBg="bg-indigo-50"
                  iconColor="text-indigo-600"
                />
                <InfoTile
                  icon={Clock}
                  label="Thời gian làm bài"
                  value={formatDuration(exam.durationMinutes)}
                  iconBg="bg-violet-50"
                  iconColor="text-violet-600"
                />
                <InfoTile
                  icon={Trophy}
                  label="Điểm tối đa"
                  value={`${formatScore(maxScore)} điểm`}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-600"
                />
                <InfoTile
                  icon={Award}
                  label="Điểm mỗi câu"
                  value={`${formatScore(exam.pointPerQuestion)} điểm`}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <InfoTile
                  icon={CalendarClock}
                  label="Mở làm bài từ"
                  value={formatDateTime(assignment.openAt)}
                  iconBg="bg-sky-50"
                  iconColor="text-sky-600"
                />
                <InfoTile
                  icon={Lock}
                  label="Hạn nộp bài"
                  value={formatDateTime(assignment.closeAt)}
                  iconBg="bg-rose-50"
                  iconColor="text-rose-600"
                />
              </div>
            </section>

            {/* Lưu ý, chỉ hiện khi bài còn có thể làm */}
            {(canStart || isUpcoming) && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-800">Lưu ý trước khi làm bài</h2>
                </div>
                <ul className="space-y-3">
                  {notes.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={15} className="text-indigo-600" />
                      </span>
                      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Bảng hành động */}
          <aside className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 lg:sticky lg:top-24 animate-fade-in-up">
            {canStart && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Thời gian còn lại để nộp</p>
                <p className={`text-3xl font-bold mt-1.5 ${isUrgent ? 'text-red-600' : 'text-indigo-600'}`}>
                  {closeCountdown}
                </p>
                <p className="text-xs text-slate-400 mt-1.5">Đóng lúc {formatDateTime(assignment.closeAt)}</p>

                <button
                  type="button"
                  onClick={() => void requestStart()}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  <PlayCircle size={18} /> Bắt đầu làm bài
                </button>
                <p className="text-xs text-slate-400 leading-relaxed mt-3 text-center">
                  Hệ thống bắt đầu tính giờ ngay khi bạn xác nhận.
                </p>
              </>
            )}

            {isUpcoming && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {openTimeReached ? 'Bài kiểm tra vừa mở' : 'Bài kiểm tra sẽ mở sau'}
                </p>
                <p className="text-3xl font-bold text-slate-700 mt-1.5">
                  {openTimeReached ? 'Đã đến giờ' : openCountdown}
                </p>
                <p className="text-xs text-slate-400 mt-1.5">Mở lúc {formatDateTime(assignment.openAt)}</p>

                {openTimeReached ? (
                  <>
                    <button
                      type="button"
                      onClick={reload}
                      className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                    >
                      <RefreshCw size={17} /> Tải lại để vào làm bài
                    </button>
                    <p className="text-xs text-slate-500 leading-relaxed mt-3 text-center">
                      Đã tới giờ mở đề. Hãy tải lại trang để bắt đầu làm bài.
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed"
                    >
                      <Lock size={17} /> Chưa đến giờ làm bài
                    </button>
                    <p className="text-xs text-slate-500 leading-relaxed mt-3 text-center">
                      Bạn có thể vào làm bài sau <strong className="text-slate-700">{openCountdown}</strong> nữa.
                      Hãy quay lại đúng giờ để có đủ thời gian làm bài.
                    </p>
                  </>
                )}
              </>
            )}

            {isDone && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {hasVisibleScore ? 'Điểm của bạn' : 'Trạng thái bài làm'}
                </p>
                {hasVisibleScore ? (
                  <p className="text-3xl font-bold text-emerald-600 mt-1.5">
                    {formatScore(assignment.score)}
                    <span className="text-base font-semibold text-slate-400">/{formatScore(maxScore)}</span>
                  </p>
                ) : isGraded ? (
                  <p className="text-xl font-bold text-slate-500 mt-1.5 inline-flex items-center gap-2">
                    <Hourglass size={20} /> Giáo viên chưa công bố điểm
                  </p>
                ) : (
                  <p className="text-xl font-bold text-purple-600 mt-1.5 inline-flex items-center gap-2">
                    <Hourglass size={20} /> Chờ giáo viên chấm
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5 inline-flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  Bạn đã nộp bài kiểm tra này, không thể làm lại.
                </p>

                <NavLink
                  to={resultLink}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  <Eye size={17} /> Xem kết quả
                </NavLink>
              </>
            )}

            {isExpired && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bài kiểm tra đã đóng</p>
                <p className="text-xl font-bold text-slate-600 mt-1.5">{formatDateTime(assignment.closeAt)}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">
                  Đã quá hạn nộp nên bạn không thể vào làm bài. Hãy liên hệ giáo viên nếu bạn có lý do chính đáng.
                </p>

                <button
                  type="button"
                  disabled
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed"
                >
                  <Lock size={17} /> Đã hết hạn nộp bài
                </button>
                {assignment.attemptId && (
                  <NavLink
                    to={resultLink}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold text-sm transition-colors"
                  >
                    <Eye size={16} /> Xem kết quả
                  </NavLink>
                )}
              </>
            )}

            <NavLink
              to="/hoc-sinh/bai-kiem-tra"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold text-sm transition-colors"
            >
              <ArrowLeft size={16} /> Quay lại danh sách
            </NavLink>
          </aside>
        </div>
      </>
    )
  }

  return (
    <StudentLayout>
      <div className="mb-5 animate-fade-in-up">
        <NavLink
          to="/hoc-sinh/bai-kiem-tra"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại danh sách bài kiểm tra
        </NavLink>
      </div>

      {renderBody()}
    </StudentLayout>
  )
}
