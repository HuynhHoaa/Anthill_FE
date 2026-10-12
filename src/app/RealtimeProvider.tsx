import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import ConnectionBanner from '../components/common/ConnectionBanner'
import { useToast } from '../components/common/Toast'
import { RealtimeContext, type RealtimeContextValue } from '../hooks/useRealtime'
import { getStoredToken, subscribeToken } from '../lib/apiClient'
import { getCurrentUser, getMustChangePassword } from '../services/authService'
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

/** Sau một sự kiện nộp bài, hỏi lại số chưa đọc khi sóng sự kiện đã lắng chừng này. */
const UNREAD_RESYNC_DELAY_MS = 1_000

/** Các lần nộp bài đến liên tiếp trong chừng này gộp thành một toast. */
const SUBMIT_TOAST_BATCH_MS = 1_500

/** Đang ở màn hình làm bài thì không chen toast hay dải nào vào giữa buổi thi. */
function isExamTakingPath(pathname: string): boolean {
  return pathname.endsWith('/lam-bai')
}

/** Tên học sinh trong sự kiện có thể rỗng (học sinh đã bị ẩn danh hoá), nên luôn có chữ để đọc. */
function studentLabel(name: string | null | undefined): string {
  return name?.trim() || 'Một học sinh'
}

/**
 * Gom các sự kiện đến liền nhau thành một toast. Cả lớp nộp bài hay hết giờ cùng lúc là bốn mươi sự kiện
 * trong vài giây; bốn mươi toast chồng nhau thì tràn khỏi màn hình và không ai đọc nổi cái nào.
 */
function createToastBatch(
  say: (message: string) => void,
  describeOne: (studentName: string, examTitle: string) => string,
  describeMany: (count: number) => string,
) {
  let timer: number | undefined
  let count = 0
  let last: { studentName: string; examTitle: string } | null = null

  const flush = () => {
    timer = undefined
    if (count === 1 && last) {
      say(describeOne(last.studentName, last.examTitle))
    } else if (count > 1) {
      say(describeMany(count))
    }
    count = 0
    last = null
  }

  return {
    push: (studentName: string, examTitle: string) => {
      count += 1
      last = { studentName, examTitle }
      if (timer === undefined) timer = window.setTimeout(flush, SUBMIT_TOAST_BATCH_MS)
    },
    cancel: () => window.clearTimeout(timer),
  }
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
    // Tài khoản còn phải đổi mật khẩu chưa dùng được gì, và đổi xong thì token cũ bị thu hồi, phải đăng
    // nhập lại (token mới, effect chạy lại). Chưa cần mở kết nối.
    if (!token || getMustChangePassword()) {
      setStatus('idle')
      setUnreadCount(0)
      return
    }

    let cancelled = false
    let stop: (() => Promise<void>) | undefined
    // Mỗi lần server đẩy số mới thì tăng. Một GET bắt đầu trước đó mà về sau không được ghi đè số mới hơn.
    let pushVersion = 0

    const refreshUnread = () => {
      const versionAtStart = pushVersion
      return getUnreadCount()
        .then(count => {
          if (!cancelled && pushVersion === versionAtStart) setUnreadCount(count)
        })
        .catch(() => {
          // Mất mạng hay 401 đã được apiClient xử lý; chuông giữ số cũ cho tới lần sau.
        })
    }

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

    const offCount = bus.on('UnreadCountChanged', event => {
      pushVersion += 1
      setUnreadCount(event.unreadCount)
    })
    const offReconnected = bus.onReconnected(() => void refreshUnread())

    // Số chưa đọc đi xuống như một giá trị tuyệt đối. Cả lớp nộp bài cùng giây thì các lần đẩy có thể tới
    // lệch thứ tự, và lần tới sau cùng chưa chắc là lần đếm sau cùng. Một lần hỏi lại sau khi dồn sóng đã
    // lắng cho số đúng, với giá một request.
    let resyncTimer: number | undefined
    const scheduleResync = () => {
      window.clearTimeout(resyncTimer)
      resyncTimer = window.setTimeout(() => void refreshUnread(), UNREAD_RESYNC_DELAY_MS)
    }
    const offSubmitted = bus.on('ExamSubmitted', scheduleResync)
    const offAutoSubmitted = bus.on('AutoSubmitted', scheduleResync)

    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
      window.clearTimeout(resyncTimer)
      offCount()
      offReconnected()
      offSubmitted()
      offAutoSubmitted()
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

    // Vai trò đọc lúc có sự kiện chứ không lúc effect chạy: hồ sơ được ghi ngay sau token trong cùng
    // lần đăng nhập, nên đọc muộn là cách không phụ thuộc vào thứ tự đó.
    const currentRole = () => getCurrentUser()?.role
    const say = (message: string) => {
      if (isExamTakingPath(pathnameRef.current)) return
      toastRef.current.info(message)
    }

    const submits = createToastBatch(
      say,
      (studentName, examTitle) => `${studentName} vừa nộp bài "${examTitle}".`,
      count => `${count} học sinh vừa nộp bài.`,
    )
    const timeouts = createToastBatch(
      say,
      (studentName, examTitle) => `${studentName} hết giờ, bài "${examTitle}" đã được nộp.`,
      count => `${count} học sinh hết giờ, bài đã được nộp.`,
    )

    const stops = [
      bus.on('ExamAssigned', event => {
        if (currentRole() === 'student') say(`Bạn có bài kiểm tra mới: ${event.examTitle}.`)
      }),
      bus.on('ExamUpdated', event => {
        // Đổi lịch hay đổi thời lượng đều tới đây, nên câu không nói rõ là đổi cái nào.
        if (currentRole() === 'student') say(`Bài "${event.examTitle}" vừa đổi thời gian.`)
      }),
      bus.on('DeadlineSoon', event => {
        // Giáo viên cũng nhận sự kiện này (mỗi em một cái, không kèm tên), chỉ để làm tươi, không toast.
        if (currentRole() === 'student') {
          say(`Bài "${event.examTitle}" còn ${event.minutesRemaining} phút nữa là đóng.`)
        }
      }),
      bus.on('ExamSubmitted', event => {
        if (currentRole() === 'teacher') submits.push(studentLabel(event.studentName), event.examTitle)
      }),
      bus.on('AutoSubmitted', event => {
        const role = currentRole()
        if (role === 'student') {
          say(`Bài "${event.examTitle}" đã hết giờ và được nộp.`)
        } else if (role === 'teacher' && isTeacherAutoSubmit(event)) {
          timeouts.push(studentLabel(event.studentName), event.examTitle)
        }
      }),
    ]

    return () => {
      submits.cancel()
      timeouts.cancel()
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
