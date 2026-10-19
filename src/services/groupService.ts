/**
 * Nhóm lớp — nối vào API thật (§4.3).
 *
 * Bản giả lập tự đếm lại sĩ số sau mỗi thao tác bằng `syncGroupCounts()`; server trả sĩ số kèm
 * theo mỗi nhóm nên hàm đó biến mất — cùng với cả một lớp lỗi mà nó sinh ra: sĩ số chỉ đúng ở
 * những màn hình nhớ gọi nó.
 *
 * Lớp học thuộc về **tổ chức**, không thuộc về giáo viên nào. Quản trị viên lập lớp (kèm đúng một giáo viên
 * phụ trách), xếp học sinh rồi công bố; giáo viên chỉ đọc phần mình được phân công. Vì vậy phần lớn hàm
 * ở đây chỉ quản trị viên gọi được — chú thích trên từng hàm nói rõ ai gọi được hàm nào, để không
 * ai gắn nhầm chúng vào một màn hình của giáo viên rồi nhận 403 lúc chạy.
 */
import { apiClient, apiDownload } from '../lib/apiClient'
import type { GroupChange, GroupExam, GroupTeacher, MemberChange, Student, StudentGroup } from '../types'

/**
 * Học sinh chưa thuộc nhóm lớp nào.
 *
 * Số 0 là quy ước của hợp đồng API để biểu diễn `NULL` trong bộ lọc — `?groupId=0` nghĩa là "chưa
 * phân nhóm", vì chuỗi rỗng trong query string không phân biệt được với "không lọc".
 */
export const UNASSIGNED_GROUP_ID = 0
export const UNASSIGNED_GROUP_NAME = 'Chưa phân nhóm'

export interface GroupPayload {
  /** Kỳ học của lớp; `null` là chưa phân kỳ. */
  termId?: number | null
  name: string
  description: string
}

/** Lập lớp phải kèm giáo viên phụ trách: mỗi lớp có đúng một giáo viên. */
export interface CreateGroupPayload extends GroupPayload {
  teacherId: number
}

/**
 * Danh sách lớp, **đã được server lọc theo vai trò người gọi**.
 *
 * Quản trị viên nhận tất cả, kể cả bản nháp; giáo viên chỉ nhận lớp mình được phân công và đã công
 * bố. Giao diện không lọc lại: lọc quyền ở client là bộ lọc trang trí — dữ liệu vẫn đã rời server
 * rồi — và nó còn đẻ ra nguy cơ hai bên hiểu khác nhau về cùng một quy tắc.
 */
export function listGroups(search?: string, status?: 'draft' | 'published' | 'locked'): Promise<StudentGroup[]> {
  return apiClient.get<StudentGroup[]>('/api/student-groups', { search, status })
}

/**
 * Các lớp còn nhận thêm học sinh và bài mới: bỏ những lớp đã khoá. Dùng cho mọi ô chọn lớp để xếp em vào hay giao bài —
 * lớp khoá chỉ đọc, server từ chối (409) nếu vẫn cố.
 */
export async function listOpenGroups(): Promise<StudentGroup[]> {
  return (await listGroups()).filter(group => !group.isLocked)
}

export function getGroup(id: number): Promise<StudentGroup> {
  return apiClient.get<StudentGroup>(`/api/student-groups/${id}`)
}

/**
 * Tạo lớp. Chỉ quản trị viên.
 *
 * Lớp mới **luôn** ra đời ở dạng bản nháp: xếp học sinh là nhiều thao tác nối nhau, và một lớp hiện ra với
 * giáo viên ngay từ thao tác đầu tiên là một lớp chưa xong việc mà đã có người trông vào. Giáo viên phụ trách
 * chọn ngay lúc lập lớp (bắt buộc) — không có lớp "chưa ai dạy".
 */
export function createGroup(payload: CreateGroupPayload): Promise<StudentGroup> {
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
 * Bảng điểm của một lớp (.xlsx): mỗi học sinh một dòng, mỗi đề của chính giáo viên đã giao cho lớp một cột, điểm quy về thang 10.
 * Chỉ giáo viên đang dạy lớp; quản trị viên bị từ chối.
 */
export function exportGroupGradeSheet(groupId: number): Promise<Blob> {
  return apiDownload(`/api/student-groups/${groupId}/grade-sheet`)
}

/**
 * Học sinh có thể thêm vào nhóm này — những em **chưa học lớp này**. Chỉ quản trị viên.
 *
 * Em đang học lớp khác vẫn có trong danh sách: một học sinh học được nhiều lớp cùng lúc, nên thêm vào đây không kéo
 * em ra khỏi lớp nào.
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

/**
 * Gỡ một em khỏi lớp (chỉ lớp này, các lớp khác của em giữ nguyên). Chỉ quản trị viên. **Lý do là bắt buộc**
 * (10–512 ký tự) và được lưu vào lịch sử của học sinh.
 *
 * Em đã làm bài vẫn gỡ được (nghỉ học, chuyển trường). Bài lớp này giao mà em chưa bắt đầu và chưa hết hạn bị thu hồi khỏi
 * em; kết quả cho biết bao nhiêu bài bị thu hồi, bao nhiêu giữ. Server trả **409** khi lớp đã khoá.
 */
export function removeStudentFromGroup(groupId: number, studentId: number, reason: string): Promise<MemberChange> {
  return apiClient.remove<MemberChange>(`/api/student-groups/${groupId}/students/${studentId}`, {
    reason: reason.trim(),
  })
}

/**
 * Chuyển một em từ lớp `groupId` sang lớp `targetGroupId`: gỡ khỏi lớp này và xếp vào lớp kia trong một bước. Chỉ quản trị
 * viên, **lý do bắt buộc**.
 *
 * Server trả **409** khi em đã học lớp đích rồi (khi đó chỉ cần gỡ khỏi lớp này) hoặc một trong hai lớp đã khoá.
 */
export function transferStudent(
  groupId: number,
  studentId: number,
  targetGroupId: number,
  reason: string,
): Promise<MemberChange> {
  return apiClient.post<MemberChange>(`/api/student-groups/${groupId}/students/${studentId}/transfer`, {
    targetGroupId,
    reason: reason.trim(),
  })
}

/**
 * Khoá lớp. Chỉ quản trị viên, **lý do bắt buộc** (10–512 ký tự, lưu vào lịch sử lớp).
 *
 * Lớp khoá là lớp chỉ đọc: không xếp thêm em, không giao bài mới, không đổi giáo viên hay sửa lớp. Thành viên, bài đã giao
 * và bảng điểm giữ nguyên; các em trong lớp vẫn học các lớp khác bình thường. Server trả **409** khi lớp đã khoá rồi.
 */
export function lockGroup(groupId: number, reason: string): Promise<StudentGroup> {
  return apiClient.post<StudentGroup>(`/api/student-groups/${groupId}/lock`, { reason: reason.trim() })
}

/** Mở khoá lớp. Không cần lý do. */
export function unlockGroup(groupId: number): Promise<StudentGroup> {
  return apiClient.post<StudentGroup>(`/api/student-groups/${groupId}/unlock`)
}

// ===== Giáo viên phụ trách =====

/**
 * Mọi giáo viên, kèm trạng thái tài khoản, cho ô chọn người phụ trách lớp. Chỉ quản trị viên.
 *
 * Gồm cả tài khoản đang bị khoá để người dùng thấy vì sao không chọn được (`status === 'locked'`) thay vì đi tìm một cái
 * tên đã biến mất khỏi danh sách.
 */
export function listAssignableTeachers(): Promise<GroupTeacher[]> {
  return apiClient.get<GroupTeacher[]>('/api/student-groups/assignable-teachers')
}

/**
 * Đổi giáo viên phụ trách lớp. Chỉ quản trị viên.
 *
 * Mỗi lớp có đúng một giáo viên nên đây là **thay** người chứ không thêm. Đổi sang người khác giữa chừng thì **lý do là bắt
 * buộc** (10–512 ký tự) và được lưu vào lịch sử của lớp; lớp chưa có giáo viên (lớp cũ) thì không cần. Bài đã giao gắn với
 * học sinh nên không bị ảnh hưởng. Server trả **409** khi tài khoản giáo viên đang bị khoá.
 */
export function changeGroupTeacher(groupId: number, teacherId: number, reason?: string): Promise<StudentGroup> {
  return apiClient.put<StudentGroup>(`/api/student-groups/${groupId}/teacher`, {
    teacherId,
    reason: reason?.trim() || undefined,
  })
}

/** Lịch sử của lớp (lập lớp, đổi giáo viên kèm lý do), mới nhất trước. Chỉ quản trị viên. */
export function listGroupChanges(groupId: number): Promise<GroupChange[]> {
  return apiClient.get<GroupChange[]>(`/api/student-groups/${groupId}/history`)
}

// ===== Bài kiểm tra của lớp =====

/**
 * Các bài kiểm tra đã giao cho lớp, mới nhất trước, kèm số em đã nộp và điểm trung bình. Chỉ quản trị viên.
 */
export function listGroupExams(groupId: number): Promise<GroupExam[]> {
  return apiClient.get<GroupExam[]>(`/api/student-groups/${groupId}/exams`)
}
