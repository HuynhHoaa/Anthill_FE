/**
 * Chi tiết một lớp dưới mắt GIÁO VIÊN — bản chỉ đọc.
 *
 * Giáo viên cần biết mình dạy những em nào để giao bài và đọc kết quả; còn ai vào lớp, ai ra khỏi
 * lớp là quyết định của tổ chức, nên mọi nút thay đổi đều nằm ở khu quản trị. Danh sách giáo viên
 * cùng phụ trách lớp không hiện ở đây — xem ở trang tương ứng bên khu quản trị.
 */
import { useMemo } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Eye, Users, UsersRound } from 'lucide-react'
import { memberCountLabel } from '../components/groupTheme'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate, formatScore, roundScore } from '../../../lib/format'
import { getGroup, listGroupStudents } from '../../../services/groupService'
import type { Student, StudentGroup } from '../../../types'
import GroupStudentTable from '../components/GroupStudentTable'

const groupListLink = '/giao-vien/nhom-lop'
const chipClass =
  'inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg'

const studentProfileLink = (studentId: number) => `/giao-vien/hoc-sinh/${studentId}`

export default function TeacherGroupDetailPage() {
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

  const summaryText = useMemo(() => {
    if (!group) return null
    const parts = [group.name, `${group.studentCount} học sinh`]
    const scoredMembers = (students ?? []).filter(member => member.completedExams > 0)
    if (scoredMembers.length > 0) {
      const averageScore = roundScore(
        scoredMembers.reduce((sum, member) => sum + member.averageScore, 0) / scoredMembers.length,
      )
      parts.push(`điểm trung bình ${formatScore(averageScore)}`)
    }
    return parts.join(' · ')
  }, [group, students])

  const showHeaderSkeleton = groupLoading && group === undefined

  // Thông tin lớp và nút quay lại nằm ở góc phải thanh tiêu đề (hẹp hơn thì đứng đầu nội dung): khung thông tin lớp
  // không còn chiếm cả một hàng rộng phía trên danh sách học sinh.
  const headerTools = (
    <div className="flex flex-wrap items-center justify-end gap-3 w-full min-w-0">
      {group && (
        <div className="flex items-center gap-3 min-w-0 max-w-full rounded-xl border border-slate-100 bg-white px-3 py-1.5 shadow-sm">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600">
            <Users size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate">{group.name}</h1>
            <p className="text-xs text-slate-500 truncate max-w-[18rem]" title={group.description || undefined}>
              {group.description || 'Chưa có mô tả cho lớp này.'}
            </p>
          </div>
          <div className="hidden xl:flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              <UsersRound size={13} /> {group.studentCount} học sinh
            </span>
            <span className={chipClass}>
              <CalendarDays size={13} /> Tạo ngày {formatDate(group.createdAt)}
            </span>
          </div>
        </div>
      )}
      <NavLink
        to={groupListLink}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} /> Quay lại danh sách lớp
      </NavLink>
    </div>
  )

  return (
    <TeacherLayout
      pageTitle="Chi tiết lớp"
      pageSubtitle={summaryText ?? 'Xem học sinh trong lớp bạn phụ trách'}
      compactContent
      headerTools={headerTools}
    >
      {!showHeaderSkeleton && groupError && (
        <div>
          <ErrorState message={groupError} onRetry={reloadGroup} />
          <div className="mt-4 flex justify-center">
            <NavLink
              to={groupListLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <ArrowLeft size={15} /> Quay lại danh sách lớp
            </NavLink>
          </div>
        </div>
      )}

      {group && (
        <>
          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-800">
              Học sinh trong lớp
              {students && <span className="text-slate-400 font-semibold"> ({memberCountLabel(students)})</span>}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Danh sách lớp do quản trị viên xếp. Cần thêm hoặc chuyển học sinh, hãy liên hệ quản trị viên.
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
              description="Quản trị viên chưa xếp học sinh vào lớp này, nên bài kiểm tra giao cho lớp sẽ chưa tới được ai."
            />
          )}

          {!studentsError && students && students.length > 0 && (
            <GroupStudentTable
              students={students}
              dimmed={studentsLoading}
              buildStudentLink={studentProfileLink}
              studentLinkLabel="Xem"
              studentLinkIcon={Eye}
            />
          )}
        </>
      )}
    </TeacherLayout>
  )
}
