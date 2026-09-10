import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { StudentGroup } from '../../../types'
import { describeGroupHealth, getGroupIssues } from './groupHealth'

/**
 * Tín hiệu ở đầu mỗi dòng lớp trong bảng của quản trị viên.
 *
 * Chỗ này trước đây là một chấm màu suy từ `id % 5`. Một chấm tròn ở đầu dòng thì người đọc nào
 * cũng hiểu là trạng thái, nên gán màu ngẫu nhiên vào đó là nói dối họ — hai lớp cùng màu chẳng
 * giống nhau ở điểm nào cả. Bản này trả lời đúng một câu: lớp đã sẵn sàng nhận bài kiểm tra chưa.
 *
 * Khác nhau ở **hình dạng** chứ không chỉ ở màu, để người không phân biệt được xanh với hổ phách
 * vẫn đọc được cảnh báo; và có tooltip vì một biểu tượng đơn độc thì không tự giải thích được.
 */
export default function GroupHealthIndicator({ group }: { group: StudentGroup }) {
  const hasIssue = getGroupIssues(group).length > 0
  const label = describeGroupHealth(group)
  const Icon = hasIssue ? AlertTriangle : CheckCircle2

  return (
    <span role="img" title={label} aria-label={label} className="inline-flex flex-shrink-0 mt-0.5">
      <Icon size={16} className={hasIssue ? 'text-amber-500' : 'text-emerald-500'} />
    </span>
  )
}
