import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Copy, Lock, Pencil, Trash2, Unlock } from 'lucide-react'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { deleteExam, releaseExamAnswers } from '../../../services/examService'
import type { Exam, ExamAssignment } from '../../../types'
import { useAnswersGate } from '../hooks/useAnswersGate'
import { useDuplicateExam } from '../hooks/useDuplicateExam'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { examDeleteConfirmCopy } from '../utils/examConfirmations'

interface ExamActionsProps {
  exam: Exam
  assignments: ExamAssignment[]
  /** Nạp lại dữ liệu của trang sau khi mở đáp án. */
  onReload: () => void
}

const baseClass =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap'
const softClass = `${baseClass} text-indigo-600 bg-indigo-50 hover:bg-indigo-100`
const disabledClass = `${baseClass} text-slate-300 bg-slate-50 cursor-not-allowed`

/**
 * Các thao tác với một đề: mở đáp án cho học sinh, sửa, nhân bản, xoá. Một bộ nút duy nhất dùng ở mọi tab của trang chi
 * tiết (cùng nhãn, cùng kích cỡ, cùng thứ tự) — trước đây mỗi tab tự vẽ một kiểu.
 *
 * "Mở đáp án" là cho **học sinh** xem điểm và đáp án sau khi hết giờ; đừng nhầm với "Xem đáp án" ở tab Nội dung, nơi
 * giáo viên tự xem đáp án của đề.
 */
export default function ExamActions({ exam, assignments, onReload }: ExamActionsProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const answersGate = useAnswersGate(exam)
  const handleDuplicate = useDuplicateExam(exam)
  const [releasing, setReleasing] = useState(false)

  const hasSubmission = exam.submittedCount > 0
  // Đề đã khoá thì "Sửa" chỉ đổi được tên, mô tả (và lịch nếu chưa khoá giờ): nói ở chú giải của nút.
  const editTitle = exam.blueprintFrozen
    ? (exam.scheduleLocked ? 'Chỉ sửa được tên và mô tả' : 'Sửa tên, mô tả và lịch')
    : 'Sửa đề'

  const handleReleaseAnswers = async () => {
    if (releasing) return
    const confirmed = await confirm({
      title: 'Mở đáp án cho học sinh?',
      message: `Học sinh đã nộp bài “${exam.title}” sẽ xem được điểm và đáp án từng câu.`,
      details: (
        <ConsequenceList
          items={[
            'Các em thấy câu nào đúng, câu nào sai và đáp án đúng là gì.',
            'Việc này không hoàn tác được.',
          ]}
        />
      ),
      confirmLabel: 'Mở đáp án',
      onConfirm: async () => {
        setReleasing(true)
        try {
          await releaseExamAnswers(exam.id)
        } finally {
          setReleasing(false)
        }
      },
    })
    if (!confirmed) return

    toast.success('Đã mở đáp án. Học sinh xem được điểm và đáp án từng câu.')
    onReload()
  }

  const handleDelete = async () => {
    const deleted = await confirm({
      ...examDeleteConfirmCopy(exam, assignments.filter(assignment => assignment.status === 'inprogress').length),
      onConfirm: () => deleteExam(exam.id),
    })
    if (!deleted) return
    toast.success(`Đã xoá bài kiểm tra "${exam.title}".`)
    navigate('/giao-vien/bai-kiem-tra')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Đáp án đang tắt thì mới cần nút: bật rồi thì tự mở khi lớp cuối hết giờ, không có gì để bấm. */}
      {!exam.showResultAfterSubmit && answersGate.state !== 'none' && (
        answersGate.state === 'over' ? (
          <button
            type="button"
            onClick={() => void handleReleaseAnswers()}
            disabled={releasing}
            title="Cho học sinh xem điểm và đáp án từng câu"
            className={`${softClass} disabled:opacity-60`}
          >
            <Unlock size={15} /> Mở đáp án
          </button>
        ) : (
          <button type="button" disabled title="Chưa hết giờ nên chưa mở được đáp án" className={disabledClass}>
            <Lock size={15} /> Mở đáp án
          </button>
        )
      )}
      <NavLink to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`} title={editTitle} className={softClass}>
        <Pencil size={15} /> Sửa
      </NavLink>
      <button
        type="button"
        onClick={() => void handleDuplicate()}
        title="Tạo một bản nháp mới cùng cấu hình, chưa giao cho ai"
        className={softClass}
      >
        <Copy size={15} /> Nhân bản
      </button>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={hasSubmission}
        title={hasSubmission ? 'Không thể xoá bài đã có học sinh nộp' : undefined}
        className={`${baseClass} ${hasSubmission ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
      >
        <Trash2 size={15} /> Xoá
      </button>
    </div>
  )
}
