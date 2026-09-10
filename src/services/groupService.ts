/**
 * Nhóm lớp — nối vào API thật (§4.3).
 *
 * Bản giả lập tự đếm lại sĩ số sau mỗi thao tác bằng `syncGroupCounts()`; server trả sĩ số kèm
 * theo mỗi nhóm nên hàm đó biến mất — cùng với cả một lớp lỗi mà nó sinh ra: sĩ số chỉ đúng ở
 * những màn hình nhớ gọi nó.
 */
import { apiClient } from '../lib/apiClient'
import type { Student, StudentGroup } from '../types'

/**
 * Học sinh chưa thuộc nhóm lớp nào.
 *
 * Số 0 là quy ước của hợp đồng API để biểu diễn `NULL` trong bộ lọc — `?groupId=0` nghĩa là "chưa
 * phân nhóm", vì chuỗi rỗng trong query string không phân biệt được với "không lọc".
 */
export const UNASSIGNED_GROUP_ID = 0
export const UNASSIGNED_GROUP_NAME = 'Chưa phân nhóm'

export interface GroupPayload {
  name: string
  description: string
}

export function listGroups(search?: string): Promise<StudentGroup[]> {
  return apiClient.get<StudentGroup[]>('/api/student-groups', { search })
}

export function getGroup(id: number): Promise<StudentGroup> {
  return apiClient.get<StudentGroup>(`/api/student-groups/${id}`)
}

export function createGroup(payload: GroupPayload): Promise<StudentGroup> {
  return apiClient.post<StudentGroup>('/api/student-groups', payload)
}

export function updateGroup(id: number, payload: GroupPayload): Promise<StudentGroup> {
  return apiClient.put<StudentGroup>(`/api/student-groups/${id}`, payload)
}

/**
 * Xoá nhóm lớp.
 *
 * Server trả **409** khi nhóm còn thành viên, kèm sĩ số trong thông điệp. Đó là chủ đích: xoá một
 * nhóm còn người sẽ để lại một đám học sinh không thuộc đâu cả, và người bấm nút cần biết còn bao
 * nhiêu em trước khi quyết định.
 */
export async function deleteGroup(id: number): Promise<void> {
  await apiClient.remove(`/api/student-groups/${id}`)
}

export function listGroupStudents(groupId: number): Promise<Student[]> {
  return apiClient.get<Student[]>(`/api/student-groups/${groupId}/students`)
}

/**
 * Học sinh có thể thêm vào nhóm này.
 *
 * Bao gồm cả em đang thuộc nhóm khác: mỗi học sinh chỉ thuộc đúng một nhóm, nên thêm vào đây nghĩa
 * là **chuyển** em sang. Giao diện phải nói rõ điều đó thay vì để giáo viên tưởng mình đang thêm.
 */
export function listAssignableStudents(groupId: number): Promise<Student[]> {
  return apiClient.get<Student[]>(`/api/student-groups/${groupId}/assignable-students`)
}

export interface AddMembersResult {
  added: number
  skippedAlreadyMember: number
  skippedNotFound: number
  studentCount: number
}

/**
 * Thêm học sinh vào nhóm theo lô.
 *
 * Trả về kết quả **theo từng loại** thay vì chỉ thành công hay thất bại: một id lạ lẫn trong danh
 * sách không làm hỏng cả mẻ, và người bấm nút biết chính xác bao nhiêu em vào được, bao nhiêu bị
 * bỏ qua vì lý do gì.
 */
export function addStudentsToGroup(groupId: number, studentIds: number[]): Promise<AddMembersResult> {
  return apiClient.post<AddMembersResult>(`/api/student-groups/${groupId}/students`, { studentIds })
}

export async function removeStudentFromGroup(groupId: number, studentId: number): Promise<void> {
  await apiClient.remove(`/api/student-groups/${groupId}/students/${studentId}`)
}
