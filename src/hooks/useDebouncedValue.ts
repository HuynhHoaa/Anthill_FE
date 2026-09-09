import { useEffect, useState } from 'react'

/**
 * Trì hoãn việc lan truyền giá trị, dùng cho ô tìm kiếm để không gọi service ở mỗi lần gõ phím.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debouncedValue
}

export default useDebouncedValue
