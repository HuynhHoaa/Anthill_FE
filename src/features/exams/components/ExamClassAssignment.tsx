import { AlertTriangle, CheckCircle2, Layers, Shuffle } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useClassListView } from '../../../hooks/useClassListView'
import type { StudentGroup } from '../../../types'
import type { ClassAssignmentDraft } from '../utils/classAssignment'
import { SCHEDULE_LOCK_WARNING } from '../utils/examScheduleFormat'
import AssignWindowFields from './AssignWindowFields'
import { ClassPickerEmpty, ClassPickerPagination, ClassPickerToolbar } from './ClassPickerControls'

const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'

/** Hai cột × ba hàng: đủ để quét mắt, mà thẻ lớp mở khung giờ riêng ra vẫn không kéo trang quá dài. */
const CLASS_PAGE_SIZE = 6

interface ExamClassAssignmentProps {
  groups: StudentGroup[]
  loading: boolean
  error: string | undefined
  onRetry: () => void
  value: ClassAssignmentDraft
  onChange: (next: ClassAssignmentDraft) => void
  durationMinutes: number
  /** Lịch chung của đề đang soạn: khung giờ riêng của một lớp bắt đầu từ đây. */
  defaultOpenAtLocal: string
  defaultCloseAtLocal: string
  /** Khung giờ nào đang sai, đã viết sẵn thành câu. */
  problems: string[]
  /** Giờ mở của đề rơi vào vùng khoá: giao xong là không đổi được giờ nữa. */
  showLockWarning: boolean
  /** Nút "Lưu nháp" không giao cho ai, nên chỉ nhắc khi đề còn có thể lưu nháp. */
  canSaveDraft: boolean
  /**
   * Cho bật "Sinh đề riêng cho từng học sinh". Đề soạn theo danh sách có đúng một bộ câu do giáo viên duyệt
   * nên không có cách chia nhỏ — tắt ô này thay vì để server từ chối.
   */
  allowRandomize?: boolean
}

/**
 * Tab "Giao bài" của form tạo đề: chọn lớp sẽ nhận bài ngay khi lưu, kèm khung giờ riêng nếu cần.
 *
 * Chỉ có phần giao theo lớp, và đó là cách giao duy nhất. Đổi giờ của một lớp đã giao, hay thu hồi cả lớp,
 * làm ở trang chi tiết — những việc đó chỉ có nghĩa khi đề đã tồn tại.
 */
export default function ExamClassAssignment({
  groups, loading, error, onRetry, value, onChange, durationMinutes,
  defaultOpenAtLocal, defaultCloseAtLocal, problems, showLockWarning, canSaveDraft, allowRandomize = true,
}: ExamClassAssignmentProps) {
  const selected = new Set(value.groupIds)
  const classView = useClassListView(groups, CLASS_PAGE_SIZE)
  const selectedGroups = groups.filter(group => selected.has(group.id))
  const studentTotal = selectedGroups.reduce((sum, group) => sum + group.studentCount, 0)

  const toggleGroup = (groupId: number) => {
    onChange({
      ...value,
      groupIds: selected.has(groupId)
        ? value.groupIds.filter(id => id !== groupId)
        : [...value.groupIds, groupId],
    })
  }

  const setWindow = (groupId: number, changes: Partial<ClassAssignmentDraft['windows'][number]>) => {
    const current = value.windows[groupId] ?? {
      enabled: false, openAtLocal: defaultOpenAtLocal, closeAtLocal: defaultCloseAtLocal,
    }
    onChange({ ...value, windows: { ...value.windows, [groupId]: { ...current, ...changes } } })
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />

  if (loading && groups.length === 0) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SkeletonBlock className="h-24 rounded-2xl" />
        <SkeletonBlock className="h-24 rounded-2xl" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Bạn chưa được phân công lớp nào"
        description="Lớp học do quản trị viên lập rồi phân công giáo viên phụ trách. Lưu đề trước, giao bài sau khi bạn được phân công lớp."
        action={
          <NavLink
            to="/giao-vien/nhom-lop"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Layers size={15} /> Xem danh sách lớp của tôi
          </NavLink>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className={`${cardClass} p-6`}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Layers size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800">Giao cho lớp</h2>
            <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
              Lớp nào được chọn sẽ nhận bài ngay khi bạn bấm Lưu. Không chọn lớp nào thì chỉ lưu đề,
              giao sau ở trang chi tiết.
            </p>
          </div>
        </div>

        <ClassPickerToolbar view={classView} selectedCount={selectedGroups.length} />

        <ClassPickerEmpty view={classView} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {classView.pageItems.map(group => {
            const isSelected = selected.has(group.id)
            const window = value.windows[group.id]

            return (
              <div
                key={group.id}
                className={`rounded-2xl border p-4 transition-all shadow-sm ${
                  isSelected ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-100 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-pressed={isSelected}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{group.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{group.studentCount} học sinh</p>
                    </div>
                    {isSelected && <CheckCircle2 size={18} className="text-indigo-600 flex-shrink-0" />}
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-indigo-100">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={window?.enabled ?? false}
                        onChange={event => setWindow(group.id, { enabled: event.target.checked })}
                        className="w-4 h-4 accent-indigo-600 mt-0.5 flex-shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="text-sm font-medium text-slate-700">Khung giờ riêng cho lớp này</span>
                        <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Bỏ trống thì lớp làm bài theo lịch chung của đề.
                        </span>
                      </span>
                    </label>

                    {window?.enabled && (
                      <AssignWindowFields
                        idPrefix={`builder-class-${group.id}`}
                        draft={window}
                        durationMinutes={durationMinutes}
                        onChange={changes => setWindow(group.id, changes)}
                        stackedFields
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <ClassPickerPagination view={classView} />

        <p className="mt-4 text-sm text-slate-500">
          {selectedGroups.length === 0
            ? 'Chưa chọn lớp nào.'
            : `Sẽ giao cho ${selectedGroups.length} lớp, khoảng ${studentTotal} học sinh.`}
        </p>
      </section>

      {/* Học sinh luôn được báo khi nhận bài mới nên không có ô chọn; chỉ đề ma trận mới còn một tuỳ chọn để hiện. */}
      {allowRandomize && (
        <section className={`${cardClass} p-6`}>
          <h2 className="text-base font-bold text-slate-800 mb-2">Tuỳ chọn giao bài</h2>

          <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer">
            <span className="min-w-0">
              <span className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                <Shuffle size={14} className="text-slate-400" /> Sinh đề riêng cho từng học sinh
              </span>
              <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
                Mỗi học sinh nhận một bộ câu hỏi khác nhau theo đúng ma trận đề.
              </span>
            </span>
            <input
              type="checkbox"
              checked={value.randomizePerStudent}
              onChange={event => onChange({ ...value, randomizePerStudent: event.target.checked })}
              className="w-4 h-4 accent-indigo-600 mt-1 flex-shrink-0"
            />
          </label>
        </section>
      )}

      {selectedGroups.length > 0 && showLockWarning && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 leading-relaxed">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{SCHEDULE_LOCK_WARNING}</span>
        </p>
      )}

      {problems.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-red-50 px-4 py-3">
          {problems.map(problem => (
            <li key={problem} className="text-sm text-red-600 flex items-start gap-1.5">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {problem}
            </li>
          ))}
        </ul>
      )}

      {selectedGroups.length > 0 && canSaveDraft && (
        <p className="text-xs text-slate-400 leading-relaxed">
          "Lưu nháp" chỉ cất đề, chưa giao cho lớp nào. Lớp đã chọn giữ nguyên cho tới khi bạn bấm lưu bài.
        </p>
      )}
    </div>
  )
}
