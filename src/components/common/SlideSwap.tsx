import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** `forward`: nội dung mới vào từ bên phải, nội dung cũ ra về bên trái. `back`: ngược lại. */
export type SlideDirection = 'forward' | 'back'

interface SlideSwapProps {
  /**
   * Khoá của nội dung đang hiện. Đổi khoá là một lần trượt: nội dung cũ trượt ra, nội dung mới trượt vào.
   * Cùng một khoá mà `children` đổi (ví dụ một nút đổi nhãn) thì chỉ cập nhật tại chỗ, không trượt.
   */
  contentKey: string
  /** Hướng của lần đổi khoá này. Chỉ có tác dụng ở lần render mà `contentKey` đổi. */
  direction: SlideDirection
  children: ReactNode
  /**
   * Phải khớp thời lượng animation `.slide-*` trong stylesheet: lớp nội dung cũ chỉ được gỡ khỏi trang sau
   * chừng đó thời gian, sớm hơn thì nó biến mất giữa chừng, muộn hơn thì nằm chắn phía sau.
   */
  durationMs?: number
  className?: string
}

interface LeavingLayer {
  id: number
  node: ReactNode
  direction: SlideDirection
}

/**
 * Vùng nội dung trượt qua lại khi đổi khoá — như một băng chuyền hai ngăn: ngăn cũ trượt ra đồng thời với
 * ngăn mới trượt vào, nên người dùng thấy nội dung "đổi chỗ" chứ không phải nhấp nháy.
 *
 * Chiều cao do phần tử cha quyết định (component lấp đầy cha và để mỗi ngăn tự cuộn), nên cha phải có chiều
 * cao xác định. Tôn trọng `prefers-reduced-motion`: stylesheet tắt animation, nội dung đổi tức thì.
 */
export default function SlideSwap({
  contentKey, direction, children, durationMs = 340, className = '',
}: SlideSwapProps) {
  const [leaving, setLeaving] = useState<LeavingLayer[]>([])

  // Ảnh chụp nội dung ở lần commit trước: khi khoá đổi, đó chính là thứ cần trượt ra.
  const snapshot = useRef<{ key: string; node: ReactNode }>({ key: contentKey, node: children })
  const hasSwapped = useRef(false)
  const enterDirection = useRef<SlideDirection>(direction)
  const nextId = useRef(0)
  const timers = useRef<number[]>([])

  // Layout effect chứ không phải effect thường: lớp cũ phải có mặt trước khi trình duyệt vẽ khung hình đầu
  // tiên của lần đổi, nếu không có một khung hình trống giữa nội dung cũ và mới (nhìn như nháy).
  // Chạy khi khoá đổi; ảnh chụp nội dung của lần commit trước vẫn còn nguyên ở `snapshot` vì effect cập nhật
  // nó (ngay bên dưới) khai báo sau effect này nên chạy sau.
  useLayoutEffect(() => {
    if (snapshot.current.key === contentKey) return

    hasSwapped.current = true
    enterDirection.current = direction

    const id = nextId.current
    nextId.current += 1
    const leavingNode = snapshot.current.node

    setLeaving(current => [...current, { id, node: leavingNode, direction }])
    timers.current.push(
      window.setTimeout(() => {
        setLeaving(current => current.filter(layer => layer.id !== id))
      }, durationMs),
    )
  }, [contentKey, direction, durationMs])

  // Mỗi lần commit đều chụp lại nội dung đang hiện, để lần đổi khoá kế tiếp biết thứ cần trượt ra.
  useLayoutEffect(() => {
    snapshot.current = { key: contentKey, node: children }
  })

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(timer => window.clearTimeout(timer))
  }, [])

  // Lần render mà khoá vừa đổi: ref `snapshot` vẫn giữ khoá của lần commit trước, nên nhận ra được ngay lúc
  // render (trước khi layout effect chạy) để gắn đúng class vào lần mount đầu tiên của ngăn mới.
  const keyJustChanged = snapshot.current.key !== contentKey
  const incomingDirection = keyJustChanged ? direction : enterDirection.current
  const animateIn = keyJustChanged || hasSwapped.current

  const enterClass = !animateIn
    ? ''
    : incomingDirection === 'forward' ? 'slide-enter-from-right' : 'slide-enter-from-left'

  return (
    <div className={`relative h-full overflow-hidden ${className}`}>
      {leaving.map(layer => (
        <div
          key={`leaving-${layer.id}`}
          aria-hidden="true"
          inert
          className={`absolute inset-0 overflow-hidden pointer-events-none ${
            layer.direction === 'forward' ? 'slide-exit-to-left' : 'slide-exit-to-right'
          }`}
        >
          {layer.node}
        </div>
      ))}

      <div key={contentKey} className={`absolute inset-0 overflow-y-auto ${enterClass}`}>
        {children}
      </div>
    </div>
  )
}
