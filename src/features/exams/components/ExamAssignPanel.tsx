import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, Layers, Lock, Send, Shuffle,
} from 'lucide-react'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useClassListView } from '../../../hooks/useClassListView'
import {
  assignExam, type AssignClassTarget, type AssignExamResult,
} from '../../../services/examService'
import { listGroups } from '../../../services/groupService'
import { formatDateTime } from '../../../lib/format'
import type { AssignmentWindow, Exam, ExamAssignment, StudentGroup } from '../../../types'
import AssignWindowFields from './AssignWindowFields'
import { ClassPickerEmpty, ClassPickerPagination, ClassPickerToolbar } from './ClassPickerControls'
import {
  classLabel, classLockSubject, describeScheduleLock, isCloseAfterOpen, minutesBetween,
  toDateTimeLocalValue, toServiceDateTime,
} from '../utils/examScheduleFormat'

const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'

/**
 * Khung giờ giáo viên đang soạn cho một lớp trong lần giao này.
 *
 * `enabled = false` nghĩa là lớp làm bài theo lịch chung của đề — và với một lớp đang có giờ riêng thì
 * đó là một thay đổi thật: gửi đi sẽ **gỡ** giờ riêng của những em chưa bắt đầu.
 */
interface ClassWindowDraft {
  enabled: boolean
  openAtLocal: string
  closeAtLocal: string
  /** Khung giờ riêng lớp đang theo trước lần giao này, để cảnh báo khi giáo viên bỏ nó đi. */
  hadOverride: boolean
  /**
   * Khung giờ hiện tại của lớp đang khoá (còn dưới 2 giờ nữa là mở, hoặc đang mở). Lớp này vẫn giao thêm được
   * học sinh, nhưng không đặt được khung giờ mới: khi gửi, nó mang lại đúng khung server đang giữ.
   */
  locked: boolean
}

/** Hai cột × ba hàng: đủ để quét mắt, mà thẻ lớp mở khung giờ riêng ra vẫn không kéo trang quá dài. */
const CLASS_PAGE_SIZE = 6

function toErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

/** Khung giờ đang áp cho một lớp, nếu lớp đó đã được giao đề này. */
function findClassWindow(exam: Exam, groupId: number): AssignmentWindow | undefined {
  return exam.assignmentWindows.find(window => window.groupId === groupId)
}

/**
 * Khung giờ soạn sẵn cho một lớp vừa được chọn.
 *
 * Lớp đã có giờ riêng thì mở sẵn đúng giờ đó: mặc định về lịch chung sẽ khiến một lần giao bổ sung
 * lặng lẽ kéo cả lớp về lịch cả tuần. Lớp chưa có gì thì lấy lịch đề làm điểm xuất phát.
 */
function buildClassDraft(exam: Exam, groupId: number): ClassWindowDraft {
  const existing = findClassWindow(exam, groupId)
  const hasOwnWindow = existing?.hasScheduleOverride ?? false

  return {
    enabled: hasOwnWindow,
    openAtLocal: toDateTimeLocalValue(existing?.openAt ?? exam.openAt),
    closeAtLocal: toDateTimeLocalValue(existing?.closeAt ?? exam.closeAt),
    hadOverride: hasOwnWindow,
    locked: existing?.scheduleLocked ?? false,
  }
}

function AssignSkeleton() {
  const cardKeys = Array.from({ length: 3 }, (_, index) => index)
  const rowKeys = Array.from({ length: 5 }, (_, index) => index)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="space-y-6">
        <div className={`${cardClass} p-6 space-y-3`}>
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cardKeys.map(cardKey => (
            <SkeletonBlock key={cardKey} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className={`${cardClass} overflow-hidden`}>
          <div className="p-5 border-b border-slate-100">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
          </div>
          {rowKeys.map(rowKey => (
            <div key={rowKey} className="px-5 py-4 flex items-center gap-4 border-b border-slate-50 last:border-b-0">
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-1/3" />
                <SkeletonBlock className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <SkeletonBlock className="h-56 rounded-2xl" />
        <SkeletonBlock className="h-44 rounded-2xl" />
        <SkeletonBlock className="h-14 rounded-2xl" />
      </div>
    </div>
  )
}

/** Những con số server trả về sau một lần giao, mỗi con số kèm việc cần làm tiếp. */
function ResultPanel({
  result, onViewTracking, appliedClassWindowCount, lockedScopeGroupIds, groups,
}: {
  result: AssignExamResult
  /** Chuyển sang tab Theo dõi, nơi thấy từng em vừa được giao. */
  onViewTracking: () => void
  /** Số lớp vừa nhận khung giờ riêng trong chính lần giao này — 0 nghĩa là không lớp nào có khung riêng. */
  appliedClassWindowCount: number
  /** Những lớp có mặt trong lần giao vừa rồi, để dẫn tới đúng chỗ xem em nào đang bị khoá. */
  lockedScopeGroupIds: number[]
  groups: StudentGroup[]
}) {
  const skipped: Array<{ key: string; text: string }> = [
    { key: 'assigned', text: `${result.skippedAlreadyAssigned} em đã có bài này từ trước` },
    // Tách khỏi "bị khoá": tài khoản chờ xoá không mở khoá được, chỉ quản trị viên khôi phục được.
    { key: 'retired', text: `${result.skippedRetired} em có tài khoản đang chờ xoá` },
    // Một dòng cho cả "ngoài phạm vi" lẫn "không còn trong hệ thống": server trả về một con số
    // duy nhất, vì hai con số riêng cho phép dò ra id nào là học sinh thật của lớp người khác.
    { key: 'scope', text: `${result.skippedOutOfScope} em không thuộc lớp bạn phụ trách hoặc không còn trong hệ thống` },
    { key: 'scopeGroups', text: `${result.skippedOutOfScopeGroups} lớp không thuộc quyền của bạn` },
  ].filter(item => {
    const count = Number(item.text.split(' ')[0])
    return count > 0
  })

  // Server chỉ trả về SỐ em bị khoá, không có tên hay id — nên không dò được đích danh ai để dẫn tới
  // đúng hồ sơ. Việc gần nhất làm được không cần thêm lệnh gọi API: dẫn tới đúng những lớp vừa có mặt
  // trong lần giao này, nơi mỗi dòng học sinh đã tự hiện nhãn "Đã khoá" (StudentStatusPill).
  const lockedScopeGroups = lockedScopeGroupIds
    .map(groupId => groups.find(group => group.id === groupId))
    .filter((group): group is StudentGroup => group !== undefined)

  const hasSkippedItems = skipped.length > 0 || result.skippedLocked > 0

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-bold text-emerald-800">
            {result.assignedCount > 0
              ? `Đã giao bài cho ${result.assignedCount} học sinh.`
              : 'Không có lượt giao mới nào được tạo.'}
          </p>

          {appliedClassWindowCount > 0 && (
            <p className="text-sm text-emerald-700 leading-relaxed">
              Đã áp dụng khung giờ riêng cho {appliedClassWindowCount} lớp.
            </p>
          )}

          {result.scheduleUpdatedCount > 0 && (
            <p className="text-sm text-emerald-700 leading-relaxed">
              {result.scheduleUpdatedCount} em được chuyển sang khung giờ mới và đã nhận thông báo đổi lịch.
            </p>
          )}

          {result.scheduleKeptStartedCount > 0 && (
            <p className="text-sm text-amber-700 leading-relaxed">
              {result.scheduleKeptStartedCount} em giữ khung giờ cũ vì đã bắt đầu làm bài — hạn nộp của các
              em đã chốt lúc vào thi.
            </p>
          )}

          {hasSkippedItems && (
            <div className="text-sm text-emerald-700 leading-relaxed">
              <p className="font-semibold">Đã bỏ qua:</p>
              <ul className="mt-0.5 space-y-0.5">
                {result.skippedLocked > 0 && (
                  <li>
                    · {result.skippedLocked} em đang bị khoá tài khoản — mở khoá rồi giao lại.
                    {lockedScopeGroups.length > 0 && (
                      <>
                        {' '}Xem trạng thái từng em ở lớp:{' '}
                        {lockedScopeGroups.map((group, index) => (
                          <span key={group.id}>
                            {index > 0 && ', '}
                            <NavLink
                              to={`/giao-vien/nhom-lop/${group.id}`}
                              className="font-semibold underline hover:text-emerald-900"
                            >
                              {group.name}
                            </NavLink>
                          </span>
                        ))}
                        .
                      </>
                    )}
                  </li>
                )}
                {skipped.map(item => (
                  <li key={item.key}>· {item.text}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={onViewTracking}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:underline"
          >
            Xem tiến độ làm bài
          </button>
        </div>
      </div>
    </div>
  )
}

interface ExamAssignPanelProps {
  exam: Exam
  assignments: ExamAssignment[]
  /** Giao xong: nạp lại dữ liệu dùng chung để tab Theo dõi thấy các lượt giao mới. */
  onAssigned: () => void
  onViewTracking: () => void
}

export default function ExamAssignPanel({ exam, assignments, onAssigned, onViewTracking }: ExamAssignPanelProps) {
  const toast = useToast()

  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [classWindows, setClassWindows] = useState<Record<number, ClassWindowDraft>>({})
  // Khởi tạo false rồi để hiệu ứng bên dưới đồng bộ theo đề: bật sẵn một ô tích không phản ánh
  // cấu hình thật của đề là nói với giáo viên rằng đề đang sinh riêng trong khi có thể nó không.
  const [randomizePerStudent, setRandomizePerStudent] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AssignExamResult | null>(null)
  // Ảnh chụp phạm vi của lần giao vừa xong: `selectedGroupIds`/`classWindows` bị xoá về rỗng ngay sau
  // khi giao (để giáo viên giao tiếp lớp thứ hai từ một form sạch), nên `ResultPanel` không còn đọc
  // được state gốc — phải giữ lại đúng những gì đã thật sự gửi lên server.
  const [lastSubmission, setLastSubmission] = useState<{ groupIds: number[]; classWindowCount: number } | null>(null)

  // Đề và các lượt giao đã có do trang chung nạp; chỉ danh sách lớp là của riêng tab này. Bài chỉ giao theo
  // lớp nên không cần nạp danh sách học sinh: sĩ số của lớp đã đủ để biết sẽ giao cho bao nhiêu em.
  const { data: groupList, loading, error, reload } = useAsync(() => listGroups(), [])

  const groups = useMemo(() => groupList ?? [], [groupList])
  const classView = useClassListView(groups, CLASS_PAGE_SIZE)

  // Theo giá trị chứ không theo object `exam`: trang chung nạp lại cả đề sau mỗi thao tác bên tab Theo
  // dõi, và việc đó không được xoá ô tích hay khung giờ giáo viên đang soạn dở ở đây.
  useEffect(() => {
    setRandomizePerStudent(exam.randomizePerStudent)
  }, [exam.randomizePerStudent])

  /** Số em đã được giao qua từng lớp. Bài chỉ giao theo lớp nên mọi lượt giao đều gắn với một lớp. */
  const assignedByGroup = useMemo(() => {
    const counts = new Map<number, number>()
    assignments.forEach(assignment => {
      if (assignment.assignedViaGroupId === undefined) return
      counts.set(assignment.assignedViaGroupId, (counts.get(assignment.assignedViaGroupId) ?? 0) + 1)
    })
    return counts
  }, [assignments])

  const selectedGroups = useMemo(
    () => groups.filter(group => selectedGroupIds.includes(group.id)),
    [groups, selectedGroupIds],
  )

  /** Người nhận theo sĩ số các lớp đã chọn; em đang bị khoá hay chờ xoá sẽ được server bỏ qua và báo lại. */
  const recipientCount = selectedGroups.reduce((sum, group) => sum + group.studentCount, 0)

  const duplicateCount = selectedGroups.reduce(
    (sum, group) => sum + Math.min(assignedByGroup.get(group.id) ?? 0, group.studentCount),
    0,
  )

  const newRecipientCount = recipientCount - duplicateCount

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds(current => {
      if (current.includes(groupId)) {
        return current.filter(item => item !== groupId)
      }
      setClassWindows(windows => ({ ...windows, [groupId]: buildClassDraft(exam, groupId) }))
      return [...current, groupId]
    })
  }

  const updateClassWindow = (groupId: number, changes: Partial<ClassWindowDraft>) => {
    setClassWindows(current => ({ ...current, [groupId]: { ...current[groupId], ...changes } }))
  }

  const countAssignedInGroup = (groupId: number) => assignedByGroup.get(groupId) ?? 0

  /** Khung giờ nào đang sai — dùng để chặn nút giao và nói rõ lớp nào cần sửa. */
  const windowProblems = useMemo(() => {
    const problems: string[] = []

    const check = (label: string, draft: { openAtLocal: string; closeAtLocal: string }) => {
      if (!isCloseAfterOpen(draft.openAtLocal, draft.closeAtLocal)) {
        problems.push(`${label}: giờ đóng phải sau giờ mở.`)
        return
      }
      if (minutesBetween(draft.openAtLocal, draft.closeAtLocal) < exam.durationMinutes) {
        problems.push(`${label}: khung giờ ngắn hơn ${exam.durationMinutes} phút làm bài.`)
      }
    }

    selectedGroupIds.forEach(groupId => {
      const draft = classWindows[groupId]
      if (!draft?.enabled || draft.locked) return
      const group = groups.find(item => item.id === groupId)
      check(classLabel(group?.name ?? String(groupId)), draft)
    })

    return problems
  }, [exam, selectedGroupIds, classWindows, groups])

  /** Lớp sắp bị gỡ khung giờ riêng — hệ quả nặng nhất của trang này, phải nói trước khi bấm. */
  const classesLosingWindow = useMemo(
    () => selectedGroupIds
      .filter(groupId => classWindows[groupId]?.hadOverride && !classWindows[groupId]?.enabled)
      .map(groupId => groups.find(group => group.id === groupId)?.name ?? `lớp ${groupId}`),
    [selectedGroupIds, classWindows, groups],
  )

  /**
   * Khung giờ riêng đã đặt cho từng lớp, để nhắc lại đúng lúc giáo viên xác nhận cuối cùng — thời
   * điểm không còn rút lại được, và cũng là thời điểm hộp thoại cũ bỏ sót đúng thông tin quan trọng
   * nhất của trang này.
   */
  const classWindowSummaries = useMemo(
    () => selectedGroupIds
      .map(groupId => {
        const draft = classWindows[groupId]
        if (!draft?.enabled || draft.locked) return null
        const label = groups.find(group => group.id === groupId)?.name ?? `Lớp ${groupId}`
        return { groupId, label, windowText: `${formatDateTime(draft.openAtLocal)} – ${formatDateTime(draft.closeAtLocal)}` }
      })
      .filter((item): item is { groupId: number; label: string; windowText: string } => item !== null),
    [selectedGroupIds, classWindows, groups],
  )

  const openConfirm = () => {
    if (recipientCount === 0 || windowProblems.length > 0) return
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const classes: AssignClassTarget[] = selectedGroupIds.map(groupId => {
        const draft = classWindows[groupId]

        // Lớp có khung giờ đang khoá: gửi lại đúng khung server đang giữ, nguyên chuỗi, không qua ô nhập giờ
        // (ô đó chỉ tới phút nên có thể lệch vài giây và bị coi là đổi giờ). Không đưa lớp sang `groupIds`:
        // khi đó cặp giờ chung của request, nếu có, sẽ rơi xuống lớp này.
        if (draft?.locked) {
          const current = findClassWindow(exam, groupId)
          return current?.hasScheduleOverride
            ? { groupId, openAt: current.openAt, closeAt: current.closeAt }
            : { groupId }
        }

        return draft?.enabled
          ? {
            groupId,
            openAt: toServiceDateTime(draft.openAtLocal),
            closeAt: toServiceDateTime(draft.closeAtLocal),
          }
          // Không kèm giờ nghĩa là lớp theo lịch chung của đề — và với lớp đang có giờ riêng thì đây
          // chính là lệnh gỡ nó, đúng như dòng cảnh báo trong hộp xác nhận đã nói.
          : { groupId }
      })

      // "Sinh đề riêng cho từng học sinh" đi trong payload GIAO BÀI: đây là endpoint duy nhất ghi được
      // cờ này, vì nó chỉ có nghĩa tại thời điểm sinh đề. Chỉ gửi khi khác giá trị hiện tại, để lần
      // giao bổ sung không vô cớ đụng vào đề.
      const outcome = await assignExam(exam.id, {
        groupIds: [],
        classes,
        notify: true,
        randomizePerStudent: randomizePerStudent === exam.randomizePerStudent
          ? undefined
          : randomizePerStudent,
      })

      setConfirmOpen(false)
      setResult(outcome)
      // Chụp lại phạm vi TRƯỚC khi state chọn lớp bị xoá về rỗng ở cuối hàm này — `ResultPanel` cần
      // đúng những lớp vừa gửi lên, không phải state hiện tại (đã sạch cho lượt giao tiếp theo).
      setLastSubmission({
        groupIds: selectedGroupIds,
        // Lớp đang khoá gửi lại khung cũ nguyên văn, không phải khung giáo viên vừa đặt nên không tính.
        classWindowCount: classes.filter(
          target => target.openAt !== undefined && !classWindows[target.groupId]?.locked,
        ).length,
      })

      // Mỗi lý do bị bỏ qua đòi một hành động khác nhau — mở khoá tài khoản, chọn lại lớp, hay
      // không cần làm gì — nên gộp chúng thành một con số là lấy mất thông tin giáo viên cần.
      const skipNotes = [
        outcome.skippedAlreadyAssigned > 0 ? `${outcome.skippedAlreadyAssigned} em đã có bài này từ trước` : '',
        outcome.skippedLocked > 0 ? `${outcome.skippedLocked} em đang bị khoá tài khoản` : '',
        // Tách khỏi dòng "bị khoá": tài khoản chờ xoá không mở khoá được, chỉ quản trị viên khôi phục được.
        // Chỉ nói trạng thái tài khoản, không đoán lý do — hệ thống không biết em đã nghỉ học hay chỉ bị
        // xoá nhầm, và "rời trường" không hợp với một trung tâm.
        outcome.skippedRetired > 0 ? `${outcome.skippedRetired} em có tài khoản đang chờ xoá` : '',
        // Một dòng cho cả "ngoài phạm vi" lẫn "không còn trong hệ thống": server trả về một con số
        // duy nhất, vì hai con số riêng cho phép dò ra id nào là học sinh thật của lớp người khác.
        outcome.skippedOutOfScope > 0
          ? `${outcome.skippedOutOfScope} em không thuộc lớp bạn phụ trách hoặc không còn trong hệ thống`
          : '',
        outcome.skippedOutOfScopeGroups > 0 ? `${outcome.skippedOutOfScopeGroups} nhóm lớp không thuộc quyền bạn` : '',
      ].filter(Boolean)
      const skipNote = skipNotes.length > 0 ? ` Bỏ qua ${skipNotes.join(', ')}.` : ''

      if (outcome.assignedCount > 0) {
        toast.success(`Đã giao bài kiểm tra cho ${outcome.assignedCount} học sinh.${skipNote}`)
      } else if (outcome.scheduleUpdatedCount > 0) {
        toast.success(`Đã đổi khung giờ cho ${outcome.scheduleUpdatedCount} học sinh.${skipNote}`)
      } else {
        toast.info(`Không có lượt giao mới nào được tạo.${skipNote}`)
      }

      // Ở lại trang và đọc lại dữ liệu: bảng kết quả bên dưới là thứ duy nhất nói được em nào bị bỏ
      // qua và vì sao, còn giáo viên thường giao tiếp lớp thứ hai ngay sau đó.
      setSelectedGroupIds([])
      setClassWindows({})
      onAssigned()
    } catch (caught) {
      // Đóng hộp xác nhận thay vì để nó treo: lỗi giao bài (ví dụ đề còn là bản nháp) không sửa được
      // gì bên trong hộp, nên giữ hộp mở chỉ khiến giáo viên tưởng bấm lại là thử lại được. Toast báo
      // đúng lý do server từ chối, giáo viên quay lại sửa rồi giao lại từ đầu.
      setConfirmOpen(false)
      toast.error(toErrorMessage(caught, 'Không giao được bài kiểm tra. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmMessage = [
    `Giao bài “${exam.title}” cho ${selectedGroups.length} lớp (khoảng ${recipientCount} học sinh).`,
    duplicateCount > 0
      ? `${duplicateCount} em đã có bài này từ trước sẽ được bỏ qua, hệ thống chỉ tạo mới ${newRecipientCount} lượt giao.`
      : '',
    classesLosingWindow.length > 0
      ? `Khung giờ riêng của ${classesLosingWindow.join(', ')} sẽ bị gỡ: những em chưa bắt đầu chuyển về lịch chung của đề.`
      : '',
    'Học sinh nhận bài mới hoặc bị dời giờ đều được thông báo.',
  ].filter(Boolean).join(' ')

  const hasNoClass = groups.length === 0

  return (
    <>
      {error && <ErrorState message={error} onRetry={reload} />}

      {!error && loading && !groupList && <AssignSkeleton />}

      {!error && groupList && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start animate-fade-in-up">
          <div className="space-y-6 min-w-0">
            {result && (
              <ResultPanel
                result={result}
                onViewTracking={onViewTracking}
                appliedClassWindowCount={lastSubmission?.classWindowCount ?? 0}
                lockedScopeGroupIds={lastSubmission?.groupIds ?? []}
                groups={groups}
              />
            )}

            {exam.lifecycle === 'draft' && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-700 mb-0.5">Bài kiểm tra vẫn đang là bản nháp</p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Bản nháp chưa giao được cho ai.{' '}
                    <NavLink
                      to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
                      className="font-semibold underline underline-offset-2 hover:text-amber-800"
                    >
                      Quay lại trang sửa để xuất bản đề
                    </NavLink>
                    , rồi giao và đặt khung giờ cho từng lớp ở đây.
                  </p>
                </div>
              </div>
            )}

            {duplicateCount > 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700 mb-0.5">
                    {duplicateCount} học sinh đã được giao bài này trước đó
                  </p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Hệ thống bỏ qua các em này để không tạo lượt giao trùng, chỉ {newRecipientCount} em còn
                    lại nhận bài mới. Khung giờ của lớp đổi được cho những em chưa bắt đầu, trừ lớp đang khoá giờ.
                  </p>
                </div>
              </div>
            )}

            {/* Giáo viên chưa được phân công lớp nào thì cả hai danh sách bên dưới đều rỗng. Hiện một
                trạng thái rỗng duy nhất, nói đúng bước tiếp theo, thay vì hai ô trống chồng nhau. */}
            {hasNoClass ? (
              <EmptyState
                icon={Layers}
                title="Bạn chưa được phân công lớp nào"
                description="Lớp học do quản trị viên lập, xếp học sinh rồi phân công giáo viên phụ trách. Hãy đề nghị quản trị viên phân công bạn vào lớp; ngay sau đó lớp sẽ hiện ở đây và bạn giao được bài."
                action={
                  <NavLink
                    to="/giao-vien/nhom-lop"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                  >
                    <Layers size={15} /> Xem danh sách lớp của tôi
                  </NavLink>
                }
              />
            ) : (
              <>
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Layers size={20} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-800">Chọn lớp và khung giờ</h2>
                      <p className="text-sm text-slate-400">
                        Chọn nhiều lớp cùng lúc; mỗi lớp có thể làm bài vào một khung giờ riêng.
                      </p>
                    </div>
                  </div>

                  <ClassPickerToolbar view={classView} selectedCount={selectedGroupIds.length} />

                  <ClassPickerEmpty view={classView} />

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {classView.pageItems.map(group => {
                      const isSelected = selectedGroupIds.includes(group.id)
                      const draft = classWindows[group.id]
                      const assignedInGroup = countAssignedInGroup(group.id)
                      const current = findClassWindow(exam, group.id)

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
                                {assignedInGroup > 0 && (
                                  <p className="text-xs text-amber-600 font-medium mt-1">
                                    {assignedInGroup} em đã được giao
                                  </p>
                                )}
                                {current && (
                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Khung giờ: {formatDateTime(current.openAt)} – {formatDateTime(current.closeAt)}
                                    {current.hasScheduleOverride ? ' (khung riêng)' : ' (lịch chung)'}
                                  </p>
                                )}
                              </div>
                              {isSelected && <CheckCircle2 size={18} className="text-indigo-600 flex-shrink-0" />}
                            </div>
                          </button>

                          {isSelected && draft?.locked && current && (
                            <div className="mt-3 pt-3 border-t border-indigo-100">
                              <p className="flex items-start gap-1.5 text-xs text-amber-700 leading-relaxed">
                                <Lock size={13} className="flex-shrink-0 mt-0.5" />
                                <span>
                                  {describeScheduleLock(classLockSubject(group.name), current.openAt)} Vẫn giao thêm
                                  được cho học sinh mới của lớp, các em làm theo khung giờ hiện tại.
                                </span>
                              </p>
                            </div>
                          )}

                          {isSelected && draft && !draft.locked && (
                            <div className="mt-3 pt-3 border-t border-indigo-100">
                              <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={draft.enabled}
                                  onChange={event => updateClassWindow(group.id, { enabled: event.target.checked })}
                                  className="w-4 h-4 accent-indigo-600 mt-0.5 flex-shrink-0"
                                />
                                <span className="min-w-0">
                                  <span className="text-sm font-medium text-slate-700">
                                    Khung giờ riêng cho lớp này
                                  </span>
                                  <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                                    Bỏ trống thì lớp làm bài theo lịch chung của đề.
                                  </span>
                                </span>
                              </label>

                              {draft.enabled ? (
                                <AssignWindowFields
                                  idPrefix={`class-${group.id}`}
                                  draft={draft}
                                  durationMinutes={exam.durationMinutes}
                                  onChange={changes => updateClassWindow(group.id, changes)}
                                  stackedFields
                                  warnLock={assignedInGroup > 0}
                                />
                              ) : draft.hadOverride && (
                                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 leading-relaxed">
                                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                                  Lớp này đang có khung giờ riêng. Giao bài lúc này sẽ gỡ nó và đưa những em
                                  chưa bắt đầu về lịch chung của đề.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <ClassPickerPagination view={classView} />
                </section>
              </>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 min-w-0">
            <div className={`${cardClass} p-5`}>
              <h2 className="text-base font-bold text-slate-800 mb-2">Tuỳ chọn giao bài</h2>

              {!exam.usesQuestionList && (
                <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer">
                <span className="min-w-0">
                  <span className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                    <Shuffle size={14} className="text-slate-400" /> Sinh đề riêng cho từng học sinh
                  </span>
                  <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Mỗi học sinh nhận một bộ câu hỏi khác nhau theo đúng blueprint. Đây là cấu hình
                    của đề nên đổi ở đây sẽ áp dụng cho mọi lượt giao của bài này.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={randomizePerStudent}
                  onChange={event => setRandomizePerStudent(event.target.checked)}
                  className="w-4 h-4 accent-indigo-600 mt-1 flex-shrink-0"
                />
              </label>
              )}

              {/* Lịch chung của đề không sửa ở đây nữa: sửa nó là dời giờ của MỌI lớp đang theo lịch
                  chung, trong khi việc người dùng định làm gần như luôn là đổi giờ của một lớp. */}
              <p className="mt-2 pt-3 border-t border-slate-50 text-xs text-slate-400 leading-relaxed">
                Lịch chung của đề ({formatDateTime(exam.openAt)} – {formatDateTime(exam.closeAt)}) đổi ở{' '}
                <NavLink
                  to={`/giao-vien/bai-kiem-tra/${exam.id}/sua`}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  trang sửa đề
                </NavLink>
                ; đổi nó là dời giờ của mọi lớp đang theo lịch chung.
              </p>
            </div>

            <div className={`${cardClass} p-5`}>
              <button
                type="button"
                onClick={openConfirm}
                disabled={recipientCount === 0 || windowProblems.length > 0 || submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                <Send size={17} /> Xác nhận giao bài
              </button>
              {recipientCount === 0 && (
                <p className="text-xs text-slate-400 leading-relaxed mt-3 text-center">
                  Chọn ít nhất một lớp để bật nút giao bài.
                </p>
              )}
              {windowProblems.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {windowProblems.map(problem => (
                    <li key={problem} className="text-xs text-red-500 leading-relaxed flex items-start gap-1.5">
                      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                      {problem}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận giao bài kiểm tra"
        message={confirmMessage}
        details={classWindowSummaries.length > 0 ? (
          <div>
            <p className="font-semibold text-slate-700 mb-1">Khung giờ riêng theo lớp:</p>
            <ul className="space-y-0.5">
              {classWindowSummaries.map(item => (
                <li key={item.groupId}>· {item.label} — {item.windowText}</li>
              ))}
            </ul>
          </div>
        ) : undefined}
        confirmLabel="Giao bài ngay"
        cancelLabel="Xem lại"
        loading={submitting}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
