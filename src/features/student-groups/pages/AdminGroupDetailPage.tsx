/**
 * Chi tiết một lớp dưới quyền QUẢN TRỊ VIÊN — nơi duy nhất sửa, công bố và xoá lớp.
 *
 * Ba tab, xếp theo thứ tự việc phải làm: **Học sinh** (xếp lớp, chuyển lớp, gỡ khỏi lớp; bấm một em để xem hồ sơ và bài
 * làm), **Bài kiểm tra** (các bài đã giao cho lớp kèm kết quả, chỉ đọc), **Thiết lập** (sửa thông tin, đổi giáo viên, công
 * bố, xoá). Mỗi lớp có đúng một giáo viên nên không có danh sách giáo viên riêng. Chừng nào chưa công bố thì ngoài quản
 * trị viên không ai nhìn thấy lớp. Danh sách lớp bên ngoài chỉ để xem, nên mọi thay đổi đều đi qua trang này.
 */
import { useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Lock, UserPlus } from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { LockedStateBadge, PublishStateBadge } from '../../../components/common/Badge'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import ErrorState from '../../../components/common/ErrorState'
import SearchField from '../../../components/common/SearchField'
import SlidingSegments from '../../../components/common/SlidingSegments'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useUrlListState } from '../../../hooks/useUrlListState'
import { formatDate, formatScore, roundScore } from '../../../lib/format'
import {
  deleteGroup, getGroup, listGroupChanges, listGroupExams, listGroupStudents, lockGroup, publishGroup, unlockGroup,
  unpublishGroup,
} from '../../../services/groupService'
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../../../services/studentService'
import type { GroupChange, GroupExam, Student, StudentGroup } from '../../../types'
import ImportExcelButton from '../../imports/components/ImportExcelButton'
import AddStudentsModal from '../components/AddStudentsModal'
import ChangeTeacherModal from '../components/ChangeTeacherModal'
import GroupExamResultsModal from '../components/GroupExamResultsModal'
import GroupExamsPanel from '../components/GroupExamsPanel'
import GroupFormModal from '../components/GroupFormModal'
import GroupHistoryPanel from '../components/GroupHistoryPanel'
import GroupSettingsPanel from '../components/GroupSettingsPanel'
import GroupStudentsPanel from '../components/GroupStudentsPanel'
import TransferStudentModal from '../components/TransferStudentModal'
import { memberCountLabel } from '../components/groupTheme'
import { useRemoveFromGroup } from '../hooks/useRemoveFromGroup'

const groupListLink = '/quan-tri/nhom-lop'
const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }

type DetailTab = 'hoc-sinh' | 'bai-kiem-tra' | 'thiet-lap'

function parseTab(raw: string | null): DetailTab {
  return raw === 'bai-kiem-tra' || raw === 'thiet-lap' ? raw : 'hoc-sinh'
}

export default function AdminGroupDetailPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const removeFromGroup = useRemoveFromGroup()
  const { id } = useParams<{ id: string }>()
  const groupId = Number(id)
  const isValidGroupId = Number.isInteger(groupId) && groupId > 0

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const setTab = (next: DetailTab) => {
    setSearchParams(
      current => {
        const nextParams = new URLSearchParams(current)
        if (next === 'hoc-sinh') nextParams.delete('tab')
        else nextParams.set('tab', next)
        nextParams.delete('trang')
        return nextParams
      },
      { replace: true },
    )
  }

  // Từ khoá và số trang nằm trên URL: Back từ hồ sơ một em về đúng chỗ đang xem trong lớp.
  const { searchInput, setSearchInput, search, page, setPage, clearAll } = useUrlListState({})

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

  const { data: changes, reload: reloadChanges } = useAsync(
    () => (isValidGroupId ? listGroupChanges(groupId) : Promise.resolve([] as GroupChange[])),
    [groupId],
  )

  const [editOpen, setEditOpen] = useState(false)
  const [addStudentsOpen, setAddStudentsOpen] = useState(false)
  const [changeTeacherOpen, setChangeTeacherOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<Student | null>(null)
  const [openedExam, setOpenedExam] = useState<GroupExam | null>(null)

  const summaryText = useMemo(() => {
    if (!group) return null
    const teacher = group.teachers[0]
    const teacherPart = !teacher
      ? 'chưa có giáo viên'
      : group.teachers.length === 1
        ? `GV ${teacher.fullName}`
        : `${group.teachers.length} giáo viên`
    const parts = [`${group.studentCount} học sinh`, teacherPart]
    const scoredMembers = (students ?? []).filter(member => member.assignedExams > 0)
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
    reloadExams()
    reloadChanges()
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
    if (await removeFromGroup(student, group)) reloadAll()
  }

  const requestPublish = async () => {
    if (!group) return
    const teacher = group.teachers[0]
    const published = await confirm({
      title: 'Công bố lớp',
      message: teacher
        ? `Lớp “${group.name}” sẽ được công bố cho giáo viên ${teacher.fullName}.`
        : `Lớp “${group.name}” sẽ được công bố.`,
      details: (
        <ConsequenceList
          items={[
            `${teacher ? teacher.fullName : 'Giáo viên phụ trách'} thấy lớp và có thể giao bài kiểm tra cho ${group.studentCount} học sinh trong lớp.`,
            'Bạn có thể chuyển lớp về bản nháp sau nếu cần.',
          ]}
        />
      ),
      confirmLabel: 'Công bố',
      cancelLabel: 'Để sau',
      onConfirm: reloadOnFailure(() => publishGroup(group.id)),
    })
    if (!published) return
    toast.success(`Đã công bố lớp ${group.name}. Giáo viên phụ trách đã thấy lớp này.`)
    reloadGroup()
  }

  const requestUnpublish = async () => {
    if (!group) return
    const teacher = group.teachers[0]
    const teacherPart = teacher
      ? `${teacher.fullName} sẽ không còn thấy lớp và không giao được bài mới cho ${group.studentCount} học sinh trong lớp.`
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

  const requestLock = async () => {
    if (!group) return
    const running = (exams ?? []).filter(exam => exam.lifecycle !== 'closed').length

    const reason = await confirm.withInput({
      title: 'Khoá lớp',
      message: `Lớp “${group.name}” sẽ chỉ còn xem được:`,
      details: (
        <ConsequenceList
          items={[
            'Không xếp thêm học sinh, không giao bài mới, không đổi giáo viên hay sửa lớp.',
            'Học sinh, bài đã giao và bảng điểm giữ nguyên.',
            'Các em trong lớp vẫn học các lớp khác bình thường.',
            ...(running > 0
              ? [`Lớp còn ${running} bài kiểm tra đang mở hoặc sắp mở; các em vẫn làm được những bài đó.`]
              : []),
            'Bạn mở khoá lại được bất cứ lúc nào.',
          ]}
        />
      ),
      inputLabel: 'Lý do khoá lớp',
      placeholder: 'Ví dụ: Kết thúc học kỳ một, lớp không nhận thêm học sinh',
      inputHint: 'Lý do được lưu vào lịch sử của lớp để người xem sau này hiểu vì sao lớp bị khoá.',
      minLength: REASON_MIN_LENGTH,
      maxLength: REASON_MAX_LENGTH,
      confirmLabel: 'Khoá lớp',
      onConfirm: async value => {
        await reloadOnFailure(() => lockGroup(group.id, value))()
      },
    })
    if (reason === null) return
    toast.success(`Đã khoá lớp ${group.name}.`)
    reloadAll()
  }

  const requestUnlock = async () => {
    if (!group) return
    const unlocked = await confirm({
      title: 'Mở khoá lớp',
      message: `Lớp “${group.name}” sẽ nhận thêm học sinh và bài mới trở lại.`,
      details: <ConsequenceList items={['Học sinh, bài đã giao và bảng điểm giữ nguyên.', 'Bạn khoá lại được bất cứ lúc nào.']} />,
      confirmLabel: 'Mở khoá',
      onConfirm: reloadOnFailure(() => unlockGroup(group.id)),
    })
    if (!unlocked) return
    toast.success(`Đã mở khoá lớp ${group.name}.`)
    reloadAll()
  }

  const requestDelete = async () => {
    if (!group) return
    const deleted = await confirm({
      title: 'Xoá lớp',
      message: `Lớp “${group.name}” sẽ bị xoá:`,
      details: (
        <ConsequenceList
          items={[
            'Lớp đang trống nên không có học sinh nào bị ảnh hưởng.',
            'Những bài từng giao theo lớp này vẫn giữ nguyên, chỉ không còn gắn với lớp.',
            'Việc xoá không hoàn tác được.',
          ]}
        />
      ),
      confirmLabel: 'Xoá lớp',
      tone: 'danger',
      onConfirm: reloadOnFailure(() => deleteGroup(group.id)),
    })
    if (!deleted) return
    toast.success(`Đã xoá lớp ${group.name}.`)
    navigate(groupListLink)
  }

  const showSkeleton = groupLoading && group === undefined
  const memberCount = students?.length ?? group?.studentCount ?? 0

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'hoc-sinh', label: `Học sinh${students ? ` (${memberCountLabel(students)})` : ''}` },
    { id: 'bai-kiem-tra', label: `Bài kiểm tra${exams ? ` (${exams.length})` : ''}` },
    { id: 'thiet-lap', label: 'Thiết lập' },
  ]

  // Nút quay lại và trạng thái nằm trên thanh tiêu đề (hẹp hơn thì đứng đầu nội dung), không chiếm một hàng riêng.
  const headerTools = (
    <div className="flex w-full items-center justify-start lg:justify-end gap-2.5">
      {group && <PublishStateBadge isPublished={group.isPublished} />}
      {group?.isLocked && <LockedStateBadge />}
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
      pageTitle={group?.name ?? 'Chi tiết lớp'}
      pageSubtitle={summaryText ?? 'Xếp học sinh, xem bài kiểm tra và công bố lớp'}
      compactContent
      headerTools={headerTools}
    >
      {showSkeleton && <SkeletonTable rows={6} cols={6} />}

      {!showSkeleton && groupError && <ErrorState message={groupError} onRetry={reloadGroup} />}

      {group && (
        <>
          {group.isLocked && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5 text-sm text-amber-800">
              <Lock size={16} className="flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-semibold">Lớp đã khoá{group.lockedAt ? ` từ ${formatDate(group.lockedAt)}` : ''}</span> — chỉ
                xem được. Không xếp thêm học sinh hay giao bài mới; các em vẫn học các lớp khác. Mở khoá ở phần Thiết lập nếu cần
                thay đổi.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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

            {tab === 'hoc-sinh' && (
              <div className="flex flex-wrap items-center justify-end gap-2.5 flex-1 min-w-[14rem]">
                <div className="flex-1 max-w-xs">
                  <SearchField
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Tìm theo tên, mã hoặc email"
                    label="Tìm học sinh trong lớp"
                  />
                </div>
                {!group.isLocked && (
                  <>
                    <ImportExcelButton
                      kind="students"
                      fixedGroup={{ id: group.id, name: group.name }}
                      onImported={reloadAll}
                    />
                    <button
                      type="button"
                      onClick={() => setAddStudentsOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                      style={primaryButtonStyle}
                    >
                      <UserPlus size={16} /> Thêm học sinh
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {tab === 'hoc-sinh' && (
            <>
              {studentsLoading && students === undefined && <SkeletonTable rows={6} cols={6} />}
              {!studentsLoading && studentsError && <ErrorState message={studentsError} onRetry={reloadStudents} />}
              {!studentsError && students && (
                <GroupStudentsPanel
                  students={students}
                  search={search}
                  page={page}
                  onPageChange={setPage}
                  onClearSearch={clearAll}
                  onAdd={() => setAddStudentsOpen(true)}
                  onTransfer={setTransferTarget}
                  onRemove={student => void requestRemoveStudent(student)}
                  locked={group.isLocked}
                  dimmed={studentsLoading}
                />
              )}
            </>
          )}

          {tab === 'bai-kiem-tra' && (
            <>
              {examsLoading && exams === undefined && <SkeletonTable rows={5} cols={5} />}
              {!examsLoading && examsError && <ErrorState message={examsError} onRetry={reloadExams} />}
              {!examsError && exams && (
                <GroupExamsPanel exams={exams} page={page} onPageChange={setPage} onOpen={setOpenedExam} />
              )}
            </>
          )}

          {tab === 'thiet-lap' && (
            <div className="stagger-in grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
              <GroupSettingsPanel
                group={group}
                memberCount={memberCount}
                onEdit={() => setEditOpen(true)}
                onChangeTeacher={() => setChangeTeacherOpen(true)}
                onPublish={() => void requestPublish()}
                onUnpublish={() => void requestUnpublish()}
                onLock={() => void requestLock()}
                onUnlock={() => void requestUnlock()}
                onDelete={() => void requestDelete()}
              />
              <GroupHistoryPanel changes={changes ?? []} />
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

          {changeTeacherOpen && (
            <ChangeTeacherModal
              group={group}
              onClose={() => setChangeTeacherOpen(false)}
              onChanged={() => {
                setChangeTeacherOpen(false)
                reloadGroup()
                reloadChanges()
              }}
            />
          )}

          {transferTarget && (
            <TransferStudentModal
              student={transferTarget}
              group={group}
              onClose={() => setTransferTarget(null)}
              onTransferred={() => {
                setTransferTarget(null)
                reloadAll()
              }}
            />
          )}

          {openedExam && (
            <GroupExamResultsModal exam={openedExam} groupId={group.id} audience="admin" onClose={() => setOpenedExam(null)} />
          )}
        </>
      )}
    </AdminLayout>
  )
}
