/**
 * Câu chữ của các hộp xác nhận quanh bài kiểm tra.
 *
 * Tách ra vì cùng một câu "xoá đề" xuất hiện ở danh sách lẫn trang chi tiết, và hai bản sao sẽ
 * sớm nói hai điều khác nhau về cùng một hệ quả.
 */
import { formatDuration } from '../../../lib/format'
import type { Exam } from '../../../types'

/**
 * Nút xoá chỉ bật khi chưa em nào nộp bài, nên không mất điểm số nào. Nhưng xoá đề là gỡ mọi lượt
 * giao bài, kể cả lượt đang làm dở: em đang ngồi làm bị dừng ngay và mất phần bài chưa nộp. Trước
 * đây câu chữ nói "không kết quả nào bị mất" — đúng về điểm, sai với chính em đang làm bài.
 *
 * Trang chi tiết biết bao nhiêu em đang làm và truyền vào `inProgressCount`. Số đó chụp lúc tải
 * trang, nên khi nó bằng 0 mà đề còn mở thì vẫn cảnh báo chung — một em có thể vừa bắt đầu. Danh
 * sách đề không có số đó, nên chỉ cảnh báo khi đề đang mở; đề đã đóng thì không còn lượt nào đang
 * chạy, vì server chốt hạn nộp của mọi lượt làm bài không muộn hơn giờ đóng đề.
 */
export function examDeleteConfirmCopy(
  exam: Pick<Exam, 'title' | 'assignedCount' | 'lifecycle'>,
  inProgressCount?: number,
) {
  const assignmentPart =
    exam.assignedCount > 0
      ? ` Toàn bộ ${exam.assignedCount} lượt giao bài bị gỡ theo — ${exam.assignedCount} học sinh sẽ không còn thấy bài này trong danh sách của mình.`
      : ''

  const inProgressPart =
    inProgressCount !== undefined && inProgressCount > 0
      ? ` ${inProgressCount} học sinh đang làm bài sẽ bị dừng ngay và mất toàn bộ phần bài đang làm dở.`
      : exam.lifecycle === 'open' && exam.assignedCount > 0
        ? ' Đề đang mở: học sinh nào đang làm bài sẽ bị dừng ngay và mất toàn bộ phần bài đang làm dở.'
        : ''

  return {
    title: 'Xoá bài kiểm tra',
    message: `Bài kiểm tra "${exam.title}" sẽ bị xoá vĩnh viễn và không khôi phục được.${assignmentPart}${inProgressPart} Chưa em nào nộp bài nên không mất điểm số nào.`,
    confirmLabel: 'Xoá bài kiểm tra',
    tone: 'danger' as const,
  }
}

interface PublishSummary {
  title: string
  totalQuestions: number
  durationMinutes: number
  /** Đã định dạng sẵn để đọc, ví dụ "12/09/2026 07:30". */
  openAt: string
  closeAt: string
}

/**
 * Xuất bản một đề mới hoặc một bản nháp.
 *
 * Nói rõ cả điều **không** xảy ra: xuất bản chưa đưa đề tới học sinh nào. Người mới dùng thường
 * tưởng bấm lưu là cả lớp nhận đề ngay.
 */
export function examPublishConfirmCopy(summary: PublishSummary, goingToAssign: boolean) {
  const nextStep = goingToAssign
    ? 'Ngay sau đó bạn sẽ được chuyển sang bước chọn lớp để giao bài.'
    : 'Học sinh chỉ nhận được đề sau khi bạn giao bài.'

  return {
    title: 'Xuất bản bài kiểm tra',
    message: `Bài kiểm tra "${summary.title.trim()}" sẽ được xuất bản với ${summary.totalQuestions} câu, ${formatDuration(summary.durationMinutes)} làm bài, mở từ ${summary.openAt} đến ${summary.closeAt}. Sau khi xuất bản, đề không quay lại dạng nháp được nữa. ${nextStep}`,
    confirmLabel: goingToAssign ? 'Xuất bản và giao bài' : 'Xuất bản',
    tone: 'primary' as const,
  }
}

/**
 * Lưu thay đổi trên một đề đã xuất bản.
 *
 * Chỉ khẳng định điều chắc chắn đúng: bài đã nộp được chấm trên bản đề đã chụp lúc sinh đề, nên
 * sửa gì cũng không đổi được điểm đã có. Còn phần áp dụng cho các em chưa làm thì nói ở mức "hiện
 * ngay với các em" — đủ để giáo viên hiểu đây không phải một bản nháp riêng của mình.
 */
export function publishedExamEditConfirmCopy(
  exam: Pick<Exam, 'title' | 'assignedCount' | 'submittedCount'>,
  goingToAssign: boolean,
) {
  const audience =
    exam.assignedCount > 0
      ? `Đề "${exam.title}" đang được giao cho ${exam.assignedCount} học sinh: tên, mô tả, lịch mở/đóng và các tuỳ chọn mới sẽ hiện ngay với các em.`
      : `Đề "${exam.title}" đã xuất bản nhưng chưa giao cho ai: thay đổi áp dụng cho những lượt giao bài từ giờ.`
  const graded =
    exam.submittedCount > 0
      ? ` ${exam.submittedCount} bài đã nộp và điểm đã chấm giữ nguyên, vì hệ thống chấm trên đúng bộ câu hỏi từng em đã làm.`
      : ''

  return {
    title: 'Lưu thay đổi cho đề đã xuất bản',
    message: `${audience}${graded}`,
    confirmLabel: goingToAssign ? 'Lưu và giao bài' : 'Lưu thay đổi',
    tone: 'primary' as const,
  }
}
