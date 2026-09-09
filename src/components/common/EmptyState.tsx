import type { ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-14 flex flex-col items-center text-center animate-fade-in-up">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' }}
      >
        <Icon size={28} className="text-indigo-500" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
