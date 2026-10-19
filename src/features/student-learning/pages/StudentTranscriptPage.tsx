import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Award, BookOpen, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import ExportExcelButton from '../../../components/common/ExportExcelButton'
import InfoTip from '../../../components/common/InfoTip'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { useCountUp } from '../../../hooks/useCountUp'
import { useRealtimeRefresh } from '../../../hooks/useRealtime'
import { dateStamp } from '../../../lib/download'
import { formatDateTime, formatScore, getScoreTone, STANDARD_SCORE } from '../../../lib/format'
import { openOnRowClick } from '../../../lib/rowClick'
import { getMyTranscript, listMyTerms } from '../../../services/myLearningService'
import { exportMyResults } from '../../../services/resultService'
import type { TranscriptExam, TranscriptSubject } from '../../../types'
import TermSelect from '../components/TermSelect'
import { useTermSelection } from '../hooks/useTermSelection'

const statusLabels: Record<string, string> = {
  assigned: 'Chưa làm',
  inprogress: 'Đang làm dở',
  submitted: 'Đã nộp',
  graded: 'Đã nộp',
  expired: 'Hết hạn, chưa làm',
}

function examNote(exam: TranscriptExam): { text: string; tone: string } {
  if (exam.score !== null) return { text: 'Đã chấm', tone: 'text-emerald-600' }
  if (exam.status === 'expired') return { text: 'Không làm: tính 0 điểm', tone: 'text-red-500' }
  if (exam.status === 'submitted' || exam.status === 'graded') return { text: 'Chưa công bố điểm', tone: 'text-slate-400' }
  return { text: statusLabels[exam.status] ?? exam.status, tone: 'text-slate-400' }
}

/** Điểm đếm lên từ 0 tới giá trị thật; ngôi sao lấp lánh khi điểm từ 8 trở lên. */
function AnimatedScore({ value }: { value: number | null }) {
  const shown = useCountUp(value)
  return <>{shown === null ? '—' : formatScore(shown)}</>
}

function SubjectCard({ subject, initiallyOpen }: { subject: TranscriptSubject; initiallyOpen: boolean }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(initiallyOpen)
  const tone = subject.average === null ? null : getScoreTone(subject.average)
  const shining = subject.average !== null && subject.average >= 8
  const chips = [
    subject.pendingExams > 0 && `${subject.pendingExams} bài chờ làm`,
    subject.upcomingExams > 0 && `${subject.upcomingExams} bài sắp tới`,
    subject.hiddenExams > 0 && `${subject.hiddenExams} bài chưa công bố điểm`,
    subject.missedExams > 0 && `${subject.missedExams} bài bỏ lỡ (0 điểm)`,
  ].filter((text): text is string => Boolean(text))

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors"
      >
        <span
          className={`relative w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center flex-shrink-0 animate-pop-in ${tone ? `${tone.bg} ${tone.color} ${tone.ring}` : 'bg-slate-50 text-slate-300 border-slate-200'}`}
        >
          <span className="text-xl font-bold leading-none tabular-nums"><AnimatedScore value={subject.average} /></span>
          <span className="text-[10px] font-semibold mt-1">{tone ? tone.label : 'Chưa có'}</span>
          {shining && (
            <>
              <span aria-hidden="true" className="absolute -top-2 -right-2 text-base animate-twinkle">✨</span>
              <span aria-hidden="true" className="absolute -bottom-1 -left-2 text-xs animate-twinkle" style={{ animationDelay: '0.9s' }}>⭐</span>
            </>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-slate-800">{subject.subjectName}</span>
          <span className="block text-xs text-slate-500 mt-0.5 truncate">
            {subject.groupNames.length > 0 ? subject.groupNames.join(' · ') : 'Bài giao riêng'}
          </span>
          <span className="block text-xs text-slate-500 mt-1.5">
            {subject.average === null
              ? 'Chưa có bài nào được tính điểm'
              : <>Điểm trung bình trên <strong className="text-slate-700">{subject.countedExams}</strong>/{subject.totalExams} bài</>}
          </span>
        </span>
        <ChevronDown size={18} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {chips.length > 0 && (
        <div className="px-5 pb-3 -mt-1 flex flex-wrap gap-2">
          {chips.map(text => (
            <span key={text} className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">{text}</span>
          ))}
        </div>
      )}

      {open && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="px-5 py-2.5">Bài kiểm tra</th>
                <th className="px-3 py-2.5 hidden sm:table-cell">Lớp</th>
                <th className="px-3 py-2.5 hidden md:table-cell">Nộp lúc</th>
                <th className="px-3 py-2.5">Ghi chú</th>
                <th className="px-5 py-2.5 text-right">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {subject.exams.map((exam, examIndex) => {
                const note = examNote(exam)
                const target = exam.attemptId ? `/hoc-sinh/ket-qua/${exam.attemptId}` : null
                const scoreTone = exam.score === null ? null : getScoreTone(exam.score)

                return (
                  <tr
                    key={exam.assignmentId}
                    onClick={target ? openOnRowClick(() => navigate(target)) : undefined}
                    className={`border-b border-slate-50 last:border-0 transition-colors animate-tab-in ${target ? 'cursor-pointer hover:bg-indigo-50/60' : ''}`}
                    style={{ animationDelay: `${Math.min(examIndex, 10) * 35}ms` }}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {target ? (
                        <NavLink to={target} className="hover:text-indigo-600">{exam.title}</NavLink>
                      ) : (
                        exam.title
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{exam.groupName ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-500 hidden md:table-cell whitespace-nowrap">
                      {exam.submittedAt ? formatDateTime(exam.submittedAt) : '—'}
                    </td>
                    <td className={`px-3 py-3 text-xs font-medium ${note.tone}`}>{note.text}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {exam.score !== null && scoreTone ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${scoreTone.bg} ${scoreTone.color}`}>
                          {formatScore(exam.score)}
                        </span>
                      ) : exam.counted ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-red-50 text-red-500">0</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** "Bảng điểm": các môn em đang học, điểm trung bình từng môn và các bài làm nên con số đó. */
export default function StudentTranscriptPage() {
  const termsQuery = useAsync(() => listMyTerms(), [])
  const { selection, select, visible: termFilterVisible } = useTermSelection(termsQuery.error ? [] : termsQuery.data)
  const termId = typeof selection === 'number' ? selection : undefined
  const selectedTermName = termId === undefined ? undefined : termsQuery.data?.find(term => term.id === termId)?.name

  // Chờ biết kỳ đang chọn rồi mới tải, để không tải bảng điểm "tất cả" rồi tải lại theo kỳ.
  const { data: transcript, loading, error, reload, refresh } = useAsync(
    () => (selection === undefined ? Promise.resolve(undefined) : getMyTranscript(termId)),
    [selection],
  )
  const overall = useCountUp(transcript?.overallAverage ?? null, 900)
  useRealtimeRefresh(['ExamAssigned', 'ExamUpdated', 'AutoSubmitted'], refresh)

  const subjects = transcript?.subjects ?? []
  const overallTone = transcript?.overallAverage != null ? getScoreTone(transcript.overallAverage) : null

  return (
    <StudentLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 animate-fade-in-up">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 inline-flex items-center gap-2">
            Bảng điểm
            <InfoTip title="Điểm trung bình môn được tính thế nào?" label="Giải thích cách tính điểm trung bình môn">
              <ul className="space-y-1.5 list-disc pl-4">
                <li>Tính trên thang {STANDARD_SCORE}, theo các bài em đã nộp và được xem điểm.</li>
                <li>Bài đã hết hạn mà em không làm tính 0 điểm.</li>
                <li>Bài còn làm được, bài sắp tới và bài giáo viên chưa công bố điểm chưa được tính.</li>
                <li>Môn của một bài là môn của giáo viên ra đề.</li>
              </ul>
            </InfoTip>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {error
              ? 'Không tải được bảng điểm.'
              : transcript === undefined
                ? 'Đang tải bảng điểm...'
                : subjects.length === 0
                  ? selectedTermName ? `Chưa có bài kiểm tra nào trong ${selectedTermName}.` : 'Chưa có bài kiểm tra nào được giao cho bạn.'
                  : <>{selectedTermName ? <><strong>{selectedTermName}</strong>: </> : null}Tình hình học tập của bạn theo từng môn · <strong>{subjects.length}</strong> môn</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {termFilterVisible && selection !== undefined && termsQuery.data && (
            <TermSelect terms={termsQuery.data} value={selection} onChange={select} />
          )}
          {subjects.length > 0 && (
            <ExportExcelButton
              label="Xuất bảng điểm"
              fileName={`bang-diem-${dateStamp()}.xlsx`}
              request={() => exportMyResults(termId)}
              successMessage={selectedTermName ? `Đã xuất bảng điểm ${selectedTermName}.` : 'Đã xuất bảng điểm của bạn.'}
            />
          )}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (loading && transcript === undefined) || selection === undefined ? (
        <div className="space-y-4">
          <SkeletonBlock className="h-24 rounded-2xl" />
          <SkeletonBlock className="h-24 rounded-2xl" />
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có điểm nào"
          description="Khi giáo viên giao bài kiểm tra và bạn làm xong, các môn học cùng điểm trung bình sẽ hiện ở đây."
        />
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-slate-100 bg-white shadow-sm px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center animate-pop-in ${overallTone ? `${overallTone.bg} ${overallTone.color}` : 'bg-slate-50 text-slate-300'}`}>
                <Award size={22} className={overallTone ? 'animate-float' : undefined} />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500">Điểm trung bình các môn</p>
                <p className={`text-2xl font-bold leading-tight tabular-nums ${overallTone ? overallTone.color : 'text-slate-300'}`}>
                  {overall !== null ? `${formatScore(overall)}/${STANDARD_SCORE}` : '—'}
                  {overallTone && <span className="text-sm font-semibold ml-2">{overallTone.label}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BookOpen size={22} />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500">Số môn đang học</p>
                <p className="text-2xl font-bold leading-tight text-slate-700 tabular-nums">{subjects.length}</p>
              </div>
            </div>
            <NavLink to="/hoc-sinh/lop-hoc" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Xem các lớp học <ChevronRight size={15} />
            </NavLink>
          </div>

          <div className="space-y-4 stagger-in">
            {subjects.map((subject, index) => (
              <SubjectCard key={subject.subjectName} subject={subject} initiallyOpen={index === 0 || subjects.length === 1} />
            ))}
          </div>
        </>
      )}
    </StudentLayout>
  )
}
