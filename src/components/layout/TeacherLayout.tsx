import type { ReactNode } from 'react'
import { BarChart3, BookOpen, FileText, LayoutDashboard, UsersRound } from 'lucide-react'
import DashboardLayout from './DashboardLayout'
import type { SidebarMenuItem } from './Sidebar'
import { getCurrentUser } from '../../services/authService'

interface TeacherLayoutProps {
  children: ReactNode
  pageTitle: string
  pageSubtitle?: string
  headerSearch?: ReactNode
  compactContent?: boolean
}

const teacherMenuItems: SidebarMenuItem[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', to: '/giao-vien' },
  { icon: UsersRound, label: 'Nhóm lớp', to: '/giao-vien/nhom-lop' },
  { icon: FileText, label: 'Bài kiểm tra', to: '/giao-vien/bai-kiem-tra' },
  { icon: BookOpen, label: 'Ngân hàng câu hỏi', to: '/giao-vien/cau-hoi' },
  { icon: BarChart3, label: 'Kết quả', to: '/giao-vien/ket-qua' },
]

export default function TeacherLayout({ children, pageTitle, pageSubtitle, headerSearch, compactContent }: TeacherLayoutProps) {
  const currentUser = getCurrentUser()

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
      basePath="/giao-vien"
      roleLabel="Giáo viên"
      roleDetail={currentUser?.subject}
      menuItems={teacherMenuItems}
      headerSearch={headerSearch}
      compactContent={compactContent}
    >
      {children}
    </DashboardLayout>
  )
}
