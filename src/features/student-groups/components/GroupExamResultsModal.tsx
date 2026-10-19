import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hourglass } from 'lucide-react'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Modal from '../../../components/common/Modal'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { formatDateTime, formatDuration, formatScore, getInitials, getScoreTone, NO_VALUE } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { listGroupExamResults } from '../../../services/examService'
import type { GroupExam } from '../../../types'
import ExamProgressBadge from '../../students/components/ExamProgressBadge'
import { getAvatarTone } from './groupTheme'

interface GroupExamResultsModalProps {
  exam: GroupExam
  groupId: number
  /** Quyết định bài làm và hồ sơ học sinh mở ở khu vực nào: quản trị viên hay giáo viên. */
  audience: 'admin' | 'teacher'
  onClose: () => void
}

/** Số phút em làm bài, từ lúc bắt đầu tới lúc nộp; NULL khi em chưa nộp (chưa làm hay đang làm dở). */
function minutesUsed(startedAt?: string, submittedAt?: string): number | null {
  if (!startedAt || !submittedAt) return null
  const started = new Date(startedAt).getTime()
  const submitted = new Date(submittedAt).getTime()
  if (!Number.isFinite(started) || !Number.isFinite(submitted) || submitted < started) return null
  return (submitted - started) / 60000
}

const headerCellClass = 'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'

/**
 * Từng em của lớp đã làm một bài kiểm tra ra sao: trạng thái, điểm, thời gian làm và giờ nộp. Chỉ đọc — bấm một em đã làm bài để xem
 * lại bài làm và đáp án em đã chọn, em chưa làm thì mở hồ sơ của em.
 *
 * Server chỉ trả những em được giao qua lớp này (đề có thể đã giao cho nhiều lớp), nên màn hình không phải lọc lại.
 */
export default function GroupExamResultsModal({ exam, groupId, audience, onClose }: GroupExamResultsModalProps) {
  const navigate = useNavigate()
  const area = audience === 'admin' ? '/quan-tri' : '/giao-vien'
  const { data, loading, error, reload } = useAsync(
    () => listGroupExamResults(groupId, exam.examId),
    [groupId, exam.examId],
  )

  const rows = useMemo(
    () => [...(data ?? [])].sort((left, right) => left.studentCode.localeCompare(right.studentCode, 'vi', { numeric: true })),
    [data],
  )

  return (
    <Modal
      open
      size="xl"
      title={exam.title}
      description={`Kết quả của lớp · ${exam.submittedCount}/${exam.assignedCount} em đã nộp bài`}
      onClose={onClose}
    >
      {loading && data === undefined && <SkeletonTable rows={6} cols={4} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!error && data && rows.length === 0 && (
        <EmptyState
          icon={Hourglass}
          title="Không còn em nào nhận bài này"
          description="Các em được giao bài này đã rời lớp và bài chưa làm của các em đã được thu hồi."
        />
      )}

      {!error && rows.length > 0 && (
        <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-100">
                <th className={headerCellClass}>Học sinh</th>
                <th className={`${headerCellClass} hidden sm:table-cell`}>Trạng thái</th>
                <th className={headerCellClass}>Điểm</th>
                <th className={`${headerCellClass} hidden sm:table-cell`}>Thời gian làm</th>
                <th className={`${headerCellClass} hidden sm:table-cell`}>Nộp lúc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const avatarTone = getAvatarTone(row.studentId)
                const graded = row.status === 'graded' && row.score !== undefined
                const tone = graded ? getScoreTone(row.score ?? 0, exam.maxScore ?? null) : null
                const target = row.attemptId !== undefined
                  ? `${area}/ket-qua/${row.attemptId}`
                  : `${area}/hoc-sinh/${row.studentId}`
                const used = minutesUsed(row.startedAt, row.submittedAt)

                return (
                  <tr
                    key={row.id}
                    onClick={openOnRowClick(() => navigate(target))}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-indigo-100/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarTone.bg} ${avatarTone.text}`}
                        >
                          {getInitials(row.studentName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{row.studentName}</p>
                          <p className="text-xs text-slate-400 truncate">{row.studentCode || NO_VALUE}</p>
                          {/* Điện thoại không đủ chỗ cho cột trạng thái riêng nên nó nằm dưới tên, để cột Điểm vẫn thấy được. */}
                          <div className="mt-1 sm:hidden">
                            <ExamProgressBadge status={row.status} attemptId={row.attemptId} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">
                      <ExamProgressBadge status={row.status} attemptId={row.attemptId} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {tone ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${tone.bg} ${tone.color}`}>
                          {formatScore(row.score)}
                          {exam.maxScore !== undefined && (
                            <span className="ml-1 font-medium opacity-70">/ {formatScore(exam.maxScore)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">{NO_VALUE}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap hidden sm:table-cell">
                      {used === null ? NO_VALUE : used < 1 ? 'Dưới 1 phút' : formatDuration(used)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap hidden sm:table-cell">
                      {row.submittedAt ? formatDateTime(row.submittedAt) : NO_VALUE}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
