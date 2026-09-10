/**
 * Hai trang tổng quan — nối vào API thật (§4.8).
 *
 * Mỗi trang là **một** lời gọi: server gộp sẵn số liệu và các danh sách. Đây là chỗ khác biệt rõ
 * nhất so với bản giả lập, vốn tự tính mọi con số từ dữ liệu trong bộ nhớ trình duyệt.
 *
 * Một chỗ phải nói rõ: **backend không có dòng "hoạt động gần đây"**. Nó không lưu nhật ký hành
 * động, và dựng một bảng như vậy chỉ để lấp một ô trên màn hình là việc lớn hơn giá trị nó mang
 * lại. Thay vì bịa, phần đó được dựng từ dữ liệu thật đang có — những lượt nộp bài gần nhất.
 */
import { apiClient } from '../lib/apiClient'
import type {
  ActivityItem,
  StudentDashboardData,
  TeacherDashboardData,
} from '../types'
import { toResultSummary, toStudentExamItem } from './mappers'
import type { PagedResponse, ResultSummaryDto, StudentExamItemDto } from './mappers'
import type { Exam } from '../types'

interface TeacherDashboardDto {
  stats: {
    totalStudents: number
    totalQuestions: number
    totalExams: number
    assignedExams: number
    openExams: number
    submissionsThisWeek: number
    averageScore?: number
  }
  recentExams: Exam[]
}

interface StudentDashboardDto {
  stats: {
    assignedExams: number
    completedExams: number
    averageScore?: number
    highestScore?: number
  }
  openExams: StudentExamItemDto[]
  upcomingExams: StudentExamItemDto[]
  recentResults: ResultSummaryDto[]
}

/** Khoảng thời gian tương đối, đủ dùng cho một dòng nhật ký ngắn. */
function relativeTime(iso: string): string {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return ''

  const minutes = Math.round((Date.now() - time) / 60_000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`

  return `${Math.round(hours / 24)} ngày trước`
}

/**
 * Dựng dòng "hoạt động gần đây" từ những lượt nộp bài gần nhất.
 *
 * Không phải nhật ký hành động đầy đủ — nó chỉ biết về việc nộp bài. Nhưng đó là dữ liệu **thật**,
 * và một danh sách ngắn nói đúng vẫn hơn một danh sách dài bịa ra cho đủ chỗ.
 */
async function buildActivities(): Promise<ActivityItem[]> {
  try {
    const recent = await apiClient.get<PagedResponse<ResultSummaryDto>>('/api/results', {
      status: 'graded',
      pageSize: 6,
    })

    return recent.items.map(item => ({
      id: item.attemptId,
      time: relativeTime(item.submittedAt ?? item.startedAt),
      text: item.autoSubmitted
        ? `${item.studentName} được nộp bài tự động khi hết giờ — ${item.examTitle}`
        : `${item.studentName} vừa nộp bài ${item.examTitle}`,
      tone: item.autoSubmitted ? 'warning' : 'success',
    }))
  } catch {
    // Trang tổng quan vẫn phải hiện được khi riêng phần này hỏng: sáu ô số liệu và danh sách đề
    // mới là nội dung chính, còn dòng nhật ký chỉ là phần thêm.
    return []
  }
}

export async function getTeacherDashboard(): Promise<TeacherDashboardData> {
  const [dto, activities] = await Promise.all([
    apiClient.get<TeacherDashboardDto>('/api/dashboard/teacher'),
    buildActivities(),
  ])

  return {
    stats: {
      totalStudents: dto.stats.totalStudents,
      totalQuestions: dto.stats.totalQuestions,
      totalExams: dto.stats.totalExams,
      assignedExams: dto.stats.assignedExams,
      openExams: dto.stats.openExams,
      submittedThisWeek: dto.stats.submissionsThisWeek,
      averageScore: dto.stats.averageScore ?? null,
    },
    recentExams: dto.recentExams,
    activities,
  }
}

export async function getStudentDashboard(): Promise<StudentDashboardData> {
  const dto = await apiClient.get<StudentDashboardDto>('/api/dashboard/student')

  return {
    stats: {
      assignedCount: dto.stats.assignedExams,
      completedCount: dto.stats.completedExams,
      averageScore: dto.stats.averageScore ?? null,
      bestScore: dto.stats.highestScore ?? null,
    },
    openExams: dto.openExams.map(toStudentExamItem),
    upcomingExams: dto.upcomingExams.map(toStudentExamItem),
    recentResults: dto.recentResults.map(toResultSummary),
  }
}
