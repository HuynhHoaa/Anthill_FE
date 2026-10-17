import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'

const POPOVER_WIDTH = 288
const GAP = 8
const EDGE = 12

interface InfoTipProps {
  /** Nội dung giải thích. */
  children: ReactNode
  /** Dòng tiêu đề đậm của khung giải thích (không bắt buộc). */
  title?: string
  /** Tên nút cho trình đọc màn hình, ví dụ "Giải thích về chương". */
  label?: string
}

/**
 * Dấu chấm than nhỏ đặt ngay đuôi một tiêu đề; bấm vào thì mở khung giải thích. Phần giải thích dài không nên bày sẵn trên
 * trang (làm biểu mẫu rối và chiếm chỗ) mà vẫn phải đọc được khi cần — kể cả bằng bàn phím hay cảm ứng, thứ mà `title` của
 * trình duyệt không làm được.
 *
 * Khung vẽ qua portal nên không bị cắt bởi hộp cuộn hay hộp thoại chứa nó; mở xuống dưới, hết chỗ thì mở lên trên. Đóng bằng
 * bấm ra ngoài, bấm lại nút, hoặc Esc — và Esc chỉ đóng khung này, không đóng hộp thoại đang chứa nó.
 */
export default function InfoTip({ children, title, label = 'Xem giải thích' }: InfoTipProps) {
  const [anchor, setAnchor] = useState<{ top: number; left: number; upward: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const open = anchor !== null

  const toggle = () => {
    if (open) {
      setAnchor(null)
      return
    }
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - POPOVER_WIDTH / 2), window.innerWidth - POPOVER_WIDTH - EDGE)
    // Chưa biết chiều cao thật nên đo sau khi vẽ (xem effect bên dưới); tạm đặt phía dưới.
    setAnchor({ top: rect.bottom + GAP, left, upward: false })
  }

  // Đo chiều cao thật rồi lật lên trên nếu phía dưới không đủ chỗ.
  useEffect(() => {
    const popover = popoverRef.current
    const trigger = triggerRef.current
    if (!anchor || !popover || !trigger) return

    const rect = trigger.getBoundingClientRect()
    const height = popover.offsetHeight
    const fitsBelow = rect.bottom + GAP + height + EDGE <= window.innerHeight
    const upward = !fitsBelow && rect.top - GAP - height >= EDGE
    if (upward !== anchor.upward) {
      setAnchor({ ...anchor, upward, top: upward ? rect.top - GAP - height : rect.bottom + GAP })
    }
  }, [anchor])

  useEffect(() => {
    if (!open) return

    const close = () => setAnchor(null)
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      close()
    }
    // Pha bắt (capture) trên window để đóng khung trước khi hộp thoại bên dưới kịp xử lý Esc của nó.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      close()
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    // Khung neo theo vị trí lúc mở: cuộn hay đổi cỡ cửa sổ thì đóng thay vì để nó trôi lạc khỏi dấu chấm than.
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full align-middle transition-colors motion-reduce:transition-none ${
          open ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
        }`}
      >
        <AlertCircle size={15} />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          id={id}
          role="tooltip"
          className="fixed z-[60] rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xl animate-modal-in"
          style={{ top: anchor?.top, left: anchor?.left, width: POPOVER_WIDTH }}
        >
          {title && <p className="mb-1 text-sm font-bold text-slate-800">{title}</p>}
          <div className="text-xs font-normal leading-relaxed text-slate-600 space-y-1.5">{children}</div>
        </div>,
        document.body,
      )}
    </>
  )
}
