import { useEffect, useRef } from 'react'
import AnthillMark from '../../../components/brand/AnthillMark'

export type StageRole = 'admin' | 'teacher' | 'student'

interface LoginStageProps {
  /** Vai trò đang được trỏ tới ở form (nút xem thử): tầng đồi tương ứng sáng lên. */
  highlight?: StageRole | null
}

/**
 * Ba tầng của tổ kiến, từ ngoài vào trong: quản trị viên (cả trường), giáo viên (lớp), học sinh (từng em).
 * Toạ độ theo `viewBox` 720×470; đỉnh đồi ở (360, 96), chân đồi ở y = 470.
 */
const LAYERS: { role: StageRole; label: string; d: string; labelAt: [number, number] }[] = [
  { role: 'admin', label: 'QUẢN TRỊ VIÊN', d: 'M-80 470C-40 300 170 110 360 96C550 110 760 300 800 470Z', labelAt: [534, 252] },
  { role: 'teacher', label: 'GIÁO VIÊN', d: 'M60 470C90 340 230 190 360 182C490 190 630 340 660 470Z', labelAt: [468, 322] },
  { role: 'student', label: 'HỌC SINH', d: 'M190 470C205 390 290 300 360 296C430 300 515 390 530 470Z', labelAt: [390, 396] },
]

/**
 * Ba lối mòn lên đỉnh: hai làn song song trên sườn trái và một lối từ cửa tổ đi thẳng lên. Sườn phải để trống cho ba nhãn
 * tầng, nên không lối nào chạy qua đó.
 */
const TRAILS = {
  left: 'M-10 452C70 440 110 400 150 360S200 300 250 250S320 150 354 104',
  outer: 'M-20 420C30 410 70 372 100 336S170 260 214 214S296 142 346 102',
  door: 'M360 410C360 372 330 352 336 322S378 262 352 222S332 152 358 106',
} as const

type TrailName = keyof typeof TRAILS

interface AntSpec {
  trail: TrailName
  /** Thời gian đi hết lối mòn (giây). */
  seconds: number
  /** Âm: con kiến đã đi được từng ấy giây ngay từ lúc trang mở, nên cả đàn rải đều trên đường. */
  begin: number
  /** Đi lên đỉnh mang theo một ô đáp án; không mang thì đang đi xuống. */
  up: boolean
  tile?: string
}

const AMBER = '#FBBF24'
const SNOW = '#EEF2FF'

const ANTS: AntSpec[] = [
  { trail: 'left', seconds: 30, begin: -1, up: true, tile: AMBER },
  { trail: 'left', seconds: 30, begin: -8, up: true, tile: SNOW },
  { trail: 'left', seconds: 30, begin: -15, up: true, tile: AMBER },
  { trail: 'left', seconds: 30, begin: -22, up: true, tile: AMBER },
  { trail: 'left', seconds: 36, begin: -10, up: false },
  { trail: 'left', seconds: 36, begin: -28, up: false },
  { trail: 'outer', seconds: 33, begin: -4, up: true, tile: SNOW },
  { trail: 'outer', seconds: 33, begin: -13, up: true, tile: AMBER },
  { trail: 'outer', seconds: 33, begin: -24, up: true, tile: AMBER },
  { trail: 'outer', seconds: 38, begin: -7, up: false },
  { trail: 'outer', seconds: 38, begin: -25, up: false },
  { trail: 'door', seconds: 26, begin: -3, up: true, tile: AMBER },
  { trail: 'door', seconds: 26, begin: -16, up: true, tile: SNOW },
  { trail: 'door', seconds: 30, begin: -9, up: false },
  { trail: 'door', seconds: 30, begin: -22, up: false },
]

const SPARKLES: [number, number, number][] = [
  [64, 40, 1.6], [150, 18, 1.2], [230, 58, 1.8], [318, 22, 1.2], [420, 44, 1.5],
  [506, 16, 1.8], [588, 52, 1.2], [662, 28, 1.6], [96, 86, 1.1], [624, 98, 1.3],
]

/** Một chú kiến nhìn sang phải (+x): ba đốt thân, sáu chân; râu nếu đi tay không, ô đáp án ngậm ở miệng nếu đang mang. */
function Ant({ tile }: { tile?: string }) {
  return (
    <g>
      <g stroke={SNOW} strokeWidth="0.9" strokeLinecap="round" opacity="0.85">
        <path d="M-1.4 -1 L-3.4 -5.2M-0.2 -1 L0.8 -5.2M1 -1 L3.4 -4.6M-1.4 1 L-3.4 5.2M-0.2 1 L0.8 5.2M1 1 L3.4 4.6" />
        {!tile && <path d="M5.6 -1.2 8.8 -3.6M5.6 1.2 8.8 3.6" />}
      </g>
      <circle cx="-5.4" r="3.2" fill={SNOW} />
      <circle cx="-0.4" r="2.1" fill={SNOW} />
      <circle cx="4.2" r="2.4" fill={SNOW} />
      {tile && <rect x="6.4" y="-3" width="6" height="6" rx="1.5" fill={tile} />}
    </g>
  )
}

export default function LoginStage({ highlight = null }: LoginStageProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Người dùng chọn giảm chuyển động: dừng đàn kiến tại chỗ (đã rải đều nhờ `begin` âm) thay vì cho chạy.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svgRef.current?.pauseAnimations()
    }
  }, [])

  return (
    <div className="login-stage relative overflow-hidden h-[270px] sm:h-[300px] lg:h-auto lg:min-h-screen lg:w-[52%] lg:flex-shrink-0">
      {/* Chữ */}
      <div className="relative z-10 flex h-full flex-col px-6 pt-6 sm:px-10 sm:pt-8 lg:px-12 lg:pt-11 xl:px-16">
        <div className="stage-in flex items-center gap-3" style={{ animationDelay: '0ms' }}>
          <span className="stage-badge">
            <AnthillMark size={26} className="text-white" />
          </span>
          <span className="font-display text-[1.7rem] font-extrabold leading-none text-white">Anthill</span>
        </div>

        <h2
          className="stage-in stage-title font-display mt-5 hidden font-extrabold text-white lg:mt-[clamp(1.5rem,6.5vh,4.2rem)] lg:block"
          style={{ animationDelay: '90ms' }}
        >
          Bài kiểm tra cho
          <br />
          <span className="stage-marker">cả một ngôi trường</span>.
        </h2>

        <p
          className="stage-in mt-4 hidden max-w-[27rem] text-[0.95rem] leading-relaxed text-indigo-200/90 lg:block xl:text-base"
          style={{ animationDelay: '180ms' }}
        >
          Quản trị viên lập lớp, giáo viên ra đề, học sinh làm bài trên đồng hồ do máy chủ giữ. Nộp xong là có điểm.
        </p>
      </div>

      {/* Tổ kiến */}
      <svg
        ref={svgRef}
        className="pointer-events-none absolute bottom-0 left-1/2 aspect-[720/470] h-full -translate-x-1/2 overflow-visible lg:inset-x-0 lg:left-0 lg:aspect-auto lg:h-[60%] lg:w-full lg:translate-x-0"
        viewBox="0 0 720 470"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="stage-glow" cx="360" cy="96" r="260" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={AMBER} stopOpacity="0.34" />
            <stop offset="1" stopColor={AMBER} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="stage-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
          {(Object.keys(TRAILS) as TrailName[]).map(name => (
            <path key={name} id={`anthill-trail-${name}`} d={TRAILS[name]} />
          ))}
        </defs>

        <circle cx="360" cy="96" r="260" fill="url(#stage-glow)" />

        {SPARKLES.map(([x, y, r], index) => (
          <circle key={index} className="stage-sparkle" cx={x} cy={y} r={r} fill="#fff" style={{ animationDelay: `${index * 0.45}s` }} />
        ))}

        {/* Ba tầng đồi, mỗi tầng trồi lên lần lượt */}
        {LAYERS.map(({ role, d }, index) => (
          <path
            key={role}
            className="stage-layer stage-rise"
            data-active={highlight === role}
            d={d}
            fill="url(#stage-ground)"
            stroke="#fff"
            strokeOpacity="0.24"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            style={{ animationDelay: `${120 + index * 140}ms` }}
          />
        ))}

        {/* Đường đồng mức mảnh giữa các tầng */}
        {[0.93, 0.87, 0.78, 0.7, 0.6].map(scale => (
          <path
            key={scale}
            d={LAYERS[0].d}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.07"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            transform={`translate(360 470) scale(${scale}) translate(-360 -470)`}
          />
        ))}

        {/* Cửa tổ */}
        <path d="M337 470V430a23 23 0 0 1 46 0V470Z" fill="#0C0A2A" />
        <path d="M337 470V430a23 23 0 0 1 46 0V470Z" fill="none" stroke={AMBER} strokeOpacity="0.35" strokeWidth="1.2" />

        {/* Lối mòn */}
        {(Object.keys(TRAILS) as TrailName[]).map(name => (
          <path
            key={name}
            d={TRAILS[name]}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.32"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="0.1 7"
          />
        ))}

        {/* Nhãn ba tầng */}
        {LAYERS.map(({ role, label, labelAt: [x, y] }) => (
          <g key={role} className="stage-pill" data-active={highlight === role} transform={`translate(${x} ${y})`}>
            <rect x="0" y="-11" width={label.length * 7.4 + 32} height="22" rx="11" />
            <circle cx="12" cy="0" r="2.6" />
            <text x="22" y="3.6">{label}</text>
          </g>
        ))}

        {/* Đàn kiến */}
        {ANTS.map((ant, index) => (
          <g key={index} className="stage-ant">
            <animateMotion
              dur={`${ant.seconds}s`}
              begin={`${ant.begin}s`}
              repeatCount="indefinite"
              rotate={ant.up ? 'auto' : 'auto-reverse'}
              keyPoints={ant.up ? '0;1' : '1;0'}
              keyTimes="0;1"
              calcMode="linear"
            >
              <mpath href={`#anthill-trail-${ant.trail}`} />
            </animateMotion>
            <Ant tile={ant.up ? ant.tile : undefined} />
          </g>
        ))}

        {/* Đỉnh đồi: dấu tích "đã đúng" */}
        <circle className="stage-ping" cx="360" cy="92" r="10" fill="none" stroke={AMBER} strokeWidth="1.6" />
        <circle cx="360" cy="92" r="10.5" fill={AMBER} />
        <path d="M355.2 92.4l3.4 3.4 6.4-7" fill="none" stroke="#1E1B4B" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
