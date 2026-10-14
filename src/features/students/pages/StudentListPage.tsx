// Trang thuộc vai trò quản trị viên: admin sở hữu tài khoản học sinh.
import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  FilterX, Mail, Plus, RotateCcw, Search, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, UsersRound,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import useAsync from '../../../hooks/useAsync'
import useDebouncedValue from '../../../hooks/useDebouncedValue'
import { formatDate, formatDateTime, formatScore, getInitials, getScoreTone } from '../../../lib/format'
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME, listGroups } from '../../../services/groupService'
import { isRetiredStudent, listStudents } from '../../../services/studentService'
import StudentStatusPill from '../components/StudentStatusPill'
import { useStudentAccountActions } from '../hooks/useStudentAccountActions'
import { studentStatusLabels, type StudentStatus } from '../../../types'

const PAGE_SIZE = 10

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }

/** Thứ tự trong ô lọc đi theo vòng đời tài khoản: đang dùng, bị khoá, chờ xoá, đã xoá. */
const statusFilterOptions: StudentStatus[] = ['active', 'locked', 'pendingDeletion', 'deleted']

const iconActionClass =
  'w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center transition-colors'

export default function StudentListPage() {
  const accountActions = useStudentAccountActions()

  const [searchInput, setSearchInput] = useState('')
  // Giữ ID chứ không giữ tên: bộ lọc phải sống sót qua việc giáo viên đổi tên nhóm lớp.
  const [group, setGroup] = useState('all')
  // Ô lọc trạng thái sống trên URL (?trang-thai=...) chứ không trong state: trang tổng quan dẫn thẳng
  // tới đây bằng đường đó, và giữ trong state thì đổi bộ lọc xong URL vẫn nói điều cũ — tải lại hay
  // bấm Back là bộ lọc cũ quay về. Chỉ nhận đúng các giá trị có trong ô lọc: một giá trị lạ mà lọt
  // vào thì server trả 400 và cả trang thành trang lỗi.
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStatus = searchParams.get('trang-thai')
  const status: 'all' | StudentStatus = statusFilterOptions.find(option => option === requestedStatus) ?? 'all'
  const setStatus = (next: 'all' | StudentStatus) => {
    setSearchParams(
      current => {
        const nextParams = new URLSearchParams(current)
        if (next === 'all') nextParams.delete('trang-thai')
        else nextParams.set('trang-thai', next)
        return nextParams
      },
      { replace: true },
    )
  }
  const [page, setPage] = useState(1)

  // URL có thể đổi bộ lọc từ bên ngoài ô lọc — bấm "Học sinh" ở thanh bên xoá ?trang-thai. Khi đó
  // cũng phải về trang 1 như lúc tự đổi ô lọc, nếu không người dùng rơi vào giữa một danh sách khác.
  const [previousStatus, setPreviousStatus] = useState(status)
  if (previousStatus !== status) {
    setPreviousStatus(status)
    setPage(1)
  }

  const debouncedSearch = useDebouncedValue(searchInput)

  const summaryQuery = useAsync(async () => {
    const [activeOnly, lockedOnly, pendingOnly, groups] = await Promise.all([
      listStudents({ status: 'active', page: 1, pageSize: 1 }),
      listStudents({ status: 'locked', page: 1, pageSize: 1 }),
      listStudents({ status: 'pendingDeletion', page: 1, pageSize: 1 }),
      listGroups(),
    ])
    // Cùng cách đếm với trang tổng quan: "học sinh" là em còn theo học, không gồm tài khoản chờ xoá
    // hay đã xoá. Hai trang nói về cùng một điều thì phải ra cùng một con số.
    return {
      totalStudents: activeOnly.total + lockedOnly.total,
      activeStudents: activeOnly.total,
      lockedStudents: lockedOnly.total,
      pendingDeletionStudents: pendingOnly.total,
      groups,
    }
  }, [])

  const studentsQuery = useAsync(
    () => listStudents({
      search: debouncedSearch,
      groupId: group === 'all' ? undefined : Number(group),
      status,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, group, status, page],
  )

  const summary = summaryQuery.data
  const groupOptions = summary?.groups ?? []
  const students = studentsQuery.data?.items ?? []

  // Thao tác trên dòng cuối cùng của trang cuối — xoá một em khi đang lọc "Đang hoạt động" — làm
  // trang đó trống. Lùi về trang cuối còn dữ liệu thay vì để người dùng đứng trước "Không tìm thấy".
  const loadedPage = studentsQuery.data
  if (loadedPage && !studentsQuery.loading && loadedPage.items.length === 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(loadedPage.total / loadedPage.pageSize))
    if (lastPage < page) setPage(lastPage)
  }
  const hasActiveFilters = debouncedSearch.trim() !== '' || group !== 'all' || status !== 'all'

  const clearFilters = () => {
    setSearchInput('')
    setGroup('all')
    setStatus('all')
    setPage(1)
  }

  const reloadAll = () => {
    studentsQuery.reload()
    summaryQuery.reload()
  }

  /** Mọi thao tác tài khoản đều có thể đổi con số ở phụ đề, nên tải lại cả hai truy vấn. */
  const runAccountAction = async (pending: Promise<boolean>) => {
    if (await pending) reloadAll()
  }

  const summaryText = summary
    // "Đang theo học" nói rõ con số này không gồm tài khoản chờ xoá hay đã xoá — ô lọc "Tất cả trạng
    // thái" thì có, nên hai con số được phép khác nhau mà không ai tưởng một bên sai.
    ? [
        `${summary.totalStudents} học sinh đang theo học`,
        `${summary.activeStudents} đang hoạt động`,
        summary.lockedStudents > 0 ? `${summary.lockedStudents} đã khoá` : '',
        summary.pendingDeletionStudents > 0 ? `${summary.pendingDeletionStudents} chờ xoá` : '',
        `${summary.groups.length} nhóm lớp`,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <AdminLayout
      pageTitle="Học sinh"
      pageSubtitle={summaryText ?? 'Quản lý tài khoản, nhóm lớp và trạng thái học sinh'}
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                placeholder="Tìm theo tên, email hoặc mã học sinh"
                aria-label="Tìm kiếm học sinh"
              />
            </div>
            <select
              value={group}
              onChange={event => {
                setGroup(event.target.value)
                setPage(1)
              }}
              aria-label="Lọc theo nhóm lớp"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 bg-white"
            >
              <option value="all">Tất cả nhóm/lớp</option>
              {groupOptions.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              {/* Học sinh vừa bị gỡ khỏi nhóm vẫn phải lọc ra được. */}
              <option value={UNASSIGNED_GROUP_ID}>{UNASSIGNED_GROUP_NAME}</option>
            </select>
            <select
              value={status}
              onChange={event => {
                setStatus(event.target.value as 'all' | StudentStatus)
                setPage(1)
              }}
              aria-label="Lọc theo trạng thái"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 bg-white"
            >
              <option value="all">Tất cả trạng thái</option>
              {statusFilterOptions.map(option => (
                <option key={option} value={option}>{studentStatusLabels[option]}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <FilterX size={15} /> Xoá bộ lọc
              </button>
            )}
          </div>

          <NavLink
            to="/quan-tri/hoc-sinh/tao"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={primaryButtonStyle}
          >
            <Plus size={16} /> Thêm học sinh
          </NavLink>
        </div>
      </div>

      {studentsQuery.loading && !studentsQuery.data ? (
        <SkeletonTable rows={8} cols={6} />
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
                onClick={clearFilters}
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
            <TableScroller>
              <table className="stack-table w-full text-sm min-w-[920px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Học sinh</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nhóm/lớp</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Ngày tạo</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Kết quả</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const scoreTone = getScoreTone(student.averageScore)
                    const isActive = student.status === 'active'
                    // Tài khoản đã rời hệ thống thì khoá, mở khoá hay xoá lần nữa đều vô nghĩa —
                    // dòng đó chỉ còn nút xem, và nút khôi phục khi còn trong hạn.
                    const isRetired = isRetiredStudent(student)

                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                          isRetired ? 'text-slate-400' : ''
                        }`}
                      >
                        <td data-card="head" className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                                isRetired ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {getInitials(student.fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-semibold truncate ${isRetired ? 'text-slate-500' : 'text-slate-800'}`}>
                                {student.fullName}
                              </p>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Mail size={12} className="flex-shrink-0" />
                                <span className="truncate">{student.email}</span>
                                <span className="text-slate-300">·</span>
                                <span className="font-medium text-slate-500">{student.code}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td data-label="Nhóm/lớp" className="px-5 py-4 text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Users size={14} className="text-slate-400" /> {student.group}
                          </span>
                        </td>
                        <td data-label="Ngày tạo" className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {formatDate(student.createdAt)}
                        </td>
                        <td data-label="Kết quả" className="px-5 py-4">
                          {student.completedExams > 0 ? (
                            <>
                              <p className={`font-bold ${scoreTone.color}`}>
                                {formatScore(student.averageScore)}
                              </p>
                              <p className="text-xs text-slate-400">
                                {student.completedExams} bài đã xong
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-400">Chưa làm bài nào</p>
                          )}
                        </td>
                        <td data-label="Trạng thái" className="px-5 py-4">
                          <StudentStatusPill status={student.status} deletionScheduledAt={student.deletionScheduledAt} />
                          {/* Mốc xoá hẳn phải đọc được mà không cần rê chuột — điện thoại không có
                              tooltip, và đây là trang mà lối "N tài khoản đang chờ xoá" dẫn tới. */}
                          {student.status === 'pendingDeletion' && student.deletionScheduledAt && (
                            <p className="text-xs text-slate-400 mt-1 whitespace-nowrap">
                              Khôi phục được tới {formatDateTime(student.deletionScheduledAt)}
                            </p>
                          )}
                        </td>
                        <td data-card="foot" className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {student.status === 'pendingDeletion' && (
                              <button
                                type="button"
                                onClick={() => void runAccountAction(accountActions.restore(student))}
                                aria-label={`Khôi phục tài khoản của ${student.fullName}`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                              >
                                <RotateCcw size={14} /> Khôi phục
                              </button>
                            )}
                            {!isRetired && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void runAccountAction(accountActions.toggleLock(student))}
                                  title={isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
                                  aria-label={
                                    isActive
                                      ? `Khoá tài khoản của ${student.fullName}`
                                      : `Mở khoá tài khoản của ${student.fullName}`
                                  }
                                  className={`${iconActionClass} ${
                                    isActive
                                      ? 'text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                                      : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                                  }`}
                                >
                                  {isActive ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void runAccountAction(accountActions.requestDeletion(student))}
                                  title="Xoá tài khoản"
                                  aria-label={`Xoá tài khoản của ${student.fullName}`}
                                  className={`${iconActionClass} text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                            <NavLink
                              to={`/quan-tri/hoc-sinh/${student.id}/sua`}
                              className="px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                              {isRetired ? 'Xem' : 'Sửa'}
                            </NavLink>
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
            total={studentsQuery.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminLayout>
  )
}
