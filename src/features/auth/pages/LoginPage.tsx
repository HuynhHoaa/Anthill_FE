import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Eye, EyeOff, Lock, User, AlertCircle, ShieldCheck, Presentation, GraduationCap, Sparkles, type LucideIcon,
} from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { getCurrentUser, login } from '../../../services/authService'
import type { UserRole } from '../../../types'
import LoginStage, { type StageRole } from '../components/LoginStage'
import { useApiStatus } from '../hooks/useApiStatus'
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

const baseInputClass =
  'h-12 w-full rounded-xl border bg-white pl-11 text-sm font-medium text-slate-800 outline-none transition-all placeholder:font-normal placeholder:text-slate-400'

function fieldToneClass(hasError: boolean): string {
  return hasError
    ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-50'
    : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'
}

/**
 * Tài khoản mẫu: dữ liệu demo do `DbSeeder` ở backend nạp sẵn. Chỉ hiện khi chạy dev hoặc khi bản triển khai bật
 * `VITE_DEMO_ACCOUNTS=true` — bản dùng thật không được in tài khoản và mật khẩu ra trang đăng nhập (xem §5 của
 * tài liệu yêu cầu).
 */
const DEMO_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEMO_ACCOUNTS === 'true'
const DEMO_PASSWORD = '123456'

const DEMO_ACCOUNTS: { role: StageRole; label: string; person: string; username: string; icon: LucideIcon }[] = [
  { role: 'admin', label: 'Quản trị viên', person: 'Phạm Quốc Huy', username: 'huy.pq@anthill.edu.vn', icon: ShieldCheck },
  { role: 'teacher', label: 'Giáo viên', person: 'Nguyễn Văn An', username: 'an.nv@anthill.edu.vn', icon: Presentation },
  { role: 'student', label: 'Học sinh', person: 'Trần Thị Lan', username: 'lan.tt', icon: GraduationCap },
]

/**
 * Cho người dùng biết máy chủ miễn phí đang ngủ. Không nói gì khi nó trả lời nhanh: chỉ lên tiếng khi phải chờ lâu,
 * và báo lại một lần khi đã dậy.
 */
function ServerStatusPill() {
  const status = useApiStatus()
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
      ? { box: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-400 animate-pulse', text: 'Máy chủ miễn phí đang thức dậy, lần đầu có thể mất tới một phút.' }
      : status === 'unreachable'
        ? { box: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-400', text: 'Chưa kết nối được máy chủ. Bạn thử tải lại trang sau ít phút.' }
        : status === 'ready' && readyVisible
          ? { box: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400', text: 'Máy chủ đã sẵn sàng.' }
          : null

  return (
    <div role="status" aria-live="polite" className={tone ? 'mb-5 lg:absolute lg:right-8 lg:top-7 lg:mb-0 lg:max-w-xs' : undefined}>
      {tone && (
        <div className={`animate-fade-in flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-xs font-medium ${tone.box}`}>
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${tone.dot}`} />
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
  const [demoRole, setDemoRole] = useState<StageRole | null>(null)
  const [pointedRole, setPointedRole] = useState<StageRole | null>(null)
  const [form, setForm] = useState({ username: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [serverError, setServerError] = useState<string | undefined>(undefined)
  const [forgotOpen, setForgotOpen] = useState(false)

  // Còn phiên đăng nhập thì vào thẳng khu vực tương ứng, không bắt đăng nhập lại
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      navigate(dashboardPath[currentUser.role], { replace: true })
    }
  }, [navigate])

  const signIn = async (username: string, password: string) => {
    setLoading(true)
    try {
      const profile = await login({ username: username.trim(), password })

      navigate(resolveReturnPath(returnTo, dashboardPath[profile.role]), { replace: true })
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'Đăng nhập không thành công. Vui lòng thử lại.')
      setLoading(false)
      setDemoRole(null)
    }
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateLoginForm(form.username, form.password)
    setFieldErrors(nextErrors)
    setServerError(undefined)
    if (nextErrors.username || nextErrors.password) return

    await signIn(form.username, form.password)
  }

  // Nút vai trò xem thử: điền sẵn tài khoản vào form (để người xem thấy mình đang đăng nhập bằng gì) rồi vào luôn.
  const handleDemo = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    if (loading) return
    setFieldErrors({})
    setServerError(undefined)
    setDemoRole(account.role)
    setForm({ username: account.username, password: DEMO_PASSWORD })
    await signIn(account.username, DEMO_PASSWORD)
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <LoginStage highlight={pointedRole} />

      <main className="login-form-surface relative z-10 -mt-6 flex flex-1 items-start justify-center rounded-t-[1.75rem] px-5 pb-10 pt-8 shadow-[0_-12px_30px_-12px_rgba(30,27,75,0.35)] sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:px-10 lg:py-12 lg:shadow-none">
        <div className="w-full max-w-[26rem]">
          <ServerStatusPill />

          <div className="stagger-in space-y-6">
            <div>
              <h1 className="font-display text-[2rem] font-extrabold leading-tight text-slate-900">Đăng nhập</h1>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-500">
                Dùng email hoặc mã học sinh nhà trường đã cấp.
              </p>
            </div>

            {/*
              Phiên chết giữa chừng — tài khoản bị khoá, hoặc mật khẩu vừa được đổi ở nơi khác nên
              backend đã xoay SecurityStamp. Không nói gì thì người dùng chỉ thấy mình đột nhiên bị
              văng ra và tưởng hệ thống lỗi. Nhường chỗ cho serverError khi có lỗi đăng nhập mới,
              vì lúc đó thông điệp kia mới là thứ đang cần đọc.
            */}
            {passwordChanged && !serverError && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 animate-fade-in"
              >
                <AlertCircle size={17} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                <p className="text-sm leading-relaxed text-emerald-700">
                  Đổi mật khẩu thành công. Hãy đăng nhập lại bằng mật khẩu mới.
                </p>
              </div>
            )}

            {sessionExpired && !serverError && !passwordChanged && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 animate-fade-in"
              >
                <AlertCircle size={17} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <p className="text-sm leading-relaxed text-amber-700">
                  {sessionReason ??
                    'Phiên đăng nhập đã kết thúc. Việc này xảy ra khi tài khoản bị khoá hoặc mật khẩu vừa được đổi. Hãy đăng nhập lại để tiếp tục.'}
                </p>
              </div>
            )}

            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 animate-fade-in"
              >
                <AlertCircle size={17} className="mt-0.5 flex-shrink-0 text-red-500" />
                <p className="text-sm leading-relaxed text-red-600">{serverError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              <div>
                <label htmlFor="login-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email hoặc tên đăng nhập
                </label>
                <div className="relative">
                  <User size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    aria-invalid={Boolean(fieldErrors.username)}
                    className={`${baseInputClass} pr-4 ${fieldToneClass(Boolean(fieldErrors.username))}`}
                    placeholder="giaovien@truong.edu.vn hoặc mã học sinh"
                    value={form.username}
                    onChange={event => {
                      setForm({ ...form, username: event.target.value })
                      if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: undefined })
                    }}
                  />
                </div>
                {fieldErrors.username && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.username}</p>}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={`${baseInputClass} pr-12 ${fieldToneClass(Boolean(fieldErrors.password))}`}
                    placeholder="Nhập mật khẩu"
                    value={form.password}
                    onChange={event => {
                      setForm({ ...form, password: event.target.value })
                      if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined })
                    }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl text-base font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
              >
                {loading && !demoRole ? (
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

            {DEMO_ENABLED && (
              <section aria-labelledby="demo-accounts-title" className="rounded-2xl border border-dashed border-indigo-200 bg-white/75 p-4">
                <h2 id="demo-accounts-title" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700">
                  <Sparkles size={14} />
                  Xem thử bằng tài khoản mẫu
                </h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {DEMO_ACCOUNTS.map(account => {
                    const Icon = account.icon
                    const busy = loading && demoRole === account.role
                    return (
                      <button
                        key={account.role}
                        type="button"
                        disabled={loading}
                        onClick={() => handleDemo(account)}
                        onMouseEnter={() => setPointedRole(account.role)}
                        onMouseLeave={() => setPointedRole(null)}
                        onFocus={() => setPointedRole(account.role)}
                        onBlur={() => setPointedRole(null)}
                        className="demo-role flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-3 text-center hover:border-indigo-300 hover:shadow-md focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                          {busy ? (
                            <span className="ant-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                          ) : (
                            <Icon size={18} />
                          )}
                        </span>
                        <span className="text-[0.8rem] font-semibold leading-tight text-slate-800">{account.label}</span>
                        <span className="w-full truncate text-[0.7rem] leading-tight text-slate-400">{account.person}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-[0.72rem] leading-relaxed text-slate-500">
                  Dữ liệu mẫu do hệ thống tạo sẵn, bạn cứ thử thoải mái.
                </p>
              </section>
            )}

            <p className="text-xs text-slate-400">© {new Date().getFullYear()} Anthill</p>
          </div>
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
