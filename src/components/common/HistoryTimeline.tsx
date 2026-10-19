import { History } from 'lucide-react'
import { formatDateTime } from '../../lib/format'
import EmptyState from './EmptyState'

/** Một dòng lịch sử, đã dựng sẵn tiêu đề: mỗi nơi dùng (học sinh, giáo viên, lớp) tự nói "đã làm gì" theo cách của nó. */
export interface HistoryEntry {
  id: number
  title: string
  createdAt: string
  /** Người thực hiện; vắng mặt khi tài khoản đó không còn. */
  actorName?: string
  /** Lý do quản trị viên nhập. Vắng với việc không bắt buộc lý do. */
  reason?: string
}

interface HistoryTimelineProps {
  entries: HistoryEntry[]
  emptyTitle: string
  emptyDescription: string
  /** Bỏ khung thẻ khi đã nằm trong một thẻ khác. */
  bare?: boolean
}

/**
 * Danh sách lịch sử thay đổi — mới nhất trước, mỗi dòng ghi việc đã làm, lúc nào, ai làm và lý do. Dùng chung cho lịch sử của
 * học sinh, giáo viên và lớp để ba nơi đọc ra giống nhau.
 */
export default function HistoryTimeline({ entries, emptyTitle, emptyDescription, bare = false }: HistoryTimelineProps) {
  if (entries.length === 0) {
    return <EmptyState icon={History} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ol
      className={`divide-y divide-slate-50 animate-fade-in-up ${
        bare ? '' : 'bg-white rounded-2xl border border-slate-100 shadow-sm'
      }`}
    >
      {entries.map(entry => (
        <li key={entry.id} className="px-5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-sm font-semibold text-slate-800">{entry.title}</p>
            <p className="text-xs text-slate-400 whitespace-nowrap">
              {formatDateTime(entry.createdAt)}
              {entry.actorName ? ` · ${entry.actorName}` : ''}
            </p>
          </div>
          {entry.reason && (
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              <span className="text-slate-400">Lý do:</span> {entry.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
