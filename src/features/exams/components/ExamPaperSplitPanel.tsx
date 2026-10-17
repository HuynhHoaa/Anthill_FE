import { AlertCircle, CheckCircle2, Info, Layers, ListChecks, Lock, Wand2 } from 'lucide-react'
import { difficultyLabels, type DifficultyLevel } from '../../../types'
import {
  balanceRatios, clampPercentage, difficultyBarColors, orderedDifficultyLevels, sumRatios,
} from '../utils/blueprintRatio'
import { describeScoreDelta, EXAM_TOTAL_SCORE } from '../utils/examScoring'
import { describeShortage, evaluatePaperPlan, MAX_PAPER_COUNT } from '../utils/paperPlan'
import {
  bonusLevelOf, clampPaperCount, clampQuestionsPerPaper, paperTotalScore, perPaperCounts, ratiosOfPool, seedPaperSpec,
  withAutoPoints, type PaperSpec,
} from '../utils/paperSpec'
import { countsOfItems, type QuestionListItem } from '../utils/questionListScoring'
import FieldError from './FieldError'

interface ExamPaperSplitPanelProps {
  spec: PaperSpec
  /** Danh sách câu đã duyệt — "đề lớn" để rút ra các đề nhỏ. */
  items: readonly QuestionListItem[]
  /** Đã có em làm bài: số đề, số câu và tỷ lệ không đổi được nữa (điểm cũng đứng yên theo). */
  locked: boolean
  error?: string
  onChange: (next: PaperSpec) => void
  onOpenContent: () => void
}

const inputClass = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'
const invalidInputClass = 'w-full px-3 py-2 rounded-xl border border-red-300 text-sm outline-none transition-all focus:border-red-400 focus:ring-4 focus:ring-red-50 disabled:bg-slate-50 disabled:text-slate-400'
const labelClass = 'block text-xs font-semibold text-slate-600 mb-1'

const ratioPresets: { label: string; ratios: Record<DifficultyLevel, number> }[] = [
  { label: 'Đều nhau', ratios: { easy: 33, medium: 33, hard: 34 } },
  { label: '30 / 50 / 20', ratios: { easy: 30, medium: 50, hard: 20 } },
  { label: '40 / 40 / 20', ratios: { easy: 40, medium: 40, hard: 20 } },
]

const formatNumber = (value: number) => String(Math.round(value * 100) / 100)

/** Tổng điểm của một mức trong một đề nhỏ: số câu × điểm mỗi câu (cộng điểm thêm nếu có), chính xác tới 0,01. */
const levelScore = (questions: number, pointEach: number, bonusUnits = 0) =>
  (questions * Math.round(pointEach * 100) + bonusUnits) / 100

/** Số đề khi giáo viên vừa chọn "Chia nhiều đề": ít nhất, chỉnh lên sau. */
const DEFAULT_SPLIT_COUNT = 2


/**
 * Cấu hình chia đề lớn (danh sách câu ở tab Nội dung) thành nhiều đề nhỏ cho mỗi lớp, kèm phần xem trước tính bằng đúng
 * công thức của server: mỗi mức có bao nhiêu câu, bao nhiêu câu phải dùng ở nhiều đề, bao nhiêu câu không vào đề nào.
 */
export default function ExamPaperSplitPanel({
  spec, items, locked, error, onChange, onOpenContent,
}: ExamPaperSplitPanelProps) {
  const isSplit = spec.count > 1
  const pool = countsOfItems(items)
  const perPaper = perPaperCounts(spec)
  const plan = evaluatePaperPlan(pool, perPaper, spec.count)
  const paperTotal = paperTotalScore(spec)
  const scoreDelta = describeScoreDelta(paperTotal)
  // Điểm cộng thêm dồn vào mức cao nhất của đề nhỏ; các mức khác đúng điểm mức.
  const bonusLevel = spec.bonusUnits > 0 ? bonusLevelOf(perPaper) : null
  const ratioTotal = sumRatios(spec.ratios)

  const sharedTotal = plan.levels.reduce((sum, level) => sum + level.shared, 0)
  const unusedTotal = plan.levels.reduce((sum, level) => sum + level.unused, 0)
  const shortages = plan.levels.filter(level => !level.sufficient)
  const hasPaperQuestions = perPaper.easy + perPaper.medium + perPaper.hard > 0

  const changeCount = (rawValue: string) => {
    const count = clampPaperCount(Number(rawValue))
    // Lần đầu bật chia đề thì lấy số câu và tỷ lệ từ đề lớn, để giáo viên có sẵn một cấu hình hợp lý rồi chỉnh.
    onChange(spec.count === 1 && count > 1 ? seedPaperSpec(items, count) : { ...spec, count })
  }

  const chooseSplit = (split: boolean) => {
    if (split === isSplit) return
    changeCount(split ? String(DEFAULT_SPLIT_COUNT) : '1')
  }

  // Số câu hay tỷ lệ đổi thì điểm theo mức được tính lại, để một đề vẫn đủ 10.
  const changeShape = (next: PaperSpec) => onChange(withAutoPoints(next))

  const changeRatio = (level: DifficultyLevel, rawValue: string) => {
    changeShape({
      ...spec,
      ratios: balanceRatios({ ...spec.ratios, [level]: clampPercentage(Number(rawValue)) }, level),
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" aria-label="Chia đề">
      {/* Mặc định không tích: cả lớp một đề. Tích vào mới mở khung cấu hình chia đề. */}
      <label className={`flex items-center gap-2.5 w-fit ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          id="paper-split-toggle"
          type="checkbox"
          checked={isSplit}
          disabled={locked}
          onChange={event => chooseSplit(event.target.checked)}
          className="w-4 h-4 accent-indigo-600"
        />
        <Layers size={16} className="text-indigo-600" />
        <span className="text-sm font-bold text-slate-800">Chia thành nhiều đề cho mỗi lớp</span>
      </label>

      <p className="mt-2 text-xs text-slate-500 leading-relaxed">
        {isSplit
          ? 'Danh sách câu hỏi ở tab Nội dung là đề lớn: mỗi lớp được chia thành nhiều đề nhỏ cùng độ khó, các em ngồi cạnh nhau cầm đề khác nhau.'
          : 'Không tích thì cả lớp làm chung một đề (mỗi em vẫn được trộn thứ tự câu và đáp án nếu bật). Tích để chia nhiều đề, chống chép bài.'}
      </p>

      {isSplit && (
        <div className="mt-3 space-y-4">
          {locked && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 leading-relaxed">
              <Lock size={14} className="flex-shrink-0 mt-0.5" />
              <span>Đã có học sinh làm bài nên không đổi được cách chia đề. Muốn chia khác, hãy nhân bản đề.</span>
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[9rem_9rem_minmax(0,1fr)] gap-x-6 gap-y-3">
            <div>
              <label htmlFor="paper-count" className={labelClass}>Số đề mỗi lớp</label>
              <select
                id="paper-count"
                value={spec.count}
                onChange={event => changeCount(event.target.value)}
                disabled={locked}
                className={inputClass}
              >
                {Array.from({ length: MAX_PAPER_COUNT - 1 }, (_, index) => index + 2).map(count => (
                  <option key={count} value={count}>{count} đề</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="paper-per-paper" className={labelClass}>Số câu mỗi đề</label>
              <input
                id="paper-per-paper"
                type="number"
                min={1}
                max={500}
                value={spec.questionsPerPaper}
                onChange={event => changeShape({ ...spec, questionsPerPaper: clampQuestionsPerPaper(Number(event.target.value)) })}
                disabled={locked}
                className={spec.questionsPerPaper < 1 ? invalidInputClass : inputClass}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-600">Tỷ lệ mỗi đề</span>
                {ratioPresets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={locked}
                    onClick={() => changeShape({ ...spec, ratios: { ...preset.ratios } })}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={locked || items.length === 0}
                  onClick={() => changeShape({ ...spec, ratios: ratiosOfPool(pool) })}
                  title="Dùng đúng tỷ lệ Dễ / Trung bình / Khó của đề lớn"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Theo đề lớn
                </button>
                {ratioTotal !== 100 && (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => changeShape({ ...spec, ratios: balanceRatios(spec.ratios, 'medium') })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40"
                  >
                    <Wand2 size={12} /> Tổng {ratioTotal}% — cân bằng về 100%
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {orderedDifficultyLevels.map(level => (
                  <div key={level}>
                    <label htmlFor={`paper-ratio-${level}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: difficultyBarColors[level] }} />
                      {difficultyLabels[level]} (%)
                    </label>
                    <input
                      id={`paper-ratio-${level}`}
                      type="number"
                      min={0}
                      max={100}
                      value={clampPercentage(spec.ratios[level])}
                      onChange={event => changeRatio(level, event.target.value)}
                      disabled={locked}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500 leading-relaxed">
              Điểm mỗi câu do hệ thống tự tính để mỗi đề đủ {EXAM_TOTAL_SCORE} điểm: câu khó nhiều điểm hơn câu dễ, các câu
              cùng mức cùng điểm, số câu từng mức giữ đúng tỷ lệ bạn đặt.
            </p>
            <span
              id="paper-total-chip"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                scoreDelta === null ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {scoreDelta === null ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              Một đề: {formatNumber(paperTotal)} / {EXAM_TOTAL_SCORE} điểm
            </span>
          </div>

          {bonusLevel && (
            <p id="paper-bonus-note" className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-relaxed">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                {perPaper.easy} / {perPaper.medium} / {perPaper.hard} câu không cộng ra đúng {EXAM_TOTAL_SCORE} điểm nếu mọi câu
                cùng mức cùng điểm. Mỗi đề được cộng thêm 0.01 điểm cho {spec.bonusUnits} câu {difficultyLabels[bonusLevel]}{' '}
                (hệ thống tự chọn câu) nên mọi đề vẫn đủ {EXAM_TOTAL_SCORE} điểm.
              </span>
            </p>
          )}

          {hasPaperQuestions && scoreDelta !== null && !locked && (
            <p id="paper-score-note" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed">
              Chưa chia được đúng {EXAM_TOTAL_SCORE} điểm cho cách chia này ({formatNumber(paperTotal)} điểm). Thử đổi số câu mỗi đề
              hoặc tỷ lệ.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <caption className="sr-only">Cách chia đề lớn thành các đề nhỏ theo mức độ</caption>
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <th scope="col" className="px-3 py-2 text-left">Mức độ</th>
                  <th scope="col" className="px-3 py-2 text-right">Đề lớn có</th>
                  <th scope="col" className="px-3 py-2 text-right">Mỗi đề cần</th>
                  <th scope="col" className="px-3 py-2 text-right">Điểm mỗi câu</th>
                  <th scope="col" className="px-3 py-2 text-right">Số câu trùng lặp</th>
                  <th scope="col" className="px-3 py-2 text-right">Tổng điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {plan.levels.map(level => (
                  <tr key={level.level}>
                    <th scope="row" className="px-3 py-2 text-left font-medium text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: difficultyBarColors[level.level] }} />
                        {difficultyLabels[level.level]}
                      </span>
                    </th>
                    <td className={`px-3 py-2 text-right font-semibold ${level.sufficient || items.length === 0 ? 'text-slate-700' : 'text-red-600'}`}>
                      {level.pool}
                      {!level.sufficient && items.length > 0 && (
                        <span className="text-xs font-medium"> (thiếu {level.need - level.pool})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700">{level.need}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700" data-level-point={level.level}>
                      {level.need > 0 ? formatNumber(spec.points[level.level]) : '—'}
                      {level.level === bonusLevel && (
                        <span className="block text-xs font-medium text-slate-500">+0.01 cho {spec.bonusUnits} câu</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{level.shared > 0 ? `${level.shared} câu` : '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700" data-level-score={level.level}>
                      {level.need > 0
                        ? formatNumber(levelScore(level.need, spec.points[level.level], level.level === bonusLevel ? spec.bonusUnits : 0))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/70 font-semibold text-slate-800">
                  <th scope="row" className="px-3 py-2 text-left">Cộng một đề</th>
                  <td className="px-3 py-2 text-right">{items.length}</td>
                  <td className="px-3 py-2 text-right">{plan.levels.reduce((sum, level) => sum + level.need, 0)}</td>
                  <td className="px-3 py-2 text-right text-slate-400">—</td>
                  <td className="px-3 py-2 text-right">{sharedTotal > 0 ? `${sharedTotal} câu` : '—'}</td>
                  <td className="px-3 py-2 text-right" id="paper-total-score">{formatNumber(paperTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {items.length === 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 leading-relaxed">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <span>Đề lớn chưa có câu nào. Thêm câu hỏi ở tab Nội dung rồi quay lại đây xem cách chia.</span>
            </p>
          )}

          {items.length > 0 && shortages.length > 0 && (
            <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 leading-relaxed space-y-1">
              {shortages.map(level => <p key={level.level}>{describeShortage(level)}</p>)}
              <p>
                Thêm câu vào đề lớn ở tab{' '}
                <button type="button" onClick={onOpenContent} className="inline-flex items-center gap-1 font-semibold underline">
                  <ListChecks size={12} /> Nội dung
                </button>
                , hoặc giảm số câu mỗi đề / tỷ lệ của mức đó.
              </p>
            </div>
          )}

          {items.length > 0 && shortages.length === 0 && (sharedTotal > 0 || unusedTotal > 0) && (
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 leading-relaxed">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                {sharedTotal > 0 && (
                  <p>
                    Đề lớn không đủ câu để các đề không trùng nhau: {sharedTotal} câu sẽ có mặt ở từ 2 đề trở lên.
                    Trong một đề không bao giờ có hai câu giống nhau, và mỗi câu được dùng đều nhau.
                  </p>
                )}
                {unusedTotal > 0 && (
                  <p>
                    {unusedTotal} câu của đề lớn không vào đề nào. Mỗi lớp được chia riêng nên nhóm câu bị bỏ lại ở mỗi
                    lớp khác nhau.
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            Học sinh nhận đề ngẫu nhiên, số em mỗi đề xấp xỉ nhau, không theo thứ tự danh sách. Học sinh không thấy mã đề.
            Mã đề (A, B, C…) chỉ hiện cho giáo viên ở trang theo dõi.
          </p>
        </div>
      )}

      {/* Lỗi thiếu câu đã có khối đỏ riêng ngay trong phần xem trước; chỉ hiện lỗi còn lại (tỷ lệ, điểm…). */}
      {!(items.length > 0 && shortages.length > 0) && <FieldError message={error} />}
    </section>
  )
}
