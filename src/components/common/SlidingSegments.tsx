import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'

interface SlidingSegmentsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Khoá của mục đang chọn; đổi khoá thì vạch nền trượt sang mục mới. */
  activeKey: string
  /** Các nút. Nút đang chọn phải mang `data-tab-active="true"` và đặt `relative z-10` để chữ nằm trên vạch nền. */
  children: ReactNode
  /** Lớp bo góc của vạch nền, mặc định bo như nút tab (`rounded-xl`). */
  indicatorClassName?: string
}

/**
 * Thanh tab / nút chọn kiểu viên thuốc có **vạch nền trượt**: mục đang chọn không đổi nền tức thì mà vạch trắng trượt từ mục cũ
 * sang mục mới. Đo vị trí bằng `offsetLeft`/`offsetWidth` của nút mang `data-tab-active`, đo lại khi khung đổi cỡ (đổi
 * cỡ chữ, thu hẹp cửa sổ, nhãn tab đổi độ dài).
 *
 * Lần vẽ đầu đặt vạch nền ngay tại chỗ (không có chuyển động từ vị trí 0); chỉ các lần đổi tab sau đó mới trượt.
 */
export default function SlidingSegments({
  activeKey, children, className = '', indicatorClassName = 'rounded-xl', ...rest
}: SlidingSegmentsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; width: number; height: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const active = container.querySelector<HTMLElement>('[data-tab-active="true"]')
      if (!active) return
      setBox(current => {
        const next = { left: active.offsetLeft, width: active.offsetWidth, top: active.offsetTop, height: active.offsetHeight }
        return current && current.left === next.left && current.width === next.width
          && current.top === next.top && current.height === next.height ? current : next
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [activeKey, children])

  return (
    <div ref={containerRef} className={`relative ${className}`} {...rest}>
      {box && (
        <span
          aria-hidden="true"
          className={`absolute bg-white shadow-sm transition-[left,width,top,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${indicatorClassName}`}
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      )}
      {children}
    </div>
  )
}
