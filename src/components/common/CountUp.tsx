import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  value: number
  /** Số chữ số thập phân giữ lại (mặc định 0). */
  decimals?: number
  /** Thời lượng chạy, mili giây. */
  durationMs?: number
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Con số chạy từ 0 (lần hiện đầu) hoặc từ giá trị cũ (khi đổi) tới `value`, chậm dần về cuối. Người chọn giảm chuyển động thì
 * hiện thẳng giá trị cuối. Văn bản cuối luôn đúng `value` nên không ảnh hưởng tới người đọc bằng trình đọc màn hình hay bộ kiểm
 * thử chờ giá trị cuối.
 */
export default function CountUp({ value, decimals = 0, durationMs = 800 }: CountUpProps) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const fromRef = useRef(shown)

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(value)) {
      setShown(value)
      fromRef.current = value
      return
    }

    const from = fromRef.current
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      const current = from + (value - from) * eased
      setShown(current)
      fromRef.current = current
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  const factor = 10 ** decimals
  return <>{(Math.round(shown * factor) / factor).toFixed(decimals)}</>
}
