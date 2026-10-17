import { useEffect, useState, type CSSProperties } from 'react'
import { AlertTriangle, BookOpen, Check, ChevronDown, Loader2, Minus, Plus, Users, Wand2 } from 'lucide-react'
import InfoTip from '../../../components/common/InfoTip'
import Modal from '../../../components/common/Modal'
import { useAsync } from '../../../hooks/useAsync'
import { composeQuestions, previewBlueprint, type ComposeQuestionsResult } from '../../../services/examService'
import { listTopics } from '../../../services/questionService'
import { difficultyLabels, type DifficultyLevel, type StudentGroup } from '../../../types'
import { difficultyBarColors } from '../utils/blueprintRatio'

const LEVELS: readonly DifficultyLevel[] = ['easy', 'medium', 'hard']

const DEFAULT_COUNTS: Record<DifficultyLevel, number> = { easy: 6, medium: 10, hard: 4 }

const MAX_PER_LEVEL = 500

/** Giá trị ô chọn cho "không giới hạn chương": phải chọn rõ ràng, không để mặc định lọt mọi chương. */
const ALL_TOPICS = '__all__'

/** Màu của thẻ từng mức: viền và nền nhạt khi mức đó có yêu cầu, màu của thanh "đủ / thiếu". */
const levelTone: Record<DifficultyLevel, { activeCard: string; bar: string }> = {
  easy: { activeCard: 'border-emerald-200 bg-emerald-50/50', bar: 'bg-emerald-500' },
  medium: { activeCard: 'border-amber-200 bg-amber-50/50', bar: 'bg-amber-500' },
  hard: { activeCard: 'border-red-200 bg-red-50/50', bar: 'bg-red-500' },
}

const stepButtonClass =
  'w-9 h-9 flex-shrink-0 rounded-xl border border-slate-200 bg-white text-slate-500 flex items-center justify-center transition-all hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500 disabled:hover:bg-white disabled:active:scale-100 motion-reduce:transition-none'

/** Các khối của hộp hiện lần lượt, mỗi khối chậm hơn khối trước một nhịp. */
const stagger = (step: number): CSSProperties => ({ animationDelay: `${step * 70}ms` })

interface ComposeQuestionsDialogProps {
  open: boolean
  onClose: () => void
  /** Id các câu đã có trong đề, để không rút trùng. */
  existingIds: number[]
  /** Lớp của giáo viên, để chọn "không lặp lại câu lớp đã nhận". */
  groups: StudentGroup[]
  /** Nhận các câu rút được. Hộp tự đóng sau đó. */
  onComposed: (result: ComposeQuestionsResult) => void
}

/**
 * "Soạn tự động": giáo viên chọn chương (chủ đề) và nói cần bao nhiêu câu mỗi mức, hệ thống rút ngẫu nhiên từ ngân hàng và bỏ
 * thẳng vào đề để duyệt. Không rút được đủ thì vẫn trả những gì có — kết quả nói mức nào thiếu.
 *
 * - **Chương phải chọn rõ ràng** (không có mặc định "mọi chủ đề"): đề cho một chương không được lọt câu của chương khác.
 * - **Đề nhiều chương**: soạn chương này xong, mở hộp lần nữa chọn chương sau — câu mới được thêm vào cuối đề và không rút lại
 *   câu đã có. Sau mỗi lần soạn, ô chương về trống để chọn chương tiếp theo; số câu và lớp đã chọn được giữ.
 * - **Không lặp câu cũ của lớp**: chọn các lớp sẽ làm đề này, hệ thống bỏ những câu mà các lớp đó đã nhận ở đề trước.
 * - **Báo thiếu từ trước khi soạn**: mỗi thẻ mức có thanh so số câu yêu cầu với số câu dùng được của chương, và chân hộp nói
 *   thẳng mức nào sẽ thiếu — giáo viên không phải đợi tới lúc soạn xong mới biết.
 */
export default function ComposeQuestionsDialog({
  open, onClose, existingIds, groups, onComposed,
}: ComposeQuestionsDialogProps) {
  const [counts, setCounts] = useState<Record<DifficultyLevel, number>>(DEFAULT_COUNTS)
  const [topic, setTopic] = useState('')
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSubmitting(false)
  }, [open])

  const topicChosen = topic !== ''
  const topicsQuery = useAsync(() => listTopics(), [])
  // Số câu DÙNG ĐƯỢC (đang bật) của chương đã chọn, theo từng mức. Dùng bản xem trước ma trận vì nó đếm đúng theo chủ đề và chỉ
  // đếm câu đang bật; tổng quan ngân hàng không lọc theo chủ đề và tính cả câu đang ẩn nên không dùng ở đây.
  const availableQuery = useAsync(
    () => (open && topicChosen
      ? previewBlueprint({
        topic: topic === ALL_TOPICS ? '' : topic,
        totalQuestions: 1,
        easyPercentage: 34,
        mediumPercentage: 33,
        hardPercentage: 33,
      })
      : Promise.resolve(undefined)),
    [open, topic],
  )

  const total = LEVELS.reduce((sum, level) => sum + counts[level], 0)
  const available = availableQuery.data?.available
  const availableTotal = available ? LEVELS.reduce((sum, level) => sum + (available[level] ?? 0), 0) : undefined
  const canSubmit = total > 0 && topicChosen && !submitting

  // Mức nào yêu cầu nhiều hơn số câu dùng được: biết trước khi soạn, không đợi tới lúc báo thiếu.
  const shortLevels = available
    ? LEVELS
      .map(level => ({ level, lacking: counts[level] - (available[level] ?? 0) }))
      .filter(entry => entry.lacking > 0)
    : []

  const setCount = (level: DifficultyLevel, value: number) => {
    setCounts(current => ({
      ...current,
      [level]: Number.isFinite(value) ? Math.min(MAX_PER_LEVEL, Math.max(0, Math.floor(value))) : 0,
    }))
  }

  const toggleGroup = (groupId: number) => {
    setGroupIds(current => (current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId]))
  }

  const submit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const result = await composeQuestions({
        easy: counts.easy,
        medium: counts.medium,
        hard: counts.hard,
        topic: topic === ALL_TOPICS ? undefined : topic,
        excludeQuestionIds: existingIds,
        // Chỉ gửi lớp còn tồn tại trong danh sách hiện tại: lớp vừa bị gỡ khỏi quyền giáo viên sẽ bị server từ chối.
        excludeAssignedToGroupIds: groupIds.filter(id => groups.some(group => group.id === id)),
      })
      // Soạn xong một chương thì về ô trống: chương kế tiếp phải được chọn lại, không vô tình rút thêm từ chương cũ.
      setTopic('')
      onComposed(result)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Không soạn được. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedGroupCount = groupIds.filter(id => groups.some(group => group.id === id)).length

  return (
    <Modal
      open={open}
      title="Soạn tự động"
      description="Rút ngẫu nhiên câu hỏi từ ngân hàng để bạn duyệt. Chưa lưu gì cho tới khi bạn bấm Lưu."
      icon={<Wand2 size={19} />}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 w-full">
          <div className="min-w-0 flex-1 basis-56">
            <div className="flex items-center gap-3">
              {/* Ba mức chiếm bao nhiêu phần của số câu sẽ rút. */}
              <div className="flex h-2 w-28 flex-shrink-0 rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
                {LEVELS.map(level => (
                  <div
                    key={level}
                    className="h-full transition-all duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: total > 0 ? `${(counts[level] / total) * 100}%` : '0%', background: difficultyBarColors[level] }}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-500">
                Sẽ rút{' '}
                <strong key={total} className="inline-block text-base font-bold text-slate-800 animate-pop">{total}</strong>
                {' '}câu
              </p>
            </div>

            {shortLevels.length > 0 && (
              <p id="compose-short-warning" className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-amber-700 animate-fade-in">
                <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
                <span>
                  Ngân hàng chưa đủ: thiếu {shortLevels.map(entry => `${entry.lacking} câu ${difficultyLabels[entry.level]}`).join(', ')}.
                  Vẫn soạn được, hệ thống sẽ báo lại.
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              title={!topicChosen ? 'Chọn chương cần soạn trước' : undefined}
              className={`group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none ${
                canSubmit ? 'hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-px active:translate-y-0' : ''
              }`}
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              {canSubmit && !submitting && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/30 opacity-0 group-hover:opacity-100 group-hover:animate-sheen"
                />
              )}
              {submitting
                ? <Loader2 size={16} className="animate-spin" />
                : <Wand2 size={16} className={canSubmit ? 'transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110' : ''} />}
              <span>{submitting ? 'Đang rút câu…' : total > 0 ? `Soạn ${total} câu` : 'Soạn'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* ── 1. Chương ─────────────────────────────────────────────────────────────────────────── */}
        <section className="animate-fade-in-up" style={stagger(0)}>
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="compose-topic" className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[11px] font-bold flex items-center justify-center">1</span>
              Chương (chủ đề) <span className="text-red-500">*</span>
            </label>
            <InfoTip label="Giải thích về chương" title="Soạn theo chương">
              <p>Hệ thống chỉ rút câu của chương bạn chọn, để đề cho một chương không lọt câu của chương khác.</p>
              <p>Đề gồm nhiều chương thì soạn từng chương một: chọn chương này, soạn xong mở lại hộp và chọn chương sau. Câu mới được thêm vào cuối đề, không rút lại câu đã có.</p>
            </InfoTip>
          </div>
          <div className="relative">
            <BookOpen size={17} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${topicChosen ? 'text-indigo-500' : 'text-amber-500'}`} />
            <select
              id="compose-topic"
              value={topic}
              onChange={event => setTopic(event.target.value)}
              data-attention={topicChosen ? undefined : 'true'}
              className={`w-full appearance-none pl-10 pr-10 py-3 rounded-xl border bg-white text-sm font-medium outline-none focus:ring-4 transition-all motion-reduce:transition-none ${
                topicChosen
                  ? 'border-indigo-200 bg-indigo-50/40 text-slate-800 focus:border-indigo-400 focus:ring-indigo-50'
                  : 'border-amber-400 bg-amber-50/70 text-slate-600 ring-4 ring-amber-100 focus:border-amber-500 focus:ring-amber-100'
              }`}
            >
              <option value="">— Chọn chương cần soạn —</option>
              {(topicsQuery.data ?? []).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value={ALL_TOPICS}>Mọi chương (không giới hạn)</option>
            </select>
            <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {topicChosen && availableTotal !== undefined && (
            <p className="mt-2 text-xs text-slate-500">
              <strong key={availableTotal} className="inline-block text-slate-700 animate-pop">{availableTotal}</strong>
              {' '}câu dùng được trong lựa chọn này
            </p>
          )}
        </section>

        {/* ── 2. Số câu từng mức ────────────────────────────────────────────────────────────────── */}
        <section className="animate-fade-in-up" style={stagger(1)}>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[11px] font-bold flex items-center justify-center">2</span>
            Cần bao nhiêu câu mỗi mức
            <InfoTip label="Giải thích về số câu" title="Số câu mỗi mức">
              <p>Thanh dưới mỗi ô so số câu bạn cần với số câu dùng được của chương: đầy là đủ, hụt là ngân hàng không đủ câu mức đó.</p>
              <p>Thiếu vẫn soạn được: hệ thống rút những câu có và báo lại mức nào còn thiếu.</p>
              {existingIds.length > 0 && (
                <p>{existingIds.length} câu đang có trong đề sẽ không bị rút lại. Câu soạn tự động được thêm vào cuối danh sách.</p>
              )}
            </InfoTip>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LEVELS.map((level, index) => {
              const wanted = counts[level]
              const have = available?.[level]
              const lacking = have === undefined ? 0 : Math.max(0, wanted - have)
              const fill = wanted === 0 || have === undefined ? 0 : Math.min(100, Math.round((have / wanted) * 100))

              return (
                <div
                  key={level}
                  className={`rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 animate-fade-in-up ${
                    wanted > 0 ? levelTone[level].activeCard : 'border-slate-200 bg-white'
                  }`}
                  style={stagger(index + 2)}
                >
                  <label htmlFor={`compose-${level}`} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: difficultyBarColors[level] }} />
                    Câu {difficultyLabels[level]}
                  </label>

                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCount(level, wanted - 1)}
                      disabled={wanted <= 0}
                      aria-label={`Bớt một câu ${difficultyLabels[level]}`}
                      className={stepButtonClass}
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      id={`compose-${level}`}
                      type="number"
                      min={0}
                      max={MAX_PER_LEVEL}
                      value={wanted}
                      onChange={event => setCount(level, Number(event.target.value))}
                      className="min-w-0 flex-1 w-full h-9 text-center text-lg font-bold text-slate-800 rounded-xl border border-slate-200 bg-white outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCount(level, wanted + 1)}
                      disabled={wanted >= MAX_PER_LEVEL}
                      aria-label={`Thêm một câu ${difficultyLabels[level]}`}
                      className={stepButtonClass}
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {/* Thanh "đủ / thiếu": phần đã có so với số cần. Đầy là đủ; hụt là ngân hàng không đủ câu mức này. */}
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none ${levelTone[level].bar}`}
                      style={{ width: `${fill}%` }}
                    />
                  </div>

                  <p className="mt-1.5 min-h-4 text-xs leading-4">
                    {!topicChosen && <span className="text-slate-400">Chọn chương để xem</span>}
                    {topicChosen && have === undefined && <span className="text-slate-400 animate-pulse">Đang đếm…</span>}
                    {topicChosen && have !== undefined && lacking === 0 && (
                      <span className="text-slate-500">Có {have} câu dùng được</span>
                    )}
                    {topicChosen && have !== undefined && lacking > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 animate-fade-in">
                        <AlertTriangle size={12} /> Chỉ có {have}, thiếu {lacking}
                      </span>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 3. Lớp đã nhận ────────────────────────────────────────────────────────────────────── */}
        {groups.length > 0 && (
          <fieldset className="animate-fade-in-up" style={stagger(5)}>
            <div className="flex items-center justify-between gap-3">
              <legend className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[11px] font-bold flex items-center justify-center">3</span>
                Không lặp lại câu lớp đã nhận
                <span className="font-normal text-slate-400">· tuỳ chọn</span>
                <InfoTip label="Giải thích về lớp đã nhận" title="Câu lớp đã nhận">
                  <p>Tích các lớp sẽ làm đề này: hệ thống bỏ những câu đã nằm trong các đề từng giao cho lớp đó, để các em không gặp lại câu cũ.</p>
                  <p>Chỉ tính câu mà học sinh của lớp thực sự đã nhận. Số câu rút được có thể ít hơn số bạn ghi ở trên.</p>
                </InfoTip>
              </legend>
              {selectedGroupCount > 0 && (
                <button
                  type="button"
                  onClick={() => setGroupIds([])}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline animate-fade-in"
                >
                  Bỏ chọn {selectedGroupCount} lớp
                </button>
              )}
            </div>
            <div className="mt-2.5" />

            {/* Cao vừa đủ ba hàng chip, để hàng thứ tư không bị cắt dở ở mép dưới. */}
            <div className="flex flex-wrap gap-2 max-h-[7.5rem] overflow-y-auto pr-1">
              {groups.map(group => {
                const checked = groupIds.includes(group.id)
                return (
                  <label
                    key={group.id}
                    className={`relative inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full border text-sm font-medium cursor-pointer select-none transition-all duration-200 hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0 has-focus-visible:ring-4 has-focus-visible:ring-indigo-100 ${
                      checked
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(group.id)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span
                      aria-hidden="true"
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200 ${
                        checked ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {checked ? <Check key="on" size={12} strokeWidth={3} className="animate-pop" /> : <Users size={11} />}
                    </span>
                    <span>{group.name}</span>
                    <span className={`text-xs font-normal ${checked ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {group.studentCount} học sinh
                    </span>
                  </label>
                )
              })}
            </div>

            {selectedGroupCount > 0 && (
              <p className="mt-2 text-xs text-slate-500 animate-fade-in">
                Số câu rút được có thể ít hơn số ghi ở trên vì đã bỏ câu của {selectedGroupCount} lớp này.
              </p>
            )}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 animate-fade-in">{error}</p>
        )}
      </div>
    </Modal>
  )
}
