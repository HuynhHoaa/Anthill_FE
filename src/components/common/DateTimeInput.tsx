import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

interface DateTimeInputProps {
  id?: string
  /** Dạng `YYYY-MM-DDTHH:mm` (giờ địa phương), cùng dạng với `<input type="datetime-local">`; rỗng khi chưa đủ. */
  value: string
  /** Trả về cùng dạng với `value`; chuỗi rỗng khi ngày hoặc giờ chưa nhập đủ hay không hợp lệ. */
  onChange: (value: string) => void
  disabled?: boolean
  /** Lớp kiểu của từng ô nhập (viền, đệm, vòng sáng khi focus); thường là lớp của ô nhập văn bản trong form. */
  className?: string
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const DEFAULT_TIME = '07:00'
const POPOVER_WIDTH = 280

const pad = (value: number) => String(value).padStart(2, '0')

/** `YYYY-MM-DDTHH:mm` → hai ô chữ `dd/mm/yyyy` và `hh:mm`. */
function splitValue(value: string): { date: string; time: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  return match
    ? { date: `${match[3]}/${match[2]}/${match[1]}`, time: `${match[4]}:${match[5]}` }
    : { date: '', time: '' }
}

function parseDate(text: string): { day: number; month: number; year: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null
  if (day < 1 || day > new Date(year, month, 0).getDate()) return null

  return { day, month, year }
}

function parseTime(text: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour > 23 || minute > 59 ? null : { hour, minute }
}

function compose(dateText: string, timeText: string): string {
  const date = parseDate(dateText)
  const time = parseTime(timeText)
  if (!date || !time) return ''

  return `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(time.hour)}:${pad(time.minute)}`
}

/** Chỉ giữ chữ số rồi chèn dấu `/` sau ngày và tháng: gõ `16102026` ra `16/10/2026`. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

const HOURS = Array.from({ length: 24 }, (_, index) => pad(index))
const MINUTES = Array.from({ length: 60 }, (_, index) => pad(index))

interface CalendarPopoverProps {
  anchor: HTMLElement
  selected: { day: number; month: number; year: number } | null
  onPick: (day: number, month: number, year: number) => void
  onClose: () => void
}

function CalendarPopover({ anchor, selected, onPick, onClose }: CalendarPopoverProps) {
  const today = new Date()
  const [view, setView] = useState(() => ({
    year: selected?.year ?? today.getFullYear(),
    month: selected?.month ?? today.getMonth() + 1,
  }))
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Đặt ngay dưới ô nhập (hoặc lật lên trên khi sát đáy màn hình), không tràn ra mép phải.
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect()
    const height = popoverRef.current?.offsetHeight ?? 320
    const fitsBelow = rect.bottom + 6 + height <= window.innerHeight
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8))
    setPosition({ top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height), left })
  }, [anchor, view])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  const shiftMonth = (delta: number) => {
    setView(current => {
      const index = current.year * 12 + (current.month - 1) + delta
      return { year: Math.floor(index / 12), month: (index % 12) + 1 }
    })
  }

  // Tuần bắt đầu từ thứ Hai. `getDay()` trả 0 cho Chủ nhật nên quy về 6.
  const firstWeekday = (new Date(view.year, view.month - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(view.year, view.month, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = (day: number) =>
    day === today.getDate() && view.month === today.getMonth() + 1 && view.year === today.getFullYear()
  const isSelected = (day: number) =>
    selected !== null && day === selected.day && view.month === selected.month && view.year === selected.year

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Chọn ngày"
      style={{
        position: 'fixed',
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: POPOVER_WIDTH,
      }}
      className="z-50 rounded-2xl border border-slate-100 bg-white p-3 shadow-lg"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Tháng trước"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-bold text-slate-800">
          Tháng {view.month} năm {view.year}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Tháng sau"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(label => (
          <span key={label} className="text-[11px] font-semibold text-slate-400 py-1">{label}</span>
        ))}
        {cells.map((day, index) =>
          day === null ? (
            <span key={`blank-${index}`} />
          ) : (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day, view.month, view.year)}
              aria-label={`${pad(day)}/${pad(view.month)}/${view.year}`}
              aria-pressed={isSelected(day)}
              className={`h-8 rounded-lg text-sm transition-colors ${
                isSelected(day)
                  ? 'bg-indigo-600 text-white font-bold'
                  : isToday(day)
                    ? 'border border-indigo-300 text-indigo-700 font-semibold hover:bg-indigo-50'
                    : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {day}
            </button>
          ),
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => onPick(today.getDate(), today.getMonth() + 1, today.getFullYear())}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          Hôm nay
        </button>
      </div>
    </div>,
    document.body,
  )
}

interface TimePopoverProps {
  anchor: HTMLElement
  hour: string
  minute: string
  /** Gọi mỗi lần chọn một giờ hoặc một phút; `close` là `true` khi vừa chọn phút (xong việc). */
  onPick: (hour: string, minute: string, close: boolean) => void
  onClose: () => void
}

/**
 * Bảng chọn giờ: hai cột cạnh nhau, Giờ (00–23) và Phút (00–59), chọn cả hai trong một chỗ như ô giờ gốc nhưng
 * theo 24 giờ. Chọn giờ thì bảng vẫn mở để chọn phút; chọn phút xong thì đóng.
 */
function TimePopover({ anchor, hour, minute, onPick, onClose }: TimePopoverProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const hourListRef = useRef<HTMLDivElement>(null)
  const minuteListRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect()
    const height = popoverRef.current?.offsetHeight ?? 260
    const width = popoverRef.current?.offsetWidth ?? 176
    const fitsBelow = rect.bottom + 6 + height <= window.innerHeight
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    setPosition({ top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height), left })
  }, [anchor])

  // Cuộn tới giờ và phút đang chọn để người dùng thấy ngay mình đang ở đâu trong danh sách dài.
  useLayoutEffect(() => {
    for (const list of [hourListRef.current, minuteListRef.current]) {
      const selected = list?.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (list && selected) list.scrollTop = Math.max(0, selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2)
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  const optionClass = (isSelected: boolean) =>
    `w-full h-8 rounded-lg text-sm transition-colors ${
      isSelected ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'
    }`

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Chọn giờ"
      style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      className="z-50 rounded-2xl border border-slate-100 bg-white p-3 shadow-lg"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center mb-1.5">Giờ</p>
          <div ref={hourListRef} className="relative w-16 max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {HOURS.map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={value === hour}
                aria-label={`${value} giờ`}
                onClick={() => onPick(value, minute || '00', false)}
                className={optionClass(value === hour)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center mb-1.5">Phút</p>
          <div ref={minuteListRef} className="relative w-16 max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {MINUTES.map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={value === minute}
                aria-label={`${value} phút`}
                onClick={() => onPick(hour || DEFAULT_TIME.split(':')[0], value, true)}
                className={optionClass(value === minute)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Ô chọn ngày giờ theo kiểu Việt Nam: ngày `dd/mm/yyyy` và giờ 24 giờ (một ô, bấm vào mở bảng chọn cả giờ 00–23
 * lẫn phút 00–59), không phụ thuộc ngôn ngữ của trình duyệt.
 *
 * `<input type="datetime-local">` hiển thị theo ngôn ngữ của trình duyệt/hệ điều hành (máy để tiếng Anh Mỹ thì ra
 * `mm/dd/yyyy` và 12 giờ AM/PM) và trang web không ép được. Component này giữ nguyên giá trị dạng
 * `YYYY-MM-DDTHH:mm` mà phần còn lại của ứng dụng đang dùng, chỉ đổi cách nhập: ngày gõ có tự chèn dấu hoặc bấm biểu
 * tượng lịch để chọn; giờ và phút chọn chung trong một bảng.
 */
export default function DateTimeInput({ id, value, onChange, disabled = false, className = '' }: DateTimeInputProps) {
  const initial = splitValue(value)
  const [dateText, setDateText] = useState(initial.date)
  const [timeText, setTimeText] = useState(initial.time)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)

  // Giá trị mình vừa báo lên. Cha đổi `value` sang một giá trị khác nữa (nạp đề, hoàn tác) thì mới đồng bộ lại
  // hai ô chữ; còn giá trị do chính mình báo thì không được ghi đè lên thứ người dùng đang gõ dở.
  const lastEmitted = useRef(value)
  const dateWrapperRef = useRef<HTMLDivElement>(null)
  const timeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    const next = splitValue(value)
    setDateText(next.date)
    setTimeText(next.time)
  }, [value])

  const emit = (nextDate: string, nextTime: string) => {
    const composed = compose(nextDate, nextTime)
    if (composed === lastEmitted.current) return
    lastEmitted.current = composed
    onChange(composed)
  }

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = maskDate(event.target.value)
    setDateText(next)
    emit(next, timeText)
  }

  // Giờ và phút chọn chung trong bảng giờ. Chọn một nửa mà nửa kia còn trống thì nửa kia lấy giá trị mặc định (bảng
  // lo việc đó), để một lần chọn là có giờ đủ dùng.
  const [hourText = '', minuteText = ''] = timeText.split(':')

  const pickTime = (hour: string, minute: string, close: boolean) => {
    const next = `${hour}:${minute}`
    setTimeText(next)
    emit(dateText, next)
    if (close) setTimeOpen(false)
  }

  const pickDay = (day: number, month: number, year: number) => {
    const nextDate = `${pad(day)}/${pad(month)}/${year}`
    // Chọn ngày mà chưa có giờ thì điền giờ mặc định, để một lần bấm là có giá trị đủ dùng.
    const nextTime = parseTime(timeText) ? timeText : DEFAULT_TIME
    setDateText(nextDate)
    setTimeText(nextTime)
    emit(nextDate, nextTime)
    setCalendarOpen(false)
  }

  const dateInvalid = dateText.length === 10 && parseDate(dateText) === null
  const baseId = id ?? undefined
  const timeShown = parseTime(timeText) ? timeText : ''

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <div ref={dateWrapperRef} className="flex flex-1 gap-2 min-w-[10.5rem]">
          <input
            id={baseId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/yyyy"
            value={dateText}
            disabled={disabled}
            aria-label={id ? undefined : 'Ngày'}
            aria-invalid={dateInvalid || undefined}
            onChange={handleDateChange}
            className={`${className} flex-1 min-w-0`}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setCalendarOpen(open => !open)}
            aria-label="Chọn ngày từ lịch"
            aria-expanded={calendarOpen}
            className="w-10 flex-shrink-0 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CalendarDays size={16} />
          </button>
        </div>

        <div className="flex-shrink-0 w-28">
          <button
            ref={timeButtonRef}
            id={id ? `${id}-time` : undefined}
            type="button"
            disabled={disabled}
            onClick={() => setTimeOpen(open => !open)}
            aria-label={timeShown ? `Giờ ${timeShown}, bấm để đổi` : 'Chọn giờ'}
            aria-haspopup="dialog"
            aria-expanded={timeOpen}
            className={`${className} w-full flex items-center justify-between gap-2 text-left`}
          >
            <span className={timeShown ? 'text-slate-800' : 'text-slate-400'}>{timeShown || '--:--'}</span>
            <Clock size={15} className="text-slate-400 flex-shrink-0" />
          </button>
        </div>
      </div>

      {dateInvalid && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-500">
          Ngày không hợp lệ (dd/mm/yyyy).
        </p>
      )}

      {timeOpen && timeButtonRef.current && (
        <TimePopover
          anchor={timeButtonRef.current}
          hour={hourText}
          minute={minuteText}
          onPick={pickTime}
          onClose={() => setTimeOpen(false)}
        />
      )}

      {calendarOpen && dateWrapperRef.current && (
        <CalendarPopover
          anchor={dateWrapperRef.current}
          selected={parseDate(dateText)}
          onPick={pickDay}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  )
}
