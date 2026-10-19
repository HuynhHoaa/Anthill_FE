import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowRightLeft, Lock, UserMinus, UserPlus, UsersRound } from 'lucide-react'
import RowActionMenu, { type RowMenuItem } from '../../../components/common/RowActionMenu'
import { isRetiredStudent } from '../../../services/studentService'
import type { Student, StudentGroupRef } from '../../../types'
import AssignToGroupModal from '../../student-groups/components/AssignToGroupModal'
import TransferStudentModal from '../../student-groups/components/TransferStudentModal'
import { useRemoveFromGroup } from '../../student-groups/hooks/useRemoveFromGroup'

interface StudentClassManagerProps {
  student: Student
  /** Gọi sau mỗi thao tác có thể đã đổi dữ liệu; trang cha tải lại hồ sơ. */
  onChanged: () => void
}

const LOCKED_HINT = 'Lớp đã khoá nên chỉ xem được. Hãy mở khoá lớp trước khi thay đổi.'

/**
 * Các lớp một học sinh đang học, dưới quyền quản trị viên: xếp thêm vào lớp, chuyển sang lớp khác, gỡ khỏi từng lớp.
 *
 * Một em học được nhiều lớp cùng lúc nên đây là một danh sách, mỗi lớp một dòng với menu riêng — "gỡ" và "chuyển" là việc
 * của từng lớp chứ không phải của cả học sinh. Gỡ và chuyển đều bắt buộc lý do (hộp tự hỏi) và ghi vào lịch sử của học
 * sinh; lớp đã khoá thì hai mục mờ đi kèm lời giải thích.
 */
export default function StudentClassManager({ student, onChanged }: StudentClassManagerProps) {
  const removeFromGroup = useRemoveFromGroup()
  const [assignOpen, setAssignOpen] = useState(false)
  const [transferFrom, setTransferFrom] = useState<StudentGroupRef | null>(null)

  const retired = isRetiredStudent(student)

  const remove = async (group: StudentGroupRef) => {
    if (await removeFromGroup(student, group)) onChanged()
  }

  const menuFor = (group: StudentGroupRef): RowMenuItem[] => [
    { key: 'open', label: 'Mở lớp', icon: UsersRound, to: `/quan-tri/nhom-lop/${group.id}` },
    {
      key: 'transfer',
      label: 'Chuyển sang lớp khác',
      icon: ArrowRightLeft,
      onSelect: () => setTransferFrom(group),
      disabled: retired || group.isLocked,
      disabledHint: retired ? 'Tài khoản đang chờ xoá hoặc đã xoá. Hãy khôi phục tài khoản trước.' : LOCKED_HINT,
    },
    {
      key: 'remove',
      label: 'Gỡ khỏi lớp này',
      icon: UserMinus,
      tone: 'danger',
      onSelect: () => void remove(group),
      disabled: group.isLocked,
      disabledHint: LOCKED_HINT,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap">
          <UsersRound size={14} /> Lớp đang học
          {student.groups.length > 0 && <span className="font-normal text-slate-400">({student.groups.length})</span>}
        </p>
        {!retired && (
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
          >
            <UserPlus size={14} /> Xếp thêm lớp
          </button>
        )}
      </div>

      {student.groups.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Chưa học lớp nào.</p>
      ) : (
        <ul className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-100">
          {student.groups.map(group => (
            <li key={group.id} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5">
              <NavLink
                to={`/quan-tri/nhom-lop/${group.id}`}
                title={group.name}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:underline"
              >
                {group.name}
              </NavLink>
              {group.isLocked && (
                <span
                  title="Lớp đã khoá"
                  className="inline-flex items-center gap-1 flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                >
                  <Lock size={10} /> Đã khoá
                </span>
              )}
              <RowActionMenu label={`${student.fullName} · ${group.name}`} items={menuFor(group)} />
            </li>
          ))}
        </ul>
      )}

      {assignOpen && (
        <AssignToGroupModal
          student={student}
          onClose={() => setAssignOpen(false)}
          onAssigned={() => {
            setAssignOpen(false)
            onChanged()
          }}
        />
      )}

      {transferFrom && (
        <TransferStudentModal
          student={student}
          group={transferFrom}
          onClose={() => setTransferFrom(null)}
          onTransferred={() => {
            setTransferFrom(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}
