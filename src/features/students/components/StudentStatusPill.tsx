import { studentStatusLabels, type StudentStatus } from '../../../types'

const statusToneClass: Record<StudentStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  locked: 'bg-slate-100 text-slate-500',
  // Hổ phách chứ không đỏ: chờ xoá vẫn còn đường lui, và màu phải báo cho người xem biết điều đó.
  pendingDeletion: 'bg-amber-100 text-amber-700',
  deleted: 'bg-rose-50 text-rose-500',
}

export default function StudentStatusPill({ status }: { status: StudentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusToneClass[status]}`}
    >
      {studentStatusLabels[status]}
    </span>
  )
}
