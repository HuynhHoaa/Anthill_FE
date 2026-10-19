import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { createGroup, listAssignableTeachers, updateGroup } from '../../../services/groupService'
import { listTerms } from '../../../services/termService'
import type { StudentGroup } from '../../../types'
import { teacherOptionLabel } from './teacherOptions'

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
  const [teacherId, setTeacherId] = useState('')
  const [termId, setTermId] = useState('')
  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [teacherError, setTeacherError] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  // Giáo viên chỉ chọn lúc lập lớp; đổi người sau này làm ở phần Thiết lập của lớp.
  const teachersState = useAsync(() => (open && !editingGroup ? listAssignableTeachers() : Promise.resolve([])), [open, editingGroup])
  const teachers = teachersState.data ?? []
  const activeTeachers = teachers.filter(teacher => teacher.status !== 'locked')

  // Kỳ học (không bắt buộc): lớp chưa phân kỳ vẫn hoạt động, học sinh thấy ở mục "Chưa phân kỳ".
  const termsState = useAsync(() => (open ? listTerms() : Promise.resolve([])), [open])
  const terms = termsState.data ?? []

  // Nạp lại giá trị mỗi lần mở để không giữ nội dung của lần thao tác trước
  useEffect(() => {
    if (!open) return
    setName(editingGroup?.name ?? '')
    setDescription(editingGroup?.description ?? '')
    setTeacherId('')
    setTermId(editingGroup?.termId ? String(editingGroup.termId) : '')
    setNameError(undefined)
    setTeacherError(undefined)
    setSaving(false)
  }, [open, editingGroup])

  // Chỉ có một giáo viên dùng được thì chọn sẵn, đỡ một cú bấm vô nghĩa.
  useEffect(() => {
    if (!editingGroup && teacherId === '' && activeTeachers.length === 1) setTeacherId(String(activeTeachers[0].id))
  }, [editingGroup, teacherId, activeTeachers])

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

    if (!editingGroup && teacherId === '') {
      setTeacherError('Hãy chọn giáo viên phụ trách lớp.')
      return
    }

    setNameError(undefined)
    setTeacherError(undefined)
    setSaving(true)
    try {
      const payload = { name: trimmedName, description: description.trim(), termId: termId === '' ? null : Number(termId) }
      const saved = editingGroup
        ? await updateGroup(editingGroup.id, payload)
        : await createGroup({ ...payload, teacherId: Number(teacherId) })
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
          : 'Lớp mới được lưu ở dạng bản nháp — chỉ quản trị viên thấy cho tới khi bạn công bố. Xếp học sinh ở trang chi tiết lớp.'
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

        {!editingGroup && (
          <div>
            <label className={fieldLabelClass} htmlFor="group-teacher">
              Giáo viên phụ trách <span className="text-red-500">*</span>
            </label>
            <select
              id="group-teacher"
              value={teacherId}
              onChange={event => {
                setTeacherId(event.target.value)
                if (teacherError) setTeacherError(undefined)
              }}
              disabled={saving || teachersState.loading}
              className={`${fieldBaseClass} bg-white ${
                teacherError ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'
              }`}
            >
              <option value="">{teachersState.loading ? 'Đang tải danh sách giáo viên…' : 'Chọn giáo viên'}</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id} disabled={teacher.status === 'locked'}>
                  {teacherOptionLabel(teacher)}
                </option>
              ))}
            </select>
            {teacherError && <p className="text-xs text-red-500 mt-1.5">{teacherError}</p>}
            {teachersState.error && <p className="text-xs text-red-500 mt-1.5">{teachersState.error}</p>}
            {!teachersState.loading && !teachersState.error && activeTeachers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">Chưa có giáo viên nào dùng được để phụ trách lớp.</p>
            )}
            <p className="text-xs text-slate-400 mt-1.5">
              Mỗi lớp có đúng một giáo viên. Đổi giáo viên giữa chừng phải ghi lý do và được lưu vào lịch sử của lớp.
            </p>
          </div>
        )}

        <div>
          <label className={fieldLabelClass} htmlFor="group-term">
            Kỳ học <span className="font-normal text-slate-400">(không bắt buộc)</span>
          </label>
          <select
            id="group-term"
            value={termId}
            onChange={event => setTermId(event.target.value)}
            disabled={saving || termsState.loading}
            className={`${fieldBaseClass} bg-white border-slate-200 focus:border-indigo-400`}
          >
            <option value="">{termsState.loading ? 'Đang tải danh sách kỳ…' : 'Chưa phân kỳ'}</option>
            {terms.map(term => (
              <option key={term.id} value={term.id}>{term.isCurrent ? `${term.name} (kỳ hiện tại)` : term.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1.5">
            Thêm hoặc sửa kỳ ở mục Kỳ học trên menu.
          </p>
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
