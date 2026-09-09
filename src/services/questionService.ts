import { mockQuestions } from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { matchesSearch, nextId, paginate, todayLabel } from '../lib/format'
import type { AnswerOption, DifficultyLevel, Paged, Question, QuestionStatus } from '../types'

export interface QuestionPayload {
  content: string
  imageUrl?: string
  topic: string
  difficulty: DifficultyLevel
  defaultPoint: number
  status: QuestionStatus
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

function findQuestion(id: number): Question {
  const question = mockQuestions.find(item => item.id === id)
  if (!question) {
    throw new Error('Không tìm thấy câu hỏi.')
  }
  return question
}

function cloneQuestion(question: Question): Question {
  return { ...question, answers: question.answers.map(answer => ({ ...answer })) }
}

/**
 * Chuẩn hoá danh sách đáp án và cấp lại id theo quy ước idCâuHỏi * 10 + vị trí,
 * nhờ vậy id đáp án là duy nhất trên toàn hệ thống.
 */
function buildAnswers(questionId: number, answers: AnswerOption[]): AnswerOption[] {
  return answers.map((answer, index) => ({
    id: questionId * 10 + index + 1,
    content: answer.content.trim(),
    imageUrl: answer.imageUrl,
    isCorrect: answer.isCorrect,
  }))
}

function validatePayload(payload: QuestionPayload): QuestionPayload {
  const content = payload.content.trim()
  const topic = payload.topic.trim()

  if (!content) {
    throw new Error('Nội dung câu hỏi không được để trống.')
  }
  if (!topic) {
    throw new Error('Vui lòng chọn hoặc nhập chủ đề cho câu hỏi.')
  }
  if (!Number.isFinite(payload.defaultPoint) || payload.defaultPoint <= 0) {
    throw new Error('Điểm mặc định phải lớn hơn 0.')
  }
  if (payload.answers.length < 2) {
    throw new Error('Câu hỏi phải có ít nhất 2 đáp án.')
  }
  if (payload.answers.some(answer => !answer.content.trim() && !answer.imageUrl)) {
    throw new Error('Nội dung đáp án không được để trống.')
  }

  const correctCount = payload.answers.filter(answer => answer.isCorrect).length
  if (correctCount === 0) {
    throw new Error('Vui lòng chọn một đáp án đúng.')
  }
  if (correctCount > 1) {
    throw new Error('Mỗi câu hỏi chỉ được có đúng một đáp án đúng.')
  }

  return { ...payload, content, topic }
}

export function listQuestions(params: ListQuestionsParams): Promise<Paged<Question>> {
  return simulate(() => {
    const filtered = mockQuestions.filter(question => {
      if (!matchesSearch(params.search, [question.content, question.topic])) return false
      if (params.topic && params.topic !== 'all' && question.topic !== params.topic) return false
      if (params.difficulty && params.difficulty !== 'all' && question.difficulty !== params.difficulty) {
        return false
      }
      if (params.status && params.status !== 'all' && question.status !== params.status) return false
      return true
    })

    const page = paginate(filtered, params.page, params.pageSize)
    return { ...page, items: page.items.map(cloneQuestion) }
  })
}

export function listTopics(): Promise<string[]> {
  return simulate(() => {
    const topics = new Set(mockQuestions.map(question => question.topic).filter(Boolean))
    return Array.from(topics).sort((left, right) => left.localeCompare(right, 'vi'))
  })
}

/** Số câu theo từng mức độ, tính trên toàn bộ ngân hàng kể cả câu đang ẩn. */
export function countByDifficulty(): Promise<Record<DifficultyLevel, number>> {
  return simulate(() => {
    const counts: Record<DifficultyLevel, number> = { easy: 0, medium: 0, hard: 0 }
    mockQuestions.forEach(question => {
      counts[question.difficulty] += 1
    })
    return counts
  })
}

export function getQuestion(id: number): Promise<Question> {
  return simulate(() => cloneQuestion(findQuestion(id)))
}

export function createQuestion(payload: QuestionPayload): Promise<Question> {
  return simulate(() => {
    const validated = validatePayload(payload)
    const id = nextId(mockQuestions)
    const question: Question = {
      id,
      content: validated.content,
      imageUrl: validated.imageUrl,
      topic: validated.topic,
      difficulty: validated.difficulty,
      defaultPoint: validated.defaultPoint,
      status: validated.status,
      updatedAt: todayLabel(),
      answers: buildAnswers(id, validated.answers),
    }

    mockQuestions.unshift(question)
    return cloneQuestion(question)
  })
}

export function updateQuestion(id: number, payload: QuestionPayload): Promise<Question> {
  return simulate(() => {
    const question = findQuestion(id)
    const validated = validatePayload(payload)

    question.content = validated.content
    question.imageUrl = validated.imageUrl
    question.topic = validated.topic
    question.difficulty = validated.difficulty
    question.defaultPoint = validated.defaultPoint
    question.status = validated.status
    question.updatedAt = todayLabel()
    // Gán mảng mới thay vì sửa tại chỗ để các bài làm đã chấm giữ nguyên đáp án cũ.
    question.answers = buildAnswers(question.id, validated.answers)

    return cloneQuestion(question)
  })
}

export function deleteQuestion(id: number): Promise<void> {
  return simulate(() => {
    const index = mockQuestions.findIndex(question => question.id === id)
    if (index === -1) {
      throw new Error('Không tìm thấy câu hỏi.')
    }
    mockQuestions.splice(index, 1)
  })
}

export function setQuestionStatus(id: number, status: QuestionStatus): Promise<Question> {
  return simulate(() => {
    const question = findQuestion(id)
    question.status = status
    question.updatedAt = todayLabel()
    return cloneQuestion(question)
  })
}
