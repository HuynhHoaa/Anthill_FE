import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import {
  BarChart3, FileText, FilterX, MoreVertical, Pencil, Plus, Search, Trash2,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import { LifecycleBadge, TopicBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { calculateRequiredCounts, deleteExam, listExams } from '../../../services/examService'
import { formatDateTime, formatDuration, parseDateTime, roundToOneDecimal } from '../../../lib/format'
import { lifecycleLabels } from '../../../types'
import type { Exam, ExamLifecycle } from '../../../types'

const PAGE_SIZE = 9

type LifecycleFilter = 'all' | ExamLifecycle

const lifecycleOptions: Array<{ value: LifecycleFilter; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'draft', label: lifecycleLabels.draft },
  { value: 'scheduled', label: lifecycleLabels.scheduled },
  { value: 'open', label: lifecycleLabels.open },
  { value: 'closed', label: lifecycleLabels.closed },
]

const primaryGradient = 'linear-gradient(135deg,#6366F1,#8B5CF6)'

const headCellClass = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'

const selectClass =
  'px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'

const rowActionClass = 'px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors'

const menuItemClass =
  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors'

function padTwoDigits(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

/**
 * Mốc lịch rút gọn cho ô bảng: '16/08 23:45' nếu cùng năm hiện tại,
 * '16/08/25 23:45' nếu khác năm — gọn mà vẫn không gây mơ hồ.
 */
function formatScheduleMoment(value: string): string {
  const parsed = parseDateTime(value)
  if (!parsed) return value

  const dayMonth = `${padTwoDigits(parsed.getDate())}/${padTwoDigits(parsed.getMonth() + 1)}`
  const time = `${padTwoDigits(parsed.getHours())}:${padTwoDigits(parsed.getMinutes())}`
  const year = parsed.getFullYear()
  const yearPart = year === new Date().getFullYear() ? '' : `/${padTwoDigits(year % 100)}`

  return `${dayMonth}${yearPart} ${time}`
}

interface ExamRowMenuProps {
  exam: Exam
  onRequestDelete: (exam: Exam) => void
}

const MENU_WIDTH = 224
const MENU_ITEM_HEIGHT = 44
const MENU_VERTICAL_PADDING = 12

/** Menu có 2 hay 3 mục tùy bài đã có người nộp hay chưa, nên chiều cao phải tính lại. */
function estimateMenuHeight(itemCount: number): number {
  return itemCount * MENU_ITEM_HEIGHT + MENU_VERTICAL_PADDING
}

/**
 * Menu phụ của mỗi dòng. Bảng nằm trong vùng cuộn ngang nên menu phải được
 * đưa ra ngoài body và neo theo toạ độ màn hình, nếu không sẽ bị cắt mất.
 */
function ExamRowMenu({ exam, onRequestDelete }: ExamRowMenuProps) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasSubmission = exam.submittedCount > 0
  const open = anchor !== null

  const openMenu = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuHeight = estimateMenuHeight(hasSubmission ? 3 : 2)
    // Gần đáy màn hình thì lật menu lên trên để không bị khuất.
    const openUpward = rect.bottom + menuHeight + 16 > window.innerHeight
    const top = openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8
    const left = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 12)

    setAnchor({ top: Math.max(12, top), left: Math.max(12, left) })
  }

  useEffect(() => {
    if (!open) return

    const close = () => setAnchor(null)
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    // Menu neo theo toạ độ màn hình nên phải đóng lại khi trang cuộn hoặc đổi kích thước.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) setAnchor(null)
          else openMenu()
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Thao tác khác cho ${exam.title}`}
        title="Thao tác khác"
        className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${
          open
            ? 'border-slate-300 bg-slate-100 text-slate-700'
            : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
        }`}
      >
        <MoreVertical size={15} />
      </button>

      {anchor &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: anchor.top, left: anchor.left, width: MENU_WIDTH }}
            className="fixed z-40 bg-white rounded-2xl border border-slate-100 shadow-lg p-1.5 animate-fade-in"
          >
            {hasSubmission && (
              <NavLink
                to={`/giao-vien/ket-qua?bai-kiem-tra=${exam.id}`}
                role="menuitem"
                className={menuItemClass}
              >
                <BarChart3 size={15} /> Xem kết quả
              </NavLink>
            )}
            <NavLink
              to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
              role="menuitem"
              className={menuItemClass}
            >
              <Pencil size={15} /> Sửa bài kiểm tra
            </NavLink>
            <button
              type="button"
              role="menuitem"
              disabled={hasSubmission}
              title={hasSubmission ? 'Không thể xóa bài đã có học sinh nộp' : undefined}
              onClick={() => {
                setAnchor(null)
                onRequestDelete(exam)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors ${
                hasSubmission ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'
              }`}
            >
              <Trash2 size={15} /> Xóa bài kiểm tra
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

interface ExamRowProps {
  exam: Exam
  onRequestDelete: (exam: Exam) => void
}

function ExamRow({ exam, onRequestDelete }: ExamRowProps) {
  const requiredCounts = calculateRequiredCounts({
    totalQuestions: exam.totalQuestions,
    easyPercentage: exam.easyPercentage,
    mediumPercentage: exam.mediumPercentage,
    hardPercentage: exam.hardPercentage,
  })
  const hasAssignment = exam.assignedCount > 0
  const hasSubmission = exam.submittedCount > 0
  const submittedRatio = hasAssignment
    ? Math.round((exam.submittedCount / exam.assignedCount) * 100)
    : 0
  const isDraft = exam.lifecycle === 'draft'

  const submissionProgress = (
    <div className="w-24">
      <p className="font-semibold text-slate-800 group-hover/progress:text-indigo-600 transition-colors">
        {exam.submittedCount}/{exam.assignedCount}
      </p>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
        <div
          className="h-full rounded-full"
          style={{ width: `${submittedRatio}%`, background: primaryGradient }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{submittedRatio}%</p>
    </div>
  )

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className="px-5 py-4">
        <p className="font-semibold text-slate-800" title={exam.description || undefined}>
          {exam.title}
        </p>
        <div className="mt-1.5">
          <TopicBadge topic={exam.topic} />
        </div>
      </td>

      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
        {formatDuration(exam.durationMinutes)} · {exam.totalQuestions} câu ·{' '}
        {roundToOneDecimal(exam.totalQuestions * exam.pointPerQuestion)} điểm
      </td>

      <td className="px-5 py-4">
        <div
          className="w-28"
          title={`Dễ ${requiredCounts.easy} câu · Trung bình ${requiredCounts.medium} câu · Khó ${requiredCounts.hard} câu`}
        >
          <div className="flex h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="bg-emerald-500" style={{ width: `${exam.easyPercentage}%` }} />
            <div className="bg-amber-400" style={{ width: `${exam.mediumPercentage}%` }} />
            <div className="bg-red-400" style={{ width: `${exam.hardPercentage}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {exam.easyPercentage}/{exam.mediumPercentage}/{exam.hardPercentage}
          </p>
        </div>
      </td>

      <td className="px-5 py-4 whitespace-nowrap">
        <p className="text-xs text-slate-500" title={formatDateTime(exam.openAt)}>
          Mở <span className="font-semibold text-slate-600">{formatScheduleMoment(exam.openAt)}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5" title={formatDateTime(exam.closeAt)}>
          Đóng <span className="font-semibold text-slate-600">{formatScheduleMoment(exam.closeAt)}</span>
        </p>
      </td>

      <td className="px-5 py-4">
        {!hasAssignment && <p className="text-slate-400">Chưa giao</p>}
        {hasAssignment && !hasSubmission && submissionProgress}
        {hasAssignment && hasSubmission && (
          <NavLink
            to={`/giao-vien/ket-qua?bai-kiem-tra=${exam.id}`}
            aria-label={`Xem kết quả bài kiểm tra ${exam.title}`}
            title="Xem kết quả của bài kiểm tra này"
            className="group/progress inline-block align-top -m-1.5 p-1.5 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            {submissionProgress}
          </NavLink>
        )}
      </td>

      <td className="px-5 py-4">
        <LifecycleBadge lifecycle={exam.lifecycle} />
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-2">
          <NavLink
            to={`/giao-vien/bai-kiem-tra/${exam.id}`}
            className={`${rowActionClass} text-slate-600 bg-white border border-slate-200 hover:bg-slate-100`}
          >
            Chi tiết
          </NavLink>
          {isDraft ? (
            <button
              type="button"
              disabled
              title="Cần lưu bài kiểm tra trước khi giao"
              className={`${rowActionClass} text-slate-300 bg-slate-50 cursor-not-allowed`}
            >
              Giao bài
            </button>
          ) : (
            <NavLink
              to={`/giao-vien/bai-kiem-tra/${exam.id}/giao-bai`}
              className={`${rowActionClass} text-indigo-600 bg-indigo-50 hover:bg-indigo-100`}
            >
              Giao bài
            </NavLink>
          )}
          <ExamRowMenu exam={exam} onRequestDelete={onRequestDelete} />
        </div>
      </td>
    </tr>
  )
}

export default function ExamListPage() {
  const toast = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>('all')
  const [page, setPage] = useState(1)
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null)
  const [deleting, setDeleting] = useState(false)

  const search = useDebouncedValue(searchInput, 350)
  const { data, loading, error, reload } = useAsync(
    () => listExams({ search, lifecycle, page, pageSize: PAGE_SIZE }),
    [search, lifecycle, page],
  )

  const exams = data?.items ?? []
  const isFiltering = searchInput.trim() !== '' || lifecycle !== 'all'

  const resetFilters = () => {
    setSearchInput('')
    setLifecycle('all')
    setPage(1)
  }

  const handleDelete = async () => {
    if (!examToDelete) return
    setDeleting(true)
    try {
      await deleteExam(examToDelete.id)
      toast.success(`Đã xóa bài kiểm tra "${examToDelete.title}".`)
      setExamToDelete(null)
      // Về trang đầu để không mắc kẹt ở trang vừa trống sau khi xóa
      if (page === 1) reload()
      else setPage(1)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không xóa được bài kiểm tra.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <TeacherLayout
      pageTitle="Bài kiểm tra"
      pageSubtitle="Quản lý ma trận đề, lịch mở bài và trạng thái giao bài"
    >
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5 animate-fade-in-up">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={event => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                placeholder="Tìm theo tên bài, chủ đề"
                aria-label="Tìm kiếm bài kiểm tra"
              />
            </div>

            <select
              value={lifecycle}
              onChange={event => {
                setLifecycle(event.target.value as LifecycleFilter)
                setPage(1)
              }}
              aria-label="Lọc theo trạng thái"
              className={selectClass}
            >
              {lifecycleOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {isFiltering && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                <FilterX size={15} /> Xóa bộ lọc
              </button>
            )}
          </div>

          <NavLink
            to="/giao-vien/bai-kiem-tra/tao"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
            style={{ background: primaryGradient }}
          >
            <Plus size={16} /> Tạo bài kiểm tra
          </NavLink>
        </div>

        {data && !error && exams.length > 0 && (
          <p className="text-sm text-slate-500 mt-3">
            Tìm thấy <strong className="font-semibold text-slate-700">{data.total}</strong> bài kiểm tra
          </p>
        )}
      </div>

      {loading && !data && <SkeletonTable rows={8} cols={7} />}

      {error && !loading && <ErrorState message={error} onRetry={reload} />}

      {data && !error && exams.length === 0 && (
        <>
          {isFiltering ? (
            <EmptyState
              icon={Search}
              title="Không tìm thấy bài kiểm tra phù hợp"
              description="Không có bài kiểm tra nào khớp với từ khóa và bộ lọc hiện tại. Hãy thử từ khóa khác hoặc bỏ bộ lọc."
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  Xóa bộ lọc
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="Chưa có bài kiểm tra nào"
              description="Tạo bài kiểm tra đầu tiên để dựng ma trận đề, đặt lịch mở bài và giao cho học sinh."
              action={
                <NavLink
                  to="/giao-vien/bai-kiem-tra/tao"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={{ background: primaryGradient }}
                >
                  <Plus size={16} /> Tạo bài kiểm tra đầu tiên
                </NavLink>
              }
            />
          )}
        </>
        )}

        {data && !error && exams.length > 0 && (
          <div
            className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up transition-opacity ${
              loading ? 'opacity-60' : ''
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className={headCellClass}>Bài kiểm tra</th>
                    <th className={headCellClass}>Cấu hình</th>
                    <th className={headCellClass}>Độ khó</th>
                    <th className={headCellClass}>Lịch</th>
                    <th className={headCellClass}>Tiến độ nộp</th>
                    <th className={headCellClass}>Trạng thái</th>
                    <th className={`${headCellClass} text-right`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map(exam => (
                    <ExamRow key={exam.id} exam={exam} onRequestDelete={setExamToDelete} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 pb-4">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </div>
          </div>
        )}

      <ConfirmDialog
        open={examToDelete !== null}
        tone="danger"
        title="Xóa bài kiểm tra"
        message={`Bạn có chắc muốn xóa "${examToDelete?.title ?? ''}"? Toàn bộ lượt giao bài của bài kiểm tra này cũng bị gỡ và không thể khôi phục.`}
        confirmLabel="Xóa bài kiểm tra"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setExamToDelete(null)}
      />
    </TeacherLayout>
  )
}
