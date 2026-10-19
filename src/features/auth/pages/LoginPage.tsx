import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  GraduationCap, Eye, EyeOff, BookOpen, Users, Award,
  AlertCircle,
} from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { getCurrentUser, login } from '../../../services/authService'
import type { UserRole } from '../../../types'

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
  'w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all bg-white placeholder:text-slate-400 placeholder:font-normal'

function fieldToneClass(hasError: boolean): string {
  return hasError
    ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-50'
    : 'border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'
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
    if (nextErrors.username || nextErrors.password) return

    setLoading(true)
    try {
      const profile = await login({ username: form.username.trim(), password: form.password })

      navigate(resolveReturnPath(returnTo, dashboardPath[profile.role]), { replace: true })
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'Đăng nhập không thành công. Vui lòng thử lại.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — Branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #312E81 0%, #4F46E5 50%, #7C3AED 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <GraduationCap size={26} className="text-white" />
          </div>
          <span className="text-white font-bold text-3xl tracking-tight">Anthill</span>
        </div>

        {/* Center text */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-white font-bold text-4xl leading-tight mb-4">
              Hệ thống kiểm tra<br />trực tuyến thông minh
            </h2>
            <p className="text-indigo-200 text-lg leading-relaxed">
              Tạo bài kiểm tra, quản lý học sinh và theo dõi kết quả — tất cả trong một nơi.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: BookOpen, text: 'Ngân hàng câu hỏi phân loại theo độ khó' },
              { icon: Users,    text: 'Giao bài cho học sinh theo nhóm/lớp' },
              { icon: Award,    text: 'Tự động chấm điểm và thống kê kết quả' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <Icon size={16} className="text-white" />
                </div>
                <span className="text-white text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-indigo-300 text-sm">
          © {new Date().getFullYear()} Anthill — Đồng hành cùng thầy cô và học sinh.
        </p>
      </div>

      {/* RIGHT — Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="font-bold text-2xl gradient-text">Anthill</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Đăng nhập</h1>
            <p className="text-slate-500">Chào mừng bạn trở lại! 👋</p>
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
              className="mb-5 flex items-start gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 animate-fade-in"
            >
              <AlertCircle size={17} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700 leading-relaxed">
                Đổi mật khẩu thành công. Hãy đăng nhập lại bằng mật khẩu mới.
              </p>
            </div>
          )}

          {sessionExpired && !serverError && !passwordChanged && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 animate-fade-in"
            >
              <AlertCircle size={17} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 leading-relaxed">
                {sessionReason ??
                  'Phiên đăng nhập đã kết thúc. Việc này xảy ra khi tài khoản bị khoá hoặc mật khẩu vừa được đổi. Hãy đăng nhập lại để tiếp tục.'}
              </p>
            </div>
          )}

          {serverError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 animate-fade-in"
            >
              <AlertCircle size={17} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 leading-relaxed">{serverError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            <div>
              <label htmlFor="login-username" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email hoặc tên đăng nhập
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                aria-invalid={Boolean(fieldErrors.username)}
                className={`${baseInputClass} ${fieldToneClass(Boolean(fieldErrors.username))}`}
                placeholder="giaovien@truong.edu.vn hoặc mã học sinh"
                value={form.username}
                onChange={event => {
                  setForm({ ...form, username: event.target.value })
                  if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: undefined })
                }}
              />
              {fieldErrors.username && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.username}</p>}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.password}</p>}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold text-base text-white transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: loading ? '#818cf8' : 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang đăng nhập...
                </>
              ) : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>

      <Modal
        open={forgotOpen}
        title="Quên mật khẩu?"
        description="Tính năng tự đặt lại mật khẩu sẽ có ở phiên bản tiếp theo."
        onClose={() => setForgotOpen(false)}
        size="sm"
      >
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
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
