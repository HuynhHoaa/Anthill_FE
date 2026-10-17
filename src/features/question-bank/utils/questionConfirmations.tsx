/**
 * Câu chữ của các hộp xác nhận quanh câu hỏi — ngân hàng câu hỏi và trang sửa câu hỏi cùng dùng.
 */
import ConsequenceList from '../../../components/common/ConsequenceList'
import { questionDisplayTitle } from '../../../lib/questionTitle'
import { difficultyLabels, type DifficultyLevel, type QuestionStatus } from '../../../types'

/** Tên câu hỏi để nhắc trong hộp xác nhận: tên đã đặt, hoặc phần đầu nội dung. */
function labelOf(question: { title?: string; content: string }): string {
  return questionDisplayTitle(question, 80)
}

/**
 * Hộp xác nhận khi đổi trạng thái câu hỏi, hoặc `null` khi việc đó không cần hỏi.
 *
 * Ẩn nghe như việc nhỏ nhưng có hệ quả xa: ngân hàng hụt một câu ở đúng mức độ đó, và một đề đang
 * vừa khít số câu sẽ không sinh được cho lượt giao bài tiếp theo. Đề đã phát thì không bị gì — bản
 * đề đã được chụp lại lúc sinh.
 *
 * Hiện lại thì không hỏi: nó không làm hỏng gì và bấm lại là ẩn đi. Hỏi lại một việc vô hại chỉ tập
 * cho người dùng thói quen bấm "Đồng ý" mà không đọc — đúng thứ làm hộp ẩn câu hỏi mất tác dụng.
 * Quy tắc nằm ở đây để ngân hàng câu hỏi và trang sửa câu hỏi không thể mỗi nơi hỏi một kiểu.
 */
export function questionStatusConfirmCopy(
  question: { title?: string; content: string; difficulty: DifficultyLevel },
  nextStatus: QuestionStatus,
) {
  if (nextStatus !== 'hidden') return null

  const label = labelOf(question)
  const difficulty = difficultyLabels[question.difficulty].toLowerCase()

  return {
    title: 'Ẩn câu hỏi',
    message: `Câu hỏi “${label}” sẽ không được chọn khi hệ thống sinh đề từ giờ.`,
    details: (
      <ConsequenceList
        items={[
          `Đề nào đang cần vừa đủ câu mức ${difficulty} có thể không giao thêm được cho tới khi bạn bổ sung câu khác.`,
          'Đề đã phát và bài đã nộp giữ nguyên.',
          'Bạn có thể hiện lại câu hỏi bất cứ lúc nào.',
        ]}
      />
    ),
    confirmLabel: 'Ẩn câu hỏi',
    tone: 'danger' as const,
  }
}
