import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Dices, Loader2 } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { listSubjects } from '../../../services/questionService'
import { createTeacher, updateTeacher, type Teacher } from '../../../services/teacherService'

interface TeacherFormModalProps {
  open: boolean
  /** Bỏ trống nghĩa là đang thêm giáo viên mới. */
  teacher?: Teacher
  onClose: () => void
  onSaved: (teacher: Teacher) => void
}

const FORM_ID = 'teacher-form'
const MIN_PASSWORD_LENGTH = 6
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5'
const fieldClass =
  'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-4 focus:ring-indigo-50'

/** Mật khẩu ngẫu nhiên cùng bảng ký tự với server (bỏ các ký tự dễ nhầm: 0/O, 1/l/I). */
function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, value => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('')
}

type FieldKey = 'fullName' | 'email' | 'phone' | 'subject' | 'password'

/**
 * Thêm hoặc sửa tài khoản giáo viên. Email cũng là tên đăng nhập. Mật khẩu ban đầu chỉ có khi thêm: giáo viên bị ép đổi nó
 * ở lần đăng nhập đầu, còn quên mật khẩu thì quản trị viên cấp lại từ hồ sơ.
 */
export default function TeacherFormModal({ open, teacher, onClose, onSaved }: TeacherFormModalProps) {
  const toast = useToast()
  const formId = useId()
  const isEdit = teacher !== undefined

  const subjectsState = useAsync(() => (open ? listSubjects() : Promise.resolve([])), [open])
  const subjects = useMemo(() => subjectsState.data ?? [], [subjectsState.data])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [saving, setSaving] = useState(false)

  // Nạp lại giá trị mỗi lần mở để không giữ nội dung của lần thao tác trước.
  useEffect(() => {
    if (!open) return
    setFullName(teacher?.fullName ?? '')
    setEmail(teacher?.email ?? '')
    setPhone(teacher?.phone ?? '')
    setSubjectId(teacher?.subjectId !== undefined ? String(teacher.subjectId) : '')
    setPassword('')
    setErrors({})
    setSaving(false)
  }, [open, teacher])

  // Chỉ có một môn thì chọn sẵn, đỡ một cú bấm vô nghĩa.
  useEffect(() => {
    if (open && subjectId === '' && subjects.length === 1) setSubjectId(String(subjects[0].id))
  }, [open, subjectId, subjects])

  const clearError = (key: FieldKey) => setErrors(current => (current[key] ? { ...current, [key]: undefined } : current))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const next: Partial<Record<FieldKey, string>> = {}
    if (fullName.trim().length === 0) next.fullName = 'Vui lòng nhập họ và tên.'
    if (email.trim().length === 0) next.email = 'Vui lòng nhập email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Email không đúng định dạng.'
    if (phone.trim() === '') next.phone = 'Vui lòng nhập số điện thoại.'
    else if (!/^[0-9+() .-]{9,20}$/.test(phone.trim())) next.phone = 'Số điện thoại không hợp lệ.'
    if (subjectId === '') next.subject = 'Hãy chọn môn giảng dạy.'
    if (!isEdit && password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Mật khẩu ban đầu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subjectId: Number(subjectId),
      }
      const saved = teacher
        ? await updateTeacher(teacher.id, payload)
        : await createTeacher({ ...payload, password })
      toast.success(isEdit ? `Đã cập nhật hồ sơ ${saved.fullName}.` : `Đã thêm giáo viên ${saved.fullName}.`)
      onSaved(saved)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không lưu được giáo viên.'
      // Email trùng hay đổi môn bị từ chối là lỗi của một ô cụ thể: hiện ngay dưới ô đó chứ không chỉ ở toast.
      if (/email/i.test(message)) setErrors({ email: message })
      else if (/môn/i.test(message)) setErrors({ subject: message })
      toast.error(message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Sửa thông tin giáo viên' : 'Thêm giáo viên'}
      description={
        isEdit
          ? 'Email cũng là tên đăng nhập của giáo viên. Đổi môn chỉ làm được khi giáo viên chưa soạn câu hỏi hay đề nào.'
          : 'Nhà trường cấp tài khoản: giáo viên đăng nhập bằng email và bị ép đổi mật khẩu ở lần đầu.'
      }
      onClose={() => {
        if (!saving) onClose()
      }}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Lưu thay đổi' : 'Thêm giáo viên'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${formId}-name`}>
            Họ và tên <span className="text-red-500">*</span>
          </label>
          <input
            id={`${formId}-name`}
            value={fullName}
            onChange={event => {
              setFullName(event.target.value)
              clearError('fullName')
            }}
            autoComplete="off"
            placeholder="Ví dụ: Nguyễn Thị Lan"
            className={`${fieldClass} ${errors.fullName ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1.5">{errors.fullName}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor={`${formId}-email`}>
            Email (tên đăng nhập) <span className="text-red-500">*</span>
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            value={email}
            onChange={event => {
              setEmail(event.target.value)
              clearError('email')
            }}
            autoComplete="off"
            placeholder="lan.nt@truong.edu.vn"
            className={`${fieldClass} ${errors.email ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor={`${formId}-phone`}>
            Số điện thoại <span className="text-red-500">*</span>
          </label>
          <input
            id={`${formId}-phone`}
            type="tel"
            value={phone}
            onChange={event => {
              setPhone(event.target.value)
              clearError('phone')
            }}
            autoComplete="off"
            placeholder="Ví dụ: 0912 345 678"
            className={`${fieldClass} ${errors.phone ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1.5">{errors.phone}</p>}
        </div>

        <div className={isEdit ? 'sm:col-span-2' : ''}>
          <label className={labelClass} htmlFor={`${formId}-subject`}>
            Môn giảng dạy <span className="text-red-500">*</span>
          </label>
          <select
            id={`${formId}-subject`}
            value={subjectId}
            onChange={event => {
              setSubjectId(event.target.value)
              clearError('subject')
            }}
            disabled={subjectsState.loading}
            className={`${fieldClass} bg-white ${errors.subject ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
          >
            <option value="">{subjectsState.loading ? 'Đang tải danh sách môn…' : 'Chọn môn'}</option>
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
          {errors.subject && <p className="text-xs text-red-500 mt-1.5">{errors.subject}</p>}
          {subjectsState.error && <p className="text-xs text-red-500 mt-1.5">{subjectsState.error}</p>}
        </div>

        {!isEdit && (
          <div>
            <label className={labelClass} htmlFor={`${formId}-password`}>
              Mật khẩu ban đầu <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id={`${formId}-password`}
                value={password}
                onChange={event => {
                  setPassword(event.target.value)
                  clearError('password')
                }}
                autoComplete="new-password"
                placeholder={`Ít nhất ${MIN_PASSWORD_LENGTH} ký tự`}
                className={`${fieldClass} ${errors.password ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
              />
              <button
                type="button"
                onClick={() => {
                  setPassword(generatePassword())
                  clearError('password')
                }}
                title="Tạo mật khẩu ngẫu nhiên"
                aria-label="Tạo mật khẩu ngẫu nhiên"
                className="w-11 flex-shrink-0 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <Dices size={17} />
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}
            <p className="text-xs text-slate-400 mt-1.5">Chép lại mật khẩu trước khi lưu để trao cho giáo viên.</p>
          </div>
        )}
      </form>
    </Modal>
  )
}
