/**
 * Danh sách lớp của QUẢN TRỊ VIÊN — nơi duy nhất lớp được lập, sửa, xoá và công bố.
 *
 * Lớp thuộc về tổ chức chứ không thuộc về giáo viên nào. Mô hình cũ để mỗi giáo viên tự tạo lớp
 * của mình, và vì mỗi học sinh chỉ thuộc đúng một lớp, hai giáo viên cùng dạy một em sẽ giành nhau
 * em đó: người thêm sau kéo em ra khỏi lớp của người trước, kéo theo mọi bài đã giao ở đó.
 */
import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Edit3, Plus, Search, Send, Settings2, Trash2, UsersRound, X,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { PublishStateBadge } from '../../../components/common/Badge'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { formatDate } from '../../../lib/format'
import { deleteGroup, listGroups, publishGroup } from '../../../services/groupService'
import type { StudentGroup } from '../../../types'
import GroupFormModal from '../components/GroupFormModal'
import GroupHealthIndicator from '../components/GroupHealthIndicator'
import { TeacherAvatar } from '../components/GroupTeacherList'
import { getGroupIssues } from '../components/groupHealth'

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }
const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'
const iconButtonClass =
  'w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-center transition-colors'

/** Số avatar giáo viên hiện thẳng trên một dòng trước khi gộp phần còn lại thành "+N". */
const TEACHER_AVATAR_LIMIT = 3

const groupDetailLink = (groupId: number) => `/quan-tri/nhom-lop/${groupId}`

/** Ô "giáo viên phụ trách": mảng rỗng là tin đáng chú ý, không phải một ô trống. */
function TeacherCell({ group }: { group: StudentGroup }) {
  if (group.teachers.length === 0) {
    return (
      <span
        title="Lớp chưa có giáo viên nào phụ trách nên bài kiểm tra không tới được học sinh trong lớp."
        className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg"
      >
        Chưa phân công
      </span>
    )
  }

  const shown = group.teachers.slice(0, TEACHER_AVATAR_LIMIT)
  const hiddenCount = group.teachers.length - shown.length
  const allNames = group.teachers.map(teacher => teacher.fullName).join(', ')

  return (
    <div className="flex items-center gap-2" title={allNames}>
      <div className="flex">
        {shown.map((teacher, index) => (
          <span
            key={teacher.id}
            className={`inline-flex rounded-full ring-2 ring-white ${index === 0 ? '' : '-ml-2'}`}
          >
            <TeacherAvatar teacher={teacher} size={28} />
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="-ml-2 w-7 h-7 rounded-full ring-2 ring-white bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center">
            +{hiddenCount}
          </span>
        )}
      </div>
      <span className="text-xs text-slate-500 truncate max-w-[140px]">
        {group.teachers.length === 1 ? group.teachers[0].fullName : `${group.teachers.length} giáo viên`}
      </span>
    </div>
  )
}

export default function AdminGroupListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const trimmedSearch = debouncedSearch.trim()
  const hasSearch = trimmedSearch.length > 0

  const { data: groups, loading, error, reload } = useAsync(
    () => listGroups(trimmedSearch),
    [trimmedSearch],
  )

  // Phụ đề phải mô tả toàn bộ dữ liệu nên dùng truy vấn riêng không kèm từ khóa,
  // tránh cảnh gõ tìm kiếm là tổng học sinh tụt theo kết quả lọc.
  const { data: allGroups, reload: reloadSummary } = useAsync(() => listGroups(), [])

  const [formOpen, setFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<StudentGroup | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<StudentGroup | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [publishTarget, setPublishTarget] = useState<StudentGroup | null>(null)
  const [publishing, setPublishing] = useState(false)

  const summaryText = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return undefined

    const totalStudents = allGroups.reduce((sum, group) => sum + group.studentCount, 0)
    const draftCount = allGroups.filter(group => !group.isPublished).length
    const needsAttentionCount = allGroups.filter(group => getGroupIssues(group).length > 0).length

    // Hai con số cuối chỉ hiện khi khác 0: "0 bản nháp" không nói với ai điều gì, nó chỉ làm dòng
    // phụ đề dài thêm và đẩy hai con số thật ra xa mắt.
    const parts = [`${allGroups.length} lớp`, `${totalStudents} học sinh`]
    if (draftCount > 0) parts.push(`${draftCount} bản nháp`)
    if (needsAttentionCount > 0) parts.push(`${needsAttentionCount} lớp cần chú ý`)
    return parts.join(' · ')
  }, [allGroups])

  const openCreateForm = () => {
    setEditingGroup(undefined)
    setFormOpen(true)
  }

  const openEditForm = (group: StudentGroup) => {
    setEditingGroup(group)
    setFormOpen(true)
  }

  const reloadAll = () => {
    reload()
    reloadSummary()
  }

  const handleFormSaved = () => {
    const wasCreating = editingGroup === undefined
    setFormOpen(false)
    // Xóa bộ lọc sau khi tạo để lớp vừa lập chắc chắn nằm trong danh sách
    if (wasCreating && searchInput) setSearchInput('')
    reloadAll()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return

    setDeleting(true)
    try {
      await deleteGroup(deleteTarget.id)
      toast.success(`Đã xóa lớp ${deleteTarget.name}.`)
      setDeleteTarget(null)
      reloadAll()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không xóa được lớp.')
    } finally {
      setDeleting(false)
    }
  }

  const handlePublishConfirm = async () => {
    if (!publishTarget || publishing) return

    setPublishing(true)
    try {
      const published = await publishGroup(publishTarget.id)
      toast.success(`Đã công bố lớp ${published.name}. Giáo viên được phân công đã thấy lớp này.`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không công bố được lớp.')
    } finally {
      setPublishing(false)
      // Cả hai nhánh đều đóng hộp thoại và tải lại: lỗi hay gặp nhất ở đây là 409 — lớp vừa được
      // công bố ở nơi khác — nên danh sách trên màn hình đang cũ, và để nguyên nút "Công bố" ở đó
      // chỉ mời người dùng bấm lại vào một thao tác chắc chắn hỏng lần nữa.
      setPublishTarget(null)
      reloadAll()
    }
  }

  // Lớp còn học sinh thì server từ chối xóa, nên dẫn thẳng sang trang quản lý
  // thay vì để quản trị viên bấm một nút chắc chắn thất bại.
  const blockedByStudents = deleteTarget !== null && deleteTarget.studentCount > 0

  const handleDeleteAction = () => {
    if (!deleteTarget) return
    if (blockedByStudents) {
      const groupId = deleteTarget.id
      setDeleteTarget(null)
      navigate(groupDetailLink(groupId))
      return
    }
    void handleDeleteConfirm()
  }

  const deleteMessage = deleteTarget
    ? blockedByStudents
      ? `Lớp "${deleteTarget.name}" đang có ${deleteTarget.studentCount} học sinh nên chưa thể xóa. Hãy chuyển họ sang lớp khác trong trang quản lý lớp trước — tài khoản học sinh sẽ không bị xóa theo.`
      : `Bạn có chắc muốn xóa lớp "${deleteTarget.name}"? Thao tác này chỉ xóa lớp, tài khoản học sinh vẫn được giữ nguyên.`
    : ''

  const publishWithoutTeacher = publishTarget !== null && publishTarget.teachers.length === 0

  // Công bố một lớp chưa có giáo viên không sai, nhưng cũng không tới được ai: giáo viên chỉ thấy
  // lớp mình được phân công. Cảnh báo mà vẫn cho làm — quản trị viên có thể đang công bố trước rồi
  // phân công sau, và chặn hẳn ở đây là đoán hộ họ.
  const publishMessage = publishTarget
    ? publishWithoutTeacher
      ? `Lớp "${publishTarget.name}" chưa có giáo viên nào phụ trách. Công bố bây giờ thì lớp vẫn chưa hiện với ai, vì giáo viên chỉ thấy lớp mình được phân công. Bạn nên phân công giáo viên trong trang quản lý lớp trước.`
      : `Công bố lớp "${publishTarget.name}"? ${publishTarget.teachers.length} giáo viên được phân công sẽ thấy lớp và có thể giao bài kiểm tra cho ${publishTarget.studentCount} học sinh trong lớp.`
    : ''

  const rows = groups ?? []
  const showSkeleton = loading && groups === undefined
  const isRefreshing = loading && groups !== undefined

  return (
    <AdminLayout
      pageTitle="Nhóm lớp"
      pageSubtitle={summaryText ?? 'Lập lớp, xếp học sinh và phân công giáo viên phụ trách'}
    >
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5 animate-fade-in-up">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative max-w-md w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              placeholder="Tìm theo tên hoặc mô tả lớp"
              aria-label="Tìm kiếm lớp"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={primaryButtonStyle}
          >
            <Plus size={16} /> Lập lớp mới
          </button>
        </div>
      </div>

      {showSkeleton ? (
        <SkeletonTable rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <>
          {hasSearch ? (
            <EmptyState
              icon={Search}
              title="Không tìm thấy lớp phù hợp"
              description={`Không có lớp nào khớp với từ khóa "${trimmedSearch}". Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ lớp.`}
              action={
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <X size={15} /> Xóa tìm kiếm
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={UsersRound}
              title="Chưa có lớp nào"
              description="Lập lớp đầu tiên, xếp học sinh vào rồi phân công giáo viên phụ trách. Lớp mới luôn ở dạng bản nháp cho tới khi bạn công bố."
              action={
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={primaryButtonStyle}
                >
                  <Plus size={16} /> Lập lớp đầu tiên
                </button>
              }
            />
          )}
        </>
      ) : (
        <div
          className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up transition-opacity ${
            isRefreshing ? 'opacity-60' : 'opacity-100'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className={`${headerCellClass} text-left`}>Lớp</th>
                  <th className={`${headerCellClass} text-left`}>Sĩ số</th>
                  <th className={`${headerCellClass} text-left`}>Giáo viên phụ trách</th>
                  <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                  <th className={`${headerCellClass} text-left`}>Ngày tạo</th>
                  <th className={`${headerCellClass} text-right`}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(group => (
                  <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2.5 max-w-[420px]">
                        <GroupHealthIndicator group={group} />
                        <div className="min-w-0">
                          <NavLink
                            to={groupDetailLink(group.id)}
                            className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                          >
                            {group.name}
                          </NavLink>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {group.description || 'Chưa có mô tả cho lớp này.'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{group.studentCount}</p>
                      <p className="text-xs text-slate-400 mt-0.5">học sinh</p>
                    </td>
                    <td className="px-5 py-4">
                      <TeacherCell group={group} />
                    </td>
                    <td className="px-5 py-4">
                      <PublishStateBadge isPublished={group.isPublished} />
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {formatDate(group.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!group.isPublished && (
                          <button
                            type="button"
                            onClick={() => setPublishTarget(group)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                          >
                            <Send size={14} /> Công bố
                          </button>
                        )}
                        <NavLink
                          to={groupDetailLink(group.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Settings2 size={14} /> Quản lý
                        </NavLink>
                        <button
                          type="button"
                          onClick={() => openEditForm(group)}
                          title="Sửa thông tin lớp"
                          aria-label={`Sửa lớp ${group.name}`}
                          className={iconButtonClass}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(group)}
                          title="Xóa lớp"
                          aria-label={`Xóa lớp ${group.name}`}
                          className="w-9 h-9 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GroupFormModal
        open={formOpen}
        group={editingGroup}
        onClose={() => setFormOpen(false)}
        onSaved={handleFormSaved}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={blockedByStudents ? 'Chưa thể xóa lớp' : 'Xóa lớp'}
        message={deleteMessage}
        confirmLabel={blockedByStudents ? 'Mở trang quản lý lớp' : 'Xóa lớp'}
        cancelLabel={blockedByStudents ? 'Để sau' : 'Hủy'}
        tone={blockedByStudents ? 'primary' : 'danger'}
        loading={deleting}
        onConfirm={handleDeleteAction}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />

      <ConfirmDialog
        open={publishTarget !== null}
        title={publishWithoutTeacher ? 'Công bố lớp chưa có giáo viên?' : 'Công bố lớp'}
        message={publishMessage}
        confirmLabel={publishWithoutTeacher ? 'Vẫn công bố' : 'Công bố'}
        cancelLabel="Để sau"
        loading={publishing}
        onConfirm={handlePublishConfirm}
        onCancel={() => {
          if (!publishing) setPublishTarget(null)
        }}
      />
    </AdminLayout>
  )
}
