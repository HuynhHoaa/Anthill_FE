import { useState, type CSSProperties } from 'react'
import { resolveMediaUrl } from '../../lib/apiClient'

interface UserAvatarProps {
  /** Đường dẫn ảnh đã tải lên; bỏ trống thì vẽ chữ cái đầu. */
  avatarUrl?: string | null
  /** Chữ cái đầu của tên, vẽ khi chưa có ảnh hoặc ảnh không tải được. */
  initials: string
  /** Kích thước, bo góc và cỡ chữ của ô; nền và căn giữa chữ do component tự thêm. */
  className: string
  /** Nền của ô chữ cái (thường là một dải màu). */
  style?: CSSProperties
}

/**
 * Ảnh đại diện: ảnh người dùng tải lên nếu có, không thì chữ cái đầu trên nền màu.
 *
 * Ảnh hỏng (file bị xoá, mạng lỗi) quay về chữ cái đầu thay vì để một ô ảnh vỡ; mốc hỏng gắn với đúng đường dẫn đó,
 * nên đổi sang ảnh khác là thử lại.
 */
export default function UserAvatar({ avatarUrl, initials, className, style }: UserAvatarProps) {
  const source = resolveMediaUrl(avatarUrl)
  const [failedSource, setFailedSource] = useState<string | undefined>(undefined)

  if (source && source !== failedSource) {
    return (
      <img
        src={source}
        alt=""
        onError={() => setFailedSource(source)}
        className={`${className} object-cover bg-slate-100`}
      />
    )
  }

  return (
    <span
      className={`${className} flex items-center justify-center text-white font-bold`}
      style={style}
    >
      {initials}
    </span>
  )
}
