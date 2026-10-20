import { useId, useMemo, useState } from 'react'
import { AlertCircle, Loader2, UserRoundCog } from 'lucide-react'
import ConsequenceList from '../../../components/common/ConsequenceList'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { changeGroupTeacher, listAssignableTeachers } from '../../../services/groupService'
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../../../services/studentService'
import type { StudentGroup } from '../../../types'
import { teacherOptionLabel } from './teacherOptions'

interface ChangeTeacherModalProps {
  /** Chỉ cần tên và người đang phụ trách — trang hồ sơ giáo viên chỉ có bản tóm tắt của lớp. */
  group: Pick<StudentGroup, 'id' | 'name' | 'teachers'>
  onClose: () => void
  /** Chỉ gọi khi đã đổi được; trang cha chịu trách nhiệm tải lại lớp. */
  onChanged: () => void
}

const selectClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50'

/**
 * Đổi giáo viên phụ trách lớp. Mỗi lớp có đúng một giáo viên nên đây là thay người, không phải thêm người.
 */
export default function ChangeTeacherModal({ group, onClose, onChanged }: ChangeTeacherModalProps) {
  const toast = useToast()
  const selectId = useId()
  const reasonId = useId()
  const { data: teachers, loading, error: loadError } = useAsync(() => listAssignableTeachers(), [])

  const current = group.teachers[0]
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choices = useMemo(
    () => (teachers ?? []).filter(teacher => group.teachers.length !== 1 || teacher.id !== current?.id),
    [teachers, group.teachers.length, current?.id],
  )
  const targetTeacher = choices.find(teacher => String(teacher.id) === target)

  // Đổi người giữa chừng thì phải nói vì sao. Lớp chưa có giáo viên (lớp cũ) thì không có gì để "đổi" nên không cần lý do.
  const needsReason = current !== undefined
  const trimmedLength = reason.trim().length
  const missing = needsReason ? Math.max(0, REASON_MIN_LENGTH - trimmedLength) : 0
  const canSubmit = !submitting && targetTeacher !== undefined && missing === 0

  const handleSubmit = async () => {
    if (!targetTeacher || !canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      await changeGroupTeacher(group.id, targetTeacher.id, needsReason ? reason : undefined)
      toast.success(`${targetTeacher.fullName} đã nhận lớp ${group.name}.`)
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đổi được giáo viên.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      size="md"
      title="Đổi giáo viên phụ trách"
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
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserRoundCog size={15} />}
            Đổi giáo viên
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          {current
            ? <>Lớp <strong className="font-semibold text-slate-800">{group.name}</strong> hiện do <strong className="font-semibold text-slate-800">{current.fullName}</strong> phụ trách.</>
            : <>Lớp <strong className="font-semibold text-slate-800">{group.name}</strong> chưa có giáo viên phụ trách.</>}
        </p>

        <div>
          <label htmlFor={selectId} className="block text-sm font-semibold text-slate-700 mb-2">
            Giáo viên mới <span className="text-red-500">*</span>
          </label>
          <select
            id={selectId}
            value={target}
            onChange={event => setTarget(event.target.value)}
            disabled={submitting || loading}
            className={selectClass}
          >
            <option value="">{loading ? 'Đang tải danh sách giáo viên…' : 'Chọn giáo viên'}</option>
            {choices.map(teacher => (
              <option key={teacher.id} value={teacher.id} disabled={teacher.status === 'locked'}>
                {teacherOptionLabel(teacher)}
              </option>
            ))}
          </select>
          {loadError && <p className="mt-1.5 text-xs text-red-500">{loadError}</p>}
        </div>

        {needsReason && (
          <div>
            <label htmlFor={reasonId} className="block text-sm font-semibold text-slate-700 mb-2">
              Lý do đổi giáo viên <span className="text-red-500">*</span>
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={event => setReason(event.target.value)}
              maxLength={REASON_MAX_LENGTH}
              rows={3}
              disabled={submitting}
              placeholder="Ví dụ: Cô Lan nghỉ sinh từ đầu tháng, thầy Hùng nhận lớp"
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
        )}

        <ConsequenceList
          items={[
            ...(current ? [`${current.fullName} không còn thấy lớp và không giao được bài mới cho học sinh trong lớp.`] : []),
            'Giáo viên mới thấy lớp (khi lớp đã công bố) và giao bài từ lần sau.',
            'Học sinh, bài đã giao và kết quả giữ nguyên.',
            ...(needsReason ? ['Lý do được lưu vào lịch sử của lớp.'] : []),
          ]}
        />

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
