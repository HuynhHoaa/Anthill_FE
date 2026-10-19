import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { normalizeText } from '../../../lib/format'
import type { SchoolPreviewGroup, SchoolPreviewStudent } from '../../../services/importService'

interface SchoolPreviewListProps {
  groups: SchoolPreviewGroup[]
  /** Tên các môn sẽ được tạo mới từ file: môn trùng tên được tô để soát chính tả. */
  newSubjects: string[]
  /** Tên các kỳ học sẽ được tạo mới từ file. */
  newTerms: string[]
}

/** Số học sinh vẽ ra mỗi lượt. File thật có thể có hàng chục nghìn em; vẽ hết một lớp lớn một lúc làm đơ cả hộp. */
const PAGE_SIZE = 200

/** Từ chừng này lớp trở lên thì có nút cuộn dải tab (dải tab luôn cuộn ngang được bằng chuột, ngón tay và bàn phím). */
const SCROLL_BUTTONS_FROM = 5

function formatCount(value: number): string {
  return value.toLocaleString('vi-VN')
}

function Badge({ tone, children }: { tone: 'indigo' | 'slate' | 'amber'; children: string }) {
  const toneClass = {
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-500',
    amber: 'bg-amber-50 text-amber-700',
  }[tone]

  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap ${toneClass}`}>
      {children}
    </span>
  )
}

/**
 * Danh sách lớp để quản trị viên soát trước khi nhập cả trường: mỗi lớp mới là một tab, đầu tab ghi giáo viên chủ nhiệm và môn, phần
 * thân là danh sách học sinh của lớp (cuộn trong khung, vẽ từng lượt cho nhẹ). Ô tìm kiếm lọc học sinh theo mã hoặc tên trong mọi lớp.
 * Chỉ gồm những gì nhập được; dòng hỏng nằm ở bảng lỗi bên dưới.
 */
export default function SchoolPreviewList({ groups, newSubjects, newTerms }: SchoolPreviewListProps) {
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const needle = normalizeText(deferredQuery)
  const tabListRef = useRef<HTMLDivElement>(null)

  // Khoá tìm kiếm của từng em tính một lần cho cả file, không tính lại ở mỗi lần gõ.
  const indexed = useMemo(
    () => groups.map(group => group.students.map(student => ({ student, key: normalizeText(`${student.code} ${student.fullName}`) }))),
    [groups],
  )
  const matches = useMemo(
    () => indexed.map(list => (needle ? list.filter(item => item.key.includes(needle)).map(item => item.student) : list.map(item => item.student))),
    [indexed, needle],
  )

  const current = Math.min(active, Math.max(0, groups.length - 1))
  const studentTotal = useMemo(() => groups.reduce((sum, group) => sum + group.students.length, 0), [groups])
  const newSubjectKeys = useMemo(() => new Set(newSubjects.map(name => normalizeText(name))), [newSubjects])
  const newTermKeys = useMemo(() => new Set(newTerms.map(name => normalizeText(name))), [newTerms])

  // Tab đang chọn luôn nằm trong tầm nhìn của dải tab (chọn bằng bàn phím hay bằng nút mũi tên).
  useEffect(() => {
    const selected = tabListRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    selected?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [current])

  if (groups.length === 0) return null

  const group = groups[current]
  const visible = matches[current]
  const subjectIsNew = newSubjectKeys.has(normalizeText(group.subject))
  const termIsNew = group.termName ? newTermKeys.has(normalizeText(group.termName)) : false

  const scrollTabs = (direction: 1 | -1) => {
    tabListRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' })
  }

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = groups.length - 1
    const next = {
      ArrowRight: Math.min(last, current + 1),
      ArrowLeft: Math.max(0, current - 1),
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActive(next)
    // Tiêu điểm đi theo tab mới để bấm tiếp mũi tên còn đi tiếp được.
    requestAnimationFrame(() => {
      tabListRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">
          Danh sách lớp
          <span className="font-normal text-slate-400"> · {formatCount(groups.length)} lớp, {formatCount(studentTotal)} học sinh</span>
        </span>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Tìm học sinh theo mã hoặc tên trong mọi lớp</span>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Tìm học sinh theo mã hoặc tên"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          />
        </label>
      </div>

      <div className="flex items-stretch border-b border-slate-100 bg-white">
        {groups.length >= SCROLL_BUTTONS_FROM && (
          <button
            type="button"
            onClick={() => scrollTabs(-1)}
            aria-label="Cuộn danh sách lớp sang trái"
            className="px-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Các lớp sẽ nhập"
          className="flex-1 min-w-0 flex gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:thin]"
        >
          {groups.map((item, index) => {
            const selected = index === current
            const count = needle ? matches[index].length : item.students.length

            return (
              <button
                key={item.name}
                type="button"
                role="tab"
                id={`school-tab-${index}`}
                aria-selected={selected}
                aria-controls="school-tab-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={handleTabKey}
                className={`flex-shrink-0 inline-flex items-center gap-2 max-w-[15rem] px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  selected
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : needle && count === 0
                      ? 'border-transparent text-slate-300 hover:bg-slate-50'
                      : 'border-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{item.name}</span>
                <span className={`text-xs font-medium tabular-nums ${selected ? 'text-indigo-500' : 'text-slate-400'}`}>
                  {formatCount(count)}
                </span>
              </button>
            )
          })}
        </div>
        {groups.length >= SCROLL_BUTTONS_FROM && (
          <button
            type="button"
            onClick={() => scrollTabs(1)}
            aria-label="Cuộn danh sách lớp sang phải"
            className="px-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div id="school-tab-panel" role="tabpanel" aria-labelledby={`school-tab-${current}`}>
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
            <span className="text-slate-500">Giáo viên phụ trách:</span>
            <span className="font-semibold text-slate-800">{group.teacherName || group.teacherEmail}</span>
            <span className="text-xs text-slate-400 break-all">{group.teacherEmail}</span>
            <Badge tone={group.teacherExists ? 'slate' : 'indigo'}>{group.teacherExists ? 'Giáo viên đã có' : 'Giáo viên mới'}</Badge>
            {group.subject && (
              <Badge tone={subjectIsNew ? 'amber' : 'slate'}>{subjectIsNew ? `Môn mới: ${group.subject}` : `Môn: ${group.subject}`}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {group.termName && (
              <Badge tone={termIsNew ? 'amber' : 'slate'}>{termIsNew ? `Kỳ mới: ${group.termName}` : `Kỳ: ${group.termName}`}</Badge>
            )}
            <Badge tone={group.exists ? 'slate' : 'indigo'}>{group.exists ? 'Lớp đã có' : 'Lớp mới'}</Badge>
            <span className="tabular-nums">
              {needle
                ? `${formatCount(visible.length)}/${formatCount(group.students.length)} học sinh`
                : `${formatCount(group.students.length)} học sinh`}
            </span>
          </div>
        </div>

        {/* Đổi lớp hay đổi từ khoá thì danh sách vẽ lại từ lượt đầu. */}
        <StudentTable key={`${current}|${needle}`} students={visible} totalInGroup={group.students.length} searching={needle !== ''} />
      </div>
    </div>
  )
}

function StudentTable({
  students,
  totalInGroup,
  searching,
}: {
  students: SchoolPreviewStudent[]
  totalInGroup: number
  searching: boolean
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const shown = students.slice(0, limit)
  const rest = students.length - shown.length

  if (totalInGroup === 0) {
    return <p className="px-4 py-6 text-sm text-slate-400 text-center">Lớp này chưa có học sinh nào nhập được.</p>
  }
  if (students.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-400 text-center">{searching ? 'Không có học sinh nào trong lớp này khớp từ khoá.' : 'Lớp này chưa có học sinh.'}</p>
  }

  return (
    <div className="max-h-[min(42vh,24rem)] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_rgb(241_245_249)]">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-2 w-28">Mã</th>
            <th className="px-2 py-2">Họ và tên</th>
            <th className="px-2 py-2 w-20 hidden sm:table-cell">Dòng</th>
            <th className="px-4 py-2 w-20" aria-label="Trạng thái" />
          </tr>
        </thead>
        <tbody>
          {shown.map(student => (
            <tr key={student.row} className="border-b border-slate-50 last:border-0 hover:bg-indigo-50/50 transition-colors">
              <td className="px-4 py-1.5 font-mono text-xs text-slate-500 truncate">{student.code}</td>
              <td className="px-2 py-1.5 text-slate-800">{student.fullName}</td>
              <td className="px-2 py-1.5 tabular-nums text-xs text-slate-400 hidden sm:table-cell">{student.row}</td>
              <td className="px-4 py-1.5 text-right">{student.exists && <Badge tone="slate">Đã có</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rest > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => setLimit(value => value + PAGE_SIZE)}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Hiện thêm {formatCount(Math.min(PAGE_SIZE, rest))} học sinh
            <span className="font-normal text-slate-400"> · còn {formatCount(rest)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
