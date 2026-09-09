// Trang thuộc vai trò quản trị viên: admin sở hữu tài khoản học sinh.
import { useState, type FormEvent } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, AtSign, CheckCircle2, Hash, Loader2, Lock, Mail, Save, User,
} from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import useAsync from '../../../hooks/useAsync'
import { formatDate, getInitials } from '../../../lib/format'
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME, listGroups } from '../../../services/groupService'
import {
  createStudent, getStudent, listStudents, updateStudent, type StudentPayload,
} from '../../../services/studentService'
import StudentStatusPill from '../components/StudentStatusPill'
import StudentTextField from '../components/StudentTextField'
import { studentStatusLabels, type Student, type StudentStatus } from '../../../types'

/** Số bản ghi tải về để kiểm tra trùng mã, email và tên đăng nhập ngay trên giao diện. */
const DIRECTORY_PAGE_SIZE = 500

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FormFieldName = 'fullName' | 'email' | 'username' | 'code' | 'password'

type FormErrors = Partial<Record<FormFieldName, string>>

interface StudentFormValues {
  fullName: string
  email: string
  username: string
  code: string
  groupId: number
  status: StudentStatus
  password: string
}

const emptyValues: StudentFormValues = {
  fullName: '',
  email: '',
  username: '',
  code: '',
  groupId: UNASSIGNED_GROUP_ID,
  status: 'active',
  password: '',
}

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

  const loadedStudent = editorQuery.data?.student ?? null

  const [syncedStudentId, setSyncedStudentId] = useState<number | null>(null)

  // Cùng một component phục vụ cả hai chế độ: khi chuyển sang tạo mới phải xóa sạch
  // dữ liệu của học sinh đang mở trước đó, nếu không form sẽ giữ lại thông tin người cũ.
  if (!isEditMode && syncedStudentId !== null) {
    setSyncedStudentId(null)
    setValues(emptyValues)
    setTouchedFields({})
    setHasSubmitted(false)
  }

  // Đổ dữ liệu vào form ngay trong lúc render để không nháy form rỗng ở khoảnh khắc vừa tải xong.
  if (loadedStudent && loadedStudent.id !== syncedStudentId) {
    setSyncedStudentId(loadedStudent.id)
    setValues({
      fullName: loadedStudent.fullName,
      email: loadedStudent.email,
      username: loadedStudent.username,
      code: loadedStudent.code,
      groupId: loadedStudent.groupId,
      status: loadedStudent.status,
      password: '',
    })
    setTouchedFields({})
    setHasSubmitted(false)
  }

  const groups = editorQuery.data?.groups ?? []
  const existingStudents = editorQuery.data?.existingStudents ?? []
  const errors = validateValues(values, existingStudents, studentId, isEditMode)

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
    setHasSubmitted(true)

    if (Object.keys(errors).length > 0) {
      toast.error('Vui lòng kiểm tra lại các trường còn thiếu hoặc chưa hợp lệ.')
      return
    }

    const payload: StudentPayload = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      username: values.username.trim(),
      code: values.code.trim(),
      groupId: values.groupId,
      status: values.status,
    }

    setSubmitting(true)
    try {
      if (studentId === null) {
        await createStudent(payload)
        toast.success(`Đã thêm học sinh ${payload.fullName}.`)
      } else {
        await updateStudent(studentId, payload)
        toast.success(`Đã lưu thay đổi cho ${payload.fullName}.`)
      }
      navigate('/quan-tri/hoc-sinh')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không lưu được thông tin học sinh.')
      setSubmitting(false)
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

  return (
    <AdminLayout
      pageTitle={isEditMode ? 'Sửa thông tin học sinh' : 'Thêm học sinh'}
      pageSubtitle={
        isEditMode
          ? 'Cập nhật hồ sơ, nhóm lớp và trạng thái tài khoản'
          : 'Tạo tài khoản mới để học sinh đăng nhập và làm bài kiểm tra'
      }
    >
      <div className="mb-5">
        <NavLink
          to="/quan-tri/hoc-sinh"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại danh sách học sinh
        </NavLink>
      </div>

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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
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
                  <select
                    id="student-status"
                    value={values.status}
                    onChange={event => updateValues({ status: event.target.value as StudentStatus })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 bg-white"
                  >
                    <option value="active">{studentStatusLabels.active}</option>
                    <option value="locked">{studentStatusLabels.locked}</option>
                  </select>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Tài khoản bị khóa sẽ không thể đăng nhập và làm bài.
                  </p>
                </div>
              </div>
            </section>
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
                  <StudentStatusPill status={values.status} />
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

            <div className="space-y-2.5">
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
              >
                {submitting ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                {submitting ? 'Đang lưu...' : isEditMode ? 'Lưu thay đổi' : 'Tạo học sinh'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/quan-tri/hoc-sinh')}
                disabled={submitting}
                className="w-full px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-60"
              >
                Hủy
              </button>
            </div>
          </aside>
        </form>
      )}
    </AdminLayout>
  )
}
