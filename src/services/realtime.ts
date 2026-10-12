/**
 * Kết nối realtime tới hub `/hubs/notifications` của backend (§7) — kênh duy nhất để server đẩy sự
 * kiện xuống trình duyệt. Chỉ dùng SignalR; không phần nào khác của app biết tới thư viện này.
 *
 * Ba điều quyết định hình dạng của file:
 * - Hub tự xếp mỗi kết nối vào group riêng của người dùng, và giáo viên nhận `ExamSubmitted` ở group
 *   đó rồi. Nên client **không gọi phương thức hub nào** — không `JoinExamGroup` (vào cả hai nơi là
 *   nhận mỗi sự kiện hai lần), và cũng không có gì phải vào lại sau khi nối lại.
 * - Token đi qua query `access_token` (trình duyệt không cho đặt header khi mở WebSocket). Hub từ chối
 *   token của phiên bị thu hồi bằng 401 và cắt các kết nối đang mở của tài khoản đó, nhưng thư viện
 *   giấu mã 401 trong một chuỗi lỗi. Vì vậy client không tự phán đoán: mỗi lần đứt hay không mở được,
 *   nó hỏi lại một endpoint REST qua `checkSession`, và để `apiClient` xử lý 401 như mọi request khác
 *   (xoá phiên, về trang đăng nhập kèm đúng lý do của server).
 * - Không dùng `withAutomaticReconnect`: nó không thử lại khi lần mở **đầu tiên** hỏng, và không cho
 *   chen một bước kiểm phiên vào giữa các lần thử. Một vòng lặp tự viết lo cả hai việc.
 */
import { HttpTransportType, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { getApiUrl, getStoredToken } from '../lib/apiClient'

const HUB_PATH = '/hubs/notifications'

// ===== Hợp đồng sự kiện =====
// Khớp `Anthill.Application/Interfaces/Realtime/IRealtimeNotificationService.cs`; SignalR gửi JSON
// camelCase, thời điểm là chuỗi ISO 8601 (UTC).

/** Học sinh: được giao bài. Chỉ bắn khi giáo viên bật `notify`. */
export interface ExamAssignedEvent {
  examId: number
  assignmentId: number
  examTitle: string
  teacherName: string
  durationMinutes: number
  /** Giờ mở/đóng CÓ HIỆU LỰC của chính em nhận sự kiện (lịch riêng của lớp nếu có). */
  openAt: string
  closeAt: string
}

/** Học sinh: giáo viên đổi lịch hoặc thời lượng của một bài đã giao. */
export interface ExamUpdatedEvent {
  examId: number
  assignmentId: number
  examTitle: string
  durationMinutes: number
  openAt: string
  closeAt: string
}

/** Giáo viên: có học sinh vừa nộp bài. `submittedCount` là số bài đã nộp của đề sau lần nộp này. */
export interface ExamSubmittedEvent {
  examId: number
  attemptId: number
  studentId: number
  studentName: string
  examTitle: string
  score: number
  maxScore: number
  submittedAt: string
  submittedCount: number
}

/** Học sinh: bài của chính mình bị hệ thống nộp vì hết giờ. `score` null khi đề chưa cho xem điểm. */
export interface AutoSubmittedStudentEvent {
  examId: number
  attemptId: number
  examTitle: string
  submittedAt: string
  score?: number | null
}

/** Giáo viên: một học sinh bị tự nộp vì hết giờ. Cùng hình dạng với `ExamSubmittedEvent`. */
export type AutoSubmittedTeacherEvent = ExamSubmittedEvent

/**
 * Bài sắp đóng. Học sinh chưa nộp nhận một sự kiện về bài của mình; giáo viên cũng nhận **mỗi em một
 * sự kiện** nhưng không kèm tên em nào và không có bản ghi thông báo — chỉ để bảng theo dõi biết mà
 * làm tươi.
 */
export interface DeadlineSoonEvent {
  examId: number
  assignmentId: number
  examTitle: string
  closeAt: string
  minutesRemaining: number
}

/** Mọi vai trò: số thông báo chưa đọc vừa đổi. Thay cho việc hỏi `GET /notifications/unread-count`. */
export interface UnreadCountChangedEvent {
  unreadCount: number
}

export interface RealtimeEventMap {
  ExamAssigned: ExamAssignedEvent
  ExamUpdated: ExamUpdatedEvent
  ExamSubmitted: ExamSubmittedEvent
  /** Hai vai trò nhận hai payload khác nhau; giáo viên có `studentName`, học sinh thì không. */
  AutoSubmitted: AutoSubmittedStudentEvent | AutoSubmittedTeacherEvent
  DeadlineSoon: DeadlineSoonEvent
  UnreadCountChanged: UnreadCountChangedEvent
}

export type RealtimeEventName = keyof RealtimeEventMap

const eventNames: RealtimeEventName[] = [
  'ExamAssigned',
  'ExamUpdated',
  'ExamSubmitted',
  'AutoSubmitted',
  'DeadlineSoon',
  'UnreadCountChanged',
]

// ===== Bus sự kiện =====

type Listener = (payload: unknown) => void

/**
 * Nơi các trang đăng ký nghe sự kiện. Sống lâu hơn từng kết nối: nối lại hay đổi người đăng nhập thì
 * kết nối mới đẩy vào cùng một bus, trang không phải đăng ký lại.
 */
export interface RealtimeBus {
  on: <K extends RealtimeEventName>(name: K, listener: (payload: RealtimeEventMap[K]) => void) => () => void
  /** Kết nối vừa được dựng lại SAU KHI đã mất — trong lúc đứt có thể đã lỡ sự kiện, trang nên nạp lại dữ liệu. */
  onReconnected: (listener: () => void) => () => void
  emit: <K extends RealtimeEventName>(name: K, payload: RealtimeEventMap[K]) => void
  emitReconnected: () => void
}

const RECONNECTED = 'reconnected'

export function createRealtimeBus(): RealtimeBus {
  const listeners = new Map<string, Set<Listener>>()

  const subscribe = (key: string, listener: Listener) => {
    const bucket = listeners.get(key) ?? new Set<Listener>()
    bucket.add(listener)
    listeners.set(key, bucket)
    return () => {
      bucket.delete(listener)
    }
  }

  const dispatch = (key: string, payload: unknown) => {
    // Chép ra mảng: một listener tự huỷ đăng ký giữa chừng không được làm lỡ listener đứng sau.
    for (const listener of [...(listeners.get(key) ?? [])]) {
      try {
        listener(payload)
      } catch (caught) {
        // Một trang lỗi không được chặn các trang khác, càng không được làm chết kết nối.
        console.error(`Lỗi khi xử lý sự kiện realtime "${key}".`, caught)
      }
    }
  }

  return {
    on: (name, listener) => subscribe(name, listener as Listener),
    onReconnected: listener => subscribe(RECONNECTED, listener),
    emit: (name, payload) => dispatch(name, payload),
    emitReconnected: () => dispatch(RECONNECTED, undefined),
  }
}

// ===== Kết nối =====

/**
 * - `idle`: chưa có phiên hoặc đã đóng.
 * - `connecting`: lần mở đầu tiên đang chạy.
 * - `connected`: đang nhận sự kiện.
 * - `reconnecting`: đã đứt (hoặc lần mở đầu hỏng) và đang thử lại.
 */
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

export interface RealtimeClientOptions {
  bus: RealtimeBus
  onStatusChange: (status: RealtimeStatus) => void
  /**
   * Chạy mỗi lần kết nối đứt hay không mở được, trước lần thử kế tiếp. Phải tự nuốt lỗi mạng; việc nó
   * làm — một request REST có token — là để 401 (phiên bị thu hồi) kịp đi qua `apiClient`.
   */
  checkSession: () => Promise<void>
}

export interface RealtimeClient {
  /** Mở kết nối và giữ nó sống tới khi `stop`. Gọi lần hai là vô hại. */
  start: () => void
  /** Đóng hẳn, không thử lại nữa. Gọi lúc chưa `start` cũng được. */
  stop: () => Promise<void>
}

/**
 * Kết nối phải sống ít nhất chừng này mới được coi là ổn định và đưa quãng chờ về 0. Server nhận bắt tay
 * rồi cắt ngay (proxy, hay một lệnh đóng ở phía hub) mà quãng chờ cứ về 0 sau mỗi lần mở thì thành vòng
 * lặp bận, mỗi vòng một request kiểm phiên.
 */
const STABLE_AFTER_MS = 10_000

/** Chờ giữa hai lần thử: lần đầu thử ngay, rồi giãn dần tới trần 30 giây và ở đó mãi mãi. */
const RETRY_DELAYS_MS = [0, 1_000, 2_000, 5_000, 10_000, 20_000, 30_000]

function retryDelay(attempt: number): number {
  const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
  // Lệch ngẫu nhiên ±20%: API khởi động lại thì mọi trình duyệt đang chờ không đồng loạt gõ cửa cùng lúc.
  return base === 0 ? 0 : Math.round(base * (0.8 + Math.random() * 0.4))
}

/**
 * Dựng một kết nối gắn với token **hiện tại**. Đổi người đăng nhập thì bỏ client này, dựng client mới
 * — nên không có chuyện một kết nối của người này nhận sự kiện của người kia.
 *
 * Không dùng class: `erasableSyntaxOnly` cấm tham số khai báo trong constructor, và một closure đủ cho
 * trạng thái nhỏ thế này.
 */
export function createRealtimeClient({ bus, onStatusChange, checkSession }: RealtimeClientOptions): RealtimeClient {
  const token = getStoredToken()

  let started = false
  let stopped = false
  let everConnected = false
  // Hai hàm đánh thức vòng lặp: một khi kết nối đóng, một khi đang chờ giữa hai lần thử.
  let resolveClosed: (() => void) | null = null
  let wakeUp: (() => void) | null = null

  const connection = new HubConnectionBuilder()
    .withUrl(getApiUrl(HUB_PATH), {
      // Đọc lại token ở mỗi lần thư viện cần (negotiate, từng lượt long polling) thay vì chốt một giá trị.
      accessTokenFactory: () => getStoredToken() ?? '',
      // Ưu tiên WebSocket, rơi về long polling khi mạng chặn. Bỏ Server-Sent Events: nó chỉ chen
      // vào giữa hai thứ trên mà chẳng thêm khả năng nào.
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
    })
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.None)
    .build()

  /** Còn đúng phiên đã dựng ra client này: chưa `stop`, và token chưa bị đổi hay xoá. */
  const isCurrent = () => !stopped && getStoredToken() === token

  const setStatus = (status: RealtimeStatus) => {
    // Client cũ đã `stop` không được ghi đè trạng thái của client thay thế nó.
    if (isCurrent()) onStatusChange(status)
  }

  eventNames.forEach(name => {
    connection.on(name, payload => {
      if (isCurrent()) bus.emit(name, payload)
    })
  })

  connection.onclose(() => resolveClosed?.())

  const wait = (milliseconds: number) =>
    new Promise<void>(resolve => {
      const done = () => {
        window.clearTimeout(timer)
        wakeUp = null
        resolve()
      }
      const timer = window.setTimeout(done, milliseconds)
      wakeUp = done
    })

  const run = async () => {
    let attempt = 0

    while (isCurrent()) {
      try {
        await connection.start()
        if (!isCurrent()) return

        const connectedAt = Date.now()
        const afterLoss = everConnected
        everConnected = true
        setStatus('connected')
        if (afterLoss) bus.emitReconnected()

        await new Promise<void>(resolve => {
          resolveClosed = resolve
        })
        resolveClosed = null

        // Sống đủ lâu thì lần mất này là chuyện mới, thử lại ngay; còn không thì giữ quãng chờ đang tăng.
        if (Date.now() - connectedAt >= STABLE_AFTER_MS) attempt = 0
      } catch {
        // Không mở được (mất mạng, API đang khởi động, token bị từ chối): rơi xuống nhánh chờ bên dưới.
      }

      if (!isCurrent()) return
      setStatus('reconnecting')

      // Phiên bị thu hồi thì server cắt kết nối rồi từ chối negotiate bằng 401. Hỏi REST để biết chắc;
      // nếu đúng vậy, `apiClient` xoá token và `isCurrent()` ngay sau đây trả về false.
      await checkSession()
      if (!isCurrent()) return

      await wait(retryDelay(attempt))
      attempt += 1
    }
  }

  // Có mạng lại thì thử ngay, không đợi hết quãng chờ (có thể đang ở mức 30 giây).
  const handleOnline = () => wakeUp?.()

  return {
    start: () => {
      if (started) return
      started = true
      window.addEventListener('online', handleOnline)
      onStatusChange('connecting')
      void run()
    },
    stop: async () => {
      if (stopped) return
      stopped = true
      window.removeEventListener('online', handleOnline)
      wakeUp?.()
      resolveClosed?.()
      try {
        await connection.stop()
      } catch {
        // Đóng một kết nối đang dở dang có thể ném; dù sao nó cũng đã đóng.
      }
    },
  }
}
