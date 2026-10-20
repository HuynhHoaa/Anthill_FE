import type { FocusEvent } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell, UserCircle, LogOut, ChevronRight, X, type LucideIcon,
} from 'lucide-react'
import UserAvatar from '../common/UserAvatar'
import AnthillMark from '../brand/AnthillMark'

export interface SidebarMenuItem {
  icon: LucideIcon
  label: string
  to: string
}

interface SidebarProps {
  open: boolean
  onClose: () => void
  onLogout: () => void
  userName: string
  initials: string
  /** Ảnh đại diện của người dùng; bỏ trống thì vẽ chữ cái đầu. */
  avatarUrl?: string
  unreadCount: number
  /** Gốc đường dẫn của vai trò, ví dụ '/giao-vien'. Không có dấu gạch chéo cuối. */
  basePath: string
  roleLabel: string
  /** Dòng phụ dưới nhãn vai trò, ví dụ môn giảng dạy. */
  roleDetail?: string
  menuItems: SidebarMenuItem[]
  /** Thu về dải icon. Chỉ có tác dụng từ 1024px trở lên và trên thiết bị có rê chuột. */
  collapsed: boolean
  /** Đang nở tạm do rê chuột hoặc tiêu điểm bàn phím. */
  peeking: boolean
  onPeekChange: (peeking: boolean) => void
}

export default function Sidebar({
  open, onClose, onLogout, userName, initials, avatarUrl, unreadCount,
  basePath, roleLabel, roleDetail, menuItems, collapsed, peeking, onPeekChange,
}: SidebarProps) {
  const trimmedRoleDetail = roleDetail?.trim()
  const userCardTitle = trimmedRoleDetail
    ? `${userName} — ${roleLabel} · ${trimmedRoleDetail}`
    : `${userName} — ${roleLabel}`

  // Tiêu điểm bàn phím cũng phải mở sidebar, nếu không người dùng Tab vào dải icon
  // sẽ không đọc được nhãn nào. Chỉ đóng khi tiêu điểm rời hẳn ra ngoài.
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    onPeekChange(false)
  }

  return (
    <aside
      className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''} ${peeking ? 'is-peeking' : ''}`}
      onMouseEnter={() => onPeekChange(true)}
      onMouseLeave={() => onPeekChange(false)}
      onFocus={() => onPeekChange(true)}
      onBlur={handleBlur}
    >
      {/* Logo */}
      <div
        className={`group flex items-center py-5 ${collapsed ? 'justify-center px-3' : 'gap-2.5 px-6'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#FF8400' }}
        >
          <AnthillMark size={22} className="text-[#2D2A24] wiggle-on-hover" dotColor="#FBF7EE" />
        </div>
        {!collapsed && (
          <>
            <span className="text-white font-bold text-xl tracking-tight flex-1">Anthill</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng menu"
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-indigo-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </>
        )}
      </div>

      {/* Thông tin người dùng */}
      <NavLink
        to={`${basePath}/ho-so`}
        title={collapsed ? userCardTitle : undefined}
        className={`flex items-center py-3 mx-2 mt-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-4'
        }`}
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          initials={initials}
          className="w-10 h-10 rounded-full text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{userName}</p>
            <p className="text-xs text-indigo-300 whitespace-nowrap">{roleLabel}</p>
            {trimmedRoleDetail && (
              <p className="text-[11px] text-indigo-400 truncate">{trimmedRoleDetail}</p>
            )}
          </div>
        )}
      </NavLink>

      {/* Điều hướng */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {menuItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === basePath}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">{label}</span>
                <ChevronRight size={14} style={{ opacity: 0.4 }} />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Khu vực dưới cùng */}
      <div className="px-2 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <NavLink
          to={`${basePath}/thong-bao`}
          title={collapsed ? (unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo') : undefined}
          className={({ isActive }) => `sidebar-item relative ${isActive ? 'active' : ''}`}
        >
          <Bell size={18} className="flex-shrink-0" />
          {collapsed ? (
            unreadCount > 0 && (
              <>
                <span aria-hidden="true" className="absolute top-1.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-400 opacity-60 animate-ping motion-reduce:animate-none" />
                <span
                  className="absolute top-1.5 right-2.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: '#ef4444', borderColor: '#352F27' }}
                />
              </>
            )
          ) : (
            <>
              <span className="flex-1">Thông báo</span>
              {unreadCount > 0 && (
                <span className="relative flex">
                  <span aria-hidden="true" className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping motion-reduce:animate-none" />
                  <span
                    className="relative text-white text-xs rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center font-bold"
                    style={{ background: '#ef4444' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              )}
            </>
          )}
        </NavLink>
        <NavLink
          to={`${basePath}/ho-so`}
          title={collapsed ? 'Hồ sơ cá nhân' : undefined}
          className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
        >
          <UserCircle size={18} className="flex-shrink-0" />
          {!collapsed && <span className="flex-1">Hồ sơ cá nhân</span>}
        </NavLink>
        <button
          type="button"
          title={collapsed ? 'Đăng xuất' : undefined}
          className="sidebar-item"
          // 100% rộng cộng hai lề 0.5rem của `.sidebar-item` thì tràn 16px và lệch phải 8px so với các mục
          // khác; các mục kia là liên kết nên tự vừa khung, còn nút thì phải trừ lề.
          style={{ color: '#fca5a5', width: 'calc(100% - 1rem)' }}
          onClick={onLogout}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  )
}
