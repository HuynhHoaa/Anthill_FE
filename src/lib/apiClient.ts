/**
 * Wrapper fetch chờ sẵn cho backend thật.
 * HIỆN CHƯA ĐƯỢC DÙNG Ở ĐÂU: toàn bộ dữ liệu đang đi qua tầng mock trong src/services.
 * Khi API sẵn sàng, chỉ cần thay phần thân của từng hàm service bằng apiClient,
 * chữ ký hàm giữ nguyên nên các trang không phải sửa gì.
 */
import { NETWORK_ERROR_MESSAGE } from './delay'

/** Token do authService lưu lại sau khi đăng nhập. */
export const TOKEN_STORAGE_KEY = 'eduquiz.token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

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
}

export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Không cần xử lý thêm.
  }
}

export function createApiError(status: number, message: string): ApiError {
  const error = new Error(message) as ApiError
  error.status = status
  return error
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

/** Lấy thông điệp lỗi do backend trả về nếu có, ngược lại dùng thông điệp theo mã lỗi. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()
    if (payload && typeof payload === 'object') {
      const candidate = payload as { message?: unknown; error?: unknown }
      if (typeof candidate.message === 'string' && candidate.message) return candidate.message
      if (typeof candidate.error === 'string' && candidate.error) return candidate.error
    }
  } catch {
    // Body không phải JSON, dùng thông điệp mặc định.
  }
  return getStatusMessage(response.status)
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
  } catch {
    throw createApiError(0, NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) {
    throw createApiError(response.status, await readErrorMessage(response))
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
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  remove: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
}
