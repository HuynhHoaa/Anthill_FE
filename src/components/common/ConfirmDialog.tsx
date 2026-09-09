import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = tone === 'danger'
  const Icon = isDanger ? AlertTriangle : HelpCircle

  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={() => {
        if (!loading) onCancel()
      }}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 ${
              isDanger ? 'bg-red-500 hover:bg-red-600' : ''
            }`}
            style={isDanger ? undefined : { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isDanger ? 'bg-red-50' : 'bg-indigo-50'
          }`}
        >
          <Icon size={22} className={isDanger ? 'text-red-500' : 'text-indigo-500'} />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed pt-1.5">{message}</p>
      </div>
    </Modal>
  )
}
