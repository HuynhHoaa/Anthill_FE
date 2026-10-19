/**
 * Lối duy nhất từ frontend tới API: mọi hàm trong src/services gọi qua đây, trang không gọi fetch
 * trực tiếp. Gắn token, ghép VITE_API_BASE_URL với đường dẫn /api/... của từng service, đổi mã lỗi
 * HTTP thành thông điệp tiếng Việt, và báo cho App khi token mất hiệu lực giữa phiên (401) để App
 * đưa người dùng về trang đăng nhập.
 */
/** Token do authService lưu lại sau khi đăng nhập. */
export const TOKEN_STORAGE_KEY = 'anthill.token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** fetch ném lỗi (mất mạng, sai địa chỉ, CORS chặn) nghĩa là không có mã HTTP nào để tra bảng dưới. */
const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ.'

const statusMessages: Record<number, string> = {
  400: 'Dữ liệu gửi lên không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  409: 'Dữ liệu đã tồn tại trong hệ thống.',
  422: 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại các trường đã nhập.',
  429: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
  500: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
  502: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
  503: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
}

export interface ApiError extends Error {
  status: number
  /**
   * Lỗi theo từng trường, đúng như backend trả về trong <c>errors</c>.
   *
   * Bốn form của app đang hiện lỗi ngay dưới từng ô nhập. Nếu ở đây chỉ giữ lại <c>message</c> thì
   * mọi lỗi validate đều thành một dòng chung chung phía trên form, và người dùng phải tự dò xem
   * ô nào sai — trong khi server đã nói rõ ô nào rồi.
   *
   * Khoá là tên trường viết thường đầu (camelCase) như trong JSON gửi lên.
   */
  fieldErrors?: Record<string, string[]>
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  headers?: Record<string, string>
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // Trình duyệt chặn localStorage thì bỏ qua, phiên chỉ sống trong bộ nhớ.
  }
  notifyTokenChanged()
}

export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Không cần xử lý thêm.
  }
  notifyTokenChanged()
}

const tokenListeners = new Set<() => void>()

function notifyTokenChanged(): void {
  tokenListeners.forEach(listener => listener())
}

/**
 * Báo khi token đổi: đăng nhập, đăng xuất, 401 giữa phiên, hoặc một tab khác làm các việc đó.
 *
 * Kết nối realtime gắn với token chứ không với trang, nên nó cần biết ngay lúc token thay đổi để mở,
 * đóng hay nối lại. Sự kiện `storage` của trình duyệt chỉ bắn ở các tab KHÁC tab vừa ghi, vì vậy tab
 * đang ghi phải tự gọi `notifyTokenChanged` — hai nguồn bổ sung cho nhau, không trùng.
 *
 * Chữ ký (subscribe, getStoredToken) khớp thẳng với `useSyncExternalStore`.
 */
export function subscribeToken(listener: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    // key === null là localStorage.clear().
    if (event.key === null || event.key === TOKEN_STORAGE_KEY) listener()
  }

  tokenListeners.add(listener)
  window.addEventListener('storage', handleStorage)
  return () => {
    tokenListeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

export function createApiError(
  status: number,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ApiError {
  const error = new Error(message) as ApiError
  error.status = status
  if (fieldErrors) error.fieldErrors = fieldErrors
  return error
}

/**
 * Được gọi khi server trả 401 trên một request có kèm token.
 *
 * Backend xoay <c>SecurityStamp</c> khi tài khoản bị khoá hoặc đổi mật khẩu, nên một token còn hạn
 * vẫn có thể chết giữa phiên làm việc. Lúc đó người dùng đang cầm một giao diện trông như đã đăng
 * nhập nhưng mọi thao tác đều hỏng — phải đưa họ về trang đăng nhập thay vì để họ bấm mãi.
 *
 * Đăng ký từ tầng ứng dụng (nơi có router) thay vì gọi thẳng: lớp này không được biết gì về
 * react-router, nếu không nó thành thứ chỉ chạy được trong đúng một app.
 */
/** Nhận thông điệp server gửi kèm 401 — ví dụ "tài khoản đã bị khoá" — để trang đăng nhập nói đúng lý do. */
type UnauthorizedHandler = (message: string) => void

let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

/**
 * Đổi đường dẫn ảnh server trả về thành địa chỉ trình duyệt tải được.
 *
 * API lưu và trả đường dẫn tương đối (<c>/uploads/202609/a1b2.png</c>) để database không dính tên
 * miền của môi trường nào. Đường dẫn đó thuộc origin của API chứ không phải origin của trang: gắn
 * thẳng vào <c>img</c> thì trình duyệt đi hỏi máy chủ Vite và nhận về 404. URL đã có scheme
 * (<c>https:</c> của dịch vụ lưu ảnh sau này, <c>blob:</c> của ảnh xem trước) được giữ nguyên.
 *
 * Chỉ gọi lúc hiển thị, không gọi trong mapper của service: form sửa câu hỏi gửi lại đúng giá trị
 * đã đọc, nên đổi sớm là ghi địa chỉ tuyệt đối của máy đang chạy xuống database.
 */
export function resolveMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//')) return url
  const base = API_BASE_URL.replace(/\/+$/, '')
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

function getStatusMessage(status: number): string {
  return statusMessages[status] ?? `Yêu cầu không thành công (mã lỗi ${status}).`
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const base = API_BASE_URL.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const search = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === '') return
      search.set(key, String(value))
    })
  }
  const queryString = search.toString()
  return `${base}${normalizedPath}${queryString ? `?${queryString}` : ''}`
}

/**
 * Địa chỉ đầy đủ của một đường dẫn trên API, cho những chỗ không đi qua `apiRequest` — như kết nối
 * SignalR, nơi thư viện tự mở kết nối chứ không dùng fetch của mình.
 */
export function getApiUrl(path: string): string {
  return buildUrl(path)
}

/** Chỉ nhận đúng hình dạng { [ô]: [chuỗi] } mà backend cam kết, bỏ qua mọi thứ khác. */
function readFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const result: Record<string, string[]> = {}
  for (const [field, messages] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(messages)) {
      const texts = messages.filter((item): item is string => typeof item === 'string')
      if (texts.length > 0) result[field] = texts
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

/** Bóc thông điệp và lỗi theo trường từ body lỗi; thiếu thì lùi về thông điệp theo mã HTTP. */
async function readError(response: Response): Promise<{ message: string; fieldErrors?: Record<string, string[]> }> {
  try {
    const payload: unknown = await response.json()
    if (payload && typeof payload === 'object') {
      const candidate = payload as { message?: unknown; error?: unknown; errors?: unknown }
      const fieldErrors = readFieldErrors(candidate.errors)

      if (typeof candidate.message === 'string' && candidate.message) {
        return { message: candidate.message, fieldErrors }
      }
      if (typeof candidate.error === 'string' && candidate.error) {
        return { message: candidate.error, fieldErrors }
      }
      return { message: getStatusMessage(response.status), fieldErrors }
    }
  } catch {
    // Body không phải JSON, dùng thông điệp mặc định.
  }
  return { message: getStatusMessage(response.status) }
}

/** Đổi một response lỗi thành `ApiError` và ném ra; dùng chung cho mọi đường gọi API (JSON lẫn tải file). */
async function throwForFailure(response: Response, token: string | null): Promise<never> {
  const { message, fieldErrors } = await readError(response)

  // Chỉ đá về đăng nhập khi request CÓ mang token: 401 trên một lời gọi vốn không có token là
  // chuyện bình thường (sai mật khẩu ở màn đăng nhập), gọi handler ở đó chỉ tạo vòng lặp. Và token đó
  // phải còn là token đang dùng: một request treo qua lúc đăng xuất rồi đăng nhập tài khoản khác mà
  // nhận 401 thì không được đăng xuất nhầm phiên mới.
  if (response.status === 401 && token && token === getStoredToken()) {
    onUnauthorized?.(message)
  }

  throw createApiError(response.status, message, fieldErrors)
}

/**
 * Tải một file nhị phân (file mẫu Excel...). Endpoint cần token nên không dùng được thẻ `<a href>` trần: phải gọi bằng
 * fetch có header rồi đưa blob cho trình duyệt lưu (xem `saveBlob` ở lib/download).
 */
export async function apiDownload(path: string, signal?: AbortSignal): Promise<Blob> {
  const token = getStoredToken()

  let response: Response
  try {
    response = await fetch(buildUrl(path), {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    })
  } catch (caught) {
    if (signal?.aborted) throw caught
    throw createApiError(0, NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) {
    await throwForFailure(response, token)
  }

  return response.blob()
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, headers } = options
  const token = getStoredToken()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      signal,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    })
  } catch (caught) {
    // Người gọi tự huỷ (bỏ một ảnh đang tải để chọn ảnh khác, rời trang) thì trả nguyên lỗi huỷ:
    // đổi nó thành "Không kết nối được máy chủ" là báo một sự cố không hề xảy ra.
    if (signal?.aborted) throw caught
    throw createApiError(0, NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) {
    await throwForFailure(response, token)
  }

  if (response.status === 204) {
    return undefined as T
  }

  try {
    return (await response.json()) as T
  } catch {
    throw createApiError(response.status, 'Dữ liệu máy chủ trả về không hợp lệ.')
  }
}

export const apiClient = {
  get: <T>(path: string, query?: ApiRequestOptions['query'], signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  /** Gửi multipart. Không đặt Content-Type: trình duyệt phải tự ghi kèm boundary của FormData. */
  postForm: <T>(path: string, form: FormData, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'POST', body: form, signal }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  /** `body` chỉ dùng khi server đòi một thân cho thao tác xoá (ví dụ lý do gỡ học sinh khỏi lớp). */
  remove: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'DELETE', body }),
}
