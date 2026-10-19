import { useEffect } from 'react'
import { Copy } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'

interface IssuedPasswordModalProps {
  /** Mật khẩu vừa cấp; `null` thì hộp đóng. */
  password: string | null
  /** Tài khoản được cấp, để người dùng biết mật khẩu này của ai. */
  description?: string
  /** Người nhận phải đổi mật khẩu ở lần đăng nhập đầu. */
  mustChangePassword?: boolean
  /** Ai sẽ phải đổi mật khẩu: "Học sinh", "Giáo viên"... */
  holder: string
  onClose: () => void
}

/**
 * Hộp hiện mật khẩu vừa cấp — cơ hội duy nhất để chép, vì database chỉ giữ chuỗi băm.
 *
 * Chỉ nút "Tôi đã chép lại" mới đóng được hộp: một cú chạm trượt ra ngoài hay phím ESC mà làm mất mật khẩu thì phải cấp lại lần
 * nữa, và người nhận bị đăng xuất thêm một lần. Tải lại trang hay đóng tab lúc hộp còn mở cũng bị trình duyệt hỏi lại.
 */
export default function IssuedPasswordModal({
  password, description, mustChangePassword = true, holder, onClose,
}: IssuedPasswordModalProps) {
  const toast = useToast()

  useEffect(() => {
    if (password === null) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [password])

  const copy = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      toast.success('Đã chép mật khẩu mới.')
    } catch {
      toast.error('Trình duyệt không cho chép tự động. Hãy bôi đen mật khẩu rồi chép thủ công.')
    }
  }

  return (
    <Modal
      open={password !== null}
      title="Mật khẩu mới đã được tạo"
      description={description}
      size="sm"
      dismissible={false}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
        >
          Tôi đã chép lại
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <code className="flex-1 min-w-0 font-mono text-lg font-bold text-slate-800 tracking-wide break-all select-all">
            {password}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 transition-colors flex-shrink-0"
          >
            <Copy size={14} /> Chép
          </button>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Mật khẩu này chỉ hiện đúng một lần. Đóng hộp thoại, bấm quay lại hay rời trang là không xem lại được nữa — khi đó phải
          cấp mật khẩu mới.
        </p>
        {mustChangePassword && (
          <p className="text-sm text-slate-500 leading-relaxed">{holder} sẽ phải đổi mật khẩu ở lần đăng nhập tới.</p>
        )}
      </div>
    </Modal>
  )
}
