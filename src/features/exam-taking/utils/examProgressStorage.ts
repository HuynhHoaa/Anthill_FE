/**
 * Giữ lại vị trí đang đọc và các câu được đánh dấu "xem lại" của một lượt làm bài.
 *
 * Vì sao tách riêng khỏi dữ liệu bài làm: đây là trạng thái của giao diện, không phải của bài thi.
 * Đáp án đã chọn thuộc về server và phải đi qua lưu nháp; còn "tôi đang ở câu 35" và "tôi đánh dấu
 * sáu câu này để quay lại" thì chỉ có nghĩa với đúng người đang ngồi trước màn hình. Nhét chúng
 * vào bản ghi bài làm là bắt server giữ hộ thứ nó không cần biết.
 *
 * Vì sao phải giữ: học sinh đang ở câu 35/40, đánh dấu sáu câu, lỡ tay F5 — đáp án thì còn nhưng
 * quay về câu 1 và mất sạch cờ, phải tự nhớ mình định quay lại câu nào. Đúng vào lúc căng nhất.
 */

const PROGRESS_STORAGE_PREFIX = 'eduquiz.attempt-progress:'

export interface AttemptProgress {
  /** Chỉ số câu đang xem, tính từ 0. */
  currentIndex: number
  /** Mã các câu được đánh dấu để xem lại. */
  flaggedQuestionIds: number[]
}

function storageKey(attemptId: number): string {
  return `${PROGRESS_STORAGE_PREFIX}${attemptId}`
}

export function saveAttemptProgress(attemptId: number, progress: AttemptProgress): void {
  try {
    window.localStorage.setItem(storageKey(attemptId), JSON.stringify(progress))
  } catch {
    // Hết dung lượng hoặc trình duyệt chặn: bài làm vẫn đi tiếp, chỉ mất phần khôi phục vị trí.
  }
}

/**
 * Đọc lại tiến độ đã lưu.
 *
 * `questionCount` dùng để kẹp lại chỉ số: một bản ghi cũ còn sót có thể trỏ tới câu không tồn tại,
 * và chỉ số ngoài mảng thì màn hình hiện ra trống trơn.
 */
export function readAttemptProgress(attemptId: number, questionCount: number): AttemptProgress {
  const empty: AttemptProgress = { currentIndex: 0, flaggedQuestionIds: [] }

  try {
    const raw = window.localStorage.getItem(storageKey(attemptId))
    if (!raw) return empty

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return empty

    const candidate = parsed as Partial<AttemptProgress>
    const index = candidate.currentIndex
    const flagged = candidate.flaggedQuestionIds

    return {
      currentIndex:
        typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < questionCount
          ? index
          : 0,
      flaggedQuestionIds: Array.isArray(flagged)
        ? flagged.filter((id): id is number => typeof id === 'number' && Number.isInteger(id))
        : [],
    }
  } catch {
    return empty
  }
}

/** Gọi sau khi nộp bài: tiến độ không còn nghĩa gì nữa và không nên nằm lại trong máy. */
export function clearAttemptProgress(attemptId: number): void {
  try {
    window.localStorage.removeItem(storageKey(attemptId))
  } catch {
    // Không cần xử lý thêm.
  }
}
