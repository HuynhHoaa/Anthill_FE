/**
 * Hàm tiện ích thuần tuý dùng chung cho toàn bộ giao diện và tầng service.
 * Không phụ thuộc React.
 */

// ===== Định dạng hiển thị =====

function padNumber(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

/** Ký hiệu cho một con số chưa có, để mọi màn hình dùng chung một dấu thay vì mỗi nơi một kiểu. */
export const NO_VALUE = '—'

/**
 * Điểm số hiển thị đúng giá trị, tối đa hai chữ số thập phân và bỏ số 0 thừa: 100 -> '100',
 * 85.5 -> '85.5', 77.75 -> '77.75'.
 *
 * Hai chữ số là độ chính xác của điểm trong hệ thống (điểm mỗi câu do giáo viên nhập tối đa hai chữ số).
 * Làm tròn một chữ số thì điểm gõ vào là 3.25 hiện ra 3.3, và 99.95 hiện thành '100.0' — trông như điểm
 * tuyệt đối trong khi chưa phải.
 *
 * `null` trả về dấu gạch ngang, **không** phải '0'. Server bỏ hẳn trường điểm khỏi JSON khi
 * người xem chưa được phép thấy (§3 quy tắc ⑥), và một bài bị giấu điểm hiện ra "0" trông y hệt
 * một bài làm sai hết — học sinh đọc con số đó sẽ tưởng mình trượt.
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return NO_VALUE
  if (!Number.isFinite(score)) return NO_VALUE
  return String(Math.round(score * 100) / 100)
}

/**
 * "Cỡ" của một bài kiểm tra cho giáo viên: số đề × số câu mỗi đề. Đề thường là "1 đề × 30 câu", đề chia nhiều đề là
 * "4 đề × 30 câu" — luôn cùng một khuôn để cột nào cũng đọc được trong một lần liếc.
 */
export function formatExamSize(exam: { paperCount: number; totalQuestions: number }): string {
  return `${exam.paperCount} đề × ${exam.totalQuestions} câu`
}

/**
 * Đọc chuỗi thời gian ở cả hai dạng: chuỗi ISO từ API và dạng hiển thị 'DD/MM/YYYY',
 * 'DD/MM/YYYY HH:mm'.
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
  /** Lớp màu viền Tailwind, khớp đúng ngưỡng bên dưới — dùng cho các vòng tròn điểm. */
  ring: string
  label: string
}

/**
 * Tổng điểm chuẩn của một bài kiểm tra, và cũng là thang của mọi điểm trung bình, điểm cao nhất gộp nhiều đề.
 * Khớp `ExamScoring.TotalScore` ở server. Từng là 100; đổi sang 10 ngày 15/10/2026.
 */
export const STANDARD_SCORE = 10

/**
 * Xếp loại điểm theo tỷ lệ so với điểm tối đa — nguồn duy nhất cho mọi màn hình. Giỏi từ 80%, Khá từ 65%,
 * Trung bình từ 50% (trên thang 10: 8 / 6,5 / 5).
 *
 * Truyền `maxScore` (điểm tối đa của chính đề đó) để điểm được so theo tỷ lệ của chính đề đó: hai đề khác điểm
 * tối đa nhau thì không được xếp loại theo cùng một mốc điểm thô, nếu không cùng một bài làm sẽ hiện "Giỏi" ở
 * màn hình này và "Yếu" ở màn hình khác (từng xảy ra thật giữa đây và `ScoreRing` cũ của trang danh sách bài
 * kiểm tra học sinh). Bỏ trống `maxScore` khi điểm truyền vào đã sẵn ở thang chuẩn (`STANDARD_SCORE`) — ví dụ
 * điểm trung bình nhiều đề mà server đã quy đổi trước khi gộp.
 */
export function getScoreTone(score: number, maxScore?: number | null): ScoreTone {
  const safeScore = Number.isFinite(score) ? score : 0
  const ratio = safeScore / (maxScore && maxScore > 0 ? maxScore : STANDARD_SCORE)
  if (ratio >= 0.8) {
    return { color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'border-emerald-200', label: 'Giỏi' }
  }
  if (ratio >= 0.65) {
    return { color: 'text-amber-600', bg: 'bg-amber-50', ring: 'border-amber-200', label: 'Khá' }
  }
  if (ratio >= 0.5) {
    return { color: 'text-orange-600', bg: 'bg-orange-50', ring: 'border-orange-200', label: 'Trung bình' }
  }
  return { color: 'text-red-500', bg: 'bg-red-50', ring: 'border-red-200', label: 'Yếu' }
}

/**
 * Điểm quy về thang chuẩn (`STANDARD_SCORE` = 10) theo điểm tối đa của chính đề đó; `null` khi không biết điểm
 * tối đa.
 *
 * Dùng trước mọi phép trung bình hay lấy điểm cao nhất gộp nhiều đề, cùng quy tắc server áp cho các số
 * liệu tổng hợp. Một em có đề được 9/10 và đề cũ chấm trên 100 được 60/100 thì trung bình thô là 34,5, còn quy
 * về thang 10 là 7,5.
 */
export function toStandardScale(score: number, maxScore: number | null | undefined): number | null {
  return maxScore !== null && maxScore !== undefined && maxScore > 0 ? (score / maxScore) * STANDARD_SCORE : null
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

/**
 * Làm tròn điểm trung bình tới hai chữ số thập phân. Trên thang 10 thì 0,01 mới ngang độ mịn 0,1 của thang 100 cũ;
 * làm tròn một chữ số sẽ gom 8,34 và 8,26 về cùng một con số.
 */
export function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}
