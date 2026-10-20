import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CheckCircle2, Eye, EyeOff, FilterX, Library, ListChecks,
  Pencil, Plus, SearchX, Target, Trash2,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
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
import { openOnRowClick } from '../../../lib/rowClick'
import { hasQuestionTitle, questionDisplayTitle } from '../../../lib/questionTitle'
import { getCurrentUser } from '../../../services/authService'
import {
  deleteQuestion, getQuestionBankSummary, listQuestions, listSubjects, setQuestionStatus,
  type QuestionBankSummary,
} from '../../../services/questionService'
import {
  difficultyLabels, questionStatusLabels,
  type DifficultyLevel, type Paged, type Question, type QuestionStatus, type Subject,
} from '../../../types'
import { questionDeleteConfirmCopy, questionStatusConfirmCopy } from '../utils/questionConfirmations'
import { questionBankPath, type QuestionAudience } from '../utils/questionAudience'

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
  'max-w-[11rem] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'
const iconButtonClass =
  'w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors'
const dangerIconButtonClass =
  'w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-colors'
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all'
/** Nút tạo mới trên thanh tiêu đề: thấp bằng ô tìm kiếm cạnh nó. */
const headerButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap'
const headCellClass = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'
const chipClass = 'inline-flex items-center max-w-full px-2.5 py-1 rounded-full text-xs font-semibold'
const primaryButtonStyle = { background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }

interface QuestionRowProps {
  question: Question
  audience: QuestionAudience
  /** Ghi tên môn dưới chủ đề: chỉ khi ngân hàng có từ hai môn trở lên, còn một môn thì dòng đó lặp lại ở mọi hàng. */
  showSubject: boolean
  onPreview: (question: Question) => void
  onToggleStatus: (question: Question) => void
  onDelete: (question: Question) => void
}

/**
 * Tên câu hỏi và dòng nội dung đi kèm, dùng chung cho dòng bảng và thẻ.
 *
 * Câu đã đặt tên: tên đứng trên, nội dung thu thành một dòng mờ bên dưới. Câu chưa đặt tên: hiện nội dung như
 * cũ, không lặp lại hai lần. Cả hai trường hợp cao đúng hai dòng để bảng không đổi chiều cao khi đổi trang.
 */
function QuestionHeading({ question }: { question: Question }) {
  if (!hasQuestionTitle(question)) {
    return <span className="line-clamp-2 leading-snug">{questionDisplayTitle(question, 200)}</span>
  }

  // Không thêm `block`: line-clamp tự đặt display, và `block` viết thêm sẽ đè mất việc cắt dòng.
  return (
    <>
      <span className="line-clamp-1 leading-snug">{questionDisplayTitle(question)}</span>
      <span className="line-clamp-1 mt-0.5 text-xs font-normal text-slate-500">{question.content}</span>
    </>
  )
}

/**
 * Nút thao tác chung của dòng bảng (desktop) và của thẻ (màn hình hẹp): sửa và ẩn/hiện, thêm xoá cho quản trị viên.
 *
 * Giáo viên không có nút xoá: ẩn câu hỏi đã là cách gỡ nó khỏi ngân hàng mà vẫn giữ được đề và bài đã làm, hai nút xoá và ẩn
 * làm cùng một việc. Quản trị viên có thêm nút xoá để dọn hẳn câu sai hay trùng; server chỉ cho xoá câu chưa nằm trong bài
 * kiểm tra nào. Xem trước mở bằng cách bấm vào chỗ nào của dòng (bảng) hay của thẻ cũng được (xem openOnRowClick); bấm vào các
 * nút này thì chỉ làm việc của nút.
 */
function QuestionActionButtons({
  question, audience, onToggleStatus, onDelete,
}: Omit<QuestionRowProps, 'onPreview' | 'showSubject'>) {
  const isActive = question.status === 'active'
  const toggleLabel = isActive ? 'Ẩn câu hỏi khỏi ngân hàng' : 'Đưa câu hỏi trở lại ngân hàng'

  return (
    <>
      <NavLink
        to={`${questionBankPath[audience]}/${question.id}/sua`}
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
      {audience === 'admin' && (
        <button
          type="button"
          onClick={() => onDelete(question)}
          title="Xoá câu hỏi"
          aria-label="Xoá câu hỏi"
          className={dangerIconButtonClass}
        >
          <Trash2 size={15} />
        </button>
      )}
    </>
  )
}

function QuestionRow({ question, audience, showSubject, onPreview, onToggleStatus, onDelete }: QuestionRowProps) {
  const openPreview = openOnRowClick(() => onPreview(question))

  return (
    <tr
      onClick={openPreview}
      className="border-b border-slate-50 hover:bg-indigo-100/70 transition-colors cursor-pointer"
    >
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-3">
          {question.imageUrl && (
            <img
              src={resolveMediaUrl(question.imageUrl)}
              alt="Ảnh minh hoạ câu hỏi"
              className="w-10 h-10 rounded-lg border border-slate-100 bg-slate-50 object-cover flex-shrink-0"
            />
          )}
          {/* Cả dòng bấm được (onClick ở <tr>); nút chữ này để bàn phím tab tới và nhấn Enter xem trước được. */}
          <button
            type="button"
            onClick={() => onPreview(question)}
            className="block min-w-0 text-left font-semibold text-slate-800 cursor-pointer"
          >
            <QuestionHeading question={question} />
          </button>
        </div>
      </td>

      <td className="px-5 py-2.5">
        <span className={`${chipClass} bg-indigo-50 text-indigo-700`} title={question.topic}>
          <span className="truncate">{question.topic}</span>
        </span>
        {showSubject && (
          <p className="mt-1 truncate text-xs text-slate-400" title={question.subject}>{question.subject}</p>
        )}
      </td>

      <td className="px-5 py-2.5">
        <DifficultyBadge level={question.difficulty} />
        {question.allowMultiple && (
          <p className="text-xs font-semibold text-violet-600 mt-1" title="Học sinh phải chọn đúng và đủ các đáp án đúng">
            Nhiều đáp án
          </p>
        )}
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

      {audience === 'admin' ? (
        <td className="px-5 py-2.5">
          <p className="truncate font-medium text-slate-700" title={question.createdBy}>{question.createdBy || '—'}</p>
          <p className="mt-0.5 whitespace-nowrap text-xs text-slate-400">{formatDate(question.updatedAt)}</p>
        </td>
      ) : (
        <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(question.updatedAt)}</td>
      )}

      <td className="px-5 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <QuestionActionButtons
            question={question}
            audience={audience}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  )
}

/** Dòng dạng thẻ cho màn hình hẹp, nơi bảng bảy cột phải cuộn ngang mới thấy hết. */
function QuestionCard({ question, audience, showSubject, onPreview, onToggleStatus, onDelete }: QuestionRowProps) {
  const openPreview = openOnRowClick(() => onPreview(question))

  return (
    <div onClick={openPreview} className="p-5 hover:bg-indigo-100/70 transition-colors cursor-pointer">
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
            <p className="font-semibold text-slate-800 leading-relaxed">
              <QuestionHeading question={question} />
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className={`${chipClass} bg-indigo-50 text-indigo-700`}>{question.topic}</span>
              <DifficultyBadge level={question.difficulty} />
              {question.allowMultiple && (
                <span className={`${chipClass} bg-violet-50 text-violet-700`}>Nhiều đáp án</span>
              )}
              <span className={`${chipClass} ${statusToneClass[question.status]}`}>
                {questionStatusLabels[question.status]}
              </span>
              <span className={`${chipClass} gap-1 bg-slate-100 text-slate-600`}>
                <Target size={11} /> {question.defaultPoint} điểm
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {audience === 'admin' && question.createdBy ? `${question.createdBy} · ` : ''}
              {showSubject && question.subject ? `${question.subject} · ` : ''}
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
          <QuestionActionButtons
            question={question}
            audience={audience}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
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
        {hasQuestionTitle(question) && (
          <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2">{questionDisplayTitle(question)}</h3>
        )}
        <p
          className={`text-base text-slate-800 leading-relaxed whitespace-pre-line ${
            hasQuestionTitle(question) ? 'font-medium' : 'font-semibold'
          }`}
        >
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
          {question.allowMultiple && (
            <span className="ml-1 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
              Nhiều đáp án đúng · phải chọn đúng và đủ
            </span>
          )}
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

interface QuestionBankPageProps {
  /** Giáo viên: ngân hàng của môn mình. Quản trị viên: ngân hàng của mọi môn, thêm cột người soạn và nút xoá. */
  audience: QuestionAudience
}

export default function QuestionBankPage({ audience }: QuestionBankPageProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = audience === 'admin'
  const basePath = questionBankPath[audience]
  const Layout = isAdmin ? AdminLayout : TeacherLayout
  const currentUserId = getCurrentUser()?.id

  // Từ khoá, các bộ lọc và trang nằm trên URL: sửa một câu rồi Back về đúng bộ lọc và đúng trang đang xem.
  const { searchInput, setSearchInput, search, filters, setFilter, page, setPage, clearAll } = useUrlListState(
    {
      'chu-de': { default: 'all' },
      'do-kho': { default: 'all', allowed: ['all', 'easy', 'medium', 'hard'] },
      'trang-thai': { default: 'all', allowed: ['all', 'active', 'hidden'] },
      mon: { default: 'all' },
    },
    { debounceMs: 350 },
  )
  const topicFilter = filters['chu-de']
  const difficultyFilter = filters['do-kho'] as 'all' | DifficultyLevel
  const statusFilter = filters['trang-thai'] as 'all' | QuestionStatus
  const subjectFilter = filters.mon

  // Các môn chỉ quản trị viên cần. Chỉ có một môn thì ô lọc và dòng tên môn đều thừa nên ẩn đi.
  const subjectsState = useAsync<Subject[]>(() => (isAdmin ? listSubjects() : Promise.resolve([])), [isAdmin])
  const subjects = useMemo(() => subjectsState.data ?? [], [subjectsState.data])
  const hasManySubjects = subjects.length > 1
  // Mã môn trên URL chỉ có nghĩa với quản trị viên và khi là số nguyên dương; ngoài ra coi như "tất cả môn".
  const parsedSubjectId = Number(subjectFilter)
  const subjectId =
    isAdmin && Number.isInteger(parsedSubjectId) && parsedSubjectId > 0 ? parsedSubjectId : undefined

  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const syncedResponseRef = useRef<Paged<Question> | undefined>(undefined)


  // Một lời gọi trả về cả tổng số, số đang dùng và danh sách chủ đề — trước đây phải ghép ba
  // request rời để dựng đúng dòng phụ đề này.
  const summaryState = useAsync<QuestionBankSummary>(() => getQuestionBankSummary(undefined, subjectId), [subjectId])

  const listState = useAsync(
    () =>
      listQuestions({
        search,
        topic: topicFilter === 'all' ? undefined : topicFilter,
        difficulty: difficultyFilter,
        status: statusFilter,
        subjectId,
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, topicFilter, difficultyFilter, statusFilter, subjectId, page],
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
  // thành bộ chọn môn. Hồ sơ chưa có môn thì phụ đề tự lược bớt phần đó. Quản trị viên không thuộc môn nào: ghi môn đang
  // lọc, hoặc số môn khi xem tất cả.
  const summaryText = useMemo(() => {
    if (!summary) return null
    const parts: string[] = []
    if (isAdmin) {
      const filteredName = subjectId === undefined ? undefined : subjects.find(subject => subject.id === subjectId)?.name
      if (filteredName) parts.push(filteredName)
      else if (hasManySubjects) parts.push(`${subjects.length} môn`)
    } else {
      const teachingSubject = getCurrentUser()?.subject?.trim()
      if (teachingSubject) parts.push(teachingSubject)
    }
    // `total` tính cả câu đang ẩn, `active` chỉ tính câu đang dùng — hai con số cố ý khác nhau.
    parts.push(`${summary.total} câu hỏi`)
    parts.push(`${summary.topics.length} chủ đề`)
    parts.push(`${summary.active} đang dùng`)
    return parts.join(' · ')
  }, [summary, isAdmin, subjectId, subjects, hasManySubjects])
  // So khớp với từ khoá đã gửi cho service, không phải từ khoá đang gõ, để nhãn không lệch với kết quả
  const isFiltering =
    search.trim() !== '' ||
    topicFilter !== 'all' ||
    difficultyFilter !== 'all' ||
    statusFilter !== 'all' ||
    subjectId !== undefined

  const filteredText =
    isFiltering && pagedQuestions && !listState.error ? `${pagedQuestions.total} câu hỏi khớp bộ lọc` : null

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
  // Đổi môn thì chủ đề đang lọc có thể không còn thuộc môn mới, nên bỏ luôn bộ lọc chủ đề thay vì để ra danh sách rỗng khó hiểu.
  const handleSubjectChange = (value: string) => {
    setFilter('mon', value)
    setFilter('chu-de', 'all')
  }
  const handleClearFilters = clearAll

  // Quản trị viên ẩn hay xoá câu của người khác thì hộp xác nhận nói rõ câu của ai; câu của chính mình thì không cần.
  const otherAuthorOf = (question: Question) =>
    isAdmin && question.createdByUserId !== currentUserId ? question.createdBy || undefined : undefined

  async function handleDelete(question: Question) {
    const deleted = await confirm({
      ...questionDeleteConfirmCopy(question, otherAuthorOf(question)),
      onConfirm: () => deleteQuestion(question.id),
    })
    if (!deleted) return
    toast.success('Đã xoá câu hỏi khỏi ngân hàng.')
    reloadAll()
  }

  async function handleToggleStatus(question: Question) {
    const nextStatus: QuestionStatus = question.status === 'active' ? 'hidden' : 'active'
    const copy = questionStatusConfirmCopy(question, nextStatus, otherAuthorOf(question))
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
          <NavLink to={`${basePath}/tao`} className={primaryButtonClass} style={primaryButtonStyle}>
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
                  <col className={isAdmin ? 'w-36' : 'w-40'} />
                  <col className="w-32" />
                  <col className={isAdmin ? 'w-24' : 'w-28'} />
                  <col className="w-32" />
                  <col className={isAdmin ? 'w-40' : 'w-32'} />
                  <col className={isAdmin ? 'w-40' : 'w-44'} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className={headCellClass}>Câu hỏi</th>
                    <th className={headCellClass}>Chủ đề</th>
                    <th className={headCellClass}>Độ khó</th>
                    <th className={headCellClass}>Điểm</th>
                    <th className={headCellClass}>Trạng thái</th>
                    <th className={headCellClass}>{isAdmin ? 'Soạn bởi' : 'Cập nhật'}</th>
                    <th className={`${headCellClass} text-right`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map(question => (
                    <QuestionRow
                      key={question.id}
                      question={question}
                      audience={audience}
                      showSubject={isAdmin && hasManySubjects}
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
                audience={audience}
                showSubject={isAdmin && hasManySubjects}
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

  // Ô tìm kiếm, các ô lọc và nút tạo mới nằm trên thanh tiêu đề (từ cỡ lg), thay cho thẻ và hàng lọc riêng phía trên bảng.
  // Thêm ô lọc môn thì các ô còn lại hẹp bớt để cả hàng vẫn nằm trên một dòng.
  const toolSelectClass = isAdmin && hasManySubjects ? selectClass.replace('max-w-[11rem]', 'max-w-[9rem]') : selectClass
  const tools = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
      <div className="flex-1 min-w-[9rem] max-w-xs">
        <SearchField
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Tìm theo tên, nội dung hoặc chủ đề"
          label="Tìm câu hỏi"
        />
      </div>

      {isAdmin && hasManySubjects && (
        <select
          value={subjectId === undefined ? 'all' : String(subjectId)}
          onChange={event => handleSubjectChange(event.target.value)}
          aria-label="Lọc theo môn"
          className={toolSelectClass}
        >
          <option value="all">Tất cả môn</option>
          {subjects.map(subject => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={topicFilter}
        onChange={event => handleTopicChange(event.target.value)}
        aria-label="Lọc theo chủ đề"
        className={toolSelectClass}
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
        className={toolSelectClass}
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
        className={toolSelectClass}
      >
        {statusOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {isFiltering && (
        <button
          type="button"
          onClick={handleClearFilters}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
        >
          <FilterX size={15} /> Xoá lọc
        </button>
      )}

      <NavLink to={`${basePath}/tao`} className={headerButtonClass} style={primaryButtonStyle}>
        <Plus size={16} /> Tạo câu hỏi
      </NavLink>
    </div>
  )

  return (
    <Layout
      pageTitle="Ngân hàng câu hỏi"
      pageSubtitle={filteredText ?? summaryText ?? 'Quản lý câu hỏi theo chủ đề và độ khó'}
      compactContent
      headerTools={tools}
    >
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
          previewQuestion && (
            <NavLink
              to={`${basePath}/${previewQuestion.id}/sua`}
              className={primaryButtonClass}
              style={primaryButtonStyle}
            >
              <Pencil size={15} /> Chỉnh sửa
            </NavLink>
          )
        }
      >
        {previewQuestion && <QuestionPreviewDetail question={previewQuestion} />}
      </Modal>
    </Layout>
  )
}
