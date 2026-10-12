import { useCallback, useLayoutEffect, useState } from 'react'

/**
 * Giữ chiều cao của bảng phân trang không đổi giữa các trang.
 *
 * Trang cuối thường ít dòng hơn, và khi bảng ngắn lại thì thanh chuyển trang bị kéo lên theo: người
 * đang bấm "trang sau" thấy nút nhảy khỏi chỗ vừa bấm. Hook đo chiều cao bảng mỗi lần nó hiện đủ một
 * trang, rồi đặt làm chiều cao tối thiểu cho những trang ngắn hơn.
 *
 * Đo chứ không tính từ số dòng nhân chiều cao dòng, vì chiều cao dòng phụ thuộc phông, độ rộng cột
 * và nội dung xuống dòng. Chỉ áp khi còn thanh chuyển trang: một danh sách một trang thì không có
 * nút nào để giữ yên, và chừa chỗ trống chỉ làm nó trông thừa.
 *
 * Số đo được làm mới khi bảng đổi cỡ (nới cửa sổ, phông nạp muộn, cột xuống dòng khác đi) và khi
 * bảng vừa mới hiện ra, ví dụ trang đang ở dạng thẻ ở bề hẹp rồi mới nới sang dạng bảng. Vì thế
 * `tableRef` là callback ref chứ không phải ref thường: gắn vào `<table ref={tableRef}>` như bình thường.
 *
 * @param pageItems các dòng đang hiện ở trang này.
 * @param pageSize   số dòng của một trang đầy.
 * @param total      tổng số dòng của cả danh sách.
 */
export function useStableTableHeight(pageItems: readonly unknown[], pageSize: number, total: number) {
  const [table, setTable] = useState<HTMLTableElement | null>(null)
  const [fullHeight, setFullHeight] = useState<number | undefined>(undefined)

  const tableRef = useCallback((element: HTMLTableElement | null) => setTable(element), [])

  const isFullPage = pageItems.length === pageSize
  const hasPager = total > pageSize

  // Chạy lại mỗi khi tập dòng đang hiện đổi (sang trang khác, tải lại dữ liệu) để số đo luôn là của một
  // trang đầy vừa vẽ xong, không phải số cũ.
  useLayoutEffect(() => {
    if (!table || !isFullPage) return

    const measure = () => setFullHeight(table.offsetHeight)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(table)
    return () => observer.disconnect()
  }, [table, isFullPage, pageItems])

  return {
    tableRef,
    wrapperStyle: hasPager && fullHeight ? { minHeight: fullHeight } : undefined,
  }
}

export default useStableTableHeight
