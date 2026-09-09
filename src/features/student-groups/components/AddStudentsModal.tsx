import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Search, UserPlus, Users } from 'lucide-react'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Modal from '../../../components/common/Modal'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { getInitials, normalizeText } from '../../../lib/format'
import { UNASSIGNED_GROUP_ID, addStudentToGroup, listAssignableStudents } from '../../../services/groupService'
import { getAvatarTone } from './groupTheme'

interface AddStudentsModalProps {
  groupId: number
  groupName: string
  onClose: () => void
  /** Gọi khi đã thêm được ít nhất một học sinh, trang cha chịu trách nhiệm tải lại dữ liệu. */
  onAdded: () => void
}

export default function AddStudentsModal({ groupId, groupName, onClose, onAdded }: AddStudentsModalProps) {
  const toast = useToast()
  const { data: assignableStudents, loading, error, reload } = useAsync(
    () => listAssignableStudents(groupId),
    [groupId],
  )

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const filteredStudents = useMemo(() => {
    const students = assignableStudents ?? []
    const normalizedSearch = normalizeText(search)
    if (!normalizedSearch) return students
    return students.filter(student =>
      normalizeText(`${student.fullName} ${student.code} ${student.email} ${student.group}`).includes(
        normalizedSearch,
      ),
    )
  }, [assignableStudents, search])

  const visibleIds = filteredStudents.map(student => student.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id))

  const transferredStudentCount = useMemo(
    () =>
      (assignableStudents ?? []).filter(
        student => student.groupId !== UNASSIGNED_GROUP_ID && selectedIds.includes(student.id),
      ).length,
    [assignableStudents, selectedIds],
  )

  const toggleStudent = (studentId: number) => {
    setSelectedIds(current =>
      current.includes(studentId)
        ? current.filter(id => id !== studentId)
        : [...current, studentId],
    )
  }

  const toggleAllVisible = () => {
    setSelectedIds(current =>
      allVisibleSelected
        ? current.filter(id => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    )
  }

  const handleSubmit = async () => {
    if (selectedIds.length === 0 || submitting) return

    setSubmitting(true)
    let addedCount = 0
    let firstErrorMessage: string | undefined

    // Thêm lần lượt để một học sinh lỗi không làm hỏng cả lượt thêm
    for (const studentId of selectedIds) {
      try {
        await addStudentToGroup(groupId, studentId)
        addedCount += 1
      } catch (caught) {
        if (!firstErrorMessage) {
          firstErrorMessage = caught instanceof Error ? caught.message : 'Không thêm được học sinh.'
        }
      }
    }

    setSubmitting(false)
    const failedCount = selectedIds.length - addedCount

    if (addedCount > 0 && failedCount === 0) {
      toast.success(`Đã thêm ${addedCount} học sinh vào ${groupName}.`)
    } else if (addedCount > 0) {
      toast.info(`Đã thêm ${addedCount} học sinh, ${failedCount} học sinh không thêm được.`)
    } else {
      toast.error(firstErrorMessage ?? 'Không thêm được học sinh nào vào nhóm.')
    }

    if (addedCount > 0) {
      onAdded()
    } else {
      setSelectedIds([])
      reload()
    }
  }

  const hasStudents = (assignableStudents?.length ?? 0) > 0

  return (
    <Modal
      open
      size="lg"
      title={`Thêm học sinh vào ${groupName}`}
      description="Học sinh đang thuộc nhóm khác sẽ được chuyển sang nhóm này."
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
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedIds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {selectedIds.length > 0 ? `Thêm ${selectedIds.length} học sinh` : 'Thêm vào nhóm'}
          </button>
        </>
      }
    >
      {loading && (
        <div className="space-y-3">
          <SkeletonBlock className="h-10 w-full rounded-xl" />
          {[0, 1, 2, 3, 4].map(rowKey => (
            <div key={rowKey} className="flex items-center gap-3 px-3 py-2.5">
              <SkeletonBlock className="h-4 w-4 rounded" />
              <SkeletonBlock className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-3.5 w-2/5" />
                <SkeletonBlock className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && !hasStudents && (
        <EmptyState
          icon={Users}
          title="Mọi học sinh đã thuộc nhóm này"
          description="Không còn học sinh nào bên ngoài nhóm để thêm vào."
        />
      )}

      {!loading && !error && hasStudents && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Tìm theo tên, mã học sinh hoặc email"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {filteredStudents.length} học sinh có thể thêm · Đã chọn {selectedIds.length}
            </p>
            {filteredStudents.length > 0 && (
              <button
                type="button"
                onClick={toggleAllVisible}
                disabled={submitting}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50"
              >
                {allVisibleSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            )}
          </div>

          {transferredStudentCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2.5">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-700">
                {transferredStudentCount} học sinh sẽ được chuyển khỏi nhóm hiện tại.
              </p>
            </div>
          )}

          {filteredStudents.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">Không tìm thấy học sinh phù hợp</p>
              <p className="text-sm text-slate-400 mt-1">
                {`Không có học sinh nào khớp với từ khóa "${search.trim()}".`}
              </p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                Xóa từ khóa tìm kiếm
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-50">
              {filteredStudents.map(student => {
                const avatarTone = getAvatarTone(student.id)
                const isSelected = selectedIds.includes(student.id)
                const isInAnotherGroup = student.groupId !== UNASSIGNED_GROUP_ID
                return (
                  <label
                    key={student.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={submitting}
                      onChange={() => toggleStudent(student.id)}
                      className="w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
                    />
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarTone.bg} ${avatarTone.text}`}
                    >
                      {getInitials(student.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{student.fullName}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {student.code} · {student.email}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        isInAnotherGroup ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isInAnotherGroup ? `Đang ở ${student.group}` : student.group}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
