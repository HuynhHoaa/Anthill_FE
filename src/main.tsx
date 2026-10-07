import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { ToastProvider } from './components/common/Toast'
import { ConfirmProvider } from './components/common/ConfirmProvider'
import { warmUpApi } from './lib/warmup'
import './styles/index.css'

// Cho API (đang ngủ trên gói miễn phí) bắt đầu dậy ngay khi trang tải, không đợi tới lúc đăng nhập.
warmUpApi()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        {/* Nằm trong router vì hộp xác nhận tự đóng khi đổi trang. */}
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
