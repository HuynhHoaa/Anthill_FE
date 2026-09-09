/**
 * Hàm tiện ích thuần tuý dùng chung cho toàn bộ giao diện và tầng service.
 * Không phụ thuộc React, không phụ thuộc dữ liệu mock.
 */
import type { Paged } from '../types'

// ===== Định dạng hiển thị =====

function padNumber(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

/** Điểm số luôn hiển thị một chữ số thập phân: 8 -> '8.0', 7.25 -> '7.3'. */
export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return '0.0'
  return score.toFixed(1)
}

/**
 * Đọc chuỗi thời gian ở cả hai dạng dự án đang dùng:
 * 'DD/MM/YYYY', 'DD/MM/YYYY HH:mm' (dữ liệu mock) và chuỗi ISO (API thật sau này).
 */
export function parseDateTime(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const matched = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT](\d{1,2}):(\d{2}))?/)
  if (matched) {
    const day = Number(matched[1])
    const month = Number(matched[2])
    const year = Number(matched[3])
    const hour = matched[4] ? Number(matched[4]) : 0
    const minute = matched[5] ? Number(matched[5]) : 0
    const parsed = new Date(year, month - 1, day, hour, minute)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const fallback = new Date(trimmed)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** Trả về 'DD/MM/YYYY HH:mm'. Giữ nguyên chuỗi gốc nếu không đọc được. */
export function formatDateTime(value: string): string {
  const parsed = parseDateTime(value)
  if (!parsed) return value
  return `${padNumber(parsed.getDate())}/${padNumber(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${padNumber(parsed.getHours())}:${padNumber(parsed.getMinutes())}`
}

/** Trả về 'DD/MM/YYYY'. Giữ nguyên chuỗi gốc nếu không đọc được. */
export function formatDate(value: string): string {
  const parsed = parseDateTime(value)
  if (!parsed) return value
  return `${padNumber(parsed.getDate())}/${padNumber(parsed.getMonth() + 1)}/${parsed.getFullYear()}`
}

/** Ngày hôm nay dạng 'DD/MM/YYYY', khớp định dạng của dữ liệu mock. */
export function todayLabel(): string {
  const now = new Date()
  return `${padNumber(now.getDate())}/${padNumber(now.getMonth() + 1)}/${now.getFullYear()}`
}

/** Thời điểm hiện tại dạng 'DD/MM/YYYY HH:mm'. */
export function nowLabel(): string {
  const now = new Date()
  return `${todayLabel()} ${padNumber(now.getHours())}:${padNumber(now.getMinutes())}`
}

/** 45 -> '45 phút', 60 -> '1 giờ', 90 -> '1 giờ 30 phút'. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 phút'
  const totalMinutes = Math.round(minutes)
  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  if (hours === 0) return `${remainingMinutes} phút`
  if (remainingMinutes === 0) return `${hours} giờ`
  return `${hours} giờ ${remainingMinutes} phút`
}

/** Đồng hồ đếm ngược: 'MM:SS', chuyển sang 'HH:MM:SS' khi còn từ một giờ trở lên. */
export function formatClock(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  if (hours > 0) return `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(seconds)}`
  return `${padNumber(minutes)}:${padNumber(seconds)}`
}

/** Lấy chữ cái đầu của hai từ cuối trong tên: 'Trần Thị Lan' -> 'TL'. */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(-2)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
}

export interface ScoreTone {
  /** Lớp màu chữ Tailwind, dùng trực tiếp cho className. */
  color: string
  /** Lớp màu nền nhạt đi kèm, dùng cho huy hiệu điểm. */
  bg: string
  label: string
}

/** Xếp loại điểm theo thang 10. */
export function getScoreTone(score: number): ScoreTone {
  const safeScore = Number.isFinite(score) ? score : 0
  if (safeScore >= 8) return { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Giỏi' }
  if (safeScore >= 6.5) return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Khá' }
  if (safeScore >= 5) return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Trung bình' }
  return { color: 'text-red-500', bg: 'bg-red-50', label: 'Yếu' }
}

/** Khoảng thời gian tương đối, dùng cho danh sách thông báo. */
export function formatRelativeTime(value: string): string {
  const parsed = parseDateTime(value)
  if (!parsed) return value

  const diffMinutes = Math.round((Date.now() - parsed.getTime()) / 60000)
  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} ngày trước`
  return formatDate(value)
}

// ===== Tiện ích dữ liệu dùng chung cho tầng service =====

/** Dải dấu thanh tổ hợp sinh ra sau khi tách chuỗi bằng normalize('NFD'). */
const combiningMarksPattern = new RegExp('[\\u0300-\\u036f]', 'g')

/** Bỏ dấu tiếng Việt và chuyển về chữ thường để so khớp tìm kiếm. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(combiningMarksPattern, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
}

/** Trả về true khi một trong các trường chứa từ khoá (không phân biệt hoa thường và dấu). */
export function matchesSearch(search: string | undefined, fields: Array<string | undefined>): boolean {
  const normalizedSearch = normalizeText(search ?? '')
  if (!normalizedSearch) return true
  return fields.some(field => (field ? normalizeText(field).includes(normalizedSearch) : false))
}

export const DEFAULT_PAGE_SIZE = 10

/** Cắt trang trên mảng đã lọc, tự kẹp số trang về khoảng hợp lệ. */
export function paginate<T>(items: T[], page?: number, pageSize?: number): Paged<T> {
  const safePageSize = pageSize && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
  const requestedPage = page && page > 0 ? Math.floor(page) : 1
  const safePage = Math.min(requestedPage, totalPages)
  const start = (safePage - 1) * safePageSize

  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
  }
}

/** Cấp id mới cho bản ghi mock: max(id) + 1, an toàn với mảng rỗng. */
export function nextId(items: Array<{ id: number }>): number {
  return items.reduce((largest, item) => (item.id > largest ? item.id : largest), 0) + 1
}

/** Làm tròn một chữ số thập phân, dùng cho điểm số. */
export function roundToOneDecimal(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10) / 10
}
