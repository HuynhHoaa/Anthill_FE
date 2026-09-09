import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
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

  if (!currentUser) return <Navigate to="/dang-nhap" replace />
  if (currentUser.role !== role) return <Navigate to={dashboardPath[currentUser.role]} replace />

  return <>{children}</>
}
