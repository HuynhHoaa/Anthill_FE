import { useEffect, useState } from 'react'

/**
 * - `checking`: vừa gọi, chưa có kết quả và chưa chậm đáng kể — chưa nói gì với người dùng.
 * - `waking`: quá vài giây vẫn chưa trả lời. Máy chủ miễn phí ngủ sau 15 phút không ai dùng và mất cỡ một phút để dậy.
 * - `ready`: máy chủ đã trả lời.
 * - `unreachable`: gọi hỏng hoặc quá lâu (không tới được máy chủ, hoặc địa chỉ trang này chưa được API cho phép).
 */
export type ApiStatus = 'checking' | 'waking' | 'ready' | 'unreachable'

const WAKING_AFTER_MS = 2500
const GIVE_UP_AFTER_MS = 90_000

/**
 * Hỏi máy chủ đúng một lần khi mở trang đăng nhập để biết nó đang thức hay đang dậy.
 *
 * Dùng `/health/live` chứ không phải `/health`: đường này không chạm database nên không tốn giờ thức của Neon (xem
 * `warmup.ts`, nơi lời gọi `/health` chạm database đã lo việc đánh thức nó). Đọc được phản hồi thì phải gọi có CORS, khác
 * lời gọi `no-cors` ở `warmup.ts`; địa chỉ trang đã nằm trong danh sách origin của API vì đăng nhập cũng cần đúng điều đó.
 *
 * Không có `VITE_API_BASE_URL` (chạy cùng origin với API) thì coi như sẵn sàng, không hỏi gì cả.
 */
export function useApiStatus(): ApiStatus {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  const [status, setStatus] = useState<ApiStatus>(base ? 'checking' : 'ready')

  useEffect(() => {
    if (!base) return

    let cancelled = false
    const controller = new AbortController()
    const wakingTimer = window.setTimeout(() => {
      if (!cancelled) setStatus(current => (current === 'checking' ? 'waking' : current))
    }, WAKING_AFTER_MS)
    const giveUpTimer = window.setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS)

    fetch(`${base}/health/live`, { cache: 'no-store', signal: controller.signal })
      .then(response => {
        if (!cancelled) setStatus(response.ok ? 'ready' : 'unreachable')
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable')
      })
      .finally(() => {
        window.clearTimeout(wakingTimer)
        window.clearTimeout(giveUpTimer)
      })

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(wakingTimer)
      window.clearTimeout(giveUpTimer)
    }
  }, [base])

  return status
}
