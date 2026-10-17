import { useParams } from 'react-router-dom'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { getExam } from '../../../services/examService'
import ExamBuilderPage from './ExamBuilderPage'
import ExamQuestionListBuilderPage from './ExamQuestionListBuilderPage'

/**
 * Cửa vào chung của `/bai-kiem-tra/tao` và `/bai-kiem-tra/:id/sua`: chọn trình soạn đề đúng kiểu.
 *
 * Đề mới luôn soạn theo danh sách câu hỏi (duyệt từng câu rồi mới lưu). Đề đã có thì theo kiểu nó đã được
 * tạo: đề cũ theo ma trận tiếp tục dùng form ma trận, vì bản đề của các em đã sinh theo ma trận đó và đổi
 * kiểu giữa chừng là đổi bộ câu mà giáo viên chưa từng nhìn thấy.
 */
export default function ExamBuilderEntry() {
  const { id } = useParams()

  if (id === undefined) return <ExamQuestionListBuilderPage />

  return <EditEntry key={id} rawId={id} />
}

function EditEntry({ rawId }: { rawId: string }) {
  const examId = Number(rawId)
  const isValidId = Number.isInteger(examId) && examId > 0

  const { data, loading, error, reload } = useAsync(
    () => (isValidId ? getExam(examId) : Promise.resolve(undefined)),
    [examId, isValidId],
  )

  // Mã không hợp lệ: để trình soạn cũ báo lỗi bằng đúng câu chữ nó đang có.
  if (!isValidId) return <ExamBuilderPage />

  if (error) {
    return (
      <TeacherLayout pageTitle="Sửa bài kiểm tra" pageSubtitle="Không tải được bài kiểm tra">
        <ErrorState message={error} onRetry={reload} />
      </TeacherLayout>
    )
  }

  if (loading || !data) {
    return (
      <TeacherLayout pageTitle="Sửa bài kiểm tra" pageSubtitle="Đang tải bài kiểm tra">
        <div className="space-y-6">
          <SkeletonBlock className="h-12 w-72 rounded-2xl" />
          <SkeletonBlock className="h-64 w-full rounded-2xl" />
        </div>
      </TeacherLayout>
    )
  }

  return data.usesQuestionList ? <ExamQuestionListBuilderPage /> : <ExamBuilderPage />
}
