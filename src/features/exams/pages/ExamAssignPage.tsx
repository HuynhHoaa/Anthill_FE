import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Clock, FileText, Layers,
  Search, SearchX, Send, Shuffle, UserCheck, Users, X,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import { LifecycleBadge, TopicBadge } from '../../../components/common/Badge'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import {
  assignExam, getExam, listExamAssignments, updateExam, type ExamPayload,
} from '../../../services/examService'
import { listGroups } from '../../../services/groupService'
import { listStudents } from '../../../services/studentService'
import { formatDateTime, getInitials, matchesSearch } from '../../../lib/format'
import type { Exam, Student } from '../../../types'
import { isCloseAfterOpen, toDateTimeLocalValue, toServiceDateTime } from '../utils/examScheduleFormat'

/** Đủ lớn để lấy trọn danh sách học sinh trong một lần gọi, tránh phải phân trang khi giao bài. */
const STUDENT_FETCH_SIZE = 500

const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'
const secondaryButtonClass =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

function toErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

/** Giữ nguyên toàn bộ cấu hình đề, chỉ thay lịch mở và lịch đóng. */
function buildScheduleOverridePayload(exam: Exam, openAtLocal: string, closeAtLocal: string): ExamPayload {
  return {
    title: exam.title,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    totalQuestions: exam.totalQuestions,
    easyPercentage: exam.easyPercentage,
    mediumPercentage: exam.mediumPercentage,
    hardPercentage: exam.hardPercentage,
    pointPerQuestion: exam.pointPerQuestion,
    topic: exam.topic,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleAnswers: exam.shuffleAnswers,
    openAt: toServiceDateTime(openAtLocal),
    closeAt: toServiceDateTime(closeAtLocal),
    showResultAfterSubmit: exam.showResultAfterSubmit,
    // Bản nháp thì lịch ghi đè chính là lúc xuất bản nên để vòng đời tự suy ra;
    // đề đã xuất bản phải giữ nguyên vòng đời, nếu không việc đổi lịch sẽ âm thầm đổi trạng thái đề.
    lifecycle: exam.lifecycle === 'draft' ? undefined : exam.lifecycle,
  }
}

function SummaryRow({ label, value, tone = 'default' }: {
  label: string
  value: string | number
  tone?: 'default' | 'primary' | 'muted'
}) {
  const valueClass =
    tone === 'primary' ? 'text-lg font-bold text-indigo-600'
      : tone === 'muted' ? 'text-sm font-semibold text-slate-400'
        : 'text-sm font-semibold text-slate-800'

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`${valueClass} text-right`}>{value}</span>
    </div>
  )
}

interface StudentPickerRowProps {
  student: Student
  isChecked: boolean
  isCoveredByGroup: boolean
  isAlreadyAssigned: boolean
  onToggle: (studentId: number) => void
}

function StudentPickerRow({
  student, isChecked, isCoveredByGroup, isAlreadyAssigned, onToggle,
}: StudentPickerRowProps) {
  return (
    <label
      className={`flex items-center gap-4 px-5 py-4 transition-colors ${
        isCoveredByGroup ? 'bg-indigo-50/40 cursor-default' : 'hover:bg-slate-50 cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked || isCoveredByGroup}
        disabled={isCoveredByGroup}
        onChange={() => onToggle(student.id)}
        className="w-4 h-4 accent-indigo-600 flex-shrink-0 disabled:opacity-60"
      />
      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
        {getInitials(student.fullName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 truncate">{student.fullName}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">
          {student.code} · {student.group}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0">
        {student.status === 'locked' && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
            Đã khóa
          </span>
        )}
        {isAlreadyAssigned && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
            Đã giao
          </span>
        )}
        {isCoveredByGroup && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700">
            Theo nhóm
          </span>
        )}
      </div>
    </label>
  )
}

function AssignSkeleton() {
  const cardKeys = Array.from({ length: 3 }, (_, index) => index)
  const rowKeys = Array.from({ length: 5 }, (_, index) => index)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="space-y-6">
        <div className={`${cardClass} p-6 space-y-3`}>
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cardKeys.map(cardKey => (
            <SkeletonBlock key={cardKey} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className={`${cardClass} overflow-hidden`}>
          <div className="p-5 border-b border-slate-100">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
          {rowKeys.map(rowKey => (
            <div key={rowKey} className="px-5 py-4 flex items-center gap-4 border-b border-slate-50 last:border-b-0">
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-1/3" />
                <SkeletonBlock className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <SkeletonBlock className="h-56 rounded-2xl" />
        <SkeletonBlock className="h-44 rounded-2xl" />
        <SkeletonBlock className="h-14 rounded-2xl" />
      </div>
    </div>
  )
}

export default function ExamAssignPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const examId = Number(id)

  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [randomizePerStudent, setRandomizePerStudent] = useState(true)
  const [notify, setNotify] = useState(true)
  const [scheduleOverrideEnabled, setScheduleOverrideEnabled] = useState(false)
  const [openAtLocal, setOpenAtLocal] = useState('')
  const [closeAtLocal, setCloseAtLocal] = useState('')
  const [scheduleError, setScheduleError] = useState<string | undefined>(undefined)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data, loading, error, reload } = useAsync(async () => {
    const exam = await getExam(examId)
    const [groups, studentPage, assignments] = await Promise.all([
      listGroups(),
      listStudents({ page: 1, pageSize: STUDENT_FETCH_SIZE }),
      listExamAssignments(exam.id),
    ])
    return { exam, groups, students: studentPage.items, assignments }
  }, [examId])

  const exam = data?.exam
  const groups = useMemo(() => data?.groups ?? [], [data])
  const students = useMemo(() => data?.students ?? [], [data])
  const assignments = useMemo(() => data?.assignments ?? [], [data])

  // Lịch ghi đè luôn khởi tạo từ lịch hiện có của bài kiểm tra.
  useEffect(() => {
    if (!exam) return
    setOpenAtLocal(toDateTimeLocalValue(exam.openAt))
    setCloseAtLocal(toDateTimeLocalValue(exam.closeAt))
  }, [exam])

  const assignedStudentIds = useMemo(
    () => new Set(assignments.map(assignment => assignment.studentId)),
    [assignments],
  )

  const groupCoveredStudentIds = useMemo(() => {
    const selectedGroups = new Set(selectedGroupIds)
    const covered = new Set<number>()
    students.forEach(student => {
      if (selectedGroups.has(student.groupId)) covered.add(student.id)
    })
    return covered
  }, [selectedGroupIds, students])

  /** Người nhận thật sự: hợp của học sinh chọn lẻ và học sinh thuộc nhóm đã chọn, không đếm trùng. */
  const recipientIds = useMemo(() => {
    const existingIds = new Set(students.map(student => student.id))
    const recipients = new Set(groupCoveredStudentIds)
    selectedStudentIds.forEach(studentId => {
      if (existingIds.has(studentId)) recipients.add(studentId)
    })
    return recipients
  }, [groupCoveredStudentIds, selectedStudentIds, students])

  const duplicateCount = useMemo(() => {
    let count = 0
    recipientIds.forEach(studentId => {
      if (assignedStudentIds.has(studentId)) count += 1
    })
    return count
  }, [recipientIds, assignedStudentIds])

  const newRecipientCount = recipientIds.size - duplicateCount

  const filteredStudents = useMemo(
    () => students.filter(student =>
      matchesSearch(search, [student.fullName, student.email, student.code, student.group]),
    ),
    [search, students],
  )

  /** Học sinh đang hiện trên danh sách và còn có thể chọn lẻ (không nằm trong nhóm đã chọn). */
  const selectableFilteredIds = useMemo(
    () => filteredStudents
      .filter(student => !groupCoveredStudentIds.has(student.id))
      .map(student => student.id),
    [filteredStudents, groupCoveredStudentIds],
  )

  // Hai nút chọn nhanh chỉ tác động lên phần đang hiện, nên số đếm cũng phải tính theo phần đang hiện.
  const addableFilteredIds = useMemo(
    () => selectableFilteredIds.filter(studentId => !selectedStudentIds.includes(studentId)),
    [selectableFilteredIds, selectedStudentIds],
  )

  const selectedFilteredIds = useMemo(
    () => filteredStudents
      .filter(student => selectedStudentIds.includes(student.id))
      .map(student => student.id),
    [filteredStudents, selectedStudentIds],
  )

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds(current =>
      current.includes(groupId)
        ? current.filter(item => item !== groupId)
        : [...current, groupId],
    )
  }

  const toggleStudent = (studentId: number) => {
    setSelectedStudentIds(current =>
      current.includes(studentId)
        ? current.filter(item => item !== studentId)
        : [...current, studentId],
    )
  }

  const selectAllFiltered = () => {
    setSelectedStudentIds(current => {
      const next = new Set(current)
      selectableFilteredIds.forEach(studentId => next.add(studentId))
      return Array.from(next)
    })
  }

  const clearFilteredSelection = () => {
    const clearedIds = new Set(selectedFilteredIds)
    setSelectedStudentIds(current => current.filter(studentId => !clearedIds.has(studentId)))
  }

  const countAssignedInGroup = (groupId: number) => {
    return students.filter(
      student => student.groupId === groupId && assignedStudentIds.has(student.id),
    ).length
  }

  const openConfirm = () => {
    if (recipientIds.size === 0) return
    if (scheduleOverrideEnabled && !isCloseAfterOpen(openAtLocal, closeAtLocal)) {
      setScheduleError('Thời gian đóng bài phải sau thời gian mở bài.')
      toast.error('Lịch mở bài ghi đè chưa hợp lệ.')
      return
    }
    setScheduleError(undefined)
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!exam) return

    setSubmitting(true)
    try {
      if (scheduleOverrideEnabled) {
        await updateExam(exam.id, buildScheduleOverridePayload(exam, openAtLocal, closeAtLocal))
      }

      const result = await assignExam(exam.id, {
        studentIds: selectedStudentIds,
        groupIds: selectedGroupIds,
        randomizePerStudent,
        notify,
      })

      setConfirmOpen(false)
      if (result.assignedCount > 0) {
        toast.success(`Đã giao bài kiểm tra cho ${result.assignedCount} học sinh.`)
      } else {
        toast.info('Tất cả học sinh được chọn đều đã có bài kiểm tra này.')
      }
      navigate(`/giao-vien/bai-kiem-tra/${exam.id}`)
    } catch (caught) {
      toast.error(toErrorMessage(caught, 'Không giao được bài kiểm tra. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmMessage = exam
    ? [
      `Giao bài “${exam.title}” cho ${recipientIds.size} học sinh.`,
      duplicateCount > 0
        ? `${duplicateCount} học sinh đã có bài này từ trước sẽ được bỏ qua, hệ thống chỉ tạo mới ${newRecipientCount} lượt giao.`
        : '',
      scheduleOverrideEnabled
        ? `Lịch mở bài được cập nhật thành ${toServiceDateTime(openAtLocal)} – ${toServiceDateTime(closeAtLocal)}.`
        : '',
      notify ? 'Học sinh sẽ nhận được thông báo ngay sau khi giao.' : 'Học sinh sẽ không nhận thông báo.',
    ].filter(Boolean).join(' ')
    : ''

  const pageSubtitle = exam ? exam.title : 'Chọn học sinh hoặc nhóm lớp sẽ nhận bài kiểm tra'

  return (
    <TeacherLayout pageTitle="Giao bài kiểm tra" pageSubtitle={pageSubtitle}>
      <div className="mb-5">
        <NavLink
          to={Number.isFinite(examId) ? `/giao-vien/bai-kiem-tra/${examId}` : '/giao-vien/bai-kiem-tra'}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại chi tiết bài kiểm tra
        </NavLink>
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      {!error && (loading && !data) && <AssignSkeleton />}

      {!error && data && exam && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start animate-fade-in-up">
          <div className="space-y-6 min-w-0">
            <section className={`${cardClass} p-6`}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <TopicBadge topic={exam.topic} />
                <LifecycleBadge lifecycle={exam.lifecycle} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">{exam.title}</h2>
              {exam.description && (
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{exam.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                  <FileText size={13} /> {exam.totalQuestions} câu hỏi
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                  <Clock size={13} /> {exam.durationMinutes} phút
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                  <CalendarClock size={13} /> {formatDateTime(exam.openAt)} – {formatDateTime(exam.closeAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                  <UserCheck size={13} /> Đã giao {exam.assignedCount}
                </span>
              </div>
            </section>

            {exam.lifecycle === 'draft' && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-700 mb-0.5">Bài kiểm tra vẫn đang là bản nháp</p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Học sinh sẽ nhận được bài nhưng chưa vào làm được cho tới khi bài được mở. Hãy bật
                    “Ghi đè lịch mở – đóng bài” ở cột bên phải để đặt lịch ngay khi giao, hoặc{' '}
                    <NavLink
                      to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
                      className="font-semibold underline underline-offset-2 hover:text-amber-800"
                    >
                      quay lại trang sửa để xuất bản đề
                    </NavLink>
                    .
                  </p>
                </div>
              </div>
            )}

            {duplicateCount > 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700 mb-0.5">
                    {duplicateCount} học sinh đã được giao bài này trước đó
                  </p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Hệ thống sẽ bỏ qua những học sinh này để không tạo lượt giao trùng, chỉ{' '}
                    {newRecipientCount} học sinh còn lại nhận bài mới.
                  </p>
                </div>
              </div>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Layers size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-800">Chọn nhóm lớp</h2>
                  <p className="text-sm text-slate-400">
                    Có thể chọn nhiều nhóm cùng lúc và bổ sung thêm học sinh lẻ bên dưới.
                  </p>
                </div>
              </div>

              {groups.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="Chưa có nhóm lớp nào"
                  description="Hãy tạo nhóm lớp để giao bài cho cả lớp chỉ bằng một thao tác."
                  action={
                    <NavLink
                      to="/giao-vien/nhom-lop"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                    >
                      <Layers size={15} /> Quản lý nhóm lớp
                    </NavLink>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groups.map(group => {
                    const isSelected = selectedGroupIds.includes(group.id)
                    const assignedInGroup = countAssignedInGroup(group.id)
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className={`text-left rounded-2xl border p-4 transition-all shadow-sm hover:shadow-md ${
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-slate-100 bg-white hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{group.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{group.studentCount} học sinh</p>
                            {assignedInGroup > 0 && (
                              <p className="text-xs text-amber-600 font-medium mt-1">
                                {assignedInGroup} đã được giao
                              </p>
                            )}
                          </div>
                          {isSelected && <CheckCircle2 size={18} className="text-indigo-600 flex-shrink-0" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-800">Chọn học sinh</h2>
                    <p className="text-sm text-slate-400">
                      Đang chọn riêng {selectedStudentIds.length} học sinh
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    disabled={addableFilteredIds.length === 0}
                    className={secondaryButtonClass}
                  >
                    <CheckCircle2 size={14} /> Chọn tất cả ({addableFilteredIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearFilteredSelection}
                    disabled={selectedFilteredIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <X size={14} /> Bỏ chọn ({selectedFilteredIds.length})
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="Tìm theo tên, mã học sinh, email hoặc nhóm lớp"
                />
              </div>

              {students.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Chưa có học sinh nào"
                  description="Tài khoản học sinh do quản trị viên tạo. Hãy liên hệ quản trị viên, hoặc kiểm tra lại nhóm lớp."
                  action={
                    <NavLink
                      to="/giao-vien/nhom-lop"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                    >
                      <Users size={15} /> Mở nhóm lớp
                    </NavLink>
                  }
                />
              ) : filteredStudents.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Không tìm thấy học sinh phù hợp"
                  description={`Không có học sinh nào khớp với từ khóa “${search}”. Thử tìm bằng mã học sinh hoặc tên nhóm lớp.`}
                  action={
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      <X size={15} /> Xóa tìm kiếm
                    </button>
                  }
                />
              ) : (
                <div className={`${cardClass} overflow-hidden`}>
                  <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-50">
                    {filteredStudents.map(student => (
                      <StudentPickerRow
                        key={student.id}
                        student={student}
                        isChecked={selectedStudentIds.includes(student.id)}
                        isCoveredByGroup={groupCoveredStudentIds.has(student.id)}
                        isAlreadyAssigned={assignedStudentIds.has(student.id)}
                        onToggle={toggleStudent}
                      />
                    ))}
                  </div>
                  <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Hiển thị {filteredStudents.length} trong {students.length} học sinh
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 min-w-0">
            <div className={`${cardClass} p-5`}>
              <h2 className="text-base font-bold text-slate-800 mb-3">Tóm tắt giao bài</h2>
              <div
                className="rounded-xl px-4 py-3 mb-3"
                style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' }}
              >
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">
                  Tổng người nhận
                </p>
                <p className="text-3xl font-bold text-indigo-700 mt-0.5">{recipientIds.size}</p>
                <p className="text-xs text-indigo-500 mt-1">Đã loại bỏ trùng lặp giữa nhóm và cá nhân</p>
              </div>

              <SummaryRow label="Nhóm lớp đã chọn" value={selectedGroupIds.length} />
              <SummaryRow label="Học sinh chọn riêng" value={selectedStudentIds.length} />
              <SummaryRow label="Sẽ giao mới" value={newRecipientCount} tone="primary" />
              <SummaryRow
                label="Bỏ qua vì đã giao"
                value={duplicateCount}
                tone={duplicateCount > 0 ? 'default' : 'muted'}
              />
            </div>

            <div className={`${cardClass} p-5`}>
              <h2 className="text-base font-bold text-slate-800 mb-2">Tùy chọn giao bài</h2>

              <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer">
                <span className="min-w-0">
                  <span className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                    <Shuffle size={14} className="text-slate-400" /> Sinh đề riêng cho từng học sinh
                  </span>
                  <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Mỗi học sinh nhận một bộ câu hỏi khác nhau theo đúng blueprint.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={randomizePerStudent}
                  onChange={event => setRandomizePerStudent(event.target.checked)}
                  className="w-4 h-4 accent-indigo-600 mt-1 flex-shrink-0"
                />
              </label>

              <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer border-t border-slate-50">
                <span className="min-w-0">
                  <span className="text-sm text-slate-700 font-medium">Gửi thông báo cho học sinh</span>
                  <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Học sinh thấy bài mới ngay trên trang thông báo.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={event => setNotify(event.target.checked)}
                  className="w-4 h-4 accent-indigo-600 mt-1 flex-shrink-0"
                />
              </label>

              <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer border-t border-slate-50">
                <span className="min-w-0">
                  <span className="text-sm text-slate-700 font-medium">Ghi đè lịch mở – đóng bài</span>
                  <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Cập nhật lại lịch của bài kiểm tra ngay khi giao.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={scheduleOverrideEnabled}
                  onChange={event => {
                    setScheduleOverrideEnabled(event.target.checked)
                    setScheduleError(undefined)
                  }}
                  className="w-4 h-4 accent-indigo-600 mt-1 flex-shrink-0"
                />
              </label>

              {scheduleOverrideEnabled && (
                <div className="mt-2 space-y-3 rounded-xl bg-slate-50 p-4">
                  <div>
                    <label htmlFor="assign-open-at" className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Mở bài lúc
                    </label>
                    <input
                      id="assign-open-at"
                      type="datetime-local"
                      value={openAtLocal}
                      onChange={event => {
                        setOpenAtLocal(event.target.value)
                        setScheduleError(undefined)
                      }}
                      className={`${inputClass} bg-white`}
                    />
                  </div>
                  <div>
                    <label htmlFor="assign-close-at" className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Đóng bài lúc
                    </label>
                    <input
                      id="assign-close-at"
                      type="datetime-local"
                      value={closeAtLocal}
                      onChange={event => {
                        setCloseAtLocal(event.target.value)
                        setScheduleError(undefined)
                      }}
                      className={`${inputClass} bg-white`}
                    />
                  </div>
                  {scheduleError && (
                    <p className="text-xs font-medium text-red-500 flex items-center gap-1.5">
                      <AlertTriangle size={13} className="flex-shrink-0" />
                      {scheduleError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={`${cardClass} p-5`}>
              <button
                type="button"
                onClick={openConfirm}
                disabled={recipientIds.size === 0 || submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                <Send size={17} /> Xác nhận giao bài
              </button>
              {recipientIds.size === 0 && (
                <p className="text-xs text-slate-400 leading-relaxed mt-3 text-center">
                  Chọn ít nhất một nhóm lớp hoặc một học sinh để bật nút giao bài.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận giao bài kiểm tra"
        message={confirmMessage}
        confirmLabel="Giao bài ngay"
        cancelLabel="Xem lại"
        loading={submitting}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
      />
    </TeacherLayout>
  )
}
