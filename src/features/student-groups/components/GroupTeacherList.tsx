import { Loader2, Mail, UserMinus } from 'lucide-react'
import { getInitials } from '../../../lib/format'
import type { GroupTeacher } from '../../../types'

interface GroupTeacherListProps {
  teachers: GroupTeacher[]
  /**
   * Bỏ trống nghĩa là danh sách chỉ đọc.
   *
   * Giáo viên xem trang lớp của mình cũng thấy đồng nghiệp cùng phụ trách — hữu ích khi cần hỏi ai
   * đó về lớp — nhưng phân công là việc của quản trị viên, nên ở đó không có nút gỡ.
   */
  onRemove?: (teacher: GroupTeacher) => void
  /** Id đang chờ server trả lời, để đúng một thẻ khoá lại thay vì cả danh sách. */
  removingId?: number
}

const subjectPillClass =
  'inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-600'

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
        background: `linear-gradient(135deg, ${teacher.avatarColor}, #8B5CF6)`,
      }}
    >
      {getInitials(teacher.fullName)}
    </div>
  )
}

export default function GroupTeacherList({ teachers, onRemove, removingId }: GroupTeacherListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {teachers.map(teacher => {
        const isRemoving = removingId === teacher.id

        return (
          <div
            key={teacher.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3"
          >
            <TeacherAvatar teacher={teacher} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{teacher.fullName}</p>
              <p className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                <Mail size={12} className="flex-shrink-0" /> {teacher.email}
              </p>
              {/* Chưa gán môn thì server trả chuỗi rỗng — không dựng một huy hiệu trống ở đây. */}
              {teacher.subject && <span className={`${subjectPillClass} mt-2`}>{teacher.subject}</span>}
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(teacher)}
                disabled={isRemoving}
                title="Gỡ phân công"
                aria-label={`Gỡ phân công ${teacher.fullName}`}
                className="w-9 h-9 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-50"
              >
                {isRemoving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <UserMinus size={15} />
                )}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
