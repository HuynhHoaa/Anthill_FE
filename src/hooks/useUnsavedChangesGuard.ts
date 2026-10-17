import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmProvider'

export interface UnsavedChangesGuard {
  /**
   * Chạy `leave` (thường là `navigate(...)`) mà không hỏi lại. Dùng ngay sau khi lưu xong hay khi chính trang chủ động
   * chuyển đi (ví dụ sang soạn thêm câu hỏi rồi quay lại), vì lúc đó "thay đổi chưa lưu" không còn là mối lo.
   */
  leaveWithoutAsking: (leave: () => void) => void
}

/**
 * Hỏi lại trước khi bỏ một biểu mẫu còn thay đổi chưa lưu.
 *
 * Khi `dirty` đang bật mà người dùng rời trang — bấm liên kết, nút quay lại của trang, nút Back của trình duyệt — thì
 * điều hướng bị giữ lại và hiện hộp "Thoát mà chưa lưu?" với hai nút Huỷ / Bỏ qua; chỉ khi họ bấm "Bỏ qua" mới đi tiếp,
 * bấm "Huỷ" thì giữ nguyên trang và những gì đã nhập. Đóng tab hay tải lại trang thì dùng hộp hỏi của chính trình duyệt (trình duyệt không cho
 * thay chữ). Chỉ tính khi đổi sang một trang khác: đổi tham số trên cùng một trang không bị hỏi.
 *
 * Cần router kiểu dữ liệu (`createBrowserRouter`) vì `useBlocker` không chạy dưới `BrowserRouter`.
 */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const confirm = useConfirm()

  // Hàm chặn được router gọi ngay lúc điều hướng, nên đọc qua ref để luôn thấy giá trị mới nhất mà không phải dựng lại.
  const dirtyRef = useRef(dirty)
  const allowRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && !allowRef.current && currentLocation.pathname !== nextLocation.pathname,
  )

  const blockerRef = useRef(blocker)
  useEffect(() => {
    blockerRef.current = blocker
  }, [blocker])

  // StrictMode chạy hiệu ứng hai lần lúc dựng: không để hai hộp mở chồng nhau cho cùng một lần chặn.
  const askingRef = useRef(false)

  useEffect(() => {
    if (blocker.state !== 'blocked' || askingRef.current) return
    askingRef.current = true

    void confirm({
      title: 'Thoát mà chưa lưu?',
      message: 'Những gì bạn vừa nhập chưa được lưu và sẽ mất nếu thoát bây giờ.',
      confirmLabel: 'Bỏ qua',
      cancelLabel: 'Huỷ',
      tone: 'danger',
      // Enter gõ thêm một lần lúc đang gõ dở không được thành "thoát".
      enterConfirms: false,
    }).then(accepted => {
      askingRef.current = false
      const current = blockerRef.current
      if (current.state !== 'blocked') return
      if (accepted) current.proceed()
      else current.reset()
    })
  }, [blocker.state, confirm])

  // Đóng tab hay tải lại: trình duyệt tự hỏi, chỉ cần báo là còn thay đổi chưa lưu.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const leaveWithoutAsking = useCallback((leave: () => void) => {
    allowRef.current = true
    try {
      leave()
    } finally {
      // Router kiểm tra hàm chặn ngay trong lúc gọi `navigate`, nên tới đây cờ đã dùng xong.
      allowRef.current = false
    }
  }, [])

  return { leaveWithoutAsking }
}
