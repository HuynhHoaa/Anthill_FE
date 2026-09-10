/**
 * Chuyển DTO của backend sang kiểu dữ liệu mà giao diện dùng.
 *
 * Tồn tại vì hai bên cố ý khác nhau ở ba điểm, không phải vì ai đó đặt tên lệch:
 *
 * 1. **Backend bỏ hẳn trường điểm khi người xem chưa được phép thấy** (§3 quy tắc ⑥) — nó không
 *    gửi `score: null`, nó không gửi `score`. Bản giả lập trước đây khai `score: number` nên mọi
 *    trang đều tin rằng luôn có điểm. Ở đây điểm là `number | null`, và `null` nghĩa là *chưa được
 *    phép xem*, khác hẳn với *bằng không*.
 *
 * 2. **Backend không gửi màu sắc.** `topicColor` là quyết định trình bày, suy từ chủ đề ngay tại
 *    máy người dùng — gửi mã màu qua mạng là để tầng dữ liệu quyết định hộ tầng giao diện.
 *
 * 3. **Backend gửi mốc thời gian, giao diện cần khoảng thời gian.** `durationMinutes` của một bài
 *    đã nộp là hiệu của hai mốc; tính ở đây một lần thay vì để mỗi trang tự trừ.
 */
import { getTopicColor } from '../lib/topicTheme'
import type { ExamStatus, ResultSummary, StudentExamItem, StudentExamItemStatus } from '../types'

/** Trang dữ liệu chuẩn của backend. */
export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ResultSummaryDto {
  attemptId: number
  assignmentId: number
  examId: number
  examTitle: string
  topic: string
  studentId: number
  studentName: string
  studentCode: string
  group: string
  status: ExamStatus
  startedAt: string
  submittedAt?: string
  autoSubmitted: boolean
  totalQuestions: number
  score?: number
  maxScore?: number
  correctCount?: number
}

export interface StudentExamItemDto {
  assignmentId: number
  examId: number
  title: string
  description: string
  topic: string
  durationMinutes: number
  totalQuestions: number
  openAt: string
  closeAt: string
  teacherName: string
  /** 'open' · 'scheduled' · 'closed' — vòng đời của ĐỀ, suy từ mốc thời gian. */
  lifecycle: string
  /** 'assigned' · 'inprogress' · 'submitted' · 'graded' · 'expired' — tiến độ của HỌC SINH. */
  status: string
  canStart: boolean
  showResultAfterSubmit: boolean
  attemptId?: number
  startedAt?: string
  expiresAt?: string
  submittedAt?: string
  score?: number
  maxScore?: number
  correctCount?: number
  assignedAt: string
}

/**
 * Số phút giữa hai mốc, làm tròn lên phút gần nhất.
 *
 * Trả về 0 khi bài chưa nộp — cột "thời gian làm" của một bài đang dở thì chưa có gì để hiện, và
 * để `undefined` chỉ khiến mỗi trang phải tự nghĩ ra cách hiển thị.
 */
function minutesBetween(from: string, to?: string): number {
  if (!to) return 0
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 60_000)
}

export function toResultSummary(dto: ResultSummaryDto): ResultSummary {
  return {
    attemptId: dto.attemptId,
    examId: dto.examId,
    examTitle: dto.examTitle,
    topic: dto.topic,
    topicColor: getTopicColor(dto.topic),
    studentId: dto.studentId,
    studentName: dto.studentName,
    studentCode: dto.studentCode,
    group: dto.group,
    status: dto.status,
    autoSubmitted: dto.autoSubmitted,
    totalQuestions: dto.totalQuestions,
    submittedAt: dto.submittedAt ?? '',
    durationMinutes: minutesBetween(dto.startedAt, dto.submittedAt),

    // Giữ nguyên sự vắng mặt. Đổi thành 0 ở đây là xoá mất khác biệt giữa "chưa được xem điểm"
    // và "được 0 điểm" — hai điều mà học sinh nhìn vào phải phân biệt được.
    score: dto.score ?? null,
    maxScore: dto.maxScore ?? null,
    correctCount: dto.correctCount ?? null,
  }
}

/**
 * Suy trạng thái hiển thị từ hai trường riêng biệt của server.
 *
 * Server tách chúng có lý: `status` nói **em đã làm tới đâu**, `lifecycle` nói **đề còn hiệu lực
 * không**. Giao diện thì cần một nhãn duy nhất trên mỗi thẻ, và nhãn đó phụ thuộc cả hai — một bài
 * chưa làm là "Sắp diễn ra" hay "Đang mở" tuỳ vào đề đã tới giờ chưa.
 *
 * Ba trạng thái đã kết thúc (`submitted`, `graded`, `expired`) đi thẳng, vì lúc đó vòng đời của đề
 * không còn đổi được gì nữa.
 */
function toDisplayStatus(status: string, lifecycle: string): StudentExamItemStatus {
  switch (status) {
    case 'submitted':
      return 'submitted'
    case 'graded':
      return 'graded'
    case 'expired':
      return 'expired'
    case 'inprogress':
      return 'inprogress'
    default:
      break
  }

  // Còn lại là 'assigned' — chưa động tới. Lúc này vòng đời của đề quyết định.
  if (lifecycle === 'scheduled') return 'upcoming'
  if (lifecycle === 'closed') return 'expired'
  return 'open'
}

export function toStudentExamItem(dto: StudentExamItemDto): StudentExamItem {
  // Bài đang làm dở đếm ngược tới lúc HẾT GIỜ LÀM BÀI, không tới lúc đề đóng: hai mốc đó khác
  // nhau, và hiện mốc xa hơn sẽ khiến học sinh tưởng còn nhiều thời gian hơn thực tế.
  const deadlineSource = dto.expiresAt ?? dto.closeAt

  return {
    assignmentId: dto.assignmentId,
    examId: dto.examId,
    name: dto.title,
    topic: dto.topic,
    topicColor: getTopicColor(dto.topic),
    description: dto.description,
    teacher: dto.teacherName,
    durationMinutes: dto.durationMinutes,
    totalQuestions: dto.totalQuestions,
    status: toDisplayStatus(dto.status, dto.lifecycle),
    canStart: dto.canStart,
    openAt: dto.openAt,
    closeAt: dto.closeAt,
    deadline: new Date(deadlineSource),
    attemptId: dto.attemptId,
    score: dto.score ?? null,
    maxScore: dto.maxScore ?? null,
    correctCount: dto.correctCount ?? null,
  }
}
