/**
 * Câu chữ của các hộp xác nhận quanh bài kiểm tra.
 *
 * Tách ra vì cùng một câu "xoá đề" xuất hiện ở danh sách lẫn trang chi tiết, và hai bản sao sẽ
 * sớm nói hai điều khác nhau về cùng một hệ quả.
 *
 * Bố cục chung của mọi hộp: một câu dẫn ngắn nói việc sắp làm (`message`), rồi trong `details` là khối nhãn — giá trị cho
 * những con số cần đọc lướt (`ConfirmFacts`) và danh sách gạch đầu dòng cho các hệ quả (`ConsequenceList`). Không nhét tất cả
 * vào một đoạn văn dài.
 */
import ConfirmFacts from '../../../components/common/ConfirmFacts'
import ConsequenceList from '../../../components/common/ConsequenceList'
import { formatDateTime, formatDuration, parseDateTime } from '../../../lib/format'
import type { Exam } from '../../../types'

/** Danh sách hệ quả, bỏ các mục rỗng để chỗ gọi viết điều kiện gọn. */
function notes(items: Array<string | false | undefined>) {
  return <ConsequenceList items={items.filter((item): item is string => typeof item === 'string' && item !== '')} />
}

/**
 * Nút xoá chỉ bật khi chưa em nào nộp bài, nên không mất điểm số nào. Nhưng xoá đề là gỡ mọi lượt
 * giao bài, kể cả lượt đang làm dở: em đang ngồi làm bị dừng ngay và mất phần bài chưa nộp. Trước
 * đây câu chữ nói "không kết quả nào bị mất" — đúng về điểm, sai với chính em đang làm bài.
 *
 * Trang chi tiết biết bao nhiêu em đang làm và truyền vào `inProgressCount`. Số đó chụp lúc tải
 * trang, nên khi nó bằng 0 mà đề còn mở thì vẫn cảnh báo chung — một em có thể vừa bắt đầu. Danh
 * sách đề không có số đó, nên chỉ cảnh báo khi đề đang mở; đề đã đóng thì không còn lượt nào đang
 * chạy, vì server chốt hạn nộp của mọi lượt làm bài không muộn hơn giờ đóng đề.
 */
export function examDeleteConfirmCopy(
  exam: Pick<Exam, 'title' | 'assignedCount' | 'lifecycle'>,
  inProgressCount?: number,
) {
  const inProgress =
    inProgressCount !== undefined && inProgressCount > 0
      ? `${inProgressCount} học sinh đang làm bài sẽ bị dừng ngay và mất toàn bộ phần bài đang làm dở.`
      : exam.lifecycle === 'open' && exam.assignedCount > 0
        ? 'Đề đang mở: học sinh nào đang làm bài sẽ bị dừng ngay và mất toàn bộ phần bài đang làm dở.'
        : undefined

  return {
    title: 'Xoá bài kiểm tra',
    message: `Bài kiểm tra “${exam.title}” sẽ bị xoá vĩnh viễn và không khôi phục được.`,
    details: notes([
      exam.assignedCount > 0
        && `Toàn bộ ${exam.assignedCount} lượt giao bài bị gỡ theo: ${exam.assignedCount} học sinh sẽ không còn thấy bài này trong danh sách của mình.`,
      inProgress,
      'Chưa em nào nộp bài nên không mất điểm số nào.',
    ]),
    confirmLabel: 'Xoá bài kiểm tra',
    tone: 'danger' as const,
  }
}

interface PublishSummary {
  title: string
  /** Số câu của một đề (với đề chia nhiều đề là số câu mỗi đề nhỏ). */
  totalQuestions: number
  /** Số đề nhỏ mỗi lớp nhận; vắng là 1. */
  paperCount?: number
  durationMinutes: number
  /** Đã định dạng sẵn để đọc, ví dụ "12/09/2026 07:30". */
  openAt: string
  closeAt: string
}

/** Cấu hình sắp xuất bản, xếp thành các hàng nhãn — giá trị. */
function publishFacts(summary: PublishSummary) {
  return (
    <ConfirmFacts
      rows={[
        { label: 'Cỡ đề', value: `${summary.paperCount ?? 1} đề × ${summary.totalQuestions} câu` },
        { label: 'Thời gian làm bài', value: formatDuration(summary.durationMinutes) },
        { label: 'Mở bài', value: summary.openAt },
        { label: 'Đóng bài', value: summary.closeAt },
      ]}
    />
  )
}

/**
 * Xuất bản một đề mới hoặc một bản nháp.
 *
 * Nói rõ cả điều **không** xảy ra: xuất bản chưa đưa đề tới học sinh nào. Người mới dùng thường
 * tưởng bấm lưu là cả lớp nhận đề ngay.
 */
export function examPublishConfirmCopy(summary: PublishSummary, goingToAssign: boolean) {
  return {
    title: 'Xuất bản bài kiểm tra',
    message: `Bài kiểm tra “${summary.title.trim()}” sẽ được xuất bản với cấu hình sau.`,
    details: (
      <div className="space-y-3">
        {publishFacts(summary)}
        {notes([
          'Sau khi xuất bản, đề không quay lại dạng nháp được nữa.',
          goingToAssign
            ? 'Ngay sau đó bạn sẽ được chuyển sang bước chọn lớp để giao bài.'
            : 'Học sinh chỉ nhận được đề sau khi bạn giao bài.',
        ])}
      </div>
    ),
    confirmLabel: goingToAssign ? 'Xuất bản và giao bài' : 'Xuất bản',
    cancelLabel: 'Quay lại',
    tone: 'primary' as const,
  }
}

interface AssignTarget {
  name: string
  studentCount: number
  /** Đã định dạng sẵn để đọc; vắng nghĩa là lớp theo lịch chung của đề. */
  windowText?: string
}

/** Các lớp sắp nhận bài, mỗi lớp một hàng kèm khung giờ (riêng hay theo lịch chung của đề). */
export function examAssignTargetsDetails(targets: AssignTarget[]) {
  return (
    <ConfirmFacts
      heading="Giao cho"
      rows={targets.map(target => ({
        label: target.name,
        value: target.windowText ? `Khung giờ riêng ${target.windowText}` : 'Theo lịch chung của đề',
      }))}
    />
  )
}

/**
 * Xuất bản đề và giao luôn cho các lớp đã chọn ở form tạo đề — một lần bấm Lưu, một hộp xác nhận.
 *
 * Nói đủ hai việc vì cả hai đều không quay lại: đề rời dạng nháp, và học sinh trong các lớp nhận bài (kèm
 * thông báo). Từng lớp kèm khung giờ riêng hiện thành một khối để người đọc thấy từng lớp chứ không chỉ một con số.
 */
export function examPublishAndAssignConfirmCopy(
  summary: PublishSummary,
  targets: AssignTarget[],
) {
  const studentTotal = targets.reduce((sum, target) => sum + target.studentCount, 0)

  return {
    title: 'Xuất bản và giao bài',
    message: `Bài kiểm tra “${summary.title.trim()}” sẽ được xuất bản và giao ngay cho ${targets.length} lớp (khoảng ${studentTotal} học sinh).`,
    details: (
      <div className="space-y-3">
        {publishFacts(summary)}
        {examAssignTargetsDetails(targets)}
        {notes([
          'Học sinh sẽ nhận thông báo.',
          'Sau khi xuất bản, đề không quay lại dạng nháp được nữa.',
        ])}
      </div>
    ),
    confirmLabel: 'Xuất bản và giao bài',
    cancelLabel: 'Quay lại',
    tone: 'primary' as const,
  }
}

/**
 * Lưu thay đổi trên một đề đã xuất bản.
 *
 * Chỉ khẳng định điều chắc chắn đúng: bài đã nộp được chấm trên bản đề đã chụp lúc sinh đề, nên
 * sửa gì cũng không đổi được điểm đã có.
 *
 * Phần áp dụng cho các em chưa làm tách ba trường hợp, vì server làm ba việc khác nhau. Chưa em nào
 * bắt đầu mà cấu hình đề đổi thì bản đề đã sinh lúc giao bài bị **sinh lại** — giáo viên phải biết
 * các em sẽ nhận một bộ câu khác, không phải bộ họ có thể đã xem trước. Cấu hình không đổi thì bộ câu
 * giữ nguyên. Đã có em làm thì cấu hình bị khoá, chỉ tên, mô tả và tuỳ chọn hiện điểm được lưu; lịch chỉ
 * lưu được khi chưa bị khoá giờ.
 *
 * `blueprintChanged` do trang gọi tự so: nói "sẽ sinh lại" khi chỉ đổi tên là hứa một điều không xảy ra.
 */
export function publishedExamEditConfirmCopy(
  exam: Pick<Exam, 'title' | 'assignedCount' | 'submittedCount' | 'startedCount' | 'blueprintFrozen' | 'scheduleLocked'>,
  goingToAssign: boolean,
  blueprintChanged: boolean,
) {
  // Lịch đang khoá thì không đổi được, nên không hứa là lịch được lưu.
  const scheduleText = exam.scheduleLocked ? '' : ', lịch mở/đóng'
  const title = `“${exam.title}”`

  let message: string
  let consequences: string[]
  if (exam.assignedCount === 0) {
    message = `Đề ${title} đã xuất bản nhưng chưa giao cho ai.`
    consequences = ['Thay đổi áp dụng cho những lượt giao bài từ giờ.']
  } else if (exam.blueprintFrozen) {
    message = `Đề ${title} đã có ${exam.startedCount} học sinh bắt đầu làm nên cấu hình đề giữ nguyên.`
    consequences = [`Chỉ tên, mô tả${scheduleText} và tuỳ chọn hiện kết quả được lưu, và hiện ngay với các em.`]
  } else if (blueprintChanged) {
    message = `Đề ${title} đang được giao cho ${exam.assignedCount} học sinh và chưa em nào bắt đầu làm.`
    consequences = [
      'Cấu hình đề đã đổi nên đề của các em sẽ được sinh lại theo cấu hình mới.',
      'Khi vào thi, các em nhận bộ câu hỏi mới thay cho bộ đã sinh lúc giao bài.',
    ]
  } else {
    message = `Đề ${title} đang được giao cho ${exam.assignedCount} học sinh.`
    consequences = [
      `Tên, mô tả${scheduleText} và tuỳ chọn mới sẽ hiện ngay với các em.`,
      'Cấu hình đề không đổi nên bộ câu hỏi của các em giữ nguyên.',
    ]
  }
  if (exam.submittedCount > 0) consequences.push(`${exam.submittedCount} bài đã nộp và điểm đã chấm không đổi.`)

  return {
    title: 'Lưu thay đổi cho đề đã xuất bản',
    message,
    details: notes(consequences),
    confirmLabel: goingToAssign ? 'Lưu và giao bài' : 'Lưu thay đổi',
    tone: 'primary' as const,
  }
}

/**
 * Nhân bản một đề.
 *
 * Hỏi trước dù không phá gì, vì hai điều người dùng hay đoán sai: bản sao là **bản nháp chưa giao cho
 * ai** (không phải đề thứ hai cả lớp nhận ngay), và trên trang sửa thì những gì đang gõ dở không được
 * chép sang — bản sao lấy từ cấu hình đã lưu.
 *
 * Nói thêm rằng lịch mở/đóng cũng được chép nguyên. Người ta nhân bản thường là để dùng lại một đề cũ,
 * mà giờ đóng của đề cũ đã qua: giao bản sao mà không dời lịch là giao một bài các em không vào được.
 */
export function examDuplicateConfirmCopy(
  exam: Pick<Exam, 'title' | 'openAt' | 'closeAt'>,
  hasUnsavedEdits = false,
) {
  const closeDate = parseDateTime(exam.closeAt)
  const scheduleWindow = `${formatDateTime(exam.openAt)} đến ${formatDateTime(exam.closeAt)}`
  const schedule = !exam.openAt || !closeDate
    ? undefined
    : closeDate.getTime() <= Date.now()
      ? `Lịch mở bài cũng được chép nguyên (${scheduleWindow}): giờ đóng này đã qua, nhớ dời lịch trên bản sao trước khi giao bài.`
      : `Lịch mở bài cũng được chép nguyên (${scheduleWindow}); đổi trên bản sao nếu cần.`

  return {
    title: 'Nhân bản bài kiểm tra',
    message: `Hệ thống tạo một bản nháp mới từ “${exam.title}” với cùng cấu hình và tuỳ chọn, tên thêm “(bản sao)”.`,
    details: notes([
      schedule,
      'Bản sao chưa giao cho ai; đề gốc và bài làm của học sinh giữ nguyên.',
      hasUnsavedEdits && 'Những thay đổi chưa lưu trên trang này không được chép sang bản sao.',
      'Sau đó bạn được chuyển sang trang sửa bản sao.',
    ]),
    confirmLabel: 'Nhân bản',
    tone: 'primary' as const,
  }
}

/**
 * Thu hồi bài đã giao cho cả một lớp.
 *
 * Chỉ gỡ những em chưa bắt đầu làm: gỡ một em đã vào thi là xoá luôn phần bài em đã làm, nên server giữ
 * các em đó lại. Vẫn hỏi ở đây vì thu hồi không quay lại được — giao lại lớp là một lượt giao mới, không
 * phải khôi phục lượt cũ — và nói rõ có bao nhiêu em được gỡ, bao nhiêu em ở lại.
 */
export function examRevokeClassConfirmCopy(
  group: { name: string; revocableCount: number; startedCount: number },
  examTitle: string,
) {
  return {
    title: 'Thu hồi bài của cả lớp',
    message: `Gỡ bài kiểm tra “${examTitle}” khỏi ${group.revocableCount} em chưa bắt đầu của ${group.name}.`,
    details: notes([
      'Các em sẽ không còn thấy bài này nữa.',
      'Muốn giao lại thì phải giao lớp như một lượt mới.',
      group.startedCount > 0
      && `${group.startedCount} em đã bắt đầu làm bài nên vẫn giữ bài, và điểm của các em không đổi.`,
    ]),
    confirmLabel: 'Thu hồi cả lớp',
    tone: 'danger' as const,
  }
}
