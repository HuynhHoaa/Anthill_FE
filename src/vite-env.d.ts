/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Địa chỉ gốc của API backend, khai báo trong file .env (xem .env.example). */
  readonly VITE_API_BASE_URL?: string
}
