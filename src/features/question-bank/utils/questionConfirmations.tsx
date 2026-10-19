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
 *
 * `author` chỉ truyền khi người ẩn không phải người soạn (quản trị viên ẩn câu của giáo viên): hộp nói rõ câu của ai, vì việc ẩn lúc
 * đó đụng tới ngân hàng của người khác.
 */
export function questionStatusConfirmCopy(
  question: { title?: string; content: string; difficulty: DifficultyLevel },
  nextStatus: QuestionStatus,
  author?: string,
) {
  if (nextStatus !== 'hidden') return null

  const label = labelOf(question)
  const difficulty = difficultyLabels[question.difficulty].toLowerCase()

  return {
    title: 'Ẩn câu hỏi',
    message: `Câu hỏi “${label}”${author ? ` của ${author}` : ''} sẽ không được chọn khi hệ thống sinh đề từ giờ.`,
    details: (
      <ConsequenceList
        items={[
          `Đề nào đang cần vừa đủ câu mức ${difficulty} có thể không giao thêm được cho tới khi ${
            author ? 'có' : 'bạn bổ sung'
          } câu khác.`,
          'Đề đã phát và bài đã nộp giữ nguyên.',
          author
            ? `Câu vẫn là của ${author}; họ thấy nó ở trạng thái đang ẩn và hiện lại được.`
            : 'Bạn có thể hiện lại câu hỏi bất cứ lúc nào.',
        ]}
      />
    ),
    confirmLabel: 'Ẩn câu hỏi',
    tone: 'danger' as const,
  }
}

/**
 * Hộp xác nhận xoá câu hỏi — chỉ quản trị viên xoá được. Giáo viên không có nút xoá: ẩn đã là cách gỡ câu khỏi ngân hàng mà vẫn
 * giữ đề và bài đã làm.
 *
 * Server từ chối xoá câu đã nằm trong một bài kiểm tra (409, kèm gợi ý ẩn thay vì xoá) và lời từ chối hiện ngay trong hộp, nên hộp
 * chỉ cần nói trước điều đó chứ không phải tự kiểm.
 */
export function questionDeleteConfirmCopy(question: { title?: string; content: string }, author?: string) {
  const label = labelOf(question)

  return {
    title: 'Xoá câu hỏi',
    message: `Câu hỏi “${label}”${author ? ` của ${author}` : ''} sẽ bị xoá khỏi ngân hàng.`,
    details: (
      <ConsequenceList
        items={[
          'Xoá rồi không khôi phục được.',
          'Câu đã nằm trong một bài kiểm tra thì không xoá được; khi đó hãy ẩn câu hỏi.',
        ]}
      />
    ),
    confirmLabel: 'Xoá câu hỏi',
    tone: 'danger' as const,
    enterConfirms: false,
  }
}
