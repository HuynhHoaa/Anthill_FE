import { NavLink, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpenCheck, CalendarRange, GraduationCap, Lock, User, Users } from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { getMyGroup } from '../../../services/myLearningService'
import StudentExamBrowser from '../../exam-taking/components/StudentExamBrowser'

function InfoChip({ icon: Icon, children }: { icon: typeof User; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <Icon size={15} className="text-slate-400" />
      {children}
    </span>
  )
}

/** Một lớp của học sinh: thông tin lớp ở đầu trang, bên dưới là mọi bài kiểm tra của em ở lớp này (kể cả bài đã làm). */
export default function StudentGroupPage() {
  const { groupId: groupIdParam } = useParams()
  const groupId = Number(groupIdParam)
  const valid = Number.isInteger(groupId) && groupId > 0

  const { data: group, loading, error, reload } = useAsync(
    () => (valid ? getMyGroup(groupId) : Promise.reject<never>(new Error('Đường dẫn lớp không hợp lệ.'))),
    [groupId],
  )

  return (
    <StudentLayout>
      <NavLink
        to="/hoc-sinh/lop-hoc"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> Lớp học của tôi
      </NavLink>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && group === undefined ? (
        <SkeletonBlock className="h-36 rounded-2xl" />
      ) : group ? (
        <>
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-5 animate-fade-in-up">
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white animate-pop-in" style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                <GraduationCap size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-800">{group.name}</h1>
                  {group.isLocked && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      <Lock size={11} /> Đã kết thúc (chỉ xem lại)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5">
                  <InfoChip icon={User}>{group.teacherName ? `Giáo viên: ${group.teacherName}` : 'Chưa có giáo viên phụ trách'}</InfoChip>
                  {group.subjectName && <InfoChip icon={BookOpenCheck}>{`Môn: ${group.subjectName}`}</InfoChip>}
                  {group.termName && <InfoChip icon={CalendarRange}>{group.termName}</InfoChip>}
                  <InfoChip icon={Users}>{`${group.studentCount} học sinh`}</InfoChip>
                </div>
                {group.description && <p className="text-sm text-slate-500 leading-relaxed mt-2">{group.description}</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: 'Đã giao', value: group.assignedCount, tone: 'text-slate-700 bg-slate-50 border-slate-100' },
                { label: 'Đã nộp', value: group.completedCount, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                { label: 'Đang mở', value: group.openCount, tone: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
                { label: 'Hết hạn chưa làm', value: group.expiredCount, tone: group.expiredCount > 0 ? 'text-red-600 bg-red-50 border-red-100' : 'text-slate-500 bg-slate-50 border-slate-100' },
              ].map((stat, index) => (
                <div
                  key={stat.label}
                  className={`inline-flex items-baseline gap-1.5 rounded-lg border px-3 py-1 animate-pop-in ${stat.tone}`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className="text-base font-bold tabular-nums">{stat.value}</span>
                  <span className="text-xs font-medium">{stat.label}</span>
                </div>
              ))}
            </div>
          </section>

          <StudentExamBrowser groupId={group.id} />
        </>
      ) : null}
    </StudentLayout>
  )
}
