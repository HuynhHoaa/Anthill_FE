import { useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Award, BarChart3, CalendarClock, CheckCircle2, Clock, Copy, Eye, FileText,
  Hourglass, Layers, Lock, Pencil, RefreshCw, Search, Send, Shuffle, Target, Trash2, UserX, Users,
  XCircle, type LucideIcon,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import { LifecycleBadge, StatusBadge, TopicBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import {
  deleteExam, duplicateExam, getExam, listExamAssignments, previewBlueprint, rescheduleAssignment,
  revokeAssignment,
} from '../../../services/examService'
import {
  formatDate, formatDateTime, formatDuration, formatScore, getScoreTone, normalizeText,
  roundToOneDecimal,
} from '../../../lib/format'
import { getTopicLabel } from '../../../lib/topicTheme'
import { difficultyLabels, examStatusLabels } from '../../../types'
import type { DifficultyLevel, Exam, ExamAssignment, ExamStatus } from '../../../types'
import {
  examDeleteConfirmCopy, examDuplicateConfirmCopy, examRevokeAssignmentConfirmCopy,
} from '../utils/examConfirmations'
import AssignmentWindowList from '../components/AssignmentWindowList'
import RescheduleAssignmentDialog from '../components/RescheduleAssignmentDialog'
import StudentStatusPill from '../../students/components/StudentStatusPill'

const ROWS_PER_PAGE = 10

const primaryGradient = 'linear-gradient(135deg,#6366F1,#8B5CF6)'

type StatusFilter = 'all' | ExamStatus

interface ProgressTile {
  key: StatusFilter
  label: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  activeRing: string
}

const progressTiles: ProgressTile[] = [
  { key: 'all', label: 'Tất cả học sinh', icon: Users, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', activeRing: 'border-indigo-300 ring-4 ring-indigo-50' },
  { key: 'assigned', label: 'Chưa bắt đầu', icon: Send, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', activeRing: 'border-blue-300 ring-4 ring-blue-50' },
  { key: 'inprogress', label: examStatusLabels.inprogress, icon: Hourglass, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', activeRing: 'border-amber-300 ring-4 ring-amber-50' },
  { key: 'submitted', label: 'Chờ chấm', icon: CheckCircle2, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', activeRing: 'border-purple-300 ring-4 ring-purple-50' },
  { key: 'graded', label: examStatusLabels.graded, icon: Award, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', activeRing: 'border-emerald-300 ring-4 ring-emerald-50' },
  { key: 'expired', label: examStatusLabels.expired, icon: XCircle, iconBg: 'bg-slate-100', iconColor: 'text-slate-500', activeRing: 'border-slate-300 ring-4 ring-slate-100' },
]

const difficultyRows: Array<{ level: DifficultyLevel; barColor: string; textColor: string; bgColor: string }> = [
  { level: 'easy', barColor: '#10B981', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  { level: 'medium', barColor: '#F59E0B', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
  { level: 'hard', barColor: '#EF4444', textColor: 'text-red-600', bgColor: 'bg-red-50' },
]

const cellClass = 'px-5 py-3.5'
const headerCellClass = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-700 text-right">{value}</span>
    </div>
  )
}

function DetailSkeleton() {
  const tileKeys = Array.from({ length: 6 }, (_, index) => index)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {tileKeys.map(tileKey => (
            <SkeletonBlock key={tileKey} className="h-24 rounded-2xl" />
          ))}
        </div>
        <SkeletonTable rows={6} cols={8} />
      </div>
      <div className="space-y-4">
        <SkeletonBlock className="h-60 rounded-2xl" />
        <SkeletonBlock className="h-64 rounded-2xl" />
        <SkeletonBlock className="h-40 rounded-2xl" />
      </div>
    </div>
  )
}

/** Nhãn thay cho nút "Xem bài làm" khi lượt làm bài chưa tồn tại hoặc chưa nộp. */
function describeMissingAttempt(status: ExamStatus): string {
  if (status === 'assigned') return 'Chưa bắt đầu'
  if (status === 'inprogress') return 'Đang làm bài'
  if (status === 'expired') return 'Không nộp bài'
  return 'Chưa có bài làm'
}

interface AssignmentRowProps {
  assignment: ExamAssignment
  onReschedule: (assignment: ExamAssignment) => void
  onRevoke: (assignment: ExamAssignment) => void
}

function AssignmentRow({ assignment, onReschedule, onRevoke }: AssignmentRowProps) {
  const canViewAttempt =
    assignment.attemptId !== undefined &&
    (assignment.status === 'submitted' || assignment.status === 'graded')
  const scoreTone = assignment.score === undefined ? undefined : getScoreTone(assignment.score)

  // Chỉ em được chọn đích danh mới dời giờ riêng được, và chỉ khi em chưa bắt đầu: giờ của em theo
  // lớp thuộc về cả lớp, còn em đã vào thi thì hạn nộp đã chốt. Cùng hai điều kiện server dùng — server
  // xét "chưa có Attempt", không phải "còn ở trạng thái assigned", nên em đã hết hạn mà chưa từng vào thi
  // (status 'expired') vẫn dời được: đó chính là cách cứu một em đã lỡ khung giờ.
  const canReschedule = assignment.assignedViaGroupId === undefined && assignment.attemptId === undefined

  // Cùng lý do và cùng câu chữ server dùng khi từ chối (409) — hiện nút ở dạng mờ kèm lý do thay vì ẩn
  // hẳn, để giáo viên không phải tự đoán "ủa sao em này không dời được, có phải lỗi không?".
  const rescheduleBlockedReason =
    assignment.assignedViaGroupId !== undefined
      ? `Em được giao bài qua lớp ${assignment.group}, nên làm bài theo khung giờ của cả lớp. Hãy đổi khung giờ của lớp ở trang giao bài.`
      : assignment.attemptId !== undefined
        ? 'Em đã bắt đầu làm bài nên hạn nộp đã chốt lúc vào thi, không dời giờ được nữa.'
        : undefined

  // Thu hồi thì rộng hơn dời giờ một bước: server (RevokeAsync) chỉ chặn khi em đã có Attempt, không
  // quan tâm em được giao đích danh hay qua cả lớp — thu hồi một dòng trong bảng này không đụng tới
  // các bạn cùng lớp khác.
  const canRevoke = assignment.attemptId === undefined

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className={`${cellClass} font-semibold text-slate-800 whitespace-nowrap`}>
        <span className="inline-flex items-center gap-2">
          {assignment.studentName}
          {/* Dòng của em đã bị xoá tài khoản vẫn ở lại cùng bài và điểm; không có nhãn thì một em chờ xoá
              trông y hệt em "chưa bắt đầu", và giáo viên đi nhắc một người không còn học. */}
          {assignment.studentStatus !== 'active' && <StudentStatusPill status={assignment.studentStatus} />}
        </span>
      </td>
      {/* Tài khoản đã xoá không có mã thật (service đã quy mã giữ chỗ về rỗng). */}
      <td className={`${cellClass} text-slate-500 whitespace-nowrap`}>{assignment.studentCode || '—'}</td>
      <td className={`${cellClass} text-slate-500 whitespace-nowrap`}>{assignment.group}</td>
      <td className={`${cellClass} whitespace-nowrap`}>
        <StatusBadge status={assignment.status} />
      </td>
      <td className={`${cellClass} text-slate-500 whitespace-nowrap`}>
        <span className="block">
          {formatDateTime(assignment.openAt)} – {formatDateTime(assignment.closeAt)}
        </span>
        <span className="text-xs text-slate-400">
          {assignment.hasScheduleOverride ? 'Khung giờ riêng' : 'Theo lịch chung'}
        </span>
      </td>
      <td className={`${cellClass} text-slate-500 whitespace-nowrap`}>
        {assignment.startedAt ? formatDateTime(assignment.startedAt) : '—'}
      </td>
      <td className={`${cellClass} text-slate-500 whitespace-nowrap`}>
        {assignment.submittedAt ? formatDateTime(assignment.submittedAt) : '—'}
      </td>
      <td className={`${cellClass} whitespace-nowrap`}>
        {assignment.score !== undefined && scoreTone ? (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold ${scoreTone.bg} ${scoreTone.color}`}>
            {formatScore(assignment.score)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className={`${cellClass} text-right whitespace-nowrap`}>
        <button
          type="button"
          onClick={() => canReschedule && onReschedule(assignment)}
          disabled={!canReschedule}
          title={canReschedule ? 'Đặt khung giờ riêng cho em này' : rescheduleBlockedReason}
          className={`inline-flex items-center gap-1.5 px-3 py-2 mr-2 rounded-xl text-xs font-semibold transition-colors ${
            canReschedule
              ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
              : 'text-slate-300 bg-slate-50 cursor-not-allowed'
          }`}
        >
          <CalendarClock size={14} /> Dời giờ
        </button>
        <button
          type="button"
          onClick={() => onRevoke(assignment)}
          disabled={!canRevoke}
          title={canRevoke ? 'Gỡ bài kiểm tra này khỏi danh sách của em' : 'Em đã bắt đầu làm bài nên không thu hồi được nữa'}
          className={`inline-flex items-center gap-1.5 px-3 py-2 mr-2 rounded-xl text-xs font-semibold transition-colors ${
            canRevoke
              ? 'text-red-500 bg-red-50 hover:bg-red-100'
              : 'text-slate-300 bg-slate-50 cursor-not-allowed'
          }`}
        >
          <UserX size={14} /> Thu hồi
        </button>
        {canViewAttempt ? (
          <NavLink
            to={`/giao-vien/ket-qua/${assignment.attemptId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Eye size={14} /> Xem bài làm
          </NavLink>
        ) : (
          <span className="text-xs text-slate-400">{describeMissingAttempt(assignment.status)}</span>
        )}
      </td>
    </tr>
  )
}

export default function ExamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const examId = Number(id)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [rescheduling, setRescheduling] = useState<ExamAssignment | null>(null)
  const [rescheduleSaving, setRescheduleSaving] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  const search = useDebouncedValue(searchInput, 300)

  const { data, loading, error, reload } = useAsync(async () => {
    // useParams trả về chuỗi: chặn sớm khi id trên URL không phải số để báo lỗi rõ ràng.
    if (!Number.isFinite(examId)) {
      throw new Error('Mã bài kiểm tra trên đường dẫn không hợp lệ.')
    }
    const exam = await getExam(examId)
    const [assignments, blueprint] = await Promise.all([
      listExamAssignments(exam.id),
      previewBlueprint({
        totalQuestions: exam.totalQuestions,
        easyPercentage: exam.easyPercentage,
        mediumPercentage: exam.mediumPercentage,
        hardPercentage: exam.hardPercentage,
        topic: exam.topic,
      }),
    ])
    return { exam, assignments, blueprint }
  }, [examId])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: 0, assigned: 0, inprogress: 0, submitted: 0, graded: 0, expired: 0,
    }
    const source = data?.assignments ?? []
    source.forEach(assignment => {
      counts[assignment.status] += 1
    })
    counts.all = source.length
    return counts
  }, [data])

  const filteredAssignments = useMemo(() => {
    const source = data?.assignments ?? []
    const normalizedSearch = normalizeText(search)
    return source.filter(assignment => {
      if (statusFilter !== 'all' && assignment.status !== statusFilter) return false
      if (!normalizedSearch) return true
      return [assignment.studentName, assignment.studentCode, assignment.group].some(field =>
        normalizeText(field).includes(normalizedSearch),
      )
    })
  }, [data, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / ROWS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pagedAssignments = filteredAssignments.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  )
  const isFilteringTable = search.trim() !== '' || statusFilter !== 'all'

  const resetTableFilters = () => {
    setSearchInput('')
    setStatusFilter('all')
    setPage(1)
  }

  const handleReschedule = async (window: { openAt?: string; closeAt?: string }) => {
    const target = rescheduling
    if (!target) return

    setRescheduleSaving(true)
    setRescheduleError(null)
    try {
      await rescheduleAssignment(target.examId, target.id, window)
      setRescheduling(null)
      toast.success(`Đã đổi khung giờ làm bài của ${target.studentName}. Em sẽ nhận được thông báo.`)
      // Đọc lại cả trang: khung giờ mới đổi luôn dòng khung giờ theo lớp ở cột bên và có thể đổi cả
      // trạng thái của em, nên vá một dòng trong bộ nhớ sẽ để lại một màn hình nói hai điều khác nhau.
      reload()
    } catch (caught) {
      setRescheduleError(
        caught instanceof Error && caught.message
          ? caught.message
          : 'Không đổi được khung giờ. Vui lòng thử lại.',
      )
    } finally {
      setRescheduleSaving(false)
    }
  }

  // Giao nhầm lớp hay nhầm học sinh là chuyện thường, và trước bản vá này thứ duy nhất giáo viên làm
  // được là xoá cả đề — nặng hơn nhiều so với việc chỉ cần gỡ một dòng. Nút này chỉ hiện được khi em
  // chưa bắt đầu làm (server RevokeAsync cũng từ chối 409 đúng lúc đó), nên hộp xác nhận ở đây không
  // cần nhắc chuyện mất bài làm — chưa có bài làm nào để mất.
  const requestRevoke = async (assignment: ExamAssignment) => {
    if (!data) return
    const revoked = await confirm({
      ...examRevokeAssignmentConfirmCopy(assignment, data.exam.title),
      onConfirm: () => revokeAssignment(assignment.examId, assignment.id),
    })
    if (!revoked) return
    toast.success(`Đã thu hồi bài kiểm tra của ${assignment.studentName}.`)
    reload()
  }

  const handleDelete = async () => {
    if (!data) return
    const target = data.exam
    const deleted = await confirm({
      ...examDeleteConfirmCopy(target, statusCounts.inprogress),
      onConfirm: () => deleteExam(target.id),
    })
    if (!deleted) return
    toast.success(`Đã xoá bài kiểm tra "${target.title}".`)
    navigate('/giao-vien/bai-kiem-tra')
  }

  // Mở luôn trang sửa của bản sao: người ta nhân bản gần như chỉ để đổi cấu hình, nhất là khi đề
  // gốc đã khoá vì có em bắt đầu làm.
  const handleDuplicate = async () => {
    if (!data) return
    const source = data.exam
    const outcome: { copy?: Exam } = {}
    const confirmed = await confirm({
      ...examDuplicateConfirmCopy(source),
      onConfirm: async () => {
        outcome.copy = await duplicateExam(source.id)
      },
    })
    const copy = outcome.copy
    if (!confirmed || !copy) return
    toast.success(`Đã tạo bản sao "${copy.title}". Bản sao đang là bản nháp, chưa giao cho ai.`)
    navigate(`/giao-vien/bai-kiem-tra/${copy.id}/sua`)
  }

  const exam = data?.exam
  const hasSubmission = exam !== undefined && exam.submittedCount > 0
  // Bản nháp chưa giao được cho ai — server từ chối 409. Chặn ngay từ nút bấm để không dẫn giáo viên
  // tới trang giao bài rồi mới báo lỗi, khớp với cách ExamListPage đã chặn nút này.
  const isDraft = exam?.lifecycle === 'draft'
  const submittedRatio =
    exam && exam.assignedCount > 0 ? Math.round((exam.submittedCount / exam.assignedCount) * 100) : 0

  return (
    <TeacherLayout
      pageTitle="Chi tiết bài kiểm tra"
      pageSubtitle={exam ? exam.title : 'Theo dõi ma trận đề và tiến độ làm bài của học sinh'}
    >
      <div className="mb-5">
        <NavLink
          to="/giao-vien/bai-kiem-tra"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại danh sách
        </NavLink>
      </div>

      {loading && !data && <DetailSkeleton />}

      {error && !loading && (
        <div className="space-y-4">
          <ErrorState message={error} onRetry={reload} />
          <div className="flex justify-center">
            <NavLink
              to="/giao-vien/bai-kiem-tra"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <ArrowLeft size={15} /> Quay lại danh sách bài kiểm tra
            </NavLink>
          </div>
        </div>
      )}

      {data && exam && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 animate-fade-in-up">
          <section className="space-y-6 min-w-0">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex flex-col lg:flex-row gap-5 lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <TopicBadge topic={exam.topic} />
                    <LifecycleBadge lifecycle={exam.lifecycle} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 leading-snug">{exam.title}</h2>
                  <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">{exam.description}</p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                      <Clock size={13} /> {formatDuration(exam.durationMinutes)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                      <FileText size={13} /> {exam.totalQuestions} câu
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                      <Target size={13} /> {roundToOneDecimal(exam.totalQuestions * exam.pointPerQuestion)} điểm
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">
                      <CalendarClock size={13} /> Tạo ngày {formatDate(exam.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
                  {isDraft ? (
                    <button
                      type="button"
                      disabled
                      title="Cần xuất bản đề trước khi giao"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-50 cursor-not-allowed"
                    >
                      <Send size={16} /> Giao bài
                    </button>
                  ) : (
                    <NavLink
                      to={`/giao-vien/bai-kiem-tra/${exam.id}/giao-bai`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                      style={{ background: primaryGradient }}
                    >
                      <Send size={16} /> Giao bài
                    </NavLink>
                  )}
                  {hasSubmission ? (
                    <NavLink
                      to={`/giao-vien/ket-qua?bai-kiem-tra=${exam.id}`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      <BarChart3 size={16} /> Xem kết quả
                    </NavLink>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Chưa có học sinh nào nộp bài"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-50 cursor-not-allowed"
                    >
                      <BarChart3 size={16} /> Xem kết quả
                    </button>
                  )}
                  <NavLink
                    to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                  >
                    <Pencil size={16} /> Sửa
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => void handleDuplicate()}
                    title="Tạo một bản nháp mới cùng cấu hình, chưa giao cho ai"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                  >
                    <Copy size={16} /> Nhân bản
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={hasSubmission}
                    title={hasSubmission ? 'Không thể xoá bài đã có học sinh nộp' : undefined}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      hasSubmission ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 size={16} /> Xoá
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-semibold text-slate-600">Tiến độ nộp bài</span>
                  {hasSubmission ? (
                    <NavLink
                      to={`/giao-vien/ket-qua?bai-kiem-tra=${exam.id}`}
                      title="Xem kết quả của bài kiểm tra này"
                      className="font-bold text-slate-700 hover:text-indigo-600 hover:underline transition-colors"
                    >
                      {exam.submittedCount}/{exam.assignedCount} học sinh
                    </NavLink>
                  ) : (
                    <span className="font-bold text-slate-700">
                      {exam.submittedCount}/{exam.assignedCount} học sinh
                    </span>
                  )}
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${submittedRatio}%`, background: primaryGradient }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {exam.assignedCount === 0
                    ? 'Bài kiểm tra chưa được giao cho học sinh nào.'
                    : `Đã có ${submittedRatio}% học sinh nộp bài.`}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h2 className="text-base font-bold text-slate-800">Tiến độ làm bài</h2>
                <p className="text-xs text-slate-400">Bấm vào một ô để lọc nhanh bảng bên dưới</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {progressTiles.map(tile => {
                  const isActive = statusFilter === tile.key
                  const Icon = tile.icon
                  return (
                    <button
                      key={tile.key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setStatusFilter(tile.key)
                        setPage(1)
                      }}
                      className={`bg-white rounded-2xl border shadow-sm p-4 text-left transition-all hover:shadow-md ${
                        isActive ? tile.activeRing : 'border-slate-100'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${tile.iconBg}`}>
                        <Icon size={17} className={tile.iconColor} />
                      </div>
                      <p className="text-2xl font-bold text-slate-800 leading-none">{statusCounts[tile.key]}</p>
                      <p className="text-xs text-slate-500 mt-1.5">{tile.label}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between p-5 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Theo dõi giao bài</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {filteredAssignments.length} học sinh
                    {isFilteringTable ? ' khớp bộ lọc' : ' được giao bài này'}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchInput}
                      onChange={event => {
                        setSearchInput(event.target.value)
                        setPage(1)
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                      placeholder="Tìm học sinh, mã hoặc nhóm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={reload}
                    disabled={loading}
                    aria-label="Làm mới tiến độ làm bài"
                    title="Làm mới tiến độ làm bài"
                    className="w-11 h-11 flex-shrink-0 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 hover:text-indigo-600 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
                  </button>
                </div>
              </div>

              {data.assignments.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Users}
                    title="Chưa giao bài cho học sinh nào"
                    description={
                      isDraft
                        ? 'Bài kiểm tra vẫn đang là bản nháp nên chưa giao được. Xuất bản đề trước, rồi quay lại đây để giao.'
                        : 'Giao bài kiểm tra cho học sinh hoặc nhóm lớp để bắt đầu theo dõi tiến độ làm bài.'
                    }
                    action={
                      isDraft ? (
                        <NavLink
                          to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Pencil size={16} /> Xuất bản đề
                        </NavLink>
                      ) : (
                        <NavLink
                          to={`/giao-vien/bai-kiem-tra/${exam.id}/giao-bai`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                          style={{ background: primaryGradient }}
                        >
                          <Send size={16} /> Giao bài ngay
                        </NavLink>
                      )
                    }
                  />
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Search}
                    title="Không có học sinh nào khớp bộ lọc"
                    description="Thử đổi từ khoá tìm kiếm hoặc chọn lại trạng thái ở dải tiến độ phía trên."
                    action={
                      <button
                        type="button"
                        onClick={resetTableFilters}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        Xoá bộ lọc
                      </button>
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1100px]">
                      <thead className="bg-slate-50/60">
                        <tr>
                          <th className={headerCellClass}>Học sinh</th>
                          <th className={headerCellClass}>Mã học sinh</th>
                          <th className={headerCellClass}>Nhóm lớp</th>
                          <th className={headerCellClass}>Trạng thái</th>
                          <th className={headerCellClass}>Khung giờ làm bài</th>
                          <th className={headerCellClass}>Bắt đầu</th>
                          <th className={headerCellClass}>Nộp lúc</th>
                          <th className={headerCellClass}>Điểm</th>
                          <th className={`${headerCellClass} text-right`}>Bài làm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedAssignments.map(assignment => (
                          <AssignmentRow
                            key={assignment.id}
                            assignment={assignment}
                            onReschedule={setRescheduling}
                            onRevoke={target => void requestRevoke(target)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredAssignments.length > ROWS_PER_PAGE && (
                    <div className="px-5 pb-4">
                      <Pagination
                        page={currentPage}
                        pageSize={ROWS_PER_PAGE}
                        total={filteredAssignments.length}
                        onPageChange={setPage}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <aside className="space-y-4 min-w-0">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={17} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800">Ma trận đề</h2>
              </div>

              <div className="space-y-3">
                {difficultyRows.map(({ level, barColor, textColor, bgColor }) => {
                  const required = data.blueprint.required[level]
                  const available = data.blueprint.available[level]
                  const usageRatio = available > 0 ? Math.min(100, Math.round((required / available) * 100)) : 0
                  const percentage =
                    level === 'easy'
                      ? exam.easyPercentage
                      : level === 'medium'
                        ? exam.mediumPercentage
                        : exam.hardPercentage

                  return (
                    <div key={level} className={`rounded-xl px-4 py-3 ${bgColor}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${textColor}`}>{difficultyLabels[level]}</span>
                        <span className={`text-sm font-bold ${textColor}`}>
                          {required} câu · {percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${usageRatio}%`, background: barColor }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        Ngân hàng có {available} câu đang dùng được
                      </p>
                    </div>
                  )
                })}
              </div>

              {!data.blueprint.isValid && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3.5">
                  <p className="text-xs font-bold text-amber-700 mb-1.5">Ma trận đề chưa hợp lệ</p>
                  <ul className="space-y-1">
                    {data.blueprint.errors.map(message => (
                      <li key={message} className="text-xs text-amber-700 leading-relaxed">
                        · {message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shuffle size={17} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800">Cấu hình đề</h2>
              </div>
              <InfoRow label="Chủ đề" value={getTopicLabel(exam.topic)} />
              <InfoRow label="Số câu" value={`${exam.totalQuestions} câu`} />
              <InfoRow label="Điểm mỗi câu" value={formatScore(exam.pointPerQuestion)} />
              <InfoRow
                label="Tổng điểm"
                value={formatScore(roundToOneDecimal(exam.totalQuestions * exam.pointPerQuestion))}
              />
              <InfoRow label="Trộn câu hỏi" value={exam.shuffleQuestions ? 'Có' : 'Không'} />
              <InfoRow label="Trộn đáp án" value={exam.shuffleAnswers ? 'Có' : 'Không'} />
              <InfoRow label="Hiện kết quả sau khi nộp" value={exam.showResultAfterSubmit ? 'Có' : 'Không'} />
              {exam.blueprintFrozen && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
                  <Lock size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Đã khoá vì {exam.startedCount} học sinh đã bắt đầu làm bài. Muốn đổi cấu hình, hãy nhân bản đề.
                  </span>
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock size={17} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800">Lịch mở bài</h2>
              </div>
              <InfoRow label="Mở bài" value={formatDateTime(exam.openAt)} />
              <InfoRow label="Đóng bài" value={formatDateTime(exam.closeAt)} />
              <InfoRow label="Thời lượng làm bài" value={formatDuration(exam.durationMinutes)} />

              {/* Lịch phía trên chỉ là mặc định. Lớp học tiết 2 sáng thứ Ba và lớp học tiết 4 chiều
                  thứ Năm làm cùng một đề, nên "lớp nào đang làm bài lúc này" phải đọc được ở đây. */}
              {exam.assignmentWindows.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    Khung giờ theo lớp
                  </p>
                  <AssignmentWindowList windows={exam.assignmentWindows} />
                  <NavLink
                    to={`/giao-vien/bai-kiem-tra/${exam.id}/giao-bai`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    <CalendarClock size={13} /> Đổi khung giờ của một lớp
                  </NavLink>
                </div>
              )}
            </div>

            <NavLink
              to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <Pencil size={16} /> {exam.blueprintFrozen ? 'Sửa tên, mô tả và lịch' : 'Chỉnh sửa ma trận đề'}
            </NavLink>
          </aside>
        </div>
      )}

      {exam && (
        <RescheduleAssignmentDialog
          open={rescheduling !== null}
          exam={exam}
          assignment={rescheduling}
          loading={rescheduleSaving}
          error={rescheduleError}
          onSubmit={window => void handleReschedule(window)}
          onCancel={() => {
            setRescheduling(null)
            setRescheduleError(null)
          }}
        />
      )}
    </TeacherLayout>
  )
}
