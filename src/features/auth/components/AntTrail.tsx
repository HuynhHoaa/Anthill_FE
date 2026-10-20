import { useEffect, useRef } from 'react'

interface AntTrailProps {
  /** Hệ thống đang bận (máy chủ đang dậy hoặc đang đăng nhập): thêm một đoàn kiến chạy nhanh. */
  busy: boolean
}

const INK = '#2d2a24'
const ORANGE = '#ff8400'

/** Đường kiến đi dọc mép sàn, từ cửa tổ ở x = 150 ra tới mép phải khung (và ngược lại). */
const TRAIL = 'M150 137H1500'

interface AntSpec {
  seconds: number
  begin: number
  /** `out`: rời tổ đi ra, tay không. `home`: ngậm một ô điểm về tổ. */
  way: 'out' | 'home'
  extra?: boolean
}

/**
 * Đàn kiến ở chân trang là chỉ báo công việc của hệ thống: bình thường chỉ vài chú đủng đỉnh khuân điểm về tổ; khi máy chủ đang
 * dậy hoặc đang đăng nhập thì thêm một đoàn nữa chạy nhanh hơn. Nên chuyển động của chúng luôn có nghĩa: "đang có việc".
 */
const ANTS: AntSpec[] = [
  { seconds: 70, begin: -4, way: 'home' },
  { seconds: 70, begin: -30, way: 'home' },
  { seconds: 84, begin: -12, way: 'out' },
  { seconds: 84, begin: -52, way: 'out' },
  { seconds: 26, begin: -2, way: 'home', extra: true },
  { seconds: 26, begin: -8, way: 'home', extra: true },
  { seconds: 26, begin: -14, way: 'home', extra: true },
  { seconds: 26, begin: -20, way: 'home', extra: true },
  { seconds: 32, begin: -6, way: 'out', extra: true },
  { seconds: 32, begin: -17, way: 'out', extra: true },
  { seconds: 32, begin: -26, way: 'out', extra: true },
]

/** Một chú kiến nhìn sang phải (+x), phóng 1,35 lần. */
function Ant({ tile }: { tile: boolean }) {
  return (
    <g transform="scale(1.35)">
      <g stroke={INK} strokeWidth="1" strokeLinecap="round">
        <path d="M-1.4 -1 L-3.4 -5M-0.2 -1 L0.8 -5M1 -1 L3.4 -4.4M-1.4 1 L-3.4 5M-0.2 1 L0.8 5M1 1 L3.4 4.4" />
        {!tile && <path d="M5.6 -1.2 8.6 -3.4M5.6 1.2 8.6 3.4" />}
      </g>
      <circle cx="-5.4" r="3.2" fill={INK} />
      <circle cx="-0.4" r="2.1" fill={INK} />
      <circle cx="4.2" r="2.4" fill={INK} />
      {tile && <rect x="6.4" y="-3" width="6" height="6" rx="1.4" fill={ORANGE} stroke={INK} strokeWidth="0.9" />}
    </g>
  )
}

export default function AntTrail({ busy }: AntTrailProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Người dùng chọn giảm chuyển động: dừng đàn kiến tại chỗ (đã rải đều nhờ `begin` âm).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svgRef.current?.pauseAnimations()
    }
  }, [])

  return (
    <div className="login-ground" data-busy={busy} aria-hidden="true">
      <svg
        ref={svgRef}
        className="h-full w-full"
        viewBox="0 0 1440 170"
        preserveAspectRatio="xMinYMax slice"
        focusable="false"
      >
        <defs>
          <path id="anthill-ground-trail" d={TRAIL} />
        </defs>

        {/* sàn */}
        <path d="M0 144H1440V170H0Z" fill="#ebe1d0" />
        <path d="M0 144H1440" stroke={INK} strokeWidth="3" />

        {/* lối mòn */}
        <path d={TRAIL} stroke={INK} strokeOpacity="0.28" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 9" fill="none" />

        {/* tổ kiến */}
        <path d="M-40 144C14 96 70 64 132 58C194 64 250 96 304 144Z" fill={ORANGE} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M30 144C62 114 98 98 132 94C166 98 202 114 234 144" fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" />
        <path d="M-6 144C32 120 62 106 92 99" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" />
        <path d="M112 144V124a20 20 0 0 1 40 0V144Z" fill={INK} />

        {/* đàn kiến */}
        {ANTS.map((ant, index) => (
          <g key={index} className={ant.extra ? 'ant-busy' : undefined}>
            <animateMotion
              dur={`${ant.seconds}s`}
              begin={`${ant.begin}s`}
              repeatCount="indefinite"
              rotate={ant.way === 'out' ? 'auto' : 'auto-reverse'}
              keyPoints={ant.way === 'out' ? '0;1' : '1;0'}
              keyTimes="0;1"
              calcMode="linear"
            >
              <mpath href="#anthill-ground-trail" />
            </animateMotion>
            <Ant tile={ant.way === 'home'} />
          </g>
        ))}
      </svg>
    </div>
  )
}
