import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { ClipboardList, Eye, FilterX, Search, X } from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import Pagination from '../../../components/common/Pagination'
import SearchField from '../../../components/common/SearchField'
import { StatusBadge } from '../../../components/common/Badge'
import { SkeletonTable } from '../../../components/common/Skeleton'
import TableScroller from '../../../components/common/TableScroller'
import StudentStatusPill from '../../students/components/StudentStatusPill'
import { useAsync } from '../../../hooks/useAsync'
import { useRealtimeRefresh } from '../../../hooks/useRealtime'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useStableTableHeight } from '../../../hooks/useStableTableHeight'
import { getResultStats, listResults } from '../../../services/resultService'
import { listAllExams } from '../../../services/examService'
import { listGroups } from '../../../services/groupService'
import { getStudent } from '../../../services/studentService'
import { formatDateTime, formatDuration, formatScore, getScoreTone, NO_VALUE } from '../../../lib/format'
import { examStatusLabels, type ExamStatus, type Student } from '../../../types'

const PAGE_SIZE = 10

/**
 * Ba trạng thái một lượt làm bài thật sự có. `assigned` và `expired` là trạng thái dẫn xuất của lượt
 * giao, không có dòng nào ở bảng này nên không đưa vào bộ lọc.
 */
const statusOptions: ExamStatus[] = ['inprogress', 'submitted', 'graded']

/**
 * URL là nguồn sự thật duy nhất của mọi bộ lọc ở trang này: không có state song song
 * thì không thể lệch pha, và các trang khác deep-link thẳng vào đây được.
 */
const SEARCH_PARAM = 'q'
const EXAM_PARAM = 'bai-kiem-tra'
const STUDENT_PARAM = 'hoc-sinh'
const GROUP_PARAM = 'nhom'
const STATUS_PARAM = 'trang-thai'
const PAGE_PARAM = 'trang'

const selectClass =
  'px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all'

const chipClass =
  'inline-flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50'

const cellLinkClass =
  'font-semibold text-slate-800 text-left hover:text-indigo-600 hover:underline transition-colors'

interface SelectOption {
  value: string
  label: string
}

/** Chuỗi rỗng và 'all' đều mang nghĩa không lọc, quy hết về null để chỉ còn một cách biểu diễn. */
function readFilterParam(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key)
  if (raw === null) return null
  const trimmed = raw.trim()
  return trimmed === '' || trimmed === 'all' ? null : trimmed
}

/**
 * Id trên URL phải là số nguyên không âm vừa một `int`. 'abc', '-3' hay '99999999999' gõ tay mà đưa
 * nguyên xi cho server thì nhận 400 và cả trang thành khung lỗi; coi như không lọc, giống cách
 * trạng thái lạ rơi về 'all' và số trang lạ rơi về 1.
 */
function readIdParam(params: URLSearchParams, key: string): string | null {
  const value = readFilterParam(params, key)
  return value !== null && /^\d{1,9}$/.test(value) ? value : null
}

/** Trang sau cùng còn có ý nghĩa; server kẹp số trang quá lớn, nhưng một `int` tràn thì nó trả 400. */
const MAX_PAGE = 100_000

/** URL gõ tay có thể chứa 'abc', '0' hoặc số âm — mọi giá trị lạ đều rơi về trang đầu. */
function toSafePage(raw: string | null): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 1
  const pageNumber = Math.floor(parsed)
  return pageNumber > 0 ? Math.min(pageNumber, MAX_PAGE) : 1
}

function toStatusFilter(raw: string | null): 'all' | ExamStatus {
  return statusOptions.find(status => status === raw) ?? 'all'
}

export default function TeacherResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const examFilter = readIdParam(searchParams, EXAM_PARAM)
  const studentFilter = readIdParam(searchParams, STUDENT_PARAM)
  const groupFilter = readIdParam(searchParams, GROUP_PARAM) ?? 'all'
  const statusFilter = toStatusFilter(searchParams.get(STATUS_PARAM))
  const page = toSafePage(searchParams.get(PAGE_PARAM))

  // Ô chữ là ngoại lệ duy nhất được giữ state: phải phản hồi tức thì mà không đẩy một mục
  // lịch sử cho mỗi phím. Deep-link ?q= vẫn chạy nhờ giá trị khởi tạo lười này.
  const [searchInput, setSearchInput] = useState(() => searchParams.get(SEARCH_PARAM) ?? '')
  const search = useDebouncedValue(searchInput, 300)

  /** Đường ghi duy nhất lên URL. Luôn replace vì điểm vào trang này thường là một trang khác. */
  function updateFilters(patch: Record<string, string | undefined>): void {
    const next = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '' || value === 'all') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    }

    // Đổi điều kiện lọc thì quay về trang đầu, trừ khi chính thao tác đó là đổi trang.
    if (!(PAGE_PARAM in patch)) {
      next.delete(PAGE_PARAM)
    }

    setSearchParams(next, { replace: true })
  }

  // Giữ tham chiếu mới nhất của phép đồng bộ, theo đúng khuôn loaderRef trong useAsync:
  // effect chỉ được phép chạy khi ô chữ đổi, nên nó không đưa searchParams vào dependency.
  const syncSearchToUrlRef = useRef<(value: string) => void>(() => {})
  syncSearchToUrlRef.current = value => {
    // Chốt so sánh bằng: URL đã đúng thì không ghi, nên không thể có vòng lặp.
    if ((searchParams.get(SEARCH_PARAM) ?? '') === value) return
    updateFilters({ [SEARCH_PARAM]: value || undefined })
  }

  useEffect(() => {
    syncSearchToUrlRef.current(search)
  }, [search])

  /**
   * Một bộ lọc duy nhất dùng chung cho cả bảng và dòng số liệu.
   *
   * Lọc nhóm lớp đi bằng **id** chứ không bằng tên: đổi tên một nhóm là mọi liên kết lọc theo tên
   * lập tức trả về 0 dòng, mà không có gì trên màn hình nói cho người dùng biết vì sao.
   */
  const resultFilters = useMemo(
    () => ({
      search,
      status: statusFilter,
      // Id đã được `readIdParam` bảo đảm là số; id không có thật (đề đã xoá) cho bảng rỗng, không phải lỗi.
      examId: examFilter === null ? undefined : Number(examFilter),
      studentId: studentFilter === null ? undefined : Number(studentFilter),
      groupId: groupFilter === 'all' ? undefined : Number(groupFilter),
    }),
    [search, statusFilter, examFilter, studentFilter, groupFilter],
  )

  const {
    data: results,
    loading: resultsLoading,
    error: resultsError,
    reload: reloadResults,
    refresh: refreshResults,
  } = useAsync(
    () => listResults({ ...resultFilters, page, pageSize: PAGE_SIZE }),
    [resultFilters, page],
  )

  // Số liệu nhận đúng bộ lọc của bảng: bốn con số nói về toàn hệ thống trong khi bảng ngay dưới đã
  // lọc là hai phần nói về hai chuyện khác nhau mà người xem không có cách nào nhận ra.
  const { data: stats, refresh: refreshStats } = useAsync(() => getResultStats(resultFilters), [resultFilters])

  // Học sinh nộp bài (hay bị tự nộp) thì bảng và bốn con số cập nhật theo, giữ nguyên bộ lọc và trang đang xem.
  useRealtimeRefresh(['ExamSubmitted', 'AutoSubmitted'], () => {
    refreshResults()
    refreshStats()
  })
  const { data: exams } = useAsync(() => listAllExams(), [])
  const { data: groups } = useAsync(() => listGroups(), [])

  // Chỉ nạp đúng một học sinh để lấy tên cho chip, không kéo cả danh sách về.
  const { data: filteredStudent } = useAsync<Student | undefined>(
    () => (studentFilter === null ? Promise.resolve(undefined) : getStudent(Number(studentFilter))),
    [studentFilter],
  )

  const examOptions = useMemo(() => exams ?? [], [exams])
  const groupOptions = useMemo(() => groups ?? [], [groups])
  const items = useMemo(() => results?.items ?? [], [results])
  const { tableRef, wrapperStyle } = useStableTableHeight(items, PAGE_SIZE, results?.total ?? 0)

  /**
   * Ô chọn nạp đủ danh sách đề (tới trần 2000), nhưng một đề vừa bị xoá hay nằm ngoài trần thì deep-link
   * tới nó không tra được nhãn. Lấy tạm nhãn từ chính các dòng kết quả đang hiển thị.
   */
  const examFilterLabel = useMemo(() => {
    if (examFilter === null) return ''
    const fromOptions = examOptions.find(exam => String(exam.id) === examFilter)
    if (fromOptions) return fromOptions.title
    const fromResults = items.find(result => String(result.examId) === examFilter)
    return fromResults ? fromResults.examTitle : `Bài kiểm tra #${examFilter}`
  }, [examFilter, examOptions, items])

  const studentFilterLabel = useMemo(() => {
    if (studentFilter === null) return ''
    // So id để tên học sinh trước không kịp hiện lên trong lúc đang nạp học sinh mới.
    if (filteredStudent && String(filteredStudent.id) === studentFilter) return filteredStudent.fullName
    const fromResults = items.find(result => String(result.studentId) === studentFilter)
    return fromResults ? fromResults.studentName : `Học sinh #${studentFilter}`
  }, [studentFilter, filteredStudent, items])

  const groupFilterLabel = useMemo(() => {
    if (groupFilter === 'all') return ''
    const found = groupOptions.find(group => String(group.id) === groupFilter)
    return found ? found.name : `Nhóm #${groupFilter}`
  }, [groupFilter, groupOptions])

  // Giá trị đang lọc luôn phải có mặt trong select, nếu không giáo viên thấy bảng ít dòng
  // trong khi ô lọc lại ghi "Tất cả".
  const examSelectOptions = useMemo<SelectOption[]>(() => {
    const options = examOptions.map(exam => ({ value: String(exam.id), label: exam.title }))
    if (examFilter === null || options.some(option => option.value === examFilter)) return options
    return [{ value: examFilter, label: examFilterLabel }, ...options]
  }, [examOptions, examFilter, examFilterLabel])

  const groupSelectOptions = useMemo<SelectOption[]>(() => {
    const options = groupOptions.map(group => ({ value: String(group.id), label: group.name }))
    if (groupFilter === 'all' || options.some(option => option.value === groupFilter)) return options
    return [{ value: groupFilter, label: groupFilterLabel }, ...options]
  }, [groupOptions, groupFilter, groupFilterLabel])

  /** Dòng kết quả chỉ mang tên nhóm, nên cần bảng tra ngược để nút lọc gửi đi đúng id. */
  const groupIdByName = useMemo(() => {
    const map = new Map<string, number>()
    groupOptions.forEach(group => map.set(group.name, group.id))
    return map
  }, [groupOptions])

  const hasActiveFilters =
    search.trim() !== '' ||
    examFilter !== null ||
    studentFilter !== null ||
    groupFilter !== 'all' ||
    statusFilter !== 'all'

  const clearFilters = () => {
    setSearchInput('')
    setSearchParams({}, { replace: true })
  }

  /** Số liệu tính trên đúng tập dữ liệu đang hiển thị, nên phụ đề nói theo bộ lọc đang bật. */
  const summaryText = useMemo(() => {
    if (!stats) return null

    const parts = [`${stats.totalAttempts} bài làm`, `${stats.gradedCount} đã chấm`]

    // Bài em còn đang làm nằm trong số "bài làm" nhưng chưa phải bài đã nộp, nên đếm riêng thay vì
    // để người xem tự trừ.
    if (stats.inProgressCount > 0) parts.push(`${stats.inProgressCount} đang làm`)

    // null nghĩa là chưa bài nào được chấm, không phải cả lớp 0 điểm — nên bỏ hẳn phần này đi
    // thay vì hiện một con số không có thật.
    // Hai con số này đã quy về thang 100 (mỗi lượt chia cho điểm tối đa của đề của nó), còn từng dòng bên dưới
    // hiện điểm thô của đề; không ghi thang thì đọc như hai kết quả mâu thuẫn.
    if (stats.averageScore !== null) parts.push(`TB ${formatScore(stats.averageScore)}/100`)
    if (stats.highestScore !== null) parts.push(`cao nhất ${formatScore(stats.highestScore)}/100`)

    // Tỷ lệ **hoàn thành**: phần trăm bài đã giao đã được nộp. Không phải tỷ lệ đạt điểm sàn —
    // backend không có khái niệm điểm sàn, nên giữ nhãn cũ là nói sai về con số mới.
    // Không có bài nào khớp bộ lọc thì "hoàn thành 0%" là con số bịa ra từ phép chia 0 cho 0.
    if (stats.totalAttempts > 0) parts.push(`hoàn thành ${stats.completionRate}%`)

    return `${hasActiveFilters ? 'Theo bộ lọc đang chọn' : 'Tất cả kết quả'}: ${parts.join(' · ')}`
  }, [stats, hasActiveFilters])

  const renderTable = () => {
    if (resultsError) {
      return <ErrorState message={resultsError} onRetry={reloadResults} />
    }

    if (resultsLoading && !results) {
      return <SkeletonTable rows={6} cols={7} />
    }

    if (items.length === 0) {
      return hasActiveFilters ? (
        <EmptyState
          icon={Search}
          title="Không tìm thấy kết quả phù hợp"
          description="Không có bài làm nào khớp với bộ lọc hiện tại. Thử đổi từ khoá hoặc bỏ bớt điều kiện lọc."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <FilterX size={15} /> Xoá bộ lọc
            </button>
          }
        />
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có bài làm nào"
          description="Khi học sinh nộp bài, kết quả sẽ tự động xuất hiện tại đây."
          action={
            <NavLink
              to="/giao-vien/bai-kiem-tra"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              Tới danh sách bài kiểm tra
            </NavLink>
          }
        />
      )
    }

    return (
      <>
        <div
          className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity ${
            resultsLoading ? 'opacity-60' : 'opacity-100'
          }`}
        >
          <TableScroller style={wrapperStyle}>
            {/* Bố cục cố định: cột hẹp có bề rộng riêng, bài kiểm tra và học sinh chia đều phần còn lại. Đổi trang
                không làm cột nào xê dịch, tên dài thì cắt bớt thay vì đẩy cột. */}
            <table ref={tableRef} className="w-full table-fixed text-sm min-w-[760px] xl:min-w-[1060px]">
              <colgroup>
                <col />
                <col />
                <col className="w-44 max-xl:hidden" />
                <col className="w-32" />
                <col className="w-36 max-xl:hidden" />
                <col className="w-32" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bài kiểm tra</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Học sinh</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 max-xl:hidden">Nhóm lớp</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Điểm</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 max-xl:hidden">Thời gian làm</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {items.map(result => {
                  // Điểm vắng mặt nghĩa là đề đang giấu kết quả, chưa có gì để tô màu xếp loại.
                  // Quy về thang 100 theo điểm tối đa của chính đề — hai đề khác điểm tối đa không bị
                  // xếp loại lệch nhau (H7).
                  const scoreTone = result.score === null ? null : getScoreTone(result.score, result.maxScore)
                  const isGraded = result.status === 'graded'
                  const isInProgress = result.status === 'inprogress'
                  const groupId = groupIdByName.get(result.group)

                  return (
                    <tr key={result.attemptId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-2.5">
                        <NavLink
                          to={`/giao-vien/bai-kiem-tra/${result.examId}`}
                          title={result.examTitle}
                          className={`${cellLinkClass} block truncate`}
                        >
                          {result.examTitle}
                        </NavLink>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {isInProgress ? 'Chưa nộp' : `Nộp ${formatDateTime(result.submittedAt)}`}
                        </p>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateFilters({ [STUDENT_PARAM]: String(result.studentId) })}
                            title={`Chỉ xem kết quả của ${result.studentName}`}
                            className={`${cellLinkClass} min-w-0 truncate`}
                          >
                            {result.studentName}
                          </button>
                          {/* Chỉ gắn nhãn khi khác thường: "Đang hoạt động" trên mọi dòng chỉ là
                              nhiễu, còn em có tài khoản chờ xoá hay đã xoá thì giáo viên cần biết trước khi đọc điểm. */}
                          {result.studentStatus !== 'active' && (
                            <span className="flex-shrink-0">
                              <StudentStatusPill status={result.studentStatus} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 max-xl:hidden">
                        {/* Không tra ra id thì nhóm chỉ hiện ra chứ không bấm lọc được, vì lọc theo
                            tên sẽ trả về bảng rỗng ngay khi nhóm được đổi tên. */}
                        {!result.group ? (
                          // Giao đích danh từng em thì kết quả không thuộc nhóm nào.
                          <span className="text-xs text-slate-400">Giao riêng</span>
                        ) : groupId === undefined ? (
                          <span
                            title={result.group}
                            className="inline-flex items-center max-w-full px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 whitespace-nowrap"
                          >
                            <span className="truncate">{result.group}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateFilters({ [GROUP_PARAM]: String(groupId) })}
                            title={`Chỉ xem kết quả của nhóm ${result.group}`}
                            className="inline-flex items-center max-w-full px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 whitespace-nowrap transition-colors"
                          >
                            <span className="truncate">{result.group}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        {isGraded ? (
                          <>
                            <p className={`font-bold ${scoreTone?.color ?? 'text-slate-400'}`}>
                              {formatScore(result.score)}
                              {result.maxScore !== null && (
                                <span className="text-xs font-medium text-slate-400"> / {formatScore(result.maxScore)}</span>
                              )}
                            </p>
                            {result.correctCount !== null && (
                              <p className="text-xs text-slate-400 mt-0.5 whitespace-nowrap">
                                {result.correctCount}/{result.totalQuestions} câu đúng
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-sm font-semibold text-slate-400">
                            {isInProgress ? 'Đang làm' : 'Chờ chấm'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap max-xl:hidden">
                        {isInProgress ? NO_VALUE : formatDuration(result.durationMinutes)}
                      </td>
                      <td className="px-5 py-2.5">
                        <StatusBadge status={result.status} />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <NavLink
                          to={`/giao-vien/ket-qua/${result.attemptId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Eye size={14} /> Xem
                        </NavLink>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroller>
        </div>

        <Pagination
          page={results?.page ?? page}
          pageSize={results?.pageSize ?? PAGE_SIZE}
          total={results?.total ?? 0}
          onPageChange={nextPage =>
            updateFilters({ [PAGE_PARAM]: nextPage > 1 ? String(nextPage) : undefined })
          }
        />
      </>
    )
  }

  // Ô tìm kiếm nằm trên thanh tiêu đề (từ cỡ lg), thay cho thẻ bộ lọc riêng phía trên bảng.
  const tools = (
    <div className="w-full max-w-sm">
      <SearchField
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Tìm học sinh hoặc bài kiểm tra"
        label="Tìm kiếm kết quả"
      />
    </div>
  )

  return (
    <TeacherLayout
      pageTitle="Kết quả"
      pageSubtitle={summaryText ?? 'Theo dõi điểm số, trạng thái nộp bài và chi tiết đáp án'}
      compactContent
      headerTools={tools}
    >
      {/* Bài kiểm tra, nhóm lớp và trạng thái là một hàng mảnh ngay trên bảng. Các ô này tự hiện giá trị đang lọc,
          nên chỉ học sinh (không có ô chọn) mới cần một chip. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <select
          value={examFilter ?? 'all'}
          onChange={event => updateFilters({ [EXAM_PARAM]: event.target.value })}
          className={`${selectClass} max-w-[18rem]`}
          aria-label="Lọc theo bài kiểm tra"
        >
          <option value="all">Tất cả bài kiểm tra</option>
          {examSelectOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={groupFilter}
          onChange={event => updateFilters({ [GROUP_PARAM]: event.target.value })}
          className={`${selectClass} max-w-[14rem]`}
          aria-label="Lọc theo nhóm lớp"
        >
          <option value="all">Tất cả nhóm lớp</option>
          {groupSelectOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={event => updateFilters({ [STATUS_PARAM]: event.target.value })}
          className={selectClass}
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Tất cả trạng thái</option>
          {statusOptions.map(status => (
            <option key={status} value={status}>
              {examStatusLabels[status]}
            </option>
          ))}
        </select>

        {studentFilter !== null && (
          <span className={chipClass}>
            Học sinh: {studentFilterLabel}
            <button
              type="button"
              onClick={() => updateFilters({ [STUDENT_PARAM]: undefined })}
              aria-label={`Bỏ điều kiện lọc Học sinh: ${studentFilterLabel}`}
              className="w-5 h-5 rounded-lg flex items-center justify-center text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        )}

        {hasActiveFilters && (
          <div className="ml-auto flex items-center gap-3">
            <p className="text-sm text-slate-500">
              Tìm thấy <strong className="text-slate-700 font-semibold">{results?.total ?? 0}</strong> bài làm
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors whitespace-nowrap"
            >
              <FilterX size={15} /> Xoá bộ lọc
            </button>
          </div>
        )}
      </div>

      {renderTable()}
    </TeacherLayout>
  )
}
