import { CalendarClock, Users } from 'lucide-react'
import { LifecycleBadge } from '../../../components/common/Badge'
import { formatDateTime } from '../../../lib/format'
import type { AssignmentWindow } from '../../../types'
import { windowLabel } from '../utils/assignmentWindowLabel'

/** Một dòng khung giờ, dùng lại được ở cả trang chi tiết lẫn trang giao bài. */
export function AssignmentWindowRow({ window }: { window: AssignmentWindow }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-700 min-w-0 break-words">{windowLabel(window)}</span>
        <LifecycleBadge lifecycle={window.lifecycle} />
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500 leading-relaxed">
        <CalendarClock size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          {formatDateTime(window.openAt)} – {formatDateTime(window.closeAt)}
        </span>
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
        <Users size={13} className="flex-shrink-0" />
        {window.assignedCount} học sinh
        {window.startedCount > 0 && ` · ${window.startedCount} đã bắt đầu`}
        {/* Nói rõ khung nào sẽ đi theo lịch đề: sửa lịch chung kéo theo đúng những lớp này, và đó là
            thứ giáo viên cần biết trước khi bấm sửa. */}
        {!window.hasScheduleOverride && ' · theo lịch chung'}
        {window.scheduleLocked && ' · đã khoá giờ'}
      </p>
    </div>
  )
}

/**
 * Khung giờ thật của từng lớp trên một đề.
 *
 * Lịch trên đầu trang đề chỉ là **mặc định**; từ khi mỗi lớp làm bài vào một tiết khác nhau thì chỉ
 * hiện lịch đó là giáo viên không biết lớp nào đang làm bài lúc này. Trạng thái mở/đóng của mỗi dòng
 * do server tính, bằng đúng phép so mà phía học sinh đi qua.
 */
export default function AssignmentWindowList({ windows }: { windows: AssignmentWindow[] }) {
  if (windows.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {windows.map(window => (
        <AssignmentWindowRow key={`${window.groupId ?? 'le'}-${window.openAt}-${window.closeAt}`} window={window} />
      ))}
    </div>
  )
}
