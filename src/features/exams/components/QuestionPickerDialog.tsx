import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ImageIcon, Loader2, MousePointerClick, Plus, Users, X,
} from 'lucide-react'
import { DifficultyBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Modal from '../../../components/common/Modal'
import SearchField from '../../../components/common/SearchField'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import SlideSwap, { type SlideDirection } from '../../../components/common/SlideSwap'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { hasQuestionTitle, questionDisplayTitle } from '../../../lib/questionTitle'
import { listQuestions, listTopics } from '../../../services/questionService'
import { difficultyLabels, type DifficultyLevel, type Question, type StudentGroup } from '../../../types'
import QuestionBody from './QuestionBody'

/** Mỗi lần nạp từng ngần này câu khi kéo xuống; đủ lấp đầy khung danh sách mà không nạp cả ngân hàng. */
const BATCH_SIZE = 30

interface QuestionPickerDialogProps {
  open: boolean
  onClose: () => void
  /** Id các câu đã có trong đề: hiện mờ và không chọn lại được. */
  existingIds: ReadonlySet<number>
  /** Số câu đã có trong đề theo từng mức, để chân hộp nói được "đề đang có ... câu dễ, ... câu khó". */
  existingCounts?: Record<DifficultyLevel, number>
  /** Lớp của giáo viên, để lọc "lớp đã nhận" (ẩn những câu lớp đó đã nhận ở đề trước). Không có lớp nào thì không hiện bộ lọc. */
  groups?: StudentGroup[]
  /** Nhận các câu đã chọn, theo thứ tự chọn. */
  onConfirm: (questions: Question[]) => void
  /** Mở trang soạn câu hỏi mới (giữ nguyên đề đang soạn). */
  onCreateNew: () => void
}

const levelDot: Record<DifficultyLevel, string> = {
  easy: '#10B981',
  medium: '#F59E0B',
  hard: '#EF4444',
}

const levelOrder: DifficultyLevel[] = ['easy', 'medium', 'hard']

/** "● 6 Dễ  ● 3 Trung bình  ● 1 Khó": số câu theo từng mức, mỗi mức một chấm màu như huy hiệu độ khó. */
function LevelCountsLine({ counts }: { counts: Record<DifficultyLevel, number> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {levelOrder.map(level => (
        <span key={level} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full" style={{ background: levelDot[level] }} aria-hidden="true" />
          <strong className="text-slate-800">{counts[level]}</strong> {difficultyLabels[level]}
        </span>
      ))}
    </span>
  )
}

/** Nội dung khung bên phải khi chưa bấm vào câu nào. */
function PreviewPlaceholder() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
        <MousePointerClick size={26} />
      </div>
      <p className="text-sm font-semibold text-slate-700">Xem nội dung câu hỏi</p>
      <p className="text-xs text-slate-400 leading-relaxed max-w-[17rem]">
        Bấm vào một câu ở bên trái để xem đầy đủ nội dung, các đáp án và hình ảnh. Bấm vào ô vuông để chọn câu
        đưa vào đề.
      </p>
    </div>
  )
}

function PreviewContent({ question, alreadyInExam }: { question: Question; alreadyInExam: boolean }) {
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DifficultyBadge level={question.difficulty} />
        {question.topic && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {question.topic}
          </span>
        )}
        {alreadyInExam && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
            Đã có trong đề
          </span>
        )}
      </div>

      <QuestionBody question={question} />
    </div>
  )
}

/**
 * Chọn câu hỏi từ ngân hàng để đưa vào đề.
 *
 * Hai thao tác tách bạch: **bấm vào dòng** để xem (nội dung đầy đủ, đáp án, hình ảnh hiện ở khung bên phải
 * và trượt qua lại khi đổi câu), còn **bấm vào ô vuông** mới là chọn. Lựa chọn giữ nguyên khi đổi bộ lọc,
 * nên giáo viên tìm theo từng chủ đề rồi chốt một lần.
 *
 * Danh sách **không phân trang**: kéo xuống là nạp thêm. Với ngân hàng vài trăm câu, bấm "trang sau" giữa
 * lúc đang duyệt là mất mạch; kéo thì liền một mạch.
 *
 * Màn hình hẹp không đủ chỗ cho hai cột: khung xem trở thành ngăn kéo trượt từ bên phải đè lên danh sách.
 */
export default function QuestionPickerDialog({
  open, onClose, existingIds, existingCounts, groups = [], onConfirm, onCreateNew,
}: QuestionPickerDialogProps) {
  const [searchInput, setSearchInput] = useState('')
  const [difficulty, setDifficulty] = useState<'all' | DifficultyLevel>('all')
  const [topic, setTopic] = useState('')
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [selected, setSelected] = useState<Map<number, Question>>(new Map())

  const [items, setItems] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [nextPage, setNextPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const [previewed, setPreviewed] = useState<Question | null>(null)
  const [direction, setDirection] = useState<SlideDirection>('forward')

  const isDesktop = useMediaQuery('(min-width: 64rem)')
  const search = useDebouncedValue(searchInput, 300)

  // Chỉ gửi lớp còn trong danh sách hiện tại (lớp vừa bị gỡ quyền sẽ bị server từ chối). Chuỗi ổn định để làm khoá nạp lại.
  const excludeKey = groupIds
    .filter(id => groups.some(group => group.id === id))
    .sort((left, right) => left - right)
    .join(',')

  // Lần nạp nào cũng mang một số thứ tự: đổi bộ lọc giữa lúc đang nạp thì kết quả đến muộn của bộ lọc cũ bị bỏ.
  const requestRef = useRef(0)
  // Người dùng bấm "câu sau" đúng lúc đã tới câu cuối đang có: chờ nạp xong rồi sang câu kế tiếp.
  const pendingAdvanceRef = useRef<{ fromId: number; focusRow: boolean } | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Một trang vượt cuối trả về rỗng (dữ liệu ngân hàng vừa đổi nên tổng cũ lớn hơn số câu thật): dừng nạp thêm
  // thay vì để vùng cuối danh sách gọi mãi.
  const [exhausted, setExhausted] = useState(false)
  const hasMore = items.length < total && !exhausted

  const loadPage = useCallback(async (pageNumber: number) => {
    requestRef.current += 1
    const requestId = requestRef.current

    setLoading(true)
    setError(undefined)

    try {
      const result = await listQuestions({
        search: search.trim() || undefined,
        topic: topic || undefined,
        difficulty,
        status: 'active',
        page: pageNumber,
        pageSize: BATCH_SIZE,
        excludeAssignedToGroupIds: excludeKey ? excludeKey.split(',').map(Number) : undefined,
      })
      if (requestRef.current !== requestId) return

      setItems(current => {
        if (pageNumber === 1) return result.items
        const known = new Set(current.map(question => question.id))
        return [...current, ...result.items.filter(question => !known.has(question.id))]
      })
      setTotal(result.total)
      setNextPage(pageNumber + 1)
      if (pageNumber > 1 && result.items.length === 0) setExhausted(true)
    } catch (caught) {
      if (requestRef.current !== requestId) return
      setError(caught instanceof Error && caught.message ? caught.message : 'Không tải được danh sách câu hỏi.')
    } finally {
      if (requestRef.current === requestId) setLoading(false)
    }
  }, [search, topic, difficulty, excludeKey])

  // Mở lại hộp thì bắt đầu từ trang sạch: lựa chọn của lần trước đã được đưa vào đề rồi.
  useEffect(() => {
    if (!open) return
    setSearchInput('')
    setDifficulty('all')
    setTopic('')
    setGroupsOpen(false)
    setSelected(new Map())
    setPreviewed(null)
    setDirection('forward')
  }, [open])

  // Đổi bộ lọc (hoặc mở hộp) thì nạp lại từ đầu.
  useEffect(() => {
    if (!open) return
    setItems([])
    setTotal(0)
    setNextPage(1)
    setExhausted(false)
    pendingAdvanceRef.current = null
    void loadPage(1)
  }, [open, loadPage])

  // Kéo gần tới cuối thì nạp thêm.
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = listRef.current
    if (!open || !sentinel || !root || !hasMore || loading || error) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) void loadPage(nextPage)
      },
      { root, rootMargin: '0px 0px 240px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, hasMore, loading, error, nextPage, loadPage, items.length])

  const topicsQuery = useAsync(() => listTopics(), [])

  const previewIndex = previewed ? items.findIndex(question => question.id === previewed.id) : -1

  const toggleGroup = (groupId: number) => {
    setGroupIds(current => (current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId]))
  }

  const toggle = (question: Question) => {
    setSelected(current => {
      const next = new Map(current)
      if (next.has(question.id)) next.delete(question.id)
      else next.set(question.id, question)
      return next
    })
  }

  // ── Xem câu hỏi ──────────────────────────────────────────────────────────────────────────────────
  const preview = (question: Question) => {
    if (previewed?.id === question.id) return

    // Câu ở dưới câu đang xem thì nội dung mới vào từ bên phải, câu ở trên thì từ bên trái — như lật trang.
    const targetIndex = items.findIndex(item => item.id === question.id)
    setDirection(previewIndex === -1 || targetIndex > previewIndex ? 'forward' : 'back')
    setPreviewed(question)
  }

  const closePreview = () => {
    setDirection('back')
    setPreviewed(null)
  }

  /** Sang câu liền trước/sau; `focusRow` đưa tiêu điểm theo (dùng khi gõ phím mũi tên). */
  const step = (fromIndex: number, delta: -1 | 1, focusRow: boolean) => {
    const target = items[fromIndex + delta]

    if (!target) {
      // Đã tới câu cuối đang nạp mà ngân hàng còn nữa: nạp thêm rồi sang câu kế tiếp.
      const from = items[fromIndex]
      if (delta > 0 && from && hasMore && !loading) {
        pendingAdvanceRef.current = { fromId: from.id, focusRow }
        void loadPage(nextPage)
      }
      return
    }

    preview(target)

    const row = document.getElementById(`picker-row-${target.id}`)
    if (focusRow) row?.focus()
    else row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  // Nạp thêm xong thì hoàn tất lần "câu sau" đang chờ.
  useEffect(() => {
    const pending = pendingAdvanceRef.current
    if (!pending) return

    const fromIndex = items.findIndex(question => question.id === pending.fromId)
    const target = fromIndex === -1 ? undefined : items[fromIndex + 1]
    if (!target) {
      if (!loading) pendingAdvanceRef.current = null
      return
    }

    pendingAdvanceRef.current = null
    setDirection('forward')
    setPreviewed(target)
    window.requestAnimationFrame(() => {
      const row = document.getElementById(`picker-row-${target.id}`)
      if (pending.focusRow) row?.focus()
      else row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [items, loading])

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

    const rowId = event.target instanceof HTMLElement ? event.target.dataset.pickerRow : undefined
    if (!rowId) return

    const fromIndex = items.findIndex(item => String(item.id) === rowId)
    if (fromIndex === -1) return

    event.preventDefault()
    step(fromIndex, event.key === 'ArrowDown' ? 1 : -1, true)
  }

  // Số câu đang chọn theo từng mức, và tổng số câu đề đã có — để chân hộp nói rõ "6 Dễ · 3 Trung bình · 1 Khó".
  const selectedCounts: Record<DifficultyLevel, number> = { easy: 0, medium: 0, hard: 0 }
  selected.forEach(question => {
    selectedCounts[question.difficulty] += 1
  })
  const existingTotal = existingCounts ? existingCounts.easy + existingCounts.medium + existingCounts.hard : 0

  const previewIsExisting = previewed !== null && existingIds.has(previewed.id)
  const previewIsChecked = previewed !== null && selected.has(previewed.id)

  // Màn hình hẹp: khung xem nằm ngoài tầm nhìn khi chưa bấm câu nào, nên phải tắt khỏi tab và trình đọc.
  const previewHidden = !isDesktop && previewed === null

  const canGoNext = previewIndex >= 0 && (previewIndex < items.length - 1 || hasMore)

  return (
    <Modal
      open={open}
      title="Thêm câu hỏi từ ngân hàng"
      description="Bấm vào một câu để xem nội dung, đáp án và hình ảnh; bấm vào ô vuông để chọn câu đưa vào đề. Câu đã có trong đề được hiện mờ."
      onClose={onClose}
      size="xl"
      flush
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="text-sm text-slate-500 space-y-1 min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {selected.size > 0 ? (
                <>
                  <span>Đã chọn <strong className="text-slate-800">{selected.size}</strong> câu:</span>
                  <LevelCountsLine counts={selectedCounts} />
                </>
              ) : 'Chưa chọn câu nào'}
            </p>
            {existingCounts && existingTotal > 0 && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span>Đề đang có {existingTotal} câu:</span>
                <LevelCountsLine counts={existingCounts} />
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => onConfirm(Array.from(selected.values()))}
              disabled={selected.size === 0}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              {selected.size > 0 ? `Thêm ${selected.size} câu vào đề` : 'Thêm vào đề'}
            </button>
          </div>
        </div>
      }
    >
      <div className="relative flex h-[min(66vh,620px)] overflow-hidden">
        {/* ── Danh sách ─────────────────────────────────────────────────────────────────────────── */}
        <section className="flex flex-col min-h-0 min-w-0 w-full lg:w-[44%] lg:flex-none lg:border-r lg:border-slate-100">
          <div className="px-5 pt-4 pb-3 space-y-3 border-b border-slate-100">
            <SearchField
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Tìm theo tên, nội dung hoặc chủ đề"
              label="Tìm câu hỏi trong ngân hàng"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={difficulty}
                onChange={event => setDifficulty(event.target.value as 'all' | DifficultyLevel)}
                aria-label="Lọc theo mức độ"
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400"
              >
                <option value="all">Mọi mức độ</option>
                {(['easy', 'medium', 'hard'] as const).map(level => (
                  <option key={level} value={level}>{difficultyLabels[level]}</option>
                ))}
              </select>
              <select
                value={topic}
                onChange={event => setTopic(event.target.value)}
                aria-label="Lọc theo chủ đề"
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400"
              >
                <option value="">Mọi chủ đề</option>
                {(topicsQuery.data ?? []).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {groups.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setGroupsOpen(current => !current)}
                  aria-expanded={groupsOpen}
                  aria-controls="picker-groups"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  <Users size={13} />
                  Lớp đã nhận
                  {excludeKey && (
                    <span className="px-1.5 rounded-md bg-indigo-100 text-indigo-700">{excludeKey.split(',').length}</span>
                  )}
                  <ChevronDown size={13} className={`transition-transform ${groupsOpen ? 'rotate-180' : ''}`} />
                </button>

                {groupsOpen && (
                  <div id="picker-groups" className="mt-2 space-y-1.5">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Tích các lớp sẽ làm đề này: ẩn những câu đã nằm trong các đề từng giao cho lớp đó.
                    </p>
                    <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
                      {groups.map(group => (
                        <label
                          key={group.id}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={groupIds.includes(group.id)}
                            onChange={() => toggleGroup(group.id)}
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span className="flex-1 min-w-0 truncate">{group.name}</span>
                          <span className="text-xs text-slate-400">{group.studentCount} học sinh</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{total > 0 ? `${total} câu` : ' '}</span>
              <button
                type="button"
                onClick={onCreateNew}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
              >
                <Plus size={13} /> Tạo câu hỏi mới
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {error && items.length === 0 && <ErrorState message={error} onRetry={() => void loadPage(1)} />}

            {!error && loading && items.length === 0 && (
              <div className="space-y-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <SkeletonBlock key={index} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            )}

            {!error && !loading && items.length === 0 && (
              <EmptyState
                icon={CheckCircle2}
                title="Không có câu hỏi nào khớp"
                description={excludeKey
                  ? 'Thử đổi từ khoá, mức độ, chủ đề hoặc bỏ bớt lớp ở mục "Lớp đã nhận". Chỉ câu đang bật mới đưa vào đề được.'
                  : 'Thử đổi từ khoá, mức độ hoặc chủ đề. Chỉ câu đang bật mới đưa vào đề được.'}
              />
            )}

            {items.length > 0 && (
              <>
                <ul className="space-y-2" onKeyDown={handleListKeyDown}>
                  {items.map((question, index) => {
                    const already = existingIds.has(question.id)
                    const isChecked = selected.has(question.id)
                    const isPreviewed = previewed?.id === question.id
                    const correctText = question.answers
                      .map((answer, answerIndex) => (
                        answer.isCorrect ? answer.content.trim() || `Đáp án ${String.fromCharCode(65 + answerIndex)}` : null
                      ))
                      .filter((text): text is string => text !== null)
                      .join(' · ')

                    const rowClass = isPreviewed
                      ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100'
                      : already
                        ? 'border-slate-100 bg-slate-50 opacity-70'
                        : isChecked
                          ? 'border-indigo-200 bg-indigo-50/30'
                          : 'border-slate-100 bg-white hover:border-slate-200'

                    return (
                      <li key={question.id}>
                        <div className={`flex items-stretch rounded-xl border transition-colors ${rowClass}`}>
                          {/* Ô vuông: chọn câu. Tách khỏi vùng bấm-để-xem để hai việc không lẫn vào nhau. */}
                          <label
                            title={already ? 'Đã có trong đề' : 'Chọn câu này'}
                            className={`flex items-start pl-3.5 pr-2 py-3.5 ${already ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={already || isChecked}
                              disabled={already}
                              onChange={() => toggle(question)}
                              aria-label={`Chọn câu ${index + 1}`}
                              className="w-4 h-4 accent-indigo-600 mt-0.5 flex-shrink-0"
                            />
                          </label>

                          {/* Vùng bấm-để-xem: hiện nội dung đầy đủ ở khung bên phải. */}
                          <button
                            type="button"
                            id={`picker-row-${question.id}`}
                            data-picker-row={question.id}
                            onClick={() => preview(question)}
                            aria-pressed={isPreviewed}
                            className="flex-1 min-w-0 text-left py-3 pr-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                          >
                            <span className="flex flex-wrap items-center gap-2 mb-1">
                              <DifficultyBadge level={question.difficulty} />
                              {question.topic && (
                                <span className="text-xs font-medium text-slate-500">{question.topic}</span>
                              )}
                              {question.allowMultiple && (
                                <span className="text-xs font-semibold text-violet-600">Nhiều đáp án</span>
                              )}
                              {question.imageUrl && <ImageIcon size={13} className="text-slate-400" />}
                              {already && (
                                <span className="text-xs font-semibold text-indigo-600">Đã có trong đề</span>
                              )}
                            </span>
                            {hasQuestionTitle(question) ? (
                              <>
                                <span className="text-sm font-semibold text-slate-800 line-clamp-1">
                                  {questionDisplayTitle(question)}
                                </span>
                                <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                  {question.content}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-slate-800 line-clamp-2">
                                {questionDisplayTitle(question, 200)}
                              </span>
                            )}
                            {correctText && (
                              <span className="text-xs text-emerald-700 mt-1 line-clamp-1">
                                Đáp án đúng: {correctText}
                              </span>
                            )}
                          </button>

                          <ChevronRight
                            size={16}
                            aria-hidden="true"
                            className={`self-center mr-3 flex-shrink-0 transition-all ${
                              isPreviewed ? 'text-indigo-500 translate-x-0.5' : 'text-slate-300'
                            }`}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* Mốc cuối danh sách: chạm tới là nạp thêm. */}
                <div ref={sentinelRef} className="h-px" aria-hidden="true" />

                {loading && (
                  <p className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                    <Loader2 size={14} className="animate-spin" /> Đang tải thêm câu hỏi…
                  </p>
                )}

                {error && (
                  <div className="py-3 text-center">
                    <p className="text-xs text-red-500">{error}</p>
                    <button
                      type="button"
                      onClick={() => void loadPage(nextPage)}
                      className="mt-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Thử tải lại
                    </button>
                  </div>
                )}

                {!hasMore && !loading && !error && items.length > 8 && (
                  <p className="py-3 text-center text-xs text-slate-300">Đã hiện hết {total} câu</p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Xem câu hỏi ───────────────────────────────────────────────────────────────────────── */}
        <aside
          aria-label="Xem câu hỏi"
          aria-hidden={previewHidden || undefined}
          inert={previewHidden}
          className={`absolute inset-0 z-10 flex flex-col min-h-0 bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            previewed ? 'translate-x-0' : 'translate-x-full'
          } lg:static lg:z-auto lg:flex-1 lg:min-w-0 lg:translate-x-0 lg:shadow-none`}
        >
          <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <button
              type="button"
              onClick={closePreview}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft size={14} /> Danh sách
            </button>

            <p className="min-w-0 flex-1 text-sm font-bold text-slate-800">Xem câu hỏi</p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => step(previewIndex, -1, false)}
                disabled={previewIndex <= 0}
                aria-label="Câu trước"
                title="Câu trước"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => step(previewIndex, 1, false)}
                disabled={!canGoNext}
                aria-label="Câu sau"
                title="Câu sau"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={closePreview}
                disabled={previewed === null}
                aria-label="Đóng phần xem câu hỏi"
                title="Đóng"
                className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="flex-1 min-h-0">
            <SlideSwap contentKey={previewed ? `question-${previewed.id}` : 'empty'} direction={direction}>
              {previewed ? (
                <PreviewContent question={previewed} alreadyInExam={existingIds.has(previewed.id)} />
              ) : (
                <PreviewPlaceholder />
              )}
            </SlideSwap>
          </div>

          {previewed && (
            <div className="px-4 py-3 border-t border-slate-100">
              {previewIsExisting ? (
                <p className="text-center text-sm font-semibold text-slate-400 py-2">Câu này đã có trong đề</p>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(previewed)}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    previewIsChecked
                      ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                      : 'text-white'
                  }`}
                  style={previewIsChecked ? undefined : { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  <CheckCircle2 size={16} />
                  {previewIsChecked ? 'Đã chọn — bấm để bỏ chọn' : 'Chọn câu này'}
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </Modal>
  )
}
