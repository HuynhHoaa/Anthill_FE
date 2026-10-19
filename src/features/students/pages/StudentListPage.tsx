// Trang thuộc vai trò quản trị viên: admin sở hữu tài khoản học sinh.
import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Eye, FilterX, Pencil, Plus, RotateCcw, Search, ShieldCheck, ShieldOff, Trash2, UserPlus, UsersRound,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import RowActionMenu, { type RowMenuItem } from '../../../components/common/RowActionMenu'
import SearchField from '../../../components/common/SearchField'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import useAsync from '../../../hooks/useAsync'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { useUrlListState } from '../../../hooks/useUrlListState'
import { formatDateTime, formatGroupNames, formatScore, getInitials, getScoreTone } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME, listGroups } from '../../../services/groupService'
import { isRetiredStudent, listStudents } from '../../../services/studentService'
import ImportExcelButton from '../../imports/components/ImportExcelButton'
import StudentStatusPill from '../components/StudentStatusPill'
import { useStudentAccountActions } from '../hooks/useStudentAccountActions'
import { studentStatusLabels, type StudentStatus } from '../../../types'

// Mười hai dòng ~52px (avatar nhỏ, tên và email) cùng thanh trang vừa một cửa sổ cao ~900px sau khi công cụ đã lên thanh
// tiêu đề. Đổi cỡ trang hay độ cao dòng thì đo lại bằng cửa sổ 1440x900.
const PAGE_SIZE = 12

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }
const headerCellClass = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500'
const selectClass =
  'px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'

/** Thứ tự trong ô lọc đi theo vòng đời tài khoản: đang dùng, bị khoá, chờ xoá, đã xoá. */
const statusFilterOptions: StudentStatus[] = ['active', 'locked', 'pendingDeletion', 'deleted']

export default function StudentListPage() {
  const accountActions = useStudentAccountActions()
  const navigate = useNavigate()

  // Từ khoá, bộ lọc và số trang nằm trên URL: Back từ hồ sơ một em về đúng chỗ đang xem, và đường dẫn có sẵn bộ lọc
  // (?trang-thai=...) mở được thẳng. Giữ ID nhóm chứ không giữ tên: bộ lọc phải sống sót qua việc đổi tên nhóm lớp. Chỉ nhận đúng các
  // trạng thái có trong ô lọc: một giá trị lạ lọt vào thì server trả 400 và cả trang thành trang lỗi.
  const { searchInput, setSearchInput, search, filters, setFilter, page, setPage, clearAll } = useUrlListState({
    'trang-thai': { default: 'all', allowed: ['all', ...statusFilterOptions] },
    nhom: { default: 'all' },
  })
  const status = filters['trang-thai'] as 'all' | StudentStatus
  const requestedGroup = Number(filters.nhom)
  const groupFilter =
    filters.nhom !== 'all' && Number.isInteger(requestedGroup) && requestedGroup >= 0 ? requestedGroup : undefined
  const trimmedSearch = search.trim()
  const hasActiveFilters = trimmedSearch !== '' || groupFilter !== undefined || status !== 'all'

  const summaryQuery = useAsync(async () => {
    const [activeOnly, lockedOnly, pendingOnly, groups] = await Promise.all([
      listStudents({ status: 'active', page: 1, pageSize: 1 }),
      listStudents({ status: 'locked', page: 1, pageSize: 1 }),
      listStudents({ status: 'pendingDeletion', page: 1, pageSize: 1 }),
      listGroups(),
    ])
    // "Học sinh" là em còn theo học, không gồm tài khoản chờ xoá hay đã xoá; ô lọc trạng thái mới cho xem hai loại đó.
    return {
      totalStudents: activeOnly.total + lockedOnly.total,
      activeStudents: activeOnly.total,
      lockedStudents: lockedOnly.total,
      pendingDeletionStudents: pendingOnly.total,
      groups,
    }
  }, [])

  const studentsQuery = useAsync(
    () => listStudents({ search: trimmedSearch, groupId: groupFilter, status, page, pageSize: PAGE_SIZE }),
    [trimmedSearch, groupFilter, status, page],
  )

  const summary = summaryQuery.data
  const groupOptions = summary?.groups ?? []
  const students = studentsQuery.data?.items ?? []
  const total = studentsQuery.data?.total ?? 0

  // Thao tác trên dòng cuối cùng của trang cuối — xoá một em khi đang lọc "Đang hoạt động" — làm
  // trang đó trống. Lùi về trang cuối còn dữ liệu thay vì để người dùng đứng trước "Không tìm thấy".
  const loadedPage = studentsQuery.data
  if (loadedPage && !studentsQuery.loading && loadedPage.items.length === 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(loadedPage.total / loadedPage.pageSize))
    if (lastPage < page) setPage(lastPage)
  }

  const { tableRef, wrapperStyle } = useStableTableHeight(students, PAGE_SIZE, total)

  const reloadAll = () => {
    studentsQuery.reload()
    summaryQuery.reload()
  }

  /** Mọi thao tác tài khoản đều có thể đổi con số ở phụ đề, nên tải lại cả hai truy vấn. */
  const runAccountAction = async (pending: Promise<boolean>) => {
    if (await pending) reloadAll()
  }

  const summaryText = useMemo(() => {
    if (!summary) return null
    // "Đang theo học" nói rõ con số này không gồm tài khoản chờ xoá hay đã xoá — ô lọc "Tất cả trạng
    // thái" thì có, nên hai con số được phép khác nhau mà không ai tưởng một bên sai.
    return [
      `${summary.totalStudents} đang theo học`,
      `${summary.activeStudents} hoạt động`,
      summary.lockedStudents > 0 ? `${summary.lockedStudents} đã khoá` : '',
      summary.pendingDeletionStudents > 0 ? `${summary.pendingDeletionStudents} chờ xoá` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }, [summary])

  // Công cụ nằm trên thanh tiêu đề (từ cỡ lg), thay cho một thẻ riêng phía trên bảng.
  const tools = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
      <div className="flex-1 min-w-[10rem] max-w-[14rem]">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Tìm tên, email, mã"
          label="Tìm kiếm học sinh"
        />
      </div>

      <select
        value={groupFilter === undefined ? 'all' : String(groupFilter)}
        onChange={event => setFilter('nhom', event.target.value)}
        aria-label="Lọc theo nhóm lớp"
        className={`${selectClass} max-w-[9.5rem]`}
      >
        <option value="all">Tất cả lớp</option>
        {groupOptions.map(item => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
        {/* Học sinh vừa bị gỡ khỏi nhóm vẫn phải lọc ra được. */}
        <option value={UNASSIGNED_GROUP_ID}>{UNASSIGNED_GROUP_NAME}</option>
      </select>

      <select
        value={status}
        onChange={event => setFilter('trang-thai', event.target.value)}
        aria-label="Lọc theo trạng thái"
        className={selectClass}
      >
        <option value="all">Mọi trạng thái</option>
        {statusFilterOptions.map(option => (
          <option key={option} value={option}>{studentStatusLabels[option]}</option>
        ))}
      </select>

      <ImportExcelButton kind="school" onImported={reloadAll} />

      <NavLink
        to="/quan-tri/hoc-sinh/tao"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
        style={primaryButtonStyle}
      >
        <Plus size={16} /> Thêm học sinh
      </NavLink>
    </div>
  )

  return (
    <AdminLayout
      pageTitle="Học sinh"
      pageSubtitle={
        summaryText
          ? `${summaryText}${hasActiveFilters && studentsQuery.data ? ` · ${total} khớp bộ lọc` : ''}`
          : 'Quản lý tài khoản, nhóm lớp và trạng thái học sinh'
      }
      compactContent
      headerTools={tools}
    >
      {studentsQuery.loading && !studentsQuery.data ? (
        <SkeletonTable rows={8} cols={5} />
      ) : studentsQuery.error ? (
        <ErrorState message={studentsQuery.error} onRetry={reloadAll} />
      ) : students.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Search}
            title="Không tìm thấy học sinh phù hợp"
            description="Không có học sinh nào khớp với từ khoá và bộ lọc hiện tại. Hãy thử từ khoá khác hoặc xoá bớt bộ lọc."
            action={
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <FilterX size={15} /> Xoá bộ lọc
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={UsersRound}
            title="Chưa có học sinh nào"
            description="Hãy thêm học sinh đầu tiên để bắt đầu giao bài kiểm tra và theo dõi kết quả học tập."
            action={
              <NavLink
                to="/quan-tri/hoc-sinh/tao"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                style={primaryButtonStyle}
              >
                <UserPlus size={16} /> Thêm học sinh
              </NavLink>
            }
          />
        )
      ) : (
        <>
          <div
            className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity animate-fade-in-up ${
              studentsQuery.loading ? 'opacity-60' : ''
            }`}
          >
            <TableScroller style={wrapperStyle}>
              <table ref={tableRef} className="stack-table w-full table-fixed text-sm min-w-[860px]">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[22%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className={`${headerCellClass} text-left`}>Học sinh</th>
                    <th className={`${headerCellClass} text-left`}>Nhóm/lớp</th>
                    <th className={`${headerCellClass} text-left`}>Kết quả</th>
                    <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                    <th className={`${headerCellClass} text-right`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const scoreTone = getScoreTone(student.averageScore)
                    const isActive = student.status === 'active'
                    // Tài khoản đã rời hệ thống thì khoá, mở khoá hay xoá lần nữa đều vô nghĩa —
                    // dòng đó chỉ còn nút xem, và nút khôi phục khi còn trong hạn.
                    const isRetired = isRetiredStudent(student)
                    const profile = `/quan-tri/hoc-sinh/${student.id}`

                    const items: RowMenuItem[] = [
                      { key: 'view', label: 'Xem hồ sơ và bài làm', icon: Eye, to: profile },
                      ...(isRetired ? [] : [{ key: 'edit', label: 'Sửa hồ sơ', icon: Pencil, to: `${profile}/sua` }]),
                      ...(student.status === 'pendingDeletion'
                        ? [{
                          key: 'restore',
                          label: 'Khôi phục tài khoản',
                          icon: RotateCcw,
                          onSelect: () => void runAccountAction(accountActions.restore(student)),
                        }]
                        : []),
                      ...(isRetired
                        ? []
                        : [
                          {
                            key: 'lock',
                            label: isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
                            icon: isActive ? ShieldOff : ShieldCheck,
                            onSelect: () => void runAccountAction(accountActions.toggleLock(student)),
                          },
                          {
                            key: 'delete',
                            label: 'Xoá tài khoản',
                            icon: Trash2,
                            tone: 'danger' as const,
                            onSelect: () => void runAccountAction(accountActions.requestDeletion(student)),
                          },
                        ]),
                    ]

                    return (
                      <tr
                        key={student.id}
                        onClick={openOnRowClick(() => navigate(profile))}
                        className={`border-b border-slate-50 hover:bg-indigo-100/70 transition-colors cursor-pointer ${
                          isRetired ? 'text-slate-400' : ''
                        }`}
                      >
                        <td data-card="head" className="px-4 py-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isRetired ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {getInitials(student.fullName)}
                            </div>
                            <div className="min-w-0">
                              <NavLink
                                to={profile}
                                className={`block font-semibold truncate transition-colors hover:text-indigo-600 ${
                                  isRetired ? 'text-slate-500' : 'text-slate-800'
                                }`}
                              >
                                {student.fullName}
                              </NavLink>
                              <p className="text-xs text-slate-400 truncate">
                                {student.code} · {student.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td
                          data-label="Nhóm/lớp"
                          className="px-4 py-2 text-slate-600 truncate"
                          title={student.groups.map(group => group.name).join(', ')}
                        >
                          {formatGroupNames(student.groups, 'Chưa phân nhóm')}
                        </td>
                        <td data-label="Kết quả" className="px-4 py-2 whitespace-nowrap">
                          {student.assignedExams > 0 ? (
                            <>
                              <span className={`font-bold ${scoreTone.color}`}>{formatScore(student.averageScore)}</span>{' '}
                              <span className="text-xs text-slate-400">· {student.completedExams} bài</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {student.hasStartedExams ? 'Đang làm bài' : 'Chưa làm bài'}
                            </span>
                          )}
                        </td>
                        <td data-label="Trạng thái" className="px-4 py-2">
                          <StudentStatusPill status={student.status} deletionScheduledAt={student.deletionScheduledAt} />
                          {/* Mốc xoá hẳn phải đọc được mà không cần rê chuột — điện thoại không có tooltip, và đây là
                              trang mà lối "N tài khoản đang chờ xoá" dẫn tới. */}
                          {student.status === 'pendingDeletion' && student.deletionScheduledAt && (
                            <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                              Khôi phục được tới {formatDateTime(student.deletionScheduledAt)}
                            </p>
                          )}
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

          <Pagination
            page={studentsQuery.data?.page ?? page}
            pageSize={studentsQuery.data?.pageSize ?? PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminLayout>
  )
}
