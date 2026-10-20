import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowRightLeft, Eye, Pencil, Search, UserMinus, UserPlus, UsersRound, X,
} from 'lucide-react'
import EmptyState from '../../../components/common/EmptyState'
import Pagination from '../../../components/common/Pagination'
import RowActionMenu, { type RowMenuItem } from '../../../components/common/RowActionMenu'
import TableScroller from '../../../components/common/TableScroller'
import { usePagination } from '../../../hooks/usePagination'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { formatScore, getInitials, getScoreTone, normalizeText } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { isRetiredStudent } from '../../../services/studentService'
import type { Student } from '../../../types'
import StudentStatusPill from '../../students/components/StudentStatusPill'
import { getAvatarTone } from './groupTheme'

/** Mười dòng gọn (avatar nhỏ, tên và tên đăng nhập) cùng thanh trang vừa một cửa sổ cao ~900px. Đổi thì đo lại. */
export const GROUP_STUDENTS_PAGE_SIZE = 10

const headerCellClass = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500'

const LOCKED_HINT = 'Lớp đã khoá nên chỉ xem được. Hãy mở khoá lớp trước khi thay đổi.'
const RETIRED_HINT = 'Tài khoản đang chờ xoá hoặc đã xoá. Hãy khôi phục tài khoản trước.'

interface GroupStudentsPanelProps {
  students: Student[]
  search: string
  page: number
  onPageChange: (page: number) => void
  onClearSearch: () => void
  onAdd: () => void
  onTransfer: (student: Student) => void
  onRemove: (student: Student) => void
  /** Lớp đã khoá: chỉ xem, không thêm, chuyển hay gỡ em. */
  locked?: boolean
  /** Làm mờ trong lúc tải lại nền, để bảng cũ không trông như dữ liệu mới. */
  dimmed?: boolean
}

/**
 * Danh sách học sinh trong lớp, dưới quyền quản trị viên: xem hồ sơ, chuyển lớp, gỡ khỏi lớp (cả hai đều bắt buộc lý do).
 *
 * Bấm cả dòng là mở hồ sơ và bài làm của em. Lớp đã khoá thì hai mục "Chuyển lớp" và "Gỡ khỏi lớp" mờ đi kèm lời giải
 * thích ngay trong menu.
 */
export default function GroupStudentsPanel({
  students, search, page, onPageChange, onClearSearch, onAdd, onTransfer, onRemove, locked = false, dimmed = false,
}: GroupStudentsPanelProps) {
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const keyword = normalizeText(search)
    if (!keyword) return students
    return students.filter(student =>
      normalizeText(`${student.fullName} ${student.code} ${student.email} ${student.username}`).includes(keyword),
    )
  }, [students, search])

  const { currentPage, pageItems } = usePagination(filtered, GROUP_STUDENTS_PAGE_SIZE, page, onPageChange)
  const { tableRef, wrapperStyle } = useStableTableHeight(pageItems, GROUP_STUDENTS_PAGE_SIZE, filtered.length)

  if (students.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Lớp chưa có học sinh nào"
        description={
          locked
            ? 'Lớp đã khoá nên không xếp thêm học sinh được. Mở khoá lớp ở phần Thiết lập nếu cần thay đổi.'
            : 'Xếp học sinh vào lớp để giáo viên phụ trách có thể giao bài kiểm tra cho cả lớp chỉ với một thao tác.'
        }
        action={
          locked ? undefined : (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }}
            >
              <UserPlus size={16} /> Thêm học sinh vào lớp
            </button>
          )
        }
      />
    )
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Không tìm thấy học sinh phù hợp"
        description={`Không có học sinh nào trong lớp khớp với từ khoá "${search.trim()}".`}
        action={
          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <X size={15} /> Xoá tìm kiếm
          </button>
        }
      />
    )
  }

  return (
    <>
      <div
        className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up transition-opacity ${
          dimmed ? 'opacity-60' : 'opacity-100'
        }`}
      >
        <TableScroller style={wrapperStyle}>
          <table ref={tableRef} className="stack-table w-full table-fixed text-sm min-w-[820px]">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[17%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className={`${headerCellClass} text-left`}>Học sinh</th>
                <th className={`${headerCellClass} text-left`}>Mã</th>
                <th className={`${headerCellClass} text-left`}>Điểm TB</th>
                <th className={`${headerCellClass} text-left`}>Đã làm</th>
                <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                <th className={`${headerCellClass} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(student => {
                const tone = getAvatarTone(student.id)
                const scoreTone = getScoreTone(student.averageScore)
                const retired = isRetiredStudent(student)
                const profile = `/quan-tri/hoc-sinh/${student.id}`

                const items: RowMenuItem[] = [
                  { key: 'view', label: 'Xem hồ sơ và bài làm', icon: Eye, to: profile },
                  ...(retired ? [] : [{ key: 'edit', label: 'Sửa hồ sơ', icon: Pencil, to: `${profile}/sua` }]),
                  {
                    key: 'transfer',
                    label: 'Chuyển lớp',
                    icon: ArrowRightLeft,
                    onSelect: () => onTransfer(student),
                    disabled: retired || locked,
                    disabledHint: retired ? RETIRED_HINT : LOCKED_HINT,
                  },
                  {
                    key: 'remove',
                    label: 'Gỡ khỏi lớp',
                    icon: UserMinus,
                    tone: 'danger',
                    onSelect: () => onRemove(student),
                    disabled: locked,
                    disabledHint: LOCKED_HINT,
                  },
                ]

                return (
                  <tr
                    key={student.id}
                    onClick={openOnRowClick(() => navigate(profile))}
                    className={`border-b border-slate-50 hover:bg-indigo-100/70 transition-colors cursor-pointer ${
                      retired ? 'text-slate-400' : ''
                    }`}
                  >
                    <td data-card="head" className="px-4 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            retired ? 'bg-slate-100 text-slate-400' : `${tone.bg} ${tone.text}`
                          }`}
                        >
                          {getInitials(student.fullName)}
                        </div>
                        <div className="min-w-0">
                          <NavLink
                            to={profile}
                            className={`block text-sm font-semibold truncate transition-colors hover:text-indigo-600 ${
                              retired ? 'text-slate-500' : 'text-slate-800'
                            }`}
                          >
                            {student.fullName}
                          </NavLink>
                          <p className="text-xs text-slate-400 truncate">@{student.username}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Mã" className="px-4 py-2 text-slate-600 truncate">{student.code}</td>
                    <td data-label="Điểm TB" className="px-4 py-2">
                      {student.assignedExams > 0 ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-sm font-bold ${scoreTone.bg} ${scoreTone.color}`}
                        >
                          {formatScore(student.averageScore)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa có</span>
                      )}
                    </td>
                    <td data-label="Đã làm" className="px-4 py-2 text-slate-600 whitespace-nowrap">
                      {student.completedExams > 0 ? `${student.completedExams} bài` : student.hasStartedExams ? 'Đang làm' : '—'}
                    </td>
                    <td data-label="Trạng thái" className="px-4 py-2">
                      <StudentStatusPill status={student.status} deletionScheduledAt={student.deletionScheduledAt} />
                    </td>
                    <td data-card="foot" className="px-4 py-2">
                      <div className="flex items-center justify-end">
                        <RowActionMenu label={student.fullName} items={items} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroller>
      </div>

      <Pagination page={currentPage} pageSize={GROUP_STUDENTS_PAGE_SIZE} total={filtered.length} onPageChange={onPageChange} />
    </>
  )
}
