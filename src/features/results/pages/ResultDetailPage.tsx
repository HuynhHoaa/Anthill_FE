import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleSlash, Clock, EyeOff,
  Hourglass, ListChecks, ShieldAlert, UserRound, XCircle,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import StudentLayout from '../../../components/layout/StudentLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { StatusBadge, TopicBadge } from '../../../components/common/Badge'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { getCurrentUser } from '../../../services/authService'
import { getAttemptDetail } from '../../../services/resultService'
import { formatDateTime, formatDuration, formatScore } from '../../../lib/format'
import type { AttemptAnswerDetail, AttemptDetail, ResultAudience } from '../../../types'
import ScoreRing from '../components/ScoreRing'

interface ResultDetailPageProps {
  audience: ResultAudience
}

type QuestionFilter = 'all' | 'wrong' | 'blank'

interface NumberedQuestion {
  question: AttemptAnswerDetail
  number: number
}

const badgeBase = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold'

const examTitleClass = 'text-2xl font-bold text-slate-800 leading-snug'

const inlineLinkClass = 'font-semibold text-slate-600 hover:text-indigo-600 hover:underline transition-colors'

function DetailShell({
  audience, pageSubtitle, children,
}: {
  audience: ResultAudience
  pageSubtitle?: string
  children: ReactNode
}) {
  if (audience === 'teacher') {
    return (
      <TeacherLayout pageTitle="Chi tiết kết quả" pageSubtitle={pageSubtitle}>
        {children}
      </TeacherLayout>
    )
  }
  return <StudentLayout>{children}</StudentLayout>
}

function SummaryRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  )
}

export default function ResultDetailPage({ audience }: ResultDetailPageProps) {
  const { attemptId } = useParams()
  const attemptIdNumber = Number(attemptId)
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all')

  const { data: detail, loading, error, reload } = useAsync<AttemptDetail>(
    () =>
      Number.isInteger(attemptIdNumber)
        ? getAttemptDetail(attemptIdNumber)
        : Promise.reject(new Error('Mã bài làm không hợp lệ.')),
    [attemptIdNumber],
  )

  const backTo = audience === 'teacher' ? '/giao-vien/ket-qua' : '/hoc-sinh/ket-qua'
  const selectedLabel = audience === 'teacher' ? 'Học sinh đã chọn' : 'Bạn đã chọn'

  const numberedQuestions = useMemo<NumberedQuestion[]>(
    () => (detail?.questions ?? []).map((question, index) => ({ question, number: index + 1 })),
    [detail],
  )

  const counts = useMemo(() => {
    const total = numberedQuestions.length
    const correct = numberedQuestions.filter(item => item.question.isCorrect).length
    const blank = numberedQuestions.filter(item => item.question.selectedAnswerId === null).length
    return { total, correct, blank, wrong: Math.max(0, total - correct - blank) }
  }, [numberedQuestions])

  const visibleQuestions = useMemo(
    () =>
      numberedQuestions.filter(({ question }) => {
        if (questionFilter === 'wrong') return !question.isCorrect && question.selectedAnswerId !== null
        if (questionFilter === 'blank') return question.selectedAnswerId === null
        return true
      }),
    [numberedQuestions, questionFilter],
  )

  const backLink = (
    <NavLink
      to={backTo}
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
    >
      <ArrowLeft size={16} /> Quay lại danh sách kết quả
    </NavLink>
  )

  if (loading && !detail) {
    return (
      <DetailShell audience={audience}>
        <div className="mb-5">{backLink}</div>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <SkeletonBlock className="h-32 rounded-2xl" />
            <SkeletonBlock className="h-44 rounded-2xl" />
            <SkeletonBlock className="h-44 rounded-2xl" />
          </div>
          <SkeletonBlock className="h-72 rounded-2xl" />
        </div>
      </DetailShell>
    )
  }

  if (error || !detail) {
    return (
      <DetailShell audience={audience}>
        <div className="mb-5">{backLink}</div>
        <ErrorState message={error ?? 'Không tìm thấy bài làm này.'} onRetry={reload} />
        <div className="mt-4 flex justify-center">
          <NavLink
            to={backTo}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <ArrowLeft size={16} /> Quay lại danh sách kết quả
          </NavLink>
        </div>
      </DetailShell>
    )
  }

  // Học sinh chỉ được xem bài làm của chính mình, kể cả khi tự gõ mã bài làm khác lên thanh địa chỉ.
  const currentUserCode = getCurrentUser()?.code ?? ''
  if (audience === 'student' && currentUserCode && detail.studentCode && currentUserCode !== detail.studentCode) {
    return (
      <DetailShell audience={audience}>
        <div className="mb-5">{backLink}</div>
        <EmptyState
          icon={ShieldAlert}
          title="Bài làm này không thuộc về bạn"
          description="Bạn chỉ xem được kết quả của những bài kiểm tra do chính mình thực hiện."
          action={
            <NavLink
              to={backTo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <ArrowLeft size={16} /> Về kết quả của tôi
            </NavLink>
          }
        />
      </DetailShell>
    )
  }

  const isGraded = detail.status === 'graded'
  // Chỉ giáo viên mới đi ngược về được các trang quản lý; học sinh giữ nguyên text thuần.
  const examDetailLink = `/giao-vien/bai-kiem-tra/${detail.examId}`
  const studentDetailLink = `/giao-vien/hoc-sinh/${detail.studentId}`
  const groupResultsLink = `/giao-vien/ket-qua?nhom=${encodeURIComponent(detail.group)}`
  // Giáo viên luôn xem được đáp án học sinh đã chọn; học sinh chỉ xem khi bài đã chấm và được cho phép.
  const canSeeAnswers = audience === 'teacher' || (isGraded && detail.showAnswers)
  const correctPercent = counts.total > 0 ? (counts.correct / counts.total) * 100 : 0
  const wrongPercent = counts.total > 0 ? (counts.wrong / counts.total) * 100 : 0
  const blankPercent = counts.total > 0 ? (counts.blank / counts.total) * 100 : 0

  const filterTabs: { key: QuestionFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tất cả', count: counts.total },
    { key: 'wrong', label: 'Câu sai', count: counts.wrong },
    { key: 'blank', label: 'Bỏ trống', count: counts.blank },
  ]

  const renderQuestions = () => {
    if (!canSeeAnswers) {
      if (!isGraded) {
        return (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 flex items-start gap-3">
            <Hourglass size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-700">Bài làm đang chờ chấm</p>
              <p className="text-sm text-amber-600 mt-1 leading-relaxed">
                Chi tiết đáp án sẽ hiển thị sau khi bài kiểm tra được chấm xong.
              </p>
            </div>
          </div>
        )
      }

      return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 flex items-start gap-3">
          <EyeOff size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-700">Giáo viên chưa công bố đáp án chi tiết</p>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Bạn xem được điểm tổng và số câu đúng. Chi tiết từng câu sẽ mở khi giáo viên cho phép.
            </p>
          </div>
        </div>
      )
    }

    if (counts.total === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="Chưa có dữ liệu chi tiết"
          description="Lượt làm bài này không lưu lại chi tiết từng câu trả lời."
        />
      )
    }

    return (
      <>
        {!isGraded && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex items-start gap-3 mb-4">
            <Hourglass size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-700">Bài làm chưa công bố kết quả</p>
              <p className="text-sm text-amber-600 mt-1 leading-relaxed">
                Học sinh chưa nhìn thấy điểm và đáp án của bài này. Bạn vẫn xem được toàn bộ lựa chọn của học sinh.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {filterTabs.map(({ key, label, count }) => {
            const isActive = questionFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setQuestionFilter(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                {label}
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {visibleQuestions.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-700">
              {questionFilter === 'wrong'
                ? 'Không có câu nào trả lời sai.'
                : questionFilter === 'blank'
                  ? 'Không có câu nào bị bỏ trống.'
                  : 'Không có câu nào để hiển thị.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleQuestions.map(({ question, number }) => {
              const isBlank = question.selectedAnswerId === null

              return (
                <div
                  key={question.questionId}
                  className="rounded-2xl border border-slate-100 p-5 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Câu {number} · {formatScore(question.point)} điểm
                      </p>
                      <h2 className="font-bold text-slate-800 mt-1 leading-relaxed">{question.content}</h2>
                    </div>
                    <span
                      className={`${badgeBase} flex-shrink-0 ${
                        isBlank
                          ? 'bg-slate-100 text-slate-500'
                          : question.isCorrect
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {isBlank ? (
                        <>
                          <CircleSlash size={13} /> Không trả lời
                        </>
                      ) : question.isCorrect ? (
                        <>
                          <CheckCircle2 size={13} /> Đúng
                        </>
                      ) : (
                        <>
                          <XCircle size={13} /> Sai
                        </>
                      )}
                    </span>
                  </div>

                  {question.imageUrl && (
                    <img
                      src={question.imageUrl}
                      alt={`Hình minh họa câu ${number}`}
                      className="mb-3 rounded-xl border border-slate-100 max-h-56 object-contain"
                    />
                  )}

                  <div className="space-y-2">
                    {question.answers.map(answer => {
                      const isCorrectAnswer = answer.id === question.correctAnswerId
                      const isSelected = answer.id === question.selectedAnswerId

                      return (
                        <div
                          key={answer.id}
                          className={`rounded-xl border px-4 py-3 text-sm ${
                            isCorrectAnswer
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : isSelected
                                ? 'border-red-200 bg-red-50 text-red-600'
                                : 'border-slate-100 bg-slate-50/70 text-slate-500'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{answer.content}</span>
                            <span className="flex flex-wrap gap-1.5">
                              {isSelected && (
                                <span
                                  className={`${badgeBase} ${
                                    isCorrectAnswer ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                  }`}
                                >
                                  {selectedLabel}
                                </span>
                              )}
                              {isCorrectAnswer && (
                                <span className={`${badgeBase} bg-emerald-100 text-emerald-700`}>Đáp án đúng</span>
                              )}
                            </span>
                          </div>
                          {answer.imageUrl && (
                            <img
                              src={answer.imageUrl}
                              alt={`Hình minh họa đáp án: ${answer.content}`}
                              className="mt-2 rounded-lg border border-white/60 max-h-28 object-contain"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {isBlank && (
                    <p className="mt-3 text-xs text-slate-400">
                      {audience === 'teacher' ? 'Học sinh không chọn đáp án nào cho câu này.' : 'Bạn đã bỏ trống câu này.'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  return (
    <DetailShell audience={audience} pageSubtitle={`${detail.examTitle} · ${detail.studentName}`}>
      <div className="mb-5">{backLink}</div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6 pb-6 border-b border-slate-50">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusBadge status={detail.status} />
                <TopicBadge topic={detail.topic} />
              </div>
              {audience === 'teacher' ? (
                <h1 className={examTitleClass}>
                  <NavLink
                    to={examDetailLink}
                    title="Mở chi tiết bài kiểm tra"
                    className="hover:text-indigo-600 hover:underline transition-colors"
                  >
                    {detail.examTitle}
                  </NavLink>
                </h1>
              ) : (
                <h1 className={examTitleClass}>{detail.examTitle}</h1>
              )}
              {audience === 'teacher' ? (
                <p className="text-sm text-slate-500 mt-1.5">
                  <NavLink
                    to={studentDetailLink}
                    title={`Xem hồ sơ và lịch sử làm bài của ${detail.studentName}`}
                    className={inlineLinkClass}
                  >
                    {detail.studentName}
                  </NavLink>
                  {detail.studentCode ? ` · ${detail.studentCode}` : ''}
                  {' · '}
                  <NavLink
                    to={groupResultsLink}
                    title={`Xem kết quả của nhóm ${detail.group}`}
                    className={inlineLinkClass}
                  >
                    {detail.group}
                  </NavLink>
                </p>
              ) : (
                <p className="text-sm text-slate-500 mt-1.5">Nộp lúc {formatDateTime(detail.submittedAt)}</p>
              )}
            </div>

            {isGraded ? (
              <ScoreRing score={detail.score} maxScore={detail.maxScore} size="lg" />
            ) : (
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center">
                  <Hourglass size={24} className="text-slate-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Chờ chấm</span>
              </div>
            )}
          </div>

          {renderQuestions()}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in-up">
            <h2 className="text-base font-bold text-slate-800 mb-4">Tổng kết</h2>

            {canSeeAnswers && counts.total > 0 && (
              <div className="mb-4">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${correctPercent}%` }} />
                  <div className="bg-red-400" style={{ width: `${wrongPercent}%` }} />
                  <div className="bg-slate-300" style={{ width: `${blankPercent}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Đúng {counts.correct}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" /> Sai {counts.wrong}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" /> Bỏ trống {counts.blank}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3 text-sm">
              <SummaryRow
                label="Điểm"
                value={
                  isGraded ? (
                    <span className="text-indigo-600 font-bold">
                      {formatScore(detail.score)}
                      <span className="text-xs font-medium text-slate-400"> / {formatScore(detail.maxScore)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Chờ chấm</span>
                  )
                }
              />
              <SummaryRow
                label="Số câu đúng"
                value={
                  canSeeAnswers && counts.total > 0 ? (
                    <span className="text-emerald-600 font-bold">
                      {counts.correct}/{counts.total}
                    </span>
                  ) : isGraded ? (
                    <span className="text-emerald-600 font-bold">
                      {detail.correctCount}/{detail.totalQuestions}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )
                }
              />
              {canSeeAnswers && (
                <>
                  <SummaryRow
                    label="Số câu sai"
                    value={<span className="text-red-500 font-bold">{counts.wrong}</span>}
                  />
                  <SummaryRow
                    label="Số câu bỏ trống"
                    value={<span className="text-slate-500 font-bold">{counts.blank}</span>}
                  />
                </>
              )}
              <SummaryRow
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={14} /> Thời gian làm
                  </span>
                }
                value={formatDuration(detail.durationMinutes)}
              />
              <SummaryRow
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} /> Ngày nộp
                  </span>
                }
                value={formatDateTime(detail.submittedAt)}
              />
            </div>
          </div>

          {audience === 'teacher' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in-up">
              <h2 className="text-base font-bold text-slate-800 mb-4">Học sinh</h2>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <UserRound size={20} className="text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{detail.studentName}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {detail.studentCode ? `${detail.studentCode} · ` : ''}
                    {detail.group}
                  </p>
                </div>
              </div>

              <NavLink
                to={studentDetailLink}
                className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Xem tất cả bài làm của học sinh này
                <ArrowRight size={16} className="flex-shrink-0" />
              </NavLink>
            </div>
          )}
        </aside>
      </div>
    </DetailShell>
  )
}
