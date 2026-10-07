/**
 * Làm bài kiểm tra — nối vào API thật (§4.7).
 *
 * Ba điều bản giả lập không làm được, giờ làm được:
 *
 * 1. **Đáp án đúng không còn nằm trong dữ liệu lúc làm bài.** Server dùng một DTO riêng không khai
 *    trường `isCorrect`, nên mở tab Network trong lúc thi cũng không thấy đáp án ở đâu (§3 ①).
 *    Trước đây bản giả lập gửi cả `isCorrect` xuống rồi trông vào giao diện không hiện ra.
 *
 * 2. **Đồng hồ neo vào giờ server.** Mỗi response mang theo giờ của chính server, nên lệch giờ
 *    giữa máy học sinh và server được trừ đi ngay. Máy đặt sai giờ không còn đếm ngược sai.
 *
 * 3. **Lưu nháp có số thứ tự.** Mạng chập chờn làm hai lần lưu về đích không đúng thứ tự gửi đi;
 *    `clientSeq` để server bỏ qua bản đến muộn mà nội dung cũ hơn, thay vì ghi đè lựa chọn mới.
 */
import { apiClient } from '../lib/apiClient'
import type { AttemptSession, StudentExamItem } from '../types'
import { toStudentExamItem, type StudentExamItemDto } from './mappers'

export interface ListMyExamsParams {
  /**
   * Cố ý **không có** ô tìm kiếm: `ListMyExamsQuery` của server chỉ nhận `status`.
   *
   * Danh sách bài của một học sinh vốn ngắn, nên lọc ngay tại máy sau khi nhận về vẫn nhanh và
   * không phải chờ mạng. Gửi `search` lên thì tham số bị bỏ qua trong im lặng — ô tìm kiếm trông
   * như hoạt động mà thật ra không lọc gì.
   */
  status?: string
}

export interface SubmitAttemptResult {
  attemptId: number
  examId: number
  status: string
  submittedAt: string
  autoSubmitted: boolean
  totalQuestions: number
  answeredCount: number
  maxScore: number
  showResultAfterSubmit: boolean
  /** Vắng mặt khi giáo viên tắt "hiện kết quả ngay sau khi nộp". */
  score: number | null
  correctCount: number | null
}

interface AttemptSessionDto {
  attemptId: number
  assignmentId: number
  examId: number
  title: string
  description: string
  durationMinutes: number
  startedAt: string
  expiresAt: string
  serverNow: string
  remainingSeconds: number
  status: string
  totalQuestions: number
  maxScore: number
  questions: {
    id: number
    ordinal: number
    content: string
    imageUrl?: string
    point: number
    answers: { id: number; content: string; imageUrl?: string }[]
  }[]
  savedAnswers: Record<string, number>
  lastAppliedSeq: number
}

interface AttemptTimeDto {
  serverNow: string
  expiresAt: string
  remainingSeconds: number
  status: string
}

/**
 * Đổi mốc hết giờ của server sang mốc theo thang `performance.now()` của máy này.
 *
 * Lấy hiệu `expiresAt - serverNow` rồi cộng vào `performance.now()` thay vì dùng thẳng `expiresAt`:
 * cách này chỉ tin vào **khoảng thời gian** server nói, không tin vào việc hai đồng hồ chỉ cùng
 * một giờ. Máy học sinh lệch mười phút vẫn đếm ngược đúng. Dùng `performance.now()` chứ không phải
 * `Date.now()` để học sinh chỉnh giờ máy giữa buổi thi cũng không làm đồng hồ nhảy.
 */
function toMonotonicDeadline(serverNow: string, expiresAt: string): number {
  const now = Date.parse(serverNow)
  const end = Date.parse(expiresAt)

  if (!Number.isFinite(now) || !Number.isFinite(end)) {
    // Không đọc được giờ server thì tin vào đồng hồ máy — vẫn tốt hơn là không có hạn nào.
    return performance.now() + (Number.isFinite(end) ? end - Date.now() : 0)
  }

  return performance.now() + (end - now)
}

function toSession(dto: AttemptSessionDto): AttemptSession {
  return {
    attemptId: dto.attemptId,
    assignmentId: dto.assignmentId,
    examId: dto.examId,
    examTitle: dto.title,
    durationMinutes: dto.durationMinutes,
    expiresAtMonotonic: toMonotonicDeadline(dto.serverNow, dto.expiresAt),
    remainingSeconds: dto.remainingSeconds,
    totalQuestions: dto.totalQuestions,
    maxScore: dto.maxScore,
    questions: dto.questions.map(question => ({
      id: question.id,
      ordinal: question.ordinal,
      content: question.content,
      imageUrl: question.imageUrl,
      point: question.point,
      answers: question.answers.map(answer => ({
        id: answer.id,
        content: answer.content,
        imageUrl: answer.imageUrl,
      })),
    })),

    // JSON biến khoá số thành chuỗi; đổi lại thành số để các trang tra cứu bằng questionId.
    savedAnswers: Object.fromEntries(
      Object.entries(dto.savedAnswers).map(([questionId, answerId]) => [Number(questionId), answerId]),
    ),

    lastAppliedSeq: dto.lastAppliedSeq,
  }
}

/** Danh sách bài kiểm tra được giao cho chính học sinh đang đăng nhập. */
export async function listMyExams(params: ListMyExamsParams = {}): Promise<StudentExamItem[]> {
  const items = await apiClient.get<StudentExamItemDto[]>('/api/my/exams', {
    status: params.status,
  })

  return items.map(toStudentExamItem)
}

export async function getAssignment(assignmentId: number): Promise<StudentExamItem> {
  const dto = await apiClient.get<StudentExamItemDto>(`/api/my/exams/${assignmentId}`)
  return toStudentExamItem(dto)
}

/**
 * Bắt đầu làm bài, hoặc quay lại bài đang dở.
 *
 * Gọi lại trên một bài đã bắt đầu **không** tạo lượt mới — server trả về đúng lượt cũ với đúng bộ
 * câu hỏi và đúng phần đã lưu. Nhờ vậy F5, mất mạng, hay mở lại trên máy khác đều về đúng chỗ cũ.
 */
export async function startAttempt(assignmentId: number): Promise<AttemptSession> {
  const dto = await apiClient.post<AttemptSessionDto>('/api/exam-attempts', { assignmentId })
  return toSession(dto)
}

export async function getAttempt(attemptId: number): Promise<AttemptSession> {
  const dto = await apiClient.get<AttemptSessionDto>(`/api/exam-attempts/${attemptId}`)
  return toSession(dto)
}

/**
 * Hỏi lại server còn bao nhiêu thời gian.
 *
 * Nhẹ hơn nhiều so với tải lại cả phiên làm bài, nên gọi được mỗi khi tab hiện lại hay có mạng lại để
 * đồng hồ trên màn hình không trôi khỏi đồng hồ chấm bài của server (máy ngủ, tab bị treo).
 */
export async function getAttemptTime(attemptId: number): Promise<{
  expiresAtMonotonic: number
  remainingSeconds: number
  status: string
}> {
  const dto = await apiClient.get<AttemptTimeDto>(`/api/exam-attempts/${attemptId}/time`)

  return {
    expiresAtMonotonic: toMonotonicDeadline(dto.serverNow, dto.expiresAt),
    remainingSeconds: dto.remainingSeconds,
    status: dto.status,
  }
}

/**
 * Kết quả một lần lưu nháp.
 *
 * `applied: false` nghĩa là gói vừa gửi bị server bỏ qua vì `clientSeq` không lớn hơn số nó đã
 * ghi — không phải lỗi, nhưng cũng không phải "đã lưu". Bên gọi phải tự chỉnh `clientSeq` về
 * `lastAppliedSeq + 1` rồi gửi lại, thay vì coi HTTP 200 là bằng chứng dữ liệu đã nằm trong
 * database (xem `TakeExamPage`).
 */
export interface SaveAnswersResult {
  applied: boolean
  lastAppliedSeq: number
  savedCount: number
}

/**
 * Lưu nháp.
 *
 * `clientSeq` tăng dần do trang gọi truyền vào. Server chỉ ghi khi số này lớn hơn số nó đã nhận,
 * nên một gói tin đi vòng qua mạng chậm rồi về sau không thể ghi đè lựa chọn mới hơn — thay vào
 * đó server trả `applied: false` cho gói đến muộn, và bên gọi phải tự đọc trường này để biết có
 * thật sự ghi được hay không.
 */
export async function saveAnswers(
  attemptId: number,
  answers: Record<number, number>,
  clientSeq: number,
): Promise<SaveAnswersResult> {
  return apiClient.put<SaveAnswersResult>(`/api/exam-attempts/${attemptId}/answers`, {
    clientSeq,
    answers: Object.entries(answers).map(([questionId, answerId]) => ({
      questionId: Number(questionId),
      answerId,
    })),
  })
}

/**
 * Nộp bài.
 *
 * Gửi kèm toàn bộ đáp án đang chọn thay vì tin vào phần đã lưu nháp: lần lưu nháp cuối có thể chưa
 * kịp về đích khi học sinh bấm nộp, và mất mấy câu cuối vì một request chậm là điều không chấp
 * nhận được. Server chấm trên những gì gửi kèm.
 */
export async function submitAttempt(
  attemptId: number,
  answers: Record<number, number>,
  clientSeq: number,
): Promise<SubmitAttemptResult> {
  const dto = await apiClient.post<{
    attemptId: number
    examId: number
    status: string
    submittedAt: string
    autoSubmitted: boolean
    totalQuestions: number
    answeredCount: number
    maxScore: number
    showResultAfterSubmit: boolean
    score?: number
    correctCount?: number
  }>(`/api/exam-attempts/${attemptId}/submit`, {
    clientSeq,
    answers: Object.entries(answers).map(([questionId, answerId]) => ({
      questionId: Number(questionId),
      answerId,
    })),
  })

  return {
    ...dto,
    score: dto.score ?? null,
    correctCount: dto.correctCount ?? null,
  }
}
