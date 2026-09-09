import { studentStatusLabels, type StudentStatus } from '../../../types'

const statusToneClass: Record<StudentStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  locked: 'bg-slate-100 text-slate-500',
}

export default function StudentStatusPill({ status }: { status: StudentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusToneClass[status]}`}
    >
      {studentStatusLabels[status]}
    </span>
  )
}
