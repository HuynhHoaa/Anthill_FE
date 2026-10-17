import { CheckCircle2, ImagePlus, ImageOff, Trash2 } from 'lucide-react'
import ImageUploader from '../../../components/common/ImageUploader'
import type { AnswerOption } from '../../../types'

interface AnswerEditorRowProps {
  answer: AnswerOption
  index: number
  /** Câu nhiều đáp án: ô chữ cái là công tắc bật/tắt riêng từng ô, không loại các ô còn lại. */
  allowMultiple: boolean
  canRemove: boolean
  imageOpen: boolean
  /** Đáp án này chưa có nội dung hay ảnh: ô nhập sáng lên. */
  contentMissing: boolean
  /** Cả câu chưa có đáp án đúng nào: ô chữ cái sáng lên để biết phải bấm chọn. */
  correctMissing: boolean
  onContentChange: (value: string) => void
  onImageChange: (url: string | undefined) => void
  onImageUploadingChange: (uploading: boolean) => void
  onToggleImage: () => void
  onMarkCorrect: () => void
  onRemove: () => void
}

export default function AnswerEditorRow({
  answer,
  index,
  allowMultiple,
  canRemove,
  imageOpen,
  contentMissing,
  correctMissing,
  onContentChange,
  onImageChange,
  onImageUploadingChange,
  onToggleImage,
  onMarkCorrect,
  onRemove,
}: AnswerEditorRowProps) {
  const answerLetter = String.fromCharCode(65 + index)

  return (
    <div
      className={`rounded-xl border p-2 transition-colors ${
        answer.isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/60'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onMarkCorrect}
          aria-pressed={answer.isCorrect}
          title={
            allowMultiple
              ? answer.isCorrect
                ? `Bỏ đáp án ${answerLetter} khỏi các đáp án đúng`
                : `Thêm đáp án ${answerLetter} vào các đáp án đúng`
              : answer.isCorrect
                ? `Đáp án ${answerLetter} đang là đáp án đúng`
                : `Chọn đáp án ${answerLetter} là đáp án đúng`
          }
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors ${
            answer.isCorrect
              ? 'bg-emerald-500 text-white'
              : correctMissing
                ? 'bg-amber-50 text-amber-700 border border-amber-400 ring-4 ring-amber-100 hover:border-emerald-300 hover:text-emerald-600'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
          }`}
        >
          {answer.isCorrect ? <CheckCircle2 size={17} /> : answerLetter}
        </button>

        <div className="flex-1 min-w-0">
          <input
            value={answer.content}
            onChange={event => onContentChange(event.target.value)}
            aria-label={`Nội dung đáp án ${answerLetter}`}
            data-attention={contentMissing ? 'true' : undefined}
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-4 ${
              contentMissing
                ? 'border-amber-400 bg-amber-50/70 ring-4 ring-amber-100 focus:border-amber-500 focus:ring-amber-100'
                : 'border-slate-200 bg-white focus:border-indigo-400 focus:ring-indigo-50'
            }`}
            placeholder={`Nội dung đáp án ${answerLetter}`}
          />
          {imageOpen && (
            <div className="mt-2">
              <ImageUploader
                compact
                value={answer.imageUrl}
                onChange={onImageChange}
                onUploadingChange={onImageUploadingChange}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleImage}
            title={imageOpen ? `Bỏ ảnh của đáp án ${answerLetter}` : `Thêm ảnh cho đáp án ${answerLetter}`}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              imageOpen ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            {imageOpen ? <ImageOff size={16} /> : <ImagePlus size={16} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            title={canRemove ? `Xoá đáp án ${answerLetter}` : 'Câu hỏi phải có tối thiểu 2 đáp án'}
            className="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
