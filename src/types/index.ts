/**
 * Nguồn sự thật duy nhất về type nghiệp vụ của Anthill.
 * Mọi feature, service và mock data đều import từ đây.
 */

// ===== Enum nghiệp vụ =====

export type UserRole = 'teacher' | 'student' | 'admin'

/** Vai trò được xem chi tiết bài làm. Quản trị viên đứng ngoài vòng này. */
export type ResultAudience = 'teacher' | 'student'

/**
 * `pendingDeletion` và `deleted` là hai chặng của việc xoá tài khoản, không phải một biến thể của
 * khoá: chờ xoá thì vẫn khôi phục được trong 60 ngày, còn đã xoá thì dữ liệu cá nhân không còn —
 * dòng đó chỉ ở lại để kết quả bài làm cũ còn có chủ.
 */
export type StudentStatus = 'active' | 'locked' | 'pendingDeletion' | 'deleted'

export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export type QuestionStatus = 'active' | 'hidden'

/** Trạng thái bài làm của một học sinh với một bài kiểm tra. */
export type ExamStatus = 'assigned' | 'inprogress' | 'submitted' | 'graded' | 'expired'

/** Vòng đời của bài kiểm tra dưới góc nhìn giáo viên. */
export type ExamLifecycle = 'draft' | 'scheduled' | 'open' | 'closed'

export type NotificationType =
  | 'exam_assigned'
  | 'exam_submitted'
  | 'exam_updated'
  | 'deadline_soon'
  | 'auto_submitted'

/** Trạng thái hiển thị trên màn hình danh sách bài kiểm tra của học sinh. */
/**
 * Trạng thái một bài kiểm tra **dưới mắt học sinh**.
 *
 * `inprogress` là một trạng thái riêng, không gộp vào `open`: em đã bắt đầu làm và đồng hồ đang
 * chạy. Gộp hai thứ lại thì màn hình nói "Đang mở" cho một bài sắp hết giờ, và em không biết mình
 * cần quay lại gấp.
 */
export type StudentExamItemStatus =
  | 'open'
  | 'upcoming'
  | 'inprogress'
  | 'submitted'
  | 'graded'
  | 'expired'

export type ActivityTone = 'success' | 'info' | 'warning' | 'purple'

// ===== Kiểu dùng chung =====

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ===== Học sinh và nhóm lớp =====

export interface Student {
  id: number
  fullName: string
  email: string
  username: string
  code: string
  group: string
  groupId: number
  status: StudentStatus
  createdAt: string
  completedExams: number
  averageScore: number
  /** Lý do yêu cầu xoá. Chỉ có khi tài khoản đang chờ xoá hoặc đã xoá. */
  deletionReason?: string
  /** Lúc yêu cầu xoá được ghi nhận (ISO). */
  deletionRequestedAt?: string
  /**
   * Lúc dữ liệu cá nhân sẽ bị xoá vĩnh viễn (ISO). Chỉ có khi đang chờ xoá.
   *
   * Server tính sẵn chứ giao diện không tự cộng 60 ngày: con số đó là chính sách của hệ thống, và
   * để hai bên cùng giữ một bản thì ngày đổi chính sách là ngày hai bên nói hai ngày khác nhau.
   */
  deletionScheduledAt?: string
}

/**
 * Giáo viên được phân công phụ trách một lớp.
 *
 * `avatarColor` đi kèm tài khoản chứ không suy từ id như avatar học sinh: cùng một giáo viên xuất
 * hiện ở nhiều lớp, và màu phải theo người thì người xem mới nhận ra được ai là ai.
 */
export interface GroupTeacher {
  id: number
  fullName: string
  email: string
  /** Chuỗi rỗng khi tài khoản chưa được gán môn. */
  subject: string
  avatarColor: string
}

export interface StudentGroup {
  id: number
  name: string
  description: string
  studentCount: number

  /**
   * Lớp đã công bố hay còn là bản nháp.
   *
   * Server đã lọc theo vai trò trước khi trả kết quả — giáo viên không bao giờ nhận về lớp nháp.
   * Trường này để màn hình quản trị phân biệt hai loại, **không** phải để giao diện lọc lại lần
   * nữa: lọc ở hai nơi thì một ngày nào đó hai nơi hiểu khác nhau.
   */
  isPublished: boolean

  /** Vắng mặt khi lớp còn là bản nháp. */
  publishedAt?: string

  /**
   * Mảng rỗng nghĩa là chưa ai phụ trách.
   *
   * Đó là tín hiệu quản trị viên phải thấy chứ không phải một danh sách trang trí: lớp không có
   * giáo viên thì không ai giao bài, và bài kiểm tra không bao giờ tới được học sinh trong đó.
   */
  teachers: GroupTeacher[]

  createdAt: string
}

// ===== Ngân hàng câu hỏi =====

export interface AnswerOption {
  id: number
  content: string
  imageUrl?: string
  isCorrect: boolean
}

export interface Question {
  id: number
  content: string
  imageUrl?: string
  topic: string
  difficulty: DifficultyLevel
  defaultPoint: number
  status: QuestionStatus
  updatedAt: string
  answers: AnswerOption[]
}

// ===== Bài kiểm tra =====

export interface Exam {
  id: number
  title: string
  description: string
  durationMinutes: number
  totalQuestions: number
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
  pointPerQuestion: number
  /** Chủ đề câu hỏi được dùng để sinh đề. Chuỗi rỗng nghĩa là lấy từ tất cả chủ đề. */
  topic: string
  shuffleQuestions: boolean
  shuffleAnswers: boolean

  /**
   * Mỗi học sinh một bộ câu hỏi riêng thay vì cả lớp chung một đề.
   *
   * Trước đây đây là **điều khiển giả**: giao diện có ô tích, tầng giả lập nhận cờ rồi bỏ qua.
   * Server làm thật — hạt giống sinh đề gắn với từng lượt giao bài.
   */
  randomizePerStudent: boolean

  assignedCount: number
  submittedCount: number
  lifecycle: ExamLifecycle
  openAt: string
  closeAt: string
  showResultAfterSubmit: boolean
  createdAt: string
}

export interface ExamAssignment {
  id: number
  examId: number
  studentId: number
  studentName: string
  studentCode: string
  group: string
  status: ExamStatus
  attemptId?: number
  score?: number
  startedAt?: string
  submittedAt?: string
}

/** Kết quả tổng hợp một lượt làm bài, dùng cho cả màn hình giáo viên và học sinh. */
export interface ResultSummary {
  attemptId: number
  examId: number
  examTitle: string
  topic: string
  topicColor: string
  studentId: number
  studentName: string
  studentCode: string
  group: string
  status: ExamStatus
  /** True khi hệ thống nộp hộ vì hết giờ, không phải học sinh tự bấm nộp. */
  autoSubmitted: boolean

  /**
   * `null` nghĩa là **chưa được phép xem**, không phải *bằng không*.
   *
   * Server bỏ hẳn ba trường điểm khỏi JSON khi người gọi chưa đủ điều kiện (§3 quy tắc ⑥), nên
   * giao diện phải phân biệt được hai trạng thái này: một bài bị giấu điểm và một bài được 0 điểm
   * trông giống hệt nhau nếu quy `null` về 0, và học sinh sẽ tưởng mình làm sai hết.
   */
  score: number | null
  maxScore: number | null
  correctCount: number | null

  totalQuestions: number
  /** Chuỗi rỗng khi bài chưa nộp. */
  submittedAt: string
  /** 0 khi bài chưa nộp. */
  durationMinutes: number
}

// ===== Làm bài =====

export interface AttemptQuestion {
  id: number
  ordinal: number
  content: string
  imageUrl?: string
  point: number
  /** Không có `isCorrect` — xem chú thích ở AttemptAnswerOption. */
  answers: AttemptAnswerOption[]
}

export interface AttemptSession {
  attemptId: number
  assignmentId: number
  examId: number
  examTitle: string
  durationMinutes: number

  /**
   * Mốc hết giờ **theo đồng hồ máy này**, đã hiệu chỉnh lệch giờ với server.
   *
   * Server gửi kèm giờ của chính nó, nên chênh lệch giữa hai đồng hồ được trừ đi ngay lúc nhận.
   * Không hiệu chỉnh thì một máy đặt sai giờ vài phút sẽ đếm ngược sai đúng chừng ấy — và học sinh
   * ngồi trong phòng thi không có cách nào biết đồng hồ trên màn hình đang nói dối.
   */
  expiresAtLocal: number

  remainingSeconds: number
  totalQuestions: number
  maxScore: number
  questions: AttemptQuestion[]
  /** Map questionId -> answerId đã lưu nháp. */
  savedAnswers: Record<number, number>
  /** Số thứ tự lần ghi cuối server đã nhận, để lần lưu nháp sau không lùi về sau nó. */
  lastAppliedSeq: number
}

/**
 * Một phương án trả lời khi xem lại bài đã làm.
 *
 * Cố ý **không có** `isCorrect`, khác với `AnswerOption` dùng ở màn hình soạn câu hỏi. Backend
 * dùng hai DTO tách biệt vì đúng lý do này (§3 quy tắc ①): trong ngữ cảnh bài làm, đáp án đúng chỉ
 * được nói ở cấp câu hỏi qua `correctAnswerId`, và chỉ khi người xem đủ điều kiện. Nếu tái dùng
 * `AnswerOption` ở đây thì kiểu dữ liệu tự nó mời gọi việc gắn cờ đúng/sai vào từng phương án —
 * và chỉ cần một lần gắn là đáp án rời server trong lúc học sinh còn đang làm bài.
 */
export interface AttemptAnswerOption {
  id: number
  content: string
  imageUrl?: string
}

export interface AttemptAnswerDetail {
  questionId: number
  ordinal: number
  content: string
  imageUrl?: string
  point: number
  answers: AttemptAnswerOption[]
  /** `null` khi học sinh bỏ trống câu này — và câu bỏ trống vẫn phải hiện ra. */
  selectedAnswerId: number | null

  /**
   * `null` khi người xem chưa được phép biết đáp án đúng.
   *
   * Server **không gửi** hai trường này thay vì gửi giá trị rỗng, nên chúng vắng mặt thật sự trong
   * JSON chứ không phải bị giao diện giấu đi — mở tab Network cũng không thấy gì.
   */
  correctAnswerId: number | null
  isCorrect: boolean | null
}

export interface AttemptDetail {
  attemptId: number
  examId: number
  examTitle: string
  topic: string
  topicColor: string
  studentId: number
  studentName: string
  studentCode: string
  group: string
  status: ExamStatus
  /** `null` nghĩa là chưa được phép xem — xem chú thích ở ResultSummary. */
  score: number | null
  maxScore: number | null
  correctCount: number | null
  totalQuestions: number
  /** Chuỗi rỗng khi bài chưa nộp. */
  submittedAt: string
  durationMinutes: number
  /** True khi hệ thống nộp hộ vì hết giờ. */
  autoSubmitted: boolean
  /** Giáo viên sở hữu đề luôn xem được đáp án; học sinh chỉ xem khi đề cho phép (§3 quy tắc ⑥). */
  showAnswers: boolean
  questions: AttemptAnswerDetail[]
}

/** Một dòng trong danh sách bài kiểm tra được giao của học sinh. */
export interface StudentExamItem {
  assignmentId: number
  examId: number
  name: string
  topic: string
  topicColor: string
  description: string
  teacher: string
  durationMinutes: number
  totalQuestions: number
  status: StudentExamItemStatus
  /** Server quyết định bài này có vào làm được ngay bây giờ không — không phải giao diện tự suy. */
  canStart: boolean
  openAt: string
  closeAt: string
  /**
   * Mốc đếm ngược trên giao diện: giờ hết bài với bài đang làm dở, giờ đóng đề với bài chưa vào.
   */
  deadline: Date
  attemptId?: number
  /** `null` nghĩa là chưa được phép xem điểm — xem chú thích ở ResultSummary. */
  score: number | null
  maxScore: number | null
  correctCount: number | null
}

// ===== Thông báo và hồ sơ =====

export interface AppNotification {
  id: number
  type: NotificationType
  title: string
  message: string
  createdAt: string
  isRead: boolean
  link?: string
}

export interface UserProfile {
  id: number
  role: UserRole
  fullName: string
  email: string
  username: string
  code?: string
  group?: string
  phone?: string
  school?: string
  subject?: string
  avatarColor: string
  joinedAt: string
}

// ===== Dashboard =====

export interface ActivityItem {
  id: number
  time: string
  text: string
  tone: ActivityTone
}

export interface TeacherDashboardStats {
  totalStudents: number
  totalQuestions: number
  totalExams: number
  assignedExams: number
  openExams: number
  submittedThisWeek: number
  /** `null` khi chưa có bài nào được chấm — không phải 0 điểm. */
  averageScore: number | null
}

export interface TeacherDashboardData {
  stats: TeacherDashboardStats
  recentExams: Exam[]
  activities: ActivityItem[]
}

export interface StudentDashboardStats {
  assignedCount: number
  completedCount: number
  /** `null` khi chưa có bài nào được cho xem điểm — xem chú thích ở ResultSummary. */
  averageScore: number | null
  bestScore: number | null
}

export interface StudentDashboardData {
  stats: StudentDashboardStats
  openExams: StudentExamItem[]
  upcomingExams: StudentExamItem[]
  recentResults: ResultSummary[]
}

// ===== Nhãn tiếng Việt =====

export const studentStatusLabels: Record<StudentStatus, string> = {
  active: 'Đang hoạt động',
  locked: 'Đã khoá',
  pendingDeletion: 'Chờ xoá',
  deleted: 'Đã xoá',
}

export const questionStatusLabels: Record<QuestionStatus, string> = {
  active: 'Đang dùng',
  hidden: 'Đã ẩn',
}

export const examStatusLabels: Record<ExamStatus, string> = {
  assigned: 'Đã giao',
  inprogress: 'Đang làm',
  submitted: 'Đã nộp',
  graded: 'Đã chấm',
  expired: 'Hết hạn',
}

export const lifecycleLabels: Record<ExamLifecycle, string> = {
  draft: 'Bản nháp',
  scheduled: 'Đã lên lịch',
  open: 'Đang mở',
  closed: 'Đã đóng',
}

export const difficultyLabels: Record<DifficultyLevel, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
}

export const notificationTypeLabels: Record<NotificationType, string> = {
  exam_assigned: 'Bài kiểm tra mới',
  exam_submitted: 'Học sinh nộp bài',
  exam_updated: 'Cập nhật bài kiểm tra',
  deadline_soon: 'Sắp hết hạn',
  auto_submitted: 'Tự động nộp bài',
}

export const studentExamItemStatusLabels: Record<StudentExamItemStatus, string> = {
  open: 'Đang mở',
  upcoming: 'Sắp diễn ra',
  inprogress: 'Đang làm dở',
  submitted: 'Đã nộp',
  graded: 'Đã chấm',
  expired: 'Hết hạn',
}
