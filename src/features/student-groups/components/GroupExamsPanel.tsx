import { ClipboardList } from 'lucide-react'
import { LifecycleBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import Pagination from '../../../components/common/Pagination'
import TableScroller from '../../../components/common/TableScroller'
import { usePagination } from '../../../hooks/usePagination'
import { formatDateTime, formatScore, getScoreTone, NO_VALUE } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import type { GroupExam } from '../../../types'

const PAGE_SIZE = 10

const headerCellClass = 'px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'

interface GroupExamsPanelProps {
  exams: GroupExam[]
  page: number
  onPageChange: (page: number) => void
  /** Bấm một dòng để xem từng em làm bài đó. Bỏ trống thì bảng chỉ để xem: dòng không bấm được. */
  onOpen?: (exam: GroupExam) => void
  /** Câu mô tả khi lớp chưa được giao bài nào; mỗi khu vực nói đúng việc của người đang xem. */
  emptyDescription?: string
}

/**
 * Các bài kiểm tra đã giao cho lớp, mới nhất trước — lịch sử học của lớp. Quản trị viên bấm một dòng để xem từng em làm bài đó
 * ra sao; giáo viên chỉ xem bảng (lớp đã được giao bao nhiêu bài, ai soạn, nộp bao nhiêu), nên ở đây không có nút giao hay sửa.
 */
export default function GroupExamsPanel({
  exams,
  page,
  onPageChange,
  onOpen,
  emptyDescription = 'Giáo viên phụ trách giao bài cho lớp từ phần Bài kiểm tra của họ; bài đã giao sẽ hiện ở đây cùng kết quả.',
}: GroupExamsPanelProps) {
  const { currentPage, pageItems } = usePagination(exams, PAGE_SIZE, page, onPageChange)

  if (exams.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Lớp chưa được giao bài kiểm tra nào"
        description={emptyDescription}
      />
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up">
        <TableScroller>
          <table className="w-full table-fixed text-sm min-w-[860px]">
            <colgroup>
              <col />
              <col className="w-[22%]" />
              <col className="w-[11%]" />
              <col className="w-[16%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className={headerCellClass}>Bài kiểm tra</th>
                <th className={headerCellClass}>Khung giờ của lớp</th>
                <th className={headerCellClass}>Đã nộp</th>
                <th className={headerCellClass}>Điểm trung bình</th>
                <th className={headerCellClass}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(exam => {
                const tone = exam.averageScore !== undefined ? getScoreTone(exam.averageScore, exam.maxScore ?? null) : null

                return (
                  <tr
                    key={exam.examId}
                    onClick={onOpen ? openOnRowClick(() => onOpen(exam)) : undefined}
                    className={`border-b border-slate-50 last:border-b-0 transition-colors ${
                      onOpen ? 'hover:bg-indigo-100/70 cursor-pointer' : ''
                    }`}
                  >
                    <td className="px-5 py-3">
                      {onOpen ? (
                        <button
                          type="button"
                          onClick={() => onOpen(exam)}
                          className="block max-w-full text-left cursor-pointer"
                        >
                          <span className="block font-semibold text-slate-800 truncate">{exam.title}</span>
                          <span className="block text-xs text-slate-400 truncate">Soạn bởi {exam.teacherName || NO_VALUE}</span>
                        </button>
                      ) : (
                        <div className="max-w-full">
                          <span className="block font-semibold text-slate-800 truncate">{exam.title}</span>
                          <span className="block text-xs text-slate-400 truncate">Soạn bởi {exam.teacherName || NO_VALUE}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 leading-snug">
                      <span className="block whitespace-nowrap">{formatDateTime(exam.openAt)}</span>
                      <span className="block whitespace-nowrap">đến {formatDateTime(exam.closeAt)}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">{exam.submittedCount}</span>
                      <span className="text-slate-400"> / {exam.assignedCount}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {tone && exam.averageScore !== undefined ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${tone.bg} ${tone.color}`}>
                          {formatScore(exam.averageScore)}
                          {exam.maxScore !== undefined && (
                            <span className="ml-1 font-medium opacity-70">/ {formatScore(exam.maxScore)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa có bài chấm</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <LifecycleBadge lifecycle={exam.lifecycle} />
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
