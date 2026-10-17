import SearchField from '../../../components/common/SearchField'
import Pagination from '../../../components/common/Pagination'
import { classSortOptions, type ClassListView, type ClassSortKey } from '../../../hooks/useClassListView'

interface ClassPickerToolbarProps {
  view: ClassListView
  /** Số lớp đang được chọn trong cả danh sách (kể cả lớp ở trang khác hay đang bị lọc ẩn). */
  selectedCount: number
}

/** Ô tìm kiếm, chọn thứ tự và số lớp đã chọn, đứng trên danh sách lớp chọn để giao bài. */
export function ClassPickerToolbar({ view, selectedCount }: ClassPickerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-4">
      <div className="flex-1 min-w-[12rem] max-w-sm">
        <SearchField
          value={view.search}
          onChange={view.setSearch}
          placeholder="Tìm theo tên hoặc mô tả lớp"
          label="Tìm lớp"
        />
      </div>

      <select
        value={view.sort}
        onChange={event => view.setSort(event.target.value as ClassSortKey)}
        aria-label="Sắp xếp danh sách lớp"
        className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
      >
        {classSortOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <p className="ml-auto text-sm text-slate-500">
        {selectedCount > 0 ? (
          <>
            Đã chọn <strong className="text-indigo-600 font-semibold">{selectedCount}</strong> lớp
          </>
        ) : (
          `${view.total} lớp`
        )}
      </p>
    </div>
  )
}

/** Dòng báo khi từ khoá không khớp lớp nào. */
export function ClassPickerEmpty({ view }: { view: ClassListView }) {
  if (view.total > 0) return null

  return (
    <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      Không có lớp nào khớp "{view.search.trim()}".{' '}
      <button
        type="button"
        onClick={() => view.setSearch('')}
        className="font-semibold text-indigo-600 hover:underline"
      >
        Xoá tìm kiếm
      </button>
    </p>
  )
}

/** Thanh trang của danh sách lớp; chỉ hiện khi có nhiều hơn một trang. */
export function ClassPickerPagination({ view }: { view: ClassListView }) {
  return <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} />
}
