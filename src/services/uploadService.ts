/**
 * Tải ảnh câu hỏi và đáp án lên API (§4.5).
 *
 * Câu hỏi chỉ lưu **đường dẫn** ảnh: ảnh phải lên server trước qua endpoint này, form nhận lại URL
 * rồi mới gửi kèm câu hỏi. Server từ chối ảnh nhúng dạng data URI — cột lưu đường dẫn chỉ dài 512
 * ký tự, và một ảnh nhúng làm phình payload của mọi lần đọc câu hỏi.
 *
 * Về ảnh "mồ côi" (đã tải lên nhưng giáo viên bỏ form không lưu, hoặc đã thay bằng ảnh khác): cố ý
 * **không** dọn từ giao diện. Bản đề đã sinh chép nguyên đường dẫn ảnh vào nội dung chụp lại của
 * từng bài làm, nên ảnh cũ của một câu hỏi vừa đổi ảnh vẫn là ảnh của các bài đã chấm — xoá theo
 * thao tác trên form là làm hỏng trang xem lại kết quả. Giao diện cũng không bao giờ biết chắc một
 * ảnh đã hết người dùng (đóng tab giữa chừng thì chẳng đoạn mã nào kịp chạy). Nếu cần dọn thì việc
 * đó thuộc về một tác vụ định kỳ phía server, đối chiếu thư mục ảnh với cả câu hỏi, đáp án lẫn bản
 * đề đã sinh. Mỗi ảnh tối đa 4 MB nên phần dư này nhỏ so với rủi ro mất ảnh của bài đã chấm.
 */
import { apiClient } from '../lib/apiClient'

export interface UploadedImage {
  /** Đường dẫn tương đối để gán vào câu hỏi hoặc đáp án; hiển thị thì đi qua resolveMediaUrl. */
  url: string
  fileName: string
  sizeBytes: number
  /** Loại ảnh server nhận ra từ nội dung file, không phải loại trình duyệt khai. */
  contentType: string
}

/**
 * Khớp đúng hàng rào của server (LocalFileStorageService, FileStorage:MaxBytes). Server xét **đuôi
 * file** chứ không xét loại trình duyệt khai, nên chặn trước theo cả hai: ảnh <c>.jfif</c> vẫn được
 * trình duyệt gọi là image/jpeg nhưng server từ chối. SVG cố ý không có — nó chứa được thẻ script.
 */
export const IMAGE_UPLOAD_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
export const IMAGE_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
export const IMAGE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024

/** Lý do không nên gửi tệp này lên, hoặc undefined khi tệp qua được các kiểm tra phía trình duyệt. */
export function checkImageFile(file: File): string | undefined {
  const dotIndex = file.name.lastIndexOf('.')
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : ''
  if (!IMAGE_UPLOAD_EXTENSIONS.includes(extension) || !IMAGE_UPLOAD_TYPES.includes(file.type)) {
    return 'Chỉ nhận ảnh PNG, JPG, GIF hoặc WEBP.'
  }
  if (file.size === 0) {
    return 'Tệp ảnh rỗng. Vui lòng chọn ảnh khác.'
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return 'Ảnh vượt quá 4 MB. Vui lòng chọn ảnh có dung lượng nhỏ hơn.'
  }
  return undefined
}

/** Tên trường <c>file</c> khớp tham số <c>IFormFile file</c> của UploadsController. */
export function uploadImage(file: File, signal?: AbortSignal): Promise<UploadedImage> {
  const form = new FormData()
  form.append('file', file, file.name)
  return apiClient.postForm<UploadedImage>('/api/uploads/images', form, signal)
}
