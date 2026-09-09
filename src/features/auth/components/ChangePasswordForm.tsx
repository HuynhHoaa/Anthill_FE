import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { useToast } from '../../../components/common/Toast'
import { changePassword } from '../../../services/authService'

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type PasswordFieldErrors = Partial<Record<keyof PasswordFormValues, string>>

const emptyValues: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const minPasswordLength = 6

function validatePasswordForm(values: PasswordFormValues): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {}

  if (!values.currentPassword) {
    errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.'
  }

  if (!values.newPassword) {
    errors.newPassword = 'Vui lòng nhập mật khẩu mới.'
  } else if (values.newPassword.length < minPasswordLength) {
    errors.newPassword = `Mật khẩu mới phải có ít nhất ${minPasswordLength} ký tự.`
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới.'
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'Hai mật khẩu chưa khớp nhau.'
  }

  return errors
}

interface PasswordFieldProps {
  id: string
  label: string
  placeholder: string
  autoComplete: string
  value: string
  error?: string
  onChange: (value: string) => void
}

function PasswordField({ id, label, placeholder, autoComplete, value, error, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none transition-all ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-50'
              : 'border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'
          }`}
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          onClick={() => setVisible(current => !current)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  )
}

export default function ChangePasswordForm() {
  const toast = useToast()
  const [values, setValues] = useState<PasswordFormValues>(emptyValues)
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({})
  const [saving, setSaving] = useState(false)

  const changeValue = (field: keyof PasswordFormValues, value: string) => {
    setValues(current => ({ ...current, [field]: value }))
    setFieldErrors(current => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validatePasswordForm(values)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      setValues(emptyValues)
      toast.success('Đổi mật khẩu thành công.')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không đổi được mật khẩu. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center flex-shrink-0">
          <KeyRound size={19} className="text-violet-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Đổi mật khẩu</h2>
          <p className="text-sm text-slate-500">Nên đổi mật khẩu định kỳ để giữ an toàn tài khoản.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <PasswordField
          id="current-password"
          label="Mật khẩu hiện tại"
          placeholder="Nhập mật khẩu đang dùng"
          autoComplete="current-password"
          value={values.currentPassword}
          error={fieldErrors.currentPassword}
          onChange={value => changeValue('currentPassword', value)}
        />
        <PasswordField
          id="new-password"
          label="Mật khẩu mới"
          placeholder={`Ít nhất ${minPasswordLength} ký tự`}
          autoComplete="new-password"
          value={values.newPassword}
          error={fieldErrors.newPassword}
          onChange={value => changeValue('newPassword', value)}
        />
        <PasswordField
          id="confirm-password"
          label="Xác nhận mật khẩu mới"
          placeholder="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={value => changeValue('confirmPassword', value)}
        />

        <p className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
          <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
          Mật khẩu nên gồm chữ hoa, chữ thường và số để khó đoán hơn.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
        >
          <KeyRound size={15} />
          {saving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
        </button>
      </form>
    </section>
  )
}
