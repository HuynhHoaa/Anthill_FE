import { AlertTriangle } from 'lucide-react'
import { difficultyLabels, type DifficultyLevel } from '../../../types'
import { difficultyBarColors, orderedDifficultyLevels } from '../utils/blueprintRatio'

/** Kết quả của một lần "Soạn tự động" rút không đủ số câu yêu cầu. */
export interface ComposeShortfall {
  /** Số câu còn thiếu ở từng mức (0 là đủ). */
  missing: Record<DifficultyLevel, number>
  /** Số câu rút được lần đó. */
  found: number
  /** Số câu đủ điều kiện nhưng bị bỏ vì các lớp đã chọn đã nhận ở đề trước. */
  skipped: number
}

interface ComposeShortfallNoticeProps {
  shortfall: ComposeShortfall
  onDismiss: () => void
}

/**
 * Khung vàng nằm trên danh sách câu sau khi "Soạn tự động" không rút đủ. Thông báo thoáng qua (toast) dễ bị bỏ sót: giáo viên
 * tưởng đề đã đủ số câu mình muốn. Khung này ở lại cho tới khi bấm "Đã hiểu" hoặc soạn lần khác.
 */
export default function ComposeShortfallNotice({ shortfall, onDismiss }: ComposeShortfallNoticeProps) {
  const lacking = orderedDifficultyLevels.filter(level => shortfall.missing[level] > 0)

  return (
    <div
      id="compose-shortfall"
      role="alert"
      className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="flex-shrink-0 mt-0.5 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-bold">Chưa đủ số câu bạn yêu cầu</p>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>Soạn tự động chỉ rút được {shortfall.found} câu. Còn thiếu:</span>
            {lacking.map(level => (
              <span
                key={level}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-amber-200 font-bold"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: difficultyBarColors[level] }} aria-hidden="true" />
                {shortfall.missing[level]} câu {difficultyLabels[level]}
              </span>
            ))}
          </p>

          <p className="leading-relaxed text-amber-800">
            Ngân hàng không còn đủ câu phù hợp: câu đã có trong đề không được rút lại
            {shortfall.skipped > 0 ? `, và ${shortfall.skipped} câu các lớp đã chọn đã nhận ở đề trước cũng bị bỏ` : ''}.
            Thêm câu bằng “Thêm từ ngân hàng” hoặc “Tạo câu hỏi mới”, hoặc soạn lại với số câu ít hơn.
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 transition-colors"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  )
}
