import type { ReactNode } from 'react'
import { LayoutDashboard, UsersRound } from 'lucide-react'
import DashboardLayout from './DashboardLayout'
import type { SidebarMenuItem } from './Sidebar'

interface AdminLayoutProps {
  children: ReactNode
  pageTitle: string
  pageSubtitle?: string
}

const adminMenuItems: SidebarMenuItem[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', to: '/quan-tri' },
  { icon: UsersRound, label: 'Học sinh', to: '/quan-tri/hoc-sinh' },
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
