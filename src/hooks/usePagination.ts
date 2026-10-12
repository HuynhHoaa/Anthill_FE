import { useEffect, useMemo } from 'react'

/**
 * Phân trang phía client cho danh sách mà server đã trả đủ.
 *
 * Dùng khi cùng một endpoint còn phục vụ những ô chọn cần cả danh sách (lọc theo lớp, chọn lớp để
 * giao bài), nên không thể đổi nó sang trả từng trang. Số trang do nơi gọi giữ (thường trên URL, xem
 * `useUrlListState`), hook chỉ cắt lát và kẹp trang vào khoảng còn hợp lệ: tìm kiếm hay xoá một dòng
 * làm danh sách ngắn lại, và trang đang xem có thể đã vượt quá.
 *
 * Trang đã kẹp được ghi ngược qua `onPageChange`. Nếu chỉ kẹp khi hiển thị thì số cũ vẫn nằm đó, và khi
 * danh sách dài ra lại (lập thêm một lớp) người dùng bị kéo nhảy về đúng trang đó.
 *
 * @param ready false khi dữ liệu chưa về: danh sách còn rỗng nên mọi trang đều "vượt quá", kẹp lúc đó
 *              sẽ xoá mất trang mà liên kết sâu `?trang=3` đang chờ.
 */
export function usePagination<T>(
  items: readonly T[],
  pageSize: number,
  page: number,
  onPageChange: (page: number) => void,
  ready = true,
) {
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = ready ? Math.min(page, lastPage) : page

  useEffect(() => {
    if (ready && page !== currentPage) onPageChange(currentPage)
  }, [ready, page, currentPage, onPageChange])

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  )

  return { currentPage, pageItems }
}

export default usePagination
