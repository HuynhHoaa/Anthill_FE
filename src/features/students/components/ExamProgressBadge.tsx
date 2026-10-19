import { StatusBadge } from '../../../components/common/Badge'
import type { ExamStatus } from '../../../types'

interface ExamProgressBadgeProps {
  status: ExamStatus
  /** Có lượt làm bài hay không. Bài hết hạn mà em chưa từng vào làm là "bỏ lỡ", khác bài hết giờ khi em đang làm. */
  attemptId?: number
}

/**
 * Nhãn tiến độ của một học sinh với một bài kiểm tra, đúng như quản trị viên đọc: "chưa làm" và "bỏ lỡ" có nhãn riêng
 * thay vì mượn "đã giao" / "hết hạn" của giáo viên — người quản lý cần phân biệt em còn kịp với em đã vắng.
 */
export default function ExamProgressBadge({ status, attemptId }: ExamProgressBadgeProps) {
  if (status === 'expired' && attemptId === undefined) {
    return (
      <span
        title="Bài đã hết hạn mà em không vào làm"
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600"
      >
        Bỏ lỡ
      </span>
    )
  }

  if (status === 'assigned') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        Chưa làm
      </span>
    )
  }

  return <StatusBadge status={status} />
}
