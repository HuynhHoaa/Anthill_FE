import { Link, useNavigate } from 'react-router-dom'
import {
  Users, HelpCircle, FileText, Plus, ChevronRight, Clock,
  BarChart3, Activity, ClipboardList, TrendingUp, type LucideIcon,
} from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import { LifecycleBadge } from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { getTeacherDashboard } from '../../../services/dashboardService'
import { getQuestionBankSummary } from '../../../services/questionService'
import { formatDateTime, formatDuration, formatRelativeTime, formatScore } from '../../../lib/format'
import { getTopicLabel } from '../../../lib/topicTheme'
import { difficultyLabels } from '../../../types'
import type { ActivityTone, DifficultyLevel, TeacherDashboardData } from '../../../types'

interface TeacherDashboardBundle {
  dashboard: TeacherDashboardData
  difficultyCounts: Record<DifficultyLevel, number>
}

/** Gộp hai lời gọi service thành một để trang chỉ có duy nhất một trạng thái tải. */
function loadTeacherDashboard(): Promise<TeacherDashboardBundle> {
  return Promise.all([getTeacherDashboard(), getQuestionBankSummary()]).then(([dashboard, summary]) => ({
    dashboard,
    difficultyCounts: { easy: summary.easy, medium: summary.medium, hard: summary.hard },
  }))
}

const activityToneClass: Record<ActivityTone, string> = {
  success: 'bg-emerald-400',
  info: 'bg-blue-400',
  warning: 'bg-amber-400',
  purple: 'bg-purple-400',
}

const difficultyOrder: { level: DifficultyLevel; color: string }[] = [
  { level: 'easy', color: '#10B981' },
  { level: 'medium', color: '#F59E0B' },
  { level: 'hard', color: '#EF4444' },
]

const quickActions: { label: string; description: string; to: string; icon: LucideIcon; gradient: string }[] = [
  {
    label: 'Nhóm lớp',
    description: 'Xem lớp bạn phụ trách',
    to: '/giao-vien/nhom-lop',
    icon: Users,
    gradient: 'linear-gradient(135deg,#3B82F6,#2563EB)',
  },
  {
    label: 'Tạo câu hỏi',
    description: 'Bổ sung ngân hàng',
    to: '/giao-vien/cau-hoi/tao',
    icon: HelpCircle,
    gradient: 'linear-gradient(135deg,#F59E0B,#EF4444)',
  },
  {
    label: 'Tạo bài kiểm tra',
    description: 'Sinh đề tự động',
    to: '/giao-vien/bai-kiem-tra/tao',
    icon: FileText,
    gradient: 'linear-gradient(135deg,#8B5CF6,#6366F1)',
  },
  {
    label: 'Xem kết quả',
    description: 'Theo dõi điểm số',
    to: '/giao-vien/ket-qua',
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg,#10B981,#0D9488)',
  },
]

// ===== Khung xương giữ nguyên bố cục thật để trang không nhảy khi tải xong =====

/** Bảng thật có 6 cột và tối đa 5 dòng nên khung xương phải đúng từng đó để trang không nhảy. */
const skeletonColumnKeys = [0, 1, 2, 3, 4, 5]
const skeletonRowKeys = [0, 1, 2, 3, 4]

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 px-1">
        {skeletonColumnKeys.map(columnKey => (
          <SkeletonBlock key={columnKey} className="h-3 flex-1" />
        ))}
      </div>
      {skeletonRowKeys.map(rowKey => (
        <div key={rowKey} className="flex items-center gap-4 px-1 py-2.5 border-b border-slate-50 last:border-b-0">
          {skeletonColumnKeys.map(columnKey => (
            <SkeletonBlock key={columnKey} className={columnKey === 0 ? 'h-4 flex-[2]' : 'h-3.5 flex-1'} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  const rowKeys = Array.from({ length: rows }, (_, index) => index)
  return (
    <div className="space-y-4">
      {rowKeys.map(rowKey => (
        <div key={rowKey} className="flex gap-3">
          <SkeletonBlock className="h-2.5 w-2.5 rounded-full mt-1.5" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== Trang =====

export default function TeacherDashboardPage() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(loadTeacherDashboard, [])

  const dashboard = data?.dashboard
  const difficultyCounts = data?.difficultyCounts
  const stats = dashboard?.stats
  const recentExams = dashboard?.recentExams ?? []
  const activities = dashboard?.activities ?? []
  const isFirstLoad = loading && data === undefined

  const safeDifficultyCounts: Record<DifficultyLevel, number> = difficultyCounts ?? { easy: 0, medium: 0, hard: 0 }
  const totalCountedQuestions =
    safeDifficultyCounts.easy + safeDifficultyCounts.medium + safeDifficultyCounts.hard

  /** Dòng số liệu thay cho dải thẻ thống kê, chỉ hiện khi đã có dữ liệu thật. */
  const summaryText = stats
    ? `${stats.openExams} bài đang mở · ${stats.submittedThisWeek} lượt nộp/tuần · ${stats.totalStudents} học sinh · điểm TB ${formatScore(stats.averageScore)}`
    : undefined

  if (error) {
    return (
      <TeacherLayout pageTitle="Tổng quan" pageSubtitle="Bức tranh nhanh về lớp học và bài kiểm tra của bạn">
        <ErrorState message={error} onRetry={reload} />
      </TeacherLayout>
    )
  }

  return (
    <TeacherLayout
      pageTitle="Tổng quan"
      pageSubtitle={summaryText ?? 'Bức tranh nhanh về lớp học và bài kiểm tra của bạn'}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bài kiểm tra gần đây */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in-up">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-800">Bài kiểm tra gần đây</h2>
              <p className="text-sm text-slate-400 mt-0.5">Các bài kiểm tra được tạo mới nhất</p>
            </div>
            <Link
              to="/giao-vien/bai-kiem-tra/tao"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
            >
              <Plus size={14} /> Tạo mới
            </Link>
          </div>

          {isFirstLoad ? (
            <TableSkeleton />
          ) : recentExams.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Chưa có bài kiểm tra nào"
              description="Hãy tạo bài kiểm tra đầu tiên, hệ thống sẽ tự sinh đề từ ngân hàng câu hỏi theo tỷ lệ độ khó bạn chọn."
              action={
                <Link
                  to="/giao-vien/bai-kiem-tra/tao"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  <Plus size={15} /> Tạo bài kiểm tra
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 rounded-l-xl">Tên bài kiểm tra</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Thời lượng</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Số câu</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Đã nộp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap rounded-r-xl">Hạn nộp</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExams.map(exam => (
                    <tr
                      key={exam.id}
                      onClick={() => navigate(`/giao-vien/bai-kiem-tra/${exam.id}`)}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/giao-vien/bai-kiem-tra/${exam.id}`}
                          onClick={event => event.stopPropagation()}
                          className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                        >
                          {exam.title}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">{getTopicLabel(exam.topic)}</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock size={13} />{formatDuration(exam.durationMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">{exam.totalQuestions} câu</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Users size={13} />{exam.submittedCount}/{exam.assignedCount} HS
                        </span>
                      </td>
                      <td className="px-4 py-3.5"><LifecycleBadge lifecycle={exam.lifecycle} /></td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{formatDateTime(exam.closeAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link
              to="/giao-vien/bai-kiem-tra"
              className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
            >
              Xem tất cả bài kiểm tra <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Cột phải: phân bố độ khó và dòng hoạt động */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in-up">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-800">Phân bố câu hỏi</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {isFirstLoad ? 'Đang tải ngân hàng câu hỏi...' : `${totalCountedQuestions} câu theo độ khó`}
                </p>
              </div>
              <BarChart3 size={18} className="text-slate-400 flex-shrink-0" />
            </div>

            {isFirstLoad || !difficultyCounts ? (
              <div className="space-y-5">
                {[0, 1, 2].map(barKey => (
                  <div key={barKey} className="space-y-2">
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-2.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : totalCountedQuestions === 0 ? (
              <p className="text-sm text-slate-500 leading-relaxed">
                Ngân hàng câu hỏi đang trống. Hãy thêm câu hỏi để có thể sinh đề tự động.
              </p>
            ) : (
              <div className="space-y-4">
                {difficultyOrder.map(({ level, color }) => {
                  const count = safeDifficultyCounts[level]
                  const percentage = Math.round((count / totalCountedQuestions) * 100)
                  return (
                    <div key={level}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                          {difficultyLabels[level]}
                        </span>
                        <span className="text-xs text-slate-500">
                          <strong className="text-slate-700">{count}</strong> câu · {percentage}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, background: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100">
              <Link
                to="/giao-vien/cau-hoi"
                className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
              >
                Mở ngân hàng câu hỏi <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in-up">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-800">Hoạt động gần đây</h2>
                <p className="text-sm text-slate-400 mt-0.5">Cập nhật mới nhất từ lớp học</p>
              </div>
              <Activity size={18} className="text-slate-400 flex-shrink-0" />
            </div>

            {isFirstLoad ? (
              <ListSkeleton rows={6} />
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-500 leading-relaxed">
                Chưa có hoạt động nào được ghi nhận. Khi học sinh làm bài, mọi diễn biến sẽ hiện ngay tại đây.
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${activityToneClass[activity.tone]}`} />
                      {index < activities.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-xs text-slate-400 font-medium mb-1" title={formatDateTime(activity.time)}>
                        {formatRelativeTime(activity.time)}
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{activity.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 pt-4 border-t border-slate-100">
              <Link
                to="/giao-vien/thong-bao"
                className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1 transition-colors"
              >
                Xem tất cả thông báo <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Thao tác nhanh */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map(({ label, description, to, icon: Icon, gradient }, index) => (
          <Link
            key={to}
            to={to}
            className="p-4 rounded-2xl text-white flex flex-col items-start gap-3 hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md animate-fade-in-up"
            style={{ background: gradient, animationDelay: `${(index + 5) * 0.05}s` }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Icon size={18} />
            </div>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs opacity-75 mt-0.5">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </TeacherLayout>
  )
}
