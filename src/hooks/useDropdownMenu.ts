import {
  useCallback, useEffect, useId, useRef, useState,
  type FocusEvent, type KeyboardEvent, type MouseEvent,
} from 'react'

/**
 * Hành vi của một menu bật ra từ một nút (menu tài khoản), theo mẫu "menu button" của WAI-ARIA.
 *
 * Rải `containerProps` vào phần tử bọc cả nút lẫn menu, `triggerProps` vào nút, `menuProps` vào phần tử
 * menu; các mục bên trong là `role="menuitem"`. Hook lo:
 * - bấm ra ngoài thì đóng; Tab ra khỏi menu thì đóng;
 * - Escape đóng và trả tiêu điểm về nút, để người dùng bàn phím không bị rơi xuống đầu trang;
 * - mở bằng bàn phím (Enter, Space, mũi tên xuống/lên) thì tiêu điểm vào mục đầu/cuối;
 * - ↑ ↓ Home End chạy giữa các mục (chỉ khai `role="menu"` mà không có phím này là hứa mà không làm).
 *
 * Mục của chính trang đang đứng không đổi đường dẫn nên không tự đóng menu qua router; nơi dùng phải
 * gọi `close(true)` từ `onClick` của từng mục (true: trả tiêu điểm về nút).
 */
export function useDropdownMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  // Mục nào nhận tiêu điểm khi menu vừa mở bằng bàn phím; null khi mở bằng chuột (tiêu điểm ở lại nút).
  const pendingFocusRef = useRef<'first' | 'last' | null>(null)

  const getItems = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    [],
  )

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  // Bấm ra ngoài thì đóng, không cướp tiêu điểm: người dùng vừa chủ động chuyển sang chỗ khác.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // Escape ở bất cứ đâu cũng đóng. Chỉ trả tiêu điểm về nút khi nó đang ở trong menu hoặc chưa có gì
  // được chọn; nếu người dùng đã chuyển tiêu điểm sang chỗ khác thì để yên cho họ.
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const active = document.activeElement
      const focusInside = !active || active === document.body || !!containerRef.current?.contains(active)
      close(focusInside)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  // Mở bằng bàn phím thì đưa tiêu điểm vào menu sau khi nó đã được vẽ.
  useEffect(() => {
    if (!open || pendingFocusRef.current === null) return
    const items = getItems()
    const target = pendingFocusRef.current === 'last' ? items[items.length - 1] : items[0]
    pendingFocusRef.current = null
    target?.focus()
  }, [open, getItems])

  const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Enter và Space trên một nút sinh ra sự kiện click có `detail` bằng 0; chuột thật thì từ 1 trở lên.
    if (!open && event.detail === 0) pendingFocusRef.current = 'first'
    setOpen(current => !current)
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (open) {
      const items = getItems()
      ;(event.key === 'ArrowUp' ? items[items.length - 1] : items[0])?.focus()
      return
    }
    pendingFocusRef.current = event.key === 'ArrowUp' ? 'last' : 'first'
    setOpen(true)
  }

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const items = getItems()
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        items[(index + 1) % items.length].focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        items[(index - 1 + items.length) % items.length].focus()
        break
      case 'Home':
        event.preventDefault()
        items[0].focus()
        break
      case 'End':
        event.preventDefault()
        items[items.length - 1].focus()
        break
      default:
    }
  }

  // Tab đi ra khỏi cả khối thì đóng. `relatedTarget` rỗng (bấm vào chỗ không focus được trong menu) bỏ qua:
  // bấm ra ngoài thật đã có listener mousedown lo.
  const handleContainerBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && !event.currentTarget.contains(next)) setOpen(false)
  }

  return {
    open,
    close,
    containerProps: { ref: containerRef, onBlur: handleContainerBlur },
    triggerProps: {
      ref: triggerRef,
      onClick: handleTriggerClick,
      onKeyDown: handleTriggerKeyDown,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
    },
    menuProps: { ref: menuRef, id: menuId, role: 'menu' as const, onKeyDown: handleMenuKeyDown },
  }
}

export default useDropdownMenu
