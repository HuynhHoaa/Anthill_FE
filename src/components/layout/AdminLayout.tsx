import type { ReactNode } from 'react'
import { LayoutDashboard, Users, UsersRound } from 'lucide-react'
import DashboardLayout from './DashboardLayout'
import type { SidebarMenuItem } from './Sidebar'

interface AdminLayoutProps {
  children: ReactNode
  pageTitle: string
  pageSubtitle?: string
}

// "Nhóm lớp" dùng đúng biểu tượng như ở menu giáo viên để cùng một khái niệm có cùng một hình,
// nên "Học sinh" đổi sang Users — hai mục cạnh nhau mà chung một icon thì icon không còn phân biệt
// được gì.
const adminMenuItems: SidebarMenuItem[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', to: '/quan-tri' },
  { icon: UsersRound, label: 'Nhóm lớp', to: '/quan-tri/nhom-lop' },
  { icon: Users, label: 'Học sinh', to: '/quan-tri/hoc-sinh' },
]

export default function AdminLayout({ children, pageTitle, pageSubtitle }: AdminLayoutProps) {
  return (
    <DashboardLayout
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
      basePath="/quan-tri"
      roleLabel="Quản trị viên"
      menuItems={adminMenuItems}
    >
      {children}
    </DashboardLayout>
  )
}
