import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { createTerm, updateTerm } from '../../../services/termService'
import type { AcademicTerm } from '../../../types'

interface TermFormModalProps {
  open: boolean
  /** Bỏ trống nghĩa là đang thêm kỳ mới. */
  term?: AcademicTerm
  onClose: () => void
  onSaved: () => void
}

const FORM_ID = 'term-form'
const NAME_MAX_LENGTH = 100

const fieldLabelClass = 'block text-sm font-semibold text-slate-700 mb-1.5'
const fieldBaseClass =
  'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-4 focus:ring-indigo-50'

/** `yyyy-MM-dd` → `dd/mm/yyyy` để gõ và đọc; rỗng khi chưa có. */
function toDisplay(iso?: string): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

/** `dd/mm/yyyy` → `yyyy-MM-dd`; `undefined` khi chưa nhập đủ hoặc ngày không có thật. */
function toIso(text: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!match) return undefined

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return undefined

  return `${match[3]}-${match[2]}-${match[1]}`
}

/** Chỉ giữ chữ số rồi chèn dấu `/`: gõ `01092026` ra `01/09/2026`. Không dùng ô ngày gốc của trình duyệt. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

export default function TermFormModal({ open, term, onClose, onSaved }: TermFormModalProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; startsOn?: string; endsOn?: string }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(term?.name ?? '')
    setStartsOn(toDisplay(term?.startsOn))
    setEndsOn(toDisplay(term?.endsOn))
    setIsCurrent(term?.isCurrent ?? false)
    setErrors({})
    setSaving(false)
  }, [open, term])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const nextErrors: typeof errors = {}
    if (!name.trim()) nextErrors.name = 'Vui lòng nhập tên kỳ học.'
    const startIso = startsOn ? toIso(startsOn) : undefined
    const endIso = endsOn ? toIso(endsOn) : undefined
    if (startsOn && !startIso) nextErrors.startsOn = 'Ngày chưa đúng, nhập dạng 01/09/2026.'
    if (endsOn && !endIso) nextErrors.endsOn = 'Ngày chưa đúng, nhập dạng 31/12/2026.'
    if (startIso && endIso && endIso < startIso) nextErrors.endsOn = 'Ngày kết thúc phải sau hoặc cùng ngày bắt đầu.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const payload = { name: name.trim(), startsOn: startIso ?? null, endsOn: endIso ?? null, isCurrent }
      const saved = term ? await updateTerm(term.id, payload) : await createTerm(payload)
      toast.success(term ? `Đã cập nhật kỳ ${saved.name}.` : `Đã thêm kỳ ${saved.name}.`)
      onSaved()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không lưu được kỳ học.'
      setErrors({ name: message })
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={term ? 'Sửa kỳ học' : 'Thêm kỳ học'}
      description="Kỳ học gom các lớp theo thời gian: học kỳ ở đại học, hay cấp lớp (Lớp 11, Lớp 12) ở phổ thông. Học sinh lọc lớp và bảng điểm theo kỳ."
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
            style={{ background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {term ? 'Lưu thay đổi' : 'Thêm kỳ'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={fieldLabelClass} htmlFor="term-name">
            Tên kỳ <span className="text-red-500">*</span>
          </label>
          <input
            id="term-name"
            value={name}
            onChange={event => {
              setName(event.target.value)
              if (errors.name) setErrors(current => ({ ...current, name: undefined }))
            }}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Ví dụ: Học kỳ 1 · 2026–2027, hoặc Lớp 11"
            className={`${fieldBaseClass} ${errors.name ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass} htmlFor="term-starts">
              Bắt đầu <span className="font-normal text-slate-400">(không bắt buộc)</span>
            </label>
            <input
              id="term-starts"
              value={startsOn}
              onChange={event => {
                setStartsOn(maskDate(event.target.value))
                if (errors.startsOn) setErrors(current => ({ ...current, startsOn: undefined }))
              }}
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              className={`${fieldBaseClass} ${errors.startsOn ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
            />
            {errors.startsOn && <p className="text-xs text-red-500 mt-1.5">{errors.startsOn}</p>}
          </div>
          <div>
            <label className={fieldLabelClass} htmlFor="term-ends">
              Kết thúc <span className="font-normal text-slate-400">(không bắt buộc)</span>
            </label>
            <input
              id="term-ends"
              value={endsOn}
              onChange={event => {
                setEndsOn(maskDate(event.target.value))
                if (errors.endsOn) setErrors(current => ({ ...current, endsOn: undefined }))
              }}
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              className={`${fieldBaseClass} ${errors.endsOn ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}
            />
            {errors.endsOn && <p className="text-xs text-red-500 mt-1.5">{errors.endsOn}</p>}
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={event => setIsCurrent(event.target.checked)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
          />
          <span className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold">Kỳ hiện tại</span>
            <span className="block text-xs text-slate-400">Học sinh mở sẵn kỳ này. Chỉ một kỳ là hiện tại: chọn ở đây thì kỳ đang hiện tại tự thôi.</span>
          </span>
        </label>
      </form>
    </Modal>
  )
}
