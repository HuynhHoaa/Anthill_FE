import {
  demoStudentId,
  mockAttemptAnswers,
  mockExamAssignments,
  mockExams,
  mockNotifications,
  mockQuestions,
  mockResults,
  mockStudentExamItems,
  mockStudents,
  mockTeacherProfile,
} from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { matchesSearch, nextId, nowLabel, parseDateTime, roundToOneDecimal } from '../lib/format'
import { getTopicColor } from '../lib/topicTheme'
import { calculateRequiredCounts, syncExamCounters } from './examService'
import type {
  AnswerOption,
  AttemptAnswerDetail,
  AttemptQuestion,
  AttemptSession,
  DifficultyLevel,
  Exam,
  Question,
  StudentExamItem,
  StudentExamItemStatus,
} from '../types'

export interface ListMyExamsParams {
  search?: string
  tab?: 'all' | 'open' | 'upcoming' | 'done' | 'expired'
}

export interface SubmitAttemptResult {
  attemptId: number
  score: number
  maxScore: number
  correctCount: number
  totalQuestions: number
  showResult: boolean
}

/** Bài làm đang dở, giữ trong bộ nhớ và mirror sang localStorage để tải lại trang không mất bài. */
interface StoredAttempt {
  attemptId: number
  assignmentId: number
  examId: number
  examTitle: string
  topic: string
  durationMinutes: number
  /** Mốc hết giờ theo đồng hồ máy, dùng để tính lại số giây còn lại sau khi tải lại trang. */
  expiresAt: number
  questions: AttemptQuestion[]
  savedAnswers: Record<number, number>
}

// Bản ghi của build cũ có subject và thiếu topic, hydrate lại sẽ hiện 'undefined' nên phải đổi tiền tố.
const ATTEMPT_STORAGE_PREFIX = 'eduquiz.attempt.v2.'
const difficultyOrder: DifficultyLevel[] = ['easy', 'medium', 'hard']
const statusPriority: Record<StudentExamItemStatus, number> = {
  open: 0,
  upcoming: 1,
  submitted: 2,
  graded: 3,
  expired: 4,
}

const activeAttempts = new Map<number, StoredAttempt>()

function buildAssignmentId(examId: number, studentId: number): number {
  return examId * 100 + studentId
}

function buildAttemptId(examId: number, studentId: number): number {
  return 5000 + examId * 100 + studentId
}

function findExam(examId: number): Exam {
  const exam = mockExams.find(item => item.id === examId)
  if (!exam) {
    throw new Error('Không tìm thấy bài kiểm tra.')
  }
  return exam
}

// ===== Lưu tạm bài làm =====

function readStoredAttempt(attemptId: number): StoredAttempt | undefined {
  const cached = activeAttempts.get(attemptId)
  if (cached) return cached

  try {
    const raw = window.localStorage.getItem(`${ATTEMPT_STORAGE_PREFIX}${attemptId}`)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return undefined
    const candidate = parsed as Partial<StoredAttempt>
    if (typeof candidate.attemptId !== 'number' || !Array.isArray(candidate.questions)) return undefined
    activeAttempts.set(attemptId, candidate as StoredAttempt)
    return candidate as StoredAttempt
  } catch {
    return undefined
  }
}

function writeStoredAttempt(attempt: StoredAttempt): void {
  activeAttempts.set(attempt.attemptId, attempt)
  try {
    window.localStorage.setItem(`${ATTEMPT_STORAGE_PREFIX}${attempt.attemptId}`, JSON.stringify(attempt))
  } catch {
    // Không lưu được thì bài làm vẫn sống trong bộ nhớ cho tới khi rời trang.
  }
}

function clearStoredAttempt(attemptId: number): void {
  activeAttempts.delete(attemptId)
  try {
    window.localStorage.removeItem(`${ATTEMPT_STORAGE_PREFIX}${attemptId}`)
  } catch {
    // Không cần xử lý thêm.
  }
}

function toSession(attempt: StoredAttempt): AttemptSession {
  return {
    attemptId: attempt.attemptId,
    assignmentId: attempt.assignmentId,
    examId: attempt.examId,
    examTitle: attempt.examTitle,
    topic: attempt.topic,
    durationMinutes: attempt.durationMinutes,
    remainingSeconds: Math.max(0, Math.round((attempt.expiresAt - Date.now()) / 1000)),
    questions: attempt.questions.map(question => ({
      ...question,
      answers: question.answers.map(answer => ({ ...answer })),
    })),
    savedAnswers: { ...attempt.savedAnswers },
  }
}

// ===== Sinh đề =====

function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items]
  const picked: T[] = []
  const limit = Math.min(Math.max(0, count), pool.length)
  for (let index = 0; index < limit; index += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(randomIndex, 1)[0])
  }
  return picked
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const temp = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = temp
  }
  return result
}

/**
 * Sinh đề theo blueprint của bài kiểm tra.
 * Nếu ngân hàng thiếu câu ở một mức độ nào đó thì lấy tối đa có thể thay vì báo lỗi.
 */
function buildAttemptQuestions(exam: Exam): AttemptQuestion[] {
  const required = calculateRequiredCounts(exam)
  const pool = mockQuestions.filter(question => {
    if (question.status !== 'active') return false
    if (exam.topic && question.topic !== exam.topic) return false
    return true
  })

  const selected: Question[] = []
  difficultyOrder.forEach(level => {
    const candidates = pool.filter(question => question.difficulty === level)
    selected.push(...pickRandom(candidates, required[level]))
  })

  const ordered = exam.shuffleQuestions ? shuffle(selected) : selected
  return ordered.map(question => {
    const answers = exam.shuffleAnswers ? shuffle(question.answers) : question.answers
    return {
      id: question.id,
      content: question.content,
      imageUrl: question.imageUrl,
      topic: question.topic,
      point: exam.pointPerQuestion,
      // Không gửi kèm đáp án đúng xuống giao diện, việc chấm điểm do tầng service đảm nhiệm.
      answers: answers.map(answer => ({
        id: answer.id,
        content: answer.content,
        imageUrl: answer.imageUrl,
        isCorrect: false,
      })),
    }
  })
}

// ===== Danh sách bài kiểm tra của học sinh =====

function matchesTab(status: StudentExamItemStatus, tab: ListMyExamsParams['tab']): boolean {
  if (!tab || tab === 'all') return true
  if (tab === 'done') return status === 'submitted' || status === 'graded'
  return status === tab
}

export function listMyExams(params: ListMyExamsParams): Promise<StudentExamItem[]> {
  return simulate(() => {
    return mockStudentExamItems
      .filter(item => matchesSearch(params.search, [item.name, item.topic, item.description, item.teacher]))
      .filter(item => matchesTab(item.status, params.tab))
      .map(item => ({ ...item }))
      .sort((left, right) => {
        const priorityGap = statusPriority[left.status] - statusPriority[right.status]
        if (priorityGap !== 0) return priorityGap
        // Bài sắp hết hạn lên trước, bài đã xong thì bài mới nhất lên trước.
        const isPending = left.status === 'open' || left.status === 'upcoming'
        const gap = left.deadline.getTime() - right.deadline.getTime()
        return isPending ? gap : -gap
      })
  })
}

function findStudentExamItem(assignmentId: number): StudentExamItem | undefined {
  return mockStudentExamItems.find(item => item.assignmentId === assignmentId)
}

/** Dựng lại một mục bài kiểm tra từ bảng giao bài khi học sinh mở trực tiếp bằng đường dẫn. */
function buildItemFromAssignment(assignmentId: number): StudentExamItem {
  const assignment = mockExamAssignments.find(item => item.id === assignmentId)
  if (!assignment) {
    throw new Error('Không tìm thấy bài kiểm tra được giao.')
  }

  const exam = findExam(assignment.examId)
  const status: StudentExamItemStatus =
    assignment.status === 'graded'
      ? 'graded'
      : assignment.status === 'submitted'
        ? 'submitted'
        : assignment.status === 'expired'
          ? 'expired'
          : exam.lifecycle === 'open'
            ? 'open'
            : exam.lifecycle === 'closed'
              ? 'expired'
              : 'upcoming'

  return {
    assignmentId: assignment.id,
    examId: exam.id,
    name: exam.title,
    topic: exam.topic,
    topicColor: getTopicColor(exam.topic),
    description: exam.description,
    teacher: mockTeacherProfile.fullName,
    durationMinutes: exam.durationMinutes,
    totalQuestions: exam.totalQuestions,
    status,
    openAt: exam.openAt,
    closeAt: exam.closeAt,
    deadline: parseDateTime(exam.closeAt) ?? new Date(),
    attemptId: assignment.attemptId,
    score: assignment.score,
  }
}

export function getAssignment(assignmentId: number): Promise<StudentExamItem> {
  return simulate(() => {
    const item = findStudentExamItem(assignmentId) ?? buildItemFromAssignment(assignmentId)
    return { ...item }
  })
}

// ===== Làm bài =====

export function startAttempt(assignmentId: number): Promise<AttemptSession> {
  return simulate(() => {
    const item = findStudentExamItem(assignmentId) ?? buildItemFromAssignment(assignmentId)

    if (item.status === 'submitted' || item.status === 'graded') {
      throw new Error('Bạn đã nộp bài kiểm tra này rồi.')
    }
    if (item.status === 'expired') {
      throw new Error('Bài kiểm tra đã hết hạn nộp.')
    }
    if (item.status === 'upcoming') {
      throw new Error('Bài kiểm tra chưa đến giờ làm bài.')
    }

    const exam = findExam(item.examId)
    const attemptId = buildAttemptId(exam.id, demoStudentId)

    // Đang làm dở và vẫn còn thời gian thì làm tiếp thay vì sinh đề mới.
    const existing = readStoredAttempt(attemptId)
    if (existing && existing.expiresAt > Date.now()) {
      return toSession(existing)
    }

    const questions = buildAttemptQuestions(exam)
    if (questions.length === 0) {
      throw new Error('Ngân hàng câu hỏi chưa có câu nào phù hợp với đề này.')
    }

    const attempt: StoredAttempt = {
      attemptId,
      assignmentId: item.assignmentId,
      examId: exam.id,
      examTitle: exam.title,
      topic: exam.topic,
      durationMinutes: exam.durationMinutes,
      expiresAt: Date.now() + exam.durationMinutes * 60 * 1000,
      questions,
      savedAnswers: {},
    }
    writeStoredAttempt(attempt)

    const assignment = mockExamAssignments.find(record => record.id === item.assignmentId)
    if (assignment && assignment.status === 'assigned') {
      assignment.status = 'inprogress'
      assignment.attemptId = attemptId
      assignment.startedAt = nowLabel()
    }

    return toSession(attempt)
  })
}

export function getAttempt(attemptId: number): Promise<AttemptSession> {
  return simulate(() => {
    const attempt = readStoredAttempt(attemptId)
    if (!attempt) {
      throw new Error('Không tìm thấy bài làm. Vui lòng vào lại bài kiểm tra để bắt đầu.')
    }
    return toSession(attempt)
  })
}

export function saveAnswers(attemptId: number, answers: Record<number, number>): Promise<void> {
  return simulate(() => {
    const attempt = readStoredAttempt(attemptId)
    if (!attempt) {
      throw new Error('Không lưu được bài làm vì phiên làm bài đã kết thúc.')
    }
    attempt.savedAnswers = { ...attempt.savedAnswers, ...answers }
    writeStoredAttempt(attempt)
  })
}

// ===== Chấm điểm và nộp bài =====

function buildAnswerDetails(
  attempt: StoredAttempt,
  answers: Record<number, number>,
  pointPerQuestion: number,
): AttemptAnswerDetail[] {
  return attempt.questions.map(question => {
    const bankQuestion = mockQuestions.find(item => item.id === question.id)
    const bankAnswers = bankQuestion ? bankQuestion.answers : []
    // Giữ đúng thứ tự đáp án mà học sinh đã nhìn thấy khi làm bài.
    const orderedAnswers = question.answers
      .map(answer => bankAnswers.find(bankAnswer => bankAnswer.id === answer.id))
      .filter((answer): answer is AnswerOption => Boolean(answer))
    const correctAnswer = bankAnswers.find(answer => answer.isCorrect)
    const selectedAnswer = answers[question.id]
    const selectedAnswerId: number | null = typeof selectedAnswer === 'number' ? selectedAnswer : null

    return {
      questionId: question.id,
      content: question.content,
      imageUrl: question.imageUrl,
      point: pointPerQuestion,
      answers: orderedAnswers.length > 0 ? orderedAnswers : question.answers,
      selectedAnswerId,
      correctAnswerId: correctAnswer ? correctAnswer.id : 0,
      isCorrect: correctAnswer !== undefined && selectedAnswerId === correctAnswer.id,
    }
  })
}

/** Tính lại số bài đã hoàn thành và điểm trung bình của học sinh từ bảng kết quả. */
function syncStudentStats(studentId: number): void {
  const student = mockStudents.find(item => item.id === studentId)
  if (!student) return

  const studentResults = mockResults.filter(result => result.studentId === studentId)
  const gradedResults = studentResults.filter(result => result.status === 'graded')
  student.completedExams = studentResults.length
  student.averageScore =
    gradedResults.length > 0
      ? roundToOneDecimal(
          gradedResults.reduce((total, result) => total + result.score, 0) / gradedResults.length,
        )
      : 0
}

export function submitAttempt(
  attemptId: number,
  answers: Record<number, number>,
  autoSubmitted: boolean,
): Promise<SubmitAttemptResult> {
  return simulate(() => {
    const attempt = readStoredAttempt(attemptId)
    if (!attempt) {
      throw new Error('Không tìm thấy bài làm để nộp.')
    }

    const exam = findExam(attempt.examId)
    const finalAnswers = { ...attempt.savedAnswers, ...answers }
    const details = buildAnswerDetails(attempt, finalAnswers, exam.pointPerQuestion)

    const totalQuestions = details.length
    const correctCount = details.filter(detail => detail.isCorrect).length
    const maxScore = roundToOneDecimal(totalQuestions * exam.pointPerQuestion)
    const score = totalQuestions > 0 ? roundToOneDecimal((correctCount / totalQuestions) * maxScore) : 0
    const resultStatus = exam.showResultAfterSubmit ? 'graded' : 'submitted'
    const submittedAt = nowLabel()
    const spentMinutes = Math.max(
      1,
      Math.round(exam.durationMinutes - Math.max(0, attempt.expiresAt - Date.now()) / 60000),
    )

    mockAttemptAnswers[attemptId] = details

    const existingResultIndex = mockResults.findIndex(result => result.attemptId === attemptId)
    if (existingResultIndex !== -1) {
      mockResults.splice(existingResultIndex, 1)
    }
    const student = mockStudents.find(item => item.id === demoStudentId)
    mockResults.unshift({
      attemptId,
      examId: exam.id,
      examTitle: exam.title,
      studentId: demoStudentId,
      studentName: student ? student.fullName : mockTeacherProfile.fullName,
      group: student ? student.group : '',
      status: resultStatus,
      score,
      maxScore,
      correctCount,
      totalQuestions,
      submittedAt,
      durationMinutes: spentMinutes,
    })

    const assignment = mockExamAssignments.find(
      record => record.id === buildAssignmentId(exam.id, demoStudentId),
    )
    if (assignment) {
      assignment.status = resultStatus
      assignment.attemptId = attemptId
      assignment.score = exam.showResultAfterSubmit ? score : undefined
      assignment.submittedAt = submittedAt
    }

    const item = findStudentExamItem(attempt.assignmentId)
    if (item) {
      item.status = resultStatus
      item.attemptId = attemptId
      item.maxScore = maxScore
      item.score = exam.showResultAfterSubmit ? score : undefined
      item.correctCount = exam.showResultAfterSubmit ? correctCount : undefined
    }

    syncExamCounters(exam.id)
    syncStudentStats(demoStudentId)

    mockNotifications.unshift({
      id: nextId(mockNotifications),
      audience: 'teacher',
      type: autoSubmitted ? 'auto_submitted' : 'exam_submitted',
      title: autoSubmitted ? 'Hệ thống tự động nộp bài' : 'Học sinh vừa nộp bài',
      message: autoSubmitted
        ? `Bài làm của ${student ? student.fullName : 'học sinh'} đã được tự động nộp khi hết giờ.`
        : `${student ? student.fullName : 'Học sinh'} đã nộp bài "${exam.title}".`,
      createdAt: submittedAt,
      isRead: false,
      link: `/giao-vien/ket-qua/${attemptId}`,
    })
    mockNotifications.unshift({
      id: nextId(mockNotifications),
      audience: 'student',
      type: autoSubmitted ? 'auto_submitted' : 'exam_submitted',
      title: autoSubmitted ? 'Bài làm đã được nộp tự động' : 'Nộp bài thành công',
      message: autoSubmitted
        ? `Hết thời gian làm bài, hệ thống đã tự động nộp bài "${exam.title}" giúp bạn.`
        : `Bạn đã nộp bài "${exam.title}".`,
      createdAt: submittedAt,
      isRead: false,
      link: exam.showResultAfterSubmit ? `/hoc-sinh/ket-qua/${attemptId}` : '/hoc-sinh/ket-qua',
    })

    clearStoredAttempt(attemptId)

    return {
      attemptId,
      score,
      maxScore,
      correctCount,
      totalQuestions,
      showResult: exam.showResultAfterSubmit,
    }
  })
}
