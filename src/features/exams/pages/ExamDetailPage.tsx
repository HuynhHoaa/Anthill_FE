import { useEffect, useState } from 'react'
import { NavLink, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock, SkeletonTable } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { useRealtimeRefresh } from '../../../hooks/useRealtime'
import { formatDate, formatDuration, formatExamSize, formatScore } from '../../../lib/format'
import {
  getExam, getExamPapers, getExamQuestions, listExamAssignments, previewBlueprint,
} from '../../../services/examService'
import ExamAssignPanel from '../components/ExamAssignPanel'
import ExamConfigPanel from '../components/ExamConfigPanel'
import ExamContentPanel from '../components/ExamContentPanel'
import type { PaperFocus } from '../components/ExamPaperViewer'
import ExamTrackingPanel from '../components/ExamTrackingPanel'

type DetailTab = 'theo-doi' | 'cau-hinh' | 'noi-dung' | 'giao-bai'

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'theo-doi', label: 'Theo dõi' },
  { id: 'cau-hinh', label: 'Cấu hình' },
  { id: 'noi-dung', label: 'Nội dung' },
  { id: 'giao-bai', label: 'Giao bài' },
]

/** Địa chỉ giữ tab đang mở: `?tab=giao-bai` mở thẳng tab Giao bài, bỏ trống là tab Theo dõi. */
const TAB_PARAM = 'tab'
/** `?lop=<mã lớp>&de=<số thứ tự đề từ 0>` mở thẳng một đề nhỏ ở tab Nội dung. */
const CLASS_PARAM = 'lop'
const PAPER_PARAM = 'de'

function DetailSkeleton() {
  const tileKeys = Array.from({ length: 6 }, (_, index) => index)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {tileKeys.map(tileKey => (
            <SkeletonBlock key={tileKey} className="h-24 rounded-2xl" />
          ))}
        </div>
        <SkeletonTable rows={6} cols={8} />
      </div>
      <div className="space-y-4">
        <SkeletonBlock className="h-60 rounded-2xl" />
        <SkeletonBlock className="h-64 rounded-2xl" />
        <SkeletonBlock className="h-40 rounded-2xl" />
      </div>
    </div>
  )
}

/**
 * Một bài kiểm tra, bốn việc: theo dõi tiến độ làm bài, xem cấu hình, xem nội dung đề và giao bài. Trước đây là hai trang riêng
 * (chi tiết và giao bài) cùng nạp một đề, nên giao xong là phải quay lại trang kia mới thấy kết quả.
 * Giờ đề, câu hỏi và các lượt giao được nạp một lần ở đây rồi chia cho các tab.
 */
export default function ExamDetailPage() {
  const { id } = useParams()
  const examId = Number(id)
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get(TAB_PARAM)
  const activeTab: DetailTab =
    tabParam === 'giao-bai' || tabParam === 'noi-dung' || tabParam === 'cau-hinh' ? tabParam : 'theo-doi'
  // Tab Giao bài giữ nguyên ô đã chọn khi giáo viên sang xem tiến độ rồi quay lại, nên một khi đã mở thì
  // không gỡ khỏi trang nữa (chỉ ẩn). Chưa mở lần nào thì không nạp danh sách lớp và học sinh.
  const [assignVisited, setAssignVisited] = useState(activeTab === 'giao-bai')

  useEffect(() => {
    if (activeTab === 'giao-bai') setAssignVisited(true)
  }, [activeTab])

  const { data, loading, error, reload, refresh } = useAsync(async () => {
    // useParams trả về chuỗi: chặn sớm khi id trên URL không phải số để báo lỗi rõ ràng.
    if (!Number.isFinite(examId)) {
      throw new Error('Mã bài kiểm tra trên đường dẫn không hợp lệ.')
    }
    const exam = await getExam(examId)

    // Đề theo danh sách có câu hỏi cụ thể để xem lại và không có ma trận để đối chiếu với ngân hàng; đề theo
    // ma trận thì ngược lại.
    const [assignments, blueprint, questions, papers] = await Promise.all([
      listExamAssignments(exam.id),
      exam.usesQuestionList
        ? Promise.resolve(undefined)
        : previewBlueprint({
          totalQuestions: exam.totalQuestions,
          easyPercentage: exam.easyPercentage,
          mediumPercentage: exam.mediumPercentage,
          hardPercentage: exam.hardPercentage,
          topic: exam.topic,
        }),
      exam.usesQuestionList ? getExamQuestions(exam.id) : Promise.resolve([]),
      // Cách chia thành nhiều đề nhỏ: chỉ đề chia nhiều đề mới có.
      exam.paperCount > 1 ? getExamPapers(exam.id) : Promise.resolve(undefined),
    ])
    return { exam, assignments, blueprint, questions, papers }
  }, [examId])

  // Em nộp bài hay bị tự nộp trong đề này: bảng theo dõi tự cập nhật. Không nghe DeadlineSoon: giáo viên
  // nhận mỗi em một sự kiện và không ô nào trên trang đổi theo nó.
  useRealtimeRefresh(['ExamSubmitted', 'AutoSubmitted'], refresh, event => event.examId === examId)

  const selectTab = (tab: DetailTab) => {
    // replace: đổi tab không để lại một mục trong lịch sử, nút Back vẫn đưa về danh sách.
    setSearchParams(
      current => {
        const next = new URLSearchParams(current)
        if (tab === 'theo-doi') next.delete(TAB_PARAM)
        else next.set(TAB_PARAM, tab)
        // Đề nhỏ cần mở chỉ có nghĩa ngay lúc bấm liên kết; đổi tab là bỏ, để bấm lại liên kết đó vẫn mở được.
        next.delete(CLASS_PARAM)
        next.delete(PAPER_PARAM)
        return next
      },
      { replace: true },
    )
  }

  const exam = data?.exam

  const focusGroup = Number(searchParams.get(CLASS_PARAM))
  const focusVariant = Number(searchParams.get(PAPER_PARAM))
  const paperFocus: PaperFocus | undefined =
    searchParams.get(CLASS_PARAM) !== null && searchParams.get(PAPER_PARAM) !== null
      && Number.isInteger(focusGroup) && Number.isInteger(focusVariant) && focusVariant >= 0
      ? { groupId: focusGroup, variantIndex: focusVariant, key: focusGroup * 1000 + focusVariant }
      : undefined

  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to="/giao-vien/bai-kiem-tra"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} /> Quay lại danh sách
      </NavLink>
    </div>
  )

  // Tên đề là tiêu đề trang, một dòng thông tin ngắn ngay dưới: không còn thẻ đầu trang lặp lại hai thứ đó.
  const pageSubtitle = exam
    ? [
        formatDuration(exam.durationMinutes),
        formatExamSize(exam),
        exam.paperCount > 1 ? `${formatScore(exam.totalScore)} điểm mỗi đề` : `${formatScore(exam.totalScore)} điểm`,
        `Tạo ngày ${formatDate(exam.createdAt)}`,
      ].join(' · ')
    : 'Theo dõi tiến độ làm bài và giao bài cho học sinh'

  return (
    <TeacherLayout
      pageTitle={exam ? exam.title : 'Bài kiểm tra'}
      pageSubtitle={pageSubtitle}
      compactContent
      headerTools={backLink}
    >
      {loading && !data && <DetailSkeleton />}

      {error && !loading && <ErrorState message={error} onRetry={reload} />}

      {data && exam && !error && (
        <div className="space-y-5">
          <div role="tablist" aria-label="Theo dõi và giao bài" className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 w-fit">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`exam-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`exam-panel-${tab.id}`}
                  onClick={() => selectTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id="exam-panel-theo-doi"
            aria-labelledby="exam-tab-theo-doi"
            hidden={activeTab !== 'theo-doi'}
          >
            <ExamTrackingPanel
              exam={exam}
              assignments={data.assignments}
              loading={loading}
              onReload={reload}
              onOpenAssign={() => selectTab('giao-bai')}
            />
          </div>

          <div
            role="tabpanel"
            id="exam-panel-cau-hinh"
            aria-labelledby="exam-tab-cau-hinh"
            hidden={activeTab !== 'cau-hinh'}
          >
            <ExamConfigPanel
              exam={exam}
              assignments={data.assignments}
              blueprint={data.blueprint}
              papers={data.papers}
              onReload={reload}
              onOpenAssign={() => selectTab('giao-bai')}
            />
          </div>

          <div
            role="tabpanel"
            id="exam-panel-noi-dung"
            aria-labelledby="exam-tab-noi-dung"
            hidden={activeTab !== 'noi-dung'}
          >
            <ExamContentPanel
              exam={exam}
              assignments={data.assignments}
              questions={data.questions}
              papers={data.papers}
              paperFocus={paperFocus}
              active={activeTab === 'noi-dung'}
              onReload={reload}
            />
          </div>

          {assignVisited && (
            <div
              role="tabpanel"
              id="exam-panel-giao-bai"
              aria-labelledby="exam-tab-giao-bai"
              hidden={activeTab !== 'giao-bai'}
            >
              <ExamAssignPanel
                exam={exam}
                assignments={data.assignments}
                onAssigned={reload}
                onViewTracking={() => selectTab('theo-doi')}
              />
            </div>
          )}
        </div>
      )}
    </TeacherLayout>
  )
}
