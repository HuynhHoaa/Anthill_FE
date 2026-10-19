import { CalendarRange, ChevronDown } from 'lucide-react'
import type { AcademicTerm } from '../../../types'
import type { TermSelection } from '../hooks/useTermSelection'

interface TermSelectProps {
  terms: AcademicTerm[]
  value: TermSelection
  onChange: (value: TermSelection) => void
}

/** Ô chọn kỳ học: lọc lớp và bảng điểm theo kỳ. Chọn bằng danh sách thả xuống vì số kỳ tăng theo năm (ba kỳ một năm ở đại học). */
export default function TermSelect({ terms, value, onChange }: TermSelectProps) {
  return (
    <div className="relative inline-block">
      <CalendarRange size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" />
      <select
        aria-label="Lọc theo kỳ học"
        value={String(value)}
        onChange={event => onChange(event.target.value === 'all' ? 'all' : Number(event.target.value))}
        className="appearance-none pl-10 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 cursor-pointer outline-none hover:border-indigo-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all max-w-[18rem]"
      >
        <option value="all">Tất cả các kỳ</option>
        {terms.map(term => (
          <option key={term.id} value={term.id}>{term.isCurrent ? `${term.name} (hiện tại)` : term.name}</option>
        ))}
      </select>
      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}
