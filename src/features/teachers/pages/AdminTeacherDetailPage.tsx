/**
 * Hồ sơ một giáo viên dưới quyền QUẢN TRỊ VIÊN: thông tin tài khoản, các lớp đang phụ trách và lịch sử khoá.
 *
 * Giáo viên nghỉ việc thì khoá tài khoản (kèm lý do) rồi đổi giáo viên phụ trách của từng lớp họ đang dạy — nút đổi nằm ngay
 * trên từng dòng lớp ở đây để việc đó làm liền một mạch, không phải đi tìm từng lớp.
 */
import { useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, Mail, Pencil, Phone, ShieldCheck, ShieldOff, UserRoundCog, UsersRound } from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { PublishStateBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import HistoryTimeline, { type HistoryEntry } from '../../../components/common/HistoryTimeline'
import IssuedPasswordModal from '../../../components/common/IssuedPasswordModal'
import SlidingSegments from '../../../components/common/SlidingSegments'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate, getInitials } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { getTeacher, listTeacherChanges, type Teacher, type TeacherPasswordResult } from '../../../services/teacherService'
import type { AccountChange, StudentGroup } from '../../../types'
import ChangeTeacherModal from '../../student-groups/components/ChangeTeacherModal'
import StudentStatusPill from '../../students/components/StudentStatusPill'
import TeacherFormModal from '../components/TeacherFormModal'
import { useTeacherAccountActions } from '../hooks/useTeacherAccountActions'

type DetailTab = 'lop' | 'lich-su'

const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const headerCellClass = 'px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'
const actionButtonClass =
  'w-full inline-flex items-center justify-start gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors'

function parseTab(raw: string | null): DetailTab {
  return raw === 'lich-su' ? 'lich-su' : 'lop'
}

const changeTitle: Record<string, string> = {
  locked: 'Khoá tài khoản',
  unlocked: 'Mở khoá tài khoản',
}

function toEntry(change: AccountChange): HistoryEntry {
  return {
    id: change.id,
    title: changeTitle[change.kind] ?? change.kind,
    createdAt: change.createdAt,
    actorName: change.actorName,
    reason: change.reason,
  }
}

export default function AdminTeacherDetailPage() {
  const navigate = useNavigate()
  const accountActions = useTeacherAccountActions()
  const { id } = useParams<{ id: string }>()
  const teacherId = Number(id)
  const isValidId = Number.isInteger(teacherId) && teacherId > 0

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const setTab = (next: DetailTab) => {
    setSearchParams(
      current => {
        const nextParams = new URLSearchParams(current)
        if (next === 'lop') nextParams.delete('tab')
        else nextParams.set('tab', next)
        return nextParams
      },
      { replace: true },
    )
  }

  const { data: teacher, loading, error, reload } = useAsync(
    () => (isValidId ? getTeacher(teacherId) : Promise.reject<Teacher>(new Error('Đường dẫn giáo viên không hợp lệ.'))),
    [teacherId],
  )
  const { data: changes, reload: reloadChanges } = useAsync(
    () => (isValidId ? listTeacherChanges(teacherId) : Promise.resolve([] as AccountChange[])),
    [teacherId],
  )

  const [editOpen, setEditOpen] = useState(false)
  const [issued, setIssued] = useState<TeacherPasswordResult | null>(null)
  const [changeGroup, setChangeGroup] = useState<Pick<StudentGroup, 'id' | 'name' | 'teachers'> | null>(null)

  const reloadAll = () => {
    reload()
    reloadChanges()
  }

  const groups = teacher?.groups ?? []
  const entries = useMemo(() => (changes ?? []).map(toEntry), [changes])
  const isActive = teacher?.status === 'active'

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'lop', label: `Lớp phụ trách${teacher ? ` (${groups.length})` : ''}` },
    { id: 'lich-su', label: `Lịch sử${changes ? ` (${changes.length})` : ''}` },
  ]

  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to="/quan-tri/giao-vien"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} /> Quay lại danh sách giáo viên
      </NavLink>
    </div>
  )

  const handleToggleLock = async () => {
    if (!teacher) return
    if (await accountActions.toggleLock(teacher)) reloadAll()
  }

  const handleResetPassword = async () => {
    if (!teacher) return
    const result = await accountActions.resetPassword(teacher)
    if (result) setIssued(result)
  }

  return (
    <AdminLayout
      pageTitle={teacher?.fullName ?? 'Hồ sơ giáo viên'}
      pageSubtitle={teacher ? `${teacher.subject || 'Chưa gán môn'} · ${teacher.email}` : 'Lớp phụ trách và lịch sử tài khoản'}
      compactContent
      headerTools={backLink}
    >
      {loading && teacher === undefined && <SkeletonBlock className="h-64 w-full rounded-2xl" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {teacher && (
        <div className="stagger-in grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          <div className="min-w-0">
            <SlidingSegments activeKey={tab} className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 w-fit mb-4">
              {tabs.map(item => {
                const active = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    data-tab-active={active}
                    className={`relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </SlidingSegments>

            {tab === 'lop' && (
              groups.length === 0 ? (
                <EmptyState
                  icon={UsersRound}
                  title="Chưa phụ trách lớp nào"
                  description="Chọn giáo viên này khi lập lớp mới, hoặc đổi giáo viên phụ trách ở phần Thiết lập của một lớp."
                />
              ) : (
                <div className={`${cardClass} overflow-hidden animate-fade-in-up`}>
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-28" />
                      <col className="w-32" />
                      <col className="w-44" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className={headerCellClass}>Lớp</th>
                        <th className={headerCellClass}>Sĩ số</th>
                        <th className={headerCellClass}>Trạng thái</th>
                        <th className={`${headerCellClass} text-right`}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(group => (
                        <tr
                          key={group.id}
                          onClick={openOnRowClick(() => navigate(`/quan-tri/nhom-lop/${group.id}`))}
                          className="border-b border-slate-50 last:border-b-0 hover:bg-indigo-100/70 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-3 font-semibold text-slate-800 truncate">{group.name}</td>
                          <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{group.studentCount} học sinh</td>
                          <td className="px-5 py-3"><PublishStateBadge isPublished={group.isPublished} /></td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setChangeGroup({
                                    id: group.id,
                                    name: group.name,
                                    teachers: [{
                                      id: teacher.id,
                                      fullName: teacher.fullName,
                                      email: teacher.email,
                                      subject: teacher.subject,
                                      avatarColor: teacher.avatarColor,
                                      status: teacher.status,
                                    }],
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                              >
                                <UserRoundCog size={14} /> Đổi giáo viên
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === 'lich-su' && (
              <HistoryTimeline
                entries={entries}
                emptyTitle="Chưa có thay đổi nào"
                emptyDescription="Mỗi lần khoá hay mở khoá tài khoản giáo viên đều được ghi lại ở đây, kèm lý do và người thực hiện."
              />
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${teacher.avatarColor}, #8B5CF6)` }}
                >
                  {getInitials(teacher.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{teacher.fullName}</p>
                  <div className="mt-1"><StudentStatusPill status={teacher.status} /></div>
                </div>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-slate-500"><Mail size={14} /> Email</dt>
                  <dd className="min-w-0 break-all text-right font-medium text-slate-700">{teacher.email}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-slate-500"><Phone size={14} /> Điện thoại</dt>
                  <dd className="font-medium text-slate-700">{teacher.phone || '—'}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500">Môn</dt>
                  <dd className="font-medium text-slate-700">{teacher.subject || '—'}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500">Ngày tạo</dt>
                  <dd className="font-medium text-slate-700">{formatDate(teacher.createdAt)}</dd>
                </div>
              </dl>

              {teacher.mustChangePassword && (
                <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                  Giáo viên chưa đổi mật khẩu do nhà trường cấp; họ sẽ phải đổi ở lần đăng nhập đầu.
                </p>
              )}
              {teacher.status === 'locked' && groups.length > 0 && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 leading-relaxed">
                  Tài khoản đang bị khoá nhưng còn phụ trách {groups.length} lớp. Đổi giáo viên cho từng lớp để lớp có người
                  giao bài.
                </p>
              )}
            </div>

            <div className={`${cardClass} p-4 space-y-1.5`}>
              <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Thao tác</p>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className={`${actionButtonClass} text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600`}
              >
                <Pencil size={15} /> Sửa thông tin
              </button>
              <button
                type="button"
                onClick={() => void handleToggleLock()}
                className={`${actionButtonClass} ${
                  isActive ? 'text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                }`}
              >
                {isActive ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                {isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
              </button>
              <button
                type="button"
                onClick={() => void handleResetPassword()}
                className={`${actionButtonClass} text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600`}
              >
                <KeyRound size={15} /> Cấp lại mật khẩu
              </button>
            </div>
          </aside>
        </div>
      )}

      {teacher === undefined && !loading && !error && <SkeletonTable rows={4} cols={4} />}

      <TeacherFormModal
        open={editOpen}
        teacher={teacher}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          reloadAll()
        }}
      />

      {changeGroup && (
        <ChangeTeacherModal
          group={changeGroup}
          onClose={() => setChangeGroup(null)}
          onChanged={() => {
            setChangeGroup(null)
            reloadAll()
          }}
        />
      )}

      <IssuedPasswordModal
        password={issued?.password ?? null}
        description={teacher ? `Cho tài khoản ${teacher.fullName} (${teacher.email})` : undefined}
        mustChangePassword={issued?.mustChangePassword}
        holder="Giáo viên"
        onClose={() => setIssued(null)}
      />
    </AdminLayout>
  )
}
