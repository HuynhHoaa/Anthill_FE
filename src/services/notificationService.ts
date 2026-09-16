/**
 * Thông báo của chính người đang đăng nhập — nối vào API thật (§4.2).
 *
 * Khác biệt lớn nhất so với bản giả lập: thông báo thuộc về **một người**, không thuộc về một vai
 * trò. Bản giả lập lọc theo `audience` nên mọi giáo viên nhìn chung một dòng thông báo; server gắn
 * mỗi bản ghi với đúng một người nhận, và danh tính đó lấy từ token — nên không hàm nào ở đây cần
 * tham số vai trò nữa.
 */
import { apiClient } from '../lib/apiClient'
import type { AppNotification, NotificationType } from '../types'

interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * Server gọi tên loại thông báo theo kiểu camelCase, trùng tên sự kiện SignalR; các type ở đây có từ
 * bản giả lập nên viết kiểu snake_case.
 *
 * Quy đổi ở đúng cửa vào này thay vì đổi tên khắp giao diện: mọi màn hình đã tra bảng nhãn và bảng
 * biểu tượng theo tên cũ, và một tên lạ lọt qua là cả trang thông báo trắng trơn.
 */
const notificationTypeByServerName: Record<string, NotificationType> = {
  examAssigned: 'exam_assigned',
  examSubmitted: 'exam_submitted',
  examUpdated: 'exam_updated',
  deadlineSoon: 'deadline_soon',
  autoSubmitted: 'auto_submitted',
}

/** Thông báo như server gửi: `type` là chuỗi tự do cho tới khi được quy đổi. */
type NotificationResponse = Omit<AppNotification, 'type'> & { type: string }

function toNotification(row: NotificationResponse): AppNotification {
  // Loại lạ — server mới thêm một loại mà giao diện chưa biết — vẫn phải hiện được nội dung, nên nó
  // mượn hình thức của thông báo về bài kiểm tra thay vì làm hỏng cả danh sách.
  return { ...row, type: notificationTypeByServerName[row.type] ?? 'exam_updated' }
}

export interface ListNotificationsParams {
  unreadOnly?: boolean
  page?: number
  pageSize?: number
}

/**
 * Danh sách thông báo, mới nhất trước.
 *
 * Trả về mảng chứ không phải trang: trang thông báo hiện toàn bộ trong một danh sách cuộn, không
 * có phân trang trên giao diện. `pageSize` mặc định 50 đủ cho nhu cầu đó và vẫn có trần — bỏ trần
 * đi thì một tài khoản dùng lâu năm sẽ kéo về hàng nghìn dòng chỉ để hiện mươi dòng đầu.
 */
export async function listNotifications(
  params: ListNotificationsParams = {},
): Promise<AppNotification[]> {
  const response = await apiClient.get<PagedResponse<NotificationResponse>>('/api/notifications', {
    unreadOnly: params.unreadOnly ? 'true' : undefined,
    page: params.page,
    pageSize: params.pageSize ?? 50,
  })

  return response.items.map(toNotification)
}

export function getUnreadCount(): Promise<number> {
  return apiClient.get<number>('/api/notifications/unread-count')
}

export async function markAsRead(id: number): Promise<void> {
  await apiClient.patch(`/api/notifications/${id}/read`)
}

/** Trả về số mục vừa được đánh dấu, để giao diện nói được "đã đánh dấu N mục". */
export function markAllAsRead(): Promise<number> {
  return apiClient.post<number>('/api/notifications/mark-all-read')
}
