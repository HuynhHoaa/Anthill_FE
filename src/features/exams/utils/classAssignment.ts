/**
 * Lớp giáo viên chọn giao ngay trong lúc soạn đề.
 *
 * Chỉ là phần "giao cho lớp" của trang giao bài: chọn lớp, có thể kèm khung giờ riêng cho từng lớp. Đổi khung
 * giờ của lớp đã giao, hay thu hồi cả lớp, vẫn làm ở tab Giao bài và tab Theo dõi của trang chi tiết đề.
 */
import type { AssignClassTarget } from '../../../services/examService'
import { isCloseAfterOpen, minutesBetween, toServiceDateTime } from './examScheduleFormat'

export interface ClassWindowChoice {
  /** Bật khung giờ riêng cho lớp. Tắt nghĩa là lớp làm bài theo lịch chung của đề. */
  enabled: boolean
  openAtLocal: string
  closeAtLocal: string
}

export interface ClassAssignmentDraft {
  groupIds: number[]
  windows: Record<number, ClassWindowChoice>
  /** Mỗi học sinh một bộ câu hỏi riêng. */
  randomizePerStudent: boolean
}

export function createEmptyClassAssignment(): ClassAssignmentDraft {
  return { groupIds: [], windows: {}, randomizePerStudent: false }
}

/** Bản ghi nháp cũ hoặc hỏng bị loại thay vì hydrate ra giá trị `undefined`. */
export function isClassAssignmentDraft(value: unknown): value is ClassAssignmentDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  if (!Array.isArray(candidate.groupIds) || !candidate.groupIds.every(id => typeof id === 'number')) return false
  if (typeof candidate.randomizePerStudent !== 'boolean') return false

  const windows = candidate.windows
  if (!windows || typeof windows !== 'object') return false
  return Object.values(windows as Record<string, unknown>).every(item => {
    if (!item || typeof item !== 'object') return false
    const window = item as Record<string, unknown>
    return typeof window.enabled === 'boolean'
      && typeof window.openAtLocal === 'string'
      && typeof window.closeAtLocal === 'string'
  })
}

/** Các lớp thật sự được giao: bỏ lớp đã không còn trong danh sách của giáo viên (nháp cũ, đổi phân công). */
export function effectiveGroupIds(draft: ClassAssignmentDraft, availableGroupIds: number[]): number[] {
  const available = new Set(availableGroupIds)
  return draft.groupIds.filter(groupId => available.has(groupId))
}

/**
 * Khung giờ riêng nào đang sai. Cùng hai phép kiểm của server (giờ đóng sau giờ mở, khung chứa trọn thời
 * lượng làm bài), để lỗi hiện ở form chứ không phải sau khi đề đã được lưu rồi mới bị từ chối.
 */
export function classAssignmentProblems(
  draft: ClassAssignmentDraft,
  groupIds: number[],
  groupName: (groupId: number) => string,
  durationMinutes: number,
): string[] {
  const problems: string[] = []

  groupIds.forEach(groupId => {
    const window = draft.windows[groupId]
    if (!window?.enabled) return

    const label = groupName(groupId)
    if (!window.openAtLocal || !window.closeAtLocal) {
      problems.push(`${label}: hãy chọn cả giờ mở và giờ đóng.`)
    } else if (!isCloseAfterOpen(window.openAtLocal, window.closeAtLocal)) {
      problems.push(`${label}: giờ đóng phải sau giờ mở.`)
    } else if (minutesBetween(window.openAtLocal, window.closeAtLocal) < durationMinutes) {
      problems.push(`${label}: khung giờ ngắn hơn ${durationMinutes} phút làm bài.`)
    }
  })

  return problems
}

/** Dạng gửi lên server. Lớp không bật khung giờ riêng thì không kèm giờ, tức theo lịch chung của đề. */
export function toAssignClassTargets(draft: ClassAssignmentDraft, groupIds: number[]): AssignClassTarget[] {
  return groupIds.map(groupId => {
    const window = draft.windows[groupId]
    return window?.enabled
      ? {
        groupId,
        openAt: toServiceDateTime(window.openAtLocal),
        closeAt: toServiceDateTime(window.closeAtLocal),
      }
      : { groupId }
  })
}
