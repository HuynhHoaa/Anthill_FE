/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Địa chỉ gốc của API backend, khai báo trong file .env (xem .env.example). */
  readonly VITE_API_BASE_URL?: string
  /** `true` thì trang đăng nhập hiện ba nút xem thử bằng tài khoản mẫu (luôn hiện khi chạy dev). Bản dùng thật để trống. */
  readonly VITE_DEMO_ACCOUNTS?: string
}
