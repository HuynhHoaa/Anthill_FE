import type { MouseEvent as ReactMouseEvent } from 'react'

/** Những phần tử tự xử lý cú bấm của mình: bấm vào chúng không được kéo theo việc mở cả dòng. */
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label, [role="menuitem"], [role="button"]'

/**
 * onClick cho dòng bảng (hay thẻ) bấm được ở bất cứ chỗ nào: bấm vào dòng là mở trang chi tiết hay cửa sổ xem trước.
 *
 * Bỏ qua cú bấm trúng nút, liên kết hay ô nhập trong dòng (chúng đã có việc riêng, và nếu không bỏ qua thì liên kết sẽ
 * chuyển trang hai lần), và bỏ qua khi người dùng đang bôi đen chữ trong dòng để sao chép. Nút và liên kết vẫn nằm
 * trong dòng để bàn phím tab tới được, nên dòng không cần tự nhận phím.
 */
export function openOnRowClick(open: () => void) {
  return (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest(INTERACTIVE_SELECTOR)) return
    if (window.getSelection()?.toString()) return
    open()
  }
}

/**
 * Chặn cú bấm nổi lên dòng. Chỉ cần ở ô có cửa sổ nổi dựng ngoài body (menu, danh sách lớp): React cho sự kiện nổi qua
 * cả portal, nên bấm vào khoảng trống của cửa sổ nổi sẽ vẫn tới được dòng.
 */
export const stopRowClick = (event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()
