interface AnthillMarkProps {
  size?: number
  className?: string
}

/**
 * Dấu hiệu của Anthill: chữ A dựng như một ngọn đồi kiến, thanh ngang của chữ A là ba chú kiến đang đi qua.
 *
 * Nét chữ lấy `currentColor` nên đặt trên nền nào thì chỉnh bằng màu chữ của phần tử cha; ba chấm luôn là vàng
 * hổ phách (màu của "đáp án đúng" trong cả hệ thống). Cùng hình này nằm trong `public/favicon.svg` — sửa một
 * nơi thì sửa nơi kia.
 */
export default function AnthillMark({ size = 24, className }: AnthillMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M4 26 16 6l12 20" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.1" cy="20.6" r="1.7" fill="#FBBF24" />
      <circle cx="16" cy="20.6" r="1.7" fill="#FBBF24" />
      <circle cx="19.9" cy="20.6" r="1.7" fill="#FBBF24" />
    </svg>
  )
}
