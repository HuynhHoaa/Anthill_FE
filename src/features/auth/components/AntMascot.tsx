/**
 * Chú kiến gác cổng: ló đầu qua mép trên của phiếu đăng nhập và phản ứng với việc người dùng đang làm.
 *
 * Gồm hai lớp SVG cùng toạ độ, kẹp phiếu ở giữa: lớp đầu nằm SAU phiếu (cằm bị phiếu che) còn lớp bàn tay nằm TRƯỚC phiếu
 * (bám vào mép giấy). Tư thế do `data-pose` trên phần tử cha `.sheet-wrap` quyết định, ánh mắt do hai biến CSS `--lx`, `--ly`;
 * cả hai đặt từ LoginPage, nên component này không giữ trạng thái nào.
 *
 * - `idle`: nhìn theo con trỏ chuột, thỉnh thoảng chớp mắt.
 * - `cover`: ô mật khẩu đang được gõ nên kiến lấy hai tay che mắt.
 * - `peek`: bấm "Hiện mật khẩu" thì kiến hé một mắt qua kẽ tay.
 * - `cheer`: đăng nhập xong, giơ hai tay và nhảy một cái.
 * Tâm trạng `error` (đăng nhập hỏng) làm kiến nhíu mày, toát mồ hôi và lắc đầu.
 */
export function AntMascotHead() {
  return (
    <svg className="mascot mascot--head" viewBox="0 0 200 130" aria-hidden="true" focusable="false">
      {/* râu */}
      <g fill="none" stroke="#2d2a24" strokeWidth="4" strokeLinecap="round">
        <path d="M76 38C66 12 44 8 35 20" />
        <path d="M124 38C134 12 156 8 165 20" />
      </g>
      <circle cx="35" cy="20" r="6.5" fill="#ff8400" stroke="#2d2a24" strokeWidth="3.5" />
      <circle cx="165" cy="20" r="6.5" fill="#ff8400" stroke="#2d2a24" strokeWidth="3.5" />

      {/* đầu */}
      <g className="mascot-bob">
        <ellipse cx="100" cy="68" rx="47" ry="41" fill="#ff8400" stroke="#2d2a24" strokeWidth="4" />
        <ellipse cx="80" cy="46" rx="15" ry="7" fill="#fff" opacity="0.3" transform="rotate(-22 80 46)" />
        <circle cx="64" cy="82" r="6.5" fill="#d93a2b" opacity="0.28" />
        <circle cx="136" cy="82" r="6.5" fill="#d93a2b" opacity="0.28" />

        {/* mắt */}
        <g className="mascot-eye mascot-eye--l">
          <circle cx="82" cy="64" r="13" fill="#fffdf8" stroke="#2d2a24" strokeWidth="3.5" />
          <g className="mascot-pupil">
            <circle cx="82" cy="64" r="6" fill="#2d2a24" />
            <circle cx="84.2" cy="61.6" r="2" fill="#fff" />
          </g>
        </g>
        <g className="mascot-eye mascot-eye--r">
          <circle cx="118" cy="64" r="13" fill="#fffdf8" stroke="#2d2a24" strokeWidth="3.5" />
          <g className="mascot-pupil">
            <circle cx="118" cy="64" r="6" fill="#2d2a24" />
            <circle cx="120.2" cy="61.6" r="2" fill="#fff" />
          </g>
        </g>

        {/* lông mày chỉ hiện khi lỗi */}
        <g className="mascot-brows" fill="none" stroke="#2d2a24" strokeWidth="4" strokeLinecap="round">
          <path d="M68 46L93 53" />
          <path d="M132 46L107 53" />
        </g>

        {/* miệng: ba kiểu theo tâm trạng */}
        <path className="mascot-mouth mascot-mouth--idle" d="M89 84Q100 93 111 84" fill="none" stroke="#2d2a24" strokeWidth="4" strokeLinecap="round" />
        <path className="mascot-mouth mascot-mouth--happy" d="M86 81Q100 102 114 81Z" fill="#2d2a24" stroke="#2d2a24" strokeWidth="3.5" strokeLinejoin="round" />
        <path className="mascot-mouth mascot-mouth--error" d="M90 90Q100 80 110 90" fill="none" stroke="#2d2a24" strokeWidth="4" strokeLinecap="round" />

        {/* giọt mồ hôi khi lỗi */}
        <path className="mascot-sweat" d="M152 40q7 10 0 16q-7-6 0-16Z" fill="#7dd3fc" stroke="#2d2a24" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export function AntMascotPaws() {
  return (
    <svg className="mascot mascot--paws" viewBox="0 0 200 130" aria-hidden="true" focusable="false">
      <g className="mascot-paw mascot-paw--l">
        <ellipse cx="62" cy="114" rx="17" ry="13" fill="#ff8400" stroke="#2d2a24" strokeWidth="4" />
        <path d="M55 106v6M62 105v7M69 106v6" stroke="#2d2a24" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      </g>
      <g className="mascot-paw mascot-paw--r">
        <ellipse cx="138" cy="114" rx="17" ry="13" fill="#ff8400" stroke="#2d2a24" strokeWidth="4" />
        <path d="M131 106v6M138 105v7M145 106v6" stroke="#2d2a24" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      </g>
    </svg>
  )
}
