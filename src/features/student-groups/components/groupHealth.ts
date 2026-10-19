/**
 * Một lớp đã sẵn sàng nhận bài kiểm tra hay chưa.
 *
 * Tách khỏi component để chỗ nào cũng dùng được cùng một định nghĩa: bảng danh sách vẽ biểu tượng,
 * trang chi tiết dựng cảnh báo, và cả hai phải nói cùng một điều về cùng một lớp.
 */
import type { StudentGroup } from '../../../types'

/**
 * Những điều khiến một lớp chưa chạy được, xếp theo thứ tự quản trị viên phải xử lý.
 *
 * Cả hai đều quy về một chuyện: lớp có tồn tại nhưng bài kiểm tra không tới được ai. Không giáo
 * viên thì không ai giao bài; không học sinh thì không ai nhận bài. Trạng thái công bố cố ý
 * **không** nằm trong danh sách này — bản nháp đã có nhãn riêng, và một lớp còn nháp thì đang đúng
 * quy trình chứ không phải đang hỏng.
 */
export function getGroupIssues(group: StudentGroup): string[] {
  // Lớp đã khoá là lớp đã khép lại một cách có chủ ý: không có giáo viên mới hay học sinh mới nào cần được nhắc.
  if (group.isLocked) return []

  const issues: string[] = []
  if (group.teachers.length === 0) issues.push('chưa phân công giáo viên nào')
  if (group.studentCount === 0) issues.push('chưa có học sinh nào')
  return issues
}

export function describeGroupHealth(group: StudentGroup): string {
  const issues = getGroupIssues(group)
  if (issues.length === 0) return 'Lớp đã sẵn sàng: có giáo viên phụ trách và đã có học sinh.'
  return `Lớp chưa sẵn sàng nhận bài kiểm tra: ${issues.join(' và ')}.`
}
