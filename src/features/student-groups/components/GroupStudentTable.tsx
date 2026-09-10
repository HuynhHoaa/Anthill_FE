import { NavLink } from 'react-router-dom'
import { UserMinus, type LucideIcon } from 'lucide-react'
import { formatScore, getInitials, getScoreTone } from '../../../lib/format'
import type { Student } from '../../../types'
import StudentStatusPill from '../../students/components/StudentStatusPill'
import { getAvatarTone } from './groupTheme'

interface GroupStudentTableProps {
  students: Student[]
  /**
   * Trang mở ra khi bấm vào một học sinh.
   *
   * Hai khu vực dẫn tới hai nơi khác nhau — giáo viên xem lịch sử làm bài, quản trị viên sửa tài
   * khoản — nên bảng không tự đoán, trang cha nói rõ.
   */
  buildStudentLink: (studentId: number) => string
  studentLinkLabel: string
  studentLinkIcon: LucideIcon
  /** Bỏ trống nghĩa là bảng chỉ đọc: xếp lớp là việc của quản trị viên, không phải của giáo viên. */
  onRemove?: (student: Student) => void
  /** Làm mờ trong lúc tải lại nền, để bảng cũ không trông như dữ liệu mới. */
  dimmed?: boolean
}

const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'

export default function GroupStudentTable({
  students,
  buildStudentLink,
  studentLinkLabel,
  studentLinkIcon: StudentLinkIcon,
  onRemove,
  dimmed = false,
}: GroupStudentTableProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity ${
        dimmed ? 'opacity-60' : 'opacity-100'
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={`${headerCellClass} text-left`}>Học sinh</th>
              <th className={`${headerCellClass} text-left`}>Mã học sinh</th>
              <th className={`${headerCellClass} text-left`}>Email</th>
              <th className={`${headerCellClass} text-left`}>Điểm trung bình</th>
              <th className={`${headerCellClass} text-left`}>Bài đã làm</th>
              <th className={`${headerCellClass} text-left`}>Trạng thái</th>
              <th className={`${headerCellClass} text-right`}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => {
              const avatarTone = getAvatarTone(student.id)
              const scoreTone = getScoreTone(student.averageScore)
              const studentLink = buildStudentLink(student.id)

              return (
                <tr
                  key={student.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-b-0"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarTone.bg} ${avatarTone.text}`}
                      >
                        {getInitials(student.fullName)}
                      </div>
                      <div className="min-w-0">
                        <NavLink
                          to={studentLink}
                          title={studentLinkLabel}
                          aria-label={`${studentLinkLabel} — ${student.fullName}`}
                          className="block text-sm font-semibold text-slate-800 truncate hover:text-indigo-600 transition-colors"
                        >
                          {student.fullName}
                        </NavLink>
                        <p className="text-xs text-slate-400 truncate">@{student.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-600">{student.code}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{student.email}</td>
                  <td className="px-5 py-4">
                    {student.completedExams > 0 ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${scoreTone.bg} ${scoreTone.color}`}
                      >
                        {formatScore(student.averageScore)}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">Chưa có</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{student.completedExams} bài</td>
                  <td className="px-5 py-4">
                    {/* Dùng chung một viên trạng thái với trang học sinh, để hai nơi không bao giờ
                        tô cùng một trạng thái bằng hai màu. */}
                    <StudentStatusPill status={student.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <NavLink
                        to={studentLink}
                        title={studentLinkLabel}
                        aria-label={`${studentLinkLabel} — ${student.fullName}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        <StudentLinkIcon size={14} /> {studentLinkLabel}
                      </NavLink>
                      {onRemove && (
                        <button
                          type="button"
                          onClick={() => onRemove(student)}
                          title="Gỡ khỏi lớp"
                          aria-label={`Gỡ ${student.fullName} khỏi lớp`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <UserMinus size={14} /> Gỡ khỏi lớp
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
