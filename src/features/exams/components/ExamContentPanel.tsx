import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Eye, ListChecks, Lock, Pencil } from 'lucide-react'
import EmptyState from '../../../components/common/EmptyState'
import { formatDateTime } from '../../../lib/format'
import type { ExamPapersOverview } from '../../../services/examService'
import type { Exam, ExamAssignment, ExamQuestionItem } from '../../../types'
import { useAnswersGate } from '../hooks/useAnswersGate'
import ExamActions from './ExamActions'
import ExamPaperViewer, { type PaperFocus } from './ExamPaperViewer'
import ExamQuestionBrowser from './ExamQuestionBrowser'

interface ExamContentPanelProps {
  exam: Exam
  assignments: ExamAssignment[]
  /** Câu hỏi của đề theo danh sách, theo đúng thứ tự giáo viên xếp; rỗng với đề theo ma trận. */
  questions: ExamQuestionItem[]
  /** Cách đề được chia thành các đề nhỏ; chỉ có với đề chia nhiều đề. */
  papers?: ExamPapersOverview
  /** Đề nhỏ cần mở ngay (từ liên kết ở bảng theo dõi hay thẻ Chia đề). */
  paperFocus?: PaperFocus
  /** Tab đang được mở. Rời tab là ẩn đáp án trở lại. */
  active: boolean
  onReload: () => void
}

/**
 * Tab "Nội dung" của trang chi tiết đề: các câu hỏi của đề (`ExamQuestionBrowser`: danh sách gọn bên trái, câu đang chọn
 * bên phải, dùng được với đề vài trăm câu), kèm một hàng mỏng gồm trạng thái mở đáp án và các thao tác với đề.
 *
 * Đáp án đúng **ẩn mặc định** và chỉ hiện khi giáo viên bấm "Xem đáp án" — mở đề trước lớp hay trên màn chiếu thì đáp án
 * không lộ ra ngay. Rời tab, hay tải lại trang, là ẩn trở lại. (Đừng nhầm với "Mở đáp án": nút đó cho **học sinh** xem
 * điểm và đáp án sau khi hết giờ.)
 */
export default function ExamContentPanel({
  exam, assignments, questions, papers, paperFocus, active, onReload,
}: ExamContentPanelProps) {
  const [revealed, setRevealed] = useState(false)
  const answersGate = useAnswersGate(exam)

  useEffect(() => {
    if (!active) setRevealed(false)
  }, [active])

  const hasQuestions = exam.usesQuestionList && questions.length > 0

  const editLink = (
    <NavLink
      to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
    >
      <Pencil size={15} /> Sửa đề
    </NavLink>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 flex items-start gap-1.5 min-w-0">
          {answersGate.state !== 'none' && (
            <>
              {exam.showResultAfterSubmit ? (
                <Eye size={13} className="flex-shrink-0 mt-0.5" />
              ) : (
                <Lock size={13} className="flex-shrink-0 mt-0.5" />
              )}
              <span>
                {exam.showResultAfterSubmit
                  ? answersGate.state === 'over'
                    ? 'Đáp án đã mở: học sinh đã nộp xem được điểm và đáp án từng câu.'
                    : `Đáp án tự mở cho học sinh sau khi lớp cuối hết giờ, lúc ${formatDateTime(answersGate.until)}.`
                  : answersGate.state === 'over'
                    ? 'Đã hết giờ. Bấm "Mở đáp án" để học sinh xem điểm và đáp án từng câu.'
                    : `Đáp án chưa mở. Chỉ mở được sau khi đã hết giờ, lúc ${formatDateTime(answersGate.until)}.`}
              </span>
            </>
          )}
        </p>
        <ExamActions exam={exam} assignments={assignments} onReload={onReload} />
      </div>

      {!exam.usesQuestionList && (
        <EmptyState
          icon={ListChecks}
          title="Đề theo ma trận chưa có danh sách câu hỏi cố định"
          description={`Các câu được rút từ ngân hàng theo tỷ lệ Dễ ${exam.easyPercentage}% · Trung bình ${exam.mediumPercentage}% · Khó ${exam.hardPercentage}%, nên chưa có bộ câu để xem ở đây.`}
          action={editLink}
        />
      )}

      {exam.usesQuestionList && questions.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="Đề chưa có câu hỏi nào"
          description="Thêm câu hỏi từ ngân hàng ở trang sửa đề."
          action={editLink}
        />
      )}

      {hasQuestions && papers && exam.paperCount > 1 && (
        <ExamPaperViewer
          overview={papers}
          pool={questions}
          bonusUnits={exam.paperBonusUnits}
          focus={paperFocus}
          revealed={revealed}
          onToggleReveal={() => setRevealed(current => !current)}
        />
      )}

      {hasQuestions && !(papers && exam.paperCount > 1) && (
        <ExamQuestionBrowser
          questions={questions}
          revealed={revealed}
          onToggleReveal={() => setRevealed(current => !current)}
        />
      )}
    </div>
  )
}
