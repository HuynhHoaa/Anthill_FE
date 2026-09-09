import { mockAdminProfile, mockStudentProfile, mockTeacherProfile } from '../data/mockEduQuiz'
import { TOKEN_STORAGE_KEY } from '../lib/apiClient'
import { simulate } from '../lib/delay'
import type { UserProfile, UserRole } from '../types'

const SESSION_STORAGE_KEY = 'eduquiz.session'

export interface LoginPayload {
  username: string
  password: string
  role: UserRole
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

/** Mật khẩu dùng chung cho ba tài khoản demo được in sẵn trên trang đăng nhập. */
export const DEMO_PASSWORD = 'eduquiz123'

export interface DemoAccount {
  role: UserRole
  /** Chuỗi cần gõ vào ô đăng nhập: chỉ học sinh dùng tên đăng nhập, hai vai trò còn lại dùng email. */
  username: string
  password: string
  fullName: string
}

/**
 * Ba tài khoản demo, lấy thẳng từ hồ sơ mẫu để không bao giờ lệch với dữ liệu giả lập.
 * Trang đăng nhập in nguyên bộ này ra màn hình cho người xem thử.
 */
export const demoAccounts: Record<UserRole, DemoAccount> = {
  teacher: {
    role: 'teacher',
    username: mockTeacherProfile.email,
    password: DEMO_PASSWORD,
    fullName: mockTeacherProfile.fullName,
  },
  student: {
    role: 'student',
    username: mockStudentProfile.username,
    password: DEMO_PASSWORD,
    fullName: mockStudentProfile.fullName,
  },
  admin: {
    role: 'admin',
    username: mockAdminProfile.email,
    password: DEMO_PASSWORD,
    fullName: mockAdminProfile.fullName,
  },
}

/**
 * Hồ sơ gốc theo vai trò, dùng khi chưa có phiên nào được lưu. Viết dưới dạng Record để
 * thêm vai trò mà quên hồ sơ trở thành lỗi biên dịch, thay vì lặng lẽ đăng nhập nhầm khu vực.
 */
const defaultProfiles: Record<UserRole, UserProfile> = {
  teacher: mockTeacherProfile,
  student: mockStudentProfile,
  admin: mockAdminProfile,
}

function getDefaultProfile(role: UserRole): UserProfile {
  return { ...defaultProfiles[role] }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Trình duyệt chặn localStorage thì phiên chỉ tồn tại trong bộ nhớ, không cần báo lỗi.
  }
}

function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Không cần xử lý thêm.
  }
}

function parseProfile(raw: string): UserProfile | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<UserProfile>
    if (typeof candidate.id !== 'number') return null
    if (typeof candidate.role !== 'string' || !(candidate.role in defaultProfiles)) return null
    if (typeof candidate.fullName !== 'string') return null
    return candidate as UserProfile
  } catch {
    return null
  }
}

/** Đọc phiên hiện tại. Hàm đồng bộ vì RequireRole cần biết ngay khi render. */
export function getCurrentUser(): UserProfile | null {
  const raw = readStorage(SESSION_STORAGE_KEY)
  if (!raw) return null
  return parseProfile(raw)
}

export function logout(): void {
  removeStorage(SESSION_STORAGE_KEY)
  removeStorage(TOKEN_STORAGE_KEY)
}

function saveSession(profile: UserProfile): void {
  writeStorage(SESSION_STORAGE_KEY, JSON.stringify(profile))
}

/**
 * Đăng nhập bản demo. Chấp nhận DEMO_PASSWORD của ba tài khoản mẫu, đồng thời vẫn nhận
 * mọi mật khẩu không rỗng khác: bản demo không có backend nên khoá cứng mật khẩu chỉ làm
 * người xem bị kẹt ngoài cửa. Khi có backend thật, chỉ phần thân hàm này đổi, chữ ký giữ nguyên.
 */
export function login(payload: LoginPayload): Promise<UserProfile> {
  return simulate(() => {
    const username = payload.username.trim()
    if (!username) {
      throw new Error('Vui lòng nhập tên đăng nhập.')
    }
    const password = payload.password.trim()
    if (!password) {
      throw new Error('Vui lòng nhập mật khẩu.')
    }

    const defaults = getDefaultProfile(payload.role)
    // Gõ đúng email hoặc tên đăng nhập của tài khoản demo thì giữ nguyên tên đăng nhập thật
    // trong hồ sơ, để thẻ hồ sơ không hiển thị email ở dòng "Tên đăng nhập".
    const normalized = username.toLowerCase()
    const isDemoIdentity =
      normalized === defaults.username.toLowerCase() || normalized === defaults.email.toLowerCase()

    const profile: UserProfile = {
      ...defaults,
      username: isDemoIdentity ? defaults.username : username,
    }
    saveSession(profile)
    writeStorage(TOKEN_STORAGE_KEY, `demo-token.${payload.role}.${Date.now()}`)
    return profile
  })
}

export function fetchProfile(): Promise<UserProfile> {
  return simulate(() => {
    const profile = getCurrentUser()
    if (!profile) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }
    return { ...profile }
  })
}

export function updateProfile(payload: Partial<UserProfile>): Promise<UserProfile> {
  return simulate(() => {
    const profile = getCurrentUser()
    if (!profile) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }

    const fullName = (payload.fullName ?? profile.fullName).trim()
    if (!fullName) {
      throw new Error('Họ và tên không được để trống.')
    }

    const email = (payload.email ?? profile.email).trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email không đúng định dạng.')
    }

    const phone = (payload.phone ?? profile.phone ?? '').trim()
    if (phone && !/^[0-9\s.+-]{9,15}$/.test(phone)) {
      throw new Error('Số điện thoại không hợp lệ.')
    }

    // Không cho đổi id và vai trò từ phía giao diện.
    const updated: UserProfile = {
      ...profile,
      ...payload,
      id: profile.id,
      role: profile.role,
      fullName,
      email,
      phone,
    }
    saveSession(updated)
    return updated
  })
}

export function changePassword(payload: ChangePasswordPayload): Promise<void> {
  return simulate(() => {
    if (!payload.currentPassword.trim()) {
      throw new Error('Vui lòng nhập mật khẩu hiện tại.')
    }
    if (payload.newPassword.trim().length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.')
    }
    if (payload.newPassword === payload.currentPassword) {
      throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại.')
    }
    writeStorage(TOKEN_STORAGE_KEY, `demo-token.${Date.now()}`)
  })
}
