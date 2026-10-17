import type { AssignmentWindow } from '../../../types'

/** Nhãn của một khung giờ: tên lớp. Khung không gắn lớp là dữ liệu cũ, từ thời còn giao riêng từng em. */
export function windowLabel(window: AssignmentWindow): string {
  return window.groupName ?? 'Chưa gắn lớp'
}
