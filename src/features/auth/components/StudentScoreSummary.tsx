import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { formatScore, roundToOneDecimal } from '../../../lib/format'
import { listMyResults } from '../../../services/resultService'

/** Lấy rộng tay để tính thống kê trên toàn bộ lượt làm bài của học sinh. */
const summaryPageSize = 200

/** Cùng phong cách thẻ với phần còn lại của trang hồ sơ. */
const shellClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4'

export default function StudentScoreSummary() {
  const { data, loading, error } = useAsync(
    () => listMyResults({ page: 1, pageSize: summaryPageSize }),
    [],
  )

  if (loading) {
    return (
      <div className={shellClass}>
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-5 w-40 mt-2" />
      </div>
    )
  }

  // Thống kê chỉ là phần phụ của trang hồ sơ nên khi lỗi chỉ báo gọn một dòng, không dựng cả khối lỗi.
  if (error || !data) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-slate-500">Chưa tải được thống kê điểm.</p>
      </div>
    )
  }

  const gradedResults = data.items.filter(result => result.status === 'graded')
  const hasGraded = gradedResults.length > 0
  const totalScore = gradedResults.reduce((sum, result) => sum + result.score, 0)
  // Mảng rỗng thì không chia và không gọi Math.max để tránh NaN với -Infinity
  const averageScore = hasGraded ? roundToOneDecimal(totalScore / gradedResults.length) : 0
  const bestScore = gradedResults.reduce((best, result) => (result.score > best ? result.score : best), 0)

  if (data.total === 0) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-slate-500">Chưa có kết quả nào</p>
      </div>
    )
  }

  // Có lượt làm bài nhưng chưa lượt nào được chấm thì không hiện điểm 0 vô nghĩa
  if (!hasGraded) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800">{data.total}</span> bài đã làm · chưa có bài nào được chấm điểm
        </p>
      </div>
    )
  }

  const summaryItems = [
    { label: 'Bài đã làm', value: `${data.total}` },
    { label: 'Điểm trung bình', value: formatScore(averageScore) },
    { label: 'Điểm cao nhất', value: formatScore(bestScore) },
  ]

  return (
    <div className={shellClass}>
      <div className="grid grid-cols-3 gap-x-4">
        {summaryItems.map((item, index) => (
          <div key={item.label} className={index > 0 ? 'border-l border-slate-100 pl-4' : ''}>
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="text-lg font-semibold text-slate-800 mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
