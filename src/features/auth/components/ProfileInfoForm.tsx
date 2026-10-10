import { useState, type FormEvent } from 'react'
import { IdCard, Save, School, UserRound } from 'lucide-react'
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
  school: string
  subject: string
}

type ProfileFieldErrors = Partial<Record<keyof ProfileFormValues, string>>

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
    school: profile.school ?? '',
    subject: profile.subject ?? '',
  }
}

function validateProfileForm(values: ProfileFormValues, identityLocked: boolean): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}

  // Họ tên và email của học sinh do quản trị viên giữ, ô chỉ để xem nên không có gì để kiểm.
  if (!identityLocked) {
    if (!values.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ và tên.'
    }

    const email = values.email.trim()
    if (!email) {
      errors.email = 'Vui lòng nhập email.'
    } else if (!emailPattern.test(email)) {
      errors.email = 'Email chưa đúng định dạng.'
    }
  }

  const phone = values.phone.trim()
  if (phone && !phonePattern.test(phone)) {
    errors.phone = 'Số điện thoại chỉ gồm chữ số và dài 9–15 ký tự.'
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

  const changeValue = (field: keyof ProfileFormValues, value: string) => {
    setValues(current => ({ ...current, [field]: value }))
    setFieldErrors(current => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateProfileForm(values, isStudent)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    // Học sinh gửi lại đúng giá trị server đang giữ: server chỉ nhận họ tên và email nguyên văn.
    const payload: Partial<UserProfile> = {
      fullName: isStudent ? profile.fullName : values.fullName.trim(),
      email: isStudent ? profile.email : values.email.trim(),
      phone: values.phone.trim(),
      school: values.school.trim(),
    }
    if (isTeacher) {
      payload.subject = values.subject.trim()
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

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <UserRound size={19} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Thông tin cá nhân</h2>
          <p className="text-sm text-slate-500">Cập nhật thông tin liên hệ hiển thị trong hệ thống.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-full-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Họ và tên {!isStudent && <span className="text-red-500">*</span>}
            </label>
            <input
              id="profile-full-name"
              type="text"
              className={isStudent ? readOnlyClass : fieldErrors.fullName ? errorInputClass : inputClass}
              placeholder="Nguyễn Văn An"
              value={values.fullName}
              readOnly={isStudent}
              aria-invalid={Boolean(fieldErrors.fullName)}
              onChange={event => changeValue('fullName', event.target.value)}
            />
            {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.fullName}</p>}
          </div>

          <div>
            <label htmlFor="profile-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Email {!isStudent && <span className="text-red-500">*</span>}
            </label>
            <input
              id="profile-email"
              type="email"
              className={isStudent ? readOnlyClass : fieldErrors.email ? errorInputClass : inputClass}
              placeholder="ten@truong.edu.vn"
              value={values.email}
              readOnly={isStudent}
              aria-invalid={Boolean(fieldErrors.email)}
              onChange={event => changeValue('email', event.target.value)}
            />
            {fieldErrors.email && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="profile-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Số điện thoại
            </label>
            <input
              id="profile-phone"
              type="tel"
              className={fieldErrors.phone ? errorInputClass : inputClass}
              placeholder="0912 345 678"
              value={values.phone}
              aria-invalid={Boolean(fieldErrors.phone)}
              onChange={event => changeValue('phone', event.target.value)}
            />
            {fieldErrors.phone && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.phone}</p>}
          </div>

          <div>
            <label htmlFor="profile-school" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Trường
            </label>
            <input
              id="profile-school"
              type="text"
              className={inputClass}
              placeholder="Trường THPT Nguyễn Du"
              value={values.school}
              onChange={event => changeValue('school', event.target.value)}
            />
          </div>

          {isTeacher && (
            <div className="md:col-span-2">
              <label htmlFor="profile-subject" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Môn giảng dạy
              </label>
              <input
                id="profile-subject"
                type="text"
                className={inputClass}
                placeholder="Khoa học tự nhiên"
                value={values.subject}
                onChange={event => changeValue('subject', event.target.value)}
              />
            </div>
          )}

          {isStudent && (
            <>
              <div>
                <label htmlFor="profile-code" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Mã học sinh
                </label>
                <input
                  id="profile-code"
                  type="text"
                  className={readOnlyClass}
                  value={profile.code ?? 'Chưa được cấp'}
                  readOnly
                />
              </div>
              <div>
                <label htmlFor="profile-group" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Lớp
                </label>
                <input
                  id="profile-group"
                  type="text"
                  className={readOnlyClass}
                  value={profile.group ?? 'Chưa xếp lớp'}
                  readOnly
                />
              </div>
            </>
          )}
        </div>

        {isStudent && (
          <p className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
            <IdCard size={14} className="flex-shrink-0 mt-0.5" />
            Họ tên, email, mã học sinh và lớp do quản trị viên quản lý nên bạn không tự sửa được. Cần đổi thì liên hệ quản trị viên.
          </p>
        )}
        {isTeacher && (
          <p className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
            <School size={14} className="flex-shrink-0 mt-0.5" />
            Thông tin này hiển thị cho học sinh khi bạn giao bài kiểm tra.
          </p>
        )}

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
      </form>
    </section>
  )
}
