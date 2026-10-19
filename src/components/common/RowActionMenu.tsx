import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { MoreVertical, type LucideIcon } from 'lucide-react'

export interface RowMenuItem {
  key: string
  label: string
  icon: LucideIcon
  /** Có thì mục là một liên kết. */
  to?: string
  /** Có thì mục là một nút; menu đóng lại trước khi gọi. */
  onSelect?: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
  /**
   * Vì sao mục bị mờ, in nhỏ ngay dưới nhãn. Một nút mờ mà không nói lý do là một câu hỏi bỏ lửng: người quản trị phải
   * tự đoán vì sao không bấm được.
   */
  disabledHint?: string
}

interface RowActionMenuProps {
  /** Tên đối tượng của dòng, dùng cho nhãn đọc màn hình của nút ⋮. */
  label: string
  items: RowMenuItem[]
}

const MENU_WIDTH = 264
const ITEM_HEIGHT = 44
const HINT_EXTRA_HEIGHT = 34
const VERTICAL_PADDING = 12

const itemBase = 'w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors'
const itemTone = {
  default: 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600',
  danger: 'text-red-500 hover:bg-red-50',
}
const itemDisabled = 'text-slate-300 cursor-not-allowed'

function estimateHeight(items: RowMenuItem[]): number {
  return (
    VERTICAL_PADDING
    + items.reduce((sum, item) => sum + ITEM_HEIGHT + (item.disabled && item.disabledHint ? HINT_EXTRA_HEIGHT : 0), 0)
  )
}

/**
 * Menu ⋮ của một dòng bảng. Bảng nằm trong vùng cuộn ngang nên menu được dựng ngoài body và neo theo toạ độ màn
 * hình, nếu không sẽ bị cắt; gần đáy màn hình thì lật lên trên. Đóng khi bấm ra ngoài, Esc, cuộn hay đổi cỡ cửa sổ.
 *
 * Nút ⋮ nằm trong dòng bấm được, nên nhớ rằng cú bấm vào nó không mở dòng (`openOnRowClick` bỏ qua nút), còn cú bấm
 * vào khoảng trống của menu (dựng ngoài body nhưng React vẫn nổi sự kiện qua portal) bị chặn ở đây.
 */
export default function RowActionMenu({ label, items }: RowActionMenuProps) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Mở bằng bàn phím thì tiêu điểm vào mục đầu (hoặc cuối) ngay khi menu được vẽ; mở bằng chuột thì tiêu điểm ở lại nút.
  const pendingFocusRef = useRef<'first' | 'last' | null>(null)
  const open = anchor !== null

  const focusableItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])

  const closeMenu = (restoreFocus = false) => {
    setAnchor(null)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const openMenu = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuHeight = estimateHeight(items)
    const openUpward = rect.bottom + menuHeight + 16 > window.innerHeight
    const top = openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8
    const left = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 12)

    setAnchor({ top: Math.max(12, top), left: Math.max(12, left) })
  }

  useEffect(() => {
    if (!open) return

    const close = () => setAnchor(null)
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close()
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Tiêu điểm đang trong menu thì trả về nút ⋮, để người dùng bàn phím không rơi xuống đầu trang.
      const insideMenu = !!menuRef.current?.contains(document.activeElement)
      close()
      if (insideMenu) triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // Menu vừa mở bằng bàn phím: đưa tiêu điểm vào mục đầu/cuối sau khi nó đã được vẽ.
  useEffect(() => {
    if (!open || pendingFocusRef.current === null) return
    const items = focusableItems()
    const target = pendingFocusRef.current === 'last' ? items[items.length - 1] : items[0]
    pendingFocusRef.current = null
    target?.focus()
  }, [open])

  const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (open) {
      closeMenu()
      return
    }
    // Enter và Space trên một nút sinh ra click có `detail` bằng 0; chuột thật thì từ 1 trở lên.
    if (event.detail === 0) pendingFocusRef.current = 'first'
    openMenu()
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (open) {
      const items = focusableItems()
      ;(event.key === 'ArrowUp' ? items[items.length - 1] : items[0])?.focus()
      return
    }
    pendingFocusRef.current = event.key === 'ArrowUp' ? 'last' : 'first'
    openMenu()
  }

  // ↑ ↓ Home End chạy giữa các mục; Tab rời menu thì đóng lại (menu nằm cuối body nên Tab tiếp sẽ rơi khỏi hàng).
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = focusableItems()
    const index = items.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (items.length === 0) return
      const next =
        event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (index + 1) % items.length
        : (index <= 0 ? items.length - 1 : index - 1)
      items[next]?.focus()
      return
    }

    if (event.key === 'Tab') closeMenu(true)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Thao tác khác cho ${label}`}
        title="Thao tác khác"
        className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${
          open
            ? 'border-slate-300 bg-slate-100 text-slate-700'
            : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
        }`}
      >
        <MoreVertical size={15} />
      </button>

      {anchor &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={handleMenuKeyDown}
            onClick={event => event.stopPropagation()}
            style={{ top: anchor.top, left: anchor.left, width: MENU_WIDTH }}
            className="fixed z-40 bg-white rounded-2xl border border-slate-100 shadow-lg p-1.5 animate-fade-in"
          >
            {items.map(item => {
              const Icon = item.icon
              const content = (
                <>
                  <Icon size={15} className="flex-shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block">{item.label}</span>
                    {item.disabled && item.disabledHint && (
                      <span className="block mt-0.5 text-xs font-normal leading-snug text-slate-400">
                        {item.disabledHint}
                      </span>
                    )}
                  </span>
                </>
              )

              if (item.to && !item.disabled) {
                return (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    role="menuitem"
                    onClick={() => setAnchor(null)}
                    className={`${itemBase} ${itemTone[item.tone ?? 'default']}`}
                  >
                    {content}
                  </NavLink>
                )
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  title={item.disabled ? item.disabledHint : undefined}
                  onClick={() => {
                    setAnchor(null)
                    item.onSelect?.()
                  }}
                  className={`${itemBase} ${item.disabled ? itemDisabled : itemTone[item.tone ?? 'default']}`}
                >
                  {content}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
