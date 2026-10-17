import { useMemo } from 'react'
import type { Exam } from '../../../types'

export type AnswersGate =
  | { state: 'none' }
  | { state: 'running'; until: string }
  | { state: 'over'; until: string }

/**
 * Đã tới lúc cho học sinh xem đáp án chưa. Mở đáp án chỉ khi HẾT GIỜ: lớp đóng bài muộn nhất đã qua giờ đóng (kể cả
 * lớp chưa tới giờ làm thì cũng khoá). Server kiểm lại bằng cùng luật; nút khoá ở giao diện để giáo viên khỏi bấm vào
 * chỗ chắc chắn bị từ chối.
 *
 * `none`: bản nháp hoặc chưa giao lớp nào, nên chưa có khái niệm hết giờ.
 */
export function useAnswersGate(exam: Exam): AnswersGate {
  return useMemo(() => {
    const windows = exam.assignmentWindows
    if (exam.lifecycle === 'draft' || windows.length === 0) return { state: 'none' as const }

    const latestClose = windows.reduce(
      (latest, window) => (new Date(window.closeAt) > new Date(latest) ? window.closeAt : latest),
      windows[0].closeAt,
    )
    const stillRunning = windows.some(window => window.lifecycle !== 'closed')

    return stillRunning
      ? { state: 'running' as const, until: latestClose }
      : { state: 'over' as const, until: latestClose }
  }, [exam.assignmentWindows, exam.lifecycle])
}
