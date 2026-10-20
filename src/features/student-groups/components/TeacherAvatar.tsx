import { getInitials } from '../../../lib/format'
import type { GroupTeacher } from '../../../types'

/**
 * Avatar giáo viên.
 *
 * Dùng `avatarColor` của tài khoản chứ không quay vòng bảng màu theo id như avatar học sinh: một
 * giáo viên xuất hiện ở nhiều lớp khác nhau, và màu chỉ giúp nhận mặt khi nó theo người.
 */
export function TeacherAvatar({ teacher, size = 40 }: { teacher: GroupTeacher; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `linear-gradient(135deg, ${teacher.avatarColor}, #FFA01F)`,
      }}
    >
      {getInitials(teacher.fullName)}
    </div>
  )
}
