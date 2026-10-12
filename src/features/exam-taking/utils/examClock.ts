/**
 * Đồng hồ làm bài chạy trên `performance.now()`, không phải `Date.now()`.
 *
 * `Date.now()` là giờ treo tường: học sinh chỉnh giờ máy giữa buổi thi thì nó nhảy, đồng hồ trên màn hình
 * nhảy theo (và chỉnh tới trước thì bài bị tự nộp sớm). `performance.now()` là đồng hồ đơn điệu, chỉ đếm
 * tiến, không nghe theo cài đặt giờ của máy.
 *
 * Đổi lại nó có thể đứng lại khi máy ngủ hay tab bị treo, nên màn hình làm bài chỉnh lại theo server mỗi khi
 * tab hiện lại, khi có mạng lại, và thưa thớt theo chu kỳ (xem `TakeExamPage`).
 *
 * Mốc hết giờ trong toàn bộ luồng này là một con số theo thang `performance.now()`, không phải giờ treo tường.
 */

/** Số giây còn lại tới một mốc theo thang đơn điệu. Làm tròn lên để chỉ hiện 00:00 khi thật sự hết. */
export function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
}

/** Mốc đơn điệu đã tới hay qua chưa. */
export function hasReached(deadline: number): boolean {
  return performance.now() >= deadline
}
