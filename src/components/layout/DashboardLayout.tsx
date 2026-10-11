import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar, { type SidebarMenuItem } from './Sidebar'
import Header from './Header'
import { useAsync } from '../../hooks/useAsync'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { getInitials } from '../../lib/format'
import { getCurrentUser, logout } from '../../services/authService'
import { getUnreadCount } from '../../services/notificationService'

interface DashboardLayoutProps {
  children: ReactNode
  pageTitle: string
  pageSubtitle?: string
  /** Gốc đường dẫn của vai trò, ví dụ '/giao-vien'. Không có dấu gạch chéo cuối. */
  basePath: string
  roleLabel: string
  /** Dòng phụ dưới nhãn vai trò, ví dụ môn giảng dạy. */
  roleDetail?: string
  menuItems: SidebarMenuItem[]
  /** Ô tìm kiếm của trang: nằm trên thanh tiêu đề, còn trên màn hình hẹp thì đứng đầu nội dung. */
  headerSearch?: ReactNode
  /** Bỏ bớt khoảng trống phía trên nội dung, cho trang danh sách muốn thấy hết bảng và thanh trang trong một màn hình. */
  compactContent?: boolean
}

export default function DashboardLayout({
  children, pageTitle, pageSubtitle, basePath, roleLabel, roleDetail, menuItems, headerSearch, compactContent,
}: DashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  // Từ cỡ máy tính bảng trở lên ô tìm kiếm của trang nằm trên thanh tiêu đề; hẹp hơn thì thanh đó chỉ vừa
  // tiêu đề và cụm tài khoản nên ô tìm kiếm xuống đầu nội dung.
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  // Thiết bị cảm ứng không có trạng thái rê chuột thật. Thu về dải icon ở đó là
  // nhốt người dùng với icon không nhãn, vì không còn nút nào để mở ra.
  const canHover = useMediaQuery('(hover: hover)')
  // Dưới 1024px sidebar đã là drawer, thu gọn ở đó sẽ giấu mất nhãn và nút đóng.
  const isCollapsed = isDesktop && canHover
  const isPeeking = isCollapsed && peeking
  const { data: unreadCount } = useAsync(() => getUnreadCount(), [location.pathname])

  const handlePeekChange = (next: boolean) => {
    if (!isCollapsed) return
    setPeeking(next)
  }

  const currentUser = getCurrentUser()
  const userName = currentUser?.fullName ?? ''
  const initials = getInitials(userName)

  // Đổi trang thì đóng drawer
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Khoá cuộn nền khi drawer đang mở
  useEffect(() => {
    if (!sidebarOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen])

  const handleLogout = () => {
    logout()
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="flex">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        userName={userName}
        initials={initials}
        unreadCount={unreadCount ?? 0}
        basePath={basePath}
        roleLabel={roleLabel}
        roleDetail={roleDetail}
        menuItems={menuItems}
        collapsed={isCollapsed && !isPeeking}
        peeking={isPeeking}
        onPeekChange={handlePeekChange}
      />

      {sidebarOpen && (
        <div
          role="presentation"
          className="sidebar-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className={`main-content flex-1 min-w-0 ${isCollapsed ? 'is-collapsed' : ''}`}>
        <Header
          title={pageTitle}
          subtitle={pageSubtitle}
          userName={userName}
          initials={initials}
          unreadCount={unreadCount ?? 0}
          basePath={basePath}
          roleLabel={roleLabel}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          search={isTabletUp ? headerSearch : undefined}
        />
        <div className={compactContent ? 'px-4 pb-4 pt-3 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 lg:pt-4' : 'p-4 sm:p-6 lg:p-8'}>
          {!isTabletUp && headerSearch && <div className="mb-4">{headerSearch}</div>}
          {children}
        </div>
      </main>
    </div>
  )
}
