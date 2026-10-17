import { CheckCircle2 } from 'lucide-react'
import { resolveMediaUrl } from '../../../lib/apiClient'
import { hasQuestionTitle, questionDisplayTitle } from '../../../lib/questionTitle'
import type { Question } from '../../../types'

const ANSWER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Phần thân của một câu hỏi để giáo viên duyệt: tên (nếu đã đặt), nội dung, ảnh và các đáp án với đáp án
 * đúng đánh dấu rõ. Dùng chung cho thẻ câu trong đề và khung xem câu hỏi ở hộp chọn từ ngân hàng, để hai nơi
 * không bao giờ hiện cùng một câu theo hai cách khác nhau.
 *
 * Câu chưa đặt tên thì không có dòng tên: tên lúc đó chỉ là phần đầu của nội dung, in ra là lặp lại.
 */
export default function QuestionBody({
  question, showAnswers = true,
}: {
  question: Question
  /** false: các đáp án hiện như nhau, không đánh dấu đáp án đúng (xem đề mà chưa muốn lộ đáp án). */
  showAnswers?: boolean
}) {
  return (
    <>
      {hasQuestionTitle(question) && (
        <h3 className="text-base font-bold text-slate-900 leading-snug mb-1.5">{questionDisplayTitle(question)}</h3>
      )}

      <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">{question.content}</p>

      {question.imageUrl && (
        <img
          src={resolveMediaUrl(question.imageUrl)}
          alt=""
          className="mt-3 max-h-64 w-auto max-w-full rounded-xl border border-slate-100 object-contain"
        />
      )}

      {question.allowMultiple && (
        <p className="mt-4 text-xs font-semibold text-violet-600">
          Câu nhiều đáp án đúng — học sinh phải chọn đúng và đủ mới được điểm
        </p>
      )}

      <ul className={`${question.allowMultiple ? 'mt-2' : 'mt-4'} space-y-2`}>
        {question.answers.map((answer, index) => (
          <li
            key={answer.id}
            className={`flex items-start gap-3 rounded-xl px-3.5 py-2.5 text-sm ${
              showAnswers && answer.isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-700'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                showAnswers && answer.isCorrect ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-500'
              }`}
            >
              {ANSWER_LETTERS[index] ?? index + 1}
            </span>
            <span className="flex-1 min-w-0 leading-relaxed">
              {answer.content}
              {answer.imageUrl && (
                <img
                  src={resolveMediaUrl(answer.imageUrl)}
                  alt=""
                  className="mt-2 max-h-32 rounded-lg border border-slate-100 object-contain"
                />
              )}
            </span>
            {showAnswers && answer.isCorrect && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 flex-shrink-0">
                <CheckCircle2 size={14} /> Đáp án đúng
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
