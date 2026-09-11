/**
 * Nhóm lớp — nối vào API thật (§4.3).
 *
 * Bản giả lập tự đếm lại sĩ số sau mỗi thao tác bằng `syncGroupCounts()`; server trả sĩ số kèm
 * theo mỗi nhóm nên hàm đó biến mất — cùng với cả một lớp lỗi mà nó sinh ra: sĩ số chỉ đúng ở
 * những màn hình nhớ gọi nó.
 *
 * Lớp học thuộc về **tổ chức**, không thuộc về giáo viên nào. Quản trị viên lập lớp, xếp học sinh,
 * phân công giáo viên rồi công bố; giáo viên chỉ đọc phần mình được phân công. Vì vậy phần lớn hàm
 * ở đây chỉ quản trị viên gọi được — chú thích trên từng hàm nói rõ ai gọi được hàm nào, để không
 * ai gắn nhầm chúng vào một màn hình của giáo viên rồi nhận 403 lúc chạy.
 */
import { apiClient } from '../lib/apiClient'
import type { GroupTeacher, Student, StudentGroup } from '../types'

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

/**
 * Danh sách lớp, **đã được server lọc theo vai trò người gọi**.
 *
 * Quản trị viên nhận tất cả, kể cả bản nháp; giáo viên chỉ nhận lớp mình được phân công và đã công
 * bố. Giao diện không lọc lại: lọc quyền ở client là bộ lọc trang trí — dữ liệu vẫn đã rời server
 * rồi — và nó còn đẻ ra nguy cơ hai bên hiểu khác nhau về cùng một quy tắc.
 */
export function listGroups(search?: string): Promise<StudentGroup[]> {
  return apiClient.get<StudentGroup[]>('/api/student-groups', { search })
}

export function getGroup(id: number): Promise<StudentGroup> {
  return apiClient.get<StudentGroup>(`/api/student-groups/${id}`)
}

/**
 * Tạo lớp. Chỉ quản trị viên.
 *
 * Lớp mới **luôn** ra đời ở dạng bản nháp: xếp học sinh rồi phân công giáo viên là nhiều thao tác
 * nối nhau, và một lớp hiện ra với giáo viên ngay từ thao tác đầu tiên là một lớp chưa xong việc
 * mà đã có người trông vào.
 */
export function createGroup(payload: GroupPayload): Promise<StudentGroup> {
  return apiClient.post<StudentGroup>('/api/student-groups', payload)
}

/** Chỉ quản trị viên. */
export function updateGroup(id: number, payload: GroupPayload): Promise<StudentGroup> {
  return apiClient.put<StudentGroup>(`/api/student-groups/${id}`, payload)
}

/**
 * Công bố lớp. Chỉ quản trị viên.
 *
 * Tách khỏi `updateGroup` đúng như xuất bản đề kiểm tra tách khỏi sửa đề: công bố là một hành
 * động, không phải một ô tích trong form. Server trả **409** khi lớp đã công bố từ trước — nghĩa
 * là danh sách trên màn hình đã cũ, không phải người dùng bấm sai.
 */
export function publishGroup(id: number): Promise<StudentGroup> {
  return apiClient.post<StudentGroup>(`/api/student-groups/${id}/publish`)
}

/**
 * Đưa một lớp đã công bố trở lại dạng nháp. Chỉ quản trị viên.
 *
 * Đường lui cho việc công bố nhầm: lớp biến khỏi màn hình giáo viên, còn học sinh và bài đã giao
 * giữ nguyên. Server trả **409** khi lớp vốn đang là nháp.
 */
export function unpublishGroup(id: number): Promise<StudentGroup> {
  return apiClient.post<StudentGroup>(`/api/student-groups/${id}/unpublish`)
}

/**
 * Xoá nhóm lớp. Chỉ quản trị viên.
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
 * Học sinh có thể thêm vào nhóm này. Chỉ quản trị viên.
 *
 * Bao gồm cả em đang thuộc nhóm khác: mỗi học sinh chỉ thuộc đúng một nhóm, nên thêm vào đây nghĩa
 * là **chuyển** em sang. Giao diện phải nói rõ điều đó thay vì để người xếp lớp tưởng mình chỉ
 * đang thêm — chuyển nhầm một em là kéo em ra khỏi lớp cũ cùng mọi bài đã giao ở đó.
 */
export function listAssignableStudents(groupId: number): Promise<Student[]> {
  return apiClient.get<Student[]>(`/api/student-groups/${groupId}/assignable-students`)
}

export interface AddMembersResult {
  added: number
  skippedAlreadyMember: number
  skippedNotFound: number
  /** Tài khoản chờ xoá hoặc đã xoá — server bỏ qua, không đưa vào lớp. */
  skippedRetired?: number
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

/** Chỉ quản trị viên. */
export async function removeStudentFromGroup(groupId: number, studentId: number): Promise<void> {
  await apiClient.remove(`/api/student-groups/${groupId}/students/${studentId}`)
}

// ===== Phân công giáo viên =====

/**
 * Giáo viên **chưa** được phân công vào lớp này. Chỉ quản trị viên.
 *
 * Server đã trừ sẵn những người đang phụ trách, nên hộp chọn không bày ra những cái tên bấm vào
 * cũng không đổi được gì.
 */
export function listAssignableTeachers(groupId: number): Promise<GroupTeacher[]> {
  return apiClient.get<GroupTeacher[]>(`/api/student-groups/${groupId}/assignable-teachers`)
}

export interface AssignTeachersResult {
  assigned: number
  skippedAlreadyAssigned: number
  /** Id không tồn tại, hoặc tồn tại nhưng không phải tài khoản giáo viên. */
  skippedNotTeacher: number
  skippedLocked: number
  /** Tổng số giáo viên phụ trách lớp sau thao tác này. */
  teacherCount: number
}

/**
 * Phân công nhiều giáo viên trong một lần gọi. Chỉ quản trị viên.
 *
 * Cùng khuôn với thêm học sinh theo lô, và cùng lý do: một lớp thường có vài giáo viên bộ môn, nên
 * bốn lượt đi mạng cho một hành động là bắt người dùng trả giá cho lựa chọn thiết kế của hệ thống.
 * Kết quả tách theo từng lý do bị bỏ qua vì mỗi lý do dẫn tới một việc khác nhau — tài khoản bị
 * khoá thì phải mở khoá trước, còn người đã được phân công thì không cần làm gì cả.
 */
export function assignTeachersToGroup(
  groupId: number,
  teacherIds: number[],
): Promise<AssignTeachersResult> {
  return apiClient.post<AssignTeachersResult>(`/api/student-groups/${groupId}/teachers`, { teacherIds })
}

/** Gỡ phân công. Chỉ quản trị viên. */
export async function removeTeacherFromGroup(groupId: number, teacherId: number): Promise<void> {
  await apiClient.remove(`/api/student-groups/${groupId}/teachers/${teacherId}`)
}
