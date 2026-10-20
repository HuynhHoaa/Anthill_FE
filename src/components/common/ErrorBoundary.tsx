import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Chỉ để log, không hiện lên giao diện — biết khu vực nào vừa sập mà không cần đoán từ stack trace. */
  label?: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Lưới an toàn cuối cùng cho một khu vực giao diện.
 *
 * React gỡ toàn bộ cây kể từ error boundary gần nhất khi một lỗi render không bắt được thoát ra —
 * không có boundary nào thì đó là gỡ nguyên ứng dụng, màn hình trắng trơn không dấu vết. Ca cụ thể
 * dẫn tới component này: trang thông báo tra một bảng theo `notification.type`, và một type mà bảng
 * chưa biết (lệch quy ước đặt tên giữa server/giao diện, hoặc server thêm loại mới sau khi giao diện
 * đã build) làm `.icon` gọi trên `undefined` ném lỗi giữa lúc render. Bảng tra giờ đã có phương án dự
 * phòng nên ca đó không còn xảy ra nữa — nhưng bọc ở đây là tuyến phòng thủ thứ hai, phòng khi có lỗi
 * không lường trước khác nảy sinh sau này ở đúng khu vực này.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm px-6 py-14 flex flex-col items-center text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Không hiển thị được nội dung này</h3>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">
            Đã có lỗi ngoài dự kiến. Vui lòng thử lại; nếu vẫn lỗi, hãy tải lại trang.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }}
          >
            <RefreshCw size={15} />
            Thử lại
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
