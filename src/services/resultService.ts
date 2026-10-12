/**
 * Kết quả làm bài — nối vào API thật (§4.8).
 *
 * Điểm khác biệt then chốt so với bản giả lập: **quyền xem điểm do server quyết định**, và server
 * thể hiện quyết định đó bằng cách bỏ hẳn ba trường điểm khỏi JSON (§3 quy tắc ⑥). Giao diện ở đây
 * không giấu gì cả — nó chỉ hiển thị những gì thực sự nhận được, và `null` nghĩa là *không được
 * phép xem*, khác hẳn *bằng không*.
 */
import { apiClient } from '../lib/apiClient'
import { getTopicColor } from '../lib/topicTheme'
import type { AttemptDetail, ExamStatus, ResultSummary, StudentStatus } from '../types'
import {
  toDisplayStudentCode,
  toResultSummary,
  type PagedResponse,
  type ResultSummaryDto,
} from './mappers'

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListResultsParams {
  search?: string
  status?: 'all' | ExamStatus
  examId?: number
  studentId?: number
  groupId?: number
  page?: number
  pageSize?: number
}

export interface ResultStats {
  totalAttempts: number
  gradedCount: number

  /** Lượt đang làm dở: nằm trong `totalAttempts` nhưng chưa phải bài đã nộp. */
  inProgressCount: number

  /**
   * `null` khi chưa có bài nào được chấm.
   *
   * Không quy về 0: một lớp chưa ai thi mà hiện "điểm trung bình 0" trông y hệt một lớp làm sai
   * hết bài, và giáo viên đọc con số đó sẽ hiểu sai hoàn toàn.
   */
  averageScore: number | null
  highestScore: number | null

  /**
   * Phần trăm bài đã giao đã được nộp.
   *
   * Thay cho `passRate` của bản giả lập. Backend không có khái niệm điểm sàn nên không tính được
   * tỷ lệ đạt; đổi tên theo đúng thứ con số này thật sự đo, thay vì giữ nhãn cũ trên dữ liệu mới.
   */
  completionRate: number
}

interface AttemptDetailAnswerDto {
  id: number
  ordinal: number
  content: string
  imageUrl?: string
}

interface AttemptDetailQuestionDto {
  paperQuestionId: number
  ordinal: number
  content: string
  imageUrl?: string
  point: number
  answers: AttemptDetailAnswerDto[]
  selectedAnswerId?: number
  correctAnswerId?: number
  isCorrect?: boolean
}

interface AttemptDetailDto {
  attemptId: number
  examId: number
  examTitle: string
  topic: string
  studentId: number
  studentName: string
  studentCode: string
  /** Vắng mặt khi server cũ hơn trường này. */
  studentStatus?: StudentStatus
  group?: string
  status: ExamStatus
  startedAt: string
  submittedAt?: string
  autoSubmitted: boolean
  durationUsedMinutes?: number
  score?: number
  maxScore?: number
  correctCount?: number
  canSeeAnswers: boolean
  questions: AttemptDetailQuestionDto[]
}

/** Bảng kết quả của giáo viên. */
export async function listResults(params: ListResultsParams): Promise<Paged<ResultSummary>> {
  const response = await apiClient.get<PagedResponse<ResultSummaryDto>>('/api/results', {
    search: params.search,
    status: params.status,
    examId: params.examId,
    studentId: params.studentId,
    groupId: params.groupId,
    page: params.page,
    pageSize: params.pageSize,
  })

  return { ...response, items: response.items.map(toResultSummary) }
}

/** Lịch sử làm bài của chính học sinh đang đăng nhập. */
export async function listMyResults(params: {
  search?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<ResultSummary>> {
  const response = await apiClient.get<PagedResponse<ResultSummaryDto>>('/api/my/results', {
    search: params.search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return { ...response, items: response.items.map(toResultSummary) }
}

/**
 * Bốn ô số liệu đầu trang.
 *
 * Nhận **cùng bộ lọc** với bảng bên dưới, vì server tính chúng trên đúng tập dữ liệu đang hiển thị.
 * Gọi mà bỏ bộ lọc đi thì bốn ô nói về toàn hệ thống trong khi bảng ngay dưới đã lọc — người xem
 * không có cách nào biết hai phần đang nói về hai chuyện khác nhau.
 */
export function getResultStats(params: ListResultsParams = {}): Promise<ResultStats> {
  return apiClient.get<ResultStats>('/api/results/stats', {
    search: params.search,
    status: params.status,
    examId: params.examId,
    studentId: params.studentId,
    groupId: params.groupId,
  })
}

/** Chi tiết một lượt làm bài, soi từng câu. */
export async function getAttemptDetail(attemptId: number): Promise<AttemptDetail> {
  const dto = await apiClient.get<AttemptDetailDto>(`/api/results/${attemptId}`)
  const studentStatus = dto.studentStatus ?? 'active'

  return {
    attemptId: dto.attemptId,
    examId: dto.examId,
    examTitle: dto.examTitle,
    topic: dto.topic,
    topicColor: getTopicColor(dto.topic),
    studentId: dto.studentId,
    studentName: dto.studentName,
    studentCode: toDisplayStudentCode(dto.studentCode, studentStatus),
    studentStatus,
    group: dto.group ?? '',
    status: dto.status,
    score: dto.score ?? null,
    maxScore: dto.maxScore ?? null,
    correctCount: dto.correctCount ?? null,
    totalQuestions: dto.questions.length,
    submittedAt: dto.submittedAt ?? '',
    durationMinutes: dto.durationUsedMinutes ?? 0,
    autoSubmitted: dto.autoSubmitted,
    showAnswers: dto.canSeeAnswers,

    // Câu bỏ trống vẫn nằm trong danh sách với selectedAnswerId là null — đó thường là những câu
    // đáng xem nhất khi soi lại bài, nên lọc chúng đi là bỏ mất phần quan trọng nhất.
    questions: dto.questions.map(question => ({
      questionId: question.paperQuestionId,
      ordinal: question.ordinal,
      content: question.content,
      imageUrl: question.imageUrl,
      point: question.point,
      answers: question.answers.map(answer => ({
        id: answer.id,
        content: answer.content,
        imageUrl: answer.imageUrl,
      })),
      selectedAnswerId: question.selectedAnswerId ?? null,
      correctAnswerId: question.correctAnswerId ?? null,
      isCorrect: question.isCorrect ?? null,
    })),
  }
}
