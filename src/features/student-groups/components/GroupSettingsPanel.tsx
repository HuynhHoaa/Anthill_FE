import type { ReactNode } from 'react'
import { Edit3, EyeOff, Lock, LockOpen, Send, Trash2, UserRoundCog } from 'lucide-react'
import { LockedStateBadge, PublishStateBadge } from '../../../components/common/Badge'
import InfoTip from '../../../components/common/InfoTip'
import { formatDate } from '../../../lib/format'
import type { StudentGroup } from '../../../types'
import { TeacherAvatar } from './TeacherAvatar'

interface GroupSettingsPanelProps {
  group: StudentGroup
  /** Số tài khoản còn nằm trong lớp, kể cả tài khoản chờ xoá: server chỉ xoá lớp trống hẳn. */
  memberCount: number
  onEdit: () => void
  onChangeTeacher: () => void
  onPublish: () => void
  onUnpublish: () => void
  onLock: () => void
  onUnlock: () => void
  onDelete: () => void
}

const secondaryButtonClass =
  'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50'

const LOCKED_HINT = 'Lớp đã khoá nên chỉ xem được. Mở khoá lớp trước khi thay đổi.'

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-start gap-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-slate-800">{children}</dd>
    </div>
  )
}

/**
 * Nơi duy nhất sửa, công bố và xoá lớp. Danh sách lớp chỉ để xem: muốn thay đổi gì thì vào phần quản lý của lớp rồi
 * làm ở đây, nên không có nút sửa hay xoá nào nằm ngoài danh sách để bấm nhầm.
 */
export default function GroupSettingsPanel({
  group, memberCount, onEdit, onChangeTeacher, onPublish, onUnpublish, onLock, onUnlock, onDelete,
}: GroupSettingsPanelProps) {
  const canDelete = memberCount === 0
  const teacher = group.teachers[0]
  const hasTeacher = teacher !== undefined

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in-up">
      <dl className="divide-y divide-slate-100 text-sm">
        <FactRow label="Tên lớp">{group.name}</FactRow>
        <FactRow label="Mô tả">
          {group.description || <span className="font-normal text-slate-400">Chưa có mô tả cho lớp này.</span>}
        </FactRow>
        <FactRow label="Giáo viên">
          {teacher ? (
            <span className="inline-flex flex-wrap items-center gap-2.5">
              <TeacherAvatar teacher={teacher} size={28} />
              <span>
                {teacher.fullName}
                {teacher.subject && <span className="font-normal text-slate-400"> · {teacher.subject}</span>}
              </span>
              {teacher.status === 'locked' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                  Đang bị khoá
                </span>
              )}
              {group.teachers.length > 1 && (
                <span className="font-normal text-amber-600">
                  (lớp còn {group.teachers.length - 1} giáo viên theo cách phân công cũ; đổi giáo viên sẽ giữ lại đúng một người)
                </span>
              )}
            </span>
          ) : (
            <span className="font-semibold text-amber-600">Chưa có giáo viên phụ trách</span>
          )}
        </FactRow>
        <FactRow label="Trạng thái">
          <span className="inline-flex items-center gap-2">
            <PublishStateBadge isPublished={group.isPublished} />
            {group.isLocked && <LockedStateBadge />}
            <InfoTip title="Bản nháp, đã công bố và đã khoá" label="Giải thích trạng thái lớp">
              Lớp bản nháp chỉ quản trị viên nhìn thấy, để xếp học sinh cho xong rồi mới công bố. Lớp đã công bố thì giáo viên
              phụ trách thấy lớp và giao được bài cho học sinh trong lớp. Lớp đã khoá chỉ còn xem được: không xếp thêm học
              sinh, không giao bài mới; học sinh, bài đã giao và bảng điểm giữ nguyên, và các em vẫn học các lớp khác bình
              thường.
            </InfoTip>
          </span>
        </FactRow>
        <FactRow label="Ngày tạo">{formatDate(group.createdAt)}</FactRow>
        {group.publishedAt && <FactRow label="Ngày công bố">{formatDate(group.publishedAt)}</FactRow>}
        {group.lockedAt && <FactRow label="Khoá từ">{formatDate(group.lockedAt)}</FactRow>}
      </dl>

      <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onEdit}
          disabled={group.isLocked}
          title={group.isLocked ? LOCKED_HINT : undefined}
          className={secondaryButtonClass}
        >
          <Edit3 size={15} /> Sửa thông tin
        </button>

        <button
          type="button"
          onClick={onChangeTeacher}
          disabled={group.isLocked}
          title={group.isLocked ? LOCKED_HINT : undefined}
          className={secondaryButtonClass}
        >
          <UserRoundCog size={15} /> {hasTeacher ? 'Đổi giáo viên' : 'Chọn giáo viên'}
        </button>

        {group.isPublished ? (
          <button
            type="button"
            onClick={onUnpublish}
            disabled={group.isLocked}
            title={group.isLocked ? LOCKED_HINT : undefined}
            className={secondaryButtonClass}
          >
            <EyeOff size={15} /> Chuyển về nháp
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={!hasTeacher || group.isLocked}
            title={group.isLocked ? LOCKED_HINT : hasTeacher ? undefined : 'Chọn giáo viên phụ trách trước khi công bố'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
          >
            <Send size={15} /> Công bố lớp
          </button>
        )}

        {group.isLocked ? (
          <button type="button" onClick={onUnlock} className={secondaryButtonClass}>
            <LockOpen size={15} /> Mở khoá lớp
          </button>
        ) : (
          <button type="button" onClick={onLock} className={secondaryButtonClass}>
            <Lock size={15} /> Khoá lớp
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? undefined : 'Chỉ xoá được lớp trống'}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Trash2 size={15} /> Xoá lớp
        </button>
      </div>

      {!canDelete && (
        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          {group.isLocked
            ? `Lớp còn ${memberCount} tài khoản nên chưa xoá được. Lớp đã khoá chỉ xem được: mở khoá, rồi chuyển các em sang lớp khác hoặc gỡ khỏi lớp (kèm lý do) trước.`
            : `Lớp còn ${memberCount} tài khoản nên chưa xoá được. Chuyển các em sang lớp khác hoặc gỡ khỏi lớp (kèm lý do) trước.`}
        </p>
      )}
    </div>
  )
}
