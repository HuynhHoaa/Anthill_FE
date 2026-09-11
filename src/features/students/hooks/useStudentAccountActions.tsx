/**
 * Bốn thao tác trên tài khoản học sinh — khoá/mở khoá, cấp lại mật khẩu, xoá, khôi phục — kèm hộp
 * xác nhận của từng thao tác.
 *
 * Gom về một chỗ vì danh sách học sinh và trang sửa học sinh cùng làm bốn việc này. Hai bản câu chữ
 * tách rời thì sớm muộn một bản nói "khôi phục được trong 60 ngày" còn bản kia quên mất.
 */
import { useEffect, useMemo, useRef } from 'react'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import {
  DELETION_REASON_MAX_LENGTH, DELETION_REASON_MIN_LENGTH, DELETION_RETENTION_DAYS, ERASED_STUDENT_NAME,
  requestStudentDeletion, resetStudentPassword, restoreStudent, setStudentStatus,
  type ResetPasswordResult,
} from '../../../services/studentService'
import type { Student } from '../../../types'

/**
 * Hệ quả của việc khoá/mở khoá, tách riêng để trang sửa học sinh ghép chung với hệ quả đổi lớp vào
 * một hộp duy nhất khi người dùng đổi cả hai rồi bấm Lưu.
 *
 * Điều dễ bị bỏ sót nhất là chuyện giao bài: server bỏ qua mọi tài khoản không ở trạng thái hoạt
 * động khi giáo viên giao bài, và mở khoá xong em cũng không tự nhận lại những bài đã lỡ.
 */
export function lockConsequences(fullName: string, locking: boolean): string[] {
  return locking
    ? [
        `${fullName} bị đăng xuất ngay khỏi mọi thiết bị, kể cả khi đang làm bài dở — đồng hồ của bài đó vẫn chạy, câu trả lời đã lưu còn nguyên nhưng em không vào tiếp được.`,
        'Em ấy không đăng nhập hay làm bài được cho tới khi được mở khoá.',
        'Nếu giáo viên giao bài trong thời gian này, hệ thống sẽ bỏ qua em — mở khoá xong em cũng không có những bài đó, giáo viên cần giao lại.',
        'Bài đã nộp và điểm vẫn giữ nguyên.',
      ]
    : [
        `${fullName} đăng nhập lại được bằng mật khẩu hiện tại và tiếp tục làm những bài đang được giao.`,
        'Những bài được giao trong lúc em bị khoá, em sẽ không có — giáo viên cần giao lại nếu muốn em làm.',
      ]
}

/** Câu chữ của hộp khoá/mở khoá — trang sửa học sinh cũng dùng khi đổi ô trạng thái rồi bấm Lưu. */
export function lockConfirmCopy(fullName: string, locking: boolean) {
  return locking
    ? {
        title: 'Khoá tài khoản học sinh',
        message: `Tài khoản của ${fullName} sẽ bị khoá:`,
        details: <ConsequenceList items={lockConsequences(fullName, true)} />,
        confirmLabel: 'Khoá tài khoản',
        tone: 'danger' as const,
      }
    : {
        title: 'Mở khoá tài khoản học sinh',
        message: `Tài khoản của ${fullName} sẽ được mở khoá:`,
        details: <ConsequenceList items={lockConsequences(fullName, false)} />,
        confirmLabel: 'Mở khoá',
        tone: 'primary' as const,
      }
}

export interface StudentAccountActions {
  /**
   * Mỗi hàm trả `true` khi dữ liệu trên màn hình có thể đã đổi và nên tải lại.
   *
   * Tính cả trường hợp server từ chối rồi người dùng bấm Huỷ: lỗi hay gặp nhất ở đây là 409 — ai
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

  // Trang gọi hook này có thể đã bị gỡ khi server trả lời (người dùng bấm Back giữa chừng). Với mật
  // khẩu vừa cấp thì đó là mất trắng, nên phải biết để báo thay vì im lặng bỏ qua.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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
            ? `Đã khoá tài khoản của ${student.fullName}.`
            : `Đã mở khoá tài khoản của ${student.fullName}.`,
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
          <ConsequenceList
            items={[
              'Em ấy không đăng nhập được nữa, kể từ ngay bây giờ — phiên đang mở cũng bị đăng xuất.',
              `Bạn có thể khôi phục tài khoản trong vòng ${DELETION_RETENTION_DAYS} ngày kể từ hôm nay.`,
              `Hết ${DELETION_RETENTION_DAYS} ngày, hệ thống tự xoá vĩnh viễn dữ liệu cá nhân: họ tên thành "${ERASED_STUDENT_NAME}", email, tên đăng nhập và mã học sinh bị thay thế. Bước này không hoàn tác được.`,
              'Kết quả các bài em ấy đã làm vẫn được giữ lại, để bảng điểm của lớp không bị thiếu dòng.',
            ]}
          />
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
        details: 'Nếu trước khi bị xoá tài khoản đang bị khoá, trạng thái khoá không được giữ lại — hãy khoá lại sau khi khôi phục nếu cần. Những bài được giao trong lúc em chờ xoá, em sẽ không có — giáo viên cần giao lại nếu muốn em làm.',
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
        message: `Hệ thống sẽ tạo mật khẩu mới cho ${student.fullName}:`,
        details: (
          <ConsequenceList
            items={[
              'Mật khẩu hiện tại ngừng hoạt động ngay và em ấy bị đăng xuất khỏi mọi thiết bị.',
              'Nếu em đang làm bài dở, đồng hồ của bài đó vẫn chạy trong lúc em đăng nhập lại; câu trả lời đã lưu còn nguyên.',
              'Mật khẩu mới chỉ hiện đúng một lần ngay sau bước này — hãy chép lại để trao cho học sinh.',
            ]}
          />
        ),
        confirmLabel: 'Cấp mật khẩu mới',
        tone: 'danger',
        onConfirm: async () => {
          holder.result = await resetStudentPassword(student.id)
        },
      })
      if (!ok || !holder.result) return null
      if (!mountedRef.current) {
        toast.error(
          `Mật khẩu của ${student.fullName} đã được đổi, nhưng bạn rời trang trước khi mật khẩu mới kịp hiện ra. Hãy mở lại hồ sơ và cấp mật khẩu mới lần nữa.`,
        )
        return null
      }
      return holder.result
    },
  }), [confirm, toast])
}
