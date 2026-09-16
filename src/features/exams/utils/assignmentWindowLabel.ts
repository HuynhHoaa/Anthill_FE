import type { AssignmentWindow } from '../../../types'

/** Nhãn của một khung giờ: tên lớp, hoặc nhóm học sinh được chọn đích danh. */
export function windowLabel(window: AssignmentWindow): string {
  return window.groupName ?? 'Học sinh chọn riêng'
}
