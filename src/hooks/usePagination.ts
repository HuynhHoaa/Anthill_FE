import { useMemo, useState } from 'react'

/**
 * Phân trang phía client cho danh sách mà server đã trả đủ.
 *
 * Dùng khi cùng một endpoint còn phục vụ những ô chọn cần cả danh sách (lọc theo lớp, chọn lớp để
 * giao bài), nên không thể đổi nó sang trả từng trang. Trang hiện tại luôn bị kẹp vào khoảng còn hợp
 * lệ: tìm kiếm hay xoá một dòng làm danh sách ngắn lại, và trang đang xem có thể đã vượt quá.
 */
export function usePagination<T>(items: readonly T[], pageSize: number) {
  const [page, setPage] = useState(1)

  const lastPage = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, lastPage)

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  )

  return { currentPage, pageItems, setPage }
}

export default usePagination
