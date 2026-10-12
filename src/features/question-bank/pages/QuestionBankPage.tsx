import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CheckCircle2, Eye, EyeOff, FilterX, Library, ListChecks,
  Pencil, Plus, SearchX, Target, Trash2,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import Modal from '../../../components/common/Modal'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import SearchField from '../../../components/common/SearchField'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import { DifficultyBadge } from '../../../components/common/Badge'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useUrlListState } from '../../../hooks/useUrlListState'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { resolveMediaUrl } from '../../../lib/apiClient'
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
import { questionDeleteConfirmCopy, questionStatusConfirmCopy } from '../utils/questionConfirmations'

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
  'max-w-[14rem] px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'
const iconButtonClass =
  'w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors'
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all'
/** Nút tạo mới trên thanh tiêu đề: thấp bằng ô tìm kiếm cạnh nó. */
const headerButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap'
const headCellClass = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'
const chipClass = 'inline-flex items-center max-w-full px-2.5 py-1 rounded-full text-xs font-semibold'
const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }

interface QuestionRowProps {
  question: Question
  onPreview: (question: Question) => void
  onToggleStatus: (question: Question) => void
  onDelete: (question: Question) => void
}

/** Ba nút thao tác chung của dòng bảng (desktop) và của thẻ (màn hình hẹp). */
function QuestionActionButtons({ question, onToggleStatus, onDelete }: Omit<QuestionRowProps, 'onPreview'>) {
  const isActive = question.status === 'active'
  const toggleLabel = isActive ? 'Ẩn câu hỏi khỏi ngân hàng' : 'Đưa câu hỏi trở lại ngân hàng'

  return (
    <>
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
        title={toggleLabel}
        aria-label={toggleLabel}
        className={iconButtonClass}
      >
        {isActive ? <EyeOff size={15} /> : <Eye size={15} />}
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
    </>
  )
}

function QuestionRow({ question, onPreview, onToggleStatus, onDelete }: QuestionRowProps) {
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-3">
          {question.imageUrl && (
            <img
              src={resolveMediaUrl(question.imageUrl)}
              alt="Ảnh minh hoạ câu hỏi"
              className="w-10 h-10 rounded-lg border border-slate-100 bg-slate-50 object-cover flex-shrink-0"
            />
          )}
          {/* Bấm vào nội dung để xem trước: một nút chữ đỡ tốn cả một cột cho nút "Xem trước". */}
          <button
            type="button"
            onClick={() => onPreview(question)}
            title="Xem trước câu hỏi"
            className="block min-w-0 text-left font-semibold text-slate-800 hover:text-indigo-600 hover:underline transition-colors"
          >
            <span className="line-clamp-2 leading-snug">{question.content}</span>
          </button>
        </div>
      </td>

      <td className="px-5 py-2.5">
        <span className={`${chipClass} bg-indigo-50 text-indigo-700`} title={question.topic}>
          <span className="truncate">{question.topic}</span>
        </span>
      </td>

      <td className="px-5 py-2.5">
        <DifficultyBadge level={question.difficulty} />
      </td>

      <td className="px-5 py-2.5 whitespace-nowrap">
        <p className="font-semibold text-slate-700">{question.defaultPoint} điểm</p>
        <p className="text-xs text-slate-400 mt-0.5">{question.answers.length} đáp án</p>
      </td>

      <td className="px-5 py-2.5">
        <span className={`${chipClass} whitespace-nowrap ${statusToneClass[question.status]}`}>
          {questionStatusLabels[question.status]}
        </span>
      </td>

      <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(question.updatedAt)}</td>

      <td className="px-5 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <QuestionActionButtons question={question} onToggleStatus={onToggleStatus} onDelete={onDelete} />
        </div>
      </td>
    </tr>
  )
}

/** Dòng dạng thẻ cho màn hình hẹp, nơi bảng bảy cột phải cuộn ngang mới thấy hết. */
function QuestionCard({ question, onPreview, onToggleStatus, onDelete }: QuestionRowProps) {
  return (
    <div className="p-5 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 flex-1 min-w-0">
          {question.imageUrl && (
            <img
              src={resolveMediaUrl(question.imageUrl)}
              alt="Ảnh minh hoạ câu hỏi"
              className="w-16 h-16 rounded-xl border border-slate-100 bg-slate-50 object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 leading-relaxed line-clamp-2">{question.content}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className={`${chipClass} bg-indigo-50 text-indigo-700`}>{question.topic}</span>
              <DifficultyBadge level={question.difficulty} />
              <span className={`${chipClass} ${statusToneClass[question.status]}`}>
                {questionStatusLabels[question.status]}
              </span>
              <span className={`${chipClass} gap-1 bg-slate-100 text-slate-600`}>
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
          <QuestionActionButtons question={question} onToggleStatus={onToggleStatus} onDelete={onDelete} />
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
          src={resolveMediaUrl(question.imageUrl)}
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
                    src={resolveMediaUrl(answer.imageUrl)}
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
  const confirm = useConfirm()

  // Từ khoá, ba bộ lọc và trang nằm trên URL: sửa một câu rồi Back về đúng bộ lọc và đúng trang đang xem.
  const { searchInput, setSearchInput, search, filters, setFilter, page, setPage, clearAll } = useUrlListState(
    {
      'chu-de': { default: 'all' },
      'do-kho': { default: 'all', allowed: ['all', 'easy', 'medium', 'hard'] },
      'trang-thai': { default: 'all', allowed: ['all', 'active', 'hidden'] },
    },
    { debounceMs: 350 },
  )
  const topicFilter = filters['chu-de']
  const difficultyFilter = filters['do-kho'] as 'all' | DifficultyLevel
  const statusFilter = filters['trang-thai'] as 'all' | QuestionStatus

  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const syncedResponseRef = useRef<Paged<Question> | undefined>(undefined)


  // Một lời gọi trả về cả tổng số, số đang dùng và danh sách chủ đề — trước đây phải ghép ba
  // request rời để dựng đúng dòng phụ đề này.
  const summaryState = useAsync<QuestionBankSummary>(() => getQuestionBankSummary(), [])

  const listState = useAsync(
    () =>
      listQuestions({
        search,
        topic: topicFilter === 'all' ? undefined : topicFilter,
        difficulty: difficultyFilter,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, topicFilter, difficultyFilter, statusFilter, page],
  )

  // Bảng cần 1100px, cộng thanh bên dạng dải icon (76px) và lề trang (64px) là ~1240px: dưới cỡ xl thì
  // dùng thẻ, để khỏi phải cuộn ngang mới thấy nút thao tác. (Đặt ở lg thì từ 1024 tới ~1240px cột nút
  // nằm ngoài màn hình.)
  const isDesktop = useMediaQuery('(min-width: 80rem)')

  const pagedQuestions = listState.data
  const questions = pagedQuestions?.items ?? []
  const { tableRef, wrapperStyle } = useStableTableHeight(questions, PAGE_SIZE, pagedQuestions?.total ?? 0)
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
    search.trim() !== '' || topicFilter !== 'all' || difficultyFilter !== 'all' || statusFilter !== 'all'
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
  }, [pagedQuestions, page, setPage])

  function reloadAll() {
    listState.reload()
    summaryState.reload()
  }

  const handleSearchChange = setSearchInput
  const handleTopicChange = (value: string) => setFilter('chu-de', value)
  const handleDifficultyChange = (value: 'all' | DifficultyLevel) => setFilter('do-kho', value)
  const handleStatusChange = (value: 'all' | QuestionStatus) => setFilter('trang-thai', value)
  const handleClearFilters = clearAll

  async function handleToggleStatus(question: Question) {
    const nextStatus: QuestionStatus = question.status === 'active' ? 'hidden' : 'active'
    const copy = questionStatusConfirmCopy(question, nextStatus)
    if (copy) {
      const changed = await confirm({
        ...copy,
        onConfirm: () => setQuestionStatus(question.id, nextStatus),
      })
      if (!changed) return
    } else {
      try {
        await setQuestionStatus(question.id, nextStatus)
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Không đổi được trạng thái câu hỏi. Vui lòng thử lại.')
        return
      }
    }
    toast.success(
      nextStatus === 'hidden'
        ? 'Đã ẩn câu hỏi khỏi ngân hàng.'
        : 'Đã đưa câu hỏi trở lại ngân hàng.',
    )
    reloadAll()
  }

  async function handleDelete(question: Question) {
    const deleted = await confirm({
      ...questionDeleteConfirmCopy(question),
      onConfirm: () => deleteQuestion(question.id),
    })
    if (!deleted) return
    toast.success('Đã xoá câu hỏi khỏi ngân hàng.')
    // Xoá bản ghi cuối của trang thì lùi về trang trước để không rơi vào trang trống
    if (questions.length === 1 && responsePage !== undefined && responsePage > 1) {
      setPage(responsePage - 1)
    } else {
      listState.reload()
    }
    summaryState.reload()
  }

  let listBody: ReactNode
  if (listState.error) {
    listBody = <ErrorState message={listState.error} onRetry={listState.reload} />
  } else if (listState.loading && !pagedQuestions) {
    listBody = <SkeletonTable rows={8} cols={7} />
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
        description="Tạo câu hỏi đầu tiên, rồi dựng đề kiểm tra từ ngân hàng này."
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
        {isDesktop ? (
          <div
            className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity animate-fade-in-up ${
              listState.loading ? 'opacity-60' : ''
            }`}
          >
            <TableScroller style={wrapperStyle}>
              {/* Bố cục cố định: các cột hẹp có bề rộng riêng, cột câu hỏi nhận phần còn lại, nên đổi trang
                  không làm cột nào xê dịch. */}
              <table ref={tableRef} className="w-full table-fixed text-sm min-w-[1100px]">
                <colgroup>
                  <col />
                  <col className="w-40" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-32" />
                  <col className="w-32" />
                  <col className="w-44" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className={headCellClass}>Câu hỏi</th>
                    <th className={headCellClass}>Chủ đề</th>
                    <th className={headCellClass}>Độ khó</th>
                    <th className={headCellClass}>Điểm</th>
                    <th className={headCellClass}>Trạng thái</th>
                    <th className={headCellClass}>Cập nhật</th>
                    <th className={`${headCellClass} text-right`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map(question => (
                    <QuestionRow
                      key={question.id}
                      question={question}
                      onPreview={setPreviewQuestion}
                      onToggleStatus={target => void handleToggleStatus(target)}
                      onDelete={target => void handleDelete(target)}
                    />
                  ))}
                </tbody>
              </table>
            </TableScroller>
          </div>
        ) : (
          <div
            className={`bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden transition-opacity animate-fade-in-up ${
              listState.loading ? 'opacity-60' : ''
            }`}
          >
            {questions.map(question => (
              <QuestionCard
                key={question.id}
                question={question}
                onPreview={setPreviewQuestion}
                onToggleStatus={target => void handleToggleStatus(target)}
                onDelete={target => void handleDelete(target)}
              />
            ))}
          </div>
        )}
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

  // Ô tìm kiếm và nút tạo mới nằm trên thanh tiêu đề (từ cỡ lg), thay cho một thẻ riêng phía trên danh sách.
  const tools = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
      <div className="flex-1 min-w-[12rem] max-w-xs">
        <SearchField
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Tìm theo nội dung hoặc chủ đề"
          label="Tìm câu hỏi"
        />
      </div>
      <NavLink to="/giao-vien/cau-hoi/tao" className={headerButtonClass} style={primaryButtonStyle}>
        <Plus size={16} /> Tạo câu hỏi
      </NavLink>
    </div>
  )

  return (
    <TeacherLayout
      pageTitle="Ngân hàng câu hỏi"
      pageSubtitle={summaryText ?? 'Quản lý câu hỏi theo chủ đề và độ khó'}
      compactContent
      headerTools={tools}
    >
      {/* Ba ô lọc đứng thành một hàng mảnh ngay trên bảng; ô tìm kiếm và nút tạo đã lên thanh tiêu đề. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
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

        {isFiltering && (
          <div className="ml-auto flex items-center gap-3">
            {pagedQuestions && !listState.error && (
              <p className="text-sm text-slate-500">
                Tìm thấy <strong className="text-slate-700 font-semibold">{pagedQuestions.total}</strong> câu hỏi khớp
                bộ lọc
              </p>
            )}
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
            >
              <FilterX size={15} /> Xoá bộ lọc
            </button>
          </div>
        )}
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
    </TeacherLayout>
  )
}
