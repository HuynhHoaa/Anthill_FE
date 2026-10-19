/**
 * Chi tiết một lớp dưới mắt GIÁO VIÊN — bản chỉ đọc.
 *
 * Giáo viên cần biết mình dạy những em nào để giao bài và đọc kết quả; còn ai vào lớp, ai ra khỏi
 * lớp là quyết định của tổ chức, nên mọi nút thay đổi đều nằm ở khu quản trị. Danh sách giáo viên
 * cùng phụ trách lớp không hiện ở đây — xem ở trang tương ứng bên khu quản trị.
 */
import { useMemo, useState } from 'react'
import { NavLink, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Eye, Users, UsersRound } from 'lucide-react'
import { memberCountLabel } from '../components/groupTheme'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import { LockedStateBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import ExportExcelButton from '../../../components/common/ExportExcelButton'
import { SkeletonTable } from '../../../components/common/Skeleton'
import SlidingSegments from '../../../components/common/SlidingSegments'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate, formatScore, roundScore } from '../../../lib/format'
import { dateStamp, fileSlug } from '../../../lib/download'
import { exportGroupGradeSheet, getGroup, listGroupExams, listGroupStudents } from '../../../services/groupService'
import type { GroupExam, Student, StudentGroup } from '../../../types'
import GroupExamResultsModal from '../components/GroupExamResultsModal'
import GroupExamsPanel from '../components/GroupExamsPanel'
import GroupStudentTable from '../components/GroupStudentTable'

const groupListLink = '/giao-vien/nhom-lop'
const chipClass =
  'inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg'

const studentProfileLink = (studentId: number) => `/giao-vien/hoc-sinh/${studentId}`

type DetailTab = 'hoc-sinh' | 'bai-kiem-tra'

function parseTab(raw: string | null): DetailTab {
  return raw === 'bai-kiem-tra' ? raw : 'hoc-sinh'
}

export default function TeacherGroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const groupId = Number(id)
  const isValidGroupId = Number.isInteger(groupId) && groupId > 0

  // Tab nằm trên URL: Back từ hồ sơ một em hay từ trang khác về đúng tab đang xem.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const setTab = (next: DetailTab) => {
    setSearchParams(
      current => {
        const nextParams = new URLSearchParams(current)
        if (next === 'hoc-sinh') nextParams.delete('tab')
        else nextParams.set('tab', next)
        return nextParams
      },
      { replace: true },
    )
  }
  const [examPage, setExamPage] = useState(1)
  const [openedExam, setOpenedExam] = useState<GroupExam | null>(null)

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

  const {
    data: exams, loading: examsLoading, error: examsError, reload: reloadExams,
  } = useAsync(
    () =>
      isValidGroupId
        ? listGroupExams(groupId)
        : Promise.reject<GroupExam[]>(new Error('Đường dẫn lớp không hợp lệ.')),
    [groupId],
  )

  const summaryText = useMemo(() => {
    if (!group) return null
    const parts = [group.name, `${group.studentCount} học sinh`]
    const scoredMembers = (students ?? []).filter(member => member.assignedExams > 0)
    if (scoredMembers.length > 0) {
      const averageScore = roundScore(
        scoredMembers.reduce((sum, member) => sum + member.averageScore, 0) / scoredMembers.length,
      )
      parts.push(`điểm trung bình ${formatScore(averageScore)}`)
    }
    return parts.join(' · ')
  }, [group, students])

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'hoc-sinh', label: `Học sinh${students ? ` (${memberCountLabel(students)})` : ''}` },
    { id: 'bai-kiem-tra', label: `Bài kiểm tra trong lớp${exams ? ` (${exams.length})` : ''}` },
  ]

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
          <div className="hidden 2xl:flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              <UsersRound size={13} /> {group.studentCount} học sinh
            </span>
            <span className={chipClass}>
              <CalendarDays size={13} /> Tạo ngày {formatDate(group.createdAt)}
            </span>
            {group.isLocked && <LockedStateBadge />}
          </div>
        </div>
      )}
      {group && (
        <ExportExcelButton
          label="Xuất bảng điểm"
          fileName={`bang-diem-lop-${fileSlug(group.name)}-${dateStamp()}.xlsx`}
          request={() => exportGroupGradeSheet(group.id)}
          successMessage={`Đã xuất bảng điểm lớp ${group.name}.`}
        />
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
          <div className="mb-4">
            <SlidingSegments activeKey={tab} className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 w-fit">
              {tabs.map(item => {
                const isActive = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    data-tab-active={isActive}
                    className={`relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </SlidingSegments>
          </div>

          {tab === 'hoc-sinh' && (
            <>
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

          {tab === 'bai-kiem-tra' && (
            <>
              {examsLoading && exams === undefined && <SkeletonTable rows={5} cols={5} />}
              {!examsLoading && examsError && <ErrorState message={examsError} onRetry={reloadExams} />}
              {!examsError && exams && (
                <GroupExamsPanel
                  exams={exams}
                  page={examPage}
                  onPageChange={setExamPage}
                  onOpen={setOpenedExam}
                  emptyDescription="Bài kiểm tra bạn giao cho lớp từ phần Bài kiểm tra sẽ hiện ở đây, cùng số em đã nộp và điểm trung bình."
                />
              )}
            </>
          )}

          {openedExam && (
            <GroupExamResultsModal
              exam={openedExam}
              groupId={group.id}
              audience="teacher"
              onClose={() => setOpenedExam(null)}
            />
          )}
        </>
      )}
    </TeacherLayout>
  )
}
