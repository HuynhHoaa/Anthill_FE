import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, BookOpen, Compass, FileText, GraduationCap,
  Home, UserCircle, Users, type LucideIcon,
} from 'lucide-react'
import { getCurrentUser } from '../../../services/authService'
import type { UserRole } from '../../../types'

interface QuickLink {
  to: string
  label: string
  icon: LucideIcon
}

const dashboardPath: Record<UserRole, string> = {
  teacher: '/giao-vien',
  student: '/hoc-sinh',
  admin: '/quan-tri',
}

const dashboardLabel: Record<UserRole, string> = {
  teacher: 'Về trang quản lý',
  student: 'Về trang tổng quan',
  admin: 'Về trang quản trị',
}

const quickLinks: Record<UserRole, QuickLink[]> = {
  teacher: [
    { to: '/giao-vien/bai-kiem-tra', label: 'Bài kiểm tra', icon: FileText },
    { to: '/giao-vien/cau-hoi', label: 'Ngân hàng câu hỏi', icon: BookOpen },
    { to: '/giao-vien/ket-qua', label: 'Kết quả', icon: BarChart3 },
  ],
  student: [
    { to: '/hoc-sinh/bai-kiem-tra', label: 'Bài kiểm tra của tôi', icon: FileText },
    { to: '/hoc-sinh/ket-qua', label: 'Kết quả của tôi', icon: BarChart3 },
    { to: '/hoc-sinh/ho-so', label: 'Hồ sơ cá nhân', icon: UserCircle },
  ],
  admin: [
    { to: '/quan-tri/hoc-sinh', label: 'Học sinh', icon: Users },
    { to: '/quan-tri/ho-so', label: 'Hồ sơ cá nhân', icon: UserCircle },
  ],
}

export default function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentUser = getCurrentUser()
  const homePath = currentUser ? dashboardPath[currentUser.role] : '/dang-nhap'
  const homeLabel = currentUser ? dashboardLabel[currentUser.role] : 'Đến trang đăng nhập'
  const links = currentUser ? quickLinks[currentUser.role] : []

  // Không có lịch sử để lùi lại thì đưa thẳng về nơi an toàn thay vì bấm không phản hồi.
  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(homePath, { replace: true })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #EEF2FF 0%, #F8FAFC 45%, #F5F3FF 100%)' }}
    >
      <div
        className="absolute -top-32 -left-24 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'rgba(99, 102, 241, 0.08)' }}
      />
      <div
        className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: 'rgba(139, 92, 246, 0.08)' }}
      />

      <div className="relative w-full max-w-xl animate-fade-in-up">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
          >
            <GraduationCap size={22} className="text-white" />
          </div>
          <span className="font-bold text-2xl gradient-text">EduQuiz</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 sm:px-10 py-10 text-center">
          <p className="text-[6rem] sm:text-[7rem] leading-none font-extrabold gradient-text select-none">404</p>

          <h1 className="text-2xl font-bold text-slate-800 mt-4">Không tìm thấy trang bạn cần</h1>
          <p className="text-sm text-slate-500 mt-2.5 leading-relaxed max-w-md mx-auto">
            Đường dẫn có thể đã bị đổi tên, bài kiểm tra đã bị xoá, hoặc bạn gõ nhầm một ký tự.
            Đừng lo, mọi thứ vẫn còn nguyên ở trang chính.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 max-w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <Compass size={14} className="text-slate-400 flex-shrink-0" />
            <span className="text-xs text-slate-500 font-medium break-all">{location.pathname}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-8">
            <NavLink
              to={homePath}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              <Home size={15} />
              {homeLabel}
            </NavLink>
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <ArrowLeft size={15} />
              Quay lại trang trước
            </button>
          </div>

          {links.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3.5">
                Có thể bạn đang tìm
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {links.map(({ to, label, icon: LinkIcon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    <LinkIcon size={14} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </div>

        {!currentUser && (
          <p className="text-center text-xs text-slate-400 mt-5">
            Bạn chưa đăng nhập nên hệ thống sẽ đưa bạn tới trang đăng nhập.
          </p>
        )}
      </div>
    </div>
  )
}
