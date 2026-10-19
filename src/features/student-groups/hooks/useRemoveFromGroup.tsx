/**
 * Gỡ một học sinh khỏi lớp — hộp xác nhận kèm ô lý do bắt buộc.
 *
 * Gom về một chỗ vì trang chi tiết lớp và trang chi tiết học sinh của quản trị viên cùng làm việc này; hai bản
 * câu chữ tách rời thì sớm muộn một bản quên nhắc rằng bài chưa làm của lớp cũ bị thu hồi.
 */
import { useCallback } from 'react'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { removeStudentFromGroup } from '../../../services/groupService'
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../../../services/studentService'
import type { MemberChange, Student, StudentGroup } from '../../../types'

/**
 * Trả `true` khi dữ liệu trên màn hình có thể đã đổi và nên tải lại — kể cả khi server từ chối rồi người dùng bấm
 * Huỷ: lỗi hay gặp nhất là 409 hay 404, nghĩa là màn hình đang hiện một trạng thái cũ.
 */
export function useRemoveFromGroup() {
  const confirm = useConfirm()
  const toast = useToast()

  return useCallback(
    async (student: Student, group: Pick<StudentGroup, 'id' | 'name'>): Promise<boolean> => {
      const state = { failed: false }
      const holder: { result?: MemberChange } = {}

      const consequences = [
        'Tài khoản, kết quả bài làm và các lớp khác em đang học vẫn được giữ nguyên.',
        'Những bài lớp này đã giao mà em chưa làm và chưa hết hạn bị thu hồi khỏi em; bài đã làm và bài đã hết hạn được giữ.',
      ]

      const reason = await confirm.withInput({
        title: 'Gỡ học sinh khỏi lớp',
        message: `${student.fullName} sẽ rời lớp ${group.name}:`,
        details: <ConsequenceList items={consequences} />,
        inputLabel: 'Lý do gỡ khỏi lớp',
        placeholder: 'Ví dụ: Em nghỉ học không báo trước từ đầu tháng',
        inputHint: 'Lý do được lưu vào lịch sử của học sinh để người xem sau này hiểu vì sao em rời lớp.',
        minLength: REASON_MIN_LENGTH,
        maxLength: REASON_MAX_LENGTH,
        confirmLabel: 'Gỡ khỏi lớp',
        tone: 'danger',
        onConfirm: async value => {
          try {
            holder.result = await removeStudentFromGroup(group.id, student.id, value)
          } catch (caught) {
            state.failed = true
            throw caught
          }
        },
      })

      if (reason === null) return state.failed

      const revoked = holder.result?.revokedExams ?? 0
      toast.success(
        `Đã gỡ ${student.fullName} khỏi lớp.` + (revoked > 0 ? ` Đã thu hồi ${revoked} bài chưa làm của lớp.` : ''),
      )
      return true
    },
    [confirm, toast],
  )
}
