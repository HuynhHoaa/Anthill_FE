// Trang thuộc vai trò quản trị viên: admin sở hữu tài khoản học sinh.
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  FilterX, Mail, Plus, Search, ShieldCheck, ShieldOff, UserPlus, Users, UsersRound,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import useAsync from '../../../hooks/useAsync'
import useDebouncedValue from '../../../hooks/useDebouncedValue'
import { formatDate, formatScore, getInitials, getScoreTone } from '../../../lib/format'
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME, listGroups } from '../../../services/groupService'
import { listStudents, setStudentStatus } from '../../../services/studentService'
import StudentStatusPill from '../components/StudentStatusPill'
import { studentStatusLabels, type Student, type StudentStatus } from '../../../types'

const PAGE_SIZE = 10

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }

export default function StudentListPage() {
  const toast = useToast()

  const [searchInput, setSearchInput] = useState('')
  // Giữ ID chứ không giữ tên: bộ lọc phải sống sót qua việc giáo viên đổi tên nhóm lớp.
  const [group, setGroup] = useState('all')
  const [status, setStatus] = useState<'all' | StudentStatus>('all')
  const [page, setPage] = useState(1)

  const [pendingStudent, setPendingStudent] = useState<Student | null>(null)
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  const debouncedSearch = useDebouncedValue(searchInput)

  const summaryQuery = useAsync(async () => {
    const [everyone, activeOnly, groups] = await Promise.all([
      listStudents({ page: 1, pageSize: 1 }),
      listStudents({ status: 'active', page: 1, pageSize: 1 }),
      listGroups(),
    ])
    return { totalStudents: everyone.total, activeStudents: activeOnly.total, groups }
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

  const confirmToggleStatus = async () => {
    if (!pendingStudent) return
    const nextStatus: StudentStatus = pendingStudent.status === 'active' ? 'locked' : 'active'

    setStatusSubmitting(true)
    try {
      await setStudentStatus(pendingStudent.id, nextStatus)
      toast.success(
        nextStatus === 'locked'
          ? `Đã khóa tài khoản của ${pendingStudent.fullName}.`
          : `Đã mở khóa tài khoản của ${pendingStudent.fullName}.`,
      )
      setPendingStudent(null)
      reloadAll()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không thể cập nhật trạng thái học sinh.')
    } finally {
      setStatusSubmitting(false)
    }
  }

  const summaryText = summary
    ? `${summary.totalStudents} học sinh · ${summary.activeStudents} đang hoạt động · ${summary.groups.length} nhóm lớp`
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
              <option value="active">{studentStatusLabels.active}</option>
              <option value="locked">{studentStatusLabels.locked}</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <FilterX size={15} /> Xóa bộ lọc
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
            description="Không có học sinh nào khớp với từ khóa và bộ lọc hiện tại. Hãy thử từ khóa khác hoặc xóa bớt bộ lọc."
            action={
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <FilterX size={15} /> Xóa bộ lọc
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[880px]">
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

                    return (
                      <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                              {getInitials(student.fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{student.fullName}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Mail size={12} className="flex-shrink-0" />
                                <span className="truncate">{student.email}</span>
                                <span className="text-slate-300">·</span>
                                <span className="font-medium text-slate-500">{student.code}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Users size={14} className="text-slate-400" /> {student.group}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {formatDate(student.createdAt)}
                        </td>
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4">
                          <StudentStatusPill status={student.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setPendingStudent(student)}
                              title={isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              aria-label={
                                isActive
                                  ? `Khóa tài khoản của ${student.fullName}`
                                  : `Mở khóa tài khoản của ${student.fullName}`
                              }
                              className={`w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center transition-colors ${
                                isActive
                                  ? 'text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                                  : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                              }`}
                            >
                              {isActive ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                            </button>
                            <NavLink
                              to={`/quan-tri/hoc-sinh/${student.id}/sua`}
                              className="px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                              Sửa
                            </NavLink>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={studentsQuery.data?.page ?? page}
            pageSize={studentsQuery.data?.pageSize ?? PAGE_SIZE}
            total={studentsQuery.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={pendingStudent !== null}
        title={pendingStudent?.status === 'active' ? 'Khóa tài khoản học sinh' : 'Mở khóa tài khoản học sinh'}
        message={
          pendingStudent?.status === 'active'
            ? `${pendingStudent.fullName} sẽ không thể đăng nhập và làm bài cho tới khi được mở khóa. Bạn có chắc chắn không?`
            : `${pendingStudent?.fullName ?? 'Học sinh'} sẽ đăng nhập và làm bài trở lại bình thường.`
        }
        confirmLabel={pendingStudent?.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
        tone={pendingStudent?.status === 'active' ? 'danger' : 'primary'}
        loading={statusSubmitting}
        onConfirm={confirmToggleStatus}
        onCancel={() => {
          if (!statusSubmitting) setPendingStudent(null)
        }}
      />
    </AdminLayout>
  )
}
