import { useId, useMemo, useState } from 'react'
import { AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react'
import ConfirmFacts from '../../../components/common/ConfirmFacts'
import ConsequenceList from '../../../components/common/ConsequenceList'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { listGroups, transferStudent } from '../../../services/groupService'
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../../../services/studentService'
import type { Student, StudentGroup } from '../../../types'

interface TransferStudentModalProps {
  student: Student
  /** Lớp em được chuyển đi; lớp đích không được trùng lớp này. */
  group: Pick<StudentGroup, 'id' | 'name'>
  onClose: () => void
  /** Chỉ gọi khi đã chuyển được; trang cha chịu trách nhiệm tải lại dữ liệu. */
  onTransferred: () => void
}

const selectClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50'

/**
 * Chuyển một học sinh sang lớp khác — gỡ khỏi lớp này và xếp vào lớp đích trong một bước; chọn lớp đích và nhập lý do
 * (bắt buộc). Lớp em đã học và lớp đã khoá không chọn được. Lý do được lưu vào lịch sử của học sinh.
 */
export default function TransferStudentModal({ student, group, onClose, onTransferred }: TransferStudentModalProps) {
  const toast = useToast()
  const reasonId = useId()
  const targetId = useId()

  const { data: groups, loading: groupsLoading, error: groupsError } = useAsync(() => listGroups(), [])

  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targets = useMemo(() => (groups ?? []).filter(item => item.id !== group.id), [groups, group.id])
  const isTaken = (item: StudentGroup) => student.groups.some(own => own.id === item.id)
  const targetGroup = targets.find(item => String(item.id) === target)

  const trimmedLength = reason.trim().length
  const missing = Math.max(0, REASON_MIN_LENGTH - trimmedLength)
  const canSubmit = !submitting && targetGroup !== undefined && !targetGroup.isLocked && !isTaken(targetGroup) && missing === 0

  const handleSubmit = async () => {
    if (!canSubmit || !targetGroup) return

    setSubmitting(true)
    setError(null)
    try {
      const result = await transferStudent(group.id, student.id, targetGroup.id, reason)
      toast.success(
        `Đã chuyển ${student.fullName} sang ${targetGroup.name}.`
        + (result.revokedExams > 0 ? ` Đã thu hồi ${result.revokedExams} bài chưa làm của lớp cũ.` : ''),
      )
      onTransferred()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không chuyển được học sinh.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      size="md"
      title="Chuyển lớp"
      showCloseButton={false}
      onClose={() => {
        if (!submitting) onClose()
      }}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}
            Chuyển lớp
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ConfirmFacts
          rows={[
            { label: 'Học sinh', value: `${student.fullName} (${student.code})` },
            { label: 'Lớp hiện tại', value: group.name },
          ]}
        />

        <div>
          <label htmlFor={targetId} className="block text-sm font-semibold text-slate-700 mb-2">
            Chuyển sang lớp <span className="text-red-500">*</span>
          </label>
          <select
            id={targetId}
            value={target}
            onChange={event => setTarget(event.target.value)}
            disabled={submitting || groupsLoading}
            className={selectClass}
          >
            <option value="">{groupsLoading ? 'Đang tải danh sách lớp…' : 'Chọn lớp đích'}</option>
            {targets.map(item => (
              <option key={item.id} value={item.id} disabled={item.isLocked || isTaken(item)}>
                {item.name} · {item.studentCount} học sinh
                {isTaken(item) ? ' · em đã học lớp này' : item.isLocked ? ' · đã khoá' : item.isPublished ? '' : ' · bản nháp'}
              </option>
            ))}
          </select>
          {groupsError && <p className="mt-1.5 text-xs text-red-500">{groupsError}</p>}
        </div>

        <div>
          <label htmlFor={reasonId} className="block text-sm font-semibold text-slate-700 mb-2">
            Lý do chuyển lớp <span className="text-red-500">*</span>
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={event => setReason(event.target.value)}
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            disabled={submitting}
            placeholder="Ví dụ: Xếp nhầm lớp từ đầu năm, phụ huynh đã xin chuyển"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none resize-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50"
          />
          <div className="mt-1.5 flex items-start justify-between gap-3 text-xs">
            <span className={missing > 0 && reason.length > 0 ? 'text-amber-600' : 'text-slate-400'}>
              {missing === 0
                ? 'Đã đủ độ dài tối thiểu.'
                : reason.length > 0
                  ? `Cần thêm ít nhất ${missing} ký tự nữa.`
                  : `Tối thiểu ${REASON_MIN_LENGTH} ký tự.`}
            </span>
            <span className="text-slate-400 tabular-nums flex-shrink-0">{trimmedLength}/{REASON_MAX_LENGTH}</span>
          </div>
        </div>

        <div className="text-sm text-slate-600 leading-relaxed">
          <ConsequenceList
            items={[
              'Các lớp khác em đang học giữ nguyên.',
              'Những bài lớp cũ đã giao mà em chưa làm và chưa hết hạn bị thu hồi khỏi em.',
              'Em không tự nhận bài đã giao cho lớp mới; giáo viên giao lại lớp nếu muốn em làm.',
              'Lý do được lưu vào lịch sử của học sinh.',
            ]}
          />
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
