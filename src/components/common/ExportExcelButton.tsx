import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { saveBlob } from '../../lib/download'
import { useToast } from './Toast'

interface ExportExcelButtonProps {
  /** Chữ trên nút, ví dụ "Xuất bảng điểm". */
  label: string
  /** Tên file lưu xuống máy (có đuôi .xlsx). */
  fileName: string
  /** Gọi server lấy file. Lỗi ném ra được hiện nguyên văn trong thông báo. */
  request: () => Promise<Blob>
  /** Thông báo khi lưu xong; bỏ trống thì dùng câu mặc định. */
  successMessage?: string
  className?: string
}

/**
 * Nút xuất file Excel dùng chung: bấm là gọi server, lưu file xuống máy, báo kết quả bằng thông báo nổi. Trong lúc chờ nút
 * khoá lại để bấm đúp không tải hai lần.
 */
export default function ExportExcelButton({
  label,
  fileName,
  request,
  successMessage,
  className,
}: ExportExcelButtonProps) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    setBusy(true)
    try {
      saveBlob(await request(), fileName)
      toast.success(successMessage ?? 'Đã xuất file Excel.')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không xuất được file. Thử lại sau.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap'
      }
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {label}
    </button>
  )
}
