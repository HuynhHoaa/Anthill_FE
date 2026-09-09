/**
 * Bảng màu chủ đề, dùng chung cho dải màu thẻ bài kiểm tra và huy hiệu chủ đề.
 * Tám chủ đề của ngân hàng câu hỏi được gieo sẵn màu; chủ đề giáo viên tự đặt sau này
 * thì băm từ tên đã bỏ dấu nên mỗi lần render đều cho ra cùng một kết quả.
 * Bảng cố tình không có màu đỏ: đỏ đang là tín hiệu "sắp hết hạn" ở giao diện học sinh.
 */
import { normalizeText } from './format'

/** Nhãn của đề lấy câu hỏi từ mọi chủ đề, tức topic là chuỗi rỗng. */
export const ALL_TOPICS_LABEL = 'Tổng hợp'

const topicColors: string[] = [
  '#6366F1',
  '#8B5CF6',
  '#0EA5E9',
  '#06B6D4',
  '#14B8A6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#3B82F6',
]

/** Màu gieo sẵn, tra bằng tên chủ đề đã bỏ dấu nên 'Điện học' và 'dien hoc' cùng một màu. */
const seededTopicColors: Record<string, string> = {
  '': '#8B5CF6',
  'dien hoc': '#0EA5E9',
  'di truyen': '#F59E0B',
  'bang tuan hoan': '#10B981',
  'luc va chuyen dong': '#6366F1',
  'phan ung hoa hoc': '#14B8A6',
  'quang hoc': '#EC4899',
  'te bao va co the song': '#06B6D4',
  'axit - bazo': '#3B82F6',
}

/** Băm chuỗi thành chỉ số bảng màu theo FNV-1a, đủ tản đều cho vài chục chủ đề. */
function toColorIndex(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % topicColors.length
}

export function getTopicLabel(topic: string): string {
  const trimmed = topic.trim()
  return trimmed === '' ? ALL_TOPICS_LABEL : trimmed
}

export function getTopicColor(topic: string): string {
  const normalizedTopic = normalizeText(topic)
  return seededTopicColors[normalizedTopic] ?? topicColors[toColorIndex(normalizedTopic)]
}
