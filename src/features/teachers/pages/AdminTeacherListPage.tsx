/**
 * Danh sách giáo viên dưới quyền QUẢN TRỊ VIÊN: nhà trường cấp tài khoản, gán môn, khoá khi giáo viên nghỉ. Bấm một dòng để mở
 * hồ sơ (các lớp đang phụ trách, lịch sử khoá).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye, FilterX, GraduationCap, KeyRound, Pencil, Plus, Search, ShieldCheck, ShieldOff,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import IssuedPasswordModal from '../../../components/common/IssuedPasswordModal'
import Pagination from '../../../components/common/Pagination'
import RowActionMenu, { type RowMenuItem } from '../../../components/common/RowActionMenu'
import SearchField from '../../../components/common/SearchField'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import { useAsync } from '../../../hooks/useAsync'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { useUrlListState } from '../../../hooks/useUrlListState'
import { getInitials } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { listSubjects } from '../../../services/questionService'
import {
  listTeachers, teacherStatusLabels, type Teacher, type TeacherPasswordResult, type TeacherStatus,
} from '../../../services/teacherService'
import ImportExcelButton from '../../imports/components/ImportExcelButton'
import StudentStatusPill from '../../students/components/StudentStatusPill'
import TeacherFormModal from '../components/TeacherFormModal'
import { useTeacherAccountActions } from '../hooks/useTeacherAccountActions'

// Mười hai dòng ~52px cùng thanh trang vừa một cửa sổ cao ~900px sau khi công cụ đã lên thanh tiêu đề.
const PAGE_SIZE = 12

const primaryButtonStyle = { background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }
const headerCellClass = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500'
const selectClass =
  'px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'

const statusFilterOptions: TeacherStatus[] = ['active', 'locked']

export default function AdminTeacherListPage() {
  const navigate = useNavigate()
  const accountActions = useTeacherAccountActions()

  const { searchInput, setSearchInput, search, filters, setFilter, page, setPage, clearAll } = useUrlListState({
    'trang-thai': { default: 'all', allowed: ['all', ...statusFilterOptions] },
    mon: { default: 'all' },
  })
  const status = filters['trang-thai'] as 'all' | TeacherStatus
  const requestedSubject = Number(filters.mon)
  const subjectFilter = filters.mon !== 'all' && Number.isInteger(requestedSubject) && requestedSubject > 0
    ? requestedSubject
    : undefined
  const trimmedSearch = search.trim()
  const hasActiveFilters = trimmedSearch !== '' || status !== 'all' || subjectFilter !== undefined

  const [formTarget, setFormTarget] = useState<Teacher | 'new' | null>(null)
  const [issued, setIssued] = useState<{ teacher: Teacher; result: TeacherPasswordResult } | null>(null)

  const subjectsQuery = useAsync(() => listSubjects(), [])
  const subjects = subjectsQuery.data ?? []

  const summaryQuery = useAsync(async () => {
    const [all, locked] = await Promise.all([
      listTeachers({ page: 1, pageSize: 1 }),
      listTeachers({ status: 'locked', page: 1, pageSize: 1 }),
    ])
    return { total: all.total, locked: locked.total }
  }, [])

  const teachersQuery = useAsync(
    () => listTeachers({ search: trimmedSearch, status, subjectId: subjectFilter, page, pageSize: PAGE_SIZE }),
    [trimmedSearch, status, subjectFilter, page],
  )

  const teachers = teachersQuery.data?.items ?? []
  const total = teachersQuery.data?.total ?? 0

  // Thao tác trên dòng cuối của trang cuối có thể làm trang đó trống: lùi về trang cuối còn dữ liệu.
  const loadedPage = teachersQuery.data
  if (loadedPage && !teachersQuery.loading && loadedPage.items.length === 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(loadedPage.total / loadedPage.pageSize))
    if (lastPage < page) setPage(lastPage)
  }

  const { tableRef, wrapperStyle } = useStableTableHeight(teachers, PAGE_SIZE, total)

  const reloadAll = () => {
    teachersQuery.reload()
    summaryQuery.reload()
  }

  const runAction = async (pending: Promise<boolean>) => {
    if (await pending) reloadAll()
  }

  const handleResetPassword = async (teacher: Teacher) => {
    const result = await accountActions.resetPassword(teacher)
    if (result) setIssued({ teacher, result })
  }

  const summary = summaryQuery.data
  const summaryText = useMemo(() => {
    if (!summary) return null
    return [`${summary.total} giáo viên`, summary.locked > 0 ? `${summary.locked} đã khoá` : '']
      .filter(Boolean)
      .join(' · ')
  }, [summary])

  const tools = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
      <div className="flex-1 min-w-[10rem] max-w-[16rem]">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Tìm tên, email, số điện thoại"
          label="Tìm kiếm giáo viên"
        />
      </div>

      {subjects.length > 1 && (
        <select
          value={subjectFilter === undefined ? 'all' : String(subjectFilter)}
          onChange={event => setFilter('mon', event.target.value)}
          aria-label="Lọc theo môn"
          className={`${selectClass} max-w-[10rem]`}
        >
          <option value="all">Tất cả môn</option>
          {subjects.map(subject => (
            <option key={subject.id} value={subject.id}>{subject.name}</option>
          ))}
        </select>
      )}

      <select
        value={status}
        onChange={event => setFilter('trang-thai', event.target.value)}
        aria-label="Lọc theo trạng thái"
        className={selectClass}
      >
        <option value="all">Mọi trạng thái</option>
        {statusFilterOptions.map(option => (
          <option key={option} value={option}>{teacherStatusLabels[option]}</option>
        ))}
      </select>

      <ImportExcelButton kind="school" onImported={reloadAll} />

      <button
        type="button"
        onClick={() => setFormTarget('new')}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
        style={primaryButtonStyle}
      >
        <Plus size={16} /> Thêm giáo viên
      </button>
    </div>
  )

  return (
    <AdminLayout
      pageTitle="Giáo viên"
      pageSubtitle={
        summaryText
          ? `${summaryText}${hasActiveFilters && teachersQuery.data ? ` · ${total} khớp bộ lọc` : ''}`
          : 'Quản lý tài khoản giáo viên, môn giảng dạy và lớp phụ trách'
      }
      compactContent
      headerTools={tools}
    >
      {teachersQuery.loading && !teachersQuery.data ? (
        <SkeletonTable rows={8} cols={5} />
      ) : teachersQuery.error ? (
        <ErrorState message={teachersQuery.error} onRetry={reloadAll} />
      ) : teachers.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Search}
            title="Không tìm thấy giáo viên phù hợp"
            description="Không có giáo viên nào khớp với từ khoá và bộ lọc hiện tại. Hãy thử từ khoá khác hoặc xoá bớt bộ lọc."
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
            icon={GraduationCap}
            title="Chưa có giáo viên nào"
            description="Thêm giáo viên đầu tiên để có người phụ trách lớp, soạn câu hỏi và giao bài kiểm tra."
            action={
              <button
                type="button"
                onClick={() => setFormTarget('new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                style={primaryButtonStyle}
              >
                <Plus size={16} /> Thêm giáo viên
              </button>
            }
          />
        )
      ) : (
        <>
          <div
            className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity animate-fade-in-up ${
              teachersQuery.loading ? 'opacity-60' : ''
            }`}
          >
            <TableScroller style={wrapperStyle}>
              <table ref={tableRef} className="stack-table w-full table-fixed text-sm min-w-[820px]">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[20%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className={`${headerCellClass} text-left`}>Giáo viên</th>
                    <th className={`${headerCellClass} text-left`}>Môn</th>
                    <th className={`${headerCellClass} text-left`}>Lớp phụ trách</th>
                    <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                    <th className={`${headerCellClass} text-right`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => {
                    const profile = `/quan-tri/giao-vien/${teacher.id}`
                    const isActive = teacher.status === 'active'

                    const items: RowMenuItem[] = [
                      { key: 'view', label: 'Xem hồ sơ', icon: Eye, to: profile },
                      { key: 'edit', label: 'Sửa thông tin', icon: Pencil, onSelect: () => setFormTarget(teacher) },
                      {
                        key: 'lock',
                        label: isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
                        icon: isActive ? ShieldOff : ShieldCheck,
                        onSelect: () => void runAction(accountActions.toggleLock(teacher)),
                      },
                      {
                        key: 'reset',
                        label: 'Cấp lại mật khẩu',
                        icon: KeyRound,
                        onSelect: () => void handleResetPassword(teacher),
                      },
                    ]

                    return (
                      <tr
                        key={teacher.id}
                        onClick={openOnRowClick(() => navigate(profile))}
                        className="border-b border-slate-50 hover:bg-indigo-100/70 transition-colors cursor-pointer"
                      >
                        <td data-card="head" className="px-4 py-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: `linear-gradient(135deg, ${teacher.avatarColor}, #FFA01F)` }}
                            >
                              {getInitials(teacher.fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{teacher.fullName}</p>
                              <p className="text-xs text-slate-400 truncate">{teacher.email}</p>
                            </div>
                          </div>
                        </td>
                        <td data-label="Môn" className="px-4 py-2 text-slate-600 truncate">
                          {teacher.subject || <span className="text-amber-600 text-xs font-semibold">Chưa gán môn</span>}
                        </td>
                        <td data-label="Lớp phụ trách" className="px-4 py-2 whitespace-nowrap">
                          {teacher.groupCount > 0 ? (
                            <span className="font-semibold text-slate-700">{teacher.groupCount} lớp</span>
                          ) : (
                            <span className="text-xs text-slate-400">Chưa có lớp</span>
                          )}
                        </td>
                        <td data-label="Trạng thái" className="px-4 py-2">
                          <StudentStatusPill status={teacher.status} />
                          {teacher.status === 'locked' && teacher.groupCount > 0 && (
                            <p className="text-[11px] text-amber-600 mt-0.5 whitespace-nowrap">Còn {teacher.groupCount} lớp cần đổi người</p>
                          )}
                        </td>
                        <td data-card="foot" className="px-4 py-2">
                          <div className="flex items-center justify-end">
                            <RowActionMenu label={teacher.fullName} items={items} />
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
            page={teachersQuery.data?.page ?? page}
            pageSize={teachersQuery.data?.pageSize ?? PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      <TeacherFormModal
        open={formTarget !== null}
        teacher={formTarget === 'new' || formTarget === null ? undefined : formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={() => {
          setFormTarget(null)
          reloadAll()
        }}
      />

      <IssuedPasswordModal
        password={issued?.result.password ?? null}
        description={issued ? `Cho tài khoản ${issued.teacher.fullName} (${issued.teacher.email})` : undefined}
        mustChangePassword={issued?.result.mustChangePassword}
        holder="Giáo viên"
        onClose={() => setIssued(null)}
      />
    </AdminLayout>
  )
}
