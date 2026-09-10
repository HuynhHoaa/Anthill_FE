/**
 * Ngân hàng câu hỏi — nối vào API thật (§4.5).
 *
 * Ngân hàng dùng chung theo **môn**, không theo từng giáo viên: đồng nghiệp cùng môn đọc được câu
 * hỏi của nhau, nhưng chỉ người tạo mới sửa được. Quyền sửa do **server tính** và trả về trong
 * `canEdit` — giao diện không tự suy ra, vì hai bên tự suy độc lập là cách chắc chắn nhất để chúng
 * nói khác nhau.
 */
import { apiClient } from '../lib/apiClient'
import type { AnswerOption, DifficultyLevel, Paged, Question, QuestionStatus } from '../types'

export interface QuestionPayload {
  content: string
  imageUrl?: string
  topic: string
  difficulty: DifficultyLevel
  defaultPoint: number
  answers: AnswerOption[]
}

export interface ListQuestionsParams {
  search?: string
  topic?: string
  difficulty?: 'all' | DifficultyLevel
  status?: 'all' | QuestionStatus
  page?: number
  pageSize?: number
}

export function listQuestions(params: ListQuestionsParams = {}): Promise<Paged<Question>> {
  return apiClient.get<Paged<Question>>('/api/questions', {
    search: params.search,
    topic: params.topic,
    difficulty: params.difficulty,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  })
}

export function listTopics(): Promise<string[]> {
  return apiClient.get<string[]>('/api/questions/topics')
}

export interface QuestionBankSummary {
  total: number
  active: number
  hidden: number
  easy: number
  medium: number
  hard: number
  topics: string[]
}

/**
 * Tồn kho ngân hàng câu hỏi trong **một** lời gọi.
 *
 * Màn hình ra đề cần cả tổng số, số theo ba mức độ, và danh sách chủ đề cùng lúc để biết đề có
 * sinh nổi hay không. Hỏi rời từng thứ là bốn lượt đi mạng cho một câu trả lời duy nhất.
 */
export function getQuestionBankSummary(topic?: string): Promise<QuestionBankSummary> {
  return apiClient.get<QuestionBankSummary>('/api/questions/summary', { topic })
}

export function getQuestion(id: number): Promise<Question> {
  return apiClient.get<Question>(`/api/questions/${id}`)
}

export function createQuestion(payload: QuestionPayload): Promise<Question> {
  return apiClient.post<Question>('/api/questions', payload)
}

/**
 * Sửa câu hỏi.
 *
 * Server thay **cả mảng** đáp án: id cũ biến mất hoàn toàn và id mới được cấp lại. Vì vậy giao
 * diện không được giữ lại id đáp án cũ sau khi lưu — phải dùng bộ đáp án trong response.
 */
export function updateQuestion(id: number, payload: QuestionPayload): Promise<Question> {
  return apiClient.put<Question>(`/api/questions/${id}`, payload)
}

/**
 * Xoá câu hỏi.
 *
 * Server trả **409** khi câu đã nằm trong một đề đã sinh, kèm gợi ý ẩn thay vì xoá — để những bài
 * học sinh đã làm vẫn đọc lại được nguyên vẹn.
 */
export async function deleteQuestion(id: number): Promise<void> {
  await apiClient.remove(`/api/questions/${id}`)
}

export function setQuestionStatus(id: number, status: QuestionStatus): Promise<Question> {
  return apiClient.patch<Question>(`/api/questions/${id}/status`, { status })
}
