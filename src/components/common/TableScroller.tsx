import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface TableScrollerProps {
  children: ReactNode
  /** Thường là `wrapperStyle` của `useStableTableHeight`. */
  style?: CSSProperties
}

/**
 * Khung cuộn ngang của một bảng nhiều cột.
 *
 * Bảng có bề rộng tối thiểu để các cột chữ không bị bóp nát, nên ở cửa sổ hẹp nó rộng hơn khung và
 * phải cuộn ngang. Cột cuối (thao tác) được CSS cho dính vào mép phải (`.table-scroller` trong
 * index.css), vì nút nằm ngoài màn hình mà không có gợi ý cuộn thì người dùng coi như không có nút.
 * Component này chỉ báo cho CSS biết khi nào còn nội dung bị cột đó che, để vẽ bóng ở mép trái của nó.
 */
export default function TableScroller({ children, style }: TableScrollerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasHiddenContent, setHasHiddenContent] = useState(false)

  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return
    setHasHiddenContent(element.scrollLeft + element.clientWidth < element.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    measure()
    // Khung đổi cỡ (cửa sổ) và bảng đổi cỡ (nội dung xuống dòng, đổi trang) đều làm đổi kết quả.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [measure])

  return (
    <div
      ref={ref}
      onScroll={measure}
      style={style}
      data-overflow-right={hasHiddenContent}
      className="table-scroller overflow-x-auto"
    >
      {children}
    </div>
  )
}
