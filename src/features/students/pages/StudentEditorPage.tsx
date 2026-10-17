// Trang thuộc vai trò quản trị viên: admin sở hữu tài khoản học sinh.
import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, AtSign, CheckCircle2, Copy, Hash, KeyRound, Loader2, Lock, Mail,
  Phone, RotateCcw, Save, ShieldAlert, Trash2, User,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import ErrorState from '../../../components/common/ErrorState'
import ConsequenceList from '../../../components/common/ConsequenceList'
import Modal from '../../../components/common/Modal'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import useAsync from '../../../hooks/useAsync'
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard'
import { formatDate, formatDateTime, getInitials } from '../../../lib/format'
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME, listGroups } from '../../../services/groupService'
import {
  DELETION_RETENTION_DAYS, ERASED_STUDENT_NAME,
  createStudent, getStudent, isRetiredStudent, listStudents, setStudentStatus, updateStudent,
  type ResetPasswordResult, type StudentPayload,
} from '../../../services/studentService'
import StudentStatusPill from '../components/StudentStatusPill'
import StudentTextField from '../components/StudentTextField'
import { lockConfirmCopy, lockConsequences, useStudentAccountActions } from '../hooks/useStudentAccountActions'
import { studentStatusLabels, type Student, type StudentStatus } from '../../../types'

/**
 * Hệ quả của việc đổi lớp khi sửa hồ sơ. Đây là cùng một việc với "Gỡ khỏi lớp" ở trang lớp, nên
 * phải nói cùng những điều: em rời lớp nào, đi đâu, và điều gì KHÔNG mất. Tên em đã nằm ở câu dẫn
 * của hộp, nên từng dòng không nhắc lại.
 */
function groupChangeConsequences(fromGroup: string, toGroup: string | null): string[] {
  return toGroup === null
    ? [
        `Rời lớp ${fromGroup} và chuyển về trạng thái chưa phân lớp.`,
        'Giáo viên của lớp cũ không giao được bài mới cho em nữa. Bài đã giao, bài đã nộp và điểm vẫn giữ nguyên.',
      ]
    : [
        `Chuyển từ lớp ${fromGroup} sang lớp ${toGroup}. Từ giờ em nhận những bài được giao cho lớp mới.`,
        `Bài lớp ${toGroup} đã giao trước khi em chuyển sang không tự đến với em — giáo viên cần giao thêm nếu muốn em làm.`,
        `Bài lớp ${fromGroup} đã giao cho em, bài đã nộp và điểm cũ vẫn giữ nguyên.`,
      ]
}

/** Số bản ghi tải về để kiểm tra trùng mã, email và tên đăng nhập ngay trên giao diện. */
const DIRECTORY_PAGE_SIZE = 500

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[0-9\s.+-]{9,15}$/

type FormFieldName = 'fullName' | 'email' | 'phone' | 'username' | 'code' | 'password'

type FormErrors = Partial<Record<FormFieldName, string>>

interface StudentFormValues {
  fullName: string
  email: string
  phone: string
  username: string
  code: string
  groupId: number
  status: StudentStatus
  password: string
}

const emptyValues: StudentFormValues = {
  fullName: '',
  email: '',
  phone: '',
  username: '',
  code: '',
  groupId: UNASSIGNED_GROUP_ID,
  status: 'active',
  password: '',
}

const accountActionButtonClass =
  'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60'

function isTakenBy(
  students: Student[],
  currentId: number | null,
  pick: (student: Student) => string,
  value: string,
): boolean {
  const normalized = value.trim().toLowerCase()
  return students.some(student => student.id !== currentId && pick(student).toLowerCase() === normalized)
}

function validateValues(
  values: StudentFormValues,
  students: Student[],
  currentId: number | null,
  isEditMode: boolean,
): FormErrors {
  const errors: FormErrors = {}
  const fullName = values.fullName.trim()
  const email = values.email.trim()
  const username = values.username.trim()
  const code = values.code.trim()

  if (!fullName) {
    errors.fullName = 'Vui lòng nhập họ và tên.'
  } else if (fullName.length < 3) {
    errors.fullName = 'Họ và tên phải có ít nhất 3 ký tự.'
  }

  if (!email) {
    errors.email = 'Vui lòng nhập email.'
  } else if (!emailPattern.test(email)) {
    errors.email = 'Email không đúng định dạng, ví dụ: an.nv@student.edu.vn'
  } else if (isTakenBy(students, currentId, student => student.email, email)) {
    errors.email = 'Email này đã được dùng cho một học sinh khác.'
  }

  // Số điện thoại tuỳ chọn; nhập thì phải đúng định dạng (cùng quy tắc với server).
  const phone = values.phone.trim()
  if (phone && !phonePattern.test(phone)) {
    errors.phone = 'Số điện thoại chỉ gồm chữ số và dài 9–15 ký tự.'
  }

  if (!username) {
    errors.username = 'Vui lòng nhập tên đăng nhập.'
  } else if (username.length < 3) {
    errors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự.'
  } else if (/\s/.test(username)) {
    errors.username = 'Tên đăng nhập không được chứa khoảng trắng.'
  } else if (isTakenBy(students, currentId, student => student.username, username)) {
    errors.username = 'Tên đăng nhập này đã tồn tại.'
  }

  if (!code) {
    errors.code = 'Vui lòng nhập mã học sinh.'
  } else if (isTakenBy(students, currentId, student => student.code, code)) {
    errors.code = 'Mã học sinh này đã được dùng cho một học sinh khác.'
  }

  if (!isEditMode) {
    if (!values.password) {
      errors.password = 'Vui lòng nhập mật khẩu ban đầu.'
    } else if (values.password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự.'
    }
  }

  return errors
}

export default function StudentEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const accountActions = useStudentAccountActions()

  const studentId = id === undefined ? null : Number(id)
  const isEditMode = studentId !== null

  const editorQuery = useAsync(async () => {
    const [groups, directory, student] = await Promise.all([
      listGroups(),
      listStudents({ page: 1, pageSize: DIRECTORY_PAGE_SIZE }),
      studentId === null ? Promise.resolve(null) : getStudent(studentId),
    ])
    return { groups, existingStudents: directory.items, student }
  }, [studentId])

  const [values, setValues] = useState<StudentFormValues>(emptyValues)
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [issuedPassword, setIssuedPassword] = useState<ResetPasswordResult | null>(null)

  // Mật khẩu vừa cấp chỉ nằm trong hộp của nó. Tải lại trang hay đóng tab lúc hộp còn mở là mất hẳn,
  // nên trình duyệt hỏi lại một câu. Nút Back thì BrowserRouter không chặn được — hộp ghi rõ điều đó.
  useEffect(() => {
    if (issuedPassword === null) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [issuedPassword])

  // Chỉ nhận bản ghi đúng id trên URL. Đi từ học sinh này sang học sinh khác, hay sang trang tạo mới,
  // giữ nguyên component, và useAsync giữ dữ liệu cũ tới khi bản mới về: đổ bản cũ vào form lúc đó
  // là mời người dùng bấm Lưu ghi dữ liệu của em A lên em B — và ở trang tạo mới thì còn lặp render.
  const fetchedStudent = editorQuery.data?.student ?? null
  const loadedStudent = isEditMode && fetchedStudent?.id === studentId ? fetchedStudent : null

  // Học sinh mà form đang phản ánh. Đổ lại form khi đó là học sinh khác, hoặc khi trạng thái vừa
  // đổi (xoá, khôi phục) — nếu không ô trạng thái vẫn nói "Đang hoạt động" cho một tài khoản vừa
  // vào diện chờ xoá. Nhưng KHÔNG đổ lại chỉ vì trang vừa tải lại: một thao tác tài khoản hỏng cũng
  // tải lại và nhận về bản ghi y hệt, và đổ lại theo nó là xoá âm thầm những gì đang gõ dở.
  const [syncedStudent, setSyncedStudent] = useState<Student | null>(null)

  // Cùng một component phục vụ cả hai chế độ: khi chuyển sang tạo mới phải xoá sạch
  // dữ liệu của học sinh đang mở trước đó, nếu không form sẽ giữ lại thông tin người cũ.
  if (!isEditMode && syncedStudent !== null) {
    setSyncedStudent(null)
    setValues(emptyValues)
    setTouchedFields({})
    setHasSubmitted(false)
  }

  // Đổ dữ liệu vào form ngay trong lúc render để không nháy form rỗng ở khoảnh khắc vừa tải xong.
  const needsSync =
    loadedStudent !== null
    && (syncedStudent === null
      || loadedStudent.id !== syncedStudent.id
      || loadedStudent.status !== syncedStudent.status)
  if (loadedStudent && needsSync) {
    setSyncedStudent(loadedStudent)
    setValues({
      fullName: loadedStudent.fullName,
      email: loadedStudent.email,
      phone: loadedStudent.phone ?? '',
      username: loadedStudent.username,
      code: loadedStudent.code,
      groupId: loadedStudent.groupId,
      status: loadedStudent.status,
      password: '',
    })
    setTouchedFields({})
    setHasSubmitted(false)
  }

  // Tài khoản đã rời hệ thống chỉ còn để xem. Server từ chối (409) mọi lượt sửa hồ sơ, đổi trạng
  // thái hay cấp lại mật khẩu trên những tài khoản này, nhưng giao diện cũng không mở đường cho một
  // việc chắc chắn hỏng: đặt lại "Đang hoạt động" qua ô trạng thái là vòng qua bước khôi phục, còn
  // sửa một tài khoản đã xoá là ghi đè lên chính phần dữ liệu đã được ẩn danh.
  const isReadOnly = loadedStudent !== null && isRetiredStudent(loadedStudent)

  const groups = editorQuery.data?.groups ?? []
  const existingStudents = editorQuery.data?.existingStudents ?? []
  const errors = validateValues(values, existingStudents, studentId, isEditMode)

  // Còn thay đổi chưa lưu khi form khác hồ sơ đã nạp (hoặc khác form trống, với tạo mới). Tài khoản chỉ để xem thì không có gì để mất.
  const baselineValues: StudentFormValues = syncedStudent
    ? {
      fullName: syncedStudent.fullName,
      email: syncedStudent.email,
      phone: syncedStudent.phone ?? '',
      username: syncedStudent.username,
      code: syncedStudent.code,
      groupId: syncedStudent.groupId,
      status: syncedStudent.status,
      password: '',
    }
    : emptyValues
  const hasUnsavedChanges = !isReadOnly && JSON.stringify(values) !== JSON.stringify(baselineValues)
  const guard = useUnsavedChangesGuard(hasUnsavedChanges)

  const groupChoices = [
    { id: UNASSIGNED_GROUP_ID, name: UNASSIGNED_GROUP_NAME },
    ...groups.map(group => ({ id: group.id, name: group.name })),
  ]
  const selectedGroupName =
    groupChoices.find(choice => choice.id === values.groupId)?.name ?? UNASSIGNED_GROUP_NAME

  const updateValues = (patch: Partial<StudentFormValues>) => {
    setValues(current => ({ ...current, ...patch }))
  }

  const markTouched = (field: FormFieldName) => {
    setTouchedFields(current => ({ ...current, [field]: true }))
  }

  const errorFor = (field: FormFieldName): string | undefined =>
    hasSubmitted || touchedFields[field] ? errors[field] : undefined

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isReadOnly || submitting || (isEditMode && !loadedStudent)) return
    setHasSubmitted(true)

    if (Object.keys(errors).length > 0) {
      toast.error('Vui lòng kiểm tra lại các trường còn thiếu hoặc chưa hợp lệ.')
      return
    }

    const payload: StudentPayload = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      username: values.username.trim(),
      code: values.code.trim(),
      groupId: values.groupId,
    }

    // Server đòi mật khẩu khi tạo tài khoản — người tạo là người trao mật khẩu đầu tiên cho học
    // sinh. Ở chế độ sửa thì không gửi: đổi mật khẩu đi qua chức năng đặt lại riêng.
    if (!isEditMode) payload.password = values.password

    // Khoá/mở khoá tài khoản đi qua một endpoint riêng chứ không nằm trong hồ sơ, nên sau khi
    // lưu còn phải đối chiếu trạng thái trong phản hồi và chỉnh thêm nếu ô chọn khác.
    const save = async () => {
      if (studentId === null) {
        const created = await createStudent(payload)
        if (created.status !== values.status) await setStudentStatus(created.id, values.status)
      } else {
        const saved = await updateStudent(studentId, payload)
        if (saved.status !== values.status) await setStudentStatus(saved.id, values.status)
      }
    }

    // Đổi ô trạng thái của một tài khoản đang có rồi bấm Lưu là khoá hoặc mở khoá thật, nên phải
    // hỏi lại y như nút khoá ở danh sách. Tạo mới thì chưa ai dùng tài khoản đó, không cần hỏi.
    const lockChanging = loadedStudent !== null && values.status !== loadedStudent.status
    // Đổi lớp ở đây cũng là gỡ em khỏi lớp cũ — đúng việc mà trang lớp hỏi lại trước khi làm — nên
    // phải hỏi y như vậy. Xếp một em chưa có lớp vào lớp thì không ai mất gì, không hỏi.
    const leavingGroup =
      loadedStudent !== null
      && loadedStudent.groupId !== UNASSIGNED_GROUP_ID
      && values.groupId !== loadedStudent.groupId

    if (lockChanging || leavingGroup) {
      const locking = values.status === 'locked'
      const movingTo = values.groupId === UNASSIGNED_GROUP_ID ? null : selectedGroupName
      const groupItems =
        leavingGroup && loadedStudent ? groupChangeConsequences(loadedStudent.group, movingTo) : []

      // Đổi cả hai thì gộp vào MỘT hộp: hai hộp liền nhau là mời người dùng bấm "Đồng ý" lần thứ
      // hai mà không đọc.
      const copy = !leavingGroup
        ? {
            ...lockConfirmCopy(payload.fullName, locking),
            confirmLabel: locking ? 'Lưu và khoá tài khoản' : 'Lưu và mở khoá',
          }
        : {
            title: lockChanging ? 'Lưu thay đổi tài khoản' : movingTo ? 'Chuyển lớp cho học sinh' : 'Gỡ học sinh khỏi lớp',
            message: `Các thay đổi sau với tài khoản của ${payload.fullName} có hiệu lực ngay khi lưu:`,
            details: (
              <ConsequenceList
                items={lockChanging ? [...groupItems, ...lockConsequences(payload.fullName, locking)] : groupItems}
              />
            ),
            confirmLabel: lockChanging ? 'Lưu thay đổi' : movingTo ? 'Lưu và chuyển lớp' : 'Lưu và gỡ khỏi lớp',
            // Chuyển lớp là việc thường ngày và làm lại được, nên không tô đỏ. Gỡ khỏi lớp hay khoá
            // tài khoản thì em mất quyền nhận bài — giữ màu cảnh báo như ở trang lớp.
            tone: (lockChanging && locking) || !movingTo ? ('danger' as const) : ('primary' as const),
          }

      const saved = await confirm({ ...copy, onConfirm: save })
      if (!saved) return
    } else {
      setSubmitting(true)
      try {
        await save()
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Không lưu được thông tin học sinh.')
        setSubmitting(false)
        return
      }
    }

    toast.success(isEditMode ? `Đã lưu thay đổi cho ${payload.fullName}.` : `Đã thêm học sinh ${payload.fullName}.`)
    guard.leaveWithoutAsking(() => navigate('/quan-tri/hoc-sinh'))
  }

  /** Thao tác tài khoản có hiệu lực ngay, nên tải lại để form và nhãn trạng thái theo kịp. */
  const runAccountAction = async (pending: Promise<boolean>) => {
    if (await pending) editorQuery.reload()
  }

  const handleResetPassword = async () => {
    if (!loadedStudent) return
    const result = await accountActions.resetPassword(loadedStudent)
    if (result) setIssuedPassword(result)
  }

  const copyIssuedPassword = async () => {
    if (!issuedPassword) return
    try {
      await navigator.clipboard.writeText(issuedPassword.password)
      toast.success('Đã chép mật khẩu mới.')
    } catch {
      toast.error('Trình duyệt không cho chép tự động. Hãy bôi đen mật khẩu rồi chép thủ công.')
    }
  }

  const checklist: Array<{ label: string; done: boolean }> = [
    { label: 'Họ và tên', done: !errors.fullName },
    { label: 'Email', done: !errors.email },
    { label: 'Tên đăng nhập', done: !errors.username },
    { label: 'Mã học sinh', done: !errors.code },
  ]
  if (!isEditMode) {
    checklist.push({ label: 'Mật khẩu', done: !errors.password })
  }

  const pageTitle = isReadOnly ? 'Thông tin học sinh' : isEditMode ? 'Sửa thông tin học sinh' : 'Thêm học sinh'
  // Mốc xoá vĩnh viễn do server tính. Không có thì nói mốc tương đối chứ không tự cộng ngày.
  const restoreDeadline = loadedStudent?.deletionScheduledAt
    ? `tới ${formatDateTime(loadedStudent.deletionScheduledAt)}`
    : `trong ${DELETION_RETENTION_DAYS} ngày kể từ ngày yêu cầu xoá`
  // "Đã rời hệ thống" nghe như việc đã xong, trong khi tài khoản chờ xoá vẫn còn đường lui.
  const pageSubtitle =
    loadedStudent?.status === 'pendingDeletion'
      ? `Tài khoản đang chờ xoá — vẫn khôi phục được ${restoreDeadline}`
      : loadedStudent?.status === 'deleted'
        ? 'Dữ liệu cá nhân đã bị xoá vĩnh viễn, hồ sơ chỉ còn để xem'
        : isEditMode
          ? 'Cập nhật hồ sơ, nhóm lớp và trạng thái tài khoản'
          : 'Tạo tài khoản mới để học sinh đăng nhập và làm bài kiểm tra'

  // Nút quay lại nằm trên thanh tiêu đề (hẹp hơn thì đứng đầu nội dung), không chiếm một hàng riêng trong trang.
  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to="/quan-tri/hoc-sinh"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} /> Quay lại danh sách học sinh
      </NavLink>
    </div>
  )

  return (
    <AdminLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle} compactContent headerTools={backLink}>

      {editorQuery.loading && !editorQuery.data ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <SkeletonBlock className="h-4 w-40" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3, 4, 5].map(fieldKey => (
                <div key={fieldKey} className="space-y-2">
                  <SkeletonBlock className="h-3 w-28" />
                  <SkeletonBlock className="h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
            </div>
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
          </div>
        </div>
      ) : editorQuery.error ? (
        <ErrorState message={editorQuery.error} onRetry={editorQuery.reload} />
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start animate-fade-in-up"
        >
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            {loadedStudent?.status === 'pendingDeletion' && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <ShieldAlert size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-amber-800">Tài khoản đang chờ xoá</p>
                  <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                    {loadedStudent.fullName} không đăng nhập được. Bạn có thể khôi phục {restoreDeadline}; sau
                    đó hệ thống xoá vĩnh viễn dữ liệu cá nhân nhưng vẫn giữ kết quả bài làm. Hồ sơ chỉ để xem
                    cho tới khi được khôi phục.
                  </p>
                  {loadedStudent.deletionReason && (
                    <p className="text-sm text-amber-700 mt-1.5 leading-relaxed">
                      <span className="font-semibold">Lý do xoá:</span> {loadedStudent.deletionReason}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void runAccountAction(accountActions.restore(loadedStudent))}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex-shrink-0"
                >
                  <RotateCcw size={15} /> Khôi phục
                </button>
              </div>
            )}

            {loadedStudent?.status === 'deleted' && (
              <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 flex items-start gap-3">
                <ShieldAlert size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-rose-700">Dữ liệu cá nhân đã bị xoá vĩnh viễn</p>
                  <p className="text-sm text-rose-600 mt-1 leading-relaxed">
                    Kết quả các bài đã làm vẫn được giữ dưới tên "{ERASED_STUDENT_NAME}". Tài khoản chỉ
                    còn để xem: không sửa, khoá, cấp lại mật khẩu hay khôi phục được nữa.
                  </p>
                </div>
              </div>
            )}

            {/* fieldset khoá mọi ô cùng lúc bằng thuộc tính gốc của trình duyệt, không phải dựa vào
                từng ô tự nhớ chế độ chỉ đọc. */}
            <fieldset disabled={isReadOnly} className="min-w-0 space-y-6">
              <section className="space-y-4">
                <h2 className="text-base font-bold text-slate-800">Thông tin cá nhân</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StudentTextField
                    label="Họ và tên"
                    icon={User}
                    value={values.fullName}
                    onChange={value => updateValues({ fullName: value })}
                    onBlur={() => markTouched('fullName')}
                    error={errorFor('fullName')}
                    placeholder="Ví dụ: Nguyễn Minh Khoa"
                    autoComplete="off"
                  />
                  <StudentTextField
                    label="Email"
                    icon={Mail}
                    type="email"
                    value={values.email}
                    onChange={value => updateValues({ email: value })}
                    onBlur={() => markTouched('email')}
                    error={errorFor('email')}
                    placeholder="khoa.nm@student.edu.vn"
                    autoComplete="off"
                  />
                  <StudentTextField
                    label="Số điện thoại"
                    icon={Phone}
                    type="tel"
                    value={values.phone}
                    onChange={value => updateValues({ phone: value })}
                    onBlur={() => markTouched('phone')}
                    error={errorFor('phone')}
                    placeholder="Ví dụ: 0912 345 678"
                    hint="Không bắt buộc. Học sinh không tự đổi được số này."
                    autoComplete="off"
                  />
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Tài khoản đăng nhập</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {isEditMode
                      ? 'Học sinh dùng tên đăng nhập này để vào hệ thống. Mật khẩu do học sinh tự đổi trong hồ sơ.'
                      : 'Hãy gửi tên đăng nhập và mật khẩu ban đầu cho học sinh sau khi tạo tài khoản.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StudentTextField
                    label="Tên đăng nhập"
                    icon={AtSign}
                    value={values.username}
                    onChange={value => updateValues({ username: value })}
                    onBlur={() => markTouched('username')}
                    error={errorFor('username')}
                    placeholder="khoa.nm"
                    hint="Ít nhất 3 ký tự, không chứa khoảng trắng."
                    autoComplete="off"
                  />
                  <StudentTextField
                    label="Mã học sinh"
                    icon={Hash}
                    value={values.code}
                    onChange={value => updateValues({ code: value })}
                    onBlur={() => markTouched('code')}
                    error={errorFor('code')}
                    placeholder="HS1001"
                    hint="Mã dùng để phân biệt học sinh, không được trùng."
                    autoComplete="off"
                  />
                  {!isEditMode && (
                    <StudentTextField
                      label="Mật khẩu ban đầu"
                      icon={Lock}
                      type="password"
                      value={values.password}
                      onChange={value => updateValues({ password: value })}
                      onBlur={() => markTouched('password')}
                      error={errorFor('password')}
                      placeholder="Ít nhất 6 ký tự"
                      hint="Học sinh nên đổi mật khẩu ở lần đăng nhập đầu tiên."
                      autoComplete="new-password"
                    />
                  )}
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-slate-100">
                <h2 className="text-base font-bold text-slate-800">Nhóm lớp và trạng thái</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="student-group" className="block text-sm font-semibold text-slate-700 mb-2">
                      Nhóm/lớp
                    </label>
                    <select
                      id="student-group"
                      value={values.groupId}
                      onChange={event => updateValues({ groupId: Number(event.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 bg-white"
                    >
                      {groupChoices.map(choice => (
                        <option key={choice.id} value={choice.id}>{choice.name}</option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Học sinh sẽ nhận bài kiểm tra được giao cho nhóm này.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="student-status" className="block text-sm font-semibold text-slate-700 mb-2">
                      Trạng thái tài khoản
                    </label>
                    {isReadOnly ? (
                      // Ô chọn chỉ có hai lựa chọn khoá/mở khoá; chờ xoá và đã xoá không phải thứ
                      // chọn được ở đây, nên hiện nhãn thay vì một ô chọn mang giá trị lạ.
                      <div id="student-status" className="py-2">
                        <StudentStatusPill status={values.status} deletionScheduledAt={loadedStudent?.deletionScheduledAt} />
                      </div>
                    ) : (
                      <select
                        id="student-status"
                        value={values.status}
                        onChange={event => updateValues({ status: event.target.value as StudentStatus })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 bg-white"
                      >
                        <option value="active">{studentStatusLabels.active}</option>
                        <option value="locked">{studentStatusLabels.locked}</option>
                      </select>
                    )}
                    <p className="mt-1.5 text-xs text-slate-400">
                      Tài khoản bị khoá sẽ không thể đăng nhập và làm bài.
                    </p>
                  </div>
                </div>
              </section>
            </fieldset>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-16" style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }} />
              <div className="px-5 pb-5">
                <div
                  className="w-16 h-16 -mt-9 rounded-2xl border-4 border-white shadow-sm flex items-center justify-center text-white text-lg font-bold"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  {getInitials(values.fullName)}
                </div>
                <p className="mt-3 font-bold text-slate-800 truncate">
                  {values.fullName.trim() || 'Học sinh mới'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600">
                    {values.code.trim() || 'Chưa có mã'}
                  </span>
                  <StudentStatusPill status={values.status} deletionScheduledAt={loadedStudent?.deletionScheduledAt} />
                </div>

                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Nhóm/lớp</dt>
                    <dd className="font-semibold text-slate-700 truncate">{selectedGroupName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="font-semibold text-slate-700 truncate">
                      {values.email.trim() || '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Tên đăng nhập</dt>
                    <dd className="font-semibold text-slate-700 truncate">
                      {values.username.trim() || '—'}
                    </dd>
                  </div>
                  {loadedStudent && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Ngày tạo</dt>
                      <dd className="font-semibold text-slate-700 whitespace-nowrap">
                        {formatDate(loadedStudent.createdAt)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {!isReadOnly && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-base font-bold text-slate-800 mb-3">Kiểm tra nhanh</h2>
                <div className="space-y-2.5 text-sm">
                  {checklist.map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">{item.label}</span>
                      {item.done ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 size={14} /> Hợp lệ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                          <AlertCircle size={14} /> Chưa xong
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadedStudent && !isReadOnly && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-base font-bold text-slate-800">Tài khoản</h2>
                <p className="text-xs text-slate-400 mt-1 mb-3.5">
                  Hai thao tác này có hiệu lực ngay, không cần bấm Lưu.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void handleResetPassword()}
                    disabled={submitting}
                    className={`${accountActionButtonClass} text-indigo-600 bg-indigo-50 hover:bg-indigo-100`}
                  >
                    <KeyRound size={15} /> Cấp lại mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAccountAction(accountActions.requestDeletion(loadedStudent))}
                    disabled={submitting}
                    className={`${accountActionButtonClass} text-red-600 bg-red-50 hover:bg-red-100`}
                  >
                    <Trash2 size={15} /> Xoá tài khoản
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {!isReadOnly && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  {submitting ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                  {submitting ? 'Đang lưu...' : isEditMode ? 'Lưu thay đổi' : 'Tạo học sinh'}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/quan-tri/hoc-sinh')}
                disabled={submitting}
                className="w-full px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-60"
              >
                {isReadOnly ? 'Quay lại danh sách' : 'Huỷ'}
              </button>
            </div>
          </aside>
        </form>
      )}

      {/* Mật khẩu chỉ nằm trong phản hồi của lần cấp lại, không endpoint nào trả lại lần hai — nên
          hộp này là cơ hội duy nhất để chép. */}
      <Modal
        open={issuedPassword !== null}
        title="Mật khẩu mới đã được tạo"
        description={loadedStudent ? `Cho tài khoản ${loadedStudent.fullName} (@${loadedStudent.username})` : undefined}
        size="sm"
        // Chỉ nút "Tôi đã chép lại" mới đóng được hộp. Một cú chạm trượt ra ngoài hay phím ESC mà
        // làm mất mật khẩu thì phải cấp lại lần nữa — và học sinh bị đăng xuất thêm một lần.
        dismissible={false}
        onClose={() => setIssuedPassword(null)}
        footer={
          <button
            type="button"
            onClick={() => setIssuedPassword(null)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
          >
            Tôi đã chép lại
          </button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <code className="flex-1 min-w-0 font-mono text-lg font-bold text-slate-800 tracking-wide break-all select-all">
              {issuedPassword?.password}
            </code>
            <button
              type="button"
              onClick={() => void copyIssuedPassword()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 transition-colors flex-shrink-0"
            >
              <Copy size={14} /> Chép
            </button>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Mật khẩu này chỉ hiện đúng một lần. Đóng hộp thoại, bấm quay lại hay rời trang là không xem lại
            được nữa — khi đó phải cấp mật khẩu mới.
          </p>
          {issuedPassword?.mustChangePassword && (
            <p className="text-sm text-slate-500 leading-relaxed">
              Học sinh sẽ phải đổi mật khẩu ở lần đăng nhập tới.
            </p>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
