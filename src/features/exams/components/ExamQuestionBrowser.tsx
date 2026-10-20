import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search, SearchX } from 'lucide-react'
import { DifficultyBadge } from '../../../components/common/Badge'
import SearchField from '../../../components/common/SearchField'
import { formatScore, normalizeText } from '../../../lib/format'
import { questionDisplayTitle } from '../../../lib/questionTitle'
import { difficultyLabels, type DifficultyLevel, type ExamQuestionItem } from '../../../types'
import QuestionBody from './QuestionBody'

type LevelFilter = 'all' | DifficultyLevel

const levelDot: Record<DifficultyLevel, string> = {
  easy: 'bg-emerald-500',
  medium: 'bg-amber-400',
  hard: 'bg-red-400',
}

interface ExamQuestionBrowserProps {
  questions: ExamQuestionItem[]
  revealed: boolean
  onToggleReveal: () => void
}

/**
 * Xem các câu hỏi của một đề, dùng được cả khi đề có vài trăm câu: danh sách gọn mỗi câu một dòng (tìm kiếm, lọc theo
 * mức độ) bên trái, câu đang chọn đọc đầy đủ bên phải, với Câu trước / Câu sau. Cuộn một danh sách dài từng câu đầy đủ
 * thì không ai tìm được câu 237 — cùng kiểu hai cột với hộp chọn câu từ ngân hàng.
 *
 * Số "Câu n" là số thứ tự thật trong đề, không đổi khi đang lọc.
 */
export default function ExamQuestionBrowser({ questions, revealed, onToggleReveal }: ExamQuestionBrowserProps) {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined)
  const selectedRowRef = useRef<HTMLButtonElement>(null)

  const numbered = useMemo(
    () => questions.map((row, index) => ({ ...row, number: index + 1 })),
    [questions],
  )

  const counts = useMemo(() => {
    const result: Record<LevelFilter, number> = { all: numbered.length, easy: 0, medium: 0, hard: 0 }
    numbered.forEach(row => {
      result[row.question.difficulty] += 1
    })
    return result
  }, [numbered])

  const visible = useMemo(() => {
    const needle = normalizeText(search.trim())
    return numbered.filter(row => {
      if (level !== 'all' && row.question.difficulty !== level) return false
      if (needle === '') return true
      return normalizeText(`${row.question.title ?? ''} ${row.question.content}`).includes(needle)
    })
  }, [numbered, search, level])

  // Câu đang chọn bị lọc mất thì rơi về câu đầu của danh sách đang hiện, không để khung bên phải trống.
  const selectedIndex = Math.max(0, visible.findIndex(row => row.question.id === selectedId))
  const selected = visible[selectedIndex]

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected?.question.id])

  const goTo = (index: number) => {
    const target = visible[index]
    if (target) setSelectedId(target.question.id)
  }

  const levelTabs: Array<{ key: LevelFilter; label: string }> = [
    { key: 'all', label: 'Tất cả' },
    { key: 'easy', label: difficultyLabels.easy },
    { key: 'medium', label: difficultyLabels.medium },
    { key: 'hard', label: difficultyLabels.hard },
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col xl:sticky xl:top-24">
        <div className="p-3 space-y-2.5 border-b border-slate-100">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Tìm trong đề"
            label="Tìm câu hỏi trong đề"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo mức độ">
            {levelTabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={level === tab.key}
                onClick={() => setLevel(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  level === tab.key
                    ? 'bg-brand text-ink'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label} {counts[tab.key]}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            <SearchX size={22} className="mx-auto mb-2 text-slate-300" />
            Không có câu nào khớp.
          </div>
        ) : (
          <ul className="scroll-visible overflow-y-scroll max-h-72 xl:max-h-[calc(100vh-17rem)] divide-y divide-slate-50">
            {visible.map(row => {
              const isSelected = row.question.id === selected?.question.id
              return (
                <li key={row.question.id}>
                  <button
                    ref={isSelected ? selectedRowRef : undefined}
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => setSelectedId(row.question.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-indigo-50' : 'hover:bg-indigo-100/70'
                    }`}
                  >
                    <span
                      className={`w-8 text-xs font-bold text-right flex-shrink-0 ${
                        isSelected ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    >
                      {row.number}
                    </span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${levelDot[row.question.difficulty]}`} />
                    <span
                      className={`flex-1 min-w-0 text-sm truncate ${
                        isSelected ? 'font-semibold text-slate-800' : 'text-slate-700'
                      }`}
                      title={questionDisplayTitle(row.question, 400)}
                    >
                      {questionDisplayTitle(row.question)}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{formatScore(row.point)}đ</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <p className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
          <Search size={12} />
          {visible.length === numbered.length
            ? `${numbered.length} câu hỏi`
            : `${visible.length} / ${numbered.length} câu hỏi`}
        </p>
      </div>

      {selected ? (
        <article className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-100">
            <span className="text-base font-bold text-indigo-600">Câu {selected.number}</span>
            <span className="text-sm text-slate-400">/ {numbered.length}</span>
            <DifficultyBadge level={selected.question.difficulty} />
            <span className="text-sm font-semibold text-slate-500">{formatScore(selected.point)} điểm</span>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleReveal}
                aria-pressed={revealed}
                title="Chỉ để giáo viên xem; học sinh không thấy"
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  revealed
                    ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                    : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                }`}
              >
                {revealed ? <EyeOff size={16} /> : <Eye size={16} />} {revealed ? 'Ẩn đáp án' : 'Xem đáp án'}
              </button>
              <button
                type="button"
                onClick={() => goTo(selectedIndex - 1)}
                disabled={selectedIndex === 0}
                aria-label="Câu trước"
                title="Câu trước"
                className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 hover:text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => goTo(selectedIndex + 1)}
                disabled={selectedIndex >= visible.length - 1}
                aria-label="Câu sau"
                title="Câu sau"
                className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 hover:text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <QuestionBody question={selected.question} showAnswers={revealed} />
        </article>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-500">
          Chọn một câu ở danh sách bên trái để xem.
        </div>
      )}
    </div>
  )
}
