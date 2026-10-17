import { ArrowDown, ArrowUp, EyeOff, Trash2 } from 'lucide-react'
import { DifficultyBadge } from '../../../components/common/Badge'
import type { Question } from '../../../types'
import QuestionBody from './QuestionBody'

interface ExamQuestionCardProps {
  /** Số thứ tự hiện trên thẻ, bắt đầu từ 1. */
  number: number
  question: Question
  point: number
  /** Cấu hình đề đã khoá (có em đã bắt đầu làm): không đổi điểm, không bỏ, không xếp lại. */
  locked: boolean
  pointError?: string
  isFirst: boolean
  isLast: boolean
  /** Điểm do cấu hình chia đề đặt theo mức độ, không sửa riêng từng câu được: ô điểm chỉ để xem. */
  pointFromLevel?: boolean
  /** Câu vừa được thêm vào đề: nổi lên và sáng viền một nhịp để giáo viên thấy đâu là câu mới. */
  highlight?: boolean
  onPointChange: (rawValue: string) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}

/**
 * Một câu trong danh sách của đề, trình bày như thẻ câu hỏi của Google Form: tên và nội dung, ảnh, các đáp án
 * với đáp án đúng đánh dấu rõ (phần thân là `QuestionBody`), và ô điểm của riêng câu đó.
 *
 * Giáo viên duyệt đề ở đây nên đáp án đúng luôn hiện — khác màn hình làm bài của học sinh.
 */
export default function ExamQuestionCard({
  number, question, point, locked, pointError, isFirst, isLast, pointFromLevel = false, highlight = false, onPointChange, onRemove, onMove,
}: ExamQuestionCardProps) {
  const isHidden = question.status === 'hidden'

  return (
    <article
      id={`exam-question-${question.id}`}
      className={`rounded-2xl border bg-white shadow-sm ${
        isHidden ? 'border-amber-300' : 'border-slate-100'
      } ${highlight ? 'animate-flash' : ''}`}
    >
      <div className="flex flex-wrap items-start gap-3 px-5 pt-4">
        <span className="inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold">
          {number}
        </span>

        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 pt-1">
          <DifficultyBadge level={question.difficulty} />
          {question.topic && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {question.topic}
            </span>
          )}
          {question.allowMultiple && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
              Nhiều đáp án
            </span>
          )}
          {isHidden && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <EyeOff size={12} /> Đang bị ẩn
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Điểm
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={point}
              disabled={locked || pointFromLevel}
              title={pointFromLevel ? 'Điểm đặt theo mức độ ở tab Cấu hình, mục Chia đề' : undefined}
              onChange={event => onPointChange(event.target.value)}
              aria-label={`Điểm của câu ${number}`}
              aria-invalid={pointError ? true : undefined}
              className={`w-20 px-2.5 py-1.5 rounded-lg border text-sm font-semibold text-right outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-slate-400 ${
                pointError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-50'
                  : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-50'
              }`}
            />
          </label>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={locked || isFirst}
              aria-label={`Đưa câu ${number} lên trên`}
              className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={locked || isLast}
              aria-label={`Đưa câu ${number} xuống dưới`}
              className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={locked}
              aria-label={`Bỏ câu ${number} khỏi đề`}
              title="Bỏ khỏi đề (câu vẫn còn trong ngân hàng)"
              className="w-8 h-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {pointError && <p className="px-5 pt-1 text-xs font-medium text-red-500 text-right">{pointError}</p>}

      <div className="px-5 pt-3 pb-4">
        <QuestionBody question={question} />
      </div>
    </article>
  )
}
