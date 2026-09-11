/**
 * Câu chữ của các hộp xác nhận quanh bài kiểm tra.
 *
 * Tách ra vì cùng một câu "xoá đề" xuất hiện ở danh sách lẫn trang chi tiết, và hai bản sao sẽ
 * sớm nói hai điều khác nhau về cùng một hệ quả.
 */
import { formatDateTime, formatDuration, parseDateTime } from '../../../lib/format'
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
 * sửa gì cũng không đổi được điểm đã có.
 *
 * Phần áp dụng cho các em chưa làm tách ba trường hợp, vì server làm ba việc khác nhau. Chưa em nào
 * bắt đầu mà cấu hình đề đổi thì bản đề đã sinh lúc giao bài bị **sinh lại** — giáo viên phải biết
 * các em sẽ nhận một bộ câu khác, không phải bộ họ có thể đã xem trước. Cấu hình không đổi thì bộ câu
 * giữ nguyên. Đã có em làm thì cấu hình bị khoá, chỉ tên, lịch và tuỳ chọn hiện điểm được lưu.
 *
 * `blueprintChanged` do trang gọi tự so: nói "sẽ sinh lại" khi chỉ đổi tên là hứa một điều không xảy ra.
 */
export function publishedExamEditConfirmCopy(
  exam: Pick<Exam, 'title' | 'assignedCount' | 'submittedCount' | 'startedCount' | 'blueprintFrozen'>,
  goingToAssign: boolean,
  blueprintChanged: boolean,
) {
  const audience =
    exam.assignedCount === 0
      ? `Đề "${exam.title}" đã xuất bản nhưng chưa giao cho ai: thay đổi áp dụng cho những lượt giao bài từ giờ.`
      : exam.blueprintFrozen
        ? `Đề "${exam.title}" đã có ${exam.startedCount} học sinh bắt đầu làm nên cấu hình đề giữ nguyên: chỉ tên, mô tả, lịch mở/đóng và tuỳ chọn hiện kết quả được lưu, và hiện ngay với các em.`
        : blueprintChanged
          ? `Đề "${exam.title}" đang được giao cho ${exam.assignedCount} học sinh và chưa em nào bắt đầu làm. Cấu hình đề đã đổi nên đề của các em sẽ được sinh lại theo cấu hình mới: khi vào thi, các em nhận bộ câu hỏi mới thay cho bộ đã sinh lúc giao bài.`
          : `Đề "${exam.title}" đang được giao cho ${exam.assignedCount} học sinh: tên, mô tả, lịch mở/đóng và tuỳ chọn mới sẽ hiện ngay với các em. Cấu hình đề không đổi nên bộ câu hỏi của các em giữ nguyên.`
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

/**
 * Nhân bản một đề.
 *
 * Hỏi trước dù không phá gì, vì hai điều người dùng hay đoán sai: bản sao là **bản nháp chưa giao cho
 * ai** (không phải đề thứ hai cả lớp nhận ngay), và trên trang sửa thì những gì đang gõ dở không được
 * chép sang — bản sao lấy từ cấu hình đã lưu.
 *
 * Nói thêm rằng lịch mở/đóng cũng được chép nguyên. Người ta nhân bản thường là để dùng lại một đề cũ,
 * mà giờ đóng của đề cũ đã qua: giao bản sao mà không dời lịch là giao một bài các em không vào được.
 */
export function examDuplicateConfirmCopy(
  exam: Pick<Exam, 'title' | 'openAt' | 'closeAt'>,
  hasUnsavedEdits = false,
) {
  const unsaved = hasUnsavedEdits
    ? ' Những thay đổi chưa lưu trên trang này không được chép sang bản sao.'
    : ''

  const closeDate = parseDateTime(exam.closeAt)
  const scheduleWindow = `${formatDateTime(exam.openAt)} đến ${formatDateTime(exam.closeAt)}`
  const schedule = !exam.openAt || !closeDate
    ? ''
    : closeDate.getTime() <= Date.now()
      ? ` Lịch mở bài cũng được chép nguyên (${scheduleWindow}) — giờ đóng này đã qua, nhớ dời lịch trên bản sao trước khi giao bài.`
      : ` Lịch mở bài cũng được chép nguyên (${scheduleWindow}); đổi trên bản sao nếu cần.`

  return {
    title: 'Nhân bản bài kiểm tra',
    message: `Hệ thống tạo một bản nháp mới từ "${exam.title}" với cùng cấu hình và tuỳ chọn, tên thêm "(bản sao)".${schedule} Bản sao chưa giao cho ai, đề gốc và bài làm của học sinh giữ nguyên.${unsaved} Sau đó bạn được chuyển sang trang sửa bản sao.`,
    confirmLabel: 'Nhân bản',
    tone: 'primary' as const,
  }
}
