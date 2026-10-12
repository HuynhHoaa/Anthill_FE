/**
 * Danh sách lớp của GIÁO VIÊN — bản chỉ đọc.
 *
 * Lớp do quản trị viên lập và phân công, nên ở đây không có tạo, sửa, xoá hay xếp học sinh. Danh
 * sách trả về đã được server giới hạn trong những lớp giáo viên này được phân công **và** đã công
 * bố; màn hình không lọc lại lần nữa.
 */
import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Eye, Search, UsersRound, X } from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import SearchField from '../../../components/common/SearchField'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { usePagination } from '../../../hooks/usePagination'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { formatDate } from '../../../lib/format'
import { listGroups } from '../../../services/groupService'

const headerCellClass = 'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'

// Mười hai dòng 55px (tên + mô tả một dòng) cùng thanh trang vừa một cửa sổ cao ~900px, sau khi đã bỏ
// thẻ tìm kiếm. Đổi cỡ trang hay độ cao dòng thì đo lại bằng cửa sổ 1440x900.
const PAGE_SIZE = 12

export default function TeacherGroupListPage() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const trimmedSearch = debouncedSearch.trim()
  const hasSearch = trimmedSearch.length > 0

  const { data: groups, loading, error, reload } = useAsync(
    () => listGroups(trimmedSearch),
    [trimmedSearch],
  )

  // Phụ đề phải mô tả toàn bộ dữ liệu nên dùng truy vấn riêng không kèm từ khoá,
  // tránh cảnh gõ tìm kiếm là tổng học sinh tụt theo kết quả lọc.
  const { data: allGroups } = useAsync(() => listGroups(), [])

  const summaryText = useMemo(() => {
    if (!allGroups || allGroups.length === 0) return undefined
    const totalStudents = allGroups.reduce((sum, group) => sum + group.studentCount, 0)
    return `${allGroups.length} lớp được phân công · ${totalStudents} học sinh`
  }, [allGroups])

  const rows = groups ?? []
  const { currentPage, pageItems, setPage } = usePagination(rows, PAGE_SIZE)
  const { tableRef, wrapperStyle } = useStableTableHeight(pageItems, PAGE_SIZE, rows.length)
  const showSkeleton = loading && groups === undefined
  const isRefreshing = loading && groups !== undefined

  return (
    <TeacherLayout
      pageTitle="Nhóm lớp"
      pageSubtitle={summaryText ?? 'Những lớp bạn được phân công phụ trách'}
      compactContent
      headerTools={
        <div className="w-full max-w-sm">
          <SearchField
            value={searchInput}
            onChange={value => {
              setSearchInput(value)
              setPage(1)
            }}
            placeholder="Tìm theo tên hoặc mô tả lớp"
            label="Tìm kiếm lớp"
          />
        </div>
      }
    >
      {showSkeleton ? (
        <SkeletonTable rows={5} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <>
          {hasSearch ? (
            <EmptyState
              icon={Search}
              title="Không tìm thấy lớp phù hợp"
              description={`Không có lớp nào khớp với từ khoá "${trimmedSearch}". Thử từ khoá khác hoặc xoá tìm kiếm để xem toàn bộ lớp của bạn.`}
              action={
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <X size={15} /> Xoá tìm kiếm
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={UsersRound}
              title="Bạn chưa được phân công lớp nào"
              description="Lớp học do quản trị viên lập, xếp học sinh rồi phân công giáo viên phụ trách. Hãy liên hệ quản trị viên để được phân công lớp."
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
            {/* Bố cục cố định: độ rộng cột chia theo tỉ lệ cố định, không còn phụ thuộc chữ dài nhất của trang đang xem, nên đổi
                trang không làm các cột xê dịch. */}
            <table ref={tableRef} className="w-full table-fixed text-sm min-w-[600px]">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className={`${headerCellClass} text-left`}>Lớp</th>
                  <th className={`${headerCellClass} text-left`}>Sĩ số</th>
                  <th className={`${headerCellClass} text-left`}>Ngày tạo</th>
                  <th className={`${headerCellClass} text-right`}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(group => (
                  <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-2">
                      <div className="max-w-[420px] min-w-0">
                        <NavLink
                          to={`/giao-vien/nhom-lop/${group.id}`}
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
                    </td>
                    <td className="px-5 py-2">
                      {group.studentCount > 0 ? (
                        <p className="text-slate-800">
                          <span className="font-semibold">{group.studentCount}</span>{' '}
                          <span className="text-xs text-slate-400">học sinh</span>
                        </p>
                      ) : (
                        /* Lớp rỗng thì giáo viên giao bài cũng không tới ai — nói thẳng thay vì
                           hiện số 0 để họ tự đoán. Xếp học sinh là việc của quản trị viên. */
                        <p className="text-xs text-slate-400" title="Quản trị viên chưa xếp học sinh vào lớp này">
                          Chưa có học sinh
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-2 text-slate-500 whitespace-nowrap">
                      {formatDate(group.createdAt)}
                    </td>
                    <td className="px-5 py-2">
                      <div className="flex items-center justify-end">
                        <NavLink
                          to={`/giao-vien/nhom-lop/${group.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Eye size={14} /> Xem lớp
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
    </TeacherLayout>
  )
}
