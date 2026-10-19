/**
 * Đánh thức API ngay khi tải trang.
 *
 * Gói miễn phí của Render cho API ngủ sau 15 phút không có request, và mất 30–60 giây để dậy. Người xem mở link
 * đúng lúc đó sẽ nhìn một trang đăng nhập "treo" rồi tưởng sản phẩm hỏng. Gọi `/health` ngay từ lúc trang tải để
 * API bắt đầu dậy trong lúc người xem còn đang đọc màn hình đầu tiên.
 *
 * Cố ý là `/health` chứ không phải `/health/live`: đường này chạm cả database nên đánh thức luôn Neon đang ngủ (gói
 * miễn phí tự ngủ sau 5 phút), để lần đăng nhập đầu không phải chờ database dậy. `/health/live` không chạm database,
 * dành cho các ping giữ thức chạy suốt ngày đêm; đổi lời gọi này sang đó là mất tác dụng đánh thức database.
 *
 * Hoàn toàn không bắt buộc: lỗi hay chậm đều bị bỏ qua, và không ai chờ kết quả. `no-cors` để việc đánh thức vẫn
 * chạy ngay cả khi địa chỉ này chưa được khai trong danh sách origin của API — request vẫn tới nơi và vẫn làm API
 * dậy, chỉ là trình duyệt không cho đọc phản hồi, mà ta cũng không cần đọc.
 */
export function warmUpApi(): void {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!base) return

  void fetch(`${base}/health`, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => undefined)
}
