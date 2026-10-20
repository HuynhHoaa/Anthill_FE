import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  GraduationCap, LayoutDashboard, BarChart3, ChevronDown,
  Bell, UserCircle, LogOut, Menu, X, Lock,
} from 'lucide-react'
import { useDropdownMenu } from '../../hooks/useDropdownMenu'
import { useUnreadCount } from '../../hooks/useRealtime'
import { getInitials } from '../../lib/format'
import { describeStudyLoad, listMyGroupsCached } from '../../services/myLearningService'
import type { MyGroup } from '../../types'
import { getCurrentUser, logout } from '../../services/authService'
import AnthillMark from '../brand/AnthillMark'

interface StudentLayoutProps {
  children: ReactNode
  /**
   * Chế độ đang làm bài: giấu toàn bộ điều hướng, chỉ để lại thương hiệu và một dòng nhắc.
   *
   * Trong lúc thi, mọi liên kết trên thanh trên cùng đều là một cái bẫy: chạm nhầm vào "Kết quả
   * của tôi" hay "Đăng xuất" là rời phòng thi ngay, không cảnh báo, trong khi đồng hồ vẫn chạy.
   * Dựng một hộp xác nhận trước mỗi liên kết (như `useUnsavedChangesGuard` làm ở các biểu mẫu) vẫn
   * tệ hơn là bỏ hẳn liên kết đi. Đang thi thì không có việc gì phải đi đâu cả.
   */
  examMode?: boolean
}

const menu = [
  { icon: LayoutDashboard, label: 'Tổng quan', to: '/hoc-sinh', end: true },
  // `also`: các trang con không nằm dưới đường dẫn của mục nhưng vẫn thuộc mục đó (màn giới thiệu bài, chi tiết bài làm).
  { icon: GraduationCap, label: 'Lớp học của tôi', to: '/hoc-sinh/lop-hoc', end: false, also: ['/hoc-sinh/bai-kiem-tra'] },
  { icon: BarChart3, label: 'Bảng điểm', to: '/hoc-sinh/bang-diem', end: false, also: ['/hoc-sinh/ket-qua'] },
]

export default function StudentLayout({ children, examMode = false }: StudentLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isInSection = (isActive: boolean, also?: string[]) =>
    isActive || (also ?? []).some(prefix => location.pathname.startsWith(prefix))
  const [mobileOpen, setMobileOpen] = useState(false)

  const currentUser = getCurrentUser()
  const userName = currentUser?.fullName ?? ''
  // Một em có thể học nhiều lớp với tên dài: dòng dưới tên ở thanh đầu trang chỉ ghi gọn (tên lớp nếu một lớp, "N môn" nếu nhiều lớp),
  // danh sách đầy đủ nằm trong menu tài khoản. Môn của lớp là môn của giáo viên phụ trách nên lấy từ danh sách lớp của em.
  const [myGroups, setMyGroups] = useState<MyGroup[] | null>(null)
  useEffect(() => {
    let cancelled = false
    listMyGroupsCached(currentUser?.id)
      .then(groups => { if (!cancelled) setMyGroups(groups) })
      .catch(() => { /* thanh đầu trang chỉ là nhãn phụ: lỗi mạng thì rơi về tên lớp trong hồ sơ */ })
    return () => { cancelled = true }
  }, [currentUser?.id])
  const userGroups: Array<{ id: number; name: string; subjectName?: string | null }> = myGroups ?? currentUser?.groups ?? []
  // Chưa nạp xong danh sách lớp thì chưa biết môn: không đoán (một nhãn "Chưa gán môn" thoáng qua là sai), chỉ ghi tên lớp nếu em có đúng một lớp.
  const userGroup = myGroups
    ? describeStudyLoad(myGroups)
    : userGroups.length === 1 ? userGroups[0].name : 'Học sinh'
  const unreadBadge = useUnreadCount()

  // Đổi trang thì đóng menu thu gọn
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Menu tài khoản (hồ sơ, thông báo, đăng xuất) mở ra từ tên học sinh, giống menu của giáo viên và quản trị
  // viên. Đăng xuất không còn nằm lộ trên thanh để khỏi bấm nhầm. Bàn phím, Escape, bấm ra ngoài: xem
  // `useDropdownMenu`, dùng chung với `Header`.
  const accountMenu = useDropdownMenu()
  const closeAccountMenu = accountMenu.close

  // Đổi trang thì đóng menu, kể cả khi đến từ một liên kết ngoài menu (chuông, thanh trên cùng).
  useEffect(() => {
    closeAccountMenu()
  }, [location.pathname, closeAccountMenu])

  const handleLogout = () => {
    logout()
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            {examMode ? (
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FF8400, #FFA01F)' }}
                >
                  <AnthillMark size={22} className="text-[#2D2A24]" dotColor="#FBF7EE" />
                </div>
                <span className="font-bold text-xl text-slate-800">Anthill</span>
              </div>
            ) : (
              <NavLink to="/hoc-sinh" className="flex items-center gap-2.5 flex-shrink-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FF8400, #FFA01F)' }}
                >
                  <AnthillMark size={22} className="text-[#2D2A24]" dotColor="#FBF7EE" />
                </div>
                <span className="font-bold text-xl text-slate-800">Anthill</span>
              </NavLink>
            )}

            {examMode && (
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <Lock size={14} />
                <span className="hidden sm:inline">Đang trong giờ làm bài</span>
                <span className="sm:hidden">Đang thi</span>
              </div>
            )}

            <div className={`hidden md:flex items-center gap-1 ${examMode ? 'invisible pointer-events-none' : ''}`}>
              {menu.map(({ label, to, end, also }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isInSection(isActive, also)
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>

            <div className={`flex items-center gap-2.5 flex-shrink-0 ${examMode ? 'hidden' : ''}`}>
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

              <div className="relative" {...accountMenu.containerProps}>
                <button
                  type="button"
                  {...accountMenu.triggerProps}
                  // Dưới cỡ lg tên bị ẩn, nút chỉ còn chữ viết tắt: cần một tên truy cập đọc ra được.
                  aria-label={userName ? `Tài khoản của ${userName}` : 'Tài khoản'}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                  >
                    {getInitials(userName)}
                  </span>
                  <span className="hidden lg:block text-left">
                    <span className="block text-sm font-semibold text-slate-800 leading-none max-w-32 truncate">
                      {userName}
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5 max-w-32 truncate">{userGroup}</span>
                  </span>
                  {/* Luôn hiện: ở bề hẹp nút chỉ có hai chữ cái, mũi tên là dấu hiệu duy nhất đây là menu. */}
                  <ChevronDown
                    size={15}
                    className={`text-slate-400 transition-transform ${accountMenu.open ? 'rotate-180' : ''}`}
                  />
                </button>

                {accountMenu.open && (
                  <div
                    {...accountMenu.menuProps}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden z-40 animate-fade-in"
                  >
                    <div className="px-4 py-3 border-b border-slate-50">
                      <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
                      {userGroups.length <= 1 ? (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{userGroup}</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto" aria-label="Các lớp đang học">
                          {userGroups.map(group => (
                            <li key={group.id} className="text-xs text-slate-400 truncate" title={group.name}>
                              {group.subjectName ? `${group.subjectName} · ${group.name}` : group.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <NavLink
                      to="/hoc-sinh/ho-so"
                      role="menuitem"
                      // Đang đứng ở chính trang này thì đường dẫn không đổi, menu sẽ không tự đóng.
                      onClick={() => accountMenu.close(true)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <UserCircle size={16} className="text-slate-400" />
                      Hồ sơ cá nhân
                    </NavLink>
                    <NavLink
                      to="/hoc-sinh/thong-bao"
                      role="menuitem"
                      onClick={() => accountMenu.close(true)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Bell size={16} className="text-slate-400" />
                      Thông báo
                      {unreadBadge > 0 && (
                        <span className="ml-auto text-xs font-bold text-red-500">{unreadBadge}</span>
                      )}
                    </NavLink>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors border-t border-slate-50"
                    >
                      <LogOut size={16} />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>

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

        {mobileOpen && !examMode && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
            {menu.map(({ icon: Icon, label, to, end, also }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isInSection(isActive, also) ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'
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
