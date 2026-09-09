import { AlertCircle, CheckCircle2, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react'
import { difficultyLabels, type DifficultyLevel } from '../../../types'
import DifficultyRatioBar from './DifficultyRatioBar'
import FieldError from './FieldError'
import {
  balanceRatios, clampPercentage, difficultyBarColors, orderedDifficultyLevels, sumRatios,
  type DifficultyRatios,
} from '../utils/blueprintRatio'

const ratioPresets: { label: string; hint: string; ratios: DifficultyRatios }[] = [
  { label: '30 / 50 / 20', hint: 'Kiểm tra thường kỳ', ratios: { easy: 30, medium: 50, hard: 20 } },
  { label: '40 / 40 / 20', hint: 'Kiểm tra 15 phút', ratios: { easy: 40, medium: 40, hard: 20 } },
  { label: '25 / 50 / 25', hint: 'Đề thi cuối kỳ', ratios: { easy: 25, medium: 50, hard: 25 } },
]

interface DifficultyRatioEditorProps {
  ratios: DifficultyRatios
  /** Mức vừa được chỉnh gần nhất, dùng làm điểm neo khi cân bằng lại tổng. */
  anchorLevel: DifficultyLevel
  errorMessage?: string
  onChange: (nextRatios: DifficultyRatios, nextAnchorLevel: DifficultyLevel) => void
}

export default function DifficultyRatioEditor({
  ratios, anchorLevel, errorMessage, onChange,
}: DifficultyRatioEditorProps) {
  const ratioTotal = sumRatios(ratios)

  const changeLevel = (level: DifficultyLevel, rawValue: string) => {
    const nextRatios: DifficultyRatios = { ...ratios }
    nextRatios[level] = clampPercentage(Number(rawValue))
    onChange(nextRatios, level)
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Tỷ lệ độ khó</h2>
        </div>
        <span
          className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold ${
            ratioTotal === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {ratioTotal === 100 ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          Tổng {ratioTotal}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Sparkles size={13} /> Mẫu nhanh
        </span>
        {ratioPresets.map(preset => {
          const isActive =
            ratios.easy === preset.ratios.easy &&
            ratios.medium === preset.ratios.medium &&
            ratios.hard === preset.ratios.hard

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.ratios, 'easy')}
              title={preset.hint}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isActive
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChange(balanceRatios(ratios, anchorLevel), anchorLevel)}
          disabled={ratioTotal === 100}
          className="sm:ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Wand2 size={13} /> Cân bằng về 100%
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {orderedDifficultyLevels.map(level => (
          <div key={level}>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor={`ratio-${level}`}
                className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: difficultyBarColors[level] }}
                />
                {difficultyLabels[level]}
              </label>
              <span
                className="px-2 py-0.5 rounded-lg text-xs font-bold"
                style={{ background: `${difficultyBarColors[level]}1A`, color: difficultyBarColors[level] }}
              >
                {clampPercentage(ratios[level])}%
              </span>
            </div>
            <input
              id={`ratio-${level}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={clampPercentage(ratios[level])}
              onChange={event => changeLevel(level, event.target.value)}
              className="w-full"
              style={{ accentColor: difficultyBarColors[level] }}
            />
            <input
              type="number"
              min={0}
              max={100}
              aria-label={`Tỷ lệ câu ${difficultyLabels[level]} theo phần trăm`}
              value={clampPercentage(ratios[level])}
              onChange={event => changeLevel(level, event.target.value)}
              className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>
        ))}
      </div>

      <div className="mt-5">
        <DifficultyRatioBar ratios={ratios} />
      </div>

      <FieldError message={errorMessage} />

      {ratioTotal !== 100 && !errorMessage && (
        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Bấm “Cân bằng về 100%” để giữ nguyên mức {difficultyLabels[anchorLevel]} vừa chỉnh và chia lại
          phần còn lại cho hai mức kia.
        </p>
      )}
    </section>
  )
}
