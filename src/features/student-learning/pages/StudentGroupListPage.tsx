import { NavLink } from 'react-router-dom'
import { BookOpen, CalendarRange, ChevronRight, GraduationCap, Lock, PlayCircle, Users } from 'lucide-react'
import StudentLayout from '../../../components/layout/StudentLayout'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonCards } from '../../../components/common/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { useRealtimeRefresh } from '../../../hooks/useRealtime'
import { distinctSubjects, listMyGroups, listMyTerms } from '../../../services/myLearningService'
import TermSelect from '../components/TermSelect'
import { useTermSelection } from '../hooks/useTermSelection'
import type { MyGroup } from '../../../types'

/** Thanh tiến độ: số bài đã nộp trên số bài đã giao. */
function Progress({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
        <span>Đã làm {done}/{total} bài</span>
        <span className="font-semibold text-slate-600 tabular-nums">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand bar-grow" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function GroupCard({ group, showTerm }: { group: MyGroup; showTerm: boolean }) {
  return (
    <NavLink
      to={`/hoc-sinh/lop-hoc/${group.id}`}
      className="group hover-lift bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden flex flex-col"
    >
      <div className="h-1.5 w-full" style={{ background: group.isLocked ? '#CBD5E1' : 'linear-gradient(90deg,#FF8400,#FFA01F)' }} />
      <div className="px-4 py-3.5 flex flex-col flex-1 gap-2.5">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={18} className="wiggle-on-hover" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm leading-snug">{group.name}</h3>
              {showTerm && group.termName && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                  <CalendarRange size={10} /> {group.termName}
                </span>
              )}
              {group.isLocked && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  <Lock size={10} /> Đã kết thúc
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {group.teacherName ? `GV: ${group.teacherName}` : 'Chưa có giáo viên phụ trách'}
              {group.subjectName ? ` · ${group.subjectName}` : ''}
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
        </div>

        <Progress done={group.completedCount} total={group.assignedCount} />

        <div className="flex flex-wrap gap-1.5 mt-auto">
          {group.openCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <PlayCircle size={12} /> {group.openCount} bài đang mở
            </span>
          )}
          {group.upcomingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-100">
              {group.upcomingCount} sắp tới
            </span>
          )}
          {group.expiredCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 border border-red-100">
              {group.expiredCount} hết hạn chưa làm
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-100">
            <Users size={12} /> {group.studentCount} học sinh
          </span>
        </div>

      </div>
    </NavLink>
  )
}

/** "Lớp học của tôi": các lớp em đang học; bấm vào một lớp để xem thông tin lớp và các bài kiểm tra của em ở lớp đó. */
export default function StudentGroupListPage() {
  const { data: allGroups, loading, error, reload, refresh } = useAsync(() => listMyGroups(), [])
  const termsQuery = useAsync(() => listMyTerms(), [])
  useRealtimeRefresh(['ExamAssigned', 'ExamUpdated', 'AutoSubmitted'], refresh)

  const { selection, select, visible: termFilterVisible } = useTermSelection(termsQuery.error ? [] : termsQuery.data)

  // Lọc tại máy: danh sách lớp của một em ngắn; các số đếm bên dưới theo kỳ đang chọn.
  const groups = allGroups === undefined || selection === undefined
    ? undefined
    : allGroups.filter(group => selection === 'all' || (group.termId ?? 0) === selection)
  const openTotal = (groups ?? []).reduce((sum, group) => sum + group.openCount, 0)
  const selectedTermName = typeof selection === 'number' ? termsQuery.data?.find(term => term.id === selection)?.name : undefined

  return (
    <StudentLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 animate-fade-in-up">
        <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-800">Lớp học của tôi</h1>
        <p className="text-slate-500 text-sm mt-1">
          {error
            ? 'Không tải được danh sách lớp.'
            : groups === undefined
              ? 'Đang tải danh sách lớp...'
              : groups.length === 0
                ? 'Bạn chưa được xếp vào lớp nào.'
                : <>{selectedTermName ? <><strong>{selectedTermName}</strong>: </> : null}Bạn đang học <strong>{distinctSubjects(groups).length}</strong> môn{openTotal > 0 ? <> · <strong>{openTotal}</strong> bài đang mở</> : ''}</>}
        </p>
        </div>
        {termFilterVisible && selection !== undefined && termsQuery.data && (
          <TermSelect terms={termsQuery.data} value={selection} onChange={select} />
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (loading && allGroups === undefined) || selection === undefined ? (
        <SkeletonCards count={3} />
      ) : groups && groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 stagger-in">
          {groups.map(group => (
            <GroupCard key={group.id} group={group} showTerm={selection === 'all'} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={allGroups && allGroups.length > 0 ? 'Không có lớp nào trong kỳ này' : 'Bạn chưa được xếp vào lớp nào'}
          description={allGroups && allGroups.length > 0
            ? 'Chọn kỳ khác hoặc "Tất cả các kỳ" để xem các lớp còn lại.'
            : 'Khi nhà trường xếp bạn vào lớp và giáo viên công bố lớp, lớp sẽ xuất hiện ở đây cùng các bài kiểm tra của lớp.'}
        />
      )}
    </StudentLayout>
  )
}
