import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Edit3, Plus, Search, Settings2, Trash2, UsersRound, X,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { formatDate, roundToOneDecimal } from '../../../lib/format'
import { deleteGroup, listGroups } from '../../../services/groupService'
import type { StudentGroup } from '../../../types'
import GroupFormModal from '../components/GroupFormModal'
import { getGroupAccent } from '../components/groupTheme'

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }

export default function StudentGroupPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const trimmedSearch = debouncedSearch.trim()
  const hasSearch = trimmedSearch.length > 0

  const { data: groups, loading, error, reload } = useAsync(
    () => listGroups({ search: trimmedSearch }),
    [trimmedSearch],
  )

  // Phụ đề phải mô tả toàn bộ dữ liệu nên dùng truy vấn riêng không kèm từ khóa,
  // tránh cảnh gõ tìm kiếm là tổng học sinh tụt theo kết quả lọc.
  const { data: allGroups, reload: reloadSummary } = useAsync(() => listGroups({}), [])

  const [formOpen, setFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<StudentGroup | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<StudentGroup | null>(null)
  const [deleting, setDeleting] = useState(false)

  const summaryText = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return undefined
    const totalStudents = allGroups.reduce((sum, group) => sum + group.studentCount, 0)
    const averageSize = roundToOneDecimal(totalStudents / allGroups.length)
    return `${allGroups.length} nhóm · ${totalStudents} học sinh · trung bình ${averageSize} em/nhóm`
  }, [allGroups])

  const openCreateForm = () => {
    setEditingGroup(undefined)
    setFormOpen(true)
  }

  const openEditForm = (group: StudentGroup) => {
    setEditingGroup(group)
    setFormOpen(true)
  }

  const handleFormSaved = () => {
    const wasCreating = editingGroup === undefined
    setFormOpen(false)
    // Xóa bộ lọc sau khi tạo để nhóm vừa thêm chắc chắn nằm trong danh sách
    if (wasCreating && searchInput) setSearchInput('')
    reload()
    reloadSummary()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return

    setDeleting(true)
    try {
      await deleteGroup(deleteTarget.id)
      toast.success(`Đã xóa nhóm ${deleteTarget.name}.`)
      setDeleteTarget(null)
      reload()
      reloadSummary()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không xóa được nhóm lớp.')
    } finally {
      setDeleting(false)
    }
  }

  // Nhóm còn học sinh thì service sẽ từ chối xóa, nên dẫn giáo viên sang trang quản lý
  // thay vì để họ bấm một nút chắc chắn thất bại.
  const blockedByStudents = deleteTarget !== null && deleteTarget.studentCount > 0

  const handleConfirmAction = () => {
    if (!deleteTarget) return
    if (blockedByStudents) {
      const groupId = deleteTarget.id
      setDeleteTarget(null)
      navigate(`/giao-vien/nhom-lop/${groupId}`)
      return
    }
    void handleDeleteConfirm()
  }

  const deleteMessage = deleteTarget
    ? blockedByStudents
      ? `Nhóm "${deleteTarget.name}" đang có ${deleteTarget.studentCount} học sinh nên chưa thể xóa. Hãy chuyển họ sang nhóm khác trong trang quản lý nhóm trước — tài khoản học sinh sẽ không bị xóa theo.`
      : `Bạn có chắc muốn xóa nhóm "${deleteTarget.name}"? Thao tác này chỉ xóa nhóm lớp, tài khoản học sinh vẫn được giữ nguyên.`
    : ''

  const rows = groups ?? []
  const showSkeleton = loading && groups === undefined
  const isRefreshing = loading && groups !== undefined

  return (
    <TeacherLayout
      pageTitle="Nhóm lớp"
      pageSubtitle={summaryText ?? 'Tổ chức học sinh theo lớp hoặc nhóm học'}
    >
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5 animate-fade-in-up">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative max-w-md w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              placeholder="Tìm theo tên hoặc mô tả nhóm"
              aria-label="Tìm kiếm nhóm lớp"
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
            <Plus size={16} /> Tạo nhóm
          </button>
        </div>
      </div>

      {showSkeleton ? (
        <SkeletonTable rows={6} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <>
          {hasSearch ? (
            <EmptyState
              icon={Search}
              title="Không tìm thấy nhóm lớp phù hợp"
              description={`Không có nhóm nào khớp với từ khóa "${trimmedSearch}". Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ nhóm.`}
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
              title="Chưa có nhóm lớp nào"
              description="Tạo nhóm lớp đầu tiên để gom học sinh theo lớp học hoặc theo nhóm ôn tập, sau đó giao bài cho cả nhóm chỉ với một thao tác."
              action={
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={primaryButtonStyle}
                >
                  <Plus size={16} /> Tạo nhóm đầu tiên
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
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nhóm lớp</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Sĩ số</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Ngày tạo</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(group => {
                  const accent = getGroupAccent(group.id)

                  return (
                    <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2.5 max-w-[420px]">
                          {/* Chấm màu thay cho dải màu ở mép thẻ cũ: vẫn nhận ra từng nhóm mà không tốn chỗ. */}
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                            style={{ background: accent.bar }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <NavLink
                              to={`/giao-vien/nhom-lop/${group.id}`}
                              className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                            >
                              {group.name}
                            </NavLink>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {group.description || 'Chưa có mô tả cho nhóm này.'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{group.studentCount}</p>
                        <p className="text-xs text-slate-400 mt-0.5">học sinh</p>
                      </td>
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        {formatDate(group.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <NavLink
                            to={`/giao-vien/nhom-lop/${group.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          >
                            <Settings2 size={14} /> Quản lý
                          </NavLink>
                          <button
                            type="button"
                            onClick={() => openEditForm(group)}
                            title="Sửa thông tin nhóm"
                            aria-label={`Sửa nhóm ${group.name}`}
                            className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-center transition-colors"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(group)}
                            title="Xóa nhóm"
                            aria-label={`Xóa nhóm ${group.name}`}
                            className="w-9 h-9 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
        title={blockedByStudents ? 'Chưa thể xóa nhóm lớp' : 'Xóa nhóm lớp'}
        message={deleteMessage}
        confirmLabel={blockedByStudents ? 'Mở trang quản lý nhóm' : 'Xóa nhóm'}
        cancelLabel={blockedByStudents ? 'Để sau' : 'Hủy'}
        tone={blockedByStudents ? 'primary' : 'danger'}
        loading={deleting}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </TeacherLayout>
  )
}
