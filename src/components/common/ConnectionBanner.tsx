import { Loader2 } from 'lucide-react'

/**
 * Dải nhỏ báo kết nối realtime đang đứt. Chỉ hiện khi mất kéo dài (RealtimeProvider quyết định), nằm
 * ở đáy màn hình để không chen vào thanh điều hướng và không che nội dung đang đọc.
 */
export default function ConnectionBanner() {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[calc(100vw_-_2rem)]">
      <div
        role="status"
        className="flex items-center gap-2 rounded-full bg-slate-800 text-white text-sm font-medium px-4 py-2 shadow-lg animate-fade-in"
      >
        <Loader2 size={15} className="animate-spin flex-shrink-0" />
        <span>Đang kết nối lại...</span>
      </div>
    </div>
  )
}
