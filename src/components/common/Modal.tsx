import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  /** Biểu tượng nhỏ đặt trong ô màu cạnh tiêu đề — dùng cho hộp là một "công cụ" (Soạn tự động...), không cần cho hộp xác nhận. */
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Thân hộp không đệm và không tự cuộn: nội dung tự chia vùng cuộn của nó (hộp hai cột, danh sách bên trái
   * và phần xem bên phải cuộn riêng). Nội dung phải tự giữ một chiều cao xác định.
   */
  flush?: boolean
  /**
   * `false` khi hộp đang giữ thứ duy nhất không lấy lại được — ví dụ mật khẩu vừa cấp. Khi đó ESC,
   * bấm ra ngoài và nút X đều không đóng hộp; chỉ nút trong phần chân hộp mới đóng được, để một cú
   * chạm trượt trên điện thoại không làm mất thứ người dùng chưa kịp chép.
   */
  dismissible?: boolean
  /**
   * `false` bỏ nút X ở góc hộp (Esc và bấm ra ngoài vẫn đóng được khi `dismissible`). Dùng cho hộp đã có nút Huỷ ở chân:
   * hai lối đóng cùng một việc là thừa.
   */
  showCloseButton?: boolean
}

const panelWidthClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({
  open,
  title,
  description,
  icon,
  onClose,
  children,
  footer,
  size = 'md',
  flush = false,
  dismissible = true,
  showCloseButton = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Khoá cuộn nền suốt thời gian modal mở
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Đưa tiêu điểm vào hộp khi mở. Để yên thì tiêu điểm vẫn nằm trên nút đã mở hộp phía sau lớp phủ,
  // và người dùng bàn phím bấm Enter để đóng hộp lại bấm trúng nút đó lần nữa — với hộp mật khẩu
  // là cấp thêm một mật khẩu mới. Chờ một nhịp vì hộp xác nhận vừa đóng cũng trả tiêu điểm về nút
  // cũ bằng một nhịp như vậy; ô nhập đã tự nhận tiêu điểm thì giữ nguyên. Đóng hộp thì trả về chỗ cũ.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const timer = window.setTimeout(() => {
      const panel = panelRef.current
      if (panel && !panel.contains(document.activeElement)) panel.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dismissible) onClose()
        return
      }
      if (event.key !== 'Tab') return

      // Giữ Tab quanh quẩn trong hộp. Không có vòng này thì Tab vài lần là tiêu điểm lọt ra các nút
      // phía sau lớp phủ — người dùng bàn phím bấm Enter lúc đó là bấm một nút họ không nhìn thấy.
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      // Tiêu điểm đang ở chính khung hộp (vừa mở): Shift+Tab mặc định sẽ nhảy ra sau lớp phủ.
      if (active === panel) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      const outside = !(active instanceof Node) || !panel.contains(active)
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, dismissible])

  if (!open) return null

  // Vẽ thẳng vào <body> chứ không vẽ tại chỗ: một tổ tiên có `transform`, `filter` hay hoạt ảnh làm `fixed` chỉ phủ vừa khung của
  // tổ tiên đó (hộp bị nhốt trong một thẻ, tràn ra ngoài) và làm `z-50` chỉ có nghĩa trong khối đó, nên thẻ nằm sau trong trang
  // đè lên hộp — nhất là trên điện thoại, nơi các cột xếp chồng nhau.
  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onMouseDown={event => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${panelWidthClass[size]} max-h-[90vh] flex flex-col bg-white rounded-3xl border border-slate-100 shadow-xl animate-modal-in outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0 flex items-start gap-3">
            {icon && (
              <span
                aria-hidden="true"
                className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800">{title}</h2>
              {description && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>}
            </div>
          </div>
          {dismissible && showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className={flush ? 'overflow-hidden' : 'px-6 py-5 overflow-y-auto'}>{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
