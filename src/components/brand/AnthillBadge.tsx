interface AnthillBadgeProps {
  size?: number
  className?: string
}

/**
 * Huy hiệu Anthill cho nền giấy kem (trang đăng nhập): ô mực đậm bóng cứng cam, chữ A dựng như ngọn đồi màu giấy,
 * ba chú kiến cam đi qua thanh ngang. Cùng ngôn ngữ với nhãn dán và nút bấm của trang; `AnthillMark` là bản nét mảnh
 * dành cho thanh bên trên nền chàm trong ứng dụng. Hình rút gọn của huy hiệu này cũng nằm trong `public/favicon.svg`.
 *
 * Ba chấm mang lớp `badge-dot` để CSS cho chúng nhảy sóng khi rê chuột vào huy hiệu (xem `login.css`).
 */
export default function AnthillBadge({ size = 44, className }: AnthillBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="6" y="6" width="40" height="40" rx="11" fill="#ff8400" />
      <rect x="2" y="2" width="40" height="40" rx="11" fill="#2d2a24" />
      <path d="M11 34 22 11l11 23" stroke="#fbf7ee" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#ff8400">
        <circle className="badge-dot" cx="18.7" cy="28" r="1.9" />
        <circle className="badge-dot" cx="22" cy="28" r="1.9" />
        <circle className="badge-dot" cx="25.3" cy="28" r="1.9" />
      </g>
    </svg>
  )
}
