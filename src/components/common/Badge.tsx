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

export function LifecycleBadge({ lifecycle }: { lifecycle: ExamLifecycle }) {
  return <span className={`${badgeBase} ${lifecycleToneClass[lifecycle]}`}>{lifecycleLabels[lifecycle]}</span>
}

export function TopicBadge({ topic }: { topic: string }) {
  const color = getTopicColor(topic)
  return (
    <span className={badgeBase} style={{ background: `${color}18`, color }}>
      {getTopicLabel(topic)}
    </span>
  )
}
