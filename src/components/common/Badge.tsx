import { Lock } from 'lucide-react'
import { getTopicColor, getTopicLabel } from '../../lib/topicTheme'
import {
  difficultyLabels, examStatusLabels, lifecycleLabels,
  type DifficultyLevel, type ExamLifecycle, type ExamStatus,
} from '../../types'

const badgeBase = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold'

const difficultyToneClass: Record<DifficultyLevel, string> = {
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
}

const statusToneClass: Record<ExamStatus, string> = {
  assigned: 'bg-blue-100 text-blue-700',
  inprogress: 'bg-amber-100 text-amber-700',
  submitted: 'bg-purple-100 text-purple-700',
  graded: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-slate-100 text-slate-500',
}

const lifecycleToneClass: Record<ExamLifecycle, string> = {
  draft: 'bg-amber-50 text-amber-700',
  scheduled: 'bg-indigo-100 text-indigo-700',
  open: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-500',
}

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  return <span className={`${badgeBase} ${difficultyToneClass[level]}`}>{difficultyLabels[level]}</span>
}

export function StatusBadge({ status }: { status: ExamStatus }) {
  return <span className={`${badgeBase} ${statusToneClass[status]}`}>{examStatusLabels[status]}</span>
}

/** Chấm nhỏ lan sóng trước nhãn "Đang mở": bài đang diễn ra thì có đèn báo, như phát trực tiếp. Giảm chuyển động thì chỉ còn chấm tĩnh. */
function LiveDot() {
  return (
    <span aria-hidden="true" className="relative flex h-1.5 w-1.5 mr-1.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </span>
  )
}

export function LifecycleBadge({ lifecycle }: { lifecycle: ExamLifecycle }) {
  return (
    <span className={`${badgeBase} ${lifecycleToneClass[lifecycle]}`}>
      {lifecycle === 'open' && <LiveDot />}
      {lifecycleLabels[lifecycle]}
    </span>
  )
}

/**
 * Trạng thái công bố của một lớp học.
 *
 * Bản nháp mượn nguyên nhãn của đề kiểm tra chưa xuất bản thay vì có nhãn riêng: "bản nháp" là
 * **một** khái niệm trong sản phẩm — thứ chỉ mình người tạo ra nó nhìn thấy — nên người dùng học
 * một lần rồi nhận ra nó ở mọi nơi, thay vì học lại ở từng màn hình.
 */
export function PublishStateBadge({ isPublished }: { isPublished: boolean }) {
  if (!isPublished) return <LifecycleBadge lifecycle="draft" />
  return <span className={`${badgeBase} ${lifecycleToneClass.open}`}>Đã công bố</span>
}

/** Lớp đã khoá: chỉ đọc. Màu hổ phách như mọi trạng thái "cần để ý nhưng không hỏng". */
export function LockedStateBadge() {
  return (
    <span className={`${badgeBase} gap-1 bg-amber-50 text-amber-700`}>
      <Lock size={11} /> Đã khoá
    </span>
  )
}

export function TopicBadge({ topic }: { topic: string }) {
  const color = getTopicColor(topic)
  return (
    <span className={badgeBase} style={{ background: `${color}18`, color }}>
      {getTopicLabel(topic)}
    </span>
  )
}
