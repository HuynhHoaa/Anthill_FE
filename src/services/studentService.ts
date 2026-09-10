/**
 * Tài khoản học sinh — nối vào API thật (§4.2).
 *
 * Hai điều bản giả lập làm sai, server làm đúng:
 *
 * 1. **Lọc theo `groupId`, không theo tên nhóm.** Bản giả lập lọc bằng tên, nên đổi tên một nhóm
 *    là bộ lọc trả về 0 dòng cho tới khi tải lại trang.
 *
 * 2. **Không có endpoint xoá.** Học sinh bị **khoá** chứ không xoá (§4.2): kết quả các bài đã làm
 *    phải tra cứu được về sau, mà xoá tài khoản thì những dòng kết quả đó mất chủ.
 */
import { apiClient } from '../lib/apiClient'
import type { Paged, Student, StudentStatus } from '../types'

export interface StudentPayload {
  fullName: string
  email: string
  username: string
  code: string
  groupId: number
  /** Bắt buộc khi tạo mới: người tạo tài khoản là người phải trao mật khẩu cho học sinh. */
  password?: string
}

export interface ListStudentsParams {
  search?: string
  /** Id nhóm lớp; 0 nghĩa là "chưa phân nhóm". Bỏ trống để không lọc. */
  groupId?: number
  status?: 'all' | StudentStatus
  page?: number
  pageSize?: number
}

export function listStudents(params: ListStudentsParams = {}): Promise<Paged<Student>> {
  return apiClient.get<Paged<Student>>('/api/students', {
    search: params.search,
    groupId: params.groupId,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  })
}

export function getStudent(id: number): Promise<Student> {
  return apiClient.get<Student>(`/api/students/${id}`)
}

/**
 * Kiểm tra email / username / mã học sinh đã có ai dùng chưa.
 *
 * Để form báo trùng ngay lúc gõ thay vì đợi bấm Lưu rồi nhận 409 — và quan trọng hơn, để người
 * nhập biết **ô nào** trùng thay vì chỉ biết "có gì đó trùng".
 */
export interface AvailabilityResult {
  /**
   * `true` là **còn trống**, không phải đã bị chiếm.
   *
   * Chiều này theo đúng tên trường của server (`emailAvailable`). Đảo chiều ở tầng service sẽ tạo
   * ra một cái bẫy im lặng: cùng một chữ `true` mang hai nghĩa trái ngược ở hai bên đường truyền,
   * và ai đọc code cũng phải nhớ mình đang đứng bên nào.
   *
   * `undefined` nghĩa là không hỏi trường đó ở lần gọi này.
   */
  emailAvailable?: boolean
  usernameAvailable?: boolean
  codeAvailable?: boolean
  allAvailable: boolean
}

export function checkAvailability(params: {
  email?: string
  username?: string
  code?: string
  /** Id của chính học sinh đang sửa, để không tự báo trùng với bản ghi của mình. */
  excludeStudentId?: number
}): Promise<AvailabilityResult> {
  return apiClient.get<AvailabilityResult>('/api/students/availability', {
    email: params.email,
    username: params.username,
    code: params.code,
    excludeStudentId: params.excludeStudentId,
  })
}

export function createStudent(payload: StudentPayload): Promise<Student> {
  return apiClient.post<Student>('/api/students', payload)
}

export function updateStudent(id: number, payload: StudentPayload): Promise<Student> {
  return apiClient.put<Student>(`/api/students/${id}`, payload)
}

/**
 * Khoá hoặc mở khoá tài khoản.
 *
 * Khoá làm **token hiện tại của em đó chết ngay lập tức** — server xoay `SecurityStamp` chứ không
 * chờ token hết hạn. Một em bị khoá giữa giờ thi sẽ bị đẩy ra ngay, đó là chủ đích.
 */
export function setStudentStatus(id: number, status: StudentStatus): Promise<Student> {
  return apiClient.patch<Student>(`/api/students/${id}/status`, { status })
}

/**
 * Đặt lại mật khẩu, server sinh chuỗi mới và trả về **đúng một lần**.
 *
 * Mật khẩu chỉ nằm trong response này, không bao giờ xuất hiện lại ở bất kỳ endpoint nào khác —
 * nên giao diện phải hiện nó ra cho người quản trị chép lại ngay, đóng hộp thoại là mất.
 */
export function resetStudentPassword(id: number): Promise<{
  studentId: number
  password: string
  mustChangePassword: boolean
}> {
  return apiClient.post(`/api/students/${id}/reset-password`)
}
