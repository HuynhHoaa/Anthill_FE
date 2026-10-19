/**
 * Danh sách lớp của QUẢN TRỊ VIÊN — chỉ để xem và lập lớp mới.
 *
 * Sửa, công bố và xoá lớp không nằm ở đây: muốn thay đổi một lớp thì vào phần quản lý của lớp (bấm vào dòng hay nút
 * "Quản lý") rồi làm ở đó, để một cú bấm nhầm trên danh sách không xoá hay công bố nhầm cả một lớp.
 *
 * Lớp thuộc về tổ chức chứ không thuộc về giáo viên nào. Mô hình cũ để mỗi giáo viên tự tạo lớp của mình, và vì mỗi
 * học sinh chỉ thuộc đúng một lớp, hai giáo viên cùng dạy một em sẽ giành nhau em đó: người thêm sau kéo em ra khỏi
 * lớp của người trước, kéo theo mọi bài đã giao ở đó.
 */
import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Plus, Search, Settings2, UsersRound, X } from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { LockedStateBadge, PublishStateBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import SearchField from '../../../components/common/SearchField'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import { useAsync } from '../../../hooks/useAsync'
import { usePagination } from '../../../hooks/usePagination'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { useUrlListState } from '../../../hooks/useUrlListState'
import { formatDate } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { listGroups } from '../../../services/groupService'
import type { StudentGroup } from '../../../types'
import ImportExcelButton from '../../imports/components/ImportExcelButton'
import GroupFormModal from '../components/GroupFormModal'
import GroupHealthIndicator from '../components/GroupHealthIndicator'
import { TeacherAvatar } from '../components/TeacherAvatar'
import { getGroupIssues } from '../components/groupHealth'

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }
const headerCellClass = 'px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500'
const selectClass =
  'px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'

// Mười hai dòng ~56px (tên lớp và mô tả một dòng) cùng thanh trang vừa một cửa sổ cao ~900px sau khi công cụ đã lên thanh
// tiêu đề. Đổi cỡ trang hay độ cao dòng thì đo lại bằng cửa sổ 1440x900.
const PAGE_SIZE = 12

type StatusFilter = 'all' | 'published' | 'draft' | 'locked'
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'published', label: 'Đã công bố' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'locked', label: 'Đã khoá' },
]

const groupDetailLink = (groupId: number) => `/quan-tri/nhom-lop/${groupId}`

/** Ô "giáo viên phụ trách": chưa có ai là tin đáng chú ý, không phải một ô trống. Mỗi lớp có một giáo viên. */
function TeacherCell({ group }: { group: StudentGroup }) {
  const teacher = group.teachers[0]

  if (!teacher) {
    return (
      <span
        title="Lớp chưa có giáo viên nào phụ trách nên bài kiểm tra không tới được học sinh trong lớp."
        className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg"
      >
        Chưa phân công
      </span>
    )
  }

  const extra = group.teachers.length - 1

  return (
    <div className="flex items-center gap-2" title={group.teachers.map(item => item.fullName).join(', ')}>
      <TeacherAvatar teacher={teacher} size={28} />
      <span className="text-sm text-slate-600 truncate max-w-[160px]">{teacher.fullName}</span>
      {teacher.status === 'locked' && (
        <span title="Tài khoản giáo viên đang bị khoá" className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
          Khoá
        </span>
      )}
      {extra > 0 && <span className="text-xs text-slate-400">+{extra}</span>}
    </div>
  )
}

export default function AdminGroupListPage() {
  const navigate = useNavigate()
  // Từ khoá, bộ lọc và số trang nằm trên URL: Back từ trang chi tiết một lớp về đúng chỗ đang xem.
  const { searchInput, setSearchInput, search, filters, setFilter, page, setPage, clearAll } = useUrlListState({
    'trang-thai': { default: 'all', allowed: statusOptions.map(option => option.value) },
  })
  const status = filters['trang-thai'] as StatusFilter
  const trimmedSearch = search.trim()
  const isFiltering = trimmedSearch.length > 0 || status !== 'all'

  const { data: groups, loading, error, reload } = useAsync(
    () => listGroups(trimmedSearch),
    [trimmedSearch],
  )

  // Phụ đề phải mô tả toàn bộ dữ liệu nên dùng truy vấn riêng không kèm từ khoá,
  // tránh cảnh gõ tìm kiếm là tổng học sinh tụt theo kết quả lọc.
  const { data: allGroups, reload: reloadSummary } = useAsync(() => listGroups(), [])

  const [formOpen, setFormOpen] = useState(false)

  const summaryText = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return undefined

    const totalStudents = allGroups.reduce((sum, group) => sum + group.studentCount, 0)
    const draftCount = allGroups.filter(group => !group.isPublished).length
    const lockedCount = allGroups.filter(group => group.isLocked).length
    const needsAttentionCount = allGroups.filter(group => getGroupIssues(group).length > 0).length

    // Hai con số cuối chỉ hiện khi khác 0: "0 bản nháp" không nói với ai điều gì, nó chỉ làm dòng
    // phụ đề dài thêm và đẩy hai con số thật ra xa mắt.
    const parts = [`${allGroups.length} lớp`, `${totalStudents} học sinh`]
    if (draftCount > 0) parts.push(`${draftCount} bản nháp`)
    if (lockedCount > 0) parts.push(`${lockedCount} đã khoá`)
    if (needsAttentionCount > 0) parts.push(`${needsAttentionCount} lớp cần chú ý`)
    return parts.join(' · ')
  }, [allGroups])

  const handleFormSaved = () => {
    setFormOpen(false)
    // Xoá bộ lọc sau khi tạo để lớp vừa lập chắc chắn nằm trong danh sách
    if (isFiltering) clearAll()
    reload()
    reloadSummary()
  }

  // Trạng thái công bố lọc ở client: danh sách lớp vốn đã về đủ, và hai giá trị này không đáng một lần gọi mạng.
  const rows = useMemo(
    () =>
      (groups ?? []).filter(group =>
        status === 'all'
          ? true
          : status === 'published'
            ? group.isPublished
            : status === 'locked'
              ? group.isLocked
              : !group.isPublished,
      ),
    [groups, status],
  )
  const { currentPage, pageItems } = usePagination(rows, PAGE_SIZE, page, setPage, groups !== undefined)
  const { tableRef, wrapperStyle } = useStableTableHeight(pageItems, PAGE_SIZE, rows.length)
  const showSkeleton = loading && groups === undefined
  const isRefreshing = loading && groups !== undefined

  // Công cụ nằm trên thanh tiêu đề (từ cỡ lg), thay cho một thẻ riêng phía trên bảng.
  const tools = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
      <div className="flex-1 min-w-[12rem] max-w-xs">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Tìm theo tên hoặc mô tả lớp"
          label="Tìm kiếm lớp"
        />
      </div>

      <select
        value={status}
        onChange={event => setFilter('trang-thai', event.target.value)}
        aria-label="Lọc theo trạng thái công bố"
        className={selectClass}
      >
        {statusOptions.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <ImportExcelButton
        kind="school"
        onImported={() => {
          reload()
          reloadSummary()
        }}
      />

      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
        style={primaryButtonStyle}
      >
        <Plus size={16} /> Lập lớp mới
      </button>
    </div>
  )

  return (
    <AdminLayout
      pageTitle="Nhóm lớp"
      pageSubtitle={
        summaryText
          ? `${summaryText}${isFiltering && groups ? ` · ${rows.length} lớp khớp bộ lọc` : ''}`
          : 'Lập lớp, xếp học sinh và phân công giáo viên phụ trách'
      }
      compactContent
      headerTools={tools}
    >
      {showSkeleton ? (
        <SkeletonTable rows={8} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <>
          {isFiltering ? (
            <EmptyState
              icon={Search}
              title="Không tìm thấy lớp phù hợp"
              description="Không có lớp nào khớp với từ khoá và bộ lọc hiện tại. Thử từ khoá khác hoặc xoá bộ lọc để xem toàn bộ lớp."
              action={
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <X size={15} /> Xoá bộ lọc
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
                  onClick={() => setFormOpen(true)}
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
            {/* Bố cục cố định, nên đổi trang không làm các cột xê dịch. Bốn cột hẹp có bề rộng riêng; lớp và giáo
                viên chia đều phần còn lại. */}
            <table ref={tableRef} className="stack-table w-full table-fixed text-sm min-w-[820px] xl:min-w-[960px]">
              <colgroup>
                <col />
                <col className="w-24" />
                <col />
                <col className="w-32" />
                <col className="w-28 max-xl:hidden" />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className={`${headerCellClass} text-left`}>Lớp</th>
                  <th className={`${headerCellClass} text-left`}>Sĩ số</th>
                  <th className={`${headerCellClass} text-left`}>Giáo viên phụ trách</th>
                  <th className={`${headerCellClass} text-left`}>Trạng thái</th>
                  <th className={`${headerCellClass} text-left max-xl:hidden`}>Ngày tạo</th>
                  <th className={`${headerCellClass} text-right`}>Quản lý</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(group => (
                  <tr
                    key={group.id}
                    onClick={openOnRowClick(() => navigate(groupDetailLink(group.id)))}
                    className="border-b border-slate-50 hover:bg-indigo-100/70 transition-colors cursor-pointer"
                  >
                    <td data-card="head" className="px-5 py-2">
                      <div className="flex items-start gap-2.5 max-w-[420px]">
                        <GroupHealthIndicator group={group} />
                        <div className="min-w-0">
                          <NavLink
                            to={groupDetailLink(group.id)}
                            className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                          >
                            {group.name}
                          </NavLink>
                          {group.termName && (
                            <span className="ml-2 align-middle text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 whitespace-nowrap">
                              {group.termName}
                            </span>
                          )}
                          <p
                            className="text-xs text-slate-400 mt-0.5 truncate"
                            title={group.description || undefined}
                          >
                            {group.description || 'Chưa có mô tả cho lớp này.'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Sĩ số" className="px-5 py-2 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{group.studentCount}</span>{' '}
                      <span className="text-xs text-slate-400">học sinh</span>
                    </td>
                    <td data-label="Giáo viên phụ trách" className="px-5 py-2">
                      <TeacherCell group={group} />
                    </td>
                    <td data-label="Trạng thái" className="px-5 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PublishStateBadge isPublished={group.isPublished} />
                        {group.isLocked && <LockedStateBadge />}
                      </div>
                    </td>
                    <td data-label="Ngày tạo" className="px-5 py-2 text-slate-500 whitespace-nowrap max-xl:hidden">
                      {formatDate(group.createdAt)}
                    </td>
                    <td data-card="foot" className="px-5 py-2">
                      <div className="flex items-center justify-end">
                        <NavLink
                          to={groupDetailLink(group.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                        >
                          <Settings2 size={14} /> Quản lý
                        </NavLink>
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

      <GroupFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={handleFormSaved} />
    </AdminLayout>
  )
}
