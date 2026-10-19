import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../types'
import { getCurrentUser, getMustChangePassword } from '../services/authService'

interface RequireRoleProps {
  role: UserRole
  children: ReactNode
}

const dashboardPath: Record<UserRole, string> = {
  teacher: '/giao-vien',
  student: '/hoc-sinh',
  admin: '/quan-tri/nhom-lop',
}

export default function RequireRole({ role, children }: RequireRoleProps) {
  const currentUser = getCurrentUser()
  const location = useLocation()

  // Mang theo địa chỉ đang muốn vào để đăng nhập xong thì quay lại đúng chỗ đó.
  // Không có nó thì một liên kết chia sẻ kèm bộ lọc trên địa chỉ (ví dụ /giao-vien/cau-hoi?q=...) sẽ thả
  // người nhận ở trang tổng quan, và họ không biết mình vừa được gửi cái gì.
  if (!currentUser) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname + location.search }} />
  }

  if (currentUser.role !== role) return <Navigate to={dashboardPath[currentUser.role]} replace />

  // Mật khẩu do quản trị viên cấp (tạo tài khoản, cấp lại) còn hiệu lực: không phần nào khác của hệ
  // thống được vào cho tới khi đổi xong (§5). Đặt SAU hai kiểm ở trên để một người chưa đăng nhập
  // hay sai vai trò vẫn nhận đúng lý do của họ, không bị che bởi lý do này.
  if (getMustChangePassword()) {
    return <Navigate to="/doi-mat-khau" replace />
  }

  return <>{children}</>
}
