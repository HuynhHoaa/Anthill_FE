import { AlertCircle } from 'lucide-react'

/** Dòng lỗi nhỏ đặt ngay dưới ô nhập, tự ẩn khi trường không có lỗi. */
export default function FieldError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <p className="mt-1.5 text-xs font-medium text-red-500 flex items-center gap-1.5">
      <AlertCircle size={13} className="flex-shrink-0" />
      {message}
    </p>
  )
}
