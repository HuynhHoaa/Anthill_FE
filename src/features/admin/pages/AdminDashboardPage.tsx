/**
 * Tổng quan dành cho QUẢN TRỊ VIÊN — người sở hữu tài khoản học sinh.
 * Mọi con số ở đây đều lấy từ service thật, không có số liệu trang trí.
 */
import { NavLink } from 'react-router-dom'
import {
  ChevronRight, Lock, ShieldCheck, UserPlus, Users, UsersRound, type LucideIcon,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate, getInitials } from '../../../lib/format'
import { listGroups } from '../../../services/groupService'
import { listStudents } from '../../../services/studentService'
import StudentStatusPill from '../../students/components/StudentStatusPill'
import { getAvatarTone } from '../../student-groups/components/groupTheme'
import type { Student } from '../../../types'

/** Bảng dưới cùng chỉ điểm mặt vài tài khoản mới nhất, không thay cho trang danh sách. */
const RECENT_STUDENT_COUNT = 5

const studentListLink = '/quan-tri/hoc-sinh'
const studentCreateLink = '/quan-tri/hoc-sinh/tao'
const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }
const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'

interface AdminOverview {
  totalStudents: number
  activeStudents: number
  lockedStudents: number
  groupCount: number
  recentStudents: Student[]
}

/** Gộp mọi lời gọi thành một trạng thái tải để trang chỉ có duy nhất một khung xương. */
function loadAdminOverview(): Promise<AdminOverview> {
  return Promise.all([
    listStudents({ page: 1, pageSize: 1 }),
    listStudents({ status: 'active', page: 1, pageSize: 1 }),
    listStudents({ status: 'locked', page: 1, pageSize: 1 }),
    listGroups(),
    listStudents({ page: 1, pageSize: RECENT_STUDENT_COUNT }),
  ]).then(([everyone, activeOnly, lockedOnly, groups, recent]) => ({
    totalStudents: everyone.total,
    activeStudents: activeOnly.total,
    lockedStudents: lockedOnly.total,
    groupCount: groups.length,
    recentStudents: recent.items,
  }))
}

interface StatTileConfig {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  label: string
  selectValue: (overview: AdminOverview) => number
}

const statTiles: StatTileConfig[] = [
  {
    icon: Users,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    label: 'Tổng số học sinh',
    selectValue: overview => overview.totalStudents,
  },
  {
    icon: ShieldCheck,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    label: 'Đang hoạt động',
    selectValue: overview => overview.activeStudents,
  },
  {
    icon: Lock,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    label: 'Đã khóa',
    selectValue: overview => overview.lockedStudents,
  },
  {
    icon: UsersRound,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    label: 'Nhóm lớp',
    selectValue: overview => overview.groupCount,
  },
]

const quickActions: { label: string; description: string; to: string; icon: LucideIcon; gradient: string }[] = [
  {
    label: 'Thêm học sinh',
    description: 'Tạo tài khoản mới cho lớp',
    to: studentCreateLink,
    icon: UserPlus,
    gradient: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
  },
  {
    label: 'Xem tất cả học sinh',
    description: 'Tìm kiếm, sửa và khóa tài khoản',
    to: studentListLink,
    icon: Users,
    gradient: 'linear-gradient(135deg,#3B82F6,#2563EB)',
  },
]

export default function AdminDashboardPage() {
  const { data: overview, loading, error, reload } = useAsync(loadAdminOverview, [])

  const isFirstLoad = loading && overview === undefined
  const recentStudents = overview?.recentStudents ?? []

  const summaryText = overview
    ? `${overview.totalStudents} học sinh · ${overview.activeStudents} đang hoạt động · ${overview.lockedStudents} đã khóa · ${overview.groupCount} nhóm lớp`
    : undefined

  if (error) {
    return (
      <AdminLayout pageTitle="Tổng quan" pageSubtitle="Tình hình tài khoản học sinh trong hệ thống">
        <ErrorState message={error} onRetry={reload} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      pageTitle="Tổng quan"
      pageSubtitle={summaryText ?? 'Tình hình tài khoản học sinh trong hệ thống'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statTiles.map(({ icon: Icon, iconBg, iconColor, label, selectValue }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-fade-in-up">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${iconBg}`}>
              <Icon size={17} className={iconColor} />
            </div>
            <div className="min-h-[28px] flex items-center">
              {overview ? (
                <p className="text-2xl font-bold text-slate-800 leading-none">{selectValue(overview)}</p>
              ) : (
                <SkeletonBlock className="h-6 w-16" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Học sinh mới nhất</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {RECENT_STUDENT_COUNT} tài khoản được tạo gần đây nhất trong hệ thống.
          </p>
        </div>
        <NavLink
          to={studentListLink}
          className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
        >
          Xem tất cả học sinh <ChevronRight size={16} />
        </NavLink>
      </div>

      {isFirstLoad ? (
        <SkeletonTable rows={RECENT_STUDENT_COUNT} cols={5} />
      ) : recentStudents.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Chưa có tài khoản học sinh nào"
          description="Hãy tạo tài khoản đầu tiên để giáo viên có thể xếp lớp và giao bài kiểm tra."
          action={
            <NavLink
              to={studentCreateLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={primaryButtonStyle}
            >
              <UserPlus size={16} /> Thêm học sinh
            </NavLink>
          }
        />
      ) : (
        <div
          className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity animate-fade-in-up ${
            loading ? 'opacity-60' : 'opacity-100'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className={`${headerCellClass} text-left`}>Học sinh</th>
                  <th className={`${headerCellClass} text-left`}>Mã học sinh</th>
                  <th className={`${headerCellClass} text-left`}>Nhóm lớp</th>
                  <th className={`${headerCellClass} text-left`}>Ngày tạo</th>
                  <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentStudents.map(student => {
                  const avatarTone = getAvatarTone(student.id)

                  return (
                    <tr
                      key={student.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarTone.bg} ${avatarTone.text}`}
                          >
                            {getInitials(student.fullName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{student.fullName}</p>
                            <p className="text-xs text-slate-400 truncate">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600">{student.code}</td>
                      <td className="px-5 py-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <UsersRound size={14} className="text-slate-400" /> {student.group}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        {formatDate(student.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <StudentStatusPill status={student.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quickActions.map(({ label, description, to, icon: Icon, gradient }, index) => (
          <NavLink
            key={to}
            to={to}
            className="p-4 rounded-2xl text-white flex items-center gap-3 hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md animate-fade-in-up"
            style={{ background: gradient, animationDelay: `${(index + 5) * 0.05}s` }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Icon size={18} />
            </div>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs opacity-75 mt-0.5">{description}</span>
            </span>
          </NavLink>
        ))}
      </div>
    </AdminLayout>
  )
}
