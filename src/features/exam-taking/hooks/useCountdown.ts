import { useEffect, useState } from 'react'

/**
 * Đếm ngược tới một mốc thời gian và tự cập nhật mỗi giây.
 * Trả về chuỗi rút gọn: '2 ngày 3 giờ', '3 giờ 12 phút', hoặc '04:59' khi còn dưới một giờ.
 */
export function useCountdown(target: Date | null | undefined, expiredLabel = 'Hết hạn'): string {
  const [timeLeft, setTimeLeft] = useState('')
  const targetTime = target ? target.getTime() : null

  useEffect(() => {
    if (targetTime === null) {
      setTimeLeft('')
      return
    }

    const calculate = () => {
      const remaining = targetTime - Date.now()
      if (remaining <= 0) {
        setTimeLeft(expiredLabel)
        return
      }
      const days = Math.floor(remaining / 86400000)
      const hours = Math.floor((remaining % 86400000) / 3600000)
      const minutes = Math.floor((remaining % 3600000) / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      if (days > 0) setTimeLeft(`${days} ngày ${hours} giờ`)
      else if (hours > 0) setTimeLeft(`${hours} giờ ${minutes} phút`)
      else setTimeLeft(`${minutes}:${String(seconds).padStart(2, '0')}`)
    }

    calculate()
    const timer = setInterval(calculate, 1000)
    return () => clearInterval(timer)
  }, [targetTime, expiredLabel])

  return timeLeft
}

export default useCountdown
