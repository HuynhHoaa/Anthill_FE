import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CalendarClock, Loader2 } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { formatDateTime } from '../../../lib/format'
import type { Exam, ExamAssignment } from '../../../types'
import {
  isCloseAfterOpen, minutesBetween, opensWithinLockWindow, SCHEDULE_LOCK_WARNING, toDateTimeLocalValue,
  toServiceDateTime,
} from '../utils/examScheduleFormat'

interface RescheduleAssignmentDialogProps {
  open: boolean
  exam: Exam
  assignment: ExamAssignment | null
  /** Khung giờ của em này vừa bị khoá (đọc từ bảng đã tải lại): chỉ còn đóng hộp. */
  locked?: boolean
  loading: boolean
  error: string | null
  onSubmit: (window: { openAt?: string; closeAt?: string }) => void
  onCancel: () => void
}

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'

/**
 * Dời giờ làm bài của **một** học sinh được giao đích danh.
 *
 * Chỉ những em đó mới có mặt ở đây: em được giao qua lớp làm bài theo giờ của cả lớp, và sửa giờ cho
 * riêng một em trong lớp là cách chắc chắn nhất để hai em ngồi cạnh nhau thấy hai hạn nộp khác nhau
 * mà không ai giải thích được vì sao. Server cũng từ chối đúng như vậy.
 */
export default function RescheduleAssignmentDialog({
  open, exam, assignment, locked = false, loading, error, onSubmit, onCancel,
}: RescheduleAssignmentDialogProps) {
  const [followExam, setFollowExam] = useState(false)
  const [openAtLocal, setOpenAtLocal] = useState('')
  const [closeAtLocal, setCloseAtLocal] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  // Mở hộp là nạp lại giờ đang có của chính em này. Giữ lại giá trị của lần mở trước thì giáo viên
  // dời nhầm em thứ hai sang giờ của em thứ nhất mà không nhận ra.
  useEffect(() => {
    if (!open || !assignment) return
    setFollowExam(!assignment.hasScheduleOverride)
    setOpenAtLocal(toDateTimeLocalValue(assignment.openAt))
    setCloseAtLocal(toDateTimeLocalValue(assignment.closeAt))
    setLocalError(null)
  }, [open, assignment])

  if (!assignment) return null

  const handleSubmit = () => {
    if (followExam) {
      onSubmit({})
      return
    }

    if (!isCloseAfterOpen(openAtLocal, closeAtLocal)) {
      setLocalError('Giờ đóng bài phải sau giờ mở bài.')
      return
    }

    // Cùng phép kiểm của server, chỉ để giáo viên biết ngay thay vì đợi một lượt gọi API trả về lỗi.
    if (minutesBetween(openAtLocal, closeAtLocal) < exam.durationMinutes) {
      setLocalError(
        `Đề này cho làm bài ${exam.durationMinutes} phút, dài hơn khung giờ vừa chọn. `
        + 'Hãy nới khung giờ ra.',
      )
      return
    }

    setLocalError(null)
    onSubmit({ openAt: toServiceDateTime(openAtLocal), closeAt: toServiceDateTime(closeAtLocal) })
  }

  const shownError = localError ?? error

  // Gõ nhầm ngày (ví dụ ngày trong tháng) là cực dễ xảy ra với ô datetime-local, và hậu quả là khoá
  // luôn học sinh khỏi bài thi ngay khi lưu — không ai biết cho tới khi có người hỏi. Không chặn hẳn
  // vì giáo viên có thể cố ý tạo bài thi bù đã đóng để chấm điểm 0, nhưng phải nói trước khi bấm lưu.
  const closeAtDate = !followExam ? new Date(closeAtLocal) : null
  const isPastWindow =
    closeAtDate !== null && !Number.isNaN(closeAtDate.getTime()) && closeAtDate.getTime() < Date.now()

  return (
    <Modal
      open={open}
      title={`Dời giờ làm bài của ${assignment.studentName}`}
      size="sm"
      onClose={() => {
        if (!loading) onCancel()
      }}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || locked}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Lưu khung giờ
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          Khung giờ hiện tại của em:{' '}
          <span className="font-semibold text-slate-700">
            {formatDateTime(assignment.openAt)} – {formatDateTime(assignment.closeAt)}
          </span>
          {assignment.hasScheduleOverride ? ' (khung riêng của em).' : ' (theo lịch chung của đề).'}
        </p>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={followExam}
            onChange={event => {
              setFollowExam(event.target.checked)
              setLocalError(null)
            }}
            className="w-4 h-4 accent-indigo-600 mt-0.5 flex-shrink-0"
          />
          <span className="min-w-0">
            <span className="text-sm font-medium text-slate-700">Theo lịch chung của đề</span>
            <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
              {formatDateTime(exam.openAt)} – {formatDateTime(exam.closeAt)}. Chọn mục này là gỡ khung giờ
              riêng, và về sau sửa lịch đề sẽ kéo em theo.
            </span>
          </span>
        </label>

        {!followExam && (
          <div className="space-y-3">
            <div>
              <label htmlFor="reschedule-open-at" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Mở bài lúc
              </label>
              <input
                id="reschedule-open-at"
                type="datetime-local"
                value={openAtLocal}
                onChange={event => {
                  setOpenAtLocal(event.target.value)
                  setLocalError(null)
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reschedule-close-at" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Đóng bài lúc
              </label>
              <input
                id="reschedule-close-at"
                type="datetime-local"
                value={closeAtLocal}
                onChange={event => {
                  setCloseAtLocal(event.target.value)
                  setLocalError(null)
                }}
                className={inputClass}
              />
            </div>
            <p className="flex items-start gap-1.5 text-xs text-slate-400 leading-relaxed">
              <CalendarClock size={13} className="flex-shrink-0 mt-0.5" />
              Khung giờ phải chứa trọn {exam.durationMinutes} phút làm bài, nếu không em sẽ bị cắt bài giữa chừng.
            </p>

            {!isPastWindow && opensWithinLockWindow(openAtLocal, closeAtLocal) && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2 text-sm text-amber-700"
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{SCHEDULE_LOCK_WARNING}</span>
              </div>
            )}

            {isPastWindow && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2 text-sm text-amber-700"
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Khung giờ này đã kết thúc, em sẽ không làm được bài nếu chưa bắt đầu. Vẫn lưu được nếu
                  bạn cố ý tạo khung giờ đã đóng để chấm điểm 0 cho em.
                </span>
              </div>
            )}
          </div>
        )}

        {shownError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start gap-2 text-sm text-red-600"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{shownError}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
