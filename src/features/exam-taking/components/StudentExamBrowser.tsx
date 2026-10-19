import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Search, Clock, FileText, PlayCircle,
  CheckCircle2, XCircle, Calendar, ChevronRight, ChevronDown, BookOpen,
  AlertTriangle, Eye, ArrowUpDown, Hourglass,
} from 'lucide-react'
import { StatusBadge, TopicBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonCards } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { useRealtimeRefresh } from '../../../hooks/useRealtime'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { listMyExams } from '../../../services/attemptService'
import { formatDateTime, formatDuration, formatScore, getScoreTone, normalizeText, parseDateTime } from '../../../lib/format'
import { useCountdown } from '../hooks/useCountdown'
import type { StudentExamItem } from '../../../types'

// ===== Bộ lọc =====
type FilterTab = 'all' | 'open' | 'upcoming' | 'done' | 'expired'
type SortKey = 'default' | 'deadline' | 'name'

const tabs: { key: FilterTab; label: string; icon: typeof FileText }[] = [
  { key: 'all',      label: 'Tất cả',    icon: BookOpen },
  { key: 'open',     label: 'Đang mở',   icon: PlayCircle },
  { key: 'upcoming', label: 'Sắp tới',   icon: Calendar },
  { key: 'done',     label: 'Đã xong',   icon: CheckCircle2 },
  { key: 'expired',  label: 'Hết hạn',   icon: XCircle },
]

const emptyMessageByTab: Record<FilterTab, { title: string; description: string }> = {
  all: {
    title: 'Chưa có bài kiểm tra nào',
    description: 'Khi giáo viên giao bài, bài kiểm tra sẽ xuất hiện ngay tại đây kèm hạn nộp.',
  },
  open: {
    title: 'Hiện chưa có bài kiểm tra nào đang mở',
    description: 'Bạn đã làm hết các bài trong thời gian cho phép. Hãy xem mục "Sắp tới" để chuẩn bị trước.',
  },
  upcoming: {
    title: 'Chưa có bài kiểm tra nào sắp diễn ra',
    description: 'Những bài đã lên lịch nhưng chưa tới giờ mở sẽ được liệt kê ở mục này.',
  },
  done: {
    title: 'Bạn chưa hoàn thành bài kiểm tra nào',
    description: 'Sau khi nộp bài, bài kiểm tra sẽ chuyển vào mục này kèm điểm số và số câu đúng.',
  },
  expired: {
    title: 'Không có bài kiểm tra nào hết hạn',
    description: 'Rất tốt, bạn chưa bỏ lỡ bài kiểm tra nào được giao.',
  },
}

const urgentThresholdMs = 3 * 3600000
const urgentRefreshMs = 30000

function matchesTab(status: StudentExamItem['status'], tab: FilterTab): boolean {
  if (tab === 'all') return true
  if (tab === 'done') return status === 'submitted' || status === 'graded'
  // Bài đang làm dở gộp vào "Đang mở": đó là mục học sinh sẽ mở lên khi nhớ ra mình còn một bài
  // chưa nộp, và đồng hồ của nó cũng đang chạy thật — để nó lọt qua mọi tab trừ "Tất cả" (như trước
  // khi sửa H16) sẽ khiến một bài đã bắt đầu biến mất khỏi tầm mắt.
  if (tab === 'open') return status === 'open' || status === 'inprogress'
  return status === tab
}

// ===== Score Ring =====
function ScoreRing({ score, maxScore }: { score: number; maxScore?: number | null }) {
  // Xếp loại qua đúng một nguồn dùng chung toàn hệ thống (getScoreTone), quy về tỷ lệ theo điểm
  // tối đa của chính đề này — trước đây hàm này tự tính ngưỡng riêng (chỉ 3 mức, không có "Trung
  // bình") nên cùng một bài làm có thể xếp khác màu ở đây so với trang kết quả (H7).
  const tone = getScoreTone(score, maxScore)
  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <div
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${tone.bg} ${tone.color} ${tone.ring}`}
      >
        {formatScore(score)}
      </div>
      <span className={`text-[10px] font-semibold ${tone.color}`}>{tone.label}</span>
    </div>
  )
}

// ===== Exam Card =====
function ExamCard({ exam }: { exam: StudentExamItem }) {
  const isOpen = exam.status === 'open'
  const isInProgress = exam.status === 'inprogress'
  // Bài đang làm dở đếm ngược tới hạn của chính lượt làm đó (exam.deadline = expiresAt khi
  // inprogress — xem toStudentExamItem), không phải tới giờ đóng đề: đồng hồ nhịp mỗi giây nên các
  // mốc so với thời điểm hiện tại luôn được tính lại.
  const countdown = useCountdown(isOpen || isInProgress ? exam.deadline : null, 'Đã hết hạn')
  const isUpcoming = exam.status === 'upcoming'
  const isSubmitted = exam.status === 'submitted'
  const isGraded = exam.status === 'graded'
  const isDone = isSubmitted || isGraded
  const remainingMs = exam.deadline.getTime() - Date.now()
  const justClosed = (isOpen || isInProgress) && remainingMs <= 0
  const isExpired = exam.status === 'expired' || justClosed
  const isUrgent = (isOpen || isInProgress) && !justClosed && remainingMs < urgentThresholdMs
  const openDate = parseDateTime(exam.openAt)

  // H23: cửa sổ giao bài có thể đóng trước khi hết trọn thời lượng — chỉ tính lúc bài CHƯA bắt đầu
  // (isOpen), vì một khi đã vào làm thì đồng hồ đếm ngược phía dưới đã tự nói đúng thời gian còn
  // lại rồi. Đây thuần là hiển thị: không đổi cách chốt `ExpiresAt` ở server, chỉ ngừng giấu con số
  // thật khỏi học sinh trước khi họ bấm "Vào làm bài".
  const nominalDurationMs = exam.durationMinutes * 60000
  const isDurationClampedByCloseTime = isOpen && !justClosed && remainingMs < nominalDurationMs
  const effectiveDurationMinutes = isDurationClampedByCloseTime
    ? Math.max(0, Math.ceil(remainingMs / 60000))
    : exam.durationMinutes

  const metaChip = 'inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md'

  // Thẻ gọn: một lớp có thể có hàng chục bài, mỗi thẻ chỉ cần đủ tên bài, vài số liệu, hạn và nút.
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col
        ${isExpired ? 'border-slate-100 opacity-70' :
          isUrgent  ? 'border-red-200 hover:border-red-300' :
          isInProgress ? 'border-amber-200 hover:border-amber-300' :
          isOpen    ? 'border-indigo-100 hover:border-indigo-300' :
                      'border-slate-100 hover:border-slate-200'}`}
    >
      {/* Dải màu theo chủ đề */}
      <div className="h-1 w-full" style={{ background: exam.topicColor }} />

      <div className="px-4 py-3 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <TopicBadge topic={exam.topic} />
              {isUrgent && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                  <AlertTriangle size={10} /> Sắp hết hạn
                </span>
              )}
              {isInProgress && (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                  <PlayCircle size={10} /> Đang làm dở
                </span>
              )}
              {isSubmitted && (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                  <Hourglass size={10} /> Chờ chấm
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-800 text-sm leading-snug">{exam.name}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">GV: {exam.teacher}</p>
          </div>
          {/* score null là "đề chưa cho xem điểm", nên không có vòng điểm nào để vẽ. */}
          {isGraded && exam.score !== null && (
            <ScoreRing score={exam.score} maxScore={exam.maxScore} />
          )}
        </div>

        {/* Thông tin nhanh, gọn một dòng */}
        <div className="flex flex-wrap gap-1.5">
          <span
            title={isDurationClampedByCloseTime ? `Đề đóng lúc ${formatDateTime(exam.closeAt)}, ngắn hơn thời lượng gốc ${exam.durationMinutes} phút` : undefined}
            className={`${metaChip} ${isDurationClampedByCloseTime ? '!text-red-600 !bg-red-50 !border-red-100 font-semibold' : ''}`}
          >
            <Clock size={11} />
            {isDurationClampedByCloseTime
              ? `Còn ${formatDuration(effectiveDurationMinutes)} (đề sắp đóng)`
              : `${exam.durationMinutes} phút`}
          </span>
          <span className={metaChip}>
            <FileText size={11} /> {exam.totalQuestions} câu
          </span>
          {isGraded && exam.correctCount !== null && (
            <span className={`${metaChip} !text-emerald-600 !bg-emerald-50 !border-emerald-100`}>
              <CheckCircle2 size={11} /> {exam.correctCount}/{exam.totalQuestions} đúng
            </span>
          )}
        </div>

        {/* Hạn nộp và hành động */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-auto border-t border-slate-50">
          <div className="min-w-0">
            {(isOpen || isInProgress || isExpired) && (
              <p className="text-xs leading-tight">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mr-1.5">
                  {isExpired ? 'Hết hạn' : isInProgress ? 'Đang làm · còn' : 'Còn'}
                </span>
                <span
                  className={`font-bold ${
                    isExpired ? 'text-slate-400' :
                    isUrgent  ? 'text-red-600' :
                    isInProgress ? 'text-amber-600' :
                                'text-indigo-600'
                  }`}
                >
                  {/* exam.deadline đã là mốc đúng cho cả hai trường hợp (giờ đóng đề khi chưa vào,
                      giờ hết bài của lượt làm khi đang dở — xem toStudentExamItem). */}
                  {isExpired ? formatDateTime(exam.deadline.toISOString()) : countdown}
                </span>
              </p>
            )}
            {isUpcoming && (
              <p className="text-xs leading-tight">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mr-1.5">Mở vào</span>
                <span className="font-bold text-slate-600">
                  {openDate
                    ? openDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : formatDateTime(exam.openAt)}
                </span>
              </p>
            )}
            {isGraded && exam.score !== null && (
              <p className="text-xs leading-tight">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mr-1.5">Điểm</span>
                <span className="font-bold text-slate-700">
                  {formatScore(exam.score)}
                  {exam.maxScore !== null && `/${formatScore(exam.maxScore)}`}
                </span>
              </p>
            )}
            {isSubmitted && <p className="text-xs font-semibold text-slate-500">Chờ giáo viên chấm</p>}
          </div>

          {/*
            Quyền vào làm do server chốt qua `canStart` — nó biết cả những điều kiện giao diện không
            thấy (bài bị thu hồi, tài khoản bị khoá). `justClosed` chỉ để nút biến mất ngay khi đồng
            hồ đếm về 0 mà không phải chờ tải lại trang.
          */}
          {exam.canStart && !justClosed && (
            <NavLink
              to={`/hoc-sinh/bai-kiem-tra/${exam.assignmentId}`}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{
                background: isUrgent
                  ? '#EF4444'
                  : isInProgress
                    ? 'linear-gradient(135deg,#F59E0B,#EA580C)'
                    : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              }}
            >
              <PlayCircle size={13} /> {isInProgress ? 'Tiếp tục làm bài' : 'Vào làm bài'}
            </NavLink>
          )}
          {isUpcoming && (
            <NavLink
              to={`/hoc-sinh/bai-kiem-tra/${exam.assignmentId}`}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Eye size={13} /> Xem trước
            </NavLink>
          )}
          {isDone && (
            <NavLink
              to={exam.attemptId ? `/hoc-sinh/ket-qua/${exam.attemptId}` : '/hoc-sinh/bang-diem'}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <Eye size={13} /> Xem kết quả và đáp án
            </NavLink>
          )}
          {isExpired && <StatusBadge status="expired" />}
        </div>
      </div>
    </div>
  )
}

// ===== Danh sách bài của một lớp =====
/**
 * Các bài kiểm tra em được giao qua một lớp: lọc theo trạng thái, tìm theo tên, sắp xếp; bài đã nộp mở ra kết quả (và đáp án khi giáo
 * viên cho xem). Không có tiêu đề riêng: trang một lớp đặt nó dưới phần thông tin lớp.
 */
export default function StudentExamBrowser({ groupId }: { groupId: number }) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchInput, setSearchInput] = useState('')
  // Chỉ gọi service sau khi học sinh ngừng gõ, tránh bắn một request cho mỗi phím.
  const search = useDebouncedValue(searchInput, 300)
  const [sortKey, setSortKey] = useState<SortKey>('default')
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Nhắc bài sắp hết hạn phải tự cập nhật khi học sinh mở trang lâu.
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), urgentRefreshMs)
    return () => clearInterval(timer)
  }, [])

  const normalizedSearch = search.trim()

  // Nạp trọn danh sách một lần rồi lọc tại máy: server không nhận tham số tìm kiếm cho endpoint
  // này, và danh sách bài của một học sinh vốn ngắn. Gõ tìm kiếm không còn gọi lại API nên kết quả
  // hiện ra tức thì, và các tab bên dưới vẫn đếm trên đúng tập vừa lọc.
  const { data: allExamItems, loading, error, reload, refresh } = useAsync(() => listMyExams({ groupId }), [groupId])
  useRealtimeRefresh(['ExamAssigned', 'ExamUpdated', 'AutoSubmitted'], refresh)

  const examItems = useMemo(() => {
    if (!allExamItems) return allExamItems
    if (normalizedSearch === '') return allExamItems

    const needle = normalizeText(normalizedSearch)
    return allExamItems.filter(item =>
      normalizeText(item.name).includes(needle) || normalizeText(item.topic).includes(needle),
    )
  }, [allExamItems, normalizedSearch])

  const counts = useMemo<Record<FilterTab, number>>(() => {
    const source = examItems ?? []
    return {
      all: source.length,
      // Gộp 'inprogress' vào 'open' — khớp với matchesTab, để số đếm trên tab và số thẻ thật sự
      // hiện ra không bao giờ lệch nhau.
      open: source.filter(item => item.status === 'open' || item.status === 'inprogress').length,
      upcoming: source.filter(item => item.status === 'upcoming').length,
      done: source.filter(item => item.status === 'submitted' || item.status === 'graded').length,
      expired: source.filter(item => item.status === 'expired').length,
    }
  }, [examItems])

  const visibleExams = useMemo(() => {
    const filtered = (examItems ?? []).filter(item => matchesTab(item.status, activeTab))
    if (sortKey === 'deadline') {
      return [...filtered].sort((left, right) => left.deadline.getTime() - right.deadline.getTime())
    }
    if (sortKey === 'name') {
      return [...filtered].sort((left, right) => left.name.localeCompare(right.name, 'vi'))
    }
    return filtered
  }, [examItems, activeTab, sortKey])

  const urgentExams = useMemo(
    () =>
      (examItems ?? []).filter(item => {
        // Bài đang làm dở sắp hết giờ cũng đáng báo động không kém — chính nó là ca "1 phút 20
        // giây thay vì 30 phút" mà đợt kiểm tra ghi nhận được.
        if (item.status !== 'open' && item.status !== 'inprogress') return false
        const remainingMs = item.deadline.getTime() - currentTime
        return remainingMs > 0 && remainingMs < urgentThresholdMs
      }),
    [examItems, currentTime],
  )

  const isFirstLoad = loading && examItems === undefined
  const isRefreshing = loading && examItems !== undefined
  const hasSearch = normalizedSearch !== ''
  const activeTabLabel = tabs.find(tab => tab.key === activeTab)?.label ?? 'Tất cả'

  const clearSearchButton = (
    <button
      type="button"
      onClick={() => { setSearchInput(''); setActiveTab('all') }}
      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
    >
      Xoá tìm kiếm <ChevronRight size={15} />
    </button>
  )

  return (
    <>
      <h2 className="text-lg font-bold text-slate-800 mb-1 animate-fade-in-up">Bài kiểm tra của lớp</h2>
      <p className="text-slate-500 text-sm mb-3 animate-fade-in-up">
        {error
          ? 'Không tải được danh sách bài kiểm tra của lớp.'
          : examItems === undefined
            ? 'Đang tải danh sách bài kiểm tra...'
            : hasSearch
              ? <>Tìm thấy <strong>{counts.all}</strong> bài kiểm tra khớp với từ khoá</>
              : <>Tổng cộng <strong>{counts.all}</strong> bài kiểm tra, kể cả bài đã làm. Bài đã nộp có nút xem lại kết quả và đáp án (khi giáo viên cho xem).</>}
      </p>

      {/* Cảnh báo bài sắp hết hạn */}
      {urgentExams.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 animate-fade-in-up">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-red-700 mb-0.5">⚡ {urgentExams.length} bài sắp hết hạn!</p>
            <p className="text-sm text-red-600">
              {urgentExams.map(item => item.name).join(' · ')} — Hãy làm ngay!
            </p>
          </div>
        </div>
      )}

      {/* Ô tìm kiếm và sắp xếp */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 animate-fade-in-up">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm bài kiểm tra hoặc chủ đề..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
          />
        </div>
        <div className="relative">
          <ArrowUpDown size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            aria-label="Sắp xếp danh sách bài kiểm tra"
            value={sortKey}
            onChange={event => setSortKey(event.target.value as SortKey)}
            className="w-full sm:w-auto appearance-none pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 font-medium cursor-pointer outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
          >
            <option value="default">Ưu tiên bài đang mở</option>
            <option value="deadline">Hạn nộp gần nhất</option>
            <option value="name">Tên bài A → Z</option>
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Tab lọc theo trạng thái */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 animate-fade-in-up">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              <Icon size={14} />
              {label}
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {examItems === undefined ? '—' : counts[key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Bốn trạng thái màn hình */}
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : isFirstLoad ? (
        <SkeletonCards count={6} />
      ) : visibleExams.length > 0 ? (
        <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
          {visibleExams.map(exam => (
            <ExamCard key={exam.assignmentId} exam={exam} />
          ))}
        </div>
      ) : hasSearch && counts.all === 0 ? (
        <EmptyState
          icon={Search}
          title="Không tìm thấy bài kiểm tra nào"
          description={`Không có kết quả cho "${normalizedSearch}". Hãy thử từ khoá khác hoặc xoá bộ lọc đang áp dụng.`}
          action={clearSearchButton}
        />
      ) : hasSearch ? (
        <EmptyState
          icon={Search}
          title={`Không có kết quả trong mục "${activeTabLabel}"`}
          description={`Có ${counts.all} bài kiểm tra khớp với "${normalizedSearch}" nhưng không bài nào thuộc mục này. Hãy chuyển sang mục khác hoặc xoá từ khoá.`}
          action={clearSearchButton}
        />
      ) : (
        <EmptyState
          icon={BookOpen}
          title={emptyMessageByTab[activeTab].title}
          description={emptyMessageByTab[activeTab].description}
          action={
            activeTab === 'all' ? undefined : (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                Xem tất cả bài kiểm tra <ChevronRight size={15} />
              </button>
            )
          }
        />
      )}
    </>
  )
}
