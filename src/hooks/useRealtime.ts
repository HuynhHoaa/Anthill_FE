import { createContext, useContext, useEffect, useRef } from 'react'
import type { RealtimeBus, RealtimeEventMap, RealtimeEventName, RealtimeStatus } from '../services/realtime'

export interface RealtimeContextValue {
  bus: RealtimeBus
  status: RealtimeStatus
  /** Số thông báo chưa đọc của người đang đăng nhập; 0 khi chưa có phiên hay chưa biết. */
  unreadCount: number
}

/** Đặt giá trị ở `RealtimeProvider`; tách ra đây để file provider chỉ export đúng một component. */
export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

function useRealtimeContext(): RealtimeContextValue {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('Hook realtime phải được dùng bên trong <RealtimeProvider>.')
  }
  return context
}

/** Trạng thái kết nối realtime, để gỡ lỗi hay hiện dải báo. */
export function useRealtimeStatus(): RealtimeStatus {
  return useRealtimeContext().status
}

/**
 * Số thông báo chưa đọc, luôn mới: server đẩy xuống mỗi khi nó đổi. Dùng ở mọi nơi vẽ chuông thay vì
 * tự hỏi `GET /notifications/unread-count` mỗi lần đổi trang.
 */
export function useUnreadCount(): number {
  return useRealtimeContext().unreadCount
}

/** Nghe một sự kiện realtime trong suốt vòng đời của component. */
export function useRealtimeEvent<K extends RealtimeEventName>(
  name: K,
  handler: (payload: RealtimeEventMap[K]) => void,
): void {
  const { bus } = useRealtimeContext()
  // Cùng khuôn với loaderRef trong useAsync: handler là hàm mới ở mỗi lần render, nên chỉ giữ bản mới
  // nhất thay vì huỷ rồi đăng ký lại mỗi lần.
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => bus.on(name, payload => handlerRef.current(payload)), [bus, name])
}

/** Dồn các sự kiện đến liên tiếp thành một lần nạp lại: bốn mươi em nộp bài trong vài giây là một lần, không phải bốn mươi. */
const REFRESH_BATCH_MS = 500

/**
 * Báo cho trang nạp lại dữ liệu khi có sự kiện liên quan, và khi kết nối vừa dựng lại sau một lúc đứt
 * (có thể đã lỡ sự kiện). Truyền `refresh` của `useAsync` — nạp ngầm, không giật, không đụng vào bộ
 * lọc hay trang đang xem.
 *
 * @param events các sự kiện làm dữ liệu của trang cũ đi.
 * @param matches lọc theo nội dung sự kiện, ví dụ chỉ sự kiện của đề đang mở. Bỏ qua = nhận hết.
 */
export function useRealtimeRefresh<K extends RealtimeEventName>(
  events: readonly K[],
  refresh: () => void,
  matches?: (payload: RealtimeEventMap[K]) => boolean,
): void {
  const { bus } = useRealtimeContext()
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const matchesRef = useRef(matches)
  matchesRef.current = matches
  // `events` thường là mảng viết thẳng trong JSX, mới ở mỗi lần render; so theo nội dung.
  const eventsKey = events.join('|')

  useEffect(() => {
    let timer: number | undefined

    const schedule = () => {
      if (timer !== undefined) return
      timer = window.setTimeout(() => {
        timer = undefined
        refreshRef.current()
      }, REFRESH_BATCH_MS)
    }

    const stops = (eventsKey.split('|') as K[]).map(name =>
      bus.on(name, payload => {
        if (matchesRef.current?.(payload) ?? true) schedule()
      }),
    )
    stops.push(bus.onReconnected(schedule))

    return () => {
      window.clearTimeout(timer)
      stops.forEach(stop => stop())
    }
  }, [bus, eventsKey])
}
