import { NavLink } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { formatScore } from '../../../lib/format'
import type { ExamPapersOverview } from '../../../services/examService'
import { difficultyLabels, type Exam } from '../../../types'
import { difficultyBarColors } from '../utils/blueprintRatio'
import { paperLabelOf } from '../utils/paperPlan'

const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const headCellClass = 'px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500'

interface ExamPapersCardProps {
  exam: Exam
  overview: ExamPapersOverview
}

/**
 * Cách một đề được chia thành các đề nhỏ: mỗi mức có bao nhiêu câu trong đề lớn và trong mỗi đề, bao nhiêu câu bị dùng ở
 * nhiều đề hay bị bỏ lại, và mỗi lớp đã giao có bao nhiêu em cầm đề nào; bấm số em của một đề là mở các câu của đề đó ở tab Nội dung.
 * Chỉ giáo viên và quản trị viên đọc được dữ liệu này nên chỉ trang giáo viên dùng thẻ này.
 */
export default function ExamPapersCard({ exam, overview }: ExamPapersCardProps) {

  const labels = Array.from({ length: exam.paperCount }, (_, index) => paperLabelOf(index))

  // Điểm mỗi câu theo mức của đề, và tổng điểm của một đề nhỏ: số câu × điểm mỗi câu, chính xác tới 0,01. Điểm cộng thêm (0,01
  // mỗi đơn vị) dồn vào mức cao nhất mà đề nhỏ có câu.
  const pointOf: Record<string, number> = { easy: exam.pointEasy, medium: exam.pointMedium, hard: exam.pointHard }
  const bonusLevel = exam.paperBonusUnits > 0
    ? (['hard', 'medium', 'easy'] as const).find(name => overview.levels.some(level => level.level === name && level.perPaper > 0))
    : undefined
  const scoreOf = (level: { level: string; perPaper: number }) =>
    (level.perPaper * Math.round(pointOf[level.level] * 100) + (level.level === bonusLevel ? exam.paperBonusUnits : 0)) / 100
  const paperScore = overview.levels.reduce((sum, level) => sum + scoreOf(level), 0)
  const sharedTotal = overview.levels.reduce((sum, level) => sum + level.sharedQuestions, 0)
  const unusedTotal = overview.levels.reduce((sum, level) => sum + level.unusedQuestions, 0)

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <span className="flex items-center gap-2 min-w-0">
          <Layers size={17} className="text-indigo-600 flex-shrink-0" />
          <h2 className="text-base font-bold text-slate-800">Chia đề</h2>
        </span>
        <p className="text-sm text-slate-500">
          {exam.paperCount} đề cho mỗi lớp · mỗi đề {exam.totalQuestions} câu · {formatScore(exam.totalScore)} điểm
        </p>
      </div>

      <div className="p-5 space-y-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60">
              <tr>
                <th scope="col" className={`${headCellClass} text-left`}>Mức độ</th>
                <th scope="col" className={`${headCellClass} text-right`}>Đề lớn có</th>
                <th scope="col" className={`${headCellClass} text-right`}>Mỗi đề</th>
                <th scope="col" className={`${headCellClass} text-right`}>Điểm mỗi câu</th>
                <th scope="col" className={`${headCellClass} text-right`}>Số câu trùng lặp</th>
                <th scope="col" className={`${headCellClass} text-right`}>Tổng điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {overview.levels.map(level => (
                <tr key={level.level}>
                  <th scope="row" className="px-4 py-2 text-left font-medium text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: difficultyBarColors[level.level] }} />
                      {difficultyLabels[level.level]}
                    </span>
                  </th>
                  <td className="px-4 py-2 text-right font-semibold text-slate-700">{level.poolSize}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-700">{level.perPaper}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-700">
                    {level.perPaper > 0 ? formatScore(pointOf[level.level]) : '—'}
                    {level.level === bonusLevel && (
                      <span className="block text-xs font-medium text-slate-500">+0.01 cho {exam.paperBonusUnits} câu</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {level.sharedQuestions > 0 ? `${level.sharedQuestions} câu` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-700">
                    {level.perPaper > 0 ? formatScore(scoreOf(level)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/70 font-semibold text-slate-800">
                <th scope="row" className="px-4 py-2 text-left">Cộng một đề</th>
                <td className="px-4 py-2 text-right">{overview.levels.reduce((sum, level) => sum + level.poolSize, 0)}</td>
                <td className="px-4 py-2 text-right">{overview.levels.reduce((sum, level) => sum + level.perPaper, 0)}</td>
                <td className="px-4 py-2 text-right text-slate-400">—</td>
                <td className="px-4 py-2 text-right">{sharedTotal > 0 ? `${sharedTotal} câu` : '—'}</td>
                <td className="px-4 py-2 text-right">{formatScore(paperScore)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {unusedTotal > 0 && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {unusedTotal} câu của đề lớn không vào đề nào. Mỗi lớp được chia riêng nên nhóm câu bị bỏ lại ở mỗi lớp khác nhau.
          </p>
        )}

        {overview.classes.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa giao cho lớp nào nên chưa có đề nhỏ nào được phát.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Số học sinh của từng lớp theo mã đề</caption>
              <thead className="bg-slate-50/60">
                <tr>
                  <th scope="col" className={`${headCellClass} text-left`}>Lớp</th>
                  <th scope="col" className={`${headCellClass} text-right`}>Học sinh</th>
                  {labels.map(label => (
                    <th key={label} scope="col" className={`${headCellClass} text-right`}>Đề {label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {overview.classes.map(group => (
                  <tr key={group.groupId ?? group.groupName}>
                    <th scope="row" className="px-4 py-2 text-left font-semibold text-slate-800">{group.groupName}</th>
                    <td className="px-4 py-2 text-right text-slate-600">{group.students}</td>
                    {labels.map((label, index) => {
                      const paper = group.papers.find(item => item.variantIndex === index)
                      return (
                        <td key={label} className="px-4 py-2 text-right text-slate-600">
                          {paper && group.groupId !== undefined ? (
                            <NavLink
                              to={`?tab=noi-dung&lop=${group.groupId}&de=${index}`}
                              title={`Xem các câu của đề ${label} của ${group.groupName}`}
                              className="font-semibold text-indigo-600 hover:underline"
                            >
                              {paper.students}
                            </NavLink>
                          ) : paper ? paper.students : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-400 leading-relaxed">
          Mỗi lớp được chia riêng. Học sinh nhận đề ngẫu nhiên, số em mỗi đề xấp xỉ nhau, và không thấy mã đề của mình.
          Bấm số em của một đề để xem các câu của đề đó.
        </p>
      </div>
    </div>
  )
}
