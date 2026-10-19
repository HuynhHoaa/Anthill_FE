import HistoryTimeline, { type HistoryEntry } from '../../../components/common/HistoryTimeline'
import type { GroupChange } from '../../../types'

function titleOf(change: GroupChange): string {
  switch (change.kind) {
    case 'created':
      return `Lập lớp${change.toTeacher ? `, giáo viên ${change.toTeacher}` : ''}`
    case 'locked':
      return 'Khoá lớp'
    case 'unlocked':
      return 'Mở khoá lớp'
    default:
      return change.fromTeacher
        ? `Đổi giáo viên: ${change.fromTeacher} → ${change.toTeacher ?? '?'}`
        : `Chọn giáo viên: ${change.toTeacher ?? '?'}`
  }
}

function toEntry(change: GroupChange): HistoryEntry {
  const title = titleOf(change)

  return {
    id: change.id,
    title,
    createdAt: change.createdAt,
    actorName: change.actorName,
    reason: change.reason,
  }
}

/**
 * Lịch sử của lớp: lớp ra đời với ai, mỗi lần đổi giáo viên phụ trách, khoá và mở khoá, kèm lý do và người thực hiện. Nằm
 * cạnh phần thiết lập vì đó là nơi làm các việc này.
 */
export default function GroupHistoryPanel({ changes }: { changes: GroupChange[] }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up">
      <h2 className="px-5 py-3 border-b border-slate-100 text-sm font-bold text-slate-800">Lịch sử của lớp</h2>
      <div className="max-h-[28rem] overflow-y-auto">
        <HistoryTimeline
          bare
          entries={changes.map(toEntry)}
          emptyTitle="Chưa có thay đổi nào"
          emptyDescription="Lập lớp, đổi giáo viên phụ trách, khoá và mở khoá lớp được ghi lại ở đây, kèm lý do và người thực hiện."
        />
      </div>
    </section>
  )
}
