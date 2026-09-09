import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../types'
import { getCurrentUser } from '../services/authService'

interface RequireRoleProps {
  role: UserRole
  children: ReactNode
}

const dashboardPath: Record<UserRole, string> = {
  teacher: '/giao-vien',
  student: '/hoc-sinh',
  admin: '/quan-tri',
}

export default function RequireRole({ role, children }: RequireRoleProps) {
  const currentUser = getCurrentUser()
  const location = useLocation()

  // Mang theo địa chỉ đang muốn vào để đăng nhập xong thì quay lại đúng chỗ đó.
  // Không có nó thì một liên kết chia sẻ kèm bộ lọc — /giao-vien/ket-qua?nhom=Lớp%2010A — sẽ thả
  // người nhận ở trang tổng quan, và họ không biết mình vừa được gửi cái gì.
  if (!currentUser) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname + location.search }} />
  }

  if (currentUser.role !== role) return <Navigate to={dashboardPath[currentUser.role]} replace />

  return <>{children}</>
}
