/**
 * Hồ sơ một học sinh dưới quyền QUẢN TRỊ VIÊN.
 *
 * Xem là chính: thông tin tài khoản, mọi bài đã giao — **kể cả bài em chưa làm hay đã bỏ lỡ**, để em nghỉ học mà chưa bị gỡ khỏi
 * lớp thì người quản lý vẫn thấy em vắng — điểm của từng bài, và lịch sử thay đổi (khoá, xoá, gỡ khỏi lớp, chuyển lớp) kèm lý do.
 * Bài làm mở ra chỉ để đọc. Thao tác nằm ở cột bên phải và đều bắt buộc lý do.
 */
import { useMemo } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, History, Hourglass, Mail, Phone, UserRound, UsersRound } from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import SlidingSegments from '../../../components/common/SlidingSegments'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import { useAsync } from '../../../hooks/useAsync'
import { usePagination } from '../../../hooks/usePagination'
import { formatDate, formatDateTime, formatGroupNames, formatScore, getInitials, getScoreTone, NO_VALUE } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { DELETION_RETENTION_DAYS, getStudent, listAccountChanges, listStudentExams } from '../../../services/studentService'
import type { Student, AccountChange, AccountChangeKind, StudentExam } from '../../../types'
import { getAvatarTone } from '../../student-groups/components/groupTheme'
import ExamProgressBadge from '../components/ExamProgressBadge'
import StudentAdminActions from '../components/StudentAdminActions'
import StudentStatusPill from '../components/StudentStatusPill'

const PAGE_SIZE = 8

type DetailTab = 'bai' | 'lich-su'

const headerCellClass = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500'
const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'

function parseTab(raw: string | null): DetailTab {
  return raw === 'lich-su' ? 'lich-su' : 'bai'
}

/** Bài hết hạn mà em không vào làm là "bỏ lỡ": bằng chứng em đã vắng, khác với bài hết giờ khi em đang làm. */
function isMissed(exam: StudentExam): boolean {
  return exam.status === 'expired' && exam.attemptId === undefined
}

/** Một dòng ngắn cho khung giờ của em: bỏ năm khi cùng năm hiện tại cho gọn. */
function formatWindow(exam: StudentExam): string {
  return `${formatDateTime(exam.openAt)} – ${formatDateTime(exam.closeAt)}`
}

function ExamsTable({ exams, onOpen, page, onPageChange }: {
  exams: StudentExam[]
  onOpen: (exam: StudentExam) => void
  page: number
  onPageChange: (page: number) => void
}) {
  const { currentPage, pageItems } = usePagination(exams, PAGE_SIZE, page, onPageChange)

  return (
    <>
      <div className={`${cardClass} overflow-hidden animate-fade-in-up`}>
        <TableScroller>
          <table className="stack-table w-full table-fixed text-sm min-w-[720px]">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[27%]" />
              <col className="w-[15%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className={`${headerCellClass} text-left`}>Bài kiểm tra</th>
                <th className={`${headerCellClass} text-left`}>Khung giờ của em</th>
                <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                <th className={`${headerCellClass} text-left`}>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(exam => {
                const graded = exam.status === 'graded' && exam.score !== undefined
                const tone = graded ? getScoreTone(exam.score ?? 0, exam.maxScore ?? null) : null
                const canOpen = exam.attemptId !== undefined

                return (
                  <tr
                    key={exam.assignmentId}
                    onClick={canOpen ? openOnRowClick(() => onOpen(exam)) : undefined}
                    className={`border-b border-slate-50 last:border-b-0 transition-colors ${
                      canOpen ? 'hover:bg-indigo-100/70 cursor-pointer' : ''
                    }`}
                  >
                    <td data-card="head" className="px-4 py-2">
                      <p className="font-semibold text-slate-800 truncate" title={exam.title}>{exam.title}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {[exam.group, exam.teacherName].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td data-label="Khung giờ" className="px-4 py-2 text-xs text-slate-500">{formatWindow(exam)}</td>
                    <td data-label="Trạng thái" className="px-4 py-2">
                      <ExamProgressBadge status={exam.status} attemptId={exam.attemptId} />
                    </td>
                    <td data-card="foot" className="px-4 py-2">
                      {graded ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-lg font-bold ${tone ? `${tone.bg} ${tone.color}` : ''}`}
                          >
                            {formatScore(exam.score)}
                            {exam.maxScore !== undefined && (
                              <span className="text-xs font-medium text-slate-400">&nbsp;/ {formatScore(exam.maxScore)}</span>
                            )}
                          </span>
                          {exam.correctCount !== undefined && (
                            <span className="text-xs text-slate-400 whitespace-nowrap">{exam.correctCount} câu đúng</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          {exam.status === 'inprogress' ? 'Đang làm' : exam.status === 'submitted' ? 'Chờ chấm' : NO_VALUE}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroller>
      </div>

      <Pagination page={currentPage} pageSize={PAGE_SIZE} total={exams.length} onPageChange={onPageChange} />
    </>
  )
}

const changeTitle: Record<AccountChangeKind, (change: AccountChange) => string> = {
  locked: () => 'Khoá tài khoản',
  unlocked: () => 'Mở khoá tài khoản',
  deletionRequested: () => 'Yêu cầu xoá tài khoản',
  restored: () => 'Khôi phục tài khoản',
  addedToGroup: change => `Xếp vào lớp ${change.toGroup ?? ''}`.trim(),
  removedFromGroup: change => `Gỡ khỏi lớp ${change.fromGroup ?? ''}`.trim(),
  movedGroup: change => `Chuyển lớp ${change.fromGroup ?? '?'} → ${change.toGroup ?? '?'}`,
}

function HistoryList({ changes }: { changes: AccountChange[] }) {
  if (changes.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Chưa có thay đổi nào"
        description="Khoá tài khoản, xoá tài khoản, gỡ khỏi lớp và chuyển lớp đều được ghi lại ở đây, kèm lý do và người thực hiện."
      />
    )
  }

  return (
    <ol className={`${cardClass} divide-y divide-slate-50 animate-fade-in-up`}>
      {changes.map(change => (
        <li key={change.id} className="px-5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-sm font-semibold text-slate-800">{changeTitle[change.kind](change)}</p>
            <p className="text-xs text-slate-400 whitespace-nowrap">
              {formatDateTime(change.createdAt)}
              {change.actorName ? ` · ${change.actorName}` : ''}
            </p>
          </div>
          {change.reason && (
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              <span className="text-slate-400">Lý do:</span> {change.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

export default function AdminStudentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const studentId = Number(id)
  const isValidId = Number.isInteger(studentId) && studentId > 0

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const page = Math.max(1, Math.floor(Number(searchParams.get('trang')) || 1))
  const setTab = (next: DetailTab) => {
    setSearchParams(
      current => {
        const nextParams = new URLSearchParams(current)
        if (next === 'bai') nextParams.delete('tab')
        else nextParams.set('tab', next)
        nextParams.delete('trang')
        return nextParams
      },
      { replace: true },
    )
  }
  const setPage = (next: number) => {
    setSearchParams(
      current => {
        const nextParams = new URLSearchParams(current)
        if (next <= 1) nextParams.delete('trang')
        else nextParams.set('trang', String(next))
        return nextParams
      },
      { replace: true },
    )
  }

  const {
    data: student, loading: studentLoading, error: studentError, reload: reloadStudent,
  } = useAsync(
    () =>
      isValidId
        ? getStudent(studentId)
        : Promise.reject<Student>(new Error('Đường dẫn học sinh không hợp lệ.')),
    [studentId],
  )
  const { data: exams, loading: examsLoading, error: examsError, reload: reloadExams } = useAsync(
    () => (isValidId ? listStudentExams(studentId) : Promise.resolve([] as StudentExam[])),
    [studentId],
  )
  const { data: changes, error: changesError, reload: reloadChanges } = useAsync(
    () => (isValidId ? listAccountChanges(studentId) : Promise.resolve([] as AccountChange[])),
    [studentId],
  )

  const reloadAll = () => {
    reloadStudent()
    reloadExams()
    reloadChanges()
  }

  const missedCount = useMemo(() => (exams ?? []).filter(isMissed).length, [exams])
  const pendingCount = useMemo(() => (exams ?? []).filter(exam => exam.status === 'assigned').length, [exams])

  const isErased = student?.status === 'deleted'
  const tone = getAvatarTone(studentId)
  // Chỉ khi em học đúng một lớp thì "quay lại" mới biết quay về lớp nào; nhiều lớp thì về danh sách học sinh.
  const onlyGroup = student?.groups.length === 1 ? student.groups[0] : null
  const classLink = onlyGroup ? `/quan-tri/nhom-lop/${onlyGroup.id}` : null

  const subtitle = student
    ? [isErased ? '' : student.code, formatGroupNames(student.groups, 'Chưa có lớp', 3)].filter(Boolean).join(' · ')
    : 'Hồ sơ, bài đã giao và lịch sử thay đổi của học sinh'

  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to={classLink ?? '/quan-tri/hoc-sinh'}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} /> {onlyGroup ? `Quay lại ${onlyGroup.name}` : 'Quay lại danh sách học sinh'}
      </NavLink>
    </div>
  )

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'bai', label: `Bài đã giao${exams ? ` (${exams.length})` : ''}` },
    { id: 'lich-su', label: `Lịch sử thay đổi${changes ? ` (${changes.length})` : ''}` },
  ]

  return (
    <AdminLayout
      pageTitle={student?.fullName ?? 'Hồ sơ học sinh'}
      pageSubtitle={subtitle}
      compactContent
      headerTools={backLink}
    >
      {studentError ? (
        <ErrorState message={studentError} onRetry={reloadStudent} />
      ) : (
        <div className="stagger-in grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          {/* Cột thông tin đứng trước trong DOM để dưới cỡ xl nó nằm trên đầu; từ xl nó dời sang bên phải. */}
          <aside className="space-y-4 xl:order-2 xl:sticky xl:top-6">
            {studentLoading && !student ? (
              <div className={`${cardClass} p-5 space-y-3`}>
                <SkeletonBlock className="h-14 w-14 rounded-2xl" />
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-3 w-full" />
                <SkeletonBlock className="h-3 w-4/5" />
              </div>
            ) : student ? (
              <>
                <div className={`${cardClass} p-5 animate-fade-in-up`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${tone.bg} ${tone.text}`}
                    >
                      {getInitials(student.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{student.fullName}</p>
                      <div className="mt-1.5">
                        <StudentStatusPill status={student.status} deletionScheduledAt={student.deletionScheduledAt} />
                      </div>
                    </div>
                  </div>

                  {student.status === 'pendingDeletion' && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed">
                      Chờ xoá: em không đăng nhập được. Khôi phục được{' '}
                      {student.deletionScheduledAt
                        ? `tới ${formatDateTime(student.deletionScheduledAt)}`
                        : `trong ${DELETION_RETENTION_DAYS} ngày`}
                      .{student.deletionReason ? ` Lý do xoá: ${student.deletionReason}` : ''}
                    </p>
                  )}
                  {isErased && (
                    <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                      Dữ liệu cá nhân đã bị xoá vĩnh viễn; kết quả các bài đã làm vẫn được giữ.
                    </p>
                  )}

                  {!isErased && (
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500 inline-flex items-center gap-1.5"><UsersRound size={13} /> Lớp</dt>
                        <dd className="font-semibold text-slate-700 text-right min-w-0">
                          {student.groups.length === 0
                            ? 'Chưa có lớp'
                            : student.groups.map((group, index) => (
                              <span key={group.id}>
                                {index > 0 && ', '}
                                <NavLink to={`/quan-tri/nhom-lop/${group.id}`} className="hover:text-indigo-600 hover:underline">
                                  {group.name}
                                </NavLink>
                              </span>
                            ))}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500 inline-flex items-center gap-1.5"><Mail size={13} /> Email</dt>
                        <dd className="font-semibold text-slate-700 truncate" title={student.email}>{student.email}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500 inline-flex items-center gap-1.5"><Phone size={13} /> Điện thoại</dt>
                        <dd className="font-semibold text-slate-700">{student.phone || NO_VALUE}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500 inline-flex items-center gap-1.5"><UserRound size={13} /> Tên đăng nhập</dt>
                        <dd className="font-semibold text-slate-700 truncate">{student.username}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Ngày tạo</dt>
                        <dd className="font-semibold text-slate-700">{formatDate(student.createdAt)}</dd>
                      </div>
                    </dl>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-50 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className={`text-lg font-bold leading-none ${student.assignedExams > 0 ? getScoreTone(student.averageScore).color : 'text-slate-300'}`}>
                        {student.assignedExams > 0 ? formatScore(student.averageScore) : NO_VALUE}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">Điểm TB</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold leading-none text-slate-700">{student.completedExams}</p>
                      <p className="mt-1 text-[11px] text-slate-400">Bài đã nộp</p>
                    </div>
                    <div>
                      <p className={`text-lg font-bold leading-none ${missedCount > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                        {missedCount}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">Bỏ lỡ</p>
                    </div>
                  </div>
                </div>

                <div className={`${cardClass} p-3 animate-fade-in-up`}>
                  <p className="px-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Thao tác</p>
                  <StudentAdminActions student={student} onChanged={reloadAll} />
                </div>
              </>
            ) : null}
          </aside>

          <section className="min-w-0 xl:order-1">
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

              {tab === 'bai' && exams && exams.length > 0 && (
                <p className="text-xs text-slate-400 inline-flex items-center gap-1.5">
                  <Hourglass size={13} /> {pendingCount} chưa làm · {missedCount} bỏ lỡ
                </p>
              )}
            </div>

            {tab === 'bai' && (
              <>
                {examsLoading && exams === undefined && <SkeletonTable rows={6} cols={4} />}
                {examsError && <ErrorState message={examsError} onRetry={reloadExams} />}
                {exams && exams.length === 0 && (
                  <EmptyState
                    icon={ClipboardList}
                    title="Chưa có bài nào được giao cho em"
                    description="Khi giáo viên giao bài cho lớp của em, bài sẽ hiện ở đây — kể cả khi em chưa làm hay đã bỏ lỡ."
                  />
                )}
                {exams && exams.length > 0 && (
                  <ExamsTable
                    exams={exams}
                    page={page}
                    onPageChange={setPage}
                    onOpen={exam => navigate(`/quan-tri/ket-qua/${exam.attemptId}`)}
                  />
                )}
              </>
            )}

            {tab === 'lich-su' && (
              <>
                {changesError && <ErrorState message={changesError} onRetry={reloadChanges} />}
                {changes && <HistoryList changes={changes} />}
              </>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  )
}
