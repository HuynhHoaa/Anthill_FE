import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Bell, BellOff, CheckCheck, CheckCircle2, ChevronRight,
  Clock, Edit3, FileText, Inbox, Sparkles, type LucideIcon,
} from 'lucide-react'
import ErrorBoundary from '../../../components/common/ErrorBoundary'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import StudentLayout from '../../../components/layout/StudentLayout'
import AdminLayout from '../../../components/layout/AdminLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useRealtimeRefresh } from '../../../hooks/useRealtime'
import { listNotifications, markAllAsRead, markAsRead } from '../../../services/notificationService'
import { formatDateTime, formatRelativeTime, parseDateTime } from '../../../lib/format'
import { notificationTypeLabels, type AppNotification, type NotificationType, type UserRole } from '../../../types'

type FilterKey = 'all' | 'unread'
type DayGroupKey = 'today' | 'yesterday' | 'older'

interface NotificationVisual {
  icon: LucideIcon
  iconClass: string
  bgClass: string
}

const notificationVisuals: Record<NotificationType, NotificationVisual> = {
  examAssigned: { icon: FileText, iconClass: 'text-indigo-600', bgClass: 'bg-indigo-50' },
  examSubmitted: { icon: CheckCircle2, iconClass: 'text-emerald-600', bgClass: 'bg-emerald-50' },
  examUpdated: { icon: Edit3, iconClass: 'text-blue-600', bgClass: 'bg-blue-50' },
  deadlineSoon: { icon: AlertTriangle, iconClass: 'text-amber-600', bgClass: 'bg-amber-50' },
  autoSubmitted: { icon: Clock, iconClass: 'text-red-500', bgClass: 'bg-red-50' },
}

/**
 * Dùng khi `notification.type` không khớp mục nào ở trên. `notificationService.toNotification` đã
 * chặn phần lớn trường hợp này từ cửa vào, nhưng bảng tra ở đây vẫn tự đứng vững một mình — một type
 * lọt qua (hoặc bảng trên thiếu một khoá sau này) chỉ hiện một biểu tượng chung, không kéo sập trang.
 */
const fallbackVisual: NotificationVisual = { icon: Sparkles, iconClass: 'text-slate-500', bgClass: 'bg-slate-100' }
const fallbackLabel = 'Thông báo'

const filterTabs: { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: 'Tất cả', icon: Inbox },
  { key: 'unread', label: 'Chưa đọc', icon: Bell },
]

const dayGroupOrder: DayGroupKey[] = ['today', 'yesterday', 'older']

const dayGroupLabels: Record<DayGroupKey, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  older: 'Cũ hơn',
}

const emptyStateDescriptions: Record<UserRole, string> = {
  teacher: 'Khi học sinh nộp bài hoặc bài kiểm tra sắp đóng, hệ thống sẽ báo cho bạn tại đây.',
  student: 'Khi giáo viên giao bài hoặc bài kiểm tra sắp hết hạn, bạn sẽ nhận được thông báo tại đây.',
  admin: 'Khi có tài khoản học sinh mới được tạo hoặc bị khoá, hệ thống sẽ báo cho bạn tại đây.',
}

const MILLISECONDS_PER_DAY = 86400000

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

/** Xếp một thông báo vào nhóm ngày dựa trên số ngày lịch cách hôm nay. */
function getDayGroup(createdAt: string): DayGroupKey {
  const parsed = parseDateTime(createdAt)
  if (!parsed) return 'older'

  const dayDistance = Math.round((startOfDay(new Date()) - startOfDay(parsed)) / MILLISECONDS_PER_DAY)
  if (dayDistance <= 0) return 'today'
  if (dayDistance === 1) return 'yesterday'
  return 'older'
}

interface NotificationRowProps {
  notification: AppNotification
  processing: boolean
  onOpen: (notification: AppNotification) => void
}

function NotificationRow({ notification, processing, onOpen }: NotificationRowProps) {
  // ?? chứ không index thẳng: notification.type gõ tĩnh là NotificationType nên TypeScript tin bảng
  // tra luôn đủ khoá, nhưng dữ liệu thật tới từ mạng — không gì đảm bảo runtime khớp compile-time.
  const visual = notificationVisuals[notification.type] ?? fallbackVisual
  const Icon = visual.icon
  // Chỉ những mục có thể dẫn đi đâu đó hoặc còn chưa đọc mới bấm được, tránh nút bấm không phản hồi.
  const isInteractive = Boolean(notification.link) || !notification.isRead

  const rowClass = `w-full text-left flex items-start gap-3.5 px-4 sm:px-5 py-4 border-b border-slate-50 last:border-b-0 transition-colors ${
    notification.isRead ? 'bg-white' : 'bg-indigo-50/50'
  } ${
    isInteractive
      ? notification.isRead
        ? 'hover:bg-slate-50 cursor-pointer'
        : 'hover:bg-indigo-50 cursor-pointer'
      : ''
  } ${processing ? 'opacity-60' : ''}`

  const rowContent = (
    <>
      <span
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${visual.bgClass} ${visual.iconClass}`}
      >
        <Icon size={18} />
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${notification.isRead ? 'font-semibold text-slate-700' : 'font-bold text-slate-800'}`}>
            {notification.title}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${visual.bgClass} ${visual.iconClass}`}>
            {notificationTypeLabels[notification.type] ?? fallbackLabel}
          </span>
        </span>

        <span className="block text-sm text-slate-500 leading-relaxed mt-1">{notification.message}</span>

        <span className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
          <Clock size={12} />
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>

      <span className="flex items-center gap-2.5 flex-shrink-0 self-center">
        {!notification.isRead && (
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" title="Chưa đọc" />
        )}
        {notification.link && <ChevronRight size={16} className="text-slate-300" />}
      </span>
    </>
  )

  if (!isInteractive) {
    return (
      <div className={rowClass} title={formatDateTime(notification.createdAt)}>
        {rowContent}
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={processing}
      onClick={() => onOpen(notification)}
      title={formatDateTime(notification.createdAt)}
      className={rowClass}
    >
      {rowContent}
    </button>
  )
}

function NotificationListSkeleton() {
  const rowKeys = Array.from({ length: 5 }, (_, index) => index)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {rowKeys.map(rowKey => (
        <div
          key={rowKey}
          className="flex items-start gap-3.5 px-5 py-4 border-b border-slate-50 last:border-b-0"
        >
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2.5">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface NotificationsPageProps {
  audience: UserRole
}

export default function NotificationsPage({ audience }: NotificationsPageProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  // Không còn tham số vai trò: server gắn mỗi thông báo với đúng một người nhận và lấy danh
  // tính từ token, nên "thông báo của tôi" là phép lọc theo khoá ngoại chứ không theo nhóm người.
  const { data: notifications, loading, error, reload, refresh } = useAsync(() => listNotifications(), [])

  // Thông báo mới đến thì danh sách tự thêm dòng. Chỉ nghe những sự kiện có sinh thông báo: nghe cả
  // UnreadCountChanged thì mỗi lần bấm "đã đọc" lại kéo theo một lượt tải lại danh sách.
  useRealtimeRefresh(['ExamAssigned', 'ExamUpdated', 'ExamSubmitted', 'AutoSubmitted', 'DeadlineSoon'], refresh)

  const totalCount = notifications?.length ?? 0
  const unreadCount = useMemo(
    () => (notifications ?? []).filter(notification => !notification.isRead).length,
    [notifications],
  )

  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? (notifications ?? []).filter(item => !item.isRead) : (notifications ?? [])),
    [notifications, filter],
  )

  const groupedNotifications = useMemo(() => {
    const buckets: Record<DayGroupKey, AppNotification[]> = { today: [], yesterday: [], older: [] }
    visibleNotifications.forEach(notification => {
      buckets[getDayGroup(notification.createdAt)].push(notification)
    })

    return dayGroupOrder
      .map(key => ({ key, label: dayGroupLabels[key], items: buckets[key] }))
      .filter(group => group.items.length > 0)
  }, [visibleNotifications])

  const isFirstLoad = loading && notifications === undefined
  const isRefreshing = loading && notifications !== undefined

  const subtitle = error
    ? 'Không tải được danh sách thông báo'
    : notifications === undefined
      ? 'Đang tải danh sách thông báo...'
      : totalCount === 0
        ? 'Chưa có thông báo nào'
        : unreadCount > 0
          ? `${unreadCount} thông báo chưa đọc trong tổng số ${totalCount}`
          : `Bạn đã đọc hết ${totalCount} thông báo`

  const handleOpenNotification = async (notification: AppNotification) => {
    // Chặn cả khi đang đánh dấu hàng loạt để hai lệnh ghi không chạy chồng lên nhau.
    if (processingId !== null || markingAll) return

    if (notification.isRead) {
      if (notification.link) navigate(notification.link)
      return
    }

    setProcessingId(notification.id)
    try {
      await markAsRead(notification.id)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không cập nhật được trạng thái thông báo.')
      setProcessingId(null)
      return
    }

    // Trả trạng thái về trước khi điều hướng: sau navigate component đã bị gỡ,
    // đặt state lúc đó là thao tác thừa trên component không còn tồn tại.
    setProcessingId(null)
    if (notification.link) {
      navigate(notification.link)
      return
    }
    reload()
  }

  const handleMarkAllAsRead = async () => {
    if (markingAll || processingId !== null || unreadCount === 0) return

    setMarkingAll(true)
    try {
      const marked = await markAllAsRead()
      toast.success(`Đã đánh dấu ${marked} thông báo là đã đọc.`)
      reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không đánh dấu được thông báo đã đọc.')
    } finally {
      setMarkingAll(false)
    }
  }

  const content = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 animate-fade-in-up">
        <div className="flex gap-2">
          {filterTabs.map(({ key, label, icon: TabIcon }) => {
            const isActive = filter === key
            const count = key === 'unread' ? unreadCount : totalCount
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                <TabIcon size={14} />
                {label}
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {notifications === undefined ? '—' : count}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0 || markingAll || processingId !== null}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50"
        >
          <CheckCheck size={15} />
          {markingAll ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
        </button>
      </div>

      {/*
        Boundary chỉ quanh phần thật sự đọc notification.type (danh sách + trạng thái rỗng), không
        quanh thanh lọc/nút đánh dấu tất cả phía trên: một lỗi render ở đây thì người dùng vẫn bấm
        chuyển tab hay thử lại được, thay vì mất luôn cả khung trang.
      */}
      <ErrorBoundary label="NotificationsPage">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : isFirstLoad ? (
          <NotificationListSkeleton />
        ) : groupedNotifications.length > 0 ? (
          <div className={`space-y-6 transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
            {groupedNotifications.map(group => (
              <section key={group.key} className="animate-fade-in-up">
                <div className="flex items-center gap-2 mb-2.5">
                  <h2 className="text-base font-bold text-slate-800">{group.label}</h2>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {group.items.length}
                  </span>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {group.items.map(notification => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      processing={processingId === notification.id || markingAll}
                      onOpen={handleOpenNotification}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : filter === 'unread' && totalCount > 0 ? (
          <EmptyState
            icon={CheckCheck}
            title="Bạn đã đọc hết thông báo"
            description="Không còn thông báo nào chưa đọc. Những thông báo mới sẽ xuất hiện ngay tại đây."
            action={
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                Xem tất cả thông báo <ChevronRight size={15} />
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={BellOff}
            title="Chưa có thông báo nào"
            description={emptyStateDescriptions[audience]}
          />
        )}
      </ErrorBoundary>
    </>
  )

  if (audience === 'teacher') {
    return (
      <TeacherLayout pageTitle="Thông báo" pageSubtitle={subtitle}>
        {content}
      </TeacherLayout>
    )
  }

  if (audience === 'admin') {
    return (
      <AdminLayout pageTitle="Thông báo" pageSubtitle={subtitle}>
        {content}
      </AdminLayout>
    )
  }

  return (
    <StudentLayout>
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-800">Thông báo</h1>
        <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
      </div>
      {content}
    </StudentLayout>
  )
}
