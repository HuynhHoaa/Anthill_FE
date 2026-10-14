import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart3, Copy, FileText, FilterX, MoreVertical, Pencil, Plus, Search, Trash2,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import { LifecycleBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import SearchField from '../../../components/common/SearchField'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { useUrlListState } from '../../../hooks/useUrlListState'
import { deleteExam, duplicateExam, listExams } from '../../../services/examService'
import { formatDateTime, formatDuration, parseDateTime } from '../../../lib/format'
import { lifecycleLabels } from '../../../types'
import type { Exam, ExamLifecycle } from '../../../types'
import { examDeleteConfirmCopy, examDuplicateConfirmCopy } from '../utils/examConfirmations'
import ClassUsagePopover from '../components/ClassUsagePopover'

// Tám dòng (mỗi dòng ~77px) cùng thanh trang vừa một cửa sổ cao ~900px mà không phải cuộn.
const PAGE_SIZE = 8

type LifecycleFilter = 'all' | ExamLifecycle

const lifecycleOptions: Array<{ value: LifecycleFilter; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'draft', label: lifecycleLabels.draft },
  { value: 'scheduled', label: lifecycleLabels.scheduled },
  { value: 'open', label: lifecycleLabels.open },
  { value: 'closed', label: lifecycleLabels.closed },
]

const primaryGradient = 'linear-gradient(135deg,#6366F1,#8B5CF6)'

// Ô sát hơn (px-3) dưới cỡ xl, nơi bảng phải nhét vừa ~880px; từ xl trở lên giữ px-5 như các bảng khác.
const headCellClass =
  'px-3 xl:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'

/** Cột chỉ chứa một con số: lề hẹp ở mọi cỡ để không chiếm chỗ của các cột còn lại. */
const narrowHeadCellClass =
  'px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap'

const selectClass =
  'px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'

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
  onRequestDuplicate: (exam: Exam) => void
}

const MENU_WIDTH = 224
const MENU_ITEM_HEIGHT = 44
const MENU_VERTICAL_PADDING = 12

/** Menu có 3 hay 4 mục tuỳ bài đã có người nộp hay chưa, nên chiều cao phải tính lại. */
function estimateMenuHeight(itemCount: number): number {
  return itemCount * MENU_ITEM_HEIGHT + MENU_VERTICAL_PADDING
}

/**
 * Menu phụ của mỗi dòng. Bảng nằm trong vùng cuộn ngang nên menu phải được
 * đưa ra ngoài body và neo theo toạ độ màn hình, nếu không sẽ bị cắt mất.
 */
function ExamRowMenu({ exam, onRequestDelete, onRequestDuplicate }: ExamRowMenuProps) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasSubmission = exam.submittedCount > 0
  const open = anchor !== null

  const openMenu = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuHeight = estimateMenuHeight(hasSubmission ? 4 : 3)
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
              onClick={() => {
                setAnchor(null)
                onRequestDuplicate(exam)
              }}
              className={`w-full text-left ${menuItemClass}`}
            >
              <Copy size={15} /> Nhân bản
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={hasSubmission}
              title={hasSubmission ? 'Không thể xoá bài đã có học sinh nộp' : undefined}
              onClick={() => {
                setAnchor(null)
                onRequestDelete(exam)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors ${
                hasSubmission ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'
              }`}
            >
              <Trash2 size={15} /> Xoá bài kiểm tra
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
  onRequestDuplicate: (exam: Exam) => void
}

function ExamRow({ exam, onRequestDelete, onRequestDuplicate }: ExamRowProps) {
  const hasAssignment = exam.assignedCount > 0
  const hasSubmission = exam.submittedCount > 0
  const submittedRatio = hasAssignment
    ? Math.round((exam.submittedCount / exam.assignedCount) * 100)
    : 0
  const isDraft = exam.lifecycle === 'draft'

  const submissionProgress = (
    <div className="w-full max-w-24">
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
    // Chiều cao cố định: hàng chưa giao không có ô tiến độ nên thấp hơn hàng đã giao, và thanh trang
    // sẽ nhảy lên xuống tuỳ trang đó nhiều hay ít đề đã giao.
    <tr className="h-[77px] border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className="px-3 xl:px-5 py-3">
        <p className="font-semibold text-slate-800 line-clamp-2" title={exam.description || undefined}>
          {exam.title}
        </p>
      </td>

      <td className="px-3 xl:px-5 py-3 text-slate-600">
        <p>{formatDuration(exam.durationMinutes)}</p>
        <p className="text-xs text-slate-400 mt-0.5">{exam.totalQuestions} câu</p>
      </td>

      {/* Cột phụ: dưới cỡ xl nhường chỗ cho Tiến độ và Trạng thái, hai cột cần thấy ngay không cuộn. */}
      <td className="px-3 py-3 max-xl:hidden">
        {/*
          Nói tỷ lệ chứ không nói số câu: phép làm tròn từ tỷ lệ ra số câu do server giữ, nên một
          con số tự tính lại ở đây có thể lệch với đề thật sự được sinh ra. Cần số câu chính xác
          thì mở trang sửa đề, nơi có sẵn kết quả xem trước từ server.
        */}
        <div
          className="w-full max-w-28"
          title={`Dễ ${exam.easyPercentage}% · Trung bình ${exam.mediumPercentage}% · Khó ${exam.hardPercentage}%`}
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

      <td className="px-3 xl:px-5 py-3 whitespace-nowrap">
        <p className="text-xs text-slate-500" title={formatDateTime(exam.openAt)}>
          Mở <span className="font-semibold text-slate-600">{formatScheduleMoment(exam.openAt)}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5" title={formatDateTime(exam.closeAt)}>
          Đóng <span className="font-semibold text-slate-600">{formatScheduleMoment(exam.closeAt)}</span>
        </p>
      </td>

      <td className="px-3 py-3">
        <ClassUsagePopover windows={exam.assignmentWindows} />
      </td>

      <td className="px-3 py-3">
        {!hasAssignment && <p className="text-slate-400 whitespace-nowrap">Chưa giao</p>}
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

      <td className="px-3 py-3">
        {/* Một trạng thái duy nhất, theo lịch chung của đề. Giờ mở/đóng riêng của từng lớp nằm ở trang chi tiết. */}
        <LifecycleBadge lifecycle={exam.lifecycle} />
      </td>

      <td className="px-3 xl:px-5 py-3">
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
              title="Cần xuất bản đề trước khi giao"
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
          <ExamRowMenu exam={exam} onRequestDelete={onRequestDelete} onRequestDuplicate={onRequestDuplicate} />
        </div>
      </td>
    </tr>
  )
}

export default function ExamListPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  // Tìm kiếm, trạng thái và trang nằm trên URL: mở một đề rồi Back về đúng bộ lọc và đúng trang đang xem.
  const { searchInput, setSearchInput, search, filters, setFilter, page, setPage, clearAll } = useUrlListState(
    { 'trang-thai': { default: 'all', allowed: lifecycleOptions.map(option => option.value) } },
    { debounceMs: 350 },
  )
  const lifecycle = filters['trang-thai'] as LifecycleFilter
  const { data, loading, error, reload } = useAsync(
    () => listExams({ search, lifecycle, page, pageSize: PAGE_SIZE }),
    [search, lifecycle, page],
  )

  const exams = data?.items ?? []
  const isFiltering = searchInput.trim() !== '' || lifecycle !== 'all'
  const { tableRef, wrapperStyle } = useStableTableHeight(exams, PAGE_SIZE, data?.total ?? 0)

  const requestDelete = async (exam: Exam) => {
    const deleted = await confirm({
      ...examDeleteConfirmCopy(exam),
      onConfirm: () => deleteExam(exam.id),
    })
    if (!deleted) return
    toast.success(`Đã xoá bài kiểm tra "${exam.title}".`)
    // Về trang đầu để không mắc kẹt ở trang vừa trống sau khi xoá
    if (page === 1) reload()
    else setPage(1)
  }

  // Sang thẳng trang sửa bản sao, cùng hành vi với trang chi tiết: nhân bản là để đổi cấu hình.
  const requestDuplicate = async (exam: Exam) => {
    const outcome: { copy?: Exam } = {}
    const confirmed = await confirm({
      ...examDuplicateConfirmCopy(exam),
      onConfirm: async () => {
        outcome.copy = await duplicateExam(exam.id)
      },
    })
    const copy = outcome.copy
    if (!confirmed || !copy) return
    toast.success(`Đã tạo bản sao "${copy.title}". Bản sao đang là bản nháp, chưa giao cho ai.`)
    navigate(`/giao-vien/bai-kiem-tra/${copy.id}/sua`)
  }

  // Công cụ của trang nằm trên thanh tiêu đề (từ cỡ lg), thay cho một thẻ riêng phía trên bảng.
  const tools = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
      <div className="flex-1 min-w-[12rem] max-w-xs">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Tìm theo tên bài, chủ đề"
          label="Tìm kiếm bài kiểm tra"
        />
      </div>

      <select
        value={lifecycle}
        onChange={event => setFilter('trang-thai', event.target.value)}
        aria-label="Lọc theo trạng thái"
        className={selectClass}
      >
        {lifecycleOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Luôn có mặt (mờ đi khi chưa lọc gì): hiện ra giữa chừng thì ô tìm kiếm bị đẩy sang trái ngay
          khi người dùng gõ chữ đầu tiên. */}
      <button
        type="button"
        onClick={clearAll}
        disabled={!isFiltering}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-default disabled:hover:bg-slate-100"
      >
        <FilterX size={15} /> Xoá bộ lọc
      </button>

      <NavLink
        to="/giao-vien/bai-kiem-tra/tao"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
        style={{ background: primaryGradient }}
      >
        <Plus size={16} /> Tạo bài kiểm tra
      </NavLink>
    </div>
  )

  return (
    <TeacherLayout
      pageTitle="Bài kiểm tra"
      pageSubtitle={
        data && !error
          ? `${data.total} bài kiểm tra${isFiltering ? ' khớp bộ lọc' : ''}`
          : 'Quản lý ma trận đề, lịch mở bài và trạng thái giao bài'
      }
      compactContent
      headerTools={tools}
    >
      {loading && !data && <SkeletonTable rows={8} cols={8} />}

      {error && !loading && <ErrorState message={error} onRetry={reload} />}

      {data && !error && exams.length === 0 && (
        <>
          {isFiltering ? (
            <EmptyState
              icon={Search}
              title="Không tìm thấy bài kiểm tra phù hợp"
              description="Không có bài kiểm tra nào khớp từ khoá và bộ lọc hiện tại. Thử từ khoá khác hoặc xoá bộ lọc."
              action={
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  Xoá bộ lọc
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
            <TableScroller style={wrapperStyle}>
              {/* Bố cục cố định, cột chia theo tỉ lệ: đổi trang không làm các cột xê dịch. Cột thao tác
                  240px là vừa đủ cho "Chi tiết" + "Giao bài" + nút ba chấm. Tám cột cần 1100px; dưới cỡ xl
                  cột Độ khó ẩn đi và còn sáu cột chia vừa ~900px, hẹp hơn nữa thì cuộn ngang và cột thao
                  tác dính mép phải. */}
              <table ref={tableRef} className="w-full table-fixed text-sm min-w-[760px] xl:min-w-[1100px]">
                <colgroup>
                  <col className="w-[17%] xl:w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%] max-xl:hidden" />
                  <col className="w-[17%] xl:w-[15%]" />
                  <col className="w-[6%] xl:w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%] xl:w-[10%]" />
                  <col className="w-60" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className={headCellClass}>Bài kiểm tra</th>
                    <th className={headCellClass}>Cấu hình</th>
                    <th className={`${narrowHeadCellClass} max-xl:hidden`}>Độ khó</th>
                    <th className={headCellClass}>Lịch</th>
                    <th className={narrowHeadCellClass}>Số lớp</th>
                    <th className={narrowHeadCellClass} title="Số học sinh đã nộp bài / số học sinh được giao">
                      Đã nộp
                    </th>
                    <th className={narrowHeadCellClass}>Trạng thái</th>
                    <th className={`${headCellClass} text-right`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map(exam => (
                    <ExamRow
                      key={exam.id}
                      exam={exam}
                      onRequestDelete={target => void requestDelete(target)}
                      onRequestDuplicate={target => void requestDuplicate(target)}
                    />
                  ))}
                </tbody>
              </table>
            </TableScroller>

            <div className="px-5 pb-4">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </div>
          </div>
        )}
    </TeacherLayout>
  )
}
