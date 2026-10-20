import { useId, useState } from 'react'
import { AlertCircle, Loader2, UserPlus } from 'lucide-react'
import ConfirmFacts from '../../../components/common/ConfirmFacts'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { addStudentsToGroup, listGroups } from '../../../services/groupService'
import type { Student } from '../../../types'

interface AssignToGroupModalProps {
  /** Học sinh được xếp thêm vào một lớp (em có thể đang học các lớp khác). */
  student: Student
  onClose: () => void
  /** Chỉ gọi khi em đã vào lớp; trang cha chịu trách nhiệm tải lại dữ liệu. */
  onAssigned: () => void
}

const selectClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50'

/**
 * Xếp một học sinh vào thêm một lớp. Không cần lý do: không ai bị đổi chỗ hay mất bài, em chỉ có thêm một lớp. Lớp em đã
 * học và lớp đã khoá không chọn được.
 */
export default function AssignToGroupModal({ student, onClose, onAssigned }: AssignToGroupModalProps) {
  const toast = useToast()
  const targetId = useId()
  const { data: groups, loading, error: groupsError } = useAsync(() => listGroups(), [])

  const [target, setTarget] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetGroup = (groups ?? []).find(group => String(group.id) === target)

  const handleSubmit = async () => {
    if (!targetGroup || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const result = await addStudentsToGroup(targetGroup.id, [student.id])
      if (result.added > 0) {
        toast.success(`Đã xếp ${student.fullName} vào ${targetGroup.name}.`)
        onAssigned()
        return
      }
      setError('Không xếp được em vào lớp này. Hãy tải lại trang rồi thử lại.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không xếp được học sinh vào lớp.')
    }
    setSubmitting(false)
  }

  return (
    <Modal
      open
      size="sm"
      title="Xếp vào lớp"
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
            disabled={!targetGroup || submitting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Xếp vào lớp
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ConfirmFacts rows={[{ label: 'Học sinh', value: `${student.fullName} (${student.code})` }]} />

        <div>
          <label htmlFor={targetId} className="block text-sm font-semibold text-slate-700 mb-2">
            Lớp <span className="text-red-500">*</span>
          </label>
          <select
            id={targetId}
            value={target}
            onChange={event => setTarget(event.target.value)}
            disabled={submitting || loading}
            className={selectClass}
          >
            <option value="">{loading ? 'Đang tải danh sách lớp…' : 'Chọn lớp'}</option>
            {(groups ?? []).map(group => {
              const alreadyIn = student.groups.some(own => own.id === group.id)
              return (
                <option key={group.id} value={group.id} disabled={alreadyIn || group.isLocked}>
                  {group.name} · {group.studentCount} học sinh
                  {alreadyIn ? ' · em đã học lớp này' : group.isLocked ? ' · đã khoá' : group.isPublished ? '' : ' · bản nháp'}
                </option>
              )
            })}
          </select>
          {groupsError && <p className="mt-1.5 text-xs text-red-500">{groupsError}</p>}
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            Em nhận những bài được giao cho lớp từ lúc vào lớp; bài đã giao trước đó, giáo viên cần giao lại nếu muốn em làm.
          </p>
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
