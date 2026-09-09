/**
 * Độ trễ giả lập cho tầng service mock.
 * Nhờ có độ trễ, mọi màn hình đều phải xử lý trạng thái tải ngay từ bây giờ,
 * nên khi thay mock bằng API thật giao diện không cần sửa lại.
 */

const MIN_DELAY_MS = 250
const MAX_DELAY_MS = 650

/** Tỷ lệ request giả lập thất bại, từ 0 đến 1. Đổi thành 0.2 để thử nhánh xử lý lỗi. */
export const MOCK_FAILURE_RATE: number = 0

export const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ.'

export function delay(ms?: number): Promise<void> {
  const duration = ms ?? MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
  return new Promise(resolve => {
    setTimeout(resolve, duration)
  })
}

/**
 * Chờ một khoảng như gọi mạng thật rồi trả về kết quả.
 * Nhận thẳng giá trị hoặc một hàm dựng giá trị, để phần tính toán chỉ chạy sau khi đã "chờ mạng".
 */
export async function simulate<T>(value: T | (() => T)): Promise<T> {
  await delay()
  if (MOCK_FAILURE_RATE > 0 && Math.random() < MOCK_FAILURE_RATE) {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }
  return typeof value === 'function' ? (value as () => T)() : value
}
