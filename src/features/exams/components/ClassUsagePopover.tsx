import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AssignmentWindow } from '../../../types'

interface ClassUsagePopoverProps {
  windows: AssignmentWindow[]
}

const POPOVER_WIDTH = 256
const ROW_HEIGHT = 28
const CHROME_HEIGHT = 56

interface ClassRow {
  name: string
  students: number
}

/**
 * Số lớp đang dùng một đề, bấm vào để xem tên từng lớp và sĩ số.
 *
 * Mỗi lớp đã giao là một khung trong `assignmentWindows`. Học sinh được chọn riêng gom theo giờ và
 * không mang `groupId`, nên không bị tính là lớp: đề chỉ giao như vậy hiện "Riêng" thay vì "0" cạnh
 * một tiến độ nộp khác 0.
 *
 * Là nút chứ không phải `title`: chú thích của trình duyệt không hiện bằng bàn phím hay cảm ứng.
 * Tên lớp cũng nằm trong `aria-label` để trình đọc màn hình đọc được mà không cần mở.
 */
export default function ClassUsagePopover({ windows }: ClassUsagePopoverProps) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const open = anchor !== null

  const classes = new Map<number, ClassRow>()
  let individual = 0
  for (const item of windows) {
    if (item.groupId !== undefined) {
      classes.set(item.groupId, { name: item.groupName ?? 'Lớp', students: item.assignedCount })
    } else {
      individual += item.assignedCount
    }
  }
  const rows = Array.from(classes.values())

  const openPopover = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const height = (rows.length + (individual > 0 && rows.length > 0 ? 1 : 0)) * ROW_HEIGHT + CHROME_HEIGHT
    const openUpward = rect.bottom + height + 16 > window.innerHeight
    const top = openUpward ? rect.top - height - 8 : rect.bottom + 8
    const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 12)

    setAnchor({ top: Math.max(12, top), left: Math.max(12, left) })
  }

  useEffect(() => {
    if (!open) return

    const close = () => setAnchor(null)
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    // Neo theo toạ độ màn hình nên phải đóng khi trang cuộn hoặc đổi cỡ, như menu thao tác của dòng.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // Chưa giao cho ai: không có gì để mở.
  if (rows.length === 0 && individual === 0) {
    return <span className="text-slate-400">0</span>
  }

  const onlyIndividual = rows.length === 0
  const label = onlyIndividual
    ? `Giao riêng cho ${individual} học sinh, bấm để xem`
    : `${rows.length} lớp: ${rows.map(row => row.name).join(', ')}`

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) setAnchor(null)
          else openPopover()
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        className={`rounded-md px-1.5 py-0.5 -mx-1.5 underline decoration-dotted underline-offset-4 transition-colors ${
          onlyIndividual ? 'text-xs text-slate-500' : 'font-semibold text-slate-700'
        } ${open ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
      >
        {onlyIndividual ? 'Riêng' : rows.length}
      </button>

      {anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="group"
            aria-label={onlyIndividual ? 'Giao riêng từng học sinh' : 'Các lớp đang dùng đề này'}
            style={{ top: anchor.top, left: anchor.left, width: POPOVER_WIDTH }}
            className="fixed z-50 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl animate-fade-in"
          >
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {onlyIndividual ? 'Giao riêng từng học sinh' : 'Lớp đang dùng đề này'}
            </p>
            <ul className="space-y-1">
              {rows.map(row => (
                <li key={row.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-slate-700">{row.name}</span>
                  <span className="flex-shrink-0 text-xs text-slate-400">{row.students} em</span>
                </li>
              ))}
              {individual > 0 && (
                <li className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-slate-700">Học sinh chọn riêng</span>
                  <span className="flex-shrink-0 text-xs text-slate-400">{individual} em</span>
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
