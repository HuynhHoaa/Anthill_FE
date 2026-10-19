import { useEffect, useState } from 'react'
import { NavLink, useParams, useSearchParams } from 'react-router-dom'
import {
  AlarmClock, AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, Clock, Eye, FileText, Home,
  Hourglass, Trophy, type LucideIcon,
} from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { StatusBadge } from '../../../components/common/Badge'
import { useAsync } from '../../../hooks/useAsync'
import { formatDateTime, formatDuration, formatScore, getScoreTone } from '../../../lib/format'
import { getTopicLabel } from '../../../lib/topicTheme'
import { getAttemptDetail } from '../../../services/resultService'
import type { AttemptDetail } from '../../../types'

const RING_RADIUS = 52
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface ScoreRingProps {
  score: number
  maxScore: number
}

/** Vòng tròn điểm, chạy từ 0 tới tỷ lệ thật khi vào trang để tạo cảm giác chúc mừng. */
function ScoreRing({ score, maxScore }: ScoreRingProps) {
  // Quy về tỷ lệ theo điểm tối đa của chính đề này trước khi xếp loại (H7) — nếu không, cùng một
  // bài làm có thể xếp "Giỏi" ở đây mà "Yếu" ở trang danh sách bài kiểm tra, hay ngược lại.
  const tone = getScoreTone(score, maxScore)
  const ratio = maxScore > 0 ? Math.min(1, Math.max(0, score / maxScore)) : 0
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setProgress(ratio), 120)
    return () => window.clearTimeout(timer)
  }, [ratio])

  return (
    <div className={`relative w-36 h-36 mx-auto ${tone.color}`}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={RING_RADIUS} fill="none" stroke="#F1F5F9" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold leading-none">{formatScore(score)}</span>
        <span className="text-xs font-medium text-slate-400 mt-1.5">trên {formatScore(maxScore)}</span>
      </div>
    </div>
  )
}

interface SummaryTileProps {
  icon: LucideIcon
  label: string
  value: string
  iconClass: string
}

function SummaryTile({ icon: Icon, label, value, iconClass }: SummaryTileProps) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
      <Icon size={20} className={`${iconClass} mx-auto mb-2`} />
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}

function SubmittedSkeleton() {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-sm p-8 animate-fade-in-up">
      <SkeletonBlock className="h-20 w-20 rounded-full mx-auto" />
      <SkeletonBlock className="h-5 w-64 mx-auto mt-6" />
      <SkeletonBlock className="h-3.5 w-80 max-w-full mx-auto mt-3" />
      <SkeletonBlock className="h-36 w-36 rounded-full mx-auto mt-8" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
        {[0, 1, 2].map(tile => (
          <SkeletonBlock key={tile} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <SkeletonBlock className="h-12 w-44 rounded-2xl" />
        <SkeletonBlock className="h-12 w-44 rounded-2xl" />
      </div>
    </div>
  )
}

export default function ExamSubmittedPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const [searchParams] = useSearchParams()
  const isAutoSubmitted = searchParams.get('tu-dong') === '1'
  // Số câu TakeExamPage đã chọn nhưng server báo về không nhận được (xem finishAttempt). Đi kèm
  // route bằng query param, không phải toast, vì toast tắt sau vài giây còn học sinh auto-submit
  // có thể đã rời máy — cảnh báo này phải còn nguyên khi họ quay lại xem trang.
  const missingAnswersParam = Number(searchParams.get('thieu-dap-an'))
  const missingAnswersCount =
    Number.isFinite(missingAnswersParam) && missingAnswersParam > 0 ? Math.trunc(missingAnswersParam) : 0
  const hasMissingAnswers = missingAnswersCount > 0

  const parsedAttemptId = Number(attemptId)
  const isValidAttemptId = Number.isFinite(parsedAttemptId) && parsedAttemptId > 0

  const { data: detail, loading, error, reload } = useAsync<AttemptDetail>(
    () =>
      isValidAttemptId
        ? getAttemptDetail(parsedAttemptId)
        : Promise.reject(new Error('Đường dẫn bài làm không hợp lệ.')),
    [parsedAttemptId, isValidAttemptId],
  )

  if (loading && !detail) {
    return (
      <StudentLayout>
        <SubmittedSkeleton />
      </StudentLayout>
    )
  }

  if (error || !detail) {
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

  if (detail.totalQuestions === 0) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto">
          <EmptyState
            icon={FileText}
            title="Bài làm chưa có dữ liệu câu hỏi"
            description="Hệ thống đã ghi nhận lượt làm bài nhưng chưa có câu hỏi nào được lưu. Vui lòng liên hệ giáo viên phụ trách."
            action={
              <NavLink
                to="/hoc-sinh/bang-diem"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                <Trophy size={16} /> Bảng điểm
              </NavLink>
            }
          />
        </div>
      </StudentLayout>
    )
  }

  // Vắng điểm (`null`) là "chưa được phép xem", không phải 0 — và nó tách rời với quyền xem đáp án,
  // nên vòng tròn điểm bám vào chính sự có mặt của điểm chứ không bám vào `showAnswers`.
  const scoreTone = detail.score === null ? null : getScoreTone(detail.score, detail.maxScore)

  return (
    <StudentLayout>
      <div className="max-w-2xl mx-auto">
        {/*
          Cảnh báo này KHÔNG tự tắt và đứng trước cả banner tự-động-nộp: đây là phần trung thực
          thay cho toast "Nộp bài thành công" — server đã nhận request (200) nhưng ghi nhận ít câu
          hơn số câu học sinh thật sự đã chọn lúc bấm nộp/hết giờ. Im lặng ở đây đúng là điều audit
          đã bắt lỗi.
        */}
        {hasMissingAnswers && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 flex items-start gap-3 animate-fade-in-up"
          >
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">Bài nộp có thể thiếu câu trả lời</p>
              <p className="text-sm text-red-600 mt-0.5 leading-relaxed">
                Hệ thống chỉ ghi nhận được bản lưu gần nhất, thiếu khoảng {missingAnswersCount} câu bạn
                đã chọn ngay trước khi hết giờ — có thể do gói tin nộp bài tới server trễ hơn hạn cho
                phép. Những câu đó đang được tính là chưa trả lời. Nếu thấy điểm không khớp với bài
                đã làm, hãy báo giáo viên phụ trách kèm mã bài làm bên dưới.
              </p>
            </div>
          </div>
        )}

        {isAutoSubmitted && !hasMissingAnswers && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-start gap-3 animate-fade-in-up">
            <AlarmClock size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-700">Bài làm được nộp tự động</p>
              <p className="text-sm text-amber-600 mt-0.5 leading-relaxed">
                Đã hết thời gian làm bài nên hệ thống tự động nộp giúp bạn. Những câu chưa trả lời được
                tính là chưa làm.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 text-center animate-fade-in-up">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 animate-modal-in ${
              hasMissingAnswers ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {hasMissingAnswers ? <AlertTriangle size={42} /> : <CheckCircle2 size={42} />}
          </div>

          <p className="text-xs font-semibold text-indigo-600 mb-2">
            {getTopicLabel(detail.topic)} · Mã bài làm #{detail.attemptId}
          </p>
          <h1 className="text-2xl font-bold text-slate-800">
            {hasMissingAnswers
              ? 'Bài làm đã được nộp, nhưng có thể thiếu câu trả lời'
              : isAutoSubmitted
                ? 'Bài làm của bạn đã được nộp'
                : 'Bạn đã nộp bài thành công'}
          </h1>
          <p className="text-sm text-slate-500 mt-2.5 leading-relaxed max-w-lg mx-auto">
            {detail.examTitle}
          </p>
          <div className="mt-4 flex justify-center">
            <StatusBadge status={detail.status} />
          </div>

          {scoreTone && detail.score !== null && detail.maxScore !== null ? (
            <div className="mt-8">
              <ScoreRing score={detail.score} maxScore={detail.maxScore} />
              <span
                className={`inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 rounded-full text-sm font-semibold ${scoreTone.bg} ${scoreTone.color}`}
              >
                <Trophy size={15} /> Xếp loại: {scoreTone.label}
              </span>
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-5 flex items-start gap-3 text-left">
              <Hourglass size={20} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-800">Kết quả sẽ được công bố sau</p>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Bài kiểm tra này không hiển thị điểm ngay sau khi nộp. Giáo viên sẽ công bố kết quả và
                  bạn sẽ nhận được thông báo khi điểm có sẵn trong mục Kết quả của tôi.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
            {detail.correctCount !== null ? (
              <SummaryTile
                icon={CheckCircle2}
                iconClass="text-emerald-600"
                label="Số câu đúng"
                value={`${detail.correctCount}/${detail.totalQuestions}`}
              />
            ) : (
              <SummaryTile
                icon={FileText}
                iconClass="text-indigo-600"
                label="Số câu hỏi"
                value={`${detail.totalQuestions} câu`}
              />
            )}
            <SummaryTile
              icon={Clock}
              iconClass="text-indigo-600"
              label="Thời gian làm bài"
              value={formatDuration(detail.durationMinutes)}
            />
            <SummaryTile
              icon={CalendarClock}
              iconClass="text-amber-600"
              label="Thời điểm nộp"
              value={formatDateTime(detail.submittedAt)}
            />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <NavLink
              to="/hoc-sinh"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Home size={16} /> Về tổng quan
            </NavLink>
            {detail.showAnswers ? (
              <NavLink
                to={`/hoc-sinh/ket-qua/${detail.attemptId}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                <Eye size={16} /> Xem chi tiết đáp án
              </NavLink>
            ) : (
              <NavLink
                to="/hoc-sinh/bang-diem"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                <Trophy size={16} /> Bảng điểm
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  )
}
