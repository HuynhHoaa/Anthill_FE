import { useId } from 'react'
import { AlertCircle, type LucideIcon } from 'lucide-react'

interface StudentTextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'tel'
  icon?: LucideIcon
  autoComplete?: string
}

export default function StudentTextField({
  label, value, onChange, onBlur, error, hint, placeholder, type = 'text', icon: Icon, autoComplete,
}: StudentTextFieldProps) {
  const inputId = useId()
  const hasError = Boolean(error)

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700 mb-2">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={event => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={hasError}
          className={`w-full ${Icon ? 'pl-10 pr-4' : 'px-4'} py-2.5 rounded-xl border text-sm outline-none transition-colors ${
            hasError
              ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-50'
              : 'border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'
          }`}
        />
      </div>
      {hasError ? (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} className="flex-shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}
