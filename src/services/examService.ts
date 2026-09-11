/**
 * Bài kiểm tra, blueprint và giao bài — nối vào API thật (§4.6).
 *
 * Ba việc bản giả lập tự làm ở trình duyệt, giờ do server làm:
 *
 * 1. **Chia số câu theo tỷ lệ độ khó.** Phép làm tròn nằm ở server để đề sinh ra đúng bằng số câu
 *    đã hứa; giao diện chỉ hỏi trước kết quả qua `previewBlueprint`.
 * 2. **Đối chiếu tồn kho ngân hàng câu hỏi.** Server biết thật sự còn bao nhiêu câu mỗi mức độ.
 * 3. **`randomizePerStudent` là thật.** Trước đây là ô tích không có tác dụng gì.
 */
import { apiClient } from '../lib/apiClient'
import type { Exam, ExamAssignment, Paged, StudentStatus } from '../types'
import { toDisplayStudentCode } from './mappers'

export interface ExamPayload {
  title: string
  description: string
  topic: string
  durationMinutes: number
  totalQuestions: number
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
  pointPerQuestion: number
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  showResultAfterSubmit: boolean
  openAt: string
  closeAt: string

  /**
   * Gửi `'draft'` để lưu một bản nháp, bỏ trống cho đề hoàn chỉnh.
   *
   * Đây **không phải** cách khai vòng đời của đề — đang mở hay đã đóng là dữ liệu suy từ mốc thời
   * gian, server tự tính. Trường này chỉ nói một điều: cấu hình này còn dở.
   *
   * Và điều đó có hệ quả thật: bản nháp được **miễn hai điều kiện nặng nhất** — tổng ba tỷ lệ độ
   * khó phải bằng 100, và ngân hàng phải đủ câu. Không gửi cờ này thì giáo viên bấm "Lưu nháp"
   * trên một cấu hình chưa xong sẽ nhận lỗi validate, còn trên một cấu hình đã xong thì đề được
   * **xuất bản thật** trong khi họ tưởng vừa cất tạm.
   */
  lifecycle?: 'draft'
}

export interface ListExamsParams {
  search?: string
  lifecycle?: string
  page?: number
  pageSize?: number
}

export interface BlueprintPreview {
  /** Số câu cần cho từng mức độ, sau khi server làm tròn. */
  required: Record<string, number>
  /** Số câu thật sự đang có trong ngân hàng, cùng chủ đề. */
  available: Record<string, number>
  isValid: boolean
  /** Câu chữ giải thích vì sao đề chưa sinh được — hiện thẳng lên form. */
  errors: string[]
}

export function listExams(params: ListExamsParams = {}): Promise<Paged<Exam>> {
  return apiClient.get<Paged<Exam>>('/api/exams', {
    search: params.search,
    lifecycle: params.lifecycle,
    page: params.page,
    pageSize: params.pageSize,
  })
}

export function getExam(id: number): Promise<Exam> {
  return apiClient.get<Exam>(`/api/exams/${id}`)
}

export function createExam(payload: ExamPayload): Promise<Exam> {
  return apiClient.post<Exam>('/api/exams', payload)
}

export function updateExam(id: number, payload: ExamPayload): Promise<Exam> {
  return apiClient.put<Exam>(`/api/exams/${id}`, payload)
}

/**
 * Xoá đề.
 *
 * Server trả **409** khi đã có học sinh nộp bài: kết quả của các em phải tra cứu được về sau, mà
 * xoá đề thì những dòng kết quả đó mất chỗ dựa.
 */
export async function deleteExam(id: number): Promise<void> {
  await apiClient.remove(`/api/exams/${id}`)
}

/**
 * Hỏi trước xem cấu hình này có sinh được đề không, **trước khi** lưu.
 *
 * Đây là thứ biến màn hình ra đề từ một biểu mẫu thành một công cụ: giáo viên thấy ngay "cần 14
 * câu mức khó, ngân hàng chỉ có 9" thay vì lưu xong mới biết đề rỗng.
 */
export function previewBlueprint(payload: {
  topic: string
  totalQuestions: number
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
}): Promise<BlueprintPreview> {
  return apiClient.post<BlueprintPreview>('/api/exams/blueprint-preview', payload)
}

/** Blueprint đã chốt của một đề đã lưu. */
export function getExamBlueprint(id: number): Promise<BlueprintPreview> {
  return apiClient.get<BlueprintPreview>(`/api/exams/${id}/blueprint`)
}

/**
 * Xuất bản một đề đang ở dạng nháp.
 *
 * Tách khỏi `updateExam` có chủ đích: xuất bản là một hành động, không phải một trường dữ liệu.
 * Server kiểm lại đầy đủ điều kiện ở bước này — đúng những điều kiện mà bản nháp được miễn.
 */
export function publishExam(id: number): Promise<Exam> {
  return apiClient.post<Exam>(`/api/exams/${id}/publish`)
}

/**
 * Nhân bản đề thành một **bản nháp mới**: cùng cấu hình và tuỳ chọn, tên thêm " (bản sao)", chưa giao
 * cho ai.
 *
 * Đây là lối ra khi cấu hình đề đã bị khoá vì có học sinh bắt đầu làm: muốn đổi số câu hay tỷ lệ thì
 * sửa trên bản sao rồi giao lại, thay vì để nửa lớp làm một đề và nửa còn lại làm một đề khác.
 */
export function duplicateExam(id: number): Promise<Exam> {
  return apiClient.post<Exam>(`/api/exams/${id}/duplicate`)
}

/** Dòng theo dõi như server gửi. `studentStatus` vắng mặt khi server cũ hơn trường này. */
type ExamAssignmentDto = Omit<ExamAssignment, 'studentStatus'> & { studentStatus?: StudentStatus }

export async function listExamAssignments(examId: number): Promise<ExamAssignment[]> {
  const rows = await apiClient.get<ExamAssignmentDto[]>(`/api/exams/${examId}/assignments`)

  return rows.map(row => {
    const studentStatus = row.studentStatus ?? 'active'
    return { ...row, studentStatus, studentCode: toDisplayStudentCode(row.studentCode, studentStatus) }
  })
}

export interface AssignExamResult {
  assignedCount: number
  skippedAlreadyAssigned: number
  skippedLocked: number
  /**
   * Tài khoản chờ xoá hoặc đã xoá — em đã rời trường. Tách khỏi `skippedLocked` vì em bị khoá thì
   * nhờ mở khoá rồi giao lại được, còn em đã rời trường thì không có gì để làm.
   */
  skippedRetired: number
  skippedNotFound: number
  /** Học sinh không thuộc lớp nào của giáo viên này. */
  skippedOutOfScope: number
  /** Nhóm lớp không thuộc quyền quản lý của giáo viên này. */
  skippedOutOfScopeGroups: number
}

/**
 * Giao bài cho học sinh, theo danh sách id hoặc theo cả nhóm lớp.
 *
 * Trả về kết quả **theo từng loại bị bỏ qua**, vì mỗi loại cần một hành động khác nhau: em đã được
 * giao rồi thì không sao, em bị khoá tài khoản thì phải mở khoá, còn em ngoài phạm vi lớp mình thì
 * là chọn nhầm.
 *
 * `notify` quyết định có sinh thông báo và bắn realtime hay không — giao lại một đề đã giao mà vẫn
 * báo cho cả lớp là làm phiền vô cớ.
 */
export function assignExam(
  examId: number,
  payload: {
    studentIds: number[]
    groupIds: number[]
    notify: boolean

    /**
     * Mỗi học sinh một bộ câu hỏi riêng.
     *
     * Thuộc payload **giao bài** chứ không phải payload lưu đề: đây là endpoint duy nhất ghi được
     * cờ này, vì nó chỉ có nghĩa tại thời điểm sinh đề. Bỏ trống thì giữ nguyên giá trị cũ; đổi nó
     * khi đề đã giao cho một phần lớp sẽ bị server từ chối, để không có lớp nào rơi vào cảnh nửa
     * số em dùng đề chung, nửa còn lại dùng đề riêng.
     */
    randomizePerStudent?: boolean
  },
): Promise<AssignExamResult> {
  return apiClient.post<AssignExamResult>(`/api/exams/${examId}/assignments`, payload)
}

/** Thu hồi bài đã giao. Server từ chối khi học sinh đã bắt đầu làm. */
export async function revokeAssignment(examId: number, assignmentId: number): Promise<void> {
  await apiClient.remove(`/api/exams/${examId}/assignments/${assignmentId}`)
}
