import { useState, type FormEvent } from 'react'
import { Lock, Save, UserRound } from 'lucide-react'
import { useToast } from '../../../components/common/Toast'
import { updateProfile } from '../../../services/authService'
import type { UserProfile } from '../../../types'

interface ProfileInfoFormProps {
  profile: UserProfile
  onSaved: (profile: UserProfile) => void
}

interface ProfileFormValues {
  fullName: string
  email: string
  phone: string
}

type ProfileFieldErrors = Partial<Record<keyof ProfileFormValues, string>>

/** Trường nào của hồ sơ người dùng này không tự sửa được (do nhà trường — quản trị viên — quản lý). */
interface LockedFields {
  /** Họ tên: chỉ học sinh bị khoá. */
  name: boolean
  /** Email và số điện thoại: giáo viên và học sinh đều bị khoá. */
  contact: boolean
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[0-9\s.+-]{9,15}$/

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'
const errorInputClass =
  'w-full px-4 py-2.5 rounded-xl border border-red-300 text-sm outline-none transition-all focus:border-red-400 focus:ring-4 focus:ring-red-50'
const readOnlyClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed'

function buildInitialValues(profile: UserProfile): ProfileFormValues {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone ?? '',
  }
}

function validateProfileForm(values: ProfileFormValues, locked: LockedFields): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}

  // Ô chỉ để xem thì không có gì để kiểm.
  if (!locked.name && !values.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ và tên.'
  }

  if (!locked.contact) {
    const email = values.email.trim()
    if (!email) {
      errors.email = 'Vui lòng nhập email.'
    } else if (!emailPattern.test(email)) {
      errors.email = 'Email chưa đúng định dạng.'
    }

    const phone = values.phone.trim()
    if (phone && !phonePattern.test(phone)) {
      errors.phone = 'Số điện thoại chỉ gồm chữ số và dài 9–15 ký tự.'
    }
  }

  return errors
}

export default function ProfileInfoForm({ profile, onSaved }: ProfileInfoFormProps) {
  const toast = useToast()
  const [values, setValues] = useState<ProfileFormValues>(() => buildInitialValues(profile))
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [saving, setSaving] = useState(false)

  const isTeacher = profile.role === 'teacher'
  const isStudent = profile.role === 'student'
  const isAdmin = profile.role === 'admin'

  // Thông tin liên hệ thuộc về nhà trường: quản trị viên sửa được tất cả, giáo viên chỉ sửa họ tên, học sinh
  // không sửa được trường nào (server cũng chặn, đây chỉ là để giao diện không mời người ta làm việc không được).
  const locked: LockedFields = { name: isStudent, contact: !isAdmin }
  const hasEditableField = !locked.name || !locked.contact

  const changeValue = (field: keyof ProfileFormValues, value: string) => {
    setValues(current => ({ ...current, [field]: value }))
    setFieldErrors(current => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!hasEditableField) return

    const nextErrors = validateProfileForm(values, locked)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    // Trường bị khoá gửi lại đúng giá trị server đang giữ: server chỉ nhận ba trường nguyên văn và từ chối
    // giá trị khác đi.
    const payload: Partial<UserProfile> = {
      fullName: locked.name ? profile.fullName : values.fullName.trim(),
      email: locked.contact ? profile.email : values.email.trim(),
      phone: locked.contact ? (profile.phone ?? '') : values.phone.trim(),
    }

    setSaving(true)
    try {
      const updated = await updateProfile(payload)
      onSaved(updated)
      setValues(buildInitialValues(updated))
      toast.success('Đã lưu thông tin cá nhân.')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không lưu được thông tin. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setValues(buildInitialValues(profile))
    setFieldErrors({})
  }

  const fullNameField = (
    <div>
      <label htmlFor="profile-full-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
        Họ và tên {!locked.name && <span className="text-red-500">*</span>}
      </label>
      <input
        id="profile-full-name"
        type="text"
        className={locked.name ? readOnlyClass : fieldErrors.fullName ? errorInputClass : inputClass}
        placeholder="Nguyễn Văn An"
        value={values.fullName}
        readOnly={locked.name}
        aria-invalid={Boolean(fieldErrors.fullName)}
        onChange={event => changeValue('fullName', event.target.value)}
      />
      {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.fullName}</p>}
    </div>
  )

  const emailField = (
    <div>
      <label htmlFor="profile-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
        Email {!locked.contact && <span className="text-red-500">*</span>}
      </label>
      <input
        id="profile-email"
        type="email"
        className={locked.contact ? readOnlyClass : fieldErrors.email ? errorInputClass : inputClass}
        placeholder="ten@truong.edu.vn"
        value={values.email}
        readOnly={locked.contact}
        aria-invalid={Boolean(fieldErrors.email)}
        onChange={event => changeValue('email', event.target.value)}
      />
      {fieldErrors.email && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.email}</p>}
    </div>
  )

  const phoneField = (
    <div>
      <label htmlFor="profile-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
        Số điện thoại
      </label>
      <input
        id="profile-phone"
        type="tel"
        className={locked.contact ? readOnlyClass : fieldErrors.phone ? errorInputClass : inputClass}
        placeholder={locked.contact ? 'Chưa có số điện thoại' : 'Ví dụ: 0912 345 678'}
        value={values.phone}
        readOnly={locked.contact}
        aria-invalid={Boolean(fieldErrors.phone)}
        onChange={event => changeValue('phone', event.target.value)}
      />
      {fieldErrors.phone && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.phone}</p>}
    </div>
  )

  const subjectField = (
    <div>
      <label htmlFor="profile-subject" className="block text-sm font-semibold text-slate-700 mb-1.5">
        Môn giảng dạy
      </label>
      <input
        id="profile-subject"
        type="text"
        className={readOnlyClass}
        value={profile.subject ?? 'Chưa được gán môn'}
        readOnly
      />
    </div>
  )

  const codeField = (
    <div>
      <label htmlFor="profile-code" className="block text-sm font-semibold text-slate-700 mb-1.5">
        Mã học sinh
      </label>
      <input id="profile-code" type="text" className={readOnlyClass} value={profile.code ?? 'Chưa được cấp'} readOnly />
    </div>
  )

  const groupField = (
    <div>
      <label htmlFor="profile-group" className="block text-sm font-semibold text-slate-700 mb-1.5">
        Lớp
      </label>
      <input id="profile-group" type="text" className={readOnlyClass} value={profile.group ?? 'Chưa xếp lớp'} readOnly />
    </div>
  )

  const lockNote = isStudent
    ? 'Họ tên, email, số điện thoại, mã học sinh và lớp do quản trị viên quản lý nên bạn không tự sửa được. Cần đổi thì liên hệ quản trị viên.'
    : isTeacher
      ? 'Email, số điện thoại và môn giảng dạy do quản trị viên quản lý nên bạn không tự sửa được. Cần đổi thì liên hệ quản trị viên.'
      : null

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <UserRound size={19} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Thông tin cá nhân</h2>
          <p className="text-sm text-slate-500">
            {hasEditableField
              ? 'Cập nhật thông tin hiển thị trong hệ thống.'
              : 'Thông tin tài khoản do nhà trường quản lý.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fullNameField}
          {emailField}
          {phoneField}
          {isTeacher && subjectField}
          {isStudent && codeField}
          {isStudent && groupField}
        </div>

        {lockNote && (
          <p className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
            <Lock size={14} className="flex-shrink-0 mt-0.5" />
            {lockNote}
          </p>
        )}

        {hasEditableField && (
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              <Save size={15} />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              Hoàn tác
            </button>
          </div>
        )}
      </form>
    </section>
  )
}
