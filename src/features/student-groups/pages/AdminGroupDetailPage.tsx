/**
 * Chi tiết một lớp dưới quyền QUẢN TRỊ VIÊN.
 *
 * Ba việc của trang này xếp đúng thứ tự phải làm: sửa thông tin lớp, phân công giáo viên, xếp học
 * sinh — rồi công bố. Chừng nào chưa công bố thì ngoài quản trị viên không ai nhìn thấy lớp.
 */
import { useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Edit3, GraduationCap,
  Send, UserPlus, Users, UsersRound,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { PublishStateBadge } from '../../../components/common/Badge'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate, formatScore, roundToOneDecimal } from '../../../lib/format'
import {
  getGroup, listGroupStudents, publishGroup, removeStudentFromGroup, removeTeacherFromGroup,
} from '../../../services/groupService'
import type { GroupTeacher, Student, StudentGroup } from '../../../types'
import AddStudentsModal from '../components/AddStudentsModal'
import AddTeachersModal from '../components/AddTeachersModal'
import GroupFormModal from '../components/GroupFormModal'
import GroupStudentTable from '../components/GroupStudentTable'
import GroupTeacherList from '../components/GroupTeacherList'

const groupListLink = '/quan-tri/nhom-lop'
const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }
const chipClass =
  'inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg'
const secondaryButtonClass =
  'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors'

/** Trang sửa tài khoản học sinh — quản trị viên sở hữu tài khoản, nên đây là nơi hợp lý để dẫn tới. */
const studentEditorLink = (studentId: number) => `/quan-tri/hoc-sinh/${studentId}/sua`

export default function AdminGroupDetailPage() {
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
        : Promise.reject<StudentGroup>(new Error('Đường dẫn lớp không hợp lệ.')),
    [groupId],
  )

  const {
    data: students, loading: studentsLoading, error: studentsError, reload: reloadStudents,
  } = useAsync(
    () =>
      isValidGroupId
        ? listGroupStudents(groupId)
        : Promise.reject<Student[]>(new Error('Đường dẫn lớp không hợp lệ.')),
    [groupId],
  )

  const [editOpen, setEditOpen] = useState(false)
  const [addStudentsOpen, setAddStudentsOpen] = useState(false)
  const [addTeachersOpen, setAddTeachersOpen] = useState(false)
  const [removeStudentTarget, setRemoveStudentTarget] = useState<Student | null>(null)
  const [removingStudent, setRemovingStudent] = useState(false)
  const [removeTeacherTarget, setRemoveTeacherTarget] = useState<GroupTeacher | null>(null)
  const [removingTeacher, setRemovingTeacher] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const summaryText = useMemo(() => {
    if (!group) return null
    const parts = [group.name, `${group.studentCount} học sinh`, `${group.teachers.length} giáo viên`]
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

  const handleRemoveStudentConfirm = async () => {
    if (!removeStudentTarget || removingStudent) return

    setRemovingStudent(true)
    try {
      await removeStudentFromGroup(groupId, removeStudentTarget.id)
      toast.success(`Đã gỡ ${removeStudentTarget.fullName} khỏi lớp.`)
      setRemoveStudentTarget(null)
      reloadAll()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không gỡ được học sinh khỏi lớp.')
    } finally {
      setRemovingStudent(false)
    }
  }

  const handleRemoveTeacherConfirm = async () => {
    if (!removeTeacherTarget || removingTeacher) return

    setRemovingTeacher(true)
    try {
      await removeTeacherFromGroup(groupId, removeTeacherTarget.id)
      toast.success(`Đã gỡ phân công của ${removeTeacherTarget.fullName}.`)
      setRemoveTeacherTarget(null)
      // Chỉ cần tải lại thông tin lớp: danh sách giáo viên nằm trong đó, còn sĩ số không đổi.
      reloadGroup()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không gỡ được phân công.')
    } finally {
      setRemovingTeacher(false)
    }
  }

  const handlePublishConfirm = async () => {
    if (!group || publishing) return

    setPublishing(true)
    try {
      await publishGroup(group.id)
      toast.success(`Đã công bố lớp ${group.name}. Giáo viên được phân công đã thấy lớp này.`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không công bố được lớp.')
    } finally {
      setPublishing(false)
      setPublishOpen(false)
      // Cả hai nhánh đều tải lại: 409 nghĩa là lớp đã được công bố ở nơi khác, và màn hình này
      // đang hiện một trạng thái cũ.
      reloadGroup()
    }
  }

  const hasNoTeacher = group !== undefined && group.teachers.length === 0
  const showHeaderSkeleton = groupLoading && group === undefined

  const publishMessage = group
    ? hasNoTeacher
      ? `Lớp "${group.name}" chưa có giáo viên nào phụ trách. Công bố bây giờ thì lớp vẫn chưa hiện với ai, vì giáo viên chỉ thấy lớp mình được phân công.`
      : `Công bố lớp "${group.name}"? ${group.teachers.length} giáo viên được phân công sẽ thấy lớp và có thể giao bài kiểm tra cho ${group.studentCount} học sinh trong lớp.`
    : ''

  return (
    <AdminLayout
      pageTitle="Chi tiết lớp"
      pageSubtitle={summaryText ?? 'Phân công giáo viên, xếp học sinh và công bố lớp'}
    >
      <NavLink
        to={groupListLink}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4"
      >
        <ArrowLeft size={15} /> Quay lại danh sách lớp
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
            <NavLink to={groupListLink} className={secondaryButtonClass}>
              <ArrowLeft size={15} /> Quay lại danh sách lớp
            </NavLink>
          </div>
        </div>
      )}

      {group && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600">
                  <Users size={26} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl font-bold text-slate-800">{group.name}</h1>
                    <PublishStateBadge isPublished={group.isPublished} />
                  </div>
                  <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                    {group.description || 'Chưa có mô tả cho lớp này.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      <UsersRound size={13} /> {group.studentCount} học sinh
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">
                      <GraduationCap size={13} /> {group.teachers.length} giáo viên
                    </span>
                    <span className={chipClass}>
                      <CalendarDays size={13} /> Tạo ngày {formatDate(group.createdAt)}
                    </span>
                    {/* Lớp còn nháp thì server không gửi mốc công bố, nên không dựng chip rỗng. */}
                    {group.publishedAt && (
                      <span className={chipClass}>
                        <CheckCircle2 size={13} /> Công bố ngày {formatDate(group.publishedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
                <button type="button" onClick={() => setEditOpen(true)} className={secondaryButtonClass}>
                  <Edit3 size={15} /> Sửa thông tin
                </button>
                {!group.isPublished && (
                  <button
                    type="button"
                    onClick={() => setPublishOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all"
                  >
                    <Send size={15} /> Công bố lớp
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAddStudentsOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={primaryButtonStyle}
                >
                  <UserPlus size={16} /> Thêm học sinh
                </button>
              </div>
            </div>
          </div>

          {/* ===== Giáo viên phụ trách ===== */}
          <div className="mt-8 mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Giáo viên phụ trách
                <span className="text-slate-400 font-semibold"> ({group.teachers.length})</span>
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Chỉ giáo viên được phân công mới thấy lớp này và giao được bài cho học sinh trong lớp.
              </p>
            </div>
            <button type="button" onClick={() => setAddTeachersOpen(true)} className={secondaryButtonClass}>
              <UserPlus size={15} /> Phân công giáo viên
            </button>
          </div>

          {hasNoTeacher ? (
            /*
              Không phải một khoảng trống mà là một cảnh báo: lớp không có ai dạy thì bài kiểm tra
              không bao giờ tới được học sinh trong đó, và không màn hình nào khác nói ra điều này.
            */
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-800">Lớp chưa có giáo viên phụ trách</p>
                <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                  {group.studentCount > 0
                    ? `${group.studentCount} học sinh trong lớp sẽ không nhận được bài kiểm tra nào cho tới khi có ít nhất một giáo viên được phân công.`
                    : 'Hãy phân công ít nhất một giáo viên trước khi công bố lớp — nếu không, lớp sẽ không hiện với bất kỳ ai.'}
                </p>
                <button
                  type="button"
                  onClick={() => setAddTeachersOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
                >
                  <UserPlus size={15} /> Phân công giáo viên ngay
                </button>
              </div>
            </div>
          ) : (
            <GroupTeacherList
              teachers={group.teachers}
              onRemove={setRemoveTeacherTarget}
              removingId={removingTeacher ? removeTeacherTarget?.id : undefined}
            />
          )}

          {/* ===== Học sinh trong lớp ===== */}
          <div className="mt-8 mb-4">
            <h2 className="text-base font-bold text-slate-800">
              Học sinh trong lớp
              {students && <span className="text-slate-400 font-semibold"> ({students.length})</span>}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Gỡ học sinh khỏi lớp không xóa tài khoản, học sinh chỉ chuyển về trạng thái chưa phân lớp.
            </p>
          </div>

          {studentsLoading && students === undefined && <SkeletonTable rows={5} cols={7} />}

          {!studentsLoading && studentsError && (
            <ErrorState message={studentsError} onRetry={reloadStudents} />
          )}

          {!studentsError && students && students.length === 0 && (
            <EmptyState
              icon={UsersRound}
              title="Lớp chưa có học sinh nào"
              description="Xếp học sinh vào lớp để giáo viên phụ trách có thể giao bài kiểm tra cho cả lớp chỉ với một thao tác."
              action={
                <button
                  type="button"
                  onClick={() => setAddStudentsOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={primaryButtonStyle}
                >
                  <UserPlus size={16} /> Thêm học sinh vào lớp
                </button>
              }
            />
          )}

          {!studentsError && students && students.length > 0 && (
            <GroupStudentTable
              students={students}
              dimmed={studentsLoading}
              buildStudentLink={studentEditorLink}
              studentLinkLabel="Sửa"
              studentLinkIcon={Edit3}
              onRemove={setRemoveStudentTarget}
            />
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

          {addStudentsOpen && (
            <AddStudentsModal
              groupId={group.id}
              groupName={group.name}
              onClose={() => setAddStudentsOpen(false)}
              onAdded={() => {
                setAddStudentsOpen(false)
                reloadAll()
              }}
            />
          )}

          {addTeachersOpen && (
            <AddTeachersModal
              groupId={group.id}
              groupName={group.name}
              onClose={() => setAddTeachersOpen(false)}
              onAssigned={() => {
                setAddTeachersOpen(false)
                reloadGroup()
              }}
            />
          )}

          <ConfirmDialog
            open={removeStudentTarget !== null}
            title="Gỡ học sinh khỏi lớp"
            message={
              removeStudentTarget
                ? `Gỡ ${removeStudentTarget.fullName} khỏi lớp ${group.name}? Học sinh sẽ chuyển về trạng thái chưa phân lớp, tài khoản và kết quả bài làm vẫn được giữ nguyên.`
                : ''
            }
            confirmLabel="Gỡ khỏi lớp"
            tone="danger"
            loading={removingStudent}
            onConfirm={handleRemoveStudentConfirm}
            onCancel={() => {
              if (!removingStudent) setRemoveStudentTarget(null)
            }}
          />

          <ConfirmDialog
            open={removeTeacherTarget !== null}
            title="Gỡ phân công giáo viên"
            message={
              removeTeacherTarget
                ? `Gỡ ${removeTeacherTarget.fullName} khỏi lớp ${group.name}? Giáo viên sẽ không còn thấy lớp này và không giao được bài mới cho học sinh trong lớp; những bài đã giao vẫn giữ nguyên.`
                : ''
            }
            confirmLabel="Gỡ phân công"
            tone="danger"
            loading={removingTeacher}
            onConfirm={handleRemoveTeacherConfirm}
            onCancel={() => {
              if (!removingTeacher) setRemoveTeacherTarget(null)
            }}
          />

          <ConfirmDialog
            open={publishOpen}
            title={hasNoTeacher ? 'Công bố lớp chưa có giáo viên?' : 'Công bố lớp'}
            message={publishMessage}
            confirmLabel={hasNoTeacher ? 'Vẫn công bố' : 'Công bố'}
            cancelLabel="Để sau"
            loading={publishing}
            onConfirm={handlePublishConfirm}
            onCancel={() => {
              if (!publishing) setPublishOpen(false)
            }}
          />
        </>
      )}
    </AdminLayout>
  )
}
