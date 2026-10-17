import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { normalizeText } from '../../lib/format'

/** Dải dấu thanh tổ hợp sinh ra sau khi tách chuỗi bằng normalize('NFD'). */
const combiningMarksPattern = new RegExp('[\\u0300-\\u036f]', 'g')

/** Mỗi lần chỉ vẽ chừng này dòng; danh sách dài hơn thì nhắc gõ để lọc. */
const MAX_VISIBLE_OPTIONS = 100

/** Bỏ dấu và hoa thường từng ký tự, giữ nguyên khoảng trắng — để đo được đoạn khớp trên chuỗi gốc. */
function foldKeepingSpaces(value: string): string {
  return value
    .normalize('NFD')
    .replace(combiningMarksPattern, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

/** Đoạn của `text` khớp với `query` đã bỏ dấu, hoặc null. Chỉ để tô đậm phần khớp. */
function findMatchRange(text: string, query: string): [number, number] | null {
  const foldedQuery = foldKeepingSpaces(query)
  if (!foldedQuery) return null

  let folded = ''
  const originOf: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    const piece = foldKeepingSpaces(text.charAt(index))
    for (let offset = 0; offset < piece.length; offset += 1) originOf.push(index)
    folded += piece
  }

  const at = folded.indexOf(foldedQuery)
  if (at === -1) return null
  return [originOf[at] ?? 0, (originOf[at + foldedQuery.length - 1] ?? text.length - 1) + 1]
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const range = findMatchRange(text, query)
  if (!range) return <>{text}</>

  return (
    <>
      {text.slice(0, range[0])}
      <mark className="bg-transparent font-bold text-indigo-700">{text.slice(range[0], range[1])}</mark>
      {text.slice(range[1])}
    </>
  )
}

interface ComboboxInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Các giá trị gợi ý. Người dùng vẫn gõ được giá trị khác: đây là ô nhập, không phải ô chọn. */
  options: readonly string[]
  placeholder?: string
  maxLength?: number
  /** Gọi giá trị này là gì trong lời nhắc ("chủ đề"): dùng ở dòng "Dùng chủ đề mới ...". */
  noun?: string
  /** Ô còn thiếu, cần người dùng điền: viền và nền sáng màu hổ phách để nhìn là thấy ngay ô nào chưa xong. */
  attention?: boolean
}

/**
 * Ô nhập có danh sách gợi ý, thay cho `<datalist>` của trình duyệt (cửa sổ gợi ý mặc định tối màu, chữ nhỏ
 * và không chỉnh được kiểu).
 *
 * Mở khi bấm vào ô hoặc bấm mũi tên; gõ thì lọc theo chữ đã gõ (không phân biệt hoa thường và dấu) và tô
 * đậm phần khớp. Gõ một giá trị chưa có trong danh sách thì hiện dòng "Dùng ... mới" để người dùng biết
 * mình đang tạo mới. Điều khiển được bằng bàn phím: mũi tên lên xuống, Enter để chọn, Esc để đóng.
 */
export default function ComboboxInput({
  id, value, onChange, options, placeholder, maxLength, noun = 'giá trị', attention = false,
}: ComboboxInputProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [open, setOpen] = useState(false)
  // Chỉ lọc sau khi người dùng thật sự gõ. Mở hộp trên một giá trị có sẵn (đang sửa câu hỏi cũ) thì phải
  // thấy cả danh sách để đổi sang giá trị khác, chứ không phải đúng một dòng khớp chính nó.
  const [filtering, setFiltering] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const typed = value.trim()
  const query = normalizeText(typed)

  const matching = useMemo(
    () => (filtering && query !== '' ? options.filter(option => normalizeText(option).includes(query)) : options),
    [options, filtering, query],
  )
  const visibleOptions = matching.slice(0, MAX_VISIBLE_OPTIONS)
  const hiddenCount = matching.length - visibleOptions.length

  const isNewValue = typed !== '' && !options.some(option => normalizeText(option) === query)
  const rowCount = visibleOptions.length + (isNewValue ? 1 : 0)

  // Đi bằng phím thì dòng đang chọn phải nằm trong tầm nhìn của danh sách cuộn.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const choose = (next: string) => {
    onChange(next)
    setFiltering(false)
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (rowCount === 0) return

      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(current => {
        // Chưa có dòng nào được chọn thì mũi tên lên nhảy về dòng cuối, không phải dòng áp chót.
        if (current < 0 && step < 0) return rowCount - 1
        return (current + step + rowCount) % rowCount
      })
      return
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (activeIndex < 0) {
        setOpen(false)
        return
      }
      if (isNewValue && activeIndex === 0) {
        setOpen(false)
        setActiveIndex(-1)
        return
      }
      const picked = visibleOptions[activeIndex - (isNewValue ? 1 : 0)]
      if (picked !== undefined) choose(picked)
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={event => {
          onChange(event.target.value)
          setFiltering(true)
          setActiveIndex(-1)
          setOpen(true)
        }}
        onFocus={() => {
          setFiltering(false)
          setOpen(true)
        }}
        onClick={() => setOpen(true)}
        // Rời ô (Tab, bấm ra ngoài, đổi cửa sổ) thì đóng; giá trị đã gõ được giữ nguyên. Chọn dòng hay bấm
        // mũi tên đều chặn mousedown nên không làm ô mất focus, do đó không đóng nhầm.
        onBlur={() => {
          setOpen(false)
          setActiveIndex(-1)
        }}
        onKeyDown={handleKeyDown}
        data-attention={attention ? 'true' : undefined}
        className={`w-full pl-3 pr-9 py-2 rounded-xl border text-sm outline-none transition-colors focus:ring-4 ${
          attention
            ? 'border-amber-400 bg-amber-50/70 ring-4 ring-amber-100 focus:border-amber-500 focus:ring-amber-100'
            : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-50'
        }`}
      />

      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Đóng danh sách gợi ý' : 'Mở danh sách gợi ý'}
        // Giữ tiêu điểm trong ô nhập: bấm mũi tên không được làm ô mất focus rồi đóng ngay danh sách.
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          setFiltering(false)
          setOpen(current => !current)
          inputRef.current?.focus()
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (rowCount > 0 || typed === '') && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          onMouseDown={event => event.preventDefault()}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {isNewValue && (
            <li
              id={`${listId}-0`}
              role="option"
              aria-selected={false}
              // mousedown chứ không phải click: ô nhập mất focus ở mousedown, và lúc đó danh sách đã đóng.
              onMouseDown={event => {
                event.preventDefault()
                setOpen(false)
                setActiveIndex(-1)
              }}
              onMouseEnter={() => setActiveIndex(0)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer ${
                activeIndex === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
              }`}
            >
              <Plus size={14} className="flex-shrink-0 text-indigo-500" />
              <span className="min-w-0 truncate">
                Dùng {noun} mới <strong className="font-semibold">“{typed}”</strong>
              </span>
            </li>
          )}

          {visibleOptions.map((option, index) => {
            const rowIndex = index + (isNewValue ? 1 : 0)
            const isSelected = normalizeText(option) === query
            const isActive = activeIndex === rowIndex

            return (
              <li
                key={option}
                id={`${listId}-${rowIndex}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={event => {
                  event.preventDefault()
                  choose(option)
                }}
                onMouseEnter={() => setActiveIndex(rowIndex)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                } ${isSelected ? 'font-semibold' : ''}`}
              >
                <span className="min-w-0 truncate">
                  {filtering ? <Highlighted text={option} query={typed} /> : option}
                </span>
                {isSelected && <Check size={14} className="flex-shrink-0 text-indigo-600" />}
              </li>
            )
          })}

          {visibleOptions.length === 0 && !isNewValue && (
            <li role="presentation" className="px-3 py-2 text-xs text-slate-400">
              Chưa có {noun} nào — hãy gõ tên {noun} mới.
            </li>
          )}

          {hiddenCount > 0 && (
            <li role="presentation" className="px-3 py-2 text-xs text-slate-400">
              Còn {hiddenCount} {noun} khác — gõ để lọc.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
