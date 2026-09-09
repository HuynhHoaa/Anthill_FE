import {
  demoStudentId,
  mockAttemptAnswers,
  mockExams,
  mockQuestions,
  mockResults,
  mockStudents,
} from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { matchesSearch, paginate, parseDateTime, roundToOneDecimal } from '../lib/format'
import type {
  AttemptAnswerDetail,
  AttemptDetail,
  Exam,
  ExamStatus,
  Paged,
  Question,
  ResultSummary,
} from '../types'

export interface ListResultsParams {
  search?: string
  status?: 'all' | ExamStatus
  examId?: number
  studentId?: number
  group?: string
  page?: number
  pageSize?: number
}

export interface ResultStats {
  totalAttempts: number
  gradedCount: number
  averageScore: number
  passRate: number
}

const PASS_SCORE = 5

function sortByNewest(left: ResultSummary, right: ResultSummary): number {
  const leftTime = parseDateTime(left.submittedAt)?.getTime() ?? 0
  const rightTime = parseDateTime(right.submittedAt)?.getTime() ?? 0
  if (leftTime !== rightTime) return rightTime - leftTime
  return right.attemptId - left.attemptId
}

export function listResults(params: ListResultsParams): Promise<Paged<ResultSummary>> {
  return simulate(() => {
    const filtered = mockResults
      .filter(result => {
        if (!matchesSearch(params.search, [result.studentName, result.examTitle, result.group])) return false
        if (params.status && params.status !== 'all' && result.status !== params.status) return false
        if (params.examId !== undefined && result.examId !== params.examId) return false
        if (params.studentId !== undefined && result.studentId !== params.studentId) return false
        if (params.group && params.group !== 'all' && result.group !== params.group) return false
        return true
      })
      .sort(sortByNewest)

    const page = paginate(filtered, params.page, params.pageSize)
    return { ...page, items: page.items.map(result => ({ ...result })) }
  })
}

export function listMyResults(params: {
  search?: string
  page?: number
  pageSize?: number
}): Promise<Paged<ResultSummary>> {
  return simulate(() => {
    const filtered = mockResults
      .filter(result => result.studentId === demoStudentId)
      .filter(result => matchesSearch(params.search, [result.examTitle, result.group]))
      .sort(sortByNewest)

    const page = paginate(filtered, params.page, params.pageSize)
    return { ...page, items: page.items.map(result => ({ ...result })) }
  })
}

/**
 * Bộ sinh số giả ngẫu nhiên có hạt giống (Lehmer), để một lượt làm bài
 * luôn dựng ra cùng một bộ chi tiết mỗi lần mở lại trang.
 */
function createSeededRandom(seed: number): () => number {
  let state = Math.abs(Math.floor(seed)) % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function pickDeterministic<T>(items: T[], count: number, random: () => number): T[] {
  const pool = [...items]
  const picked: T[] = []
  const limit = Math.min(Math.max(0, count), pool.length)
  for (let index = 0; index < limit; index += 1) {
    const randomIndex = Math.floor(random() * pool.length)
    picked.push(pool.splice(randomIndex, 1)[0])
  }
  return picked
}

function shuffleDeterministic<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const temp = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = temp
  }
  return result
}

/**
 * Dựng chi tiết bài làm cho những lượt chỉ có kết quả tổng hợp.
 * Số câu đúng luôn khớp đúng correctCount của bản ghi kết quả.
 */
function buildSyntheticDetails(result: ResultSummary, exam: Exam | undefined): AttemptAnswerDetail[] {
  const random = createSeededRandom(result.attemptId)
  const pool = mockQuestions.filter(question => {
    if (question.status !== 'active') return false
    if (exam && exam.topic && question.topic !== exam.topic) return false
    return true
  })

  const questions: Question[] = pickDeterministic(pool, result.totalQuestions, random)
  const pointPerQuestion = exam
    ? exam.pointPerQuestion
    : roundToOneDecimal(result.maxScore / Math.max(1, result.totalQuestions))
  const correctCount = Math.min(result.correctCount, questions.length)
  const correctnessFlags = shuffleDeterministic(
    questions.map((_, index) => index < correctCount),
    random,
  )

  return questions.map((question, index) => {
    const correctAnswer = question.answers.find(answer => answer.isCorrect)
    const wrongAnswers = question.answers.filter(answer => !answer.isCorrect)
    const isCorrect = correctnessFlags[index] === true

    let selectedAnswerId: number | null = null
    if (isCorrect && correctAnswer) {
      selectedAnswerId = correctAnswer.id
    } else if (wrongAnswers.length > 0) {
      // Khoảng một phần tư câu sai để trống, giống thói quen làm bài thật.
      const skipped = random() < 0.25
      selectedAnswerId = skipped ? null : wrongAnswers[Math.floor(random() * wrongAnswers.length)].id
    }

    return {
      questionId: question.id,
      content: question.content,
      imageUrl: question.imageUrl,
      point: pointPerQuestion,
      answers: question.answers.map(answer => ({ ...answer })),
      selectedAnswerId,
      correctAnswerId: correctAnswer ? correctAnswer.id : 0,
      isCorrect,
    }
  })
}

export function getAttemptDetail(attemptId: number): Promise<AttemptDetail> {
  return simulate(() => {
    const result = mockResults.find(item => item.attemptId === attemptId)
    if (!result) {
      throw new Error('Không tìm thấy bài làm.')
    }

    const exam = mockExams.find(item => item.id === result.examId)
    const student = mockStudents.find(item => item.id === result.studentId)
    const storedDetails = mockAttemptAnswers[attemptId]
    const questions =
      storedDetails && storedDetails.length > 0
        ? storedDetails.map(detail => ({ ...detail, answers: detail.answers.map(answer => ({ ...answer })) }))
        : buildSyntheticDetails(result, exam)

    return {
      attemptId: result.attemptId,
      examId: result.examId,
      examTitle: result.examTitle,
      topic: exam ? exam.topic : '',
      studentId: result.studentId,
      studentName: result.studentName,
      studentCode: student ? student.code : '',
      group: result.group,
      status: result.status,
      score: result.score,
      maxScore: result.maxScore,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      submittedAt: result.submittedAt,
      durationMinutes: result.durationMinutes,
      // Cờ theo cấu hình của bài kiểm tra; màn hình giáo viên vẫn luôn được xem đáp án.
      showAnswers: exam ? exam.showResultAfterSubmit : true,
      questions,
    }
  })
}

export function getResultStats(): Promise<ResultStats> {
  return simulate(() => {
    const gradedResults = mockResults.filter(result => result.status === 'graded')
    const averageScore =
      gradedResults.length > 0
        ? roundToOneDecimal(
            gradedResults.reduce((total, result) => total + result.score, 0) / gradedResults.length,
          )
        : 0
    const passedCount = gradedResults.filter(result => result.score >= PASS_SCORE).length
    const passRate = gradedResults.length > 0 ? Math.round((passedCount / gradedResults.length) * 100) : 0

    return {
      totalAttempts: mockResults.length,
      gradedCount: gradedResults.length,
      averageScore,
      passRate,
    }
  })
}
