import { formatDateTime } from '../../../lib/format'
import { DELETION_RETENTION_DAYS } from '../../../services/studentService'
import { studentStatusLabels, type StudentStatus } from '../../../types'

const statusToneClass: Record<StudentStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  locked: 'bg-slate-100 text-slate-500',
  // Hổ phách chứ không đỏ: chờ xoá vẫn còn đường lui, và màu phải báo cho người xem biết điều đó.
  pendingDeletion: 'bg-amber-100 text-amber-700',
  deleted: 'bg-rose-50 text-rose-500',
}

/**
 * Hai chữ "Chờ xoá" không nói được sẽ xảy ra chuyện gì và bao giờ, nên hai trạng thái của việc xoá
 * có thêm lời giải thích khi rê chuột. Có mốc xoá vĩnh viễn từ server thì nói đúng mốc đó; không có
 * thì chỉ nói mốc tương đối — bịa ra một ngày cụ thể còn tệ hơn không nói.
 */
function explainStatus(status: StudentStatus, deletionScheduledAt?: string): string | undefined {
  if (status === 'pendingDeletion') {
    const deadline = deletionScheduledAt
      ? `tới ${formatDateTime(deletionScheduledAt)}`
      : `trong ${DELETION_RETENTION_DAYS} ngày kể từ ngày yêu cầu xoá`
    return `Không đăng nhập được. Vẫn khôi phục được ${deadline}; sau đó dữ liệu cá nhân bị xoá vĩnh viễn, kết quả bài làm vẫn được giữ.`
  }
  if (status === 'deleted') {
    return 'Dữ liệu cá nhân đã bị xoá vĩnh viễn và không khôi phục được. Kết quả bài làm vẫn được giữ.'
  }
  return undefined
}

interface StudentStatusPillProps {
  status: StudentStatus
  /** Mốc xoá vĩnh viễn server gửi kèm tài khoản đang chờ xoá. */
  deletionScheduledAt?: string
}

export default function StudentStatusPill({ status, deletionScheduledAt }: StudentStatusPillProps) {
  const explanation = explainStatus(status, deletionScheduledAt)
  return (
    <span
      title={explanation}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusToneClass[status]} ${
        explanation ? 'cursor-help' : ''
      }`}
    >
      {studentStatusLabels[status]}
    </span>
  )
}
