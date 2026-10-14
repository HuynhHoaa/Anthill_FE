/**
 * Hộp xác nhận dùng chung cho cả ứng dụng, gọi bằng một lời `await`.
 *
 * Tồn tại vì mỗi trang tự dựng hộp xác nhận riêng thì mỗi trang tự quên một thứ khác nhau: trang
 * này đóng hộp khi server báo lỗi nên người dùng không biết đã hỏng, trang kia không khoá nút lúc
 * đang gửi nên bấm hai lần là gửi hai lần. Gom về một chỗ thì những điều đó đúng ở mọi nơi.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import ConfirmDialog from './ConfirmDialog'

export interface ConfirmOptions {
  title: string
  /** Phải nói rõ hệ quả cụ thể, không phải một câu "Bạn có chắc không?". */
  message: ReactNode
  details?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  /**
   * `false` thì phím Enter không xác nhận hộp này (nút và Esc vẫn như thường). Dùng cho hộp nói về một điều
   * cần cân nhắc: Enter gõ thêm một lần ngay sau khi hộp mở không nên thành lời "vâng". Mặc định `true`.
   */
  enterConfirms?: boolean
  /**
   * Việc cần làm khi người dùng xác nhận.
   *
   * Truyền vào đây thay vì tự gọi sau khi `await` để hộp thoại giữ nguyên, quay vòng trên nút xác
   * nhận và khoá mọi lối thoát trong lúc chờ server — đó là thứ chặn việc gửi hai lần. Ném lỗi thì
   * lỗi hiện ngay trong hộp và hộp không đóng.
   */
  onConfirm?: () => Promise<unknown> | unknown
}

export interface ConfirmInputOptions extends Omit<ConfirmOptions, 'onConfirm'> {
  inputLabel: string
  placeholder?: string
  inputHint?: string
  /** Độ dài tối thiểu sau khi bỏ khoảng trắng hai đầu. Mặc định 1 — ô này là bắt buộc. */
  minLength?: number
  maxLength?: number
  /** Nhận chuỗi đã bỏ khoảng trắng hai đầu. */
  onConfirm?: (value: string) => Promise<unknown> | unknown
}

export interface ConfirmFn {
  /** `true` khi người dùng xác nhận (và `onConfirm`, nếu có, đã chạy xong không lỗi). */
  (options: ConfirmOptions): Promise<boolean>
  /** Chuỗi đã bỏ khoảng trắng hai đầu, hoặc `null` khi người dùng huỷ. */
  withInput: (options: ConfirmInputOptions) => Promise<string | null>
  /**
   * Đóng hộp đang mở như thể người dùng bấm Huỷ.
   *
   * Cho những lúc chính hệ thống cần giành lại màn hình — hết giờ làm bài thì phải nộp ngay, không
   * để hộp "Xác nhận nộp bài" nằm chồng lên lớp phủ nộp tự động. Không làm gì khi hộp đang chạy
   * thao tác: cắt ngang lúc đó thì không ai biết thao tác đã xong hay chưa.
   */
  dismiss: () => void
}

interface ActiveRequest {
  id: number
  options: ConfirmOptions | ConfirmInputOptions
  input?: { label: string; placeholder?: string; hint?: string; minLength: number; maxLength?: number }
  run?: (value: string) => Promise<unknown> | unknown
  resolve: (accepted: boolean, value: string) => void
}

const ConfirmContext = createContext<ConfirmFn | null>(null)

const FALLBACK_ERROR = 'Không thực hiện được thao tác. Vui lòng thử lại.'

function toErrorMessage(caught: unknown): string {
  return caught instanceof Error && caught.message ? caught.message : FALLBACK_ERROR
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ActiveRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')

  // Ref song song với state vì các hàm dưới đây được gọi từ bên ngoài vòng render — từ một lời
  // await đã treo vài giây, từ bộ đếm giờ — nên state trong closure của chúng có thể đã cũ.
  const requestRef = useRef<ActiveRequest | null>(null)
  const busyRef = useRef(false)
  const requestIdRef = useRef(0)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const clearDialog = useCallback(() => {
    requestRef.current = null
    busyRef.current = false
    setRequest(null)
    setBusy(false)
    setError(null)
    setInputValue('')
  }, [])

  const settle = useCallback(
    (accepted: boolean, value: string) => {
      const current = requestRef.current
      if (!current) return
      clearDialog()
      current.resolve(accepted, value)

      // Trả tiêu điểm về nút đã mở hộp, để người dùng bàn phím không bị ném về đầu trang. Chờ một
      // nhịp cho hộp gỡ khỏi DOM trước; nút có thể đã biến mất theo dòng vừa xoá, khi đó thôi.
      const target = returnFocusRef.current
      returnFocusRef.current = null
      if (target) {
        window.setTimeout(() => {
          if (target.isConnected) target.focus()
        }, 0)
      }
    },
    [clearDialog],
  )

  const open = useCallback((next: Omit<ActiveRequest, 'id'>) => {
    // Đúng một hộp mỗi lúc. Yêu cầu thứ hai bị coi như huỷ chứ không thay chỗ hộp đang mở: tráo
    // hộp ngay dưới con trỏ người đang đọc là cách chắc nhất để họ xác nhận nhầm việc.
    if (requestRef.current) {
      next.resolve(false, '')
      return
    }

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    requestIdRef.current += 1
    const active: ActiveRequest = { ...next, id: requestIdRef.current }
    requestRef.current = active
    busyRef.current = false
    setRequest(active)
    setBusy(false)
    setError(null)
    setInputValue('')
  }, [])

  const handleConfirm = async () => {
    const current = requestRef.current
    if (!current || busyRef.current) return

    const value = inputValue.trim()
    if (current.input && value.length < current.input.minLength) return

    if (!current.run) {
      settle(true, value)
      return
    }

    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await current.run(value)
      // Hộp đã bị gỡ giữa chừng (đổi trang trong lúc chờ) thì vẫn phải trả kết quả thật cho người
      // đang chờ, chỉ là không còn hộp nào để đóng.
      if (requestRef.current !== current) {
        current.resolve(true, value)
        return
      }
      settle(true, value)
    } catch (caught) {
      if (requestRef.current !== current) {
        current.resolve(false, '')
        return
      }
      busyRef.current = false
      setBusy(false)
      setError(toErrorMessage(caught))
    }
  }

  const handleCancel = () => {
    if (busyRef.current) return
    settle(false, '')
  }

  // Đổi trang thì hộp của trang cũ không còn nghĩa gì. Hộp đang chờ thì trả về "huỷ" ngay; hộp đang
  // chạy thao tác thì chỉ gỡ khỏi màn hình và để thao tác tự trả kết quả khi xong — thao tác đó
  // thường chính là thứ vừa chuyển trang (nộp bài xong thì sang trang kết quả).
  const location = useLocation()
  const lastPathRef = useRef(location.pathname)
  useEffect(() => {
    if (lastPathRef.current === location.pathname) return
    lastPathRef.current = location.pathname

    const current = requestRef.current
    if (!current) return
    const wasBusy = busyRef.current
    clearDialog()
    returnFocusRef.current = null
    if (!wasBusy) current.resolve(false, '')
  }, [location.pathname, clearDialog])

  // Trong lúc thao tác đang chạy, đóng tab hay tải lại trang là bỏ ngang một việc server có thể đã
  // làm xong — cấp lại mật khẩu mà trang đã biến mất thì mật khẩu mới không bao giờ hiện ra. Trình
  // duyệt không cho chặn hẳn, nhưng hỏi lại một câu thì được.
  useEffect(() => {
    if (!busy) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [busy])

  // Provider bị gỡ mà còn lời hứa treo thì người gọi chờ mãi — trả về "huỷ" cho họ đi tiếp.
  useEffect(
    () => () => {
      const current = requestRef.current
      requestRef.current = null
      current?.resolve(false, '')
    },
    [],
  )

  const confirm = useMemo<ConfirmFn>(() => {
    const ask = (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        const action = options.onConfirm
        open({
          options,
          run: action ? () => action() : undefined,
          resolve: accepted => resolve(accepted),
        })
      })

    const withInput = (options: ConfirmInputOptions) =>
      new Promise<string | null>(resolve => {
        open({
          options,
          input: {
            label: options.inputLabel,
            placeholder: options.placeholder,
            hint: options.inputHint,
            minLength: Math.max(1, options.minLength ?? 1),
            maxLength: options.maxLength,
          },
          run: options.onConfirm,
          resolve: (accepted, value) => resolve(accepted ? value : null),
        })
      })

    const dismiss = () => {
      if (busyRef.current) return
      settle(false, '')
    }

    return Object.assign(ask, { withInput, dismiss })
  }, [open, settle])

  const input = request?.input
  const options = request?.options

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        key={request?.id ?? 0}
        open={request !== null}
        title={options?.title ?? ''}
        message={options?.message ?? null}
        details={options?.details}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        tone={options?.tone}
        enterConfirms={options?.enterConfirms}
        loading={busy}
        error={error}
        confirmDisabled={input !== undefined && inputValue.trim().length < input.minLength}
        input={input ? { ...input, value: inputValue, onChange: setInputValue } : undefined}
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components -- hook đi cùng provider theo hợp đồng dùng chung
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useConfirm phải được dùng bên trong <ConfirmProvider>.')
  }
  return confirm
}
