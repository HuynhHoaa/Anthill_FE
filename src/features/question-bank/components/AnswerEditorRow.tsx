import { CheckCircle2, ImagePlus, ImageOff, Trash2 } from 'lucide-react'
import ImageUploader from '../../../components/common/ImageUploader'
import type { AnswerOption } from '../../../types'

interface AnswerEditorRowProps {
  answer: AnswerOption
  index: number
  canRemove: boolean
  imageOpen: boolean
  onContentChange: (value: string) => void
  onImageChange: (dataUrl: string | undefined) => void
  onToggleImage: () => void
  onMarkCorrect: () => void
  onRemove: () => void
}

export default function AnswerEditorRow({
  answer,
  index,
  canRemove,
  imageOpen,
  onContentChange,
  onImageChange,
  onToggleImage,
  onMarkCorrect,
  onRemove,
}: AnswerEditorRowProps) {
  const answerLetter = String.fromCharCode(65 + index)

  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        answer.isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/60'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onMarkCorrect}
          aria-pressed={answer.isCorrect}
          title={answer.isCorrect ? `Đáp án ${answerLetter} đang là đáp án đúng` : `Chọn đáp án ${answerLetter} là đáp án đúng`}
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors ${
            answer.isCorrect
              ? 'bg-emerald-500 text-white'
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
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            placeholder={`Nội dung đáp án ${answerLetter}`}
          />
          {imageOpen && (
            <div className="mt-3">
              <ImageUploader compact value={answer.imageUrl} onChange={onImageChange} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleImage}
            title={imageOpen ? `Bỏ ảnh của đáp án ${answerLetter}` : `Thêm ảnh cho đáp án ${answerLetter}`}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
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
            className="w-9 h-9 rounded-xl text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
