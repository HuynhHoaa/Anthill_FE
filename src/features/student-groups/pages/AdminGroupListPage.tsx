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
  Edit3, EyeOff, Plus, Search, Send, Settings2, Trash2, UsersRound, X,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { PublishStateBadge } from '../../../components/common/Badge'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { usePagination } from '../../../hooks/usePagination'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { useUrlListState } from '../../../hooks/useUrlListState'
import { formatDate } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { deleteGroup, listGroups, publishGroup, unpublishGroup } from '../../../services/groupService'
import type { StudentGroup } from '../../../types'
import GroupFormModal from '../components/GroupFormModal'
import GroupHealthIndicator from '../components/GroupHealthIndicator'
import { TeacherAvatar } from '../components/GroupTeacherList'
import { getGroupIssues } from '../components/groupHealth'

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }
const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'
const iconButtonClass =
  'w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-center transition-colors'

const PAGE_SIZE = 10

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
  const confirm = useConfirm()
  const navigate = useNavigate()
  // Từ khoá và số trang nằm trên URL: Back từ trang chi tiết một lớp về đúng chỗ đang xem.
  const { searchInput, setSearchInput, search, page, setPage, clearAll } = useUrlListState({})
  const trimmedSearch = search.trim()
  const hasSearch = trimmedSearch.length > 0

  const { data: groups, loading, error, reload } = useAsync(
    () => listGroups(trimmedSearch),
    [trimmedSearch],
  )

  // Phụ đề phải mô tả toàn bộ dữ liệu nên dùng truy vấn riêng không kèm từ khoá,
  // tránh cảnh gõ tìm kiếm là tổng học sinh tụt theo kết quả lọc.
  const { data: allGroups, reload: reloadSummary } = useAsync(() => listGroups(), [])

  const [formOpen, setFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<StudentGroup | undefined>(undefined)

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
    // Xoá bộ lọc sau khi tạo để lớp vừa lập chắc chắn nằm trong danh sách
    if (wasCreating && searchInput) setSearchInput('')
    reloadAll()
  }

  /**
   * Server từ chối thì vẫn tải lại danh sách rồi mới báo lỗi trong hộp: lỗi hay gặp nhất ở đây là
   * 409 — lớp vừa được công bố, vừa có thêm học sinh ở nơi khác — nghĩa là thứ đang hiện trên màn
   * hình đã cũ, và để nguyên nó chỉ mời người dùng bấm lại vào một thao tác chắc chắn hỏng lần nữa.
   */
  const reloadOnFailure = (action: () => Promise<unknown>) => async () => {
    try {
      await action()
    } catch (caught) {
      reloadAll()
      throw caught
    }
  }

  const requestDelete = async (group: StudentGroup) => {
    // Lớp còn học sinh thì server từ chối xoá, nên dẫn thẳng sang trang quản lý
    // thay vì để quản trị viên bấm một nút chắc chắn thất bại.
    if (group.studentCount > 0) {
      const openManager = await confirm({
        title: 'Chưa thể xoá lớp',
        message: `Lớp “${group.name}” đang có ${group.studentCount} học sinh nên chưa thể xoá.`,
        details: (
          <ConsequenceList
            items={[
              'Hãy chuyển các em sang lớp khác trong trang quản lý lớp trước.',
              'Tài khoản học sinh sẽ không bị xoá theo.',
            ]}
          />
        ),
        confirmLabel: 'Mở trang quản lý lớp',
        cancelLabel: 'Để sau',
      })
      if (openManager) navigate(groupDetailLink(group.id))
      return
    }

    const deleted = await confirm({
      title: 'Xoá lớp',
      message: `Lớp “${group.name}” sẽ bị xoá và không khôi phục được.`,
      details: (
        <ConsequenceList
          items={[
            ...(group.teachers.length > 0
              ? [`${group.teachers.length} giáo viên đang phụ trách sẽ không còn thấy lớp này.`]
              : []),
            'Lớp hiện không có học sinh nào nên không tài khoản hay kết quả bài làm nào bị ảnh hưởng.',
          ]}
        />
      ),
      confirmLabel: 'Xoá lớp',
      tone: 'danger',
      onConfirm: reloadOnFailure(() => deleteGroup(group.id)),
    })
    if (!deleted) return
    toast.success(`Đã xoá lớp ${group.name}.`)
    reloadAll()
  }

  const requestPublish = async (group: StudentGroup) => {
    // Công bố một lớp chưa có giáo viên không sai, nhưng cũng không tới được ai: giáo viên chỉ thấy
    // lớp mình được phân công. Cảnh báo mà vẫn cho làm — quản trị viên có thể đang công bố trước rồi
    // phân công sau, và chặn hẳn ở đây là đoán hộ họ.
    const withoutTeacher = group.teachers.length === 0
    const published = await confirm({
      title: withoutTeacher ? 'Công bố lớp chưa có giáo viên?' : 'Công bố lớp',
      message: withoutTeacher
        ? `Lớp “${group.name}” chưa có giáo viên nào phụ trách.`
        : `Lớp “${group.name}” sẽ được công bố cho ${group.teachers.length} giáo viên được phân công.`,
      details: (
        <ConsequenceList
          items={withoutTeacher
            ? [
              'Công bố bây giờ thì lớp vẫn chưa hiện với ai, vì giáo viên chỉ thấy lớp mình được phân công.',
              'Bạn nên phân công giáo viên trong trang quản lý lớp trước.',
            ]
            : [
              `Các giáo viên này thấy lớp và có thể giao bài kiểm tra cho ${group.studentCount} học sinh trong lớp.`,
              'Bạn có thể chuyển lớp về bản nháp sau nếu cần.',
            ]}
        />
      ),
      confirmLabel: withoutTeacher ? 'Vẫn công bố' : 'Công bố',
      cancelLabel: 'Để sau',
      onConfirm: reloadOnFailure(() => publishGroup(group.id)),
    })
    if (!published) return
    toast.success(`Đã công bố lớp ${group.name}. Giáo viên được phân công đã thấy lớp này.`)
    reloadAll()
  }

  const requestUnpublish = async (group: StudentGroup) => {
    const teacherPart =
      group.teachers.length > 0
        ? `${group.teachers.length} giáo viên phụ trách sẽ không còn thấy lớp và không giao được bài mới cho ${group.studentCount} học sinh trong lớp.`
        : 'Lớp chưa có giáo viên phụ trách nên chưa ai mất quyền xem.'
    const unpublished = await confirm({
      title: 'Chuyển lớp về bản nháp',
      message: `Lớp “${group.name}” sẽ trở lại dạng bản nháp.`,
      details: (
        <ConsequenceList
          items={[
            teacherPart,
            'Học sinh trong lớp, bài đã giao và kết quả giữ nguyên.',
            'Bạn có thể công bố lại bất cứ lúc nào.',
          ]}
        />
      ),
      confirmLabel: 'Chuyển về nháp',
      onConfirm: reloadOnFailure(() => unpublishGroup(group.id)),
    })
    if (!unpublished) return
    toast.success(`Đã chuyển lớp ${group.name} về bản nháp. Giáo viên không còn thấy lớp này.`)
    reloadAll()
  }

  const rows = groups ?? []
  const { currentPage, pageItems } = usePagination(rows, PAGE_SIZE, page, setPage, groups !== undefined)
  const { tableRef, wrapperStyle } = useStableTableHeight(pageItems, PAGE_SIZE, rows.length)
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
                onClick={clearAll}
                aria-label="Xoá tìm kiếm"
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
              description={`Không có lớp nào khớp với từ khoá "${trimmedSearch}". Thử từ khoá khác hoặc xoá tìm kiếm để xem toàn bộ lớp.`}
              action={
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <X size={15} /> Xoá tìm kiếm
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
          <TableScroller style={wrapperStyle}>
            {/* Bố cục cố định, nên đổi trang không làm các cột xê dịch. Bốn cột hẹp có bề rộng riêng; cột
                thao tác 320px là vừa đủ cho "Công bố" + "Quản lý" + Sửa + Xoá của một lớp nháp (chia theo
                phần trăm thì ở 1280–1536px nút bị bóp còn 18px và "Công bố" xuống hai dòng). Lớp và giáo
                viên chia đều phần còn lại. */}
            <table ref={tableRef} className="stack-table w-full table-fixed text-sm min-w-[880px] xl:min-w-[1040px]">
              <colgroup>
                <col />
                <col className="w-24" />
                <col />
                <col className="w-32" />
                <col className="w-28 max-xl:hidden" />
                <col className="w-80" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className={`${headerCellClass} text-left`}>Lớp</th>
                  <th className={`${headerCellClass} text-left`}>Sĩ số</th>
                  <th className={`${headerCellClass} text-left`}>Giáo viên phụ trách</th>
                  <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                  <th className={`${headerCellClass} text-left max-xl:hidden`}>Ngày tạo</th>
                  <th className={`${headerCellClass} text-right`}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(group => (
                  <tr
                    key={group.id}
                    onClick={openOnRowClick(() => navigate(groupDetailLink(group.id)))}
                    className="border-b border-slate-50 hover:bg-indigo-100/70 transition-colors cursor-pointer"
                  >
                    <td data-card="head" className="px-5 py-4">
                      <div className="flex items-start gap-2.5 max-w-[420px]">
                        <GroupHealthIndicator group={group} />
                        <div className="min-w-0">
                          <NavLink
                            to={groupDetailLink(group.id)}
                            className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                          >
                            {group.name}
                          </NavLink>
                          <p
                            className="text-xs text-slate-400 mt-0.5 truncate"
                            title={group.description || undefined}
                          >
                            {group.description || 'Chưa có mô tả cho lớp này.'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Sĩ số" className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{group.studentCount}</p>
                      <p className="text-xs text-slate-400 mt-0.5">học sinh</p>
                    </td>
                    <td data-label="Giáo viên phụ trách" className="px-5 py-4">
                      <TeacherCell group={group} />
                    </td>
                    <td data-label="Trạng thái" className="px-5 py-4">
                      <PublishStateBadge isPublished={group.isPublished} />
                    </td>
                    <td data-label="Ngày tạo" className="px-5 py-4 text-slate-500 whitespace-nowrap max-xl:hidden">
                      {formatDate(group.createdAt)}
                    </td>
                    <td data-card="foot" className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        {!group.isPublished && (
                          <button
                            type="button"
                            onClick={() => void requestPublish(group)}
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
                        {group.isPublished && (
                          <button
                            type="button"
                            onClick={() => void requestUnpublish(group)}
                            title="Chuyển lớp về bản nháp"
                            aria-label={`Chuyển lớp ${group.name} về bản nháp`}
                            className={iconButtonClass}
                          >
                            <EyeOff size={15} />
                          </button>
                        )}
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
                          onClick={() => void requestDelete(group)}
                          title="Xoá lớp"
                          aria-label={`Xoá lớp ${group.name}`}
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
          </TableScroller>
        </div>
      )}

      {!showSkeleton && !error && rows.length > 0 && (
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
      )}

      <GroupFormModal
        open={formOpen}
        group={editingGroup}
        onClose={() => setFormOpen(false)}
        onSaved={handleFormSaved}
      />
    </AdminLayout>
  )
}
