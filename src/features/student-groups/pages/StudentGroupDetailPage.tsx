import { useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  ArrowLeft, CalendarDays, Edit3, Eye,
  UserMinus, UserPlus, Users, UsersRound,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate, formatScore, getInitials, getScoreTone, roundToOneDecimal } from '../../../lib/format'
import { getGroup, listGroupStudents, removeStudentFromGroup } from '../../../services/groupService'
import { studentStatusLabels, type Student, type StudentGroup, type StudentStatus } from '../../../types'
import AddStudentsModal from '../components/AddStudentsModal'
import GroupFormModal from '../components/GroupFormModal'
import { getAvatarTone, getGroupAccent } from '../components/groupTheme'

const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'

const statusToneClass: Record<StudentStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  locked: 'bg-slate-100 text-slate-500',
}

export default function StudentGroupDetailPage() {
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const groupId = Number(id)
  const isValidGroupId = Number.isInteger(groupId) && groupId > 0

  const {
    data: group, loading: groupLoading, error: groupError, reload: reloadGroup,
  } = useAsync(
    () =>
      isValidGroupId
        ? getGroup(groupId)
        : Promise.reject<StudentGroup>(new Error('Đường dẫn nhóm lớp không hợp lệ.')),
    [groupId],
  )

  const {
    data: students, loading: studentsLoading, error: studentsError, reload: reloadStudents,
  } = useAsync(
    () =>
      isValidGroupId
        ? listGroupStudents(groupId)
        : Promise.reject<Student[]>(new Error('Đường dẫn nhóm lớp không hợp lệ.')),
    [groupId],
  )

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null)
  const [removing, setRemoving] = useState(false)

  const summaryText = useMemo(() => {
    if (!group) return null
    const parts = [group.name, `${group.studentCount} học sinh`]
    const scoredMembers = (students ?? []).filter(member => member.completedExams > 0)
    if (scoredMembers.length > 0) {
      const averageScore = roundToOneDecimal(
        scoredMembers.reduce((sum, member) => sum + member.averageScore, 0) / scoredMembers.length,
      )
      parts.push(`điểm trung bình ${formatScore(averageScore)}`)
    }
    return parts.join(' · ')
  }, [group, students])

  const reloadAll = () => {
    reloadGroup()
    reloadStudents()
  }

  const handleRemoveConfirm = async () => {
    if (!removeTarget || removing) return

    setRemoving(true)
    try {
      await removeStudentFromGroup(groupId, removeTarget.id)
      toast.success(`Đã gỡ ${removeTarget.fullName} khỏi nhóm.`)
      setRemoveTarget(null)
      reloadAll()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không gỡ được học sinh khỏi nhóm.')
    } finally {
      setRemoving(false)
    }
  }

  const accent = getGroupAccent(groupId)
  const showHeaderSkeleton = groupLoading && group === undefined

  return (
    <TeacherLayout
      pageTitle="Chi tiết nhóm lớp"
      pageSubtitle={summaryText ?? 'Xem thành viên và điều chỉnh thông tin nhóm'}
    >
      <NavLink
        to="/giao-vien/nhom-lop"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4"
      >
        <ArrowLeft size={15} /> Quay lại danh sách nhóm
      </NavLink>

      {showHeaderSkeleton && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <SkeletonBlock className="h-14 w-14 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <SkeletonBlock className="h-5 w-48" />
              <SkeletonBlock className="h-3.5 w-3/4" />
              <SkeletonBlock className="h-3 w-40" />
            </div>
          </div>
        </div>
      )}

      {!showHeaderSkeleton && groupError && (
        <div>
          <ErrorState message={groupError} onRetry={reloadGroup} />
          <div className="mt-4 flex justify-center">
            <NavLink
              to="/giao-vien/nhom-lop"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <ArrowLeft size={15} /> Quay lại danh sách nhóm
            </NavLink>
          </div>
        </div>
      )}

      {group && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${accent.iconBg} ${accent.iconColor}`}
                >
                  <Users size={26} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-slate-800">{group.name}</h1>
                  <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                    {group.description || 'Chưa có mô tả cho nhóm này.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      <UsersRound size={13} /> {group.studentCount} học sinh
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                      <CalendarDays size={13} /> Tạo ngày {formatDate(group.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <Edit3 size={15} /> Sửa thông tin
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  <UserPlus size={16} /> Thêm học sinh
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 mb-4">
            <h2 className="text-base font-bold text-slate-800">
              Học sinh trong nhóm
              {students && <span className="text-slate-400 font-semibold"> ({students.length})</span>}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Gỡ học sinh khỏi nhóm không xóa tài khoản, học sinh chỉ chuyển về trạng thái chưa phân nhóm.
            </p>
          </div>

          {studentsLoading && students === undefined && <SkeletonTable rows={5} cols={7} />}

          {!studentsLoading && studentsError && (
            <ErrorState message={studentsError} onRetry={reloadStudents} />
          )}

          {!studentsError && students && students.length === 0 && (
            <EmptyState
              icon={UsersRound}
              title="Nhóm chưa có học sinh nào"
              description="Thêm học sinh vào nhóm để có thể giao bài kiểm tra cho cả nhóm chỉ với một thao tác."
              action={
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  <UserPlus size={16} /> Thêm học sinh vào nhóm
                </button>
              }
            />
          )}

          {!studentsError && students && students.length > 0 && (
            <div
              className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity ${
                studentsLoading ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px]">
                  <thead className="bg-slate-50/60">
                    <tr>
                      <th className={`${headerCellClass} text-left`}>Học sinh</th>
                      <th className={`${headerCellClass} text-left`}>Mã học sinh</th>
                      <th className={`${headerCellClass} text-left`}>Email</th>
                      <th className={`${headerCellClass} text-left`}>Điểm trung bình</th>
                      <th className={`${headerCellClass} text-left`}>Bài đã làm</th>
                      <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                      <th className={`${headerCellClass} text-right`}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => {
                      const avatarTone = getAvatarTone(student.id)
                      const scoreTone = getScoreTone(student.averageScore)
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
                                <NavLink
                                  to={`/giao-vien/hoc-sinh/${student.id}`}
                                  title="Xem hồ sơ và lịch sử làm bài"
                                  aria-label={`Xem hồ sơ và lịch sử làm bài của ${student.fullName}`}
                                  className="block text-sm font-semibold text-slate-800 truncate hover:text-indigo-600 transition-colors"
                                >
                                  {student.fullName}
                                </NavLink>
                                <p className="text-xs text-slate-400 truncate">@{student.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm font-medium text-slate-600">{student.code}</td>
                          <td className="px-5 py-4 text-sm text-slate-500">{student.email}</td>
                          <td className="px-5 py-4">
                            {student.completedExams > 0 ? (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${scoreTone.bg} ${scoreTone.color}`}
                              >
                                {formatScore(student.averageScore)}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">Chưa có</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">{student.completedExams} bài</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusToneClass[student.status]}`}
                            >
                              {studentStatusLabels[student.status]}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <NavLink
                                to={`/giao-vien/hoc-sinh/${student.id}`}
                                title="Xem hồ sơ và lịch sử làm bài"
                                aria-label={`Xem hồ sơ và lịch sử làm bài của ${student.fullName}`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                              >
                                <Eye size={14} /> Xem
                              </NavLink>
                              <button
                                type="button"
                                onClick={() => setRemoveTarget(student)}
                                title="Gỡ khỏi nhóm"
                                aria-label={`Gỡ ${student.fullName} khỏi nhóm`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <UserMinus size={14} /> Gỡ khỏi nhóm
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <GroupFormModal
            open={editOpen}
            group={group}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              setEditOpen(false)
              reloadAll()
            }}
          />

          {addOpen && (
            <AddStudentsModal
              groupId={group.id}
              groupName={group.name}
              onClose={() => setAddOpen(false)}
              onAdded={() => {
                setAddOpen(false)
                reloadAll()
              }}
            />
          )}

          <ConfirmDialog
            open={removeTarget !== null}
            title="Gỡ học sinh khỏi nhóm"
            message={
              removeTarget
                ? `Gỡ ${removeTarget.fullName} khỏi nhóm ${group.name}? Học sinh sẽ chuyển về trạng thái chưa phân nhóm, tài khoản và kết quả bài làm vẫn được giữ nguyên.`
                : ''
            }
            confirmLabel="Gỡ khỏi nhóm"
            tone="danger"
            loading={removing}
            onConfirm={handleRemoveConfirm}
            onCancel={() => {
              if (!removing) setRemoveTarget(null)
            }}
          />
        </>
      )}
    </TeacherLayout>
  )
}
