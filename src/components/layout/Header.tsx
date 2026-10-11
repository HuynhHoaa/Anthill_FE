import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Menu, UserCircle } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  userName: string
  initials: string
  unreadCount: number
  /** Gốc đường dẫn của vai trò, ví dụ '/giao-vien'. Không có dấu gạch chéo cuối. */
  basePath: string
  roleLabel: string
  onOpenSidebar: () => void
  onLogout: () => void
  /** Công cụ của trang (ô tìm kiếm, bộ lọc, nút tạo mới), đặt giữa tiêu đề và mép phải để khỏi chiếm một hàng riêng. */
  tools?: ReactNode
}

export default function Header({
  title, subtitle, userName, initials, unreadCount, basePath, roleLabel, onOpenSidebar, onLogout, tools,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <header className="bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Mở menu"
          className="lg:hidden w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">{title}</h1>
          <p className="text-sm text-slate-400 mt-0.5 truncate">{subtitle ?? today}</p>
        </div>
      </div>

      {tools && <div className="flex-1 min-w-0 flex justify-end">{tools}</div>}

      {/* Từ cỡ lg thanh bên luôn hiện và đã có sẵn chuông, hồ sơ, đăng xuất, nên cụm này chỉ còn ở màn hình
          hẹp, nơi thanh bên là ngăn kéo phải mở mới thấy. */}
      <div className="flex items-center gap-2.5 flex-shrink-0 lg:hidden">
        <NavLink
          to={`${basePath}/thong-bao`}
          aria-label="Thông báo"
          className="relative w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </NavLink>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(current => !current)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
            >
              {initials}
            </span>
            <span className="hidden sm:block text-sm font-semibold text-slate-700 max-w-32 truncate">
              {userName}
            </span>
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden z-30 animate-fade-in"
            >
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{roleLabel}</p>
              </div>
              <Link
                to={`${basePath}/ho-so`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <UserCircle size={16} className="text-slate-400" />
                Hồ sơ cá nhân
              </Link>
              <Link
                to={`${basePath}/thong-bao`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Bell size={16} className="text-slate-400" />
                Thông báo
                {unreadCount > 0 && (
                  <span className="ml-auto text-xs font-bold text-red-500">{unreadCount}</span>
                )}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors border-t border-slate-50"
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
