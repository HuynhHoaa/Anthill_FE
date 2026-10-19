import { useEffect, useState } from 'react'

/**
 * Con số đếm lên từ 0 tới giá trị thật trong một thoáng: điểm trung bình "chạy" lên thay vì hiện cứng, vui mắt hơn với học sinh.
 * Người đặt "giảm chuyển động" trong hệ điều hành thấy ngay giá trị cuối, không có hoạt ảnh. `null` đi thẳng ra `null`.
 */
export function useCountUp(target: number | null, durationMs = 800): number | null {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [value, setValue] = useState<number | null>(reduceMotion ? target : target === null ? null : 0)

  useEffect(() => {
    if (target === null || reduceMotion) {
      setValue(target)
      return
    }

    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      // easeOutCubic: chạy nhanh lúc đầu, chậm dần khi tới đích.
      setValue(target * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reduceMotion])

  return value
}
