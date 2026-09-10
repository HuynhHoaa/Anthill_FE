/**
 * Câu chữ của các hộp xác nhận quanh câu hỏi — ngân hàng câu hỏi và trang sửa câu hỏi cùng dùng.
 */
import { difficultyLabels, type DifficultyLevel, type QuestionStatus } from '../../../types'

function shorten(content: string, maxLength = 80): string {
  const trimmed = content.trim()
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed
}

/**
 * Ẩn hoặc hiện lại một câu hỏi.
 *
 * Ẩn nghe như việc nhỏ nhưng có hệ quả xa: ngân hàng hụt một câu ở đúng mức độ đó, và một đề đang
 * vừa khít số câu sẽ không sinh được cho lượt giao bài tiếp theo. Đề đã phát thì không bị gì — bản
 * đề đã được chụp lại lúc sinh.
 */
export function questionStatusConfirmCopy(
  question: { content: string; difficulty: DifficultyLevel },
  nextStatus: QuestionStatus,
) {
  const label = shorten(question.content)
  const difficulty = difficultyLabels[question.difficulty].toLowerCase()

  return nextStatus === 'hidden'
    ? {
        title: 'Ẩn câu hỏi',
        message: `Câu hỏi "${label}" sẽ không được chọn khi hệ thống sinh đề từ giờ. Đề nào đang cần vừa đủ câu mức ${difficulty} có thể không giao thêm được cho tới khi bạn bổ sung câu khác. Đề đã phát và bài đã nộp giữ nguyên; bạn có thể hiện lại câu hỏi bất cứ lúc nào.`,
        confirmLabel: 'Ẩn câu hỏi',
        tone: 'danger' as const,
      }
    : {
        title: 'Hiện lại câu hỏi',
        message: `Câu hỏi "${label}" sẽ quay lại ngân hàng và có thể được chọn khi hệ thống sinh đề cho những lượt giao bài từ giờ. Đề đã phát không thay đổi.`,
        confirmLabel: 'Hiện câu hỏi',
        tone: 'primary' as const,
      }
}

export function questionDeleteConfirmCopy(question: { content: string; topic: string; difficulty: DifficultyLevel }) {
  return {
    title: 'Xoá câu hỏi',
    message: `Câu hỏi "${shorten(question.content)}" (chủ đề ${question.topic}, mức ${difficultyLabels[question.difficulty].toLowerCase()}) sẽ bị xoá khỏi ngân hàng và không khôi phục được. Đề đã phát và bài đã nộp vẫn giữ nguyên câu này. Nếu chỉ muốn tạm ngừng dùng, hãy ẩn câu hỏi thay vì xoá.`,
    confirmLabel: 'Xoá câu hỏi',
    tone: 'danger' as const,
  }
}
