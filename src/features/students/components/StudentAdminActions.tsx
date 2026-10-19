import { Pencil, RotateCcw, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { isRetiredStudent } from '../../../services/studentService'
import type { Student } from '../../../types'
import { useStudentAccountActions } from '../hooks/useStudentAccountActions'
import StudentClassManager from './StudentClassManager'

interface StudentAdminActionsProps {
  student: Student
  /** Gọi sau mỗi thao tác có thể đã đổi dữ liệu; trang cha tải lại hồ sơ. */
  onChanged: () => void
}

const buttonClass =
  'w-full inline-flex items-center justify-start gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const neutralClass = 'text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 disabled:hover:bg-slate-50 disabled:hover:text-slate-600'
const dangerClass = 'text-red-500 bg-red-50/60 hover:bg-red-50'

/**
 * Thao tác của quản trị viên trên một học sinh: sửa hồ sơ, quản lý các lớp em đang học (xếp thêm, chuyển, gỡ), khoá, xoá.
 * Mọi việc gỡ lớp, chuyển lớp, khoá và xoá đều bắt buộc lý do (hộp tự hỏi) và ghi vào lịch sử của học sinh.
 */
export default function StudentAdminActions({ student, onChanged }: StudentAdminActionsProps) {
  const accountActions = useStudentAccountActions()

  const retired = isRetiredStudent(student)
  const isActive = student.status === 'active'

  const run = async (pending: Promise<boolean>) => {
    if (await pending) onChanged()
  }

  return (
    <div className="space-y-1.5">
      {!retired && (
        <NavLink to={`/quan-tri/hoc-sinh/${student.id}/sua`} className={`${buttonClass} ${neutralClass}`}>
          <Pencil size={15} /> Sửa hồ sơ
        </NavLink>
      )}

      {student.status === 'pendingDeletion' && (
        <button
          type="button"
          onClick={() => void run(accountActions.restore(student))}
          className={`${buttonClass} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}
        >
          <RotateCcw size={15} /> Khôi phục tài khoản
        </button>
      )}

      <div className="py-2">
        <StudentClassManager student={student} onChanged={onChanged} />
      </div>

      {!retired && (
        <>
          <button
            type="button"
            onClick={() => void run(accountActions.toggleLock(student))}
            className={`${buttonClass} ${isActive ? neutralClass : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
          >
            {isActive ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
            {isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
          </button>
          <button
            type="button"
            onClick={() => void run(accountActions.requestDeletion(student))}
            className={`${buttonClass} ${dangerClass}`}
          >
            <Trash2 size={15} /> Xoá tài khoản
          </button>
        </>
      )}
    </div>
  )
}
