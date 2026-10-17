import { AlertTriangle } from 'lucide-react'
import DateTimeInput from '../../../components/common/DateTimeInput'
import {
  isCloseAfterOpen, minutesBetween, opensWithinLockWindow, SCHEDULE_LOCK_WARNING,
} from '../utils/examScheduleFormat'

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'

interface AssignWindowFieldsProps {
  idPrefix: string
  draft: { openAtLocal: string; closeAtLocal: string }
  durationMinutes: number
  onChange: (changes: Partial<{ openAtLocal: string; closeAtLocal: string }>) => void
  /**
   * `true` xếp hai ô giờ chồng lên nhau thay vì nằm cạnh nhau.
   *
   * Chỉ cần cho vị trí đang bị "hẹp kép": lưới thẻ lớp (`xl:grid-cols-2`) lồng trong lưới ô giờ
   * (`sm:grid-cols-2`) khiến mỗi ô chỉ còn ~150-190px, không đủ chỗ cho ô ngày giờ (ngày, nút lịch và giờ).
   * Các chỗ dùng component này còn lại (form tạo đề, hộp
   * Dời giờ) đã đủ rộng nên giữ nguyên mặc định nằm cạnh nhau.
   */
  stackedFields?: boolean
  /**
   * Báo trước khi lưu: giờ mở vừa chọn rơi vào vùng khoá nên lưu xong là không đổi được nữa. Chỉ truyền khi
   * khung này đang đổi một khung đã có người theo — khung mới tinh chưa có ai phụ thuộc.
   */
  warnLock?: boolean
}

/** Cặp ô giờ mở – giờ đóng, kèm lời cảnh báo khi khung ngắn hơn thời lượng làm bài. */
export default function AssignWindowFields({
  idPrefix, draft, durationMinutes, onChange, stackedFields = false, warnLock = false,
}: AssignWindowFieldsProps) {
  const filled = draft.openAtLocal !== '' && draft.closeAtLocal !== ''
  const ordered = isCloseAfterOpen(draft.openAtLocal, draft.closeAtLocal)
  const span = minutesBetween(draft.openAtLocal, draft.closeAtLocal)

  // Cùng hai phép kiểm của server, hiện ngay tại chỗ đang gõ: đợi tới lúc bấm giao mới báo thì giáo
  // viên phải dò lại xem lớp nào trong năm lớp vừa chọn đang sai.
  const problem = !filled
    ? 'Hãy chọn cả giờ mở và giờ đóng.'
    : !ordered
      ? 'Giờ đóng phải sau giờ mở.'
      : span < durationMinutes
        ? `Khung này chỉ dài ${span} phút, không chứa trọn ${durationMinutes} phút làm bài.`
        : null

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-white border border-slate-100 p-3.5">
      <div className={`grid grid-cols-1 gap-3 ${stackedFields ? '' : 'sm:grid-cols-2'}`}>
        <div>
          <label htmlFor={`${idPrefix}-open`} className="block text-xs font-semibold text-slate-600 mb-1.5">
            Mở bài lúc
          </label>
          <DateTimeInput
            id={`${idPrefix}-open`}
            value={draft.openAtLocal}
            onChange={value => onChange({ openAtLocal: value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-close`} className="block text-xs font-semibold text-slate-600 mb-1.5">
            Đóng bài lúc
          </label>
          <DateTimeInput
            id={`${idPrefix}-close`}
            value={draft.closeAtLocal}
            onChange={value => onChange({ closeAtLocal: value })}
            className={inputClass}
          />
        </div>
      </div>
      {problem ? (
        <p className="text-xs font-medium text-red-500 flex items-start gap-1.5">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          {problem}
        </p>
      ) : (
        <p className="text-xs text-slate-400">Khung dài {span} phút cho bài {durationMinutes} phút.</p>
      )}
      {warnLock && filled && opensWithinLockWindow(draft.openAtLocal, draft.closeAtLocal) && (
        <p className="text-xs font-medium text-amber-700 flex items-start gap-1.5 leading-relaxed">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          {SCHEDULE_LOCK_WARNING}
        </p>
      )}
    </div>
  )
}
