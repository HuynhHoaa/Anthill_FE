import App from './App'
import { RealtimeProvider } from './RealtimeProvider'
import { ToastProvider } from '../components/common/Toast'
import { ConfirmProvider } from '../components/common/ConfirmProvider'

/**
 * Gốc của app dưới router: các provider rồi `App` (nơi chứa mọi `<Routes>`).
 *
 * Router kiểu dữ liệu (`createBrowserRouter` ở `main.tsx`) chỉ có một route bắt tất cả trỏ tới đây. Dùng nó thay cho
 * `BrowserRouter` để có `useBlocker`: hỏi lại trước khi bỏ một biểu mẫu còn thay đổi chưa lưu (xem
 * `useUnsavedChangesGuard`), kể cả khi bấm nút Back của trình duyệt.
 */
export default function AppRoot() {
  return (
    <ToastProvider>
      {/* Nằm trong router vì cần biết đang ở trang nào, và trong ToastProvider vì đẩy toast theo sự kiện. */}
      <RealtimeProvider>
        {/* Nằm trong router vì hộp xác nhận tự đóng khi đổi trang. */}
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </RealtimeProvider>
    </ToastProvider>
  )
}
