import { useMemo, useState } from 'react'
import { normalizeText } from '../lib/format'
import type { StudentGroup } from '../types'
import { usePagination } from './usePagination'

export type ClassSortKey = 'newest' | 'oldest' | 'name'

export const classSortOptions: ReadonlyArray<{ value: ClassSortKey; label: string }> = [
  { value: 'newest', label: 'Mới tạo nhất' },
  { value: 'oldest', label: 'Tạo lâu nhất' },
  { value: 'name', label: 'Tên A → Z' },
]

/** Thời điểm tạo của hai lớp so sánh được bằng chuỗi ISO, nhưng đi qua Date cho chắc khi định dạng lệch nhau. */
function createdTime(group: StudentGroup): number {
  const time = Date.parse(group.createdAt)
  return Number.isNaN(time) ? 0 : time
}

function sortGroups(groups: readonly StudentGroup[], sort: ClassSortKey): StudentGroup[] {
  const sorted = [...groups]
  if (sort === 'name') {
    // numeric: "Lớp 10A2" đứng trước "Lớp 10A10", không phải sau như khi so từng ký tự.
    return sorted.sort((left, right) => left.name.localeCompare(right.name, 'vi', { numeric: true }))
  }
  // Cùng một thời điểm (lớp lập hàng loạt) thì xếp theo mã: lớp lập sau có mã lớn hơn.
  const direction = sort === 'newest' ? -1 : 1
  return sorted.sort((left, right) => direction * (createdTime(left) - createdTime(right) || left.id - right.id))
}

/**
 * Tìm kiếm, sắp xếp và phân trang cho một danh sách lớp chọn để giao bài.
 *
 * Danh sách lớp của một giáo viên có thể dài, nên ô chọn lớp cần cả ba thứ. Lớp đã chọn nằm ở nơi gọi (theo mã lớp),
 * không phụ thuộc trang đang xem hay từ khoá: chuyển trang hay gõ tìm kiếm không làm mất lựa chọn.
 */
export function useClassListView(groups: readonly StudentGroup[], pageSize: number) {
  const [search, setSearchValue] = useState('')
  const [sort, setSortValue] = useState<ClassSortKey>('newest')
  const [page, setPage] = useState(1)

  const visible = useMemo(() => {
    const needle = normalizeText(search.trim())
    const matching = needle === ''
      ? groups
      : groups.filter(group => normalizeText(`${group.name} ${group.description}`).includes(needle))
    return sortGroups(matching, sort)
  }, [groups, search, sort])

  const { currentPage, pageItems } = usePagination(visible, pageSize, page, setPage)

  return {
    search,
    setSearch: (value: string) => {
      setSearchValue(value)
      setPage(1)
    },
    sort,
    setSort: (value: ClassSortKey) => {
      setSortValue(value)
      setPage(1)
    },
    page: currentPage,
    setPage,
    pageItems,
    total: visible.length,
    pageSize,
  }
}

export type ClassListView = ReturnType<typeof useClassListView>
