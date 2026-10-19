/**
 * Hai người dùng ngân hàng câu hỏi, cùng một cặp trang (danh sách và trình soạn) nhưng khác khu vực.
 *
 * Giáo viên chỉ làm trên ngân hàng của môn mình và chỉ sửa câu của chính họ. Quản trị viên thấy ngân hàng của mọi môn, sửa, ẩn, xoá
 * câu của bất kỳ ai và phải chọn môn khi tạo câu mới (tài khoản quản trị không thuộc môn nào nên server không suy ra được).
 */
export type QuestionAudience = 'teacher' | 'admin'

/** Gốc đường dẫn của ngân hàng câu hỏi trong từng khu vực: danh sách ở đây, `/tao` và `/:id/sua` nối vào sau. */
export const questionBankPath: Record<QuestionAudience, string> = {
  teacher: '/giao-vien/cau-hoi',
  admin: '/quan-tri/cau-hoi',
}
