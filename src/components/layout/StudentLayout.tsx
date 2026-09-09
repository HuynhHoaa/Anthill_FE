import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  GraduationCap, LayoutDashboard, FileText, BarChart3,
  Bell, UserCircle, LogOut, Menu, X,
} from 'lucide-react'
import { useAsync } from '../../hooks/useAsync'
import { getInitials } from '../../lib/format'
import { getCurrentUser, logout } from '../../services/authService'
import { getUnreadCount } from '../../services/notificationService'

interface StudentLayoutProps {
  children: ReactNode
}

const menu = [
  { icon: LayoutDashboard, label: 'Tổng quan', to: '/hoc-sinh', end: true },
  { icon: FileText, label: 'Bài kiểm tra của tôi', to: '/hoc-sinh/bai-kiem-tra', end: false },
  { icon: BarChart3, label: 'Kết quả của tôi', to: '/hoc-sinh/ket-qua', end: false },
]

export default function StudentLayout({ children }: StudentLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: unreadCount } = useAsync(() => getUnreadCount('student'), [location.pathname])

  const currentUser = getCurrentUser()
  const userName = currentUser?.fullName ?? ''
  const userGroup = currentUser?.group ?? 'Học sinh'
  const unreadBadge = unreadCount ?? 0

  // Đổi trang thì đóng menu thu gọn
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            <NavLink to="/hoc-sinh" className="flex items-center gap-2.5 flex-shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              >
                <GraduationCap size={20} className="text-white" />
              </div>
              <span className="font-bold text-xl text-slate-800">EduQuiz</span>
            </NavLink>

            <div className="hidden md:flex items-center gap-1">
              {menu.map(({ label, to, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <NavLink
                to="/hoc-sinh/thong-bao"
                aria-label="Thông báo"
                className="relative w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <Bell size={17} />
                {unreadBadge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadBadge > 9 ? '9+' : unreadBadge}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/hoc-sinh/ho-so"
                className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-slate-50 transition-colors"
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                >
                  {getInitials(userName)}
                </span>
                <span className="hidden lg:block">
                  <span className="block text-sm font-semibold text-slate-800 leading-none max-w-32 truncate">
                    {userName}
                  </span>
                  <span className="block text-xs text-slate-400 mt-0.5">{userGroup}</span>
                </span>
              </NavLink>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <LogOut size={15} />
                <span>Đăng xuất</span>
              </button>

              <button
                type="button"
                aria-label="Mở menu"
                className="md:hidden w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500"
                onClick={() => setMobileOpen(current => !current)}
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
            {menu.map(({ icon: Icon, label, to, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/hoc-sinh/thong-bao"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Bell size={16} />
              Thông báo
              {unreadBadge > 0 && <span className="ml-auto text-xs font-bold text-red-500">{unreadBadge}</span>}
            </NavLink>
            <NavLink
              to="/hoc-sinh/ho-so"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <UserCircle size={16} />
              Hồ sơ cá nhân
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  )
}
