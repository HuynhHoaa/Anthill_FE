import {
  demoStudentId,
  mockExamAssignments,
  mockExams,
  mockNotifications,
  mockQuestions,
  mockStudentExamItems,
  mockStudentGroups,
  mockStudents,
  mockTeacherProfile,
} from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { matchesSearch, nextId, nowLabel, paginate, parseDateTime, todayLabel } from '../lib/format'
import { getTopicColor } from '../lib/topicTheme'
import { difficultyLabels } from '../types'
import type {
  DifficultyLevel,
  Exam,
  ExamAssignment,
  ExamLifecycle,
  Paged,
  StudentExamItem,
} from '../types'

export interface ExamPayload {
  title: string
  description: string
  durationMinutes: number
  totalQuestions: number
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
  pointPerQuestion: number
  topic: string
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  openAt: string
  closeAt: string
  showResultAfterSubmit: boolean
  /** Cho phép lưu bản nháp; nếu bỏ trống thì vòng đời được suy ra từ mốc mở và đóng. */
  lifecycle?: ExamLifecycle
}

export interface ListExamsParams {
  search?: string
  lifecycle?: 'all' | ExamLifecycle
  page?: number
  pageSize?: number
}

export interface BlueprintInput {
  totalQuestions: number
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
  topic?: string
}

export interface BlueprintPreview {
  required: Record<DifficultyLevel, number>
  available: Record<DifficultyLevel, number>
  isValid: boolean
  errors: string[]
}

export interface AssignExamPayload {
  studentIds: number[]
  groupIds: number[]
  randomizePerStudent: boolean
  notify: boolean
}

const difficultyOrder: DifficultyLevel[] = ['easy', 'medium', 'hard']

function findExam(id: number): Exam {
  const exam = mockExams.find(item => item.id === id)
  if (!exam) {
    throw new Error('Không tìm thấy bài kiểm tra.')
  }
  return exam
}

/**
 * Số câu cần lấy cho từng mức độ. Mức Khó nhận phần còn lại
 * để tổng luôn đúng bằng totalQuestions dù tỷ lệ có lẻ.
 */
export function calculateRequiredCounts(input: BlueprintInput): Record<DifficultyLevel, number> {
  const total = Math.max(0, Math.floor(input.totalQuestions))
  const easy = Math.min(total, Math.max(0, Math.round((total * input.easyPercentage) / 100)))
  const medium = Math.min(total - easy, Math.max(0, Math.round((total * input.mediumPercentage) / 100)))
  const hard = Math.max(0, total - easy - medium)
  return { easy, medium, hard }
}

/** Số câu đang dùng được trong ngân hàng, có lọc theo chủ đề nếu đề chỉ định. */
export function countAvailableQuestions(topic?: string): Record<DifficultyLevel, number> {
  const counts: Record<DifficultyLevel, number> = { easy: 0, medium: 0, hard: 0 }
  mockQuestions.forEach(question => {
    if (question.status !== 'active') return
    if (topic && topic !== 'all' && question.topic !== topic) return
    counts[question.difficulty] += 1
  })
  return counts
}

function buildBlueprintPreview(input: BlueprintInput): BlueprintPreview {
  const errors: string[] = []
  const required = calculateRequiredCounts(input)
  const available = countAvailableQuestions(input.topic)

  const totalPercentage = input.easyPercentage + input.mediumPercentage + input.hardPercentage
  if (totalPercentage !== 100) {
    errors.push(`Tổng tỷ lệ phải bằng 100%, hiện tại là ${totalPercentage}%`)
  }
  if (!Number.isFinite(input.totalQuestions) || input.totalQuestions < 1) {
    errors.push('Số câu hỏi của đề phải lớn hơn 0')
  }

  difficultyOrder.forEach(level => {
    if (required[level] > available[level]) {
      errors.push(
        `Không đủ câu ${difficultyLabels[level]}: cần ${required[level]} nhưng ngân hàng chỉ có ${available[level]}`,
      )
    }
  })

  return { required, available, isValid: errors.length === 0, errors }
}

/** Suy ra vòng đời từ mốc mở và mốc đóng so với thời điểm hiện tại. */
function resolveLifecycle(openAt: string, closeAt: string, override?: ExamLifecycle): ExamLifecycle {
  if (override) return override
  const openDate = parseDateTime(openAt)
  const closeDate = parseDateTime(closeAt)
  if (!openDate || !closeDate) return 'draft'

  const now = Date.now()
  if (now < openDate.getTime()) return 'scheduled'
  if (now > closeDate.getTime()) return 'closed'
  return 'open'
}

function validatePayload(payload: ExamPayload): ExamPayload {
  const title = payload.title.trim()

  if (!title) {
    throw new Error('Tên bài kiểm tra không được để trống.')
  }
  if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes < 1) {
    throw new Error('Thời gian làm bài phải lớn hơn 0 phút.')
  }
  if (payload.durationMinutes > 300) {
    throw new Error('Thời gian làm bài không được vượt quá 300 phút.')
  }
  if (!Number.isFinite(payload.totalQuestions) || payload.totalQuestions < 1) {
    throw new Error('Số câu hỏi của đề phải lớn hơn 0.')
  }
  if (!Number.isFinite(payload.pointPerQuestion) || payload.pointPerQuestion <= 0) {
    throw new Error('Điểm mỗi câu phải lớn hơn 0.')
  }

  const openDate = parseDateTime(payload.openAt)
  const closeDate = parseDateTime(payload.closeAt)
  if (openDate && closeDate && closeDate.getTime() <= openDate.getTime()) {
    throw new Error('Thời gian đóng bài phải sau thời gian mở bài.')
  }

  const lifecycle = resolveLifecycle(payload.openAt, payload.closeAt, payload.lifecycle)
  if (lifecycle !== 'draft') {
    const preview = buildBlueprintPreview(payload)
    if (!preview.isValid) {
      throw new Error(preview.errors.join('. ') + '.')
    }
  }

  return { ...payload, title, description: payload.description.trim() }
}

function applyPayload(exam: Exam, payload: ExamPayload): void {
  exam.title = payload.title
  exam.description = payload.description
  exam.durationMinutes = payload.durationMinutes
  exam.totalQuestions = payload.totalQuestions
  exam.easyPercentage = payload.easyPercentage
  exam.mediumPercentage = payload.mediumPercentage
  exam.hardPercentage = payload.hardPercentage
  exam.pointPerQuestion = payload.pointPerQuestion
  exam.topic = payload.topic
  exam.shuffleQuestions = payload.shuffleQuestions
  exam.shuffleAnswers = payload.shuffleAnswers
  exam.openAt = payload.openAt
  exam.closeAt = payload.closeAt
  exam.showResultAfterSubmit = payload.showResultAfterSubmit
  exam.lifecycle = resolveLifecycle(payload.openAt, payload.closeAt, payload.lifecycle)
}

/** Đồng bộ lại số lượt giao và số lượt nộp từ bảng giao bài. */
export function syncExamCounters(examId: number): void {
  const exam = mockExams.find(item => item.id === examId)
  if (!exam) return
  const assignments = mockExamAssignments.filter(assignment => assignment.examId === examId)
  exam.assignedCount = assignments.length
  exam.submittedCount = assignments.filter(
    assignment => assignment.status === 'submitted' || assignment.status === 'graded',
  ).length
}

export function listExams(params: ListExamsParams): Promise<Paged<Exam>> {
  return simulate(() => {
    const filtered = mockExams.filter(exam => {
      if (!matchesSearch(params.search, [exam.title, exam.topic, exam.description])) {
        return false
      }
      if (params.lifecycle && params.lifecycle !== 'all' && exam.lifecycle !== params.lifecycle) {
        return false
      }
      return true
    })

    const page = paginate(filtered, params.page, params.pageSize)
    return { ...page, items: page.items.map(exam => ({ ...exam })) }
  })
}

export function getExam(id: number): Promise<Exam> {
  return simulate(() => ({ ...findExam(id) }))
}

export function createExam(payload: ExamPayload): Promise<Exam> {
  return simulate(() => {
    const validated = validatePayload(payload)
    const exam: Exam = {
      id: nextId(mockExams),
      title: validated.title,
      description: validated.description,
      durationMinutes: validated.durationMinutes,
      totalQuestions: validated.totalQuestions,
      easyPercentage: validated.easyPercentage,
      mediumPercentage: validated.mediumPercentage,
      hardPercentage: validated.hardPercentage,
      pointPerQuestion: validated.pointPerQuestion,
      topic: validated.topic,
      shuffleQuestions: validated.shuffleQuestions,
      shuffleAnswers: validated.shuffleAnswers,
      assignedCount: 0,
      submittedCount: 0,
      status: 'assigned',
      lifecycle: resolveLifecycle(validated.openAt, validated.closeAt, validated.lifecycle),
      openAt: validated.openAt,
      closeAt: validated.closeAt,
      showResultAfterSubmit: validated.showResultAfterSubmit,
      createdAt: todayLabel(),
    }

    mockExams.unshift(exam)
    return { ...exam }
  })
}

export function updateExam(id: number, payload: ExamPayload): Promise<Exam> {
  return simulate(() => {
    const exam = findExam(id)
    const validated = validatePayload(payload)
    applyPayload(exam, validated)
    return { ...exam }
  })
}

export function deleteExam(id: number): Promise<void> {
  return simulate(() => {
    const exam = findExam(id)
    if (exam.submittedCount > 0) {
      throw new Error('Không thể xóa bài kiểm tra đã có học sinh nộp bài.')
    }

    for (let index = mockExamAssignments.length - 1; index >= 0; index -= 1) {
      if (mockExamAssignments[index].examId === id) {
        mockExamAssignments.splice(index, 1)
      }
    }
    for (let index = mockStudentExamItems.length - 1; index >= 0; index -= 1) {
      if (mockStudentExamItems[index].examId === id) {
        mockStudentExamItems.splice(index, 1)
      }
    }

    const examIndex = mockExams.findIndex(item => item.id === id)
    mockExams.splice(examIndex, 1)
  })
}

export function previewBlueprint(payload: BlueprintInput): Promise<BlueprintPreview> {
  return simulate(() => buildBlueprintPreview(payload))
}

export function listExamAssignments(examId: number): Promise<ExamAssignment[]> {
  return simulate(() => {
    findExam(examId)
    return mockExamAssignments
      .filter(assignment => assignment.examId === examId)
      .map(assignment => ({ ...assignment }))
      .sort((left, right) => left.studentCode.localeCompare(right.studentCode, 'vi'))
  })
}

/** Gom học sinh được chọn trực tiếp và học sinh thuộc các nhóm đã chọn. */
function resolveTargetStudentIds(payload: AssignExamPayload): number[] {
  const targetIds = new Set<number>()
  payload.studentIds.forEach(studentId => {
    if (mockStudents.some(student => student.id === studentId)) {
      targetIds.add(studentId)
    }
  })
  payload.groupIds.forEach(groupId => {
    if (!mockStudentGroups.some(group => group.id === groupId)) return
    mockStudents.forEach(student => {
      if (student.groupId === groupId) targetIds.add(student.id)
    })
  })
  return Array.from(targetIds)
}

/** Bổ sung bài mới vào danh sách của học sinh demo để màn hình học sinh thấy ngay. */
function addExamToDemoStudent(exam: Exam): void {
  if (mockStudentExamItems.some(item => item.examId === exam.id)) return

  const closeDate = parseDateTime(exam.closeAt) ?? new Date()
  const status: StudentExamItem['status'] =
    exam.lifecycle === 'open' ? 'open' : exam.lifecycle === 'closed' ? 'expired' : 'upcoming'

  mockStudentExamItems.unshift({
    assignmentId: exam.id * 100 + demoStudentId,
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
    deadline: closeDate,
  })
}

export function assignExam(examId: number, payload: AssignExamPayload): Promise<{ assignedCount: number }> {
  return simulate(() => {
    const exam = findExam(examId)
    const targetIds = resolveTargetStudentIds(payload)
    if (targetIds.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một học sinh hoặc một nhóm lớp.')
    }

    // randomizePerStudent chưa làm đổi dữ liệu vì mỗi lượt làm bài đều tự sinh đề riêng.
    let assignedCount = 0
    targetIds.forEach(studentId => {
      const alreadyAssigned = mockExamAssignments.some(
        assignment => assignment.examId === examId && assignment.studentId === studentId,
      )
      if (alreadyAssigned) return

      const student = mockStudents.find(item => item.id === studentId)
      if (!student) return

      mockExamAssignments.push({
        id: examId * 100 + studentId,
        examId,
        studentId,
        studentName: student.fullName,
        studentCode: student.code,
        group: student.group,
        status: 'assigned',
      })
      assignedCount += 1

      if (studentId === demoStudentId) {
        addExamToDemoStudent(exam)
      }
    })

    syncExamCounters(examId)

    if (payload.notify && assignedCount > 0) {
      mockNotifications.unshift({
        id: nextId(mockNotifications),
        audience: 'student',
        type: 'exam_assigned',
        title: 'Bạn có bài kiểm tra mới',
        message: `Giáo viên đã giao bài "${exam.title}" cho bạn. Hãy hoàn thành trước hạn nộp.`,
        createdAt: nowLabel(),
        isRead: false,
        link: '/hoc-sinh/bai-kiem-tra',
      })
    }

    return { assignedCount }
  })
}
