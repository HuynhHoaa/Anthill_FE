import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import UserAvatar from '../../../components/common/UserAvatar'
import { useToast } from '../../../components/common/Toast'
import { getInitials } from '../../../lib/format'
import { updateAvatar } from '../../../services/authService'
import { checkImageFile, IMAGE_UPLOAD_EXTENSIONS, IMAGE_UPLOAD_TYPES, uploadImage } from '../../../services/uploadService'
import type { UserProfile } from '../../../types'

const ACCEPT_ATTRIBUTE = [...IMAGE_UPLOAD_TYPES, ...IMAGE_UPLOAD_EXTENSIONS].join(',')

interface AvatarEditorProps {
  profile: UserProfile
  onSaved: (profile: UserProfile) => void
}

/**
 * Ảnh đại diện lớn ở đầu trang hồ sơ. Bấm vào **cả khung ảnh** để chọn tệp, hoặc kéo một ảnh thả vào khung; có nút gỡ ảnh.
 *
 * Giáo viên và quản trị viên tự đổi ảnh của mình; học sinh chỉ xem (hồ sơ học sinh do nhà trường quản lý, và server cũng
 * từ chối). Luồng như ảnh câu hỏi: tải ảnh lên trước, nhận đường dẫn, rồi gửi đường dẫn đó làm ảnh đại diện.
 */
export default function AvatarEditor({ profile, onSaved }: AvatarEditorProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const canChange = profile.role !== 'student'

  const avatar = (
    <UserAvatar
      avatarUrl={profile.avatarUrl}
      initials={getInitials(profile.fullName)}
      className="w-20 h-20 rounded-3xl text-2xl shadow-sm"
      style={{ background: `linear-gradient(135deg, ${profile.avatarColor}, #8B5CF6)` }}
    />
  )

  if (!canChange) {
    return <div className="flex-shrink-0">{avatar}</div>
  }

  const save = async (avatarUrl: string | null, successMessage: string) => {
    const updated = await updateAvatar(avatarUrl)
    onSaved(updated)
    toast.success(successMessage)
  }

  const processFile = async (file: File) => {
    const problem = checkImageFile(file)
    if (problem) {
      toast.error(problem)
      return
    }

    setBusy(true)
    try {
      const uploaded = await uploadImage(file)
      await save(uploaded.url, 'Đã đổi ảnh đại diện.')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không đổi được ảnh đại diện. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Xoá giá trị để chọn lại đúng tệp vừa rồi vẫn kích hoạt onChange.
    event.target.value = ''
    if (file) void processFile(file)
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setDragging(false)
    if (busy) return

    const files = event.dataTransfer.files
    if (files.length > 1) {
      toast.error('Chỉ thả một ảnh vào khung.')
      return
    }
    const file = files[0]
    if (file) void processFile(file)
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      await save(null, 'Đã gỡ ảnh đại diện.')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không gỡ được ảnh đại diện. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-28">
      {/* Cả khung là một nút: bấm để chọn ảnh, kéo ảnh thả vào để đổi. Phần tử con không nhận sự kiện chuột/kéo
          (pointer-events-none) để dragenter/dragleave không nháy khi con trỏ đi qua ảnh bên trong. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={event => {
          event.preventDefault()
          if (!dragging) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={busy}
        title="Bấm để chọn ảnh, hoặc kéo ảnh thả vào đây"
        aria-label="Đổi ảnh đại diện"
        className={`group relative w-20 h-20 rounded-3xl transition-shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-wait [&>*]:pointer-events-none ${
          dragging ? 'ring-4 ring-indigo-300 ring-offset-2' : 'hover:ring-4 hover:ring-indigo-100'
        }`}
      >
        {avatar}

        <span
          className={`absolute inset-0 rounded-3xl bg-slate-900/55 text-white flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-opacity ${
            dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          <Camera size={18} />
          {dragging ? 'Thả ảnh vào' : 'Đổi ảnh'}
        </span>

        {busy && (
          <span className="absolute inset-0 rounded-3xl bg-white/75 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-indigo-600" />
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleInputChange}
        className="hidden"
        aria-label="Chọn ảnh đại diện"
      />

      <p className="text-[11px] text-slate-400 text-center leading-tight">Bấm hoặc kéo ảnh vào khung</p>

      {profile.avatarUrl && (
        <button
          type="button"
          onClick={() => void handleRemove()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-60"
        >
          <Trash2 size={12} /> Gỡ ảnh
        </button>
      )}
    </div>
  )
}
