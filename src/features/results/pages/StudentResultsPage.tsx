import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CalendarDays, CheckCircle2, Clock, Eye, FileText, Hourglass, Search,
} from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import { StatusBadge, TopicBadge } from '../../../components/common/Badge'
import { SkeletonCards } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { useRealtimeRefresh } from '../../../hooks/useRealtime'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { listMyResults } from '../../../services/resultService'
import { listMyExams } from '../../../services/attemptService'
import { formatDateTime, formatDuration, formatScore } from '../../../lib/format'
import ScoreRing from '../components/ScoreRing'

const PAGE_SIZE = 6

/** Tổng hợp thống kê cần đọc toàn bộ kết quả, không phụ thuộc trang đang xem. */
const SUMMARY_PAGE_SIZE = 200

const chipClass =
  'inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg'

export default function StudentResultsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const search = useDebouncedValue(searchInput)

  const {
    data: results,
    loading: resultsLoading,
    error: resultsError,
    reload: reloadResults,
    refresh: refreshResults,
  } = useAsync(() => listMyResults({ search, page, pageSize: PAGE_SIZE }), [search, page])

  const { data: summary, refresh: refreshSummary } = useAsync(
    () => listMyResults({ page: 1, pageSize: SUMMARY_PAGE_SIZE }),
    [],
  )

  // Bài của chính em vừa bị hệ thống nộp thay: kết quả mới xuất hiện mà không phải tải lại trang.
  useRealtimeRefresh(['AutoSubmitted'], () => {
    refreshResults()
    refreshSummary()
  })

  const { data: myExams } = useAsync(() => listMyExams(), [])

  // Gõ từ khoá mới thì quay về trang đầu, tránh rơi vào trang trống của kết quả cũ.
  const changeSearch = (value: string) => {
    setSearchInput(value)
    setPage(1)
  }

  // Map examId -> chủ đề, để thẻ kết quả hiển thị đúng màu chủ đề như trang bài kiểm tra.
  const topicByExamId = useMemo(() => {
    const map = new Map<number, string>()
    myExams?.forEach(exam => {
      map.set(exam.examId, exam.topic)
    })
    return map
  }, [myExams])

  // Dòng số liệu dưới tiêu đề: chưa nộp bài nào (hoặc đang tải/lỗi) thì trả về undefined
  // để phụ đề lùi về câu mô tả tĩnh. Mọi phép tính đều chặn trước mảng rỗng và chia cho 0.
  const summaryText = useMemo(() => {
    const allResults = summary?.items ?? []
    if (allResults.length === 0) return undefined

    const gradedResults = allResults.filter(result => result.status === 'graded')
    const parts = [`${allResults.length} bài đã nộp`]

    if (gradedResults.length === 0) {
      parts.push('chờ công bố điểm')
      return parts.join(' · ')
    }

    // Bài đã chấm vẫn có thể bị giấu kết quả. Những bài đó không có con số nào để cộng, và coi
    // chúng như 0 sẽ kéo cả điểm trung bình lẫn tỷ lệ câu đúng xuống mà không để lại dấu vết gì
    // trên màn hình — nên lọc hẳn ra trước khi tính.
    const visibleScores = gradedResults
      .map(result => result.score)
      .filter((score): score is number => score !== null)

    if (visibleScores.length === 0) {
      parts.push('chờ công bố điểm')
      return parts.join(' · ')
    }

    const visibleCounts = gradedResults
      .map(result =>
        result.correctCount === null
          ? null
          : { correct: result.correctCount, total: result.totalQuestions },
      )
      .filter((entry): entry is { correct: number; total: number } => entry !== null)

    const totalScore = visibleScores.reduce((total, score) => total + score, 0)
    const totalQuestions = visibleCounts.reduce((total, entry) => total + entry.total, 0)
    const totalCorrect = visibleCounts.reduce((total, entry) => total + entry.correct, 0)

    parts.push(`điểm trung bình ${formatScore(totalScore / visibleScores.length)}`)
    parts.push(`cao nhất ${formatScore(Math.max(...visibleScores))}`)
    if (totalQuestions > 0) {
      parts.push(`${Math.round((totalCorrect / totalQuestions) * 100)}% câu đúng`)
    }

    return parts.join(' · ')
  }, [summary])

  const items = results?.items ?? []

  const renderList = () => {
    if (resultsError) {
      return <ErrorState message={resultsError} onRetry={reloadResults} />
    }

    if (resultsLoading && !results) {
      return <SkeletonCards count={3} className="grid grid-cols-1 gap-4" />
    }

    if (items.length === 0) {
      return search.trim() !== '' ? (
        <EmptyState
          icon={Search}
          title="Không tìm thấy bài nào"
          description={`Không có kết quả nào khớp với từ khoá "${search.trim()}". Thử tìm với từ khoá khác nhé.`}
          action={
            <button
              type="button"
              onClick={() => changeSearch('')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Xoá tìm kiếm
            </button>
          }
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="Bạn chưa hoàn thành bài nào"
          description="Kết quả sẽ xuất hiện tại đây ngay sau khi bạn nộp bài kiểm tra đầu tiên."
          action={
            <NavLink
              to="/hoc-sinh/bai-kiem-tra"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              <FileText size={16} /> Tới bài kiểm tra của tôi
            </NavLink>
          }
        />
      )
    }

    return (
      <>
        <div className={`space-y-4 transition-opacity ${resultsLoading ? 'opacity-60' : 'opacity-100'}`}>
          {items.map(result => {
            const isGraded = result.status === 'graded'
            const examTopic = topicByExamId.get(result.examId)

            return (
              <div
                key={result.attemptId}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 p-5 animate-fade-in-up"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StatusBadge status={result.status} />
                      {examTopic !== undefined && <TopicBadge topic={examTopic} />}
                    </div>

                    <h2 className="text-lg font-bold text-slate-800 leading-snug">{result.examTitle}</h2>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {result.correctCount !== null ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 size={12} /> {result.correctCount}/{result.totalQuestions} câu đúng
                        </span>
                      ) : (
                        <span className={chipClass}>
                          <FileText size={12} /> {result.totalQuestions} câu hỏi
                        </span>
                      )}
                      <span className={chipClass}>
                        <Clock size={12} /> Làm trong {formatDuration(result.durationMinutes)}
                      </span>
                      <span className={chipClass}>
                        <CalendarDays size={12} /> Nộp {formatDateTime(result.submittedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 md:gap-5 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50">
                    {isGraded ? (
                      <ScoreRing score={result.score} maxScore={result.maxScore} />
                    ) : (
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className="w-16 h-16 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center">
                          <Hourglass size={22} className="text-slate-400" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400 text-center max-w-[92px] leading-tight">
                          Chờ giáo viên công bố
                        </span>
                      </div>
                    )}

                    <NavLink
                      to={`/hoc-sinh/ket-qua/${result.attemptId}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                    >
                      <Eye size={16} /> Xem chi tiết
                    </NavLink>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Pagination
          page={results?.page ?? page}
          pageSize={results?.pageSize ?? PAGE_SIZE}
          total={results?.total ?? 0}
          onPageChange={setPage}
        />
      </>
    )
  }

  return (
    <StudentLayout>
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-800">Kết quả của tôi</h1>
        <p className="text-sm text-slate-500 mt-1">
          {summaryText ?? 'Theo dõi điểm, số câu đúng và chi tiết bài đã nộp'}
        </p>
      </div>

      <div className="relative mb-5 animate-fade-in-up">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={event => changeSearch(event.target.value)}
          placeholder="Tìm theo tên bài kiểm tra..."
          className="w-full max-w-md pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
          aria-label="Tìm kiếm kết quả"
        />
      </div>

      {renderList()}
    </StudentLayout>
  )
}
