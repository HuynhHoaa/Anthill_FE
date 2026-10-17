import { useMemo, useState, type ReactNode } from 'react'
import { CalendarClock, Layers, Lock, Shuffle, UserX } from 'lucide-react'
import { LifecycleBadge } from '../../../components/common/Badge'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import Pagination from '../../../components/common/Pagination'
import { useToast } from '../../../components/common/Toast'
import { revokeClassAssignment, type BlueprintPreview, type ExamPapersOverview } from '../../../services/examService'
import { formatDateTime, formatScore } from '../../../lib/format'
import { getTopicLabel } from '../../../lib/topicTheme'
import { difficultyLabels } from '../../../types'
import type { AssignmentWindow, DifficultyLevel, Exam, ExamAssignment } from '../../../types'
import { examRevokeClassConfirmCopy } from '../utils/examConfirmations'
import { describeScheduleLock } from '../utils/examScheduleFormat'
import { EXAM_TOTAL_SCORE } from '../utils/examScoring'
import { windowLabel } from '../utils/assignmentWindowLabel'
import ExamActions from './ExamActions'
import ExamPapersCard from './ExamPapersCard'

const WINDOWS_PER_PAGE = 5

const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'

const difficultyRows: Array<{ level: DifficultyLevel; barColor: string; textColor: string; bgColor: string }> = [
  { level: 'easy', barColor: '#10B981', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  { level: 'medium', barColor: '#F59E0B', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
  { level: 'hard', barColor: '#EF4444', textColor: 'text-red-600', bgColor: 'bg-red-50' },
]

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-700 text-right">{value}</span>
    </div>
  )
}

interface ExamConfigPanelProps {
  exam: Exam
  assignments: ExamAssignment[]
  /** Chỉ có với đề theo ma trận: đối chiếu số câu cần với ngân hàng. */
  blueprint: BlueprintPreview | undefined
  /** Cách đề được chia thành các đề nhỏ; chỉ có với đề chia nhiều đề. */
  papers: ExamPapersOverview | undefined
  onReload: () => void
  onOpenAssign: () => void
}

/**
 * Tab "Cấu hình" của trang chi tiết đề: chỉ những gì không có ở chỗ khác. Thời lượng, số câu, tổng điểm đã ở dòng thông tin
 * dưới tên đề; danh sách và số câu theo mức độ ở tab Nội dung — nên ở đây là lịch mở bài, các tuỳ chọn làm bài (và ma
 * trận với đề theo ma trận), rồi bảng khung giờ theo lớp bên dưới.
 */
export default function ExamConfigPanel({
  exam, assignments, blueprint, papers, onReload, onOpenAssign,
}: ExamConfigPanelProps) {
  const toast = useToast()
  const confirm = useConfirm()

  const isDraft = exam.lifecycle === 'draft'
  const [windowPage, setWindowPage] = useState(1)

  const windows = exam.assignmentWindows
  const lastWindowPage = Math.max(1, Math.ceil(windows.length / WINDOWS_PER_PAGE))
  const currentWindowPage = Math.min(windowPage, lastWindowPage)
  const pagedWindows = windows.slice((currentWindowPage - 1) * WINDOWS_PER_PAGE, currentWindowPage * WINDOWS_PER_PAGE)

  /** Số em còn gỡ được của từng lớp (chưa bắt đầu làm) và số em đã bắt đầu. */
  const classCounts = useMemo(() => {
    const revocable = new Map<number, number>()
    const started = new Map<number, number>()

    assignments.forEach(assignment => {
      if (assignment.assignedViaGroupId === undefined) return

      const target = assignment.attemptId === undefined ? revocable : started
      target.set(assignment.assignedViaGroupId, (target.get(assignment.assignedViaGroupId) ?? 0) + 1)
    })

    return { revocable, started }
  }, [assignments])

  // Giao nhầm lớp là chuyện thường, và trước đây thứ duy nhất giáo viên làm được là xoá cả đề — nặng hơn
  // nhiều so với việc chỉ cần gỡ một lớp. Bài giao theo lớp nên thu hồi cũng theo lớp: em đã bắt đầu làm thì
  // server giữ lại, hộp xác nhận nói rõ bao nhiêu em được gỡ và bao nhiêu em ở lại.
  const requestRevokeClass = async (target: AssignmentWindow) => {
    const groupId = target.groupId
    if (groupId === undefined) return

    const revocableCount = classCounts.revocable.get(groupId) ?? 0
    const startedCount = classCounts.started.get(groupId) ?? 0
    const className = target.groupName ?? 'lớp này'

    const outcome: { revoked?: number; kept?: number } = {}
    const revoked = await confirm({
      ...examRevokeClassConfirmCopy({ name: className, revocableCount, startedCount }, exam.title),
      onConfirm: async () => {
        const result = await revokeClassAssignment(exam.id, groupId)
        outcome.revoked = result.revokedCount
        outcome.kept = result.keptStartedCount
      },
    })
    if (!revoked) return

    const kept = (outcome.kept ?? 0) > 0 ? ` ${outcome.kept} em đã bắt đầu làm nên vẫn giữ bài.` : ''
    toast.success(`Đã thu hồi bài của ${outcome.revoked ?? 0} em thuộc ${className}.${kept}`)
    onReload()
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className={blueprint ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 items-start' : undefined}>
        {/* Đề theo ma trận không có danh sách câu cố định để xem ở tab Nội dung, nên ma trận hiện ở đây. */}
        {blueprint && (
          <div className={`${cardClass} p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={17} className="text-indigo-600" />
              <h2 className="text-base font-bold text-slate-800">Ma trận đề</h2>
            </div>

            <div className="space-y-2">
              {difficultyRows.map(({ level, barColor, textColor, bgColor }) => {
                const required = blueprint.required[level]
                const available = blueprint.available[level]
                const usageRatio = available > 0 ? Math.min(100, Math.round((required / available) * 100)) : 0
                const percentage =
                  level === 'easy'
                    ? exam.easyPercentage
                    : level === 'medium'
                      ? exam.mediumPercentage
                      : exam.hardPercentage

                return (
                  <div key={level} className={`rounded-xl px-3.5 py-2.5 ${bgColor}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-sm font-semibold ${textColor}`}>{difficultyLabels[level]}</span>
                      <span className={`text-sm font-bold ${textColor}`}>
                        {required} câu · {percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${usageRatio}%`, background: barColor }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Ngân hàng có {available} câu đang dùng được</p>
                  </div>
                )
              })}
            </div>

            {!blueprint.isValid && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-bold text-amber-700 mb-1">Ma trận đề chưa hợp lệ</p>
                <ul className="space-y-1">
                  {blueprint.errors.map(message => (
                    <li key={message} className="text-xs text-amber-700 leading-relaxed">
                      · {message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className={`${cardClass} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="flex items-center gap-2 min-w-0">
              <Shuffle size={17} className="text-indigo-600 flex-shrink-0" />
              <h2 className="text-base font-bold text-slate-800">Cấu hình đề</h2>
            </span>
            {/* Cùng bộ nút với tab Nội dung. */}
            <ExamActions exam={exam} assignments={assignments} onReload={onReload} />
          </div>

          {exam.description && (
            <p className="text-sm text-slate-500 leading-relaxed mb-2">{exam.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
            <InfoRow label="Trạng thái" value={<LifecycleBadge lifecycle={exam.lifecycle} />} />
            <InfoRow label="Mở bài" value={formatDateTime(exam.openAt)} />
            <InfoRow label="Đóng bài" value={formatDateTime(exam.closeAt)} />
            <InfoRow label="Trộn câu hỏi" value={exam.shuffleQuestions ? 'Có' : 'Không'} />
            <InfoRow label="Trộn đáp án" value={exam.shuffleAnswers ? 'Có' : 'Không'} />
            <InfoRow label="Hiện kết quả sau khi nộp" value={exam.showResultAfterSubmit ? 'Có' : 'Không'} />
            {/* Đề theo ma trận mới có chủ đề chung và điểm theo mức; đề theo danh sách có điểm ở từng câu. */}
            {!exam.usesQuestionList && <InfoRow label="Chủ đề" value={getTopicLabel(exam.topic)} />}
            {exam.paperCount > 1 && (
              <>
                <InfoRow label="Tỷ lệ mỗi đề (Dễ / Trung bình / Khó)" value={`${exam.easyPercentage}% / ${exam.mediumPercentage}% / ${exam.hardPercentage}%`} />
                <InfoRow label="Điểm mỗi câu Dễ" value={formatScore(exam.pointEasy)} />
                <InfoRow label="Điểm mỗi câu Trung bình" value={formatScore(exam.pointMedium)} />
                <InfoRow label="Điểm mỗi câu Khó" value={formatScore(exam.pointHard)} />
                {exam.paperBonusUnits > 0 && (
                  <InfoRow
                    label="Điểm cộng thêm mỗi đề"
                    value={`+0.01 cho ${exam.paperBonusUnits} câu mức cao nhất`}
                  />
                )}
              </>
            )}
            {blueprint && (
              <>
                {/* Mức không có câu nào thì điểm của nó vô nghĩa: hiện gạch thay vì một số 0. */}
                <InfoRow
                  label="Điểm mỗi câu Dễ"
                  value={blueprint.required.easy > 0 ? formatScore(exam.pointEasy) : '—'}
                />
                <InfoRow
                  label="Điểm mỗi câu Trung bình"
                  value={blueprint.required.medium > 0 ? formatScore(exam.pointMedium) : '—'}
                />
                <InfoRow
                  label="Điểm mỗi câu Khó"
                  value={blueprint.required.hard > 0 ? formatScore(exam.pointHard) : '—'}
                />
              </>
            )}
          </div>

          {exam.totalScore !== EXAM_TOTAL_SCORE && (
            <p className="text-xs text-amber-600 leading-relaxed pt-2">
              {isDraft
                ? `Tổng điểm của bản nháp là ${formatScore(exam.totalScore)}, khác ${EXAM_TOTAL_SCORE}. Khi chốt bài, hệ thống sẽ hỏi xác nhận.`
                : `Tổng điểm của đề này là ${formatScore(exam.totalScore)}, khác ${EXAM_TOTAL_SCORE}. Kết quả trong thống kê vẫn được quy về thang ${EXAM_TOTAL_SCORE}.`}
            </p>
          )}
          {exam.blueprintFrozen && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
              <Lock size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                Đã khoá vì {exam.startedCount} học sinh đã bắt đầu làm bài. Muốn đổi cấu hình, hãy nhân bản đề.
              </span>
            </p>
          )}
          {exam.scheduleLocked && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
              <Lock size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                {describeScheduleLock('Lịch chung của đề', exam.openAt)} Hết giờ đóng bài mới đổi lại được. Cần
                dời gấp thì nhân bản đề rồi giao lại.
              </span>
            </p>
          )}
        </div>
      </div>

      {exam.paperCount > 1 && papers && <ExamPapersCard exam={exam} overview={papers} />}

      {/* Lịch phía trên chỉ là mặc định. Lớp học tiết 2 sáng thứ Ba và lớp học tiết 4 chiều thứ Năm làm cùng một đề,
          nên "lớp nào đang làm bài lúc này" phải đọc được ở đây. */}
      {windows.length > 0 && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">
              Khung giờ theo lớp <span className="text-sm font-medium text-slate-400">({windows.length} lớp)</span>
            </h2>
            {/* Mọi khung đang khoá thì mời "đổi khung giờ" là mời người ta bấm vào chỗ không làm được. */}
            {!windows.every(window => window.scheduleLocked) && (
              <button
                type="button"
                onClick={onOpenAssign}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
              >
                <CalendarClock size={13} /> Đổi khung giờ của một lớp
              </button>
            )}
          </div>

          <table className="stack-table w-full text-sm">
            <thead className="bg-slate-50/60">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Lớp</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Khung giờ làm bài</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Học sinh</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Thu hồi</th>
              </tr>
            </thead>
            <tbody>
              {pagedWindows.map(window => {
                const revocable = window.groupId === undefined ? 0 : (classCounts.revocable.get(window.groupId) ?? 0)
                return (
                  <tr
                    key={`${window.groupId ?? 'le'}-${window.openAt}-${window.closeAt}`}
                    className="border-b border-slate-50 last:border-b-0"
                  >
                    <td data-card="head" className="px-5 py-2.5 font-semibold text-slate-800">{windowLabel(window)}</td>
                    <td data-label="Khung giờ" className="px-5 py-2.5 text-slate-600 whitespace-nowrap">
                      {formatDateTime(window.openAt)} – {formatDateTime(window.closeAt)}
                      <span className="text-xs text-slate-400">
                        {window.hasScheduleOverride ? ' · khung riêng' : ' · theo lịch chung'}
                      </span>
                    </td>
                    <td data-label="Học sinh" className="px-5 py-2.5 text-slate-600 whitespace-nowrap">
                      {window.assignedCount}
                      {window.startedCount > 0 && (
                        <span className="text-xs text-slate-400"> · {window.startedCount} đã bắt đầu</span>
                      )}
                    </td>
                    <td data-label="Trạng thái" className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <LifecycleBadge lifecycle={window.lifecycle} />
                        {window.scheduleLocked && (
                          <span title="Đã khoá giờ" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
                            <Lock size={11} /> Khoá giờ
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-card="foot" className="px-5 py-2.5 text-right">
                      {revocable > 0 ? (
                        <button
                          type="button"
                          onClick={() => void requestRevokeClass(window)}
                          title="Gỡ bài khỏi mọi em của lớp này chưa bắt đầu làm"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap"
                        >
                          <UserX size={13} /> Thu hồi ({revocable} em)
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {windows.length > WINDOWS_PER_PAGE && (
            <div className="px-5 pb-4">
              <Pagination
                page={currentWindowPage}
                pageSize={WINDOWS_PER_PAGE}
                total={windows.length}
                onPageChange={setWindowPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
