/**
 * Xác thực và hồ sơ người dùng — nối vào API thật (§4.1).
 *
 * Phiên được giữ ở hai chỗ với hai mục đích khác nhau:
 * - `anthill.token` là JWT, do apiClient đọc để gắn vào mỗi request.
 * - `anthill.session` là bản sao hồ sơ, để `getCurrentUser()` trả lời được **ngay lập tức** khi
 *   `RequireRole` render. Không có nó thì mỗi lần tải trang mọi route đều nháy qua màn hình đăng
 *   nhập trong lúc chờ `/api/auth/me`.
 *
 * Bản sao đó chỉ dùng để dựng giao diện. Mọi quyết định về quyền đều do server đưa ra: vai trò
 * thật đọc từ cột `Role` trong database, nên sửa `anthill.session` trong DevTools chỉ đổi được
 * hình dạng menu, còn gọi API vẫn nhận 403 (§3 quy tắc ⑤).
 */
import { apiClient, clearStoredToken, setStoredToken } from '../lib/apiClient'
import type { UserProfile, UserRole } from '../types'

const SESSION_STORAGE_KEY = 'anthill.session'
/**
 * Cờ "phải đổi mật khẩu" của phiên hiện tại — cùng chỗ lưu với `anthill.session`, theo đúng cách
 * phiên đang được giữ (§5). Tách khoá riêng thay vì nhét vào `UserProfile` vì backend cũng để nó
 * là một trường ngang hàng `user` trong `LoginResponse`, không phải một cột của hồ sơ.
 */
const MUST_CHANGE_PASSWORD_STORAGE_KEY = 'anthill.mustChangePassword'

export interface LoginPayload {
  username: string
  password: string
  role: UserRole
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

const roles: Record<UserRole, true> = { teacher: true, student: true, admin: true }

interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresAt: string
  refreshToken?: string
  user: UserProfile
  mustChangePassword: boolean
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

/**
 * Bản ghi cũ sau khi đổi cấu trúc hồ sơ phải bị loại thay vì hydrate ra `undefined`.
 * Nếu bản sao hỏng, `getCurrentUser()` trả null và người dùng chỉ phải đăng nhập lại.
 */
function parseProfile(raw: string): UserProfile | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<UserProfile>
    if (typeof candidate.id !== 'number') return null
    if (typeof candidate.role !== 'string' || !(candidate.role in roles)) return null
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

/**
 * Tài khoản đang phải đổi mật khẩu trước khi làm bất cứ việc gì khác (§5) — mật khẩu do quản trị
 * viên cấp lúc tạo tài khoản hoặc cấp lại. Hàm đồng bộ cùng lý do với `getCurrentUser`: route guard
 * cần biết ngay khi render, không đợi một lượt gọi API.
 *
 * Đọc hỏng hay thiếu thì coi là `false` chứ không chặn nhầm: nguồn sự thật thật sự nằm ở server —
 * `MustChangePasswordMiddleware` vẫn chặn mọi endpoint nghiệp vụ nếu cờ database còn bật, dù màn
 * hình này có lỡ không hiện ra. Guard ở đây chỉ là trải nghiệm, không phải hàng rào an toàn duy nhất.
 */
export function getMustChangePassword(): boolean {
  return readStorage(MUST_CHANGE_PASSWORD_STORAGE_KEY) === '1'
}

function saveMustChangePassword(value: boolean): void {
  writeStorage(MUST_CHANGE_PASSWORD_STORAGE_KEY, value ? '1' : '0')
}

/**
 * Xoá phiên khỏi máy.
 *
 * Cố ý **không** gọi `POST /api/auth/logout`: token JWT không thu hồi được ở phía server, endpoint
 * đó chỉ ghi log, và nếu chờ nó thì mất mạng lúc đăng xuất sẽ giữ người dùng ở lại trong một phiên
 * họ vừa bảo là muốn thoát. Xoá cục bộ là dứt khoát và luôn thành công.
 */
export function logout(): void {
  removeStorage(SESSION_STORAGE_KEY)
  removeStorage(MUST_CHANGE_PASSWORD_STORAGE_KEY)
  clearStoredToken()
}

function saveSession(profile: UserProfile): void {
  writeStorage(SESSION_STORAGE_KEY, JSON.stringify(profile))
}

/**
 * Đăng nhập thật.
 *
 * Trường `role` gửi lên **chỉ để đối chiếu**: chọn nhầm vai trò trên giao diện thì server trả 403
 * kèm câu giải thích, chứ không phải cứ khai là được (§3 quy tắc ⑤).
 */
export async function login(payload: LoginPayload): Promise<UserProfile> {
  const username = payload.username.trim()
  if (!username) {
    throw new Error('Vui lòng nhập tên đăng nhập.')
  }
  if (!payload.password) {
    throw new Error('Vui lòng nhập mật khẩu.')
  }

  const response = await apiClient.post<LoginResponse>('/api/auth/login', {
    username,
    password: payload.password,
    role: payload.role,
  })

  // Lưu token TRƯỚC hồ sơ: apiClient đọc token cho mọi lời gọi sau, và một phiên có hồ sơ mà
  // không có token sẽ trông như đã đăng nhập trong khi mọi thao tác đều nhận 401.
  setStoredToken(response.accessToken)
  saveSession(response.user)
  // Ghi đúng giá trị server trả — kể cả `false`: một phiên đăng nhập lại sau khi đã đổi mật khẩu
  // phải xoá cờ cũ, không được để sót giá trị `true` của lần đăng nhập trước.
  saveMustChangePassword(response.mustChangePassword)

  return response.user
}

/** Hồ sơ mới nhất từ server, đồng thời làm tươi bản sao cục bộ. */
export async function fetchProfile(): Promise<UserProfile> {
  const profile = await apiClient.get<UserProfile>('/api/auth/me')
  saveSession(profile)
  return profile
}

/**
 * Cập nhật hồ sơ.
 *
 * Server chỉ nhận bốn trường; id, vai trò, mã học sinh và nhóm lớp không đổi được từ đây — đó là
 * việc của quản trị viên qua `/api/students`. Gửi thừa cũng vô hại vì binder bỏ qua, nhưng gửi
 * đúng những gì hợp đồng nói giúp người đọc code biết ranh giới nằm ở đâu.
 */
export async function updateProfile(payload: Partial<UserProfile>): Promise<UserProfile> {
  const current = getCurrentUser()

  const updated = await apiClient.put<UserProfile>('/api/auth/me', {
    fullName: (payload.fullName ?? current?.fullName ?? '').trim(),
    email: (payload.email ?? current?.email ?? '').trim(),
    phone: (payload.phone ?? current?.phone ?? '').trim() || undefined,
    school: (payload.school ?? current?.school ?? '').trim() || undefined,
  })

  saveSession(updated)
  return updated
}

/**
 * Đổi mật khẩu.
 *
 * Đổi xong, server xoay `SecurityStamp` nên **token hiện tại chết ngay lập tức** — đó là chủ đích,
 * để mật khẩu bị lộ không còn dùng được ở nơi khác. Vì vậy hàm này xoá phiên: mọi lời gọi tiếp theo
 * đều sẽ nhận 401, và đưa người dùng về trang đăng nhập ngay còn tử tế hơn để họ bấm vào một giao
 * diện đã chết.
 *
 * Cùng lúc đó server cũng tắt `MustChangePassword` (đúng chỗ đổi mật khẩu thành công — không có
 * nhánh nào trả 200 mà cờ đó còn bật). `logout()` xoá luôn bản sao cờ này ở máy thay vì tự đặt nó
 * thành `false`: không có gì để "lạc quan hoá" — token cũ đã chết nên không gọi lại `/auth/me` để
 * đọc giá trị mới được nữa, và giá trị đúng chỉ có sau khi đăng nhập lại bằng mật khẩu mới, lúc đó
 * `login()` ghi lại từ chính response của server.
 */
export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiClient.post('/api/auth/change-password', {
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword,
  })

  logout()
}
