import { mockNotifications } from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { parseDateTime } from '../lib/format'
import type { AppNotification, UserRole } from '../types'

export interface ListNotificationsParams {
  role: UserRole
  unreadOnly?: boolean
}

/** Bỏ trường audience chỉ dùng nội bộ trước khi trả về cho giao diện. */
function toNotification(source: AppNotification): AppNotification {
  return {
    id: source.id,
    type: source.type,
    title: source.title,
    message: source.message,
    createdAt: source.createdAt,
    isRead: source.isRead,
    link: source.link,
  }
}

function sortByNewest(left: AppNotification, right: AppNotification): number {
  const leftTime = parseDateTime(left.createdAt)?.getTime() ?? 0
  const rightTime = parseDateTime(right.createdAt)?.getTime() ?? 0
  if (leftTime !== rightTime) return rightTime - leftTime
  return right.id - left.id
}

export function listNotifications(params: ListNotificationsParams): Promise<AppNotification[]> {
  return simulate(() =>
    mockNotifications
      .filter(notification => notification.audience === params.role)
      .filter(notification => (params.unreadOnly ? !notification.isRead : true))
      .map(toNotification)
      .sort(sortByNewest),
  )
}

export function getUnreadCount(role: UserRole): Promise<number> {
  return simulate(
    () =>
      mockNotifications.filter(notification => notification.audience === role && !notification.isRead)
        .length,
  )
}

export function markAsRead(id: number): Promise<void> {
  return simulate(() => {
    const notification = mockNotifications.find(item => item.id === id)
    if (!notification) {
      throw new Error('Không tìm thấy thông báo.')
    }
    notification.isRead = true
  })
}

export function markAllAsRead(role: UserRole): Promise<void> {
  return simulate(() => {
    mockNotifications.forEach(notification => {
      if (notification.audience === role) {
        notification.isRead = true
      }
    })
  })
}
