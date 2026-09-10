import { useMemo, useState } from 'react'
import { Loader2, Search, UserPlus, Users } from 'lucide-react'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Modal from '../../../components/common/Modal'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { normalizeText } from '../../../lib/format'
import { assignTeachersToGroup, listAssignableTeachers } from '../../../services/groupService'
import { TeacherAvatar } from './GroupTeacherList'

interface AddTeachersModalProps {
  groupId: number
  groupName: string
  onClose: () => void
  /** Gọi khi đã phân công được ít nhất một người, trang cha chịu trách nhiệm tải lại dữ liệu. */
  onAssigned: () => void
}

export default function AddTeachersModal({
  groupId, groupName, onClose, onAssigned,
}: AddTeachersModalProps) {
  const toast = useToast()
  const { data: assignableTeachers, loading, error, reload } = useAsync(
    () => listAssignableTeachers(groupId),
    [groupId],
  )

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const filteredTeachers = useMemo(() => {
    const teachers = assignableTeachers ?? []
    const normalizedSearch = normalizeText(search)
    if (!normalizedSearch) return teachers
    return teachers.filter(teacher =>
      normalizeText(`${teacher.fullName} ${teacher.email} ${teacher.subject}`).includes(normalizedSearch),
    )
  }, [assignableTeachers, search])

  const visibleIds = filteredTeachers.map(teacher => teacher.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id))

  const toggleTeacher = (teacherId: number) => {
    setSelectedIds(current =>
      current.includes(teacherId)
        ? current.filter(id => id !== teacherId)
        : [...current, teacherId],
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
    let assignedCount = 0

    // MỘT request cho cả danh sách, giống hệt lúc thêm học sinh: phân công bốn giáo viên bộ môn
    // cho một lớp là chuyện thường ngày, và kết quả trả về nói rõ ai bị bỏ qua vì lý do gì.
    try {
      const result = await assignTeachersToGroup(groupId, selectedIds)
      assignedCount = result.assigned

      if (assignedCount > 0 && result.skippedLocked > 0) {
        // Tài khoản bị khoá là lý do duy nhất đòi quản trị viên làm thêm một việc nữa, nên nó
        // được nói riêng thay vì gộp vào một con số "bỏ qua" chung chung.
        toast.info(`Đã phân công ${assignedCount} giáo viên, bỏ qua ${result.skippedLocked} tài khoản đang bị khóa.`)
      } else if (assignedCount > 0) {
        toast.success(`Đã phân công ${assignedCount} giáo viên cho ${groupName}.`)
      } else if (result.skippedLocked > 0) {
        toast.error('Những giáo viên đã chọn đều đang bị khóa tài khoản. Hãy mở khóa trước khi phân công.')
      } else if (result.skippedAlreadyAssigned > 0) {
        toast.info('Những giáo viên đã chọn đều đang phụ trách lớp này rồi.')
      } else {
        toast.error('Không phân công được giáo viên nào.')
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không phân công được giáo viên.')
    } finally {
      setSubmitting(false)
    }

    if (assignedCount > 0) {
      onAssigned()
    } else {
      setSelectedIds([])
      reload()
    }
  }

  const hasTeachers = (assignableTeachers?.length ?? 0) > 0

  return (
    <Modal
      open
      size="lg"
      title={`Phân công giáo viên cho ${groupName}`}
      description="Giáo viên được phân công sẽ thấy lớp này sau khi lớp được công bố."
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
            {selectedIds.length > 0 ? `Phân công ${selectedIds.length} giáo viên` : 'Phân công'}
          </button>
        </>
      }
    >
      {loading && (
        <div className="space-y-3">
          <SkeletonBlock className="h-10 w-full rounded-xl" />
          {[0, 1, 2, 3].map(rowKey => (
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

      {!loading && !error && !hasTeachers && (
        <EmptyState
          icon={Users}
          title="Không còn giáo viên nào để phân công"
          description="Mọi giáo viên trong hệ thống đều đã phụ trách lớp này."
        />
      )}

      {!loading && !error && hasTeachers && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Tìm theo tên, email hoặc môn giảng dạy"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {filteredTeachers.length} giáo viên có thể phân công · Đã chọn {selectedIds.length}
            </p>
            {filteredTeachers.length > 0 && (
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

          {filteredTeachers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">Không tìm thấy giáo viên phù hợp</p>
              <p className="text-sm text-slate-400 mt-1">
                {`Không có giáo viên nào khớp với từ khóa "${search.trim()}".`}
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
              {filteredTeachers.map(teacher => {
                const isSelected = selectedIds.includes(teacher.id)
                return (
                  <label
                    key={teacher.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={submitting}
                      onChange={() => toggleTeacher(teacher.id)}
                      className="w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
                    />
                    <TeacherAvatar teacher={teacher} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{teacher.fullName}</p>
                      <p className="text-xs text-slate-400 truncate">{teacher.email}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 bg-slate-100 text-slate-500">
                      {teacher.subject || 'Chưa gán môn'}
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
