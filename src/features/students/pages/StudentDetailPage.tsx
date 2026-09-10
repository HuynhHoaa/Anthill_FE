/**
 * Trang chi tiết học sinh dành cho GIÁO VIÊN — chỉ đọc.
 * Tài khoản học sinh (tạo, sửa, khoá/mở) thuộc quyền quản trị viên, không có ở đây.
 */
import { useMemo, type ReactNode } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  ArrowLeft, Award, CalendarDays, ClipboardList, Eye, Hash, Lock, Mail, ShieldCheck, UsersRound,
  type LucideIcon,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { StatusBadge } from '../../../components/common/Badge'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import {
  formatDate, formatDateTime, formatScore, getInitials, getScoreTone, NO_VALUE, roundToOneDecimal,
} from '../../../lib/format'
import { getStudent } from '../../../services/studentService'
import { listResults } from '../../../services/resultService'
import StudentStatusPill from '../components/StudentStatusPill'
import { getAvatarTone } from '../../student-groups/components/groupTheme'
import type { Paged, ResultSummary, Student } from '../../../types'

/** Lịch sử làm bài nhiều nhất khoảng 6 dòng nên tải một lần, không phân trang. */
const HISTORY_PAGE_SIZE = 50

const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'
const chipClass =
  'inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg'
const statValueClass = 'text-2xl font-bold text-slate-800 leading-none'
const groupListLink = '/giao-vien/nhom-lop'

interface StatTileProps {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  label: string
  children: ReactNode
}

function StatTile({ icon: Icon, iconBg, iconColor, label, children }: StatTileProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${iconBg}`}>
        <Icon size={17} className={iconColor} />
      </div>
      <div className="min-h-[28px] flex items-center">{children}</div>
      <p className="text-xs text-slate-500 mt-1.5">{label}</p>
    </div>
  )
}

export default function StudentDetailPage() {
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

  // Số liệu lấy từ chính bảng lịch sử bên dưới, không lấy từ hai trường tĩnh của học sinh,
  // để ô số liệu không bao giờ mâu thuẫn với số dòng đang hiển thị.
  const averageScore = useMemo(() => {
    // Bài đã chấm nhưng bị giấu điểm không mang con số nào; tính chúng như 0 sẽ kéo trung bình
    // xuống mà giáo viên không thấy dấu hiệu gì trên bảng bên dưới.
    const visibleScores = historyItems
      .filter(result => result.status === 'graded')
      .map(result => result.score)
      .filter((score): score is number => score !== null)

    if (visibleScores.length === 0) return null
    return roundToOneDecimal(
      visibleScores.reduce((total, score) => total + score, 0) / visibleScores.length,
    )
  }, [historyItems])

  const summaryText = useMemo(() => {
    if (!student) return null
    const parts = [student.fullName, student.code, student.group]
    return parts.join(' · ')
  }, [student])

  // Lối quay lại suy từ chính học sinh, nên học sinh chưa phân nhóm vẫn có đường về hợp lệ.
  const backTo =
    student && student.groupId > 0 ? `${groupListLink}/${student.groupId}` : groupListLink
  const backLabel =
    student && student.groupId > 0 ? `Quay lại nhóm ${student.group}` : 'Quay lại danh sách nhóm'

  const avatarTone = getAvatarTone(studentId)
  const showProfileSkeleton = studentLoading && student === undefined
  const showResultsSkeleton = resultsLoading && results === undefined

  /** Hai ô số liệu phụ thuộc lịch sử làm bài nên có khung xương và lối thoát riêng. */
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
          <table className="w-full text-sm min-w-[880px]">
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
                const scoreTone = result.score === null ? null : getScoreTone(result.score)
                const isGraded = result.status === 'graded'

                return (
                  <tr
                    key={result.attemptId}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <NavLink
                        to={`/giao-vien/bai-kiem-tra/${result.examId}`}
                        title="Mở chi tiết bài kiểm tra"
                        className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline transition-colors"
                      >
                        {result.examTitle}
                      </NavLink>
                    </td>
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      {formatDateTime(result.submittedAt)}
                    </td>
                    <td className="px-5 py-4">
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
                        <span className="text-sm font-semibold text-slate-400">Chờ chấm</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      {result.correctCount === null
                        ? NO_VALUE
                        : `${result.correctCount}/${result.totalQuestions} câu`}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={result.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
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

  return (
    <TeacherLayout
      pageTitle="Chi tiết học sinh"
      pageSubtitle={summaryText ?? 'Xem hồ sơ và lịch sử làm bài của học sinh'}
    >
      <NavLink
        to={backTo}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4"
      >
        <ArrowLeft size={15} /> {backLabel}
      </NavLink>

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
        <div>
          <ErrorState message={studentError} onRetry={reloadStudent} />
          <div className="mt-4 flex justify-center">
            <NavLink
              to={groupListLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <ArrowLeft size={15} /> Quay lại danh sách nhóm
            </NavLink>
          </div>
        </div>
      )}

      {student && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${avatarTone.bg} ${avatarTone.text}`}
              >
                {getInitials(student.fullName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold text-slate-800">{student.fullName}</h1>
                  <StudentStatusPill status={student.status} />
                </div>
                <p className="text-sm text-slate-400 mt-1">@{student.username}</p>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span className={chipClass}>
                    <Hash size={13} /> {student.code}
                  </span>
                  <span className={chipClass}>
                    <Mail size={13} /> {student.email}
                  </span>
                  {student.groupId > 0 ? (
                    <NavLink
                      to={`${groupListLink}/${student.groupId}`}
                      title={`Mở nhóm ${student.group}`}
                      className={`${chipClass} hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-colors`}
                    >
                      <UsersRound size={13} /> {student.group}
                    </NavLink>
                  ) : (
                    <span className={chipClass}>
                      <UsersRound size={13} /> {student.group}
                    </span>
                  )}
                  <span className={chipClass}>
                    <CalendarDays size={13} /> Tạo ngày {formatDate(student.createdAt)}
                  </span>
                </div>

                <p className="inline-flex items-center gap-1.5 text-xs text-slate-400 mt-4">
                  <Lock size={12} /> Thông tin tài khoản do quản trị viên quản lý.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <StatTile
              icon={ShieldCheck}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
              label="Trạng thái tài khoản"
            >
              <StudentStatusPill status={student.status} />
            </StatTile>

            <StatTile
              icon={ClipboardList}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              label="Số bài đã làm"
            >
              {renderResultStat(<p className={statValueClass}>{results?.total ?? 0}</p>)}
            </StatTile>

            <StatTile
              icon={Award}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              label="Điểm trung bình"
            >
              {renderResultStat(
                averageScore === null ? (
                  <p className="text-lg font-bold text-slate-400 leading-none">Chưa có</p>
                ) : (
                  <p className={`text-2xl font-bold leading-none ${getScoreTone(averageScore).color}`}>
                    {formatScore(averageScore)}
                  </p>
                ),
              )}
            </StatTile>
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
              Chỉ những bài đã nộp mới có mặt ở đây. Bấm Xem chi tiết để mở từng câu trả lời của học sinh.
            </p>
          </div>

          {renderHistory()}
        </>
      )}
    </TeacherLayout>
  )
}
