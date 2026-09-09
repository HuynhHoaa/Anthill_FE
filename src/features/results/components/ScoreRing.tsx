import { formatScore, getScoreTone } from '../../../lib/format'

interface ScoreRingProps {
  score: number
  maxScore?: number
  size?: 'md' | 'lg'
}

/** Màu viền khớp đúng ngưỡng xếp loại của getScoreTone. */
function getRingBorderClass(score: number): string {
  if (score >= 8) return 'border-emerald-200'
  if (score >= 6.5) return 'border-amber-200'
  if (score >= 5) return 'border-orange-200'
  return 'border-red-200'
}

export default function ScoreRing({ score, maxScore, size = 'md' }: ScoreRingProps) {
  const tone = getScoreTone(score)
  const circleClass = size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-16 h-16 text-xl'

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div
        className={`${circleClass} ${tone.bg} ${tone.color} ${getRingBorderClass(score)} rounded-full border-2 flex items-center justify-center font-bold`}
      >
        {formatScore(score)}
      </div>
      <span className={`text-[11px] font-semibold ${tone.color}`}>{tone.label}</span>
      {maxScore !== undefined && (
        <span className="text-[11px] text-slate-400">trên {formatScore(maxScore)}</span>
      )}
    </div>
  )
}
