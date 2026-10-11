import { useLayoutEffect, useRef, useState } from 'react'

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
 * @param pageItems các dòng đang hiện ở trang này.
 * @param pageSize   số dòng của một trang đầy.
 * @param total      tổng số dòng của cả danh sách.
 */
export function useStableTableHeight(pageItems: readonly unknown[], pageSize: number, total: number) {
  const tableRef = useRef<HTMLTableElement>(null)
  const [fullHeight, setFullHeight] = useState<number | undefined>(undefined)

  const isFullPage = pageItems.length === pageSize
  const hasPager = total > pageSize

  // Chạy lại mỗi khi tập dòng đang hiện đổi (sang trang khác, tải lại dữ liệu) để số đo luôn là của một
  // trang đầy vừa vẽ xong, không phải số cũ.
  useLayoutEffect(() => {
    if (isFullPage && tableRef.current) {
      setFullHeight(tableRef.current.offsetHeight)
    }
  }, [isFullPage, pageItems])

  return {
    tableRef,
    wrapperStyle: hasPager && fullHeight ? { minHeight: fullHeight } : undefined,
  }
}

export default useStableTableHeight
