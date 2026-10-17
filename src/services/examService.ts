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
import type { DifficultyLevel, Exam, ExamAssignment, ExamQuestionItem, Paged, Question, StudentStatus } from '../types'
import { toDisplayStudentCode } from './mappers'

/** Một dòng của danh sách câu hỏi gửi lên khi lưu đề theo danh sách. */
export interface ExamQuestionInput {
  questionId: number
  /** Điểm của riêng câu này trong đề, tối đa hai chữ số thập phân. */
  point: number
}

export interface ExamPayload {
  title: string
  description: string
  /** Chủ đề để sinh đề theo ma trận. Đề theo danh sách không dùng. */
  topic?: string
  durationMinutes: number
  /**
   * Cấu hình ma trận — chỉ gửi cho đề theo ma trận. Đề theo danh sách (`questions` có mặt) bỏ qua cả nhóm
   * này: server dẫn xuất lại từ danh sách.
   */
  totalQuestions?: number
  easyPercentage?: number
  mediumPercentage?: number
  hardPercentage?: number
  /** Điểm của MỘT câu ở từng mức. Tổng (số câu mỗi mức × điểm) chuẩn là 100 nhưng không bắt buộc. */
  pointEasy?: number
  pointMedium?: number
  pointHard?: number
  /**
   * Danh sách câu hỏi đã duyệt, theo thứ tự, kèm điểm từng câu. Có mặt (kể cả rỗng) nghĩa là đề soạn theo
   * danh sách; mỗi lần PUT một đề như vậy đều phải gửi lại.
   */
  questions?: ExamQuestionInput[]
  /**
   * Số đề nhỏ mỗi lớp nhận, 1–10; bỏ trống là 1. Từ 2 trở lên đề phải soạn theo danh sách, và `totalQuestions` +
   * ba tỷ lệ là cấu hình của MỘT đề nhỏ (server không dẫn xuất lại từ danh sách như đề một đề).
   */
  paperCount?: number
  /**
   * Số đơn vị 0,01 điểm cộng thêm cho các câu mức cao nhất của MỖI đề nhỏ (để đề nhỏ cộng đúng 10). Bỏ trống là 0; chỉ có nghĩa
   * khi `paperCount` từ 2 trở lên, không lớn hơn `totalQuestions`.
   */
  paperBonusUnits?: number
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

/** Server kẹp cỡ trang ở 200, nên danh sách đầy đủ phải gom nhiều trang. */
const ALL_EXAMS_PAGE_SIZE = 200
/** Trần để một tài khoản bất thường không kéo cả hệ thống vào một ô chọn: 10 trang = 2000 đề. */
const ALL_EXAMS_MAX_PAGES = 10

/**
 * Mọi đề của giáo viên, cho những ô chọn cần đủ danh sách (lọc kết quả theo đề).
 *
 * `listExams` chỉ trả một trang; ô chọn nạp 100 đề đầu thì đề thứ 101 trở đi không chọn được, trong
 * khi vẫn có kết quả của chúng trong bảng.
 */
export async function listAllExams(): Promise<Exam[]> {
  const first = await listExams({ page: 1, pageSize: ALL_EXAMS_PAGE_SIZE })
  if (first.pageSize <= 0) return first.items

  const pageCount = Math.min(Math.ceil(first.total / first.pageSize), ALL_EXAMS_MAX_PAGES)
  if (pageCount <= 1) return first.items

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      listExams({ page: index + 2, pageSize: first.pageSize }),
    ),
  )
  return [...first.items, ...rest.flatMap(page => page.items)]
}

export function getExam(id: number): Promise<Exam> {
  return apiClient.get<Exam>(`/api/exams/${id}`)
}

/**
 * Danh sách câu hỏi của một đề theo danh sách, theo thứ tự giáo viên xếp, kèm đáp án đúng và điểm từng câu.
 * Rỗng với đề theo ma trận.
 */
export function getExamQuestions(examId: number): Promise<ExamQuestionItem[]> {
  return apiClient.get<ExamQuestionItem[]>(`/api/exams/${examId}/questions`)
}

export interface ComposeQuestionsParams {
  easy: number
  medium: number
  hard: number
  /** Giới hạn theo chủ đề (chương); bỏ trống là mọi chủ đề. */
  topic?: string
  /** Câu đã có trong đề, để không rút trùng. */
  excludeQuestionIds: number[]
  /**
   * Bỏ những câu mà học sinh của các lớp này đã nhận ở các đề trước, để đề mới không lặp lại câu cũ. Lớp không thuộc quyền
   * giáo viên bị server từ chối (400).
   */
  excludeAssignedToGroupIds?: number[]
}

export interface ComposeQuestionsResult {
  /** Các câu rút được, theo thứ tự Dễ → Trung bình → Khó. */
  questions: Question[]
  /** Số câu còn thiếu ở từng mức (0 là đủ). Thiếu không phải lỗi: đã trả về những câu có. */
  missing: Record<DifficultyLevel, number>
  /** Số câu đủ điều kiện nhưng bị bỏ vì các lớp đã chọn đã nhận chúng ở đề trước. Vắng khi không chọn lớp nào. */
  skippedAlreadyAssigned?: number
}

/**
 * "Soạn tự động": rút ngẫu nhiên câu hỏi từ ngân hàng theo số câu từng mức.
 *
 * Chỉ trả gợi ý, **không ghi gì** — đề chỉ đổi khi giáo viên duyệt xong và lưu. Mỗi lần gọi ra một bộ khác.
 */
export function composeQuestions(params: ComposeQuestionsParams): Promise<ComposeQuestionsResult> {
  return apiClient.post<ComposeQuestionsResult>('/api/exams/compose-questions', params)
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

/** Cách đề lớn được chia thành các đề nhỏ — `GET /api/exams/{id}/papers`, chỉ giáo viên/quản trị viên. */
export interface ExamPapersOverview {
  paperCount: number
  levels: {
    level: DifficultyLevel
    poolSize: number
    perPaper: number
    sufficient: boolean
    sharedQuestions: number
    unusedQuestions: number
  }[]
  classes: {
    groupId?: number
    groupName: string
    students: number
    papers: {
      variantIndex: number
      label: string
      students: number
      questionCount: number
      easy: number
      medium: number
      hard: number
      questionIds: number[]
    }[]
  }[]
}

export function getExamPapers(id: number): Promise<ExamPapersOverview> {
  return apiClient.get<ExamPapersOverview>(`/api/exams/${id}/papers`)
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
 * Mở điểm và đáp án từng câu cho học sinh. Chỉ làm được **sau khi hết giờ** của lớp đóng bài muộn nhất: còn lớp
 * đang làm hay chưa tới giờ làm thì server trả 409. Bật `showResultAfterSubmit` của đề; gọi lại là vô hại.
 */
export function releaseExamAnswers(id: number): Promise<Exam> {
  return apiClient.post<Exam>(`/api/exams/${id}/release-answers`)
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

/** Một lớp trong lần giao, kèm khung giờ của riêng lớp đó. */
export interface AssignClassTarget {
  groupId: number

  /**
   * Khung giờ riêng của lớp. Bỏ trống **cả hai** nghĩa là lớp này làm bài theo lịch chung của đề — và
   * gửi như vậy cho một lớp đang có giờ riêng là **gỡ** giờ riêng đó khỏi những em chưa bắt đầu.
   * Chỉ đặt một nửa thì server từ chối cả request.
   */
  openAt?: string
  closeAt?: string
}

export interface AssignExamResult {
  assignedCount: number
  skippedAlreadyAssigned: number
  skippedLocked: number
  /**
   * Tài khoản đang chờ xoá — tài khoản đã xoá hẳn không còn lớp nên server tính vào `skippedOutOfScope`. Tách khỏi `skippedLocked` vì em bị khoá thì nhờ mở khoá rồi giao
   * lại được, còn tài khoản chờ xoá thì chỉ quản trị viên khôi phục được. Hệ thống không biết vì sao
   * tài khoản bị xoá, nên câu chữ chỉ nói trạng thái tài khoản.
   */
  skippedRetired: number
  /**
   * Id không giao được: không thuộc lớp nào của giáo viên này, **hoặc** không có tài khoản học
   * sinh nào mang id đó. Server cố ý gộp hai lý do làm một con số — tách ra thì bắn thử từng id
   * là đọc được id nào là học sinh thật của lớp đồng nghiệp.
   */
  skippedOutOfScope: number
  /** Nhóm lớp không tồn tại, hoặc không thuộc quyền quản lý của giáo viên này. */
  skippedOutOfScopeGroups: number

  /** Số em chưa bắt đầu vừa được dời sang khung giờ khác trong chính lần gửi này. */
  scheduleUpdatedCount: number

  /**
   * Số em giữ nguyên khung giờ cũ vì đã bắt đầu làm bài — hạn nộp của các em đã chốt lúc vào thi.
   * Chỉ đếm khi khung gửi lên thật sự khác khung các em đang giữ.
   */
  scheduleKeptStartedCount: number
}

/**
 * Giao bài cho một hay nhiều lớp — mỗi lớp có thể kèm khung giờ riêng.
 *
 * Bài kiểm tra **chỉ giao theo lớp**: server từ chối (400) request mang danh sách học sinh. Em vào lớp sau
 * thì nhận bài khi gửi lại lớp.
 *
 * Trả về kết quả **theo từng loại bị bỏ qua**, vì mỗi loại cần một hành động khác nhau: em đã được
 * giao rồi thì không sao, em bị khoá tài khoản thì phải mở khoá, còn lớp ngoài phạm vi là chọn nhầm.
 *
 * `notify` quyết định có sinh thông báo "có bài mới" và bắn realtime hay không — giao lại một đề đã
 * giao mà vẫn báo cho cả lớp là làm phiền vô cớ. Nó **không** che thông báo đổi giờ: em bị dời giờ
 * luôn được báo, vì đó là giờ thi của em vừa dịch đi.
 */
export function assignExam(
  examId: number,
  payload: {
    /**
     * Lớp kèm khung giờ riêng. Gửi lại một lớp đã giao chính là cách sửa giờ cho lớp đó: những em
     * chưa bắt đầu chuyển sang khung mới, em đã vào thi giữ hạn cũ.
     */
    classes?: AssignClassTarget[]

    /** Lớp giao theo lịch đang có: không kèm giờ nên không đụng tới khung giờ lớp đang theo. */
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

export interface RevokeClassResult {
  /** Số em chưa bắt đầu làm, đã bị gỡ khỏi bài. */
  revokedCount: number
  /** Số em đã bắt đầu làm nên vẫn giữ bài. */
  keptStartedCount: number
}

/**
 * Thu hồi bài đã giao cho **cả một lớp**: gỡ mọi em của lớp đó chưa bắt đầu làm bài.
 *
 * Em đã vào thi giữ nguyên bài (gỡ lúc đó là xoá luôn phần bài đã làm) và được đếm riêng ở kết quả. Server
 * trả 404 khi lớp chưa được giao đề này, 409 khi mọi em của lớp đã bắt đầu làm.
 */
export function revokeClassAssignment(examId: number, groupId: number): Promise<RevokeClassResult> {
  return apiClient.remove<RevokeClassResult>(`/api/exams/${examId}/assignments/classes/${groupId}`)
}
