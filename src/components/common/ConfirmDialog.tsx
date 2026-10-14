import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react'
import Modal from './Modal'

/** Ô nhập bắt buộc đi kèm hộp xác nhận, ví dụ lý do xoá tài khoản. */
export interface ConfirmDialogInput {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  /** Tính trên chuỗi đã bỏ khoảng trắng hai đầu — đúng cách server đếm. */
  minLength: number
  maxLength?: number
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  /** Phần giải thích thêm dưới lời nhắn, thường là danh sách hệ quả cụ thể. */
  details?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  /** `false`: Enter không xác nhận (xem `ConfirmOptions.enterConfirms`). */
  enterConfirms?: boolean
  loading?: boolean
  /** Lỗi của lần xác nhận vừa rồi. Hiện ngay trong hộp để người dùng thử lại mà không phải mở lại. */
  error?: string | null
  confirmDisabled?: boolean
  input?: ConfirmDialogInput
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  tone = 'primary',
  enterConfirms = true,
  loading = false,
  error = null,
  confirmDisabled = false,
  input,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = tone === 'danger'
  const Icon = isDanger ? AlertTriangle : HelpCircle
  const blocked = loading || confirmDisabled
  const inputId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasInput = input !== undefined

  // Phím Enter đọc trạng thái qua ref: listener chỉ gắn một lần mỗi lần mở, nên nếu đọc thẳng
  // biến trong closure thì nó mãi thấy nút xác nhận ở trạng thái lúc vừa mở.
  const latestRef = useRef({ blocked, onConfirm, enterConfirms })
  latestRef.current = { blocked, onConfirm, enterConfirms }

  // Đưa tiêu điểm vào trong hộp ngay khi mở: có ô nhập thì vào ô nhập, không thì vào thân hộp để
  // Tab đi tiếp tới hai nút. Để tiêu điểm nằm lại trên nút đã mở hộp thì Enter lần nữa sẽ bấm lại
  // chính nút đó ở phía sau lớp phủ.
  //
  // Ô nhập chỉ tự nhận tiêu điểm trên máy có chuột. Trên điện thoại, tiêu điểm vào ô nhập là bàn
  // phím bật lên che mất danh sách hệ quả — đúng phần người dùng cần đọc trước khi gõ lý do.
  useEffect(() => {
    if (!open) return
    const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches ?? true
    if (hasInput && hasFinePointer) inputRef.current?.focus()
    else bodyRef.current?.focus()
  }, [open, hasInput])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      // isComposing: bộ gõ tiếng Việt dùng Enter để chốt chữ đang ghép, lúc đó không phải xác nhận.
      if (event.key !== 'Enter' || event.isComposing || event.shiftKey) return
      const target = event.target
      // Chỉ nhận Enter khi tiêu điểm nằm trong chính hộp này. Listener gắn trên cả trang, nên thiếu
      // bước này thì Enter gõ ở một ô tìm kiếm phía sau lớp phủ cũng thành xác nhận.
      const dialog = bodyRef.current?.closest('[role="dialog"]')
      if (!dialog || !(target instanceof Node) || !dialog.contains(target)) return
      // Nút và liên kết tự xử lý Enter theo cách của trình duyệt — Enter trên nút Huỷ phải là Huỷ.
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return
      if (!latestRef.current.enterConfirms) return
      event.preventDefault()
      if (latestRef.current.blocked) return
      latestRef.current.onConfirm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const trimmedLength = input ? input.value.trim().length : 0
  const missingCharacters = input ? Math.max(0, input.minLength - trimmedLength) : 0
  // Chưa gõ gì thì chưa có gì sai: nhắc độ dài tối thiểu bằng màu trung tính, chỉ chuyển sang màu
  // cảnh báo khi người dùng đã bắt đầu gõ mà vẫn thiếu.
  const hasTyped = input !== undefined && input.value.length > 0

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
            disabled={blocked}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
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
      <div ref={bodyRef} tabIndex={-1} className="outline-none">
        <div className="flex gap-4">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDanger ? 'bg-red-50' : 'bg-indigo-50'
            }`}
          >
            <Icon size={22} className={isDanger ? 'text-red-500' : 'text-indigo-500'} />
          </div>
          <div className="min-w-0 flex-1 pt-1.5 space-y-3">
            <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
            {details && <div className="text-sm text-slate-600 leading-relaxed">{details}</div>}
          </div>
        </div>

        {input && (
          <div className="mt-5">
            <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700 mb-2">
              {input.label} <span className="text-red-500">*</span>
            </label>
            <input
              id={inputId}
              ref={inputRef}
              value={input.value}
              onChange={event => input.onChange(event.target.value)}
              placeholder={input.placeholder}
              maxLength={input.maxLength}
              disabled={loading}
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50"
            />
            <div className="mt-1.5 flex items-start justify-between gap-3 text-xs">
              <span className={missingCharacters > 0 && hasTyped ? 'text-amber-600' : 'text-slate-400'}>
                {missingCharacters === 0
                  ? 'Đã đủ độ dài tối thiểu.'
                  : hasTyped
                    ? `Cần thêm ít nhất ${missingCharacters} ký tự nữa.`
                    : `Tối thiểu ${input.minLength} ký tự.`}
              </span>
              <span className="text-slate-400 tabular-nums flex-shrink-0">
                {input.maxLength ? `${trimmedLength}/${input.maxLength}` : `${trimmedLength} ký tự`}
              </span>
            </div>
            {/* Lời giải thích vì sao phải ghi lý do cần có mặt ngay từ đầu, trước khi người dùng gõ. */}
            {input.hint && <p className="mt-1 text-xs text-slate-400 leading-relaxed">{input.hint}</p>}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start gap-2 text-sm text-red-600"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
