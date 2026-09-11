import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { createGroup, updateGroup } from '../../../services/groupService'
import type { StudentGroup } from '../../../types'

/** Chỉ dùng ở khu quản trị: giáo viên không lập và không sửa lớp. */
interface GroupFormModalProps {
  open: boolean
  /** Bỏ trống nghĩa là đang lập lớp mới. */
  group?: StudentGroup
  onClose: () => void
  onSaved: () => void
}

const FORM_ID = 'student-group-form'
const NAME_MAX_LENGTH = 60
const DESCRIPTION_MAX_LENGTH = 200

const fieldLabelClass = 'block text-sm font-semibold text-slate-700 mb-1.5'
const fieldBaseClass =
  'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-4 focus:ring-indigo-50'

export default function GroupFormModal({ open, group, onClose, onSaved }: GroupFormModalProps) {
  const toast = useToast()
  const editingGroup = group
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  // Nạp lại giá trị mỗi lần mở để không giữ nội dung của lần thao tác trước
  useEffect(() => {
    if (!open) return
    setName(editingGroup?.name ?? '')
    setDescription(editingGroup?.description ?? '')
    setNameError(undefined)
    setSaving(false)
  }, [open, editingGroup])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Vui lòng nhập tên lớp.')
      return
    }
    if (trimmedName.length < 2) {
      setNameError('Tên lớp phải có ít nhất 2 ký tự.')
      return
    }

    setNameError(undefined)
    setSaving(true)
    try {
      const payload = { name: trimmedName, description: description.trim() }
      const saved = editingGroup
        ? await updateGroup(editingGroup.id, payload)
        : await createGroup(payload)
      toast.success(
        editingGroup
          ? `Đã cập nhật lớp ${saved.name}.`
          : `Đã lập lớp ${saved.name} ở dạng bản nháp.`,
      )
      onSaved()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không lưu được lớp.'
      setNameError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editingGroup ? 'Sửa thông tin lớp' : 'Lập lớp mới'}
      description={
        editingGroup
          ? 'Đổi tên hoặc mô tả lớp. Học sinh đang thuộc lớp sẽ được cập nhật theo tên mới.'
          : 'Lớp mới được lưu ở dạng bản nháp — chỉ quản trị viên thấy cho tới khi bạn công bố. Xếp học sinh và phân công giáo viên ở trang chi tiết lớp.'
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
            {editingGroup ? 'Lưu thay đổi' : 'Lập lớp'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={fieldLabelClass} htmlFor="group-name">
            Tên lớp <span className="text-red-500">*</span>
          </label>
          <input
            id="group-name"
            value={name}
            onChange={event => {
              setName(event.target.value)
              if (nameError) setNameError(undefined)
            }}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Ví dụ: Lớp 10A"
            className={`${fieldBaseClass} ${
              nameError ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'
            }`}
          />
          {nameError && <p className="text-xs text-red-500 mt-1.5">{nameError}</p>}
        </div>

        <div>
          <label className={fieldLabelClass} htmlFor="group-description">
            Mô tả
          </label>
          <textarea
            id="group-description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX_LENGTH}
            rows={3}
            placeholder="Ghi chú ngắn về chương trình học hoặc mục tiêu của lớp"
            className={`${fieldBaseClass} border-slate-200 focus:border-indigo-400 resize-none leading-relaxed`}
          />
          <p className="text-xs text-slate-400 mt-1.5 text-right">
            {description.length}/{DESCRIPTION_MAX_LENGTH} ký tự
          </p>
        </div>
      </form>
    </Modal>
  )
}
