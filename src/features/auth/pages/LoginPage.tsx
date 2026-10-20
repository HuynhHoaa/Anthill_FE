import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import AnthillBadge from '../../../components/brand/AnthillBadge'
import { getCurrentUser, login } from '../../../services/authService'
import type { UserRole } from '../../../types'
import { AntMascotHead, AntMascotPaws } from '../components/AntMascot'
import AntTrail from '../components/AntTrail'
import { useApiStatus, type ApiStatus } from '../hooks/useApiStatus'
import '../login.css'

const dashboardPath: Record<UserRole, string> = {
  teacher: '/giao-vien',
  student: '/hoc-sinh',
  admin: '/quan-tri/nhom-lop',
}

const minPasswordLength = 4

interface LoginFieldErrors {
  username?: string
  password?: string
}

/**
 * Không phân biệt vai trò: server tự dò một chuỗi đăng nhập qua cả ba dạng định danh (email,
 * username, mã học sinh — xem `LoginRequest.Role`, "chỉ để đối chiếu"), nên form không cần hỏi
 * trước "bạn là ai" mới biết chấp nhận định dạng gì.
 */
function validateLoginForm(username: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  const trimmedUsername = username.trim()

  if (!trimmedUsername) {
    errors.username = 'Vui lòng nhập email hoặc tên đăng nhập.'
  }

  if (!password) {
    errors.password = 'Vui lòng nhập mật khẩu.'
  } else if (password.length < minPasswordLength) {
    errors.password = `Mật khẩu phải có ít nhất ${minPasswordLength} ký tự.`
  }

  return errors
}

/**
 * Trang đích sau khi đăng nhập: quay lại đúng trang người dùng định vào (RequireRole gửi kèm), hoặc
 * trang đang đứng lúc phiên chết giữa chừng (App gửi kèm), nếu nó thuộc khu vực của vai trò vừa đăng
 * nhập; không thì về trang tổng quan.
 *
 * Kiểm theo đoạn đường dẫn chứ không theo tiền tố chuỗi trần: một liên kết của giáo viên mở bằng tài
 * khoản học sinh thì RequireRole đá ngược ra ngay, người dùng thấy màn hình nhấp nháy rồi về chỗ cũ mà
 * không hiểu vì sao. Cũng vì luôn phải nằm dưới khu vực của một vai trò nên `/dang-nhap` không bao giờ
 * là đích — không có vòng lặp quay về chính trang này.
 */
function resolveReturnPath(returnTo: string | undefined, home: string): string {
  if (!returnTo) return home
  // Khu vực là đoạn đầu của đường dẫn, không phải cả trang chủ: trang chủ của quản trị viên là /quan-tri/nhom-lop nhưng họ quay về
  // được mọi trang dưới /quan-tri.
  const area = `/${home.split('/')[1]}`
  const insideArea = returnTo === area || returnTo.startsWith(`${area}/`) || returnTo.startsWith(`${area}?`)
  return insideArea ? returnTo : home
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

/**
 * Cho người dùng biết máy chủ miễn phí đang ngủ. Không nói gì khi nó trả lời nhanh: chỉ lên tiếng khi phải chờ lâu,
 * và báo lại một lần khi đã dậy. Đàn kiến ở chân trang chạy nhanh hơn trong lúc này (xem `AntTrail`).
 */
function ServerStatusPill({ status }: { status: ApiStatus }) {
  const [sawWaking, setSawWaking] = useState(false)
  const [readyVisible, setReadyVisible] = useState(false)

  useEffect(() => {
    if (status === 'waking') setSawWaking(true)
  }, [status])

  useEffect(() => {
    if (status !== 'ready' || !sawWaking) return
    setReadyVisible(true)
    const timer = window.setTimeout(() => setReadyVisible(false), 4500)
    return () => window.clearTimeout(timer)
  }, [status, sawWaking])

  const tone =
    status === 'waking'
      ? { key: 'waking', text: 'Máy chủ miễn phí đang thức dậy, lần đầu có thể mất tới một phút.' }
      : status === 'unreachable'
        ? { key: 'error', text: 'Chưa kết nối được máy chủ. Bạn thử tải lại trang sau ít phút.' }
        : status === 'ready' && readyVisible
          ? { key: 'ready', text: 'Máy chủ đã sẵn sàng.' }
          : null

  return (
    <div role="status" aria-live="polite" className="login-status">
      {tone && (
        <div className="status-pill login-mono animate-fade-in" data-tone={tone.key}>
          <span className="status-pill-dot" />
          {tone.text}
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // RequireRole gửi kèm địa chỉ đang muốn vào; luồng 401 giữa phiên thì gửi cờ sessionExpired.
  // ForceChangePasswordPage gửi cờ passwordChanged sau khi đổi mật khẩu bắt buộc thành công.
  const routeState = location.state as
    | { from?: string; sessionExpired?: boolean; reason?: string; passwordChanged?: boolean }
    | null
  const returnTo = typeof routeState?.from === 'string' ? routeState.from : undefined
  const sessionExpired = routeState?.sessionExpired === true
  const passwordChanged = routeState?.passwordChanged === true
  // Lý do server gửi kèm 401 ("tài khoản đã bị khoá, liên hệ quản trị viên"...). Có thì nói đúng lý
  // do: một em bị khoá mà chỉ đọc "hãy đăng nhập lại" sẽ đăng nhập lại và gặp thêm một lỗi khó hiểu.
  const sessionReason = typeof routeState?.reason === 'string' && routeState.reason ? routeState.reason : undefined
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [serverError, setServerError] = useState<string | undefined>(undefined)
  const [forgotOpen, setForgotOpen] = useState(false)

  // Chú kiến gác cổng: tư thế theo ô đang gõ, tâm trạng theo kết quả đăng nhập, ánh mắt theo con trỏ.
  const apiStatus = useApiStatus()
  const wrapRef = useRef<HTMLDivElement>(null)
  const typingRef = useRef(false)
  const moodTimerRef = useRef<number | undefined>(undefined)
  const [focused, setFocused] = useState<'username' | 'password' | null>(null)
  const [mood, setMood] = useState<'idle' | 'error'>('idle')
  const [succeeded, setSucceeded] = useState(false)

  const pose = succeeded ? 'cheer' : focused === 'password' ? (showPassword ? 'peek' : 'cover') : 'idle'

  const lookAt = (x: number, y: number) => {
    wrapRef.current?.style.setProperty('--lx', String(x))
    wrapRef.current?.style.setProperty('--ly', String(y))
  }

  // Đang gõ tên đăng nhập thì kiến nhìn xuống ô nhập và đưa mắt theo độ dài chữ; còn lại nhìn theo con trỏ.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const wrap = wrapRef.current
      if (!wrap || typingRef.current) return
      const box = wrap.getBoundingClientRect()
      const dx = event.clientX - (box.left + box.width / 2)
      const dy = event.clientY - (box.top - 24)
      lookAt(clamp((dx / 240) * 5, -5, 5), clamp((dy / 280) * 4, -3, 4))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => () => window.clearTimeout(moodTimerRef.current), [])

  const flashError = () => {
    window.clearTimeout(moodTimerRef.current)
    setMood('error')
    moodTimerRef.current = window.setTimeout(() => setMood('idle'), 1800)
  }

  // Còn phiên đăng nhập thì vào thẳng khu vực tương ứng, không bắt đăng nhập lại
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      navigate(dashboardPath[currentUser.role], { replace: true })
    }
  }, [navigate])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateLoginForm(form.username, form.password)
    setFieldErrors(nextErrors)
    setServerError(undefined)
    if (nextErrors.username || nextErrors.password) {
      flashError()
      return
    }

    setLoading(true)
    try {
      const profile = await login({ username: form.username.trim(), password: form.password })

      // Kiến mừng một cái rồi mới chuyển trang; người chọn giảm chuyển động thì vào luôn.
      setSucceeded(true)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) await sleep(650)
      navigate(resolveReturnPath(returnTo, dashboardPath[profile.role]), { replace: true })
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'Đăng nhập không thành công. Vui lòng thử lại.')
      setLoading(false)
      flashError()
    }
  }

  const busy = loading || apiStatus === 'waking'

  return (
    <div className="login-page">
      <div className="login-bgword" aria-hidden="true">anthill</div>
      <AntTrail busy={busy} />

      <div className="login-brand">
        <AnthillBadge size={46} className="login-brand-badge" />
        <span className="login-brand-name">Anthill</span>
      </div>
      <ServerStatusPill status={apiStatus} />

      <main className="login-main">
        <div ref={wrapRef} className="sheet-wrap" data-pose={pose} data-mood={mood}>
          <AntMascotHead />

          <section className="sheet" aria-labelledby="login-title">
            <span className="sheet-hole" style={{ top: '16%' }} aria-hidden="true" />
            <span className="sheet-hole" style={{ top: '48%' }} aria-hidden="true" />
            <span className="sheet-hole" style={{ top: '80%' }} aria-hidden="true" />
            <span className="sheet-tab login-mono">Phiếu đăng nhập</span>

            <div className="stagger-in space-y-5">
              <div>
                <h1 id="login-title" className="sheet-title">
                  Hệ thống kiểm tra
                  <br />
                  trực tuyến <span className="marker">thông minh</span>
                </h1>
                <p className="sheet-sub mt-3 text-[0.92rem] leading-relaxed text-[#5f5646]">
                  Tạo bài kiểm tra, quản lý học sinh và theo dõi kết quả — tất cả trong một nơi.
                </p>
              </div>

              {/*
                Phiên chết giữa chừng — tài khoản bị khoá, hoặc mật khẩu vừa được đổi ở nơi khác nên
                backend đã xoay SecurityStamp. Không nói gì thì người dùng chỉ thấy mình đột nhiên bị
                văng ra và tưởng hệ thống lỗi. Nhường chỗ cho serverError khi có lỗi đăng nhập mới,
                vì lúc đó thông điệp kia mới là thứ đang cần đọc.
              */}
              {passwordChanged && !serverError && (
                <div role="status" className="sheet-note sheet-note--ok animate-fade-in">
                  <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                  <p>Đổi mật khẩu thành công. Hãy đăng nhập lại bằng mật khẩu mới.</p>
                </div>
              )}

              {sessionExpired && !serverError && !passwordChanged && (
                <div role="status" className="sheet-note sheet-note--warn animate-fade-in">
                  <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                  <p>
                    {sessionReason ??
                      'Phiên đăng nhập đã kết thúc. Việc này xảy ra khi tài khoản bị khoá hoặc mật khẩu vừa được đổi. Hãy đăng nhập lại để tiếp tục.'}
                  </p>
                </div>
              )}

              {serverError && (
                <div role="alert" className="sheet-note sheet-note--error animate-fade-in">
                  <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                  <p>{serverError}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4" noValidate aria-label="Đăng nhập">
                <div>
                  <label htmlFor="login-username" className="sheet-label login-mono">
                    Email hoặc tên đăng nhập
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    aria-invalid={Boolean(fieldErrors.username)}
                    className="sheet-input"
                    placeholder="Email hoặc mã học sinh"
                    value={form.username}
                    onFocus={() => {
                      setFocused('username')
                      typingRef.current = true
                      lookAt(clamp(-4 + (form.username.length / 24) * 8, -4, 4), 3.5)
                    }}
                    onBlur={() => {
                      setFocused(null)
                      typingRef.current = false
                    }}
                    onChange={event => {
                      setForm({ ...form, username: event.target.value })
                      lookAt(clamp(-4 + (event.target.value.length / 24) * 8, -4, 4), 3.5)
                      if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: undefined })
                    }}
                  />
                  {fieldErrors.username && <p className="mt-1.5 text-xs font-semibold text-[#d93a2b]">{fieldErrors.username}</p>}
                </div>

                <div>
                  <div className="mb-1.5 flex items-end justify-between">
                    <label htmlFor="login-password" className="sheet-label login-mono !mb-0">
                      Mật khẩu
                    </label>
                    <button type="button" onClick={() => setForgotOpen(true)} className="sheet-link">
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      aria-invalid={Boolean(fieldErrors.password)}
                      className="sheet-input !pr-12"
                      placeholder="Nhập mật khẩu"
                      value={form.password}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      onChange={event => {
                        setForm({ ...form, password: event.target.value })
                        if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined })
                      }}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#5f5646] transition-colors hover:text-[#2d2a24]"
                      // Giữ tiêu điểm ở ô mật khẩu khi bấm con mắt, để kiến hé mắt nhìn chứ không bỏ tay xuống.
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="mt-1.5 text-xs font-semibold text-[#d93a2b]">{fieldErrors.password}</p>}
                </div>

                <button type="submit" disabled={loading} className="sheet-button !mt-5">
                  {loading ? (
                    <>
                      <span className="ant-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      Đang đăng nhập
                    </>
                  ) : 'Đăng nhập'}
                </button>
              </form>

              <p className="sheet-foot login-mono">
                © {new Date().getFullYear()} Anthill — Đồng hành cùng thầy cô và học sinh.
              </p>
            </div>
          </section>

          <AntMascotPaws />
        </div>
      </main>

      <Modal
        open={forgotOpen}
        title="Quên mật khẩu?"
        description="Tính năng tự đặt lại mật khẩu sẽ có ở phiên bản tiếp theo."
        onClose={() => setForgotOpen(false)}
        size="sm"
      >
        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            Ở bản hiện tại, mật khẩu do quản trị viên cấp phát. Nếu bạn quên mật khẩu, hãy liên hệ
            quản trị viên hệ thống để được cấp lại.
          </p>
          <p className="text-slate-500">
            Sau khi đăng nhập, bạn có thể tự đổi mật khẩu trong mục{' '}
            <strong className="text-slate-700">Hồ sơ cá nhân</strong>.
          </p>
        </div>
      </Modal>
    </div>
  )
}
