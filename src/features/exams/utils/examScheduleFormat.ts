/**
 * Cầu nối giữa input `datetime-local` ('YYYY-MM-DDTHH:mm') và định dạng API dùng (ISO 8601).
 */
import { parseDateTime } from '../../../lib/format'

const MINUTE_IN_MS = 60000

function padNumber(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

function toLocalValue(date: Date): string {
  const datePart = `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
  return `${datePart}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`
}

/** Đổi chuỗi lịch của service sang giá trị hiển thị được trên input datetime-local. */
export function toDateTimeLocalValue(value: string): string {
  const parsed = parseDateTime(value)
  return parsed ? toLocalValue(parsed) : ''
}

/**
 * Đổi giá trị input `datetime-local` sang chuỗi ISO 8601 để gửi lên API.
 *
 * Trước đây hàm này trả về 'DD/MM/YYYY HH:mm' — định dạng của tầng giả lập. Backend khai kiểu
 * `DateTime`, chỉ đọc ISO, nên mọi lượt tạo hoặc sửa đề đều nhận 400 mà không rõ vì sao.
 *
 * Trình duyệt đọc chuỗi `datetime-local` theo **giờ máy người dùng**, còn `toISOString()` đổi sang
 * UTC — đúng thứ server cần. Giáo viên chọn 8 giờ sáng ở Việt Nam thì server nhận 1 giờ sáng UTC,
 * và học sinh ở múi giờ khác vẫn thấy đúng thời điểm đó theo giờ của mình.
 */
export function toServiceDateTime(localValue: string): string {
  const parsed = new Date(localValue)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

/** Mốc đóng phải thực sự sau mốc mở; thiếu một trong hai thì coi là chưa hợp lệ. */
export function isCloseAfterOpen(openLocalValue: string, closeLocalValue: string): boolean {
  const openDate = parseDateTime(openLocalValue)
  const closeDate = parseDateTime(closeLocalValue)
  if (!openDate || !closeDate) return false
  return closeDate.getTime() > openDate.getTime()
}

/** Khoảng cách giữa hai mốc theo phút, trả về 0 nếu không đọc được. */
export function minutesBetween(openLocalValue: string, closeLocalValue: string): number {
  const openDate = parseDateTime(openLocalValue)
  const closeDate = parseDateTime(closeLocalValue)
  if (!openDate || !closeDate) return 0
  return Math.max(0, Math.round((closeDate.getTime() - openDate.getTime()) / MINUTE_IN_MS))
}

/** Khớp `ScheduleLockLeadMinutes` (120 phút) của server; chỉ dùng để viết câu báo, việc khoá do server quyết. */
const SCHEDULE_LOCK_LEAD_MINUTES = 120
const SCHEDULE_LOCK_LEAD_HOURS = SCHEDULE_LOCK_LEAD_MINUTES / 60

/** Chủ ngữ cho một lớp trong câu báo khoá: tên lớp đã mở đầu bằng "Lớp" thì không thêm chữ "lớp" nữa. */
export function classLockSubject(className: string): string {
  return /^lớp\s/i.test(className.trim()) ? `Bài của ${className.trim()}` : `Bài của lớp ${className.trim()}`
}

/**
 * Giờ mở này cách bây giờ chưa đầy 2 giờ (hoặc đã qua) — tức là nếu lưu thì khung giờ sẽ bị khoá ngay.
 * Chỉ để cảnh báo trước khi lưu; server mới là nơi quyết định.
 */
export function opensWithinLockWindow(openAt: string): boolean {
  const openDate = parseDateTime(openAt)
  if (!openDate) return false
  return openDate.getTime() - Date.now() < SCHEDULE_LOCK_LEAD_MINUTES * MINUTE_IN_MS
}

/** Câu cảnh báo đi kèm khi giờ mở vừa chọn rơi vào vùng khoá. */
export const SCHEDULE_LOCK_WARNING =
  `Giờ mở cách bây giờ chưa đầy ${SCHEDULE_LOCK_LEAD_HOURS} giờ. Lưu xong thì khung giờ này không đổi được nữa cho tới hết giờ đóng.`

/** Vì sao một khung giờ đang khoá, nói đúng theo việc nó sắp mở hay đang mở. Giống câu server trả về. */
export function describeScheduleLock(subject: string, openAt: string): string {
  const openDate = parseDateTime(openAt)
  const notOpenYet = openDate !== null && Date.now() < openDate.getTime()

  return notOpenYet
    ? `${subject} còn chưa đầy ${SCHEDULE_LOCK_LEAD_HOURS} giờ nữa là mở nên không đổi giờ được.`
    : `${subject} đang mở nên không đổi giờ được.`
}

export interface DefaultSchedule {
  openAtLocal: string
  closeAtLocal: string
}

/** Lịch gợi ý cho bài mới: mở sau một giờ nữa, đóng sau bảy ngày. */
export function buildDefaultSchedule(): DefaultSchedule {
  const openDate = new Date(Date.now() + 60 * MINUTE_IN_MS)
  openDate.setSeconds(0, 0)
  openDate.setMinutes(0)

  const closeDate = new Date(openDate.getTime() + 7 * 24 * 60 * MINUTE_IN_MS)

  return { openAtLocal: toLocalValue(openDate), closeAtLocal: toLocalValue(closeDate) }
}
