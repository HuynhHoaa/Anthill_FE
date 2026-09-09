import {
  demoStudentId,
  mockExams,
  mockQuestions,
  mockResults,
  mockStudentExamItems,
  mockStudents,
  mockTeacherActivities,
} from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { parseDateTime, roundToOneDecimal } from '../lib/format'
import type { ResultSummary, StudentDashboardData, TeacherDashboardData } from '../types'

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

function averageOf(values: number[]): number {
  if (values.length === 0) return 0
  return roundToOneDecimal(values.reduce((total, value) => total + value, 0) / values.length)
}

function sortByNewest(left: ResultSummary, right: ResultSummary): number {
  const leftTime = parseDateTime(left.submittedAt)?.getTime() ?? 0
  const rightTime = parseDateTime(right.submittedAt)?.getTime() ?? 0
  if (leftTime !== rightTime) return rightTime - leftTime
  return right.attemptId - left.attemptId
}

export function getTeacherDashboard(): Promise<TeacherDashboardData> {
  return simulate(() => {
    const gradedResults = mockResults.filter(result => result.status === 'graded')
    const weekAgo = Date.now() - WEEK_IN_MS
    const submittedThisWeek = mockResults.filter(result => {
      const submittedTime = parseDateTime(result.submittedAt)?.getTime()
      return submittedTime !== undefined && submittedTime >= weekAgo
    }).length

    const recentExams = [...mockExams]
      .sort((left, right) => {
        const leftTime = parseDateTime(left.createdAt)?.getTime() ?? 0
        const rightTime = parseDateTime(right.createdAt)?.getTime() ?? 0
        if (leftTime !== rightTime) return rightTime - leftTime
        return right.id - left.id
      })
      .slice(0, 5)
      .map(exam => ({ ...exam }))

    return {
      stats: {
        totalStudents: mockStudents.length,
        totalQuestions: mockQuestions.length,
        totalExams: mockExams.length,
        assignedExams: mockExams.filter(exam => exam.assignedCount > 0).length,
        openExams: mockExams.filter(exam => exam.lifecycle === 'open').length,
        submittedThisWeek,
        averageScore: averageOf(gradedResults.map(result => result.score)),
      },
      recentExams,
      activities: mockTeacherActivities.map(activity => ({ ...activity })),
    }
  })
}

export function getStudentDashboard(): Promise<StudentDashboardData> {
  return simulate(() => {
    const myResults = mockResults.filter(result => result.studentId === demoStudentId)
    const myGradedResults = myResults.filter(result => result.status === 'graded')
    const gradedScores = myGradedResults.map(result => result.score)

    const byDeadline = (left: { deadline: Date }, right: { deadline: Date }) =>
      left.deadline.getTime() - right.deadline.getTime()

    return {
      stats: {
        assignedCount: mockStudentExamItems.length,
        completedCount: mockStudentExamItems.filter(
          item => item.status === 'submitted' || item.status === 'graded',
        ).length,
        averageScore: averageOf(gradedScores),
        // Math.max không nhận mảng rỗng nên phải chặn trước khi trải mảng.
        bestScore: gradedScores.length > 0 ? roundToOneDecimal(Math.max(...gradedScores)) : 0,
      },
      openExams: mockStudentExamItems
        .filter(item => item.status === 'open')
        .map(item => ({ ...item }))
        .sort(byDeadline),
      upcomingExams: mockStudentExamItems
        .filter(item => item.status === 'upcoming')
        .map(item => ({ ...item }))
        .sort(byDeadline),
      recentResults: [...myResults]
        .sort(sortByNewest)
        .slice(0, 5)
        .map(result => ({ ...result })),
    }
  })
}
