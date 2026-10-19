/**
 * Khoá / mở khoá và cấp lại mật khẩu cho tài khoản giáo viên, kèm hộp xác nhận của từng thao tác.
 *
 * Gom về một chỗ vì danh sách giáo viên và hồ sơ giáo viên cùng làm hai việc này. Khoá bắt buộc nhập lý do (lưu vào lịch sử
 * của tài khoản); mở khoá thì không.
 */
import { useMemo } from 'react'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../../../services/studentService'
import { resetTeacherPassword, setTeacherStatus, type Teacher, type TeacherPasswordResult } from '../../../services/teacherService'

export interface TeacherAccountActions {
  /**
   * Trả `true` khi dữ liệu trên màn hình có thể đã đổi và nên tải lại — kể cả khi server từ chối rồi người dùng bấm Huỷ: lỗi
   * hay gặp nhất là 404 hay 409, nghĩa là màn hình đang hiện một trạng thái cũ.
   */
  toggleLock: (teacher: Teacher) => Promise<boolean>
  /** Trả mật khẩu mới — thứ server chỉ gửi đúng một lần — hoặc `null` khi người dùng huỷ. */
  resetPassword: (teacher: Teacher) => Promise<TeacherPasswordResult | null>
}

export function useTeacherAccountActions(): TeacherAccountActions {
  const confirm = useConfirm()
  const toast = useToast()

  return useMemo<TeacherAccountActions>(() => ({
    async toggleLock(teacher) {
      const state = { failed: false }
      const run = async (status: 'active' | 'locked', reason?: string) => {
        try {
          await setTeacherStatus(teacher.id, status, reason)
        } catch (caught) {
          state.failed = true
          throw caught
        }
      }

      if (teacher.status === 'active') {
        const reason = await confirm.withInput({
          title: 'Khoá tài khoản giáo viên',
          message: `Tài khoản của ${teacher.fullName} sẽ bị khoá:`,
          details: (
            <ConsequenceList
              items={[
                `${teacher.fullName} bị đăng xuất ngay khỏi mọi thiết bị và không đăng nhập được cho tới khi được mở khoá.`,
                teacher.groupCount > 0
                  ? `${teacher.groupCount} lớp đang phụ trách vẫn mang tên giáo viên này: hãy đổi giáo viên phụ trách để lớp có người giao bài.`
                  : 'Giáo viên chưa phụ trách lớp nào nên không lớp nào bị ảnh hưởng.',
                'Câu hỏi, đề kiểm tra và kết quả đã có được giữ nguyên.',
              ]}
            />
          ),
          inputLabel: 'Lý do khoá tài khoản',
          placeholder: 'Ví dụ: Giáo viên nghỉ việc từ đầu tháng',
          inputHint: 'Lý do được lưu vào lịch sử của tài khoản để người xem sau này hiểu vì sao tài khoản bị khoá.',
          minLength: REASON_MIN_LENGTH,
          maxLength: REASON_MAX_LENGTH,
          confirmLabel: 'Khoá tài khoản',
          tone: 'danger',
          onConfirm: value => run('locked', value),
        })
        if (reason !== null) toast.success(`Đã khoá tài khoản của ${teacher.fullName}.`)
        return reason !== null || state.failed
      }

      const ok = await confirm({
        title: 'Mở khoá tài khoản giáo viên',
        message: `Tài khoản của ${teacher.fullName} sẽ được mở khoá:`,
        details: (
          <ConsequenceList
            items={[
              `${teacher.fullName} đăng nhập lại được bằng mật khẩu hiện tại.`,
              'Các lớp vẫn đang mang tên giáo viên này lại giao bài được như trước.',
            ]}
          />
        ),
        confirmLabel: 'Mở khoá',
        onConfirm: () => run('active'),
      })
      if (ok) toast.success(`Đã mở khoá tài khoản của ${teacher.fullName}.`)
      return ok || state.failed
    },

    async resetPassword(teacher) {
      const holder: { result?: TeacherPasswordResult } = {}
      const ok = await confirm({
        title: 'Cấp lại mật khẩu',
        message: `Hệ thống sẽ tạo mật khẩu mới cho ${teacher.fullName}:`,
        details: (
          <ConsequenceList
            items={[
              'Mật khẩu hiện tại ngừng hoạt động ngay và giáo viên bị đăng xuất khỏi mọi thiết bị.',
              'Mật khẩu mới chỉ hiện đúng một lần ngay sau bước này — hãy chép lại để trao cho giáo viên.',
            ]}
          />
        ),
        confirmLabel: 'Cấp mật khẩu mới',
        tone: 'danger',
        onConfirm: async () => {
          holder.result = await resetTeacherPassword(teacher.id)
        },
      })

      return ok && holder.result ? holder.result : null
    },
  }), [confirm, toast])
}
