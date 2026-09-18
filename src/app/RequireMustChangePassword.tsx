import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { UserRole } from '../types'
import { getCurrentUser, getMustChangePassword } from '../services/authService'

const dashboardPath: Record<UserRole, string> = {
  teacher: '/giao-vien',
  student: '/hoc-sinh',
  admin: '/quan-tri',
}

/**
 * Gác cổng cho `ForceChangePasswordPage` (§5) — mặt còn lại của `RequireRole`.
 *
 * `RequireRole` đưa người dùng TỚI đây khi cờ bật; component này quyết định ai được Ở lại đây:
 * chưa đăng nhập thì về trang đăng nhập, đã đổi mật khẩu xong (cờ tắt) thì không có lý do gì đứng ở
 * màn hình này nữa — về thẳng trang tổng quan của vai trò mình, tránh gõ lại URL cũ mà thấy một
 * form không còn cần thiết.
 */
export default function RequireMustChangePassword({ children }: { children: ReactNode }) {
  const currentUser = getCurrentUser()

  if (!currentUser) {
    return <Navigate to="/dang-nhap" replace />
  }

  if (!getMustChangePassword()) {
    return <Navigate to={dashboardPath[currentUser.role]} replace />
  }

  return <>{children}</>
}
