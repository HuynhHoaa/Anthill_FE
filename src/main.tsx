import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppRoot from './app/AppRoot'
import { warmUpApi } from './lib/warmup'
import './styles/index.css'

// Cho API (đang ngủ trên gói miễn phí) bắt đầu dậy ngay khi trang tải, không đợi tới lúc đăng nhập.
warmUpApi()

// Một route bắt tất cả: mọi route thật nằm trong `<Routes>` của App. Dùng router kiểu dữ liệu để có `useBlocker`.
const router = createBrowserRouter([{ path: '*', element: <AppRoot /> }])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
