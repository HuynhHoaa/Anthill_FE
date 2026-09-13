import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { DifficultyBadge } from '../../../components/common/Badge'
import { resolveMediaUrl } from '../../../lib/apiClient'
import type { AnswerOption, DifficultyLevel } from '../../../types'

interface QuestionPreviewProps {
  content: string
  imageUrl?: string
  topic: string
  difficulty: DifficultyLevel
  point: number
  answers: AnswerOption[]
}

/** Hiển thị câu hỏi đúng như học sinh nhìn thấy khi làm bài, cập nhật ngay theo form. */
export default function QuestionPreview({
  content,
  imageUrl,
  topic,
  difficulty,
  point,
  answers,
}: QuestionPreviewProps) {
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false)

  // Đáp án đã chọn có thể vừa bị xoá khỏi form nên phải đối chiếu lại danh sách hiện tại.
  const activeAnswerId = answers.some(answer => answer.id === selectedAnswerId) ? selectedAnswerId : null

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Xem trước như học sinh</h2>
          <p className="text-xs text-slate-400 mt-0.5">Bấm thử một đáp án để xem giao diện khi làm bài</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCorrectAnswer(current => !current)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
        >
          {showCorrectAnswer ? <EyeOff size={14} /> : <Eye size={14} />}
          {showCorrectAnswer ? 'Ẩn đáp án đúng' : 'Hiện đáp án đúng'}
        </button>
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              Câu 1
            </span>
            {topic.trim() && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                {topic.trim()}
              </span>
            )}
            <DifficultyBadge level={difficulty} />
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
              {point > 0 ? `${point} điểm` : 'Chưa đặt điểm'}
            </span>
          </div>

          {content.trim() ? (
            <p className="text-base font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
              {content.trim()}
            </p>
          ) : (
            <p className="text-base text-slate-300 italic">Nội dung câu hỏi sẽ hiển thị ở đây…</p>
          )}

          {imageUrl && (
            <img
              src={resolveMediaUrl(imageUrl)}
              alt="Hình minh họa câu hỏi"
              className="mt-4 rounded-xl border border-slate-200 bg-white max-h-56 object-contain"
            />
          )}

          <div className="space-y-2.5 mt-5">
            {answers.map((answer, index) => {
              const isSelected = activeAnswerId === answer.id
              const isRevealed = showCorrectAnswer && answer.isCorrect
              return (
                <button
                  key={answer.id}
                  type="button"
                  onClick={() => setSelectedAnswerId(answer.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    isRevealed
                      ? 'border-emerald-300 bg-emerald-50'
                      : isSelected
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isRevealed
                          ? 'bg-emerald-500 text-white'
                          : isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isRevealed ? <CheckCircle2 size={16} /> : String.fromCharCode(65 + index)}
                    </div>
                    <div className="min-w-0 flex-1">
                      {answer.content.trim() ? (
                        <span className="font-medium text-slate-700 break-words">{answer.content.trim()}</span>
                      ) : (
                        !answer.imageUrl && (
                          <span className="text-slate-300 italic">Đáp án {String.fromCharCode(65 + index)} chưa có nội dung</span>
                        )
                      )}
                      {answer.imageUrl && (
                        <img
                          src={resolveMediaUrl(answer.imageUrl)}
                          alt={`Hình minh họa đáp án ${String.fromCharCode(65 + index)}`}
                          className="mt-2 rounded-lg border border-slate-200 bg-white max-h-28 object-contain"
                        />
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
