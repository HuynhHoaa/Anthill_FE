/**
 * Tên hiển thị của câu hỏi.
 *
 * Tên là nhãn ngắn do giáo viên đặt để nhận ra câu trong ngân hàng và trong đề; nội dung (đề bài) là phần học
 * sinh đọc. Câu chưa được đặt tên — mọi câu soạn trước khi có trường này, và câu giáo viên để trống — rơi về
 * phần đầu của nội dung, nên danh sách không bao giờ có dòng trống.
 */
interface TitledQuestion {
  /** Vắng mặt trong bản nháp đề lưu trong trình duyệt từ trước khi có tên câu hỏi. */
  title?: string | null
  content: string
}

/** Độ dài tối đa của tên lấy từ nội dung; dài hơn thì cắt và thêm dấu chấm lửng. */
const FALLBACK_LENGTH = 100

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Giáo viên đã tự đặt tên cho câu này, tức tên không phải chuỗi lấy từ nội dung. */
export function hasQuestionTitle(question: Pick<TitledQuestion, 'title'>): boolean {
  return collapseWhitespace(question.title ?? '') !== ''
}

/**
 * Tên để hiện trong danh sách: tên đã đặt, hoặc phần đầu của nội dung khi chưa đặt.
 *
 * `maxLength` chỉ áp cho phần lấy từ nội dung; tên giáo viên đặt giữ nguyên (server đã chặn ở 200 ký tự).
 */
export function questionDisplayTitle(question: TitledQuestion, maxLength = FALLBACK_LENGTH): string {
  const title = collapseWhitespace(question.title ?? '')
  if (title) return title

  const content = collapseWhitespace(question.content)
  return content.length > maxLength ? `${content.slice(0, maxLength).trimEnd()}…` : content
}
