import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import ConnectionBanner from '../components/common/ConnectionBanner'
import { useToast } from '../components/common/Toast'
import { RealtimeContext, type RealtimeContextValue } from '../hooks/useRealtime'
import { getStoredToken, subscribeToken } from '../lib/apiClient'
import { getCurrentUser } from '../services/authService'
import { getUnreadCount } from '../services/notificationService'
import {
  createRealtimeBus,
  createRealtimeClient,
  type AutoSubmittedStudentEvent,
  type AutoSubmittedTeacherEvent,
  type RealtimeStatus,
} from '../services/realtime'

/** Mất kết nối ngắn (đổi mạng, API khởi động lại) không đáng báo; chỉ hiện dải khi đứt quá chừng này. */
const BANNER_DELAY_MS = 4_000

/** Các lần nộp bài đến liên tiếp trong chừng này gộp thành một toast. */
const SUBMIT_TOAST_BATCH_MS = 1_500

/** Đang ở màn hình làm bài thì không chen toast hay dải nào vào giữa buổi thi. */
function isExamTakingPath(pathname: string): boolean {
  return pathname.endsWith('/lam-bai')
}

function isTeacherAutoSubmit(
  payload: AutoSubmittedStudentEvent | AutoSubmittedTeacherEvent,
): payload is AutoSubmittedTeacherEvent {
  return 'studentName' in payload
}

/**
 * Giữ một kết nối realtime cho cả phiên đăng nhập và đưa nó cho mọi trang qua các hook trong
 * `hooks/useRealtime`.
 *
 * Kết nối gắn với **token**, không gắn với trang: đăng nhập thì mở, đăng xuất hay bị thu hồi phiên thì
 * đóng, đổi người đăng nhập thì dựng lại. Vì vậy phải nằm trong `BrowserRouter` và `ToastProvider` nhưng
 * ngoài từng trang.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const location = useLocation()
  const token = useSyncExternalStore(subscribeToken, getStoredToken, () => null)

  const bus = useMemo(() => createRealtimeBus(), [])
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [unreadCount, setUnreadCount] = useState(0)
  const [slowReconnect, setSlowReconnect] = useState(false)

  // Đọc trong các hàm xử lý sự kiện mà không phải huỷ rồi đăng ký lại mỗi lần đổi trang.
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname
  const toastRef = useRef(toast)
  toastRef.current = toast

  // ----- Mở và đóng kết nối theo token -----
  useEffect(() => {
    if (!token) {
      setStatus('idle')
      setUnreadCount(0)
      return
    }

    let cancelled = false
    let stop: (() => Promise<void>) | undefined

    const refreshUnread = () =>
      getUnreadCount()
        .then(count => {
          if (!cancelled) setUnreadCount(count)
        })
        .catch(() => {
          // Mất mạng hay 401 đã được apiClient xử lý; chuông giữ số cũ cho tới lần sau.
        })

    // StrictMode chạy effect hai lần liền nhau ở môi trường dev: lùi một nhịp để lần chạy bị huỷ ngay
    // sau đó không kịp mở một kết nối rồi đóng nó, thứ làm server ghi một lượt negotiate lỗi.
    const startTimer = window.setTimeout(() => {
      const client = createRealtimeClient({
        bus,
        onStatusChange: setStatus,
        // Hỏi lại số chưa đọc mỗi lần đứt: một request có token để 401 (phiên bị thu hồi) đi qua
        // apiClient, và nhân tiện chuông được cập nhật nếu trong lúc đứt đã lỡ sự kiện.
        checkSession: async () => {
          await refreshUnread()
        },
      })
      stop = client.stop
      client.start()
      void refreshUnread()
    }, 0)

    const offCount = bus.on('UnreadCountChanged', event => setUnreadCount(event.unreadCount))
    const offReconnected = bus.onReconnected(() => void refreshUnread())

    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
      offCount()
      offReconnected()
      void stop?.()
    }
  }, [token, bus])

  // ----- Dải "đang kết nối lại" -----
  useEffect(() => {
    if (status !== 'reconnecting') {
      setSlowReconnect(false)
      return
    }

    const timer = window.setTimeout(() => setSlowReconnect(true), BANNER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [status])

  // ----- Toast theo sự kiện và vai trò -----
  useEffect(() => {
    if (!token) return

    const role = getCurrentUser()?.role
    const say = (message: string) => {
      if (isExamTakingPath(pathnameRef.current)) return
      toastRef.current.info(message)
    }

    let submitTimer: number | undefined
    let submitCount = 0
    let lastSubmit: { studentName: string; examTitle: string } | null = null

    const flushSubmits = () => {
      submitTimer = undefined
      if (submitCount === 1 && lastSubmit) {
        say(`${lastSubmit.studentName} vừa nộp bài "${lastSubmit.examTitle}".`)
      } else if (submitCount > 1) {
        say(`${submitCount} học sinh vừa nộp bài.`)
      }
      submitCount = 0
      lastSubmit = null
    }

    const queueSubmit = (studentName: string, examTitle: string) => {
      submitCount += 1
      lastSubmit = { studentName, examTitle }
      if (submitTimer === undefined) {
        submitTimer = window.setTimeout(flushSubmits, SUBMIT_TOAST_BATCH_MS)
      }
    }

    const stops: Array<() => void> = []

    if (role === 'student') {
      stops.push(
        bus.on('ExamAssigned', event => say(`Bạn có bài kiểm tra mới: ${event.examTitle}.`)),
        bus.on('ExamUpdated', event => say(`Bài "${event.examTitle}" vừa được đổi giờ.`)),
        bus.on('DeadlineSoon', event =>
          say(`Bài "${event.examTitle}" còn ${event.minutesRemaining} phút nữa là đóng.`),
        ),
        bus.on('AutoSubmitted', event => say(`Bài "${event.examTitle}" đã hết giờ và được nộp.`)),
      )
    }

    if (role === 'teacher') {
      stops.push(
        bus.on('ExamSubmitted', event => queueSubmit(event.studentName, event.examTitle)),
        bus.on('AutoSubmitted', event => {
          if (isTeacherAutoSubmit(event)) {
            say(`${event.studentName} hết giờ, bài "${event.examTitle}" đã được nộp.`)
          }
        }),
      )
    }

    return () => {
      window.clearTimeout(submitTimer)
      stops.forEach(stop => stop())
    }
  }, [token, bus])

  const value = useMemo<RealtimeContextValue>(
    () => ({ bus, status, unreadCount }),
    [bus, status, unreadCount],
  )

  const showBanner = slowReconnect && !isExamTakingPath(location.pathname)

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      {showBanner && <ConnectionBanner />}
    </RealtimeContext.Provider>
  )
}
