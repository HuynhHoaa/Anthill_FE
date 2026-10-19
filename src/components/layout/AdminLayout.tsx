import type { ReactNode } from 'react'
import { BookOpen, CalendarRange, GraduationCap, Users, UsersRound } from 'lucide-react'
import DashboardLayout from './DashboardLayout'
import type { SidebarMenuItem } from './Sidebar'

interface AdminLayoutProps {
  children: ReactNode
  pageTitle: string
  pageSubtitle?: string
  /** Công cụ của trang (nút quay lại, ô tìm kiếm...) đặt ở góc phải thanh tiêu đề. */
  headerTools?: ReactNode
  /** Nội dung sát thanh tiêu đề hơn, cho trang cần vừa một màn hình. */
  compactContent?: boolean
}

// "Nhóm lớp" và "Ngân hàng câu hỏi" dùng đúng biểu tượng như ở menu giáo viên để cùng một khái niệm có cùng một hình,
// nên "Học sinh" đổi sang Users — hai mục cạnh nhau mà chung một icon thì icon không còn phân biệt
// được gì.
const adminMenuItems: SidebarMenuItem[] = [
  { icon: UsersRound, label: 'Nhóm lớp', to: '/quan-tri/nhom-lop' },
  { icon: CalendarRange, label: 'Kỳ học', to: '/quan-tri/ky-hoc' },
  { icon: GraduationCap, label: 'Giáo viên', to: '/quan-tri/giao-vien' },
  { icon: Users, label: 'Học sinh', to: '/quan-tri/hoc-sinh' },
  { icon: BookOpen, label: 'Ngân hàng câu hỏi', to: '/quan-tri/cau-hoi' },
]

export default function AdminLayout({ children, pageTitle, pageSubtitle, headerTools, compactContent }: AdminLayoutProps) {
  return (
    <DashboardLayout
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
      basePath="/quan-tri"
      roleLabel="Quản trị viên"
      menuItems={adminMenuItems}
      headerTools={headerTools}
      compactContent={compactContent}
    >
      {children}
    </DashboardLayout>
  )
}
