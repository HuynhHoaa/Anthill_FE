import { useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import SlidingSegments from '../../../components/common/SlidingSegments'
import { formatScore } from '../../../lib/format'
import type { ExamPapersOverview } from '../../../services/examService'
import { difficultyLabels, type ExamQuestionItem } from '../../../types'
import ExamQuestionBrowser from './ExamQuestionBrowser'

/** Đề nhỏ cần mở ngay khi vào tab — từ liên kết ở bảng theo dõi hay thẻ "Chia đề". `key` đổi mỗi lần bấm. */
export interface PaperFocus {
  groupId?: number
  variantIndex: number
  key: number
}

interface ExamPaperViewerProps {
  overview: ExamPapersOverview
  /** Đề lớn: toàn bộ câu của danh sách, theo thứ tự giáo viên xếp. */
  pool: ExamQuestionItem[]
  /** Đơn vị 0,01 điểm cộng thêm cho các câu mức cao nhất của mỗi đề nhỏ (`Exam.paperBonusUnits`); điểm một đề nhỏ phải tính cả phần này. */
  bonusUnits: number
  focus?: PaperFocus
  revealed: boolean
  onToggleReveal: () => void
}

type ViewMode = 'pool' | 'paper'

const classKeyOf = (group: { groupId?: number; groupName: string }) => String(group.groupId ?? group.groupName)

const segmentClass = (active: boolean) =>
  `relative z-10 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
    active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
  }`

/**
 * Tab Nội dung của một đề được chia thành nhiều đề nhỏ: xem đề lớn (mọi câu giáo viên đã duyệt) hoặc xem từng đề nhỏ của
 * một lớp — các câu thật mà các em của lớp đó đang cầm, với số em mỗi đề và những câu trùng với đề khác của lớp.
 *
 * Đề nhỏ chỉ có sau khi giao bài (mỗi lớp được chia riêng lúc giao), nên chưa giao lớp nào thì chỉ xem được đề lớn.
 * Thứ tự câu hiện ở đây là thứ tự trong đề lớn; mỗi em còn có thứ tự câu và đáp án trộn riêng của mình.
 */
export default function ExamPaperViewer({ overview, pool, bonusUnits, focus, revealed, onToggleReveal }: ExamPaperViewerProps) {
  const classes = overview.classes
  const hasClasses = classes.length > 0

  const [mode, setMode] = useState<ViewMode>('pool')
  const [classKey, setClassKey] = useState<string | undefined>(undefined)
  const [variantIndex, setVariantIndex] = useState(0)

  // Bấm một mã đề ở nơi khác thì mở thẳng đề đó — đúng một lần cho mỗi lần bấm, không bị kéo lại khi trang nạp lại.
  const appliedFocus = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!focus) {
      appliedFocus.current = undefined
      return
    }
    if (appliedFocus.current === focus.key) return
    const target = classes.find(group => group.groupId === focus.groupId)
    if (!target) return
    appliedFocus.current = focus.key
    setMode('paper')
    setClassKey(classKeyOf(target))
    setVariantIndex(focus.variantIndex)
  }, [focus, classes])

  const group = classes.find(item => classKeyOf(item) === classKey) ?? classes[0]
  const paper = group?.papers.find(item => item.variantIndex === variantIndex) ?? group?.papers[0]
  const showingPaper = mode === 'paper' && hasClasses && paper !== undefined

  const shown = useMemo(() => {
    if (!showingPaper || !paper) return pool
    const ids = new Set(paper.questionIds)
    return pool.filter(row => ids.has(row.question.id))
  }, [showingPaper, paper, pool])

  // Điểm cộng thêm chỉ có ở đề nhỏ: mỗi em nhận 0,01 ở vài câu mức cao nhất của riêng đề mình nên tổng một đề luôn đủ 10.
  const shownScore = useMemo(
    () => (shown.reduce((sum, row) => sum + Math.round(row.point * 100), 0) + (showingPaper ? bonusUnits : 0)) / 100,
    [shown, showingPaper, bonusUnits],
  )

  const overlaps = useMemo(() => {
    if (!showingPaper || !group || !paper) return []
    const mine = new Set(paper.questionIds)
    return group.papers
      .filter(other => other.variantIndex !== paper.variantIndex)
      .map(other => ({ label: other.label, shared: other.questionIds.filter(id => mine.has(id)).length }))
      .filter(item => item.shared > 0)
  }, [showingPaper, group, paper])

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3" aria-label="Chọn đề cần xem">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Xem</span>
          <SlidingSegments role="radiogroup" aria-label="Đề cần xem" activeKey={mode} indicatorClassName="rounded-lg" className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'pool'}
              data-tab-active={mode === 'pool'}
              onClick={() => setMode('pool')}
              className={segmentClass(mode === 'pool')}
            >
              Đề lớn · {pool.length} câu
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'paper'}
              data-tab-active={mode === 'paper'}
              onClick={() => setMode('paper')}
              className={segmentClass(mode === 'paper')}
            >
              Từng đề nhỏ
            </button>
          </SlidingSegments>
        </div>

        {mode === 'paper' && !hasClasses && (
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 leading-relaxed">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Chưa giao cho lớp nào nên chưa có đề nhỏ nào. Mỗi lớp được chia riêng vào lúc giao bài, rồi các đề nhỏ của lớp
              đó hiện ở đây.
            </span>
          </p>
        )}

        {mode === 'paper' && hasClasses && group && (
          <>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="min-w-[11rem]">
                <label htmlFor="paper-view-class" className="block text-xs font-semibold text-slate-600 mb-1">Lớp</label>
                <select
                  id="paper-view-class"
                  value={classKeyOf(group)}
                  onChange={event => {
                    setClassKey(event.target.value)
                    setVariantIndex(0)
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                >
                  {classes.map(item => (
                    <option key={classKeyOf(item)} value={classKeyOf(item)}>
                      {item.groupName} ({item.students} em)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-600 mb-1">Đề</span>
                <div role="radiogroup" aria-label="Mã đề" className="flex flex-wrap items-center gap-2">
                  {group.papers.map(item => {
                    const active = item.variantIndex === paper?.variantIndex
                    return (
                      <button
                        key={item.variantIndex}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setVariantIndex(item.variantIndex)}
                        className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
                          active
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                        }`}
                      >
                        Đề {item.label}
                        <span className="ml-1.5 text-xs font-medium opacity-70">{item.students} em</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {paper && (
              <div className="text-xs text-slate-500 leading-relaxed space-y-1">
                <p>
                  <strong className="text-slate-700 font-semibold">Đề {paper.label} của {group.groupName}:</strong>{' '}
                  {paper.questionCount} câu ({difficultyLabels.easy} {paper.easy} · {difficultyLabels.medium} {paper.medium} ·{' '}
                  {difficultyLabels.hard} {paper.hard}) · {formatScore(shownScore)} điểm · {paper.students} em đang cầm đề này.
                  Mỗi em có thứ tự câu và đáp án trộn riêng.
                </p>
                {overlaps.length > 0 && (
                  <p>
                    Câu trùng với đề khác của lớp:{' '}
                    {overlaps.map(item => `đề ${item.label} (${item.shared} câu)`).join(', ')}.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <ExamQuestionBrowser questions={shown} revealed={revealed} onToggleReveal={onToggleReveal} />
    </div>
  )
}
