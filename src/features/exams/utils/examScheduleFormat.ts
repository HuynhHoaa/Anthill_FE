/**
 * Cầu nối giữa input datetime-local ('YYYY-MM-DDTHH:mm') và định dạng lịch
 * mà tầng service đang dùng ('DD/MM/YYYY HH:mm').
 */
import { formatDateTime, parseDateTime } from '../../../lib/format'

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

/** Đổi giá trị input datetime-local về đúng định dạng service đang lưu. */
export function toServiceDateTime(localValue: string): string {
  return formatDateTime(localValue)
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
