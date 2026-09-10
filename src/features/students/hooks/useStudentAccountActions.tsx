/**
 * Bốn thao tác trên tài khoản học sinh — khoá/mở khoá, cấp lại mật khẩu, xoá, khôi phục — kèm hộp
 * xác nhận của từng thao tác.
 *
 * Gom về một chỗ vì danh sách học sinh và trang sửa học sinh cùng làm bốn việc này. Hai bản câu chữ
 * tách rời thì sớm muộn một bản nói "khôi phục được trong 60 ngày" còn bản kia quên mất.
 */
import { useMemo } from 'react'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import {
  DELETION_REASON_MAX_LENGTH, DELETION_REASON_MIN_LENGTH, DELETION_RETENTION_DAYS, ERASED_STUDENT_NAME,
  requestStudentDeletion, resetStudentPassword, restoreStudent, setStudentStatus,
  type ResetPasswordResult,
} from '../../../services/studentService'
import type { Student } from '../../../types'

/** Câu chữ của hộp khoá/mở khoá — trang sửa học sinh cũng dùng khi đổi ô trạng thái rồi bấm Lưu. */
export function lockConfirmCopy(fullName: string, locking: boolean) {
  return locking
    ? {
        title: 'Khóa tài khoản học sinh',
        message: `${fullName} sẽ bị đăng xuất ngay khỏi mọi thiết bị — kể cả khi đang làm bài dở — và không đăng nhập hay làm bài được cho tới khi được mở khóa. Bài đã nộp và điểm vẫn giữ nguyên.`,
        confirmLabel: 'Khóa tài khoản',
        tone: 'danger' as const,
      }
    : {
        title: 'Mở khóa tài khoản học sinh',
        message: `${fullName} sẽ đăng nhập lại được bằng mật khẩu hiện tại và tiếp tục làm những bài đang được giao.`,
        confirmLabel: 'Mở khóa',
        tone: 'primary' as const,
      }
}

export interface StudentAccountActions {
  /**
   * Mỗi hàm trả `true` khi dữ liệu trên màn hình có thể đã đổi và nên tải lại.
   *
   * Tính cả trường hợp server từ chối rồi người dùng bấm Hủy: lỗi hay gặp nhất ở đây là 409 — ai
   * đó vừa khôi phục, hoặc hạn 60 ngày vừa qua — nghĩa là thứ đang hiện trên màn hình đã cũ, và để
   * nguyên nó chỉ mời người dùng bấm lại vào một thao tác chắc chắn hỏng lần nữa.
   */
  toggleLock: (student: Student) => Promise<boolean>
  requestDeletion: (student: Student) => Promise<boolean>
  restore: (student: Student) => Promise<boolean>
  /** Trả mật khẩu mới — thứ server chỉ gửi đúng một lần — hoặc `null` khi người dùng huỷ. */
  resetPassword: (student: Student) => Promise<ResetPasswordResult | null>
}

/** Gọi server và ghi nhận nếu có ít nhất một lần hỏng, rồi ném lỗi tiếp để hộp xác nhận hiện ra. */
async function recordFailure<T>(state: { failed: boolean }, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (caught) {
    state.failed = true
    throw caught
  }
}

export function useStudentAccountActions(): StudentAccountActions {
  const confirm = useConfirm()
  const toast = useToast()

  return useMemo<StudentAccountActions>(() => ({
    async toggleLock(student) {
      const locking = student.status === 'active'
      const state = { failed: false }
      const ok = await confirm({
        ...lockConfirmCopy(student.fullName, locking),
        onConfirm: () => recordFailure(state, () => setStudentStatus(student.id, locking ? 'locked' : 'active')),
      })
      if (ok) {
        toast.success(
          locking
            ? `Đã khóa tài khoản của ${student.fullName}.`
            : `Đã mở khóa tài khoản của ${student.fullName}.`,
        )
      }
      return ok || state.failed
    },

    async requestDeletion(student) {
      const state = { failed: false }
      const reason = await confirm.withInput({
        title: 'Xoá tài khoản học sinh',
        message: `Tài khoản của ${student.fullName} (${student.code}) sẽ được đưa vào danh sách chờ xoá:`,
        details: (
          <ul className="space-y-1.5 list-disc pl-4 marker:text-slate-300">
            <li>Em ấy không đăng nhập được nữa, kể từ ngay bây giờ — phiên đang mở cũng bị đăng xuất.</li>
            <li>Bạn có thể khôi phục tài khoản trong vòng {DELETION_RETENTION_DAYS} ngày.</li>
            <li>
              Hết {DELETION_RETENTION_DAYS} ngày, hệ thống tự xoá vĩnh viễn dữ liệu cá nhân: họ tên thành
              "{ERASED_STUDENT_NAME}", email, tên đăng nhập và mã học sinh bị thay thế. Bước này không
              hoàn tác được.
            </li>
            <li>Kết quả các bài em ấy đã làm vẫn được giữ lại, để bảng điểm của lớp không bị thiếu dòng.</li>
          </ul>
        ),
        inputLabel: 'Lý do xoá tài khoản',
        placeholder: 'Ví dụ: Học sinh đã chuyển trường từ ngày 01/09',
        inputHint: 'Lý do được lưu kèm tài khoản để người xem sau này hiểu vì sao em ấy bị xoá.',
        minLength: DELETION_REASON_MIN_LENGTH,
        maxLength: DELETION_REASON_MAX_LENGTH,
        confirmLabel: 'Xoá tài khoản',
        tone: 'danger',
        onConfirm: value => recordFailure(state, () => requestStudentDeletion(student.id, value)),
      })
      if (reason !== null) {
        toast.success(
          `Đã đưa ${student.fullName} vào danh sách chờ xoá. Có thể khôi phục trong ${DELETION_RETENTION_DAYS} ngày.`,
        )
      }
      return reason !== null || state.failed
    },

    async restore(student) {
      const state = { failed: false }
      const ok = await confirm({
        title: 'Khôi phục tài khoản học sinh',
        message: `${student.fullName} sẽ trở lại trạng thái Đang hoạt động và đăng nhập lại được bằng mật khẩu cũ. Lý do xoá đã ghi bị huỷ, hệ thống ngừng đếm ngược ${DELETION_RETENTION_DAYS} ngày và dữ liệu của em ấy được giữ nguyên.`,
        details: 'Nếu trước khi bị xoá tài khoản đang bị khóa, trạng thái khóa không được giữ lại — hãy khóa lại sau khi khôi phục nếu cần.',
        confirmLabel: 'Khôi phục',
        onConfirm: () => recordFailure(state, () => restoreStudent(student.id)),
      })
      if (ok) toast.success(`Đã khôi phục tài khoản của ${student.fullName}.`)
      return ok || state.failed
    },

    async resetPassword(student) {
      const holder: { result?: ResetPasswordResult } = {}
      const ok = await confirm({
        title: 'Cấp lại mật khẩu',
        message: `Mật khẩu hiện tại của ${student.fullName} ngừng hoạt động ngay và em ấy bị đăng xuất khỏi mọi thiết bị. Hệ thống tạo một mật khẩu mới và chỉ hiển thị đúng một lần — bạn cần chép lại để trao cho học sinh.`,
        confirmLabel: 'Cấp mật khẩu mới',
        tone: 'danger',
        onConfirm: async () => {
          holder.result = await resetStudentPassword(student.id)
        },
      })
      return ok && holder.result ? holder.result : null
    },
  }), [confirm, toast])
}
