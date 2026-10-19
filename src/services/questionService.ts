/**
 * Ngân hàng câu hỏi — nối vào API thật (§4.5).
 *
 * Ngân hàng dùng chung theo **môn**, không theo từng giáo viên: đồng nghiệp cùng môn đọc được câu
 * hỏi của nhau, nhưng chỉ người tạo mới sửa được. Quyền sửa do **server tính** và trả về trong
 * `canEdit` — giao diện không tự suy ra, vì hai bên tự suy độc lập là cách chắc chắn nhất để chúng
 * nói khác nhau.
 */
import { apiClient } from '../lib/apiClient'
import type { AnswerOption, DifficultyLevel, Paged, Question, QuestionStatus, Subject } from '../types'

export interface QuestionPayload {
  /** Bỏ trống là chưa đặt tên; khi sửa, bỏ trống là xoá tên đã đặt (server thay cả câu). */
  title?: string
  content: string
  imageUrl?: string
  topic: string
  difficulty: DifficultyLevel
  /** Câu cho chọn nhiều đáp án. Tắt thì phải có đúng một đáp án đúng. */
  allowMultiple: boolean
  defaultPoint: number
  answers: AnswerOption[]
  /**
   * Môn của câu hỏi. Chỉ quản trị viên gửi, và chỉ khi tạo: giáo viên thuộc đúng một môn nên server tự lấy, còn sửa thì
   * câu hỏi không chuyển môn giữa chừng.
   */
  subjectId?: number
}

export interface ListQuestionsParams {
  search?: string
  topic?: string
  difficulty?: 'all' | DifficultyLevel
  status?: 'all' | QuestionStatus
  page?: number
  pageSize?: number
  /** Chỉ quản trị viên: thu hẹp về một môn. Giáo viên gửi lên thì server bỏ qua (họ bị khoá vào môn của mình). */
  subjectId?: number
  /**
   * Bỏ khỏi kết quả những câu mà học sinh của các lớp này đã nhận ở đề trước. Chỉ giáo viên dùng được, và chỉ với lớp mình dạy
   * đã công bố (server trả 400 nếu có lớp lạ).
   */
  excludeAssignedToGroupIds?: number[]
}

export function listQuestions(params: ListQuestionsParams = {}): Promise<Paged<Question>> {
  return apiClient.get<Paged<Question>>('/api/questions', {
    search: params.search,
    topic: params.topic,
    difficulty: params.difficulty,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
    subjectId: params.subjectId,
    excludeAssignedToGroupIds: params.excludeAssignedToGroupIds?.length
      ? params.excludeAssignedToGroupIds.join(',')
      : undefined,
  })
}

export function listTopics(subjectId?: number): Promise<string[]> {
  return apiClient.get<string[]>('/api/questions/topics', { subjectId })
}

/** Các môn học. Chỉ quản trị viên gọi được: giáo viên bị khoá vào môn của mình nên không có gì để chọn. */
export function listSubjects(): Promise<Subject[]> {
  return apiClient.get<Subject[]>('/api/questions/subjects')
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
export function getQuestionBankSummary(topic?: string, subjectId?: number): Promise<QuestionBankSummary> {
  return apiClient.get<QuestionBankSummary>('/api/questions/summary', { topic, subjectId })
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

export function setQuestionStatus(id: number, status: QuestionStatus): Promise<Question> {
  return apiClient.patch<Question>(`/api/questions/${id}/status`, { status })
}

/**
 * Xoá câu hỏi. Server từ chối (409) khi câu đã nằm trong một bài kiểm tra, và câu chữ của lỗi gợi ý ẩn câu đó thay vì
 * xoá — nên lời nhắn lỗi cần được hiện nguyên văn cho người dùng.
 */
export async function deleteQuestion(id: number): Promise<void> {
  await apiClient.remove(`/api/questions/${id}`)
}
