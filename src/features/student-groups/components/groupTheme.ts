/**
 * Bảng màu xoay vòng cho avatar học sinh.
 * Màu được suy ra từ id nên mỗi lần render đều cho ra cùng một kết quả.
 *
 * Chỉ còn avatar dùng cách này, và đó là chỗ duy nhất nó đúng: màu ở đây là **danh tính** — cùng
 * một em luôn cùng một màu, giúp mắt bắt lại đúng dòng khi lướt bảng. Bảng màu cũ cho nhóm lớp đã
 * bị bỏ vì nó đặt một chấm màu vô nghĩa ở đầu mỗi dòng, đúng chỗ mà ai cũng đọc là trạng thái.
 */

export interface AvatarTone {
  bg: string
  text: string
}

const avatarTones: AvatarTone[] = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
]

function toSafeIndex(value: number, length: number): number {
  if (!Number.isFinite(value) || length <= 0) return 0
  return Math.abs(Math.trunc(value)) % length
}

/**
 * Số đếm cạnh tiêu đề danh sách thành viên.
 *
 * Tài khoản chờ xoá vẫn nằm trong danh sách — quản trị viên cần thấy để còn khôi phục — nhưng không
 * tính vào sĩ số. Đếm riêng để con số ở đây khớp với sĩ số ở đầu trang, thay vì "30 học sinh" nằm
 * cạnh "Học sinh (31)".
 */
export function memberCountLabel(students: Array<{ status: string }>): string {
  const retired = students.filter(student => student.status === 'pendingDeletion' || student.status === 'deleted').length
  const enrolled = students.length - retired
  return retired > 0 ? `${enrolled} · ${retired} chờ xoá` : `${enrolled}`
}

export function getAvatarTone(studentId: number): AvatarTone {
  return avatarTones[toSafeIndex(studentId, avatarTones.length)]
}
