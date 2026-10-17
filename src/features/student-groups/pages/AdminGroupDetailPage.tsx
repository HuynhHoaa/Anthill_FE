/**
 * Chi tiết một lớp dưới quyền QUẢN TRỊ VIÊN.
 *
 * Ba việc của trang này xếp đúng thứ tự phải làm: sửa thông tin lớp, phân công giáo viên, xếp học
 * sinh — rồi công bố. Chừng nào chưa công bố thì ngoài quản trị viên không ai nhìn thấy lớp.
 */
import { useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Edit3, Eye, EyeOff, GraduationCap,
  Send, UserPlus, Users, UsersRound,
} from 'lucide-react'
import { memberCountLabel } from '../components/groupTheme'
import AdminLayout from '../../../components/layout/AdminLayout'
import { PublishStateBadge } from '../../../components/common/Badge'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate, formatScore, roundScore } from '../../../lib/format'
import {
  getGroup, listGroupStudents, publishGroup, removeStudentFromGroup, removeTeacherFromGroup,
  unpublishGroup,
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
  const confirm = useConfirm()
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

  const summaryText = useMemo(() => {
    if (!group) return null
    const parts = [group.name, `${group.studentCount} học sinh`, `${group.teachers.length} giáo viên`]
    const scoredMembers = (students ?? []).filter(member => member.completedExams > 0)
    if (scoredMembers.length > 0) {
      const averageScore = roundScore(
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

  /**
   * Server từ chối thì vẫn tải lại rồi mới báo lỗi trong hộp: 409 ở đây nghĩa là lớp vừa bị đổi ở
   * nơi khác — công bố, gỡ người — và màn hình này đang hiện một trạng thái cũ.
   */
  const reloadOnFailure = (action: () => Promise<unknown>) => async () => {
    try {
      await action()
    } catch (caught) {
      reloadAll()
      throw caught
    }
  }

  const requestRemoveStudent = async (student: Student) => {
    if (!group) return
    const removed = await confirm({
      title: 'Gỡ học sinh khỏi lớp',
      message: `${student.fullName} sẽ rời lớp ${group.name} và chuyển về trạng thái chưa phân lớp.`,
      details: <ConsequenceList items={['Tài khoản và kết quả bài làm của em ấy vẫn được giữ nguyên.']} />,
      confirmLabel: 'Gỡ khỏi lớp',
      tone: 'danger',
      onConfirm: reloadOnFailure(() => removeStudentFromGroup(groupId, student.id)),
    })
    if (!removed) return
    toast.success(`Đã gỡ ${student.fullName} khỏi lớp.`)
    reloadAll()
  }

  const requestRemoveTeacher = async (teacher: GroupTeacher) => {
    if (!group) return
    const removed = await confirm({
      title: 'Gỡ phân công giáo viên',
      message: `${teacher.fullName} sẽ không còn phụ trách lớp ${group.name}.`,
      details: (
        <ConsequenceList
          items={[
            'Giáo viên này không còn thấy lớp và không giao được bài mới cho học sinh trong lớp.',
            'Những bài đã giao vẫn giữ nguyên.',
          ]}
        />
      ),
      confirmLabel: 'Gỡ phân công',
      tone: 'danger',
      onConfirm: reloadOnFailure(() => removeTeacherFromGroup(groupId, teacher.id)),
    })
    if (!removed) return
    toast.success(`Đã gỡ phân công của ${teacher.fullName}.`)
    // Chỉ cần tải lại thông tin lớp: danh sách giáo viên nằm trong đó, còn sĩ số không đổi.
    reloadGroup()
  }

  const requestPublish = async () => {
    if (!group) return
    const withoutTeacher = group.teachers.length === 0
    const published = await confirm({
      title: withoutTeacher ? 'Công bố lớp chưa có giáo viên?' : 'Công bố lớp',
      message: withoutTeacher
        ? `Lớp “${group.name}” chưa có giáo viên nào phụ trách.`
        : `Lớp “${group.name}” sẽ được công bố cho ${group.teachers.length} giáo viên được phân công.`,
      details: (
        <ConsequenceList
          items={withoutTeacher
            ? ['Công bố bây giờ thì lớp vẫn chưa hiện với ai, vì giáo viên chỉ thấy lớp mình được phân công.']
            : [
              `Các giáo viên này thấy lớp và có thể giao bài kiểm tra cho ${group.studentCount} học sinh trong lớp.`,
              'Bạn có thể chuyển lớp về bản nháp sau nếu cần.',
            ]}
        />
      ),
      confirmLabel: withoutTeacher ? 'Vẫn công bố' : 'Công bố',
      cancelLabel: 'Để sau',
      onConfirm: reloadOnFailure(() => publishGroup(group.id)),
    })
    if (!published) return
    toast.success(`Đã công bố lớp ${group.name}. Giáo viên được phân công đã thấy lớp này.`)
    reloadGroup()
  }

  const requestUnpublish = async () => {
    if (!group) return
    const teacherPart =
      group.teachers.length > 0
        ? `${group.teachers.length} giáo viên phụ trách sẽ không còn thấy lớp và không giao được bài mới cho ${group.studentCount} học sinh trong lớp.`
        : 'Lớp chưa có giáo viên phụ trách nên chưa ai mất quyền xem.'
    const unpublished = await confirm({
      title: 'Chuyển lớp về bản nháp',
      message: `Lớp “${group.name}” sẽ trở lại dạng bản nháp.`,
      details: (
        <ConsequenceList
          items={[
            teacherPart,
            'Học sinh trong lớp, bài đã giao và kết quả giữ nguyên.',
            'Bạn có thể công bố lại bất cứ lúc nào.',
          ]}
        />
      ),
      confirmLabel: 'Chuyển về nháp',
      onConfirm: reloadOnFailure(() => unpublishGroup(group.id)),
    })
    if (!unpublished) return
    toast.success(`Đã chuyển lớp ${group.name} về bản nháp. Giáo viên không còn thấy lớp này.`)
    reloadGroup()
  }

  const hasNoTeacher = group !== undefined && group.teachers.length === 0
  const showHeaderSkeleton = groupLoading && group === undefined

  // Nút quay lại nằm trên thanh tiêu đề (hẹp hơn thì đứng đầu nội dung), không chiếm một hàng riêng trong trang.
  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to={groupListLink}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} /> Quay lại danh sách lớp
      </NavLink>
    </div>
  )

  return (
    <AdminLayout
      pageTitle="Chi tiết lớp"
      pageSubtitle={summaryText ?? 'Phân công giáo viên, xếp học sinh và công bố lớp'}
      compactContent
      headerTools={backLink}
    >

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
        <ErrorState message={groupError} onRetry={reloadGroup} />
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
                {group.isPublished && (
                  <button type="button" onClick={() => void requestUnpublish()} className={secondaryButtonClass}>
                    <EyeOff size={15} /> Chuyển về nháp
                  </button>
                )}
                {!group.isPublished && (
                  <button
                    type="button"
                    onClick={() => void requestPublish()}
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
              onRemove={teacher => void requestRemoveTeacher(teacher)}
            />
          )}

          {/* ===== Học sinh trong lớp ===== */}
          <div className="mt-8 mb-4">
            <h2 className="text-base font-bold text-slate-800">
              Học sinh trong lớp
              {students && <span className="text-slate-400 font-semibold"> ({memberCountLabel(students)})</span>}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Gỡ học sinh khỏi lớp không xoá tài khoản, học sinh chỉ chuyển về trạng thái chưa phân lớp.
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
              retiredStudentLink={{ label: 'Xem', icon: Eye }}
              onRemove={student => void requestRemoveStudent(student)}
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
        </>
      )}
    </AdminLayout>
  )
}
