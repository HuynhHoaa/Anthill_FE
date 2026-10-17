import { useNavigate } from 'react-router-dom'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { duplicateExam } from '../../../services/examService'
import type { Exam } from '../../../types'
import { examDuplicateConfirmCopy } from '../utils/examConfirmations'

/**
 * Nhân bản một đề: hỏi xác nhận, tạo bản nháp cùng cấu hình (chưa giao cho ai) rồi mở luôn trang sửa của bản sao.
 *
 * Người ta nhân bản gần như chỉ để đổi cấu hình, nhất là khi đề gốc đã khoá vì có em bắt đầu làm — nên đi thẳng tới
 * trang sửa thay vì ở lại. Dùng chung cho mọi nút "Nhân bản" của trang chi tiết đề.
 */
export function useDuplicateExam(exam: Exam) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  return async () => {
    const outcome: { copy?: Exam } = {}
    const confirmed = await confirm({
      ...examDuplicateConfirmCopy(exam),
      onConfirm: async () => {
        outcome.copy = await duplicateExam(exam.id)
      },
    })
    const copy = outcome.copy
    if (!confirmed || !copy) return
    toast.success(`Đã tạo bản sao "${copy.title}". Bản sao đang là bản nháp, chưa giao cho ai.`)
    navigate(`/giao-vien/bai-kiem-tra/${copy.id}/sua`)
  }
}
