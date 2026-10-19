/**
 * Quản lý tài khoản giáo viên — chỉ quản trị viên (nhà trường cấp tài khoản, gán môn, khoá khi giáo viên nghỉ).
 *
 * Không có xoá: giáo viên sở hữu câu hỏi, đề và lịch sử giao bài, xoá dòng là làm thủng chúng. Nghỉ việc thì khoá tài khoản
 * (kèm lý do) rồi đổi giáo viên phụ trách của các lớp họ đang dạy.
 */
import { apiClient } from '../lib/apiClient'
import type { AccountChange, Paged } from '../types'

export type TeacherStatus = 'active' | 'locked'

export const teacherStatusLabels: Record<TeacherStatus, string> = {
  active: 'Đang hoạt động',
  locked: 'Đã khoá',
}

/** Một lớp giáo viên đang phụ trách, tóm tắt. */
export interface TeacherGroup {
  id: number
  name: string
  studentCount: number
  isPublished: boolean
}

export interface Teacher {
  id: number
  fullName: string
  /** Email cũng là tên đăng nhập của giáo viên. */
  email: string
  phone?: string
  subjectId?: number
  /** Chuỗi rỗng khi tài khoản chưa được gán môn. */
  subject: string
  status: TeacherStatus
  avatarColor: string
  avatarUrl?: string
  /** Còn dùng mật khẩu do quản trị viên cấp, chưa đổi lần nào. */
  mustChangePassword: boolean
  /** Số lớp đang phụ trách, kể cả bản nháp. */
  groupCount: number
  createdAt: string
  /** Chỉ có ở chi tiết một giáo viên, không có ở danh sách. */
  groups?: TeacherGroup[]
}

export interface ListTeachersParams {
  search?: string
  status?: 'all' | TeacherStatus
  subjectId?: number
  page?: number
  pageSize?: number
}

export function listTeachers(params: ListTeachersParams = {}): Promise<Paged<Teacher>> {
  return apiClient.get<Paged<Teacher>>('/api/teachers', {
    search: params.search,
    status: params.status,
    subjectId: params.subjectId,
    page: params.page,
    pageSize: params.pageSize,
  })
}

export function getTeacher(id: number): Promise<Teacher> {
  return apiClient.get<Teacher>(`/api/teachers/${id}`)
}

export interface CreateTeacherPayload {
  fullName: string
  email: string
  phone?: string
  subjectId: number
  /** Mật khẩu ban đầu do quản trị viên cấp; giáo viên bị ép đổi ở lần đăng nhập đầu. */
  password: string
}

export type UpdateTeacherPayload = Omit<CreateTeacherPayload, 'password'>

/** Server trả **409** khi email đã được tài khoản khác dùng, **400** khi môn không có thật. */
export function createTeacher(payload: CreateTeacherPayload): Promise<Teacher> {
  return apiClient.post<Teacher>('/api/teachers', payload)
}

/** Đổi môn bị từ chối (**409**) khi giáo viên đã soạn câu hỏi hoặc đề. */
export function updateTeacher(id: number, payload: UpdateTeacherPayload): Promise<Teacher> {
  return apiClient.put<Teacher>(`/api/teachers/${id}`, payload)
}

/**
 * Khoá hoặc mở khoá. **Khoá bắt buộc lý do** (10–512 ký tự); khoá xoay `SecurityStamp` nên mọi phiên đang mở của giáo viên
 * chết ngay.
 */
export function setTeacherStatus(id: number, status: TeacherStatus, reason?: string): Promise<Teacher> {
  return apiClient.patch<Teacher>(`/api/teachers/${id}/status`, {
    status,
    reason: status === 'locked' ? reason?.trim() : undefined,
  })
}

export interface TeacherPasswordResult {
  teacherId: number
  /** Mật khẩu mới ở dạng đọc được — server chỉ gửi đúng một lần. */
  password: string
  mustChangePassword: boolean
}

export function resetTeacherPassword(id: number): Promise<TeacherPasswordResult> {
  return apiClient.post<TeacherPasswordResult>(`/api/teachers/${id}/reset-password`)
}

/** Lịch sử khoá và mở khoá, kèm lý do, mới nhất trước. */
export function listTeacherChanges(id: number): Promise<AccountChange[]> {
  return apiClient.get<AccountChange[]>(`/api/teachers/${id}/history`)
}
