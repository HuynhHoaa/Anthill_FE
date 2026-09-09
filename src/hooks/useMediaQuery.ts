import { useEffect, useState } from 'react'

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

/**
 * Theo dõi một media query để logic React biết được bề rộng màn hình.
 * Cần khi một trạng thái chỉ có nghĩa ở desktop nhưng lại điều khiển cả JSX,
 * chỗ mà media query trong CSS không với tới được.
 */
export function useMediaQuery(query: string): boolean {
  const [isMatching, setIsMatching] = useState(() => matches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQueryList = window.matchMedia(query)
    const handleChange = (event: MediaQueryListEvent) => setIsMatching(event.matches)

    setIsMatching(mediaQueryList.matches)
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [query])

  return isMatching
}
