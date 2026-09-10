import { formatScore, getScoreTone } from '../../../lib/format'

interface ScoreRingProps {
  /** `null` là "chưa được phép xem điểm", không phải 0 điểm. */
  score: number | null
  maxScore?: number | null
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
  const circleClass = size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-16 h-16 text-xl'

  // Không mượn màu xếp loại cho một bài chưa được phép xem điểm: vòng đỏ kèm con số thấp đọc y
  // hệt một bài làm sai hết, trong khi điểm thật có thể là mười.
  if (score === null) {
    return (
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div
          className={`${circleClass} bg-slate-50 text-slate-400 border-slate-200 rounded-full border-2 flex items-center justify-center font-bold`}
        >
          {formatScore(score)}
        </div>
        <span className="text-[11px] font-semibold text-slate-400">Chưa hiện điểm</span>
      </div>
    )
  }

  const tone = getScoreTone(score)

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div
        className={`${circleClass} ${tone.bg} ${tone.color} ${getRingBorderClass(score)} rounded-full border-2 flex items-center justify-center font-bold`}
      >
        {formatScore(score)}
      </div>
      <span className={`text-[11px] font-semibold ${tone.color}`}>{tone.label}</span>
      {maxScore !== undefined && maxScore !== null && (
        <span className="text-[11px] text-slate-400">trên {formatScore(maxScore)}</span>
      )}
    </div>
  )
}
