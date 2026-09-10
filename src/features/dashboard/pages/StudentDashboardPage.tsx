import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, CheckSquare, Clock, PlayCircle, ChevronRight, Trophy, AlertCircle,
  Award, BookOpen, CalendarDays, Eye, Hourglass,
} from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import { StatusBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { getStudentDashboard } from '../../../services/dashboardService'
import { getCurrentUser } from '../../../services/authService'
import { formatDateTime, formatScore } from '../../../lib/format'
import { getTopicLabel } from '../../../lib/topicTheme'
import type { ResultSummary, StudentExamItem } from '../../../types'

/** Còn dưới 6 giờ thì bài kiểm tra được coi là gấp và hiện cảnh báo đỏ. */
const urgentThresholdMs = 6 * 3600000

/**
 * Nhịp đồng hồ dùng chung cho cả trang: nhờ nó cảnh báo "sắp hết hạn" tự hiện khi một bài
 * chạm ngưỡng gấp và tự ẩn khi bài đó hết hạn, không cần người dùng tải lại trang.
 */
function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}

function buildGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

// ===== Thành phần nhỏ dùng riêng cho trang =====

function Countdown({ deadline }: { deadline: Date }) {
  const [timeLeft, setTimeLeft] = useState('')
  const deadlineTime = deadline.getTime()

  useEffect(() => {
    const calculate = () => {
      const remaining = deadlineTime - Date.now()
      if (remaining <= 0) {
        setTimeLeft('Đã hết hạn')
        return
      }
      const days = Math.floor(remaining / 86400000)
      const hours = Math.floor((remaining % 86400000) / 3600000)
      const minutes = Math.floor((remaining % 3600000) / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      if (days > 0) setTimeLeft(`${days} ngày ${hours} giờ`)
      else if (hours > 0) setTimeLeft(`${hours} giờ ${minutes} phút`)
      else setTimeLeft(`${minutes}:${String(seconds).padStart(2, '0')}`)
    }

    calculate()
    const timer = setInterval(calculate, 1000)
    return () => clearInterval(timer)
  }, [deadlineTime])

  return <span>{timeLeft}</span>
}

function ScoreRing({ score }: { score: number | null }) {
  // score null nghĩa là đề đang giấu điểm chứ không phải được 0 — vẽ vòng xám trung tính, vì một
  // vòng đỏ ghi 0.0 sẽ khiến học sinh tưởng mình làm sai hết.
  const { color, label } =
    score === null ? { color: '#94A3B8', label: 'Chưa hiện' } :
    score >= 8   ? { color: '#10B981', label: 'Giỏi' } :
    score >= 6.5 ? { color: '#F59E0B', label: 'Khá' } :
    score >= 5   ? { color: '#F97316', label: 'TB' } :
                   { color: '#EF4444', label: 'Yếu' }
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg"
        style={{ background: `${color}18`, color, border: `2.5px solid ${color}` }}
      >
        {formatScore(score)}
      </div>
      <span className="text-xs font-medium mt-1" style={{ color }}>{label}</span>
    </div>
  )
}

function PendingRing() {
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-purple-50 border-2 border-purple-200">
        <Hourglass size={20} className="text-purple-500" />
      </div>
      <span className="text-xs font-medium mt-1 text-purple-500">Chờ chấm</span>
    </div>
  )
}

function SectionNote({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}

function OpenExamCard({ exam, index, now }: { exam: StudentExamItem; index: number; now: number }) {
  const remainingMs = exam.deadline.getTime() - now
  // Bài đã quá hạn thì không còn là "sắp hết hạn" nữa, tránh nhãn đỏ đi kèm chữ "Đã hết hạn".
  const isUrgent = remainingMs > 0 && remainingMs <= urgentThresholdMs

  return (
    <div
      className="rounded-3xl p-6 text-white shadow-lg relative overflow-hidden animate-fade-in-up"
      style={{
        background: `linear-gradient(135deg, ${exam.topicColor}, #6366F1)`,
        animationDelay: `${index * 0.08}s`,
      }}
    >
      <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />

      <div className="relative">
        {isUrgent && (
          <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full mb-3">
            ⚡ Sắp hết hạn
          </span>
        )}

        <p className="text-xs font-medium mb-1 opacity-70">{getTopicLabel(exam.topic)}</p>
        <h3 className="font-bold text-xl leading-snug mb-5">{exam.name}</h3>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm mb-6 opacity-80">
          <span className="flex items-center gap-1.5"><Clock size={14} />{exam.durationMinutes} phút</span>
          <span className="flex items-center gap-1.5"><FileText size={14} />{exam.totalQuestions} câu hỏi</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs opacity-60 mb-0.5">⏰ Còn lại</p>
            <p className="font-bold text-lg"><Countdown deadline={exam.deadline} /></p>
          </div>
          <Link
            to={`/hoc-sinh/bai-kiem-tra/${exam.assignmentId}`}
            className="flex items-center gap-2 bg-white font-bold text-sm px-5 py-2.5 rounded-2xl shadow hover:opacity-90 transition-opacity text-indigo-700"
          >
            <PlayCircle size={16} /> Bắt đầu làm
          </Link>
        </div>
      </div>
    </div>
  )
}

function ResultRow({ result }: { result: ResultSummary }) {
  const isGraded = result.status === 'graded'
  // Bài đã chấm nhưng bị giấu kết quả thì không có số câu đúng để nói, chỉ còn mốc nộp bài.
  const gradedNote =
    result.correctCount === null
      ? `Nộp ${formatDateTime(result.submittedAt)}`
      : `${result.correctCount}/${result.totalQuestions} câu đúng · Nộp ${formatDateTime(result.submittedAt)}`

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
      {isGraded ? <ScoreRing score={result.score} /> : <PendingRing />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{result.examTitle}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {isGraded
            ? gradedNote
            : `Đã nộp lúc ${formatDateTime(result.submittedAt)} · Chờ giáo viên chấm`}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={result.status} />
        <Link
          to={`/hoc-sinh/ket-qua/${result.attemptId}`}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold px-3 py-1.5 rounded-xl transition-colors"
        >
          <Eye size={13} /> Xem lại
        </Link>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <SkeletonBlock className="h-44 w-full rounded-3xl mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <SkeletonBlock className="h-56 w-full rounded-3xl" />
        <SkeletonBlock className="h-56 w-full rounded-3xl" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        {[0, 1, 2].map(rowKey => (
          <div key={rowKey} className="flex items-center gap-4 px-5 py-4">
            <SkeletonBlock className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
            <SkeletonBlock className="h-7 w-20 rounded-xl" />
          </div>
        ))}
      </div>
    </>
  )
}

// ===== Trang =====

export default function StudentDashboardPage() {
  const { data, loading, error, reload } = useAsync(getStudentDashboard, [])
  const now = useNowTick(30000)
  const currentUser = getCurrentUser()
  const studentName = currentUser?.fullName ?? 'Học sinh'
  const greeting = buildGreeting()

  if (error) {
    return (
      <StudentLayout>
        <ErrorState message={error} onRetry={reload} />
      </StudentLayout>
    )
  }

  if (loading && data === undefined) {
    return (
      <StudentLayout>
        <DashboardSkeleton />
      </StudentLayout>
    )
  }

  const stats = data?.stats
  const openExams = data?.openExams ?? []
  const upcomingExams = data?.upcomingExams ?? []
  const recentResults = data?.recentResults ?? []
  // openExams đã được service sắp theo hạn tăng dần nên phần tử đầu chính là bài gấp nhất.
  const urgentExams = openExams.filter(exam => {
    const remainingMs = exam.deadline.getTime() - now
    return remainingMs > 0 && remainingMs <= urgentThresholdMs
  })
  const nearestUrgent = urgentExams.length > 0 ? urgentExams[0] : undefined
  const hasNothing =
    openExams.length === 0 &&
    upcomingExams.length === 0 &&
    recentResults.length === 0 &&
    (stats?.assignedCount ?? 0) === 0

  const heroMessage =
    openExams.length > 0
      ? <>Bạn có <span className="text-white font-semibold">{openExams.length} bài đang mở</span> — hãy hoàn thành đúng hạn nhé!</>
      : upcomingExams.length > 0
        ? <>Hiện chưa có bài nào đang mở, <span className="text-white font-semibold">{upcomingExams.length} bài sắp diễn ra</span>.</>
        : hasNothing
          ? <>Chưa có bài kiểm tra nào được giao cho bạn.</>
          : (stats?.completedCount ?? 0) > 0
            ? <>Bạn đã hoàn thành hết bài được giao. Cùng xem lại kết quả nhé!</>
            : <>Hiện không có bài kiểm tra nào đang mở dành cho bạn.</>

  const heroPills = [
    { icon: FileText,    value: String(stats?.assignedCount ?? 0),      label: 'Được giao', background: 'rgba(255,255,255,0.15)' },
    { icon: CheckSquare, value: String(stats?.completedCount ?? 0),     label: 'Đã xong',   background: 'rgba(16,185,129,0.3)' },
    { icon: Trophy,      value: formatScore(stats?.averageScore),     label: 'Điểm TB',   background: 'rgba(245,158,11,0.3)' },
    { icon: Award,       value: formatScore(stats?.bestScore),        label: 'Cao nhất',  background: 'rgba(59,130,246,0.35)' },
  ]

  return (
    <StudentLayout>
      {/* ===== Lời chào ===== */}
      <div
        className="rounded-3xl p-7 mb-8 relative overflow-hidden animate-fade-in-up"
        style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 60%, #A78BFA 100%)' }}
      >
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-indigo-200 text-sm font-medium mb-1">{greeting} 👋</p>
            <h1 className="text-white font-bold text-3xl mb-2 break-words">{studentName}</h1>
            <p className="text-indigo-200 text-sm">{heroMessage}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {heroPills.map(({ icon: Icon, value, label, background }) => (
              <div key={label} className="flex flex-col items-center px-4 py-3 rounded-2xl min-w-[76px]" style={{ background }}>
                <Icon size={16} className="text-white mb-1 opacity-80" />
                <span className="text-white font-bold text-lg leading-none">{value}</span>
                <span className="text-indigo-200 text-xs mt-0.5 text-center">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Cảnh báo bài sắp hết hạn ===== */}
      {nearestUrgent && (
        <div className="mb-6 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 flex flex-wrap items-center gap-3 animate-fade-in-up">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium leading-relaxed flex-1 min-w-0">
            {urgentExams.length === 1 ? (
              <>
                ⚡ Bài <strong>{nearestUrgent.name}</strong> sắp hết hạn — chỉ còn{' '}
                <strong><Countdown deadline={nearestUrgent.deadline} /></strong>!
              </>
            ) : (
              <>
                ⚡ Có <strong>{urgentExams.length} bài</strong> sắp hết hạn, gần nhất là{' '}
                <strong>{nearestUrgent.name}</strong> — chỉ còn{' '}
                <strong><Countdown deadline={nearestUrgent.deadline} /></strong>!
              </>
            )}
          </p>
          <Link
            to={`/hoc-sinh/bai-kiem-tra/${nearestUrgent.assignmentId}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors flex-shrink-0"
          >
            <PlayCircle size={14} /> Làm ngay
          </Link>
        </div>
      )}

      {hasNothing ? (
        <EmptyState
          icon={BookOpen}
          title="Chưa có bài kiểm tra nào"
          description="Khi giáo viên giao bài, bài kiểm tra sẽ xuất hiện ngay tại đây kèm hạn nộp và thời gian làm bài."
          action={
            <Link
              to="/hoc-sinh/bai-kiem-tra"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Mở danh sách bài kiểm tra <ChevronRight size={15} />
            </Link>
          }
        />
      ) : (
        <>
          {/* ===== Đang mở ===== */}
          <section className="mb-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-800">🔥 Đang mở — cần làm ngay</h2>
              <Link
                to="/hoc-sinh/bai-kiem-tra"
                className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
              >
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            {openExams.length === 0 ? (
              <SectionNote text="Hiện không có bài kiểm tra nào đang mở. Hãy chuẩn bị cho những bài sắp tới nhé!" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {openExams.map((exam, index) => (
                  <OpenExamCard key={exam.assignmentId} exam={exam} index={index} now={now} />
                ))}
              </div>
            )}
          </section>

          {/* ===== Sắp tới ===== */}
          <section className="mb-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-800">📅 Sắp tới</h2>
              <Link
                to="/hoc-sinh/bai-kiem-tra"
                className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
              >
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            {upcomingExams.length === 0 ? (
              <SectionNote text="Chưa có bài kiểm tra nào được lên lịch trong thời gian tới." />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                {upcomingExams.map(exam => (
                  <Link
                    key={exam.assignmentId}
                    to={`/hoc-sinh/bai-kiem-tra/${exam.assignmentId}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{exam.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {getTopicLabel(exam.topic)} · {exam.totalQuestions} câu · {exam.durationMinutes} phút
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                      <CalendarDays size={13} /> Mở vào {formatDateTime(exam.openAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ===== Kết quả gần đây ===== */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-800">✅ Kết quả gần đây</h2>
              <Link
                to="/hoc-sinh/ket-qua"
                className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
              >
                Xem tất cả <ChevronRight size={16} />
              </Link>
            </div>
            {recentResults.length === 0 ? (
              <SectionNote text="Bạn chưa nộp bài kiểm tra nào. Điểm số sẽ hiện ở đây sau khi bài được chấm." />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                {recentResults.map(result => (
                  <ResultRow key={result.attemptId} result={result} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </StudentLayout>
  )
}
