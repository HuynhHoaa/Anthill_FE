/**
 * Trang chi tiết học sinh dành cho GIÁO VIÊN — chỉ đọc.
 * Tài khoản học sinh (tạo, sửa, khoá/mở) thuộc quyền quản trị viên, không có ở đây.
 */
import { useMemo, type ReactNode } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ClipboardList, Eye, Hash, Mail, UsersRound } from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { StatusBadge } from '../../../components/common/Badge'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import {
  formatDate, formatDateTime, formatGroupNames, formatScore, getInitials, getScoreTone, NO_VALUE,
  STANDARD_SCORE,
} from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { DELETION_RETENTION_DAYS, getStudent } from '../../../services/studentService'
import { listResults } from '../../../services/resultService'
import StudentStatusPill from '../components/StudentStatusPill'
import { getAvatarTone } from '../../student-groups/components/groupTheme'
import type { Paged, ResultSummary, Student } from '../../../types'

/** Lịch sử làm bài nhiều nhất khoảng 6 dòng nên tải một lần, không phân trang. */
const HISTORY_PAGE_SIZE = 50

const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'
const chipClass =
  'inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg'
const groupListLink = '/giao-vien/nhom-lop'

export default function StudentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const studentId = Number(id)
  const isValidId = Number.isInteger(studentId) && studentId > 0

  const {
    data: student, loading: studentLoading, error: studentError, reload: reloadStudent,
  } = useAsync(
    () =>
      isValidId
        ? getStudent(studentId)
        : Promise.reject<Student>(new Error('Đường dẫn học sinh không hợp lệ.')),
    [studentId],
  )

  const {
    data: results, loading: resultsLoading, error: resultsError, reload: reloadResults,
  } = useAsync(
    () =>
      isValidId
        ? listResults({ studentId, page: 1, pageSize: HISTORY_PAGE_SIZE })
        : Promise.reject<Paged<ResultSummary>>(new Error('Đường dẫn học sinh không hợp lệ.')),
    [studentId],
  )

  const historyItems = useMemo(() => results?.items ?? [], [results])

  // Điểm trung bình do server tính trên mọi bài đã giao cho em, bài chưa làm tính 0 điểm (giống bảng điểm xuất ra Excel). Bảng lịch sử
  // bên dưới chỉ liệt kê những bài em đã bắt đầu làm nên không đủ để tự cộng ra con số này.
  const averageScore = student && student.assignedExams > 0 ? student.averageScore : null

  const summaryText = useMemo(() => {
    if (!student) return null
    // Tài khoản đã xoá mang mã giữ chỗ kiểu "deleted-12" — không phải thứ để hiện cho người đọc.
    const groupText = formatGroupNames(student.groups, 'Chưa có lớp', 3)
    const parts = student.status === 'deleted'
      ? [student.fullName, groupText]
      : [student.fullName, student.code, groupText]
    return parts.join(' · ')
  }, [student])

  // Server chỉ gửi những lớp giáo viên này dạy (hồ sơ còn mở được với em đã rời lớp vì em từng nhận đề của giáo viên, khi
  // đó em không còn lớp nào của mình). Lối quay lại suy từ chính học sinh: đúng một lớp thì về lớp đó, không thì về danh sách.
  const onlyGroup = student?.groups.length === 1 ? student.groups[0] : null
  const backTo = onlyGroup ? `${groupListLink}/${onlyGroup.id}` : groupListLink
  const backLabel = onlyGroup ? `Quay lại nhóm ${onlyGroup.name}` : 'Quay lại danh sách nhóm'

  const avatarTone = getAvatarTone(studentId)
  const isErased = student?.status === 'deleted'
  const showProfileSkeleton = studentLoading && student === undefined
  const showResultsSkeleton = resultsLoading && results === undefined

  /** Điểm trung bình phụ thuộc lịch sử làm bài nên có khung xương và lối thoát riêng. */
  const renderResultStat = (content: ReactNode): ReactNode => {
    if (showResultsSkeleton) return <SkeletonBlock className="h-6 w-20" />
    if (resultsError) return <span className="text-sm font-semibold text-slate-400">Chưa tải được</span>
    return content
  }

  const renderHistory = () => {
    if (showResultsSkeleton) return <SkeletonTable rows={5} cols={6} />

    if (resultsError) return <ErrorState message={resultsError} onRetry={reloadResults} />

    if (historyItems.length === 0) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="Học sinh chưa làm bài kiểm tra nào"
          description={`${student ? student.fullName : 'Học sinh này'} chưa nộp bài nào. Khi em nộp bài, kết quả sẽ tự động xuất hiện tại đây.`}
          action={
            <NavLink
              to="/giao-vien/bai-kiem-tra"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              Tới danh sách bài kiểm tra
            </NavLink>
          }
        />
      )
    }

    return (
      <div
        className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity ${
          resultsLoading ? 'opacity-60' : 'opacity-100'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="stack-table w-full text-sm min-w-[880px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className={`${headerCellClass} text-left`}>Bài kiểm tra</th>
                <th className={`${headerCellClass} text-left`}>Ngày nộp</th>
                <th className={`${headerCellClass} text-left`}>Điểm</th>
                <th className={`${headerCellClass} text-left`}>Số câu đúng</th>
                <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                <th className={`${headerCellClass} text-right`}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {historyItems.map(result => {
                // Chưa được phép xem điểm thì cũng chưa có xếp loại nào để tô màu.
                const scoreTone = result.score === null ? null : getScoreTone(result.score, result.maxScore)
                const isGraded = result.status === 'graded'
                const isInProgress = result.status === 'inprogress'

                return (
                  <tr
                    key={result.attemptId}
                    onClick={openOnRowClick(() => navigate(`/giao-vien/ket-qua/${result.attemptId}`))}
                    className="border-b border-slate-50 hover:bg-indigo-100/70 transition-colors last:border-b-0 cursor-pointer"
                  >
                    <td data-card="head" className="px-5 py-4">
                      <NavLink
                        to={`/giao-vien/bai-kiem-tra/${result.examId}`}
                        title="Mở chi tiết bài kiểm tra"
                        className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline transition-colors"
                      >
                        {result.examTitle}
                      </NavLink>
                    </td>
                    <td data-label="Ngày nộp" className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      {isInProgress ? NO_VALUE : formatDateTime(result.submittedAt)}
                    </td>
                    <td data-label="Điểm" className="px-5 py-4">
                      {isGraded ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold ${scoreTone ? `${scoreTone.bg} ${scoreTone.color}` : 'bg-slate-50 text-slate-400'}`}
                        >
                          {formatScore(result.score)}
                          {result.maxScore !== null && (
                            <span className="text-xs font-medium text-slate-400">
                              &nbsp;/ {formatScore(result.maxScore)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-400">
                          {isInProgress ? 'Đang làm' : 'Chờ chấm'}
                        </span>
                      )}
                    </td>
                    <td data-label="Số câu đúng" className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      {result.correctCount === null
                        ? NO_VALUE
                        : `${result.correctCount}/${result.totalQuestions} câu`}
                    </td>
                    <td data-label="Trạng thái" className="px-5 py-4">
                      <StatusBadge status={result.status} />
                    </td>
                    <td data-card="foot" className="px-5 py-4 text-right">
                      <NavLink
                        to={`/giao-vien/ket-qua/${result.attemptId}`}
                        title={`Xem chi tiết bài làm ${result.examTitle}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                      >
                        <Eye size={14} /> Xem chi tiết
                      </NavLink>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Nút quay lại nằm trên thanh tiêu đề (hẹp hơn thì đứng đầu nội dung), không chiếm một hàng riêng trong trang.
  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to={backTo}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} /> {backLabel}
      </NavLink>
    </div>
  )

  return (
    <TeacherLayout
      pageTitle="Chi tiết học sinh"
      pageSubtitle={summaryText ?? 'Xem hồ sơ và lịch sử làm bài của học sinh'}
      compactContent
      headerTools={backLink}
    >

      {showProfileSkeleton && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <SkeletonBlock className="h-16 w-16 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <SkeletonBlock className="h-5 w-52" />
              <SkeletonBlock className="h-3.5 w-32" />
              <SkeletonBlock className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      )}

      {!showProfileSkeleton && studentError && (
        <ErrorState message={studentError} onRetry={reloadStudent} />
      )}

      {student && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up">
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${avatarTone.bg} ${avatarTone.text}`}
                >
                  {getInitials(student.fullName)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl font-bold text-slate-800">{student.fullName}</h1>
                    <StudentStatusPill status={student.status} deletionScheduledAt={student.deletionScheduledAt} />
                  </div>
                  {!isErased && <p className="text-sm text-slate-400 mt-1">@{student.username}</p>}

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {/* Tên đăng nhập, email và mã của tài khoản đã xoá đều là chuỗi giữ chỗ do server
                        thay vào — hiện ra như dữ liệu thật là đánh lừa người xem. */}
                    {!isErased && (
                      <>
                        <span className={chipClass}>
                          <Hash size={13} /> {student.code}
                        </span>
                        <span className={chipClass}>
                          <Mail size={13} /> {student.email}
                        </span>
                      </>
                    )}
                    {student.groups.length > 0 ? (
                      student.groups.map(group => (
                        <NavLink
                          key={group.id}
                          to={`${groupListLink}/${group.id}`}
                          title={`Mở nhóm ${group.name}`}
                          className={`${chipClass} hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-colors`}
                        >
                          <UsersRound size={13} /> {group.name}
                        </NavLink>
                      ))
                    ) : (
                      <span className={chipClass}>
                        <UsersRound size={13} /> Không còn trong lớp nào của bạn
                      </span>
                    )}
                    <span className={chipClass}>
                      <CalendarDays size={13} /> Tạo ngày {formatDate(student.createdAt)}
                    </span>
                  </div>

                  {isErased && (
                    <p className="text-sm text-slate-500 mt-4 leading-relaxed">
                      Dữ liệu cá nhân của học sinh này đã được xoá khỏi hệ thống. Kết quả các bài em đã làm vẫn
                      được giữ lại bên dưới.
                    </p>
                  )}
                  {student.status === 'pendingDeletion' && (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 leading-relaxed">
                      Tài khoản đang chờ xoá: em không đăng nhập được và không nhận bài mới. Quản trị viên vẫn
                      khôi phục được{' '}
                      {student.deletionScheduledAt
                        ? `tới ${formatDateTime(student.deletionScheduledAt)}`
                        : `trong ${DELETION_RETENTION_DAYS} ngày kể từ ngày yêu cầu xoá`}
                      .
                    </p>
                  )}

                </div>
              </div>
              <div className="flex-shrink-0 sm:text-right">
                <p className="text-xs font-medium text-slate-500">Điểm trung bình</p>
                <div className="mt-2 min-h-[28px] flex items-center sm:justify-end">
                  {renderResultStat(
                    averageScore === null ? (
                      <p className="text-lg font-bold text-slate-400 leading-none">Chưa có</p>
                    ) : (
                      <p className={`text-3xl font-bold leading-none ${getScoreTone(averageScore).color}`}>
                        {formatScore(averageScore)}
                        <span className="text-sm font-semibold text-slate-400"> /{STANDARD_SCORE}</span>
                      </p>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lịch sử tải độc lập với hồ sơ, nhưng hồ sơ lỗi thì không còn học sinh nào để kể lịch sử. */}
      {!studentError && (
        <>
          <div className="mt-8 mb-4">
            <h2 className="text-base font-bold text-slate-800">
              Lịch sử làm bài
              {results && <span className="text-slate-400 font-semibold"> ({results.total})</span>}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Gồm cả bài em đang làm dở. Bấm Xem chi tiết để mở từng câu trả lời của học sinh.
            </p>
          </div>

          {renderHistory()}
        </>
      )}
    </TeacherLayout>
  )
}
