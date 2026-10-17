import { useMemo, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Eye, Pencil, RefreshCw, Search, Send, Users } from 'lucide-react'
import { StatusBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import Pagination from '../../../components/common/Pagination'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { formatDateTime, formatScore, getScoreTone, normalizeText } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { examStatusLabels } from '../../../types'
import type { Exam, ExamAssignment, ExamStatus } from '../../../types'
import TableScroller from '../../../components/common/TableScroller'
import StudentStatusPill from '../../students/components/StudentStatusPill'
import { paperIndexOfLabel } from '../utils/paperPlan'

const ROWS_PER_PAGE = 10

const primaryGradient = 'linear-gradient(135deg,#6366F1,#8B5CF6)'

type StatusFilter = 'all' | ExamStatus

/** Thứ tự bảng học sinh. Mặc định là em nộp sớm nhất ở trên cùng. */
type SortKey = 'submit-asc' | 'submit-desc' | 'score-desc' | 'score-asc'

const DEFAULT_SORT: SortKey = 'submit-asc'

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: 'submit-asc', label: 'Nộp sớm nhất' },
  { key: 'submit-desc', label: 'Nộp mới nhất' },
  { key: 'score-desc', label: 'Điểm cao nhất' },
  { key: 'score-asc', label: 'Điểm thấp nhất' },
]

const submittedTime = (assignment: ExamAssignment): number | undefined => {
  if (!assignment.submittedAt) return undefined
  const time = Date.parse(assignment.submittedAt)
  return Number.isFinite(time) ? time : undefined
}

/**
 * So hai dòng theo thứ tự đã chọn. Em chưa có giá trị để xếp (chưa nộp, hay chưa được xem điểm) luôn nằm dưới các em đã
 * có, ở mọi chiều sắp xếp — nên "nộp mới nhất" không đẩy những em chưa nộp lên đầu. Hai dòng bằng nhau giữ nguyên thứ tự
 * máy chủ trả về (theo mã học sinh).
 */
function compareAssignments(sort: SortKey, left: ExamAssignment, right: ExamAssignment): number {
  const byValue = (a: number | undefined, b: number | undefined, direction: 1 | -1) => {
    if (a === undefined && b === undefined) return 0
    if (a === undefined) return 1
    if (b === undefined) return -1
    return (a - b) * direction
  }

  switch (sort) {
    case 'submit-asc':
      return byValue(submittedTime(left), submittedTime(right), 1)
    case 'submit-desc':
      return byValue(submittedTime(left), submittedTime(right), -1)
    case 'score-desc':
      return byValue(left.score, right.score, -1) || byValue(submittedTime(left), submittedTime(right), 1)
    default:
      return byValue(left.score, right.score, 1) || byValue(submittedTime(left), submittedTime(right), 1)
  }
}

/** Các mục của ô chọn trạng thái làm bài; số học sinh của từng mục ghi ngay trong nhãn. */
const progressOptions: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Tất cả trạng thái' },
  { key: 'assigned', label: 'Chưa bắt đầu' },
  { key: 'inprogress', label: examStatusLabels.inprogress },
  { key: 'submitted', label: 'Chờ chấm' },
  { key: 'graded', label: examStatusLabels.graded },
  { key: 'expired', label: examStatusLabels.expired },
]

/** Địa chỉ giữ lớp đang xem (`?lop=12`): quay lại từ trang bài làm thì vẫn đứng ở đúng lớp đó. */
const CLASS_PARAM = 'lop'

/** Khoá của nhóm không gắn với lớp nào (dữ liệu cũ từ thời còn giao riêng từng em). */
const NO_CLASS_KEY = 'le'

interface ClassSummary {
  key: string
  name: string
  total: number
  submitted: number
  started: number
}

const classKeyOf = (assignment: ExamAssignment) =>
  assignment.assignedViaGroupId === undefined ? NO_CLASS_KEY : String(assignment.assignedViaGroupId)

const cellClass = 'px-5 py-3.5'
const headerCellClass = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'

/** Nhãn thay cho nút "Xem bài làm" khi lượt làm bài chưa tồn tại hoặc chưa nộp. */
function describeMissingAttempt(status: ExamStatus): string {
  if (status === 'assigned') return 'Chưa bắt đầu'
  if (status === 'inprogress') return 'Đang làm bài'
  if (status === 'expired') return 'Không nộp bài'
  return 'Chưa có bài làm'
}

interface AssignmentRowProps {
  assignment: ExamAssignment
  /** Điểm tối đa của đề, để xếp loại điểm của em theo tỷ lệ (đề cũ có thể không phải 10). */
  maxScore: number
  /** Đề chia nhiều đề: có thêm cột mã đề của từng em. */
  showPaper: boolean
}

function AssignmentRow({ assignment, maxScore, showPaper }: AssignmentRowProps) {
  const navigate = useNavigate()
  const canViewAttempt =
    assignment.attemptId !== undefined &&
    (assignment.status === 'submitted' || assignment.status === 'graded')
  const scoreTone = assignment.score === undefined ? undefined : getScoreTone(assignment.score, maxScore)
  const paperIndex = assignment.paperLabel ? paperIndexOfLabel(assignment.paperLabel) : undefined
  const chipClass = 'inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold'

  return (
    <tr
      // Chỉ em đã có bài nộp mới có bài làm để mở; các dòng còn lại không có gì để bấm vào.
      onClick={
        canViewAttempt ? openOnRowClick(() => navigate(`/giao-vien/ket-qua/${assignment.attemptId}`)) : undefined
      }
      className={`border-b border-slate-50 hover:bg-indigo-100/70 transition-colors ${
        canViewAttempt ? 'cursor-pointer' : ''
      }`}
    >
      <td data-card="head" className={`${cellClass} font-semibold text-slate-800 whitespace-nowrap`}>
        <span className="inline-flex items-center gap-2">
          {/* Bấm tên em là mở bài làm của em đó (khi đã có bài nộp). */}
          {canViewAttempt ? (
            <NavLink
              to={`/giao-vien/ket-qua/${assignment.attemptId}`}
              title="Xem bài làm của học sinh này"
              className="hover:text-indigo-600 hover:underline transition-colors"
            >
              {assignment.studentName}
            </NavLink>
          ) : (
            assignment.studentName
          )}
          {/* Dòng của em đã bị xoá tài khoản vẫn ở lại cùng bài và điểm; không có nhãn thì một em chờ xoá
              trông y hệt em "chưa bắt đầu", và giáo viên đi nhắc một người không còn học. */}
          {assignment.studentStatus !== 'active' && <StudentStatusPill status={assignment.studentStatus} />}
        </span>
      </td>
      {/* Tài khoản đã xoá không có mã thật (service đã quy mã giữ chỗ về rỗng). */}
      <td data-label="Mã học sinh" className={`${cellClass} text-slate-500 whitespace-nowrap`}>{assignment.studentCode || '—'}</td>
      {showPaper && (
        <td data-label="Mã đề" className={`${cellClass} whitespace-nowrap`}>
          {assignment.paperLabel && paperIndex !== undefined && assignment.assignedViaGroupId !== undefined ? (
            // Bấm mã đề là mở các câu của đề đó (của lớp em đang học) ở tab Nội dung.
            <NavLink
              to={`?tab=noi-dung&lop=${assignment.assignedViaGroupId}&de=${paperIndex}`}
              title={`Xem các câu của đề ${assignment.paperLabel}`}
              className={`${chipClass} hover:bg-indigo-100 transition-colors`}
            >
              {assignment.paperLabel}
            </NavLink>
          ) : assignment.paperLabel ? (
            <span className={chipClass}>{assignment.paperLabel}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
      )}
      <td data-label="Trạng thái" className={`${cellClass} whitespace-nowrap`}>
        <StatusBadge status={assignment.status} />
      </td>
      <td data-label="Khung giờ làm bài" className={`${cellClass} text-slate-500 whitespace-nowrap`}>
        <span className="block">
          {formatDateTime(assignment.openAt)} – {formatDateTime(assignment.closeAt)}
        </span>
        <span className="text-xs text-slate-400">
          {assignment.hasScheduleOverride ? 'Khung giờ riêng' : 'Theo lịch chung'}
          {assignment.scheduleLocked && <span className="text-amber-700 font-medium"> · đã khoá giờ</span>}
        </span>
      </td>
      <td data-label="Bắt đầu" className={`${cellClass} text-slate-500 whitespace-nowrap`}>
        {assignment.startedAt ? formatDateTime(assignment.startedAt) : '—'}
      </td>
      <td data-label="Nộp lúc" className={`${cellClass} text-slate-500 whitespace-nowrap`}>
        {assignment.submittedAt ? formatDateTime(assignment.submittedAt) : '—'}
      </td>
      <td data-label="Điểm" className={`${cellClass} whitespace-nowrap`}>
        {assignment.score !== undefined && scoreTone ? (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold ${scoreTone.bg} ${scoreTone.color}`}>
            {formatScore(assignment.score)}
            {/* Màu theo điểm tối đa của đề, nên phải nói điểm tối đa: 5/5 xanh còn 5/10 cam. */}
            <span className="text-xs font-medium opacity-70">&nbsp;/ {formatScore(maxScore)}</span>
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td data-card="foot" className={`${cellClass} text-right whitespace-nowrap`}>
        {canViewAttempt ? (
          <NavLink
            to={`/giao-vien/ket-qua/${assignment.attemptId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Eye size={14} /> Xem bài làm
          </NavLink>
        ) : (
          <span className="text-xs text-slate-400">{describeMissingAttempt(assignment.status)}</span>
        )}
      </td>
    </tr>
  )
}

interface ExamTrackingPanelProps {
  exam: Exam
  assignments: ExamAssignment[]
  /** Trang chung đang nạp lại: nút làm mới ở bảng theo dõi quay trong lúc đó. */
  loading: boolean
  /**
   * Nạp lại dữ liệu dùng chung của trang. Tiến độ làm bài đọc cùng một nguồn với các tab khác, nên đổi ở đâu thì
   * đọc lại ở một chỗ.
   */
  onReload: () => void
  onOpenAssign: () => void
}

export default function ExamTrackingPanel({
  exam, assignments, loading, onReload, onOpenAssign,
}: ExamTrackingPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT)
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const search = useDebouncedValue(searchInput, 300)

  // Đi từ đề → lớp → học sinh → bài làm: lớp đang xem nằm trên địa chỉ để quay lại từ trang bài làm không mất chỗ.
  const [searchParams, setSearchParams] = useSearchParams()
  const classParam = searchParams.get(CLASS_PARAM)

  const classSummaries = useMemo<ClassSummary[]>(() => {
    const names = new Map<string, string>()
    exam.assignmentWindows.forEach(window => {
      if (window.groupId !== undefined && window.groupName) names.set(String(window.groupId), window.groupName)
    })

    const byKey = new Map<string, ClassSummary>()
    assignments.forEach(assignment => {
      const key = classKeyOf(assignment)
      const entry = byKey.get(key) ?? {
        key,
        name: key === NO_CLASS_KEY
          ? 'Giao riêng từng em (dữ liệu cũ)'
          : names.get(key) ?? (assignment.group || `Lớp ${key}`),
        total: 0,
        submitted: 0,
        started: 0,
      }
      entry.total += 1
      if (assignment.status === 'submitted' || assignment.status === 'graded') entry.submitted += 1
      if (assignment.attemptId !== undefined) entry.started += 1
      byKey.set(key, entry)
    })

    // numeric: "Lớp 10A2" đứng trước "Lớp 10A10".
    return [...byKey.values()].sort((left, right) => left.name.localeCompare(right.name, 'vi', { numeric: true }))
  }, [assignments, exam.assignmentWindows])

  // Vào đề là thấy danh sách lớp, bấm một lớp mới hiện học sinh của lớp đó: chưa chọn lớp thì không có bảng học sinh.
  const activeClass = classSummaries.find(item => item.key === classParam)

  const selectClass = (key: string | null) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (key === null) next.delete(CLASS_PARAM)
      else next.set(CLASS_PARAM, key)
      return next
    }, { replace: true })
    // Đổi lớp thì bỏ từ khoá và trạng thái đang lọc: chúng là của lớp trước.
    setSearchInput('')
    setStatusFilter('all')
    setPage(1)
  }

  const scopedAssignments = useMemo(
    () => (activeClass
      ? assignments.filter(assignment => classKeyOf(assignment) === activeClass.key)
      : assignments),
    [assignments, activeClass],
  )

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: 0, assigned: 0, inprogress: 0, submitted: 0, graded: 0, expired: 0,
    }
    scopedAssignments.forEach(assignment => {
      counts[assignment.status] += 1
    })
    counts.all = scopedAssignments.length
    return counts
  }, [scopedAssignments])

  const filteredAssignments = useMemo(() => {
    const normalizedSearch = normalizeText(search)
    return scopedAssignments
      .filter(assignment => {
        if (statusFilter !== 'all' && assignment.status !== statusFilter) return false
        if (!normalizedSearch) return true
        return [assignment.studentName, assignment.studentCode, assignment.group].some(field =>
          normalizeText(field).includes(normalizedSearch),
        )
      })
      .sort((left, right) => compareAssignments(sortKey, left, right))
  }, [scopedAssignments, search, statusFilter, sortKey])

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / ROWS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pagedAssignments = filteredAssignments.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  )

  const resetTableFilters = () => {
    setSearchInput('')
    setStatusFilter('all')
    setPage(1)
  }

  // Bản nháp chưa giao được cho ai — server từ chối 409. Chặn ngay từ nút bấm để không dẫn giáo viên
  // tới tab giao bài rồi mới báo lỗi, khớp với cách ExamListPage đã chặn nút này.
  const isDraft = exam.lifecycle === 'draft'

  return (
    <>
      <div className="animate-fade-in-up">
        <section className="space-y-6 min-w-0">
          {classSummaries.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
                <h2 className="text-base font-bold text-slate-800">Danh sách lớp</h2>
                <p className="text-xs text-slate-400">Bấm vào một lớp để xem học sinh của lớp đó</p>
              </div>
              <ul className="divide-y divide-slate-50 border-t border-slate-100">
                {classSummaries.map(item => {
                  const isActive = activeClass?.key === item.key
                  const ratio = item.total > 0 ? Math.round((item.submitted / item.total) * 100) : 0
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => selectClass(isActive ? null : item.key)}
                        className={`w-full flex items-center gap-4 px-5 py-3 text-left ${
                          isActive ? 'bg-indigo-50' : 'hover:bg-indigo-100/70'
                        }`}
                      >
                        <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate">{item.name}</span>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {item.submitted}/{item.total} học sinh đã nộp
                        </span>
                        <span className="hidden sm:block w-28 h-1.5 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${ratio}%`, background: primaryGradient }}
                          />
                        </span>
                        <ChevronRight
                          size={16}
                          className={`flex-shrink-0 transition-transform ${
                            isActive ? 'rotate-90 text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {(activeClass || assignments.length === 0) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between p-5 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {activeClass ? `Học sinh của ${activeClass.name}` : 'Theo dõi giao bài'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {filteredAssignments.length} học sinh
                    {search.trim() !== '' || statusFilter !== 'all'
                      ? ' khớp bộ lọc'
                      : activeClass ? ' trong lớp này' : ' được giao bài này'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={sortKey}
                    onChange={event => {
                      setSortKey(event.target.value as SortKey)
                      setPage(1)
                    }}
                    aria-label="Sắp xếp danh sách học sinh"
                    className="h-11 max-w-[12rem] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                  >
                    {sortOptions.map(option => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={event => {
                      setStatusFilter(event.target.value as StatusFilter)
                      setPage(1)
                    }}
                    aria-label="Lọc theo trạng thái làm bài"
                    className="h-11 max-w-[12rem] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                  >
                    {progressOptions.map(option => (
                      <option key={option.key} value={option.key}>
                        {option.label} ({statusCounts[option.key]})
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1 md:w-64">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchInput}
                      onChange={event => {
                        setSearchInput(event.target.value)
                        setPage(1)
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                      placeholder="Tìm học sinh, mã hoặc nhóm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onReload}
                    disabled={loading}
                    aria-label="Làm mới tiến độ làm bài"
                    title="Làm mới tiến độ làm bài"
                    className="w-11 h-11 flex-shrink-0 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 hover:text-indigo-600 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
                  </button>
                </div>
              </div>

              {assignments.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Users}
                    title="Chưa giao bài cho học sinh nào"
                    description={
                      isDraft
                        ? 'Bài kiểm tra vẫn đang là bản nháp nên chưa giao được. Xuất bản đề trước, rồi quay lại đây để giao.'
                        : 'Giao bài kiểm tra cho lớp để bắt đầu theo dõi tiến độ làm bài.'
                    }
                    action={
                      isDraft ? (
                        <NavLink
                          to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Pencil size={16} /> Xuất bản đề
                        </NavLink>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenAssign}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                          style={{ background: primaryGradient }}
                        >
                          <Send size={16} /> Giao bài ngay
                        </button>
                      )
                    }
                  />
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Search}
                    title="Không có học sinh nào khớp bộ lọc"
                    description="Thử đổi từ khoá tìm kiếm hoặc chọn lại trạng thái trong ô lọc."
                    action={
                      <button
                        type="button"
                        onClick={resetTableFilters}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        Xoá bộ lọc
                      </button>
                    }
                  />
                </div>
              ) : (
                <>
                  <TableScroller>
                    <table className="stack-table w-full text-sm min-w-[1100px]">
                      <thead className="bg-slate-50/60">
                        <tr>
                          <th className={headerCellClass}>Học sinh</th>
                          <th className={headerCellClass}>Mã học sinh</th>
                          {exam.paperCount > 1 && <th className={headerCellClass}>Mã đề</th>}
                          <th className={headerCellClass}>Trạng thái</th>
                          <th className={headerCellClass}>Khung giờ làm bài</th>
                          <th className={headerCellClass}>Bắt đầu</th>
                          <th className={headerCellClass}>Nộp lúc</th>
                          <th className={headerCellClass}>Điểm</th>
                          <th className={`${headerCellClass} text-right`}>Bài làm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedAssignments.map(assignment => (
                          <AssignmentRow
                            key={assignment.id}
                            assignment={assignment}
                            maxScore={exam.totalScore}
                            showPaper={exam.paperCount > 1}
                          />
                        ))}
                      </tbody>
                    </table>
                  </TableScroller>
                  {filteredAssignments.length > ROWS_PER_PAGE && (
                    <div className="px-5 pb-4">
                      <Pagination
                        page={currentPage}
                        pageSize={ROWS_PER_PAGE}
                        total={filteredAssignments.length}
                        onPageChange={setPage}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

      </div>
    </>
  )
}
