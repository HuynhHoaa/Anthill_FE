import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const TOAST_DURATION = 3200
const TOAST_MAX_DURATION = 8000
const TOAST_MS_PER_CHAR = 55

/** Câu dài (một lý do đầy đủ) cần thêm thời gian để đọc xong; câu ngắn giữ nguyên mức cũ. */
function toastDuration(message: string): number {
  return Math.min(TOAST_MAX_DURATION, Math.max(TOAST_DURATION, message.length * TOAST_MS_PER_CHAR))
}

const toastStyles: Record<ToastType, { icon: LucideIcon; iconClass: string; barColor: string }> = {
  success: { icon: CheckCircle2, iconClass: 'text-emerald-500', barColor: '#10B981' },
  error: { icon: XCircle, iconClass: 'text-red-500', barColor: '#EF4444' },
  info: { icon: Info, iconClass: 'text-indigo-500', barColor: '#FF8400' },
}

const ToastContext = createContext<ToastApi | null>(null)

let toastCounter = 0

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { icon: Icon, iconClass, barColor } = toastStyles[toast.type]

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toastDuration(toast.message))
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.message, onDismiss])

  return (
    <div
      role="status"
      className="pointer-events-auto w-80 max-w-[calc(100vw_-_2rem)] bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden flex animate-toast-in"
    >
      <div className="w-1.5 flex-shrink-0" style={{ background: barColor }} />
      <div className="flex items-start gap-3 px-4 py-3.5 flex-1">
        <Icon size={18} className={`${iconClass} flex-shrink-0 mt-0.5`} />
        <p className="text-sm text-slate-700 leading-relaxed flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Đóng thông báo"
          className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const api = useMemo<ToastApi>(() => {
    const pushToast = (type: ToastType, message: string) => {
      toastCounter += 1
      const newToast: ToastItem = { id: toastCounter, type, message }
      setToasts(current => [...current, newToast])
    }

    return {
      success: message => pushToast('success', message),
      error: message => pushToast('error', message),
      info: message => pushToast('info', message),
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex flex-col items-end gap-2.5 pointer-events-none">
        {toasts.map(toast => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components -- hook đi cùng provider theo hợp đồng dùng chung
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) {
    throw new Error('useToast phải được dùng bên trong <ToastProvider>.')
  }
  return api
}
