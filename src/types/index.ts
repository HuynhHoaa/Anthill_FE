/**
 * Nguồn sự thật duy nhất về type nghiệp vụ của EduQuiz.
 * Mọi feature, service và mock data đều import từ đây.
 */

// ===== Enum nghiệp vụ =====

export type UserRole = 'teacher' | 'student' | 'admin'

/** Vai trò được xem chi tiết bài làm. Quản trị viên đứng ngoài vòng này. */
export type ResultAudience = 'teacher' | 'student'

export type StudentStatus = 'active' | 'locked'

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
export type StudentExamItemStatus = 'open' | 'upcoming' | 'submitted' | 'graded' | 'expired'

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
}

export interface StudentGroup {
  id: number
  name: string
  description: string
  studentCount: number
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
  assignedCount: number
  submittedCount: number
  status: ExamStatus
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
  studentId: number
  studentName: string
  group: string
  status: ExamStatus
  score: number
  maxScore: number
  correctCount: number
  totalQuestions: number
  submittedAt: string
  durationMinutes: number
}

// ===== Làm bài =====

export interface AttemptQuestion {
  id: number
  content: string
  imageUrl?: string
  topic: string
  point: number
  answers: AnswerOption[]
}

export interface AttemptSession {
  attemptId: number
  assignmentId: number
  examId: number
  examTitle: string
  topic: string
  durationMinutes: number
  remainingSeconds: number
  questions: AttemptQuestion[]
  /** Map questionId -> answerId đã lưu nháp. */
  savedAnswers: Record<number, number>
}

export interface AttemptAnswerDetail {
  questionId: number
  content: string
  imageUrl?: string
  point: number
  answers: AnswerOption[]
  selectedAnswerId: number | null
  correctAnswerId: number
  isCorrect: boolean
}

export interface AttemptDetail {
  attemptId: number
  examId: number
  examTitle: string
  topic: string
  studentId: number
  studentName: string
  studentCode: string
  group: string
  status: ExamStatus
  score: number
  maxScore: number
  correctCount: number
  totalQuestions: number
  submittedAt: string
  durationMinutes: number
  /** Giáo viên luôn xem được đáp án, học sinh chỉ xem khi bài kiểm tra cho phép. */
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
  openAt: string
  closeAt: string
  /** Mốc thời gian thật để đếm ngược trên giao diện. */
  deadline: Date
  attemptId?: number
  score?: number
  correctCount?: number
  maxScore?: number
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
  averageScore: number
}

export interface TeacherDashboardData {
  stats: TeacherDashboardStats
  recentExams: Exam[]
  activities: ActivityItem[]
}

export interface StudentDashboardStats {
  assignedCount: number
  completedCount: number
  averageScore: number
  bestScore: number
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
  locked: 'Đã khóa',
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
  submitted: 'Đã nộp',
  graded: 'Đã chấm',
  expired: 'Hết hạn',
}
