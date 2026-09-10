import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CheckCircle2, Eye, EyeOff, FilterX, Library, ListChecks,
  Loader2, Pencil, Plus, Search, SearchX, Target, Trash2,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { DifficultyBadge } from '../../../components/common/Badge'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { formatDate } from '../../../lib/format'
import { getCurrentUser } from '../../../services/authService'
import {
  deleteQuestion, getQuestionBankSummary, listQuestions, setQuestionStatus,
  type QuestionBankSummary,
} from '../../../services/questionService'
import {
  difficultyLabels, questionStatusLabels,
  type DifficultyLevel, type Paged, type Question, type QuestionStatus,
} from '../../../types'

const PAGE_SIZE = 10
const answerLabels = ['A', 'B', 'C', 'D', 'E', 'F']

const statusToneClass: Record<QuestionStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  hidden: 'bg-slate-100 text-slate-500',
}

const difficultyOptions: { value: 'all' | DifficultyLevel; label: string }[] = [
  { value: 'all', label: 'Tất cả độ khó' },
  { value: 'easy', label: difficultyLabels.easy },
  { value: 'medium', label: difficultyLabels.medium },
  { value: 'hard', label: difficultyLabels.hard },
]

const statusOptions: { value: 'all' | QuestionStatus; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: questionStatusLabels.active },
  { value: 'hidden', label: questionStatusLabels.hidden },
]

const selectClass =
  'px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'
const iconButtonClass =
  'w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors'
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all'
const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }

function toErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

function truncateContent(content: string, maxLength = 80): string {
  const trimmed = content.trim()
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed
}

function QuestionListSkeleton() {
  const rowKeys = [0, 1, 2, 3, 4, 5]
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
      {rowKeys.map(rowKey => (
        <div key={rowKey} className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 space-y-3">
            <SkeletonBlock className="h-4 w-3/4" />
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-6 w-28 rounded-full" />
              <SkeletonBlock className="h-6 w-16 rounded-full" />
              <SkeletonBlock className="h-6 w-20 rounded-full" />
            </div>
            <SkeletonBlock className="h-3 w-44" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-9 w-28 rounded-xl" />
            <SkeletonBlock className="h-9 w-9 rounded-xl" />
            <SkeletonBlock className="h-9 w-9 rounded-xl" />
            <SkeletonBlock className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface QuestionRowProps {
  question: Question
  statusUpdating: boolean
  onPreview: (question: Question) => void
  onToggleStatus: (question: Question) => void
  onDelete: (question: Question) => void
}

function QuestionRow({ question, statusUpdating, onPreview, onToggleStatus, onDelete }: QuestionRowProps) {
  const isActive = question.status === 'active'
  const toggleLabel = isActive ? 'Ẩn câu hỏi khỏi ngân hàng đề' : 'Đưa câu hỏi trở lại ngân hàng đề'

  return (
    <div className="p-5 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex gap-4 flex-1 min-w-0">
          {question.imageUrl && (
            <img
              src={question.imageUrl}
              alt="Ảnh minh hoạ câu hỏi"
              className="w-16 h-16 rounded-xl border border-slate-100 bg-slate-50 object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 leading-relaxed line-clamp-2">{question.content}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                {question.topic}
              </span>
              <DifficultyBadge level={question.difficulty} />
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusToneClass[question.status]}`}>
                {questionStatusLabels[question.status]}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                <Target size={11} /> {question.defaultPoint} điểm
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {question.answers.length} đáp án · Cập nhật {formatDate(question.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onPreview(question)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Eye size={15} /> Xem trước
          </button>
          <NavLink
            to={`/giao-vien/cau-hoi/${question.id}/sua`}
            title="Sửa câu hỏi"
            aria-label="Sửa câu hỏi"
            className={iconButtonClass}
          >
            <Pencil size={15} />
          </NavLink>
          <button
            type="button"
            onClick={() => onToggleStatus(question)}
            disabled={statusUpdating}
            title={toggleLabel}
            aria-label={toggleLabel}
            className={`${iconButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {statusUpdating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : isActive ? (
              <EyeOff size={15} />
            ) : (
              <Eye size={15} />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(question)}
            title="Xoá câu hỏi"
            aria-label="Xoá câu hỏi"
            className="w-9 h-9 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionPreviewDetail({ question }: { question: Question }) {
  return (
    <div className="space-y-5">
      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt="Ảnh minh hoạ câu hỏi"
          className="w-full max-h-64 rounded-2xl border border-slate-100 bg-slate-50 object-contain"
        />
      )}

      <div>
        <p className="text-base font-semibold text-slate-800 leading-relaxed whitespace-pre-line">
          {question.content}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Cập nhật {formatDate(question.updatedAt)} · {questionStatusLabels[question.status]}
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <ListChecks size={16} className="text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">Đáp án</h3>
        </div>
        <div className="space-y-2.5">
          {question.answers.map((answer, index) => (
            <div
              key={answer.id}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border ${
                answer.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  answer.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {answerLabels[index] ?? index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-relaxed ${
                    answer.isCorrect ? 'text-emerald-800 font-semibold' : 'text-slate-700'
                  }`}
                >
                  {answer.content}
                </p>
                {answer.imageUrl && (
                  <img
                    src={answer.imageUrl}
                    alt="Ảnh minh hoạ đáp án"
                    className="mt-2 max-h-32 rounded-xl border border-slate-100 object-contain"
                  />
                )}
              </div>
              {answer.isCorrect && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 flex-shrink-0">
                  <CheckCircle2 size={14} /> Đáp án đúng
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function QuestionBankPage() {
  const toast = useToast()

  const [searchInput, setSearchInput] = useState('')
  const [topicFilter, setTopicFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyLevel>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | QuestionStatus>('all')
  const [page, setPage] = useState(1)

  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const [questionPendingDelete, setQuestionPendingDelete] = useState<Question | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null)
  const syncedResponseRef = useRef<Paged<Question> | undefined>(undefined)

  const debouncedSearch = useDebouncedValue(searchInput, 350)

  // Một lời gọi trả về cả tổng số, số đang dùng và danh sách chủ đề — trước đây phải ghép ba
  // request rời để dựng đúng dòng phụ đề này.
  const summaryState = useAsync<QuestionBankSummary>(() => getQuestionBankSummary(), [])

  const listState = useAsync(
    () =>
      listQuestions({
        search: debouncedSearch,
        topic: topicFilter === 'all' ? undefined : topicFilter,
        difficulty: difficultyFilter,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    [debouncedSearch, topicFilter, difficultyFilter, statusFilter, page],
  )

  const pagedQuestions = listState.data
  const questions = pagedQuestions?.items ?? []
  const summary = summaryState.data
  // Tên môn đứng đầu để nói rõ cả ngân hàng thuộc đúng một môn, tránh nhầm dropdown chủ đề
  // thành bộ chọn môn. Hồ sơ chưa có môn thì phụ đề tự lược bớt phần đó.
  const summaryText = useMemo(() => {
    if (!summary) return null
    const teachingSubject = getCurrentUser()?.subject?.trim()
    const parts: string[] = []
    if (teachingSubject) parts.push(teachingSubject)
    // `total` tính cả câu đang ẩn, `active` chỉ tính câu đang dùng — hai con số cố ý khác nhau.
    parts.push(`${summary.total} câu hỏi`)
    parts.push(`${summary.topics.length} chủ đề`)
    parts.push(`${summary.active} đang dùng`)
    return parts.join(' · ')
  }, [summary])
  // So khớp với từ khoá đã gửi cho service, không phải từ khoá đang gõ, để nhãn không lệch với kết quả
  const isFiltering =
    debouncedSearch.trim() !== '' || topicFilter !== 'all' || difficultyFilter !== 'all' || statusFilter !== 'all'
  const responsePage = pagedQuestions?.page

  // Chủ đề đang lọc có thể vừa biến mất khỏi ngân hàng, vẫn giữ lại để select không rơi về rỗng
  const topicOptions = useMemo(() => {
    const topics = summary?.topics ?? []
    if (topicFilter !== 'all' && !topics.includes(topicFilter)) return [topicFilter, ...topics]
    return topics
  }, [summary, topicFilter])

  // Danh sách co lại có thể khiến trang đang xem vượt quá số trang thật, service kẹp lại nên
  // đồng bộ ngược về state. Chỉ xét đúng một lần cho mỗi phản hồi mới để không huỷ thao tác đổi trang.
  useEffect(() => {
    if (!pagedQuestions || syncedResponseRef.current === pagedQuestions) return
    syncedResponseRef.current = pagedQuestions
    if (pagedQuestions.page !== page) {
      setPage(pagedQuestions.page)
    }
  }, [pagedQuestions, page])

  function reloadAll() {
    listState.reload()
    summaryState.reload()
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setPage(1)
  }

  function handleTopicChange(value: string) {
    setTopicFilter(value)
    setPage(1)
  }

  function handleDifficultyChange(value: 'all' | DifficultyLevel) {
    setDifficultyFilter(value)
    setPage(1)
  }

  function handleStatusChange(value: 'all' | QuestionStatus) {
    setStatusFilter(value)
    setPage(1)
  }

  function handleClearFilters() {
    setSearchInput('')
    setTopicFilter('all')
    setDifficultyFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  async function handleToggleStatus(question: Question) {
    const nextStatus: QuestionStatus = question.status === 'active' ? 'hidden' : 'active'
    setStatusUpdatingId(question.id)
    try {
      await setQuestionStatus(question.id, nextStatus)
      toast.success(
        nextStatus === 'hidden'
          ? 'Đã ẩn câu hỏi khỏi ngân hàng đề.'
          : 'Đã đưa câu hỏi trở lại ngân hàng đề.',
      )
      reloadAll()
    } catch (caught) {
      toast.error(toErrorMessage(caught, 'Không đổi được trạng thái câu hỏi.'))
    } finally {
      setStatusUpdatingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!questionPendingDelete) return
    setDeleting(true)
    try {
      await deleteQuestion(questionPendingDelete.id)
      toast.success('Đã xoá câu hỏi khỏi ngân hàng.')
      setQuestionPendingDelete(null)
      // Xoá bản ghi cuối của trang thì lùi về trang trước để không rơi vào trang trống
      if (questions.length === 1 && responsePage !== undefined && responsePage > 1) {
        setPage(responsePage - 1)
      } else {
        listState.reload()
      }
      summaryState.reload()
    } catch (caught) {
      toast.error(toErrorMessage(caught, 'Không xoá được câu hỏi.'))
    } finally {
      setDeleting(false)
    }
  }

  let listBody: ReactNode
  if (listState.error) {
    listBody = <ErrorState message={listState.error} onRetry={listState.reload} />
  } else if (listState.loading && !pagedQuestions) {
    listBody = <QuestionListSkeleton />
  } else if (questions.length === 0) {
    listBody = isFiltering ? (
      <EmptyState
        icon={SearchX}
        title="Không có câu hỏi nào khớp bộ lọc"
        description="Thử đổi từ khoá tìm kiếm hoặc nới lỏng bộ lọc chủ đề, độ khó, trạng thái."
        action={
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <FilterX size={15} /> Xoá bộ lọc
          </button>
        }
      />
    ) : (
      <EmptyState
        icon={Library}
        title="Ngân hàng câu hỏi đang trống"
        description="Hãy tạo câu hỏi đầu tiên để bắt đầu xây dựng đề kiểm tra cho lớp của bạn."
        action={
          <NavLink to="/giao-vien/cau-hoi/tao" className={primaryButtonClass} style={primaryButtonStyle}>
            <Plus size={16} /> Tạo câu hỏi
          </NavLink>
        }
      />
    )
  } else {
    listBody = (
      <>
        <div
          className={`bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden transition-opacity animate-fade-in-up ${
            listState.loading ? 'opacity-60' : ''
          }`}
        >
          {questions.map(question => (
            <QuestionRow
              key={question.id}
              question={question}
              statusUpdating={statusUpdatingId === question.id}
              onPreview={setPreviewQuestion}
              onToggleStatus={handleToggleStatus}
              onDelete={setQuestionPendingDelete}
            />
          ))}
        </div>
        {pagedQuestions && (
          <Pagination
            page={page}
            pageSize={pagedQuestions.pageSize}
            total={pagedQuestions.total}
            onPageChange={setPage}
          />
        )}
      </>
    )
  }

  return (
    <TeacherLayout
      pageTitle="Ngân hàng câu hỏi"
      pageSubtitle={summaryText ?? 'Quản lý câu hỏi theo chủ đề và độ khó'}
    >
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5 animate-fade-in-up">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={event => handleSearchChange(event.target.value)}
              aria-label="Tìm câu hỏi"
              placeholder="Tìm theo nội dung hoặc chủ đề..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:flex xl:items-center">
            <select
              value={topicFilter}
              onChange={event => handleTopicChange(event.target.value)}
              aria-label="Lọc theo chủ đề"
              className={selectClass}
            >
              <option value="all">Tất cả chủ đề</option>
              {topicOptions.map(topic => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>

            <select
              value={difficultyFilter}
              onChange={event => handleDifficultyChange(event.target.value as 'all' | DifficultyLevel)}
              aria-label="Lọc theo độ khó"
              className={selectClass}
            >
              {difficultyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={event => handleStatusChange(event.target.value as 'all' | QuestionStatus)}
              aria-label="Lọc theo trạng thái"
              className={selectClass}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <NavLink
            to="/giao-vien/cau-hoi/tao"
            className={`${primaryButtonClass} xl:flex-shrink-0`}
            style={primaryButtonStyle}
          >
            <Plus size={16} /> Tạo câu hỏi
          </NavLink>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-50">
          <p className="text-sm text-slate-500">
            {listState.error ? (
              'Chưa thống kê được số câu hỏi khớp bộ lọc.'
            ) : !pagedQuestions ? (
              'Đang tải danh sách câu hỏi...'
            ) : (
              <>
                Tìm thấy{' '}
                <strong className="text-slate-700 font-semibold">{pagedQuestions.total}</strong> câu hỏi
                {isFiltering ? ' khớp bộ lọc' : ''}
              </>
            )}
          </p>
          {isFiltering && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <FilterX size={15} /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      {listBody}

      <Modal
        open={previewQuestion !== null}
        title="Xem trước câu hỏi"
        description={
          previewQuestion
            ? `${previewQuestion.topic} · ${difficultyLabels[previewQuestion.difficulty]} · ${previewQuestion.defaultPoint} điểm`
            : undefined
        }
        size="lg"
        onClose={() => setPreviewQuestion(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPreviewQuestion(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Đóng
            </button>
            {previewQuestion && (
              <NavLink
                to={`/giao-vien/cau-hoi/${previewQuestion.id}/sua`}
                className={primaryButtonClass}
                style={primaryButtonStyle}
              >
                <Pencil size={15} /> Chỉnh sửa
              </NavLink>
            )}
          </>
        }
      >
        {previewQuestion && <QuestionPreviewDetail question={previewQuestion} />}
      </Modal>

      <ConfirmDialog
        open={questionPendingDelete !== null}
        title="Xoá câu hỏi"
        message={
          questionPendingDelete
            ? `Bạn có chắc muốn xoá câu hỏi "${truncateContent(questionPendingDelete.content)}"? Thao tác này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xoá câu hỏi"
        tone="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleting) setQuestionPendingDelete(null)
        }}
      />
    </TeacherLayout>
  )
}
