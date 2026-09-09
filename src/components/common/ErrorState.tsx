import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm px-6 py-14 flex flex-col items-center text-center animate-fade-in-up">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h3 className="text-base font-bold text-slate-800">Không tải được dữ liệu</h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">
        {message ?? 'Đã có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại sau ít phút.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
        >
          <RefreshCw size={15} />
          Thử lại
        </button>
      )}
    </div>
  )
}
