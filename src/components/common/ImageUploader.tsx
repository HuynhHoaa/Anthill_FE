import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { resolveMediaUrl } from '../../lib/apiClient'
import {
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_TYPES,
  checkImageFile,
  uploadImage,
} from '../../services/uploadService'

interface ImageUploaderProps {
  /** Đường dẫn server đã cấp cho ảnh, đúng như lưu trong câu hỏi. */
  value?: string
  onChange: (url: string | undefined) => void
  /**
   * Báo khi bắt đầu và khi xong một lượt tải. Form phải chặn nút lưu trong lúc đó: lưu giữa chừng là
   * gửi câu hỏi thiếu ảnh giáo viên vừa chọn, hoặc còn giữ ảnh cũ mà họ tưởng đã thay.
   */
  onUploadingChange?: (uploading: boolean) => void
  label?: string
  compact?: boolean
}

const ACCEPT_ATTRIBUTE = [...IMAGE_UPLOAD_TYPES, ...IMAGE_UPLOAD_EXTENSIONS].join(',')

export default function ImageUploader({
  value,
  onChange,
  onUploadingChange,
  label,
  compact = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const instanceId = useId()
  const labelId = `${instanceId}-label`
  const dropzoneId = `${instanceId}-dropzone`
  const [errorMessage, setErrorMessage] = useState<string>()
  const [isDragging, setIsDragging] = useState(false)
  // Ảnh đang trên đường lên server, xem trước bằng blob URL để giáo viên thấy ngay mình đã chọn gì.
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string>()

  const activeUploadRef = useRef<AbortController | null>(null)
  // Form truyền hàm viết tại chỗ nên mỗi lần vẽ lại là một hàm mới; lượt tải chạy vắt qua nhiều lần
  // vẽ phải gọi bản mới nhất, không phải bản của lúc bắt đầu.
  const onChangeRef = useRef(onChange)
  const onUploadingChangeRef = useRef(onUploadingChange)
  useEffect(() => {
    onChangeRef.current = onChange
    onUploadingChangeRef.current = onUploadingChange
  })

  // Rời form hoặc gỡ ô ảnh của một đáp án khi ảnh còn đang tải: huỷ request, và gỡ trạng thái
  // "đang tải" khỏi form, nếu không nút lưu bị khoá mãi vì một ô không còn trên màn hình.
  useEffect(() => () => {
    if (activeUploadRef.current) {
      activeUploadRef.current.abort()
      activeUploadRef.current = null
      onUploadingChangeRef.current?.(false)
    }
  }, [])

  const startUpload = async (file: File) => {
    const rejection = checkImageFile(file)
    if (rejection) {
      setErrorMessage(rejection)
      return
    }

    // Chọn ảnh khác khi ảnh trước chưa tải xong: ảnh sau thắng, ảnh trước bị huỷ.
    activeUploadRef.current?.abort()
    const controller = new AbortController()
    activeUploadRef.current = controller

    const previewUrl = URL.createObjectURL(file)
    setPendingPreviewUrl(previewUrl)
    setErrorMessage(undefined)
    onUploadingChangeRef.current?.(true)

    try {
      const uploaded = await uploadImage(file, controller.signal)
      if (!controller.signal.aborted) onChangeRef.current(uploaded.url)
    } catch (caught) {
      // Ảnh cũ (nếu có) được giữ nguyên: tải hỏng không được phép âm thầm xoá ảnh đã lưu.
      if (!controller.signal.aborted) {
        setErrorMessage(caught instanceof Error ? caught.message : 'Không tải được ảnh lên. Vui lòng thử lại.')
      }
    } finally {
      if (activeUploadRef.current === controller) {
        activeUploadRef.current = null
        setPendingPreviewUrl(undefined)
        onUploadingChangeRef.current?.(false)
      }
      URL.revokeObjectURL(previewUrl)
    }
  }

  const cancelUpload = () => {
    activeUploadRef.current?.abort()
    activeUploadRef.current = null
    setPendingPreviewUrl(undefined)
    onUploadingChangeRef.current?.(false)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void startUpload(file)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void startUpload(file)
  }

  const handleRemove = () => {
    setErrorMessage(undefined)
    onChange(undefined)
  }

  const imageClass = `rounded-xl object-contain bg-white ${compact ? 'max-h-20' : 'max-h-44'}`

  return (
    <div>
      {label && (
        <label id={labelId} className="block text-sm font-semibold text-slate-700 mb-2">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Vùng thông báo luôn gắn trong DOM: trình đọc màn hình chỉ báo tin cậy khi nội dung của một
          aria-live có sẵn thay đổi, chứ không phải khi cả khối mới được gắn vào cùng lúc với chữ. */}
      <div aria-live="polite" className="sr-only">
        {pendingPreviewUrl ? 'Đang tải ảnh lên…' : ''}
      </div>

      {pendingPreviewUrl ? (
        <div className="relative inline-block max-w-full rounded-2xl border border-indigo-200 bg-indigo-50/40 p-2">
          <div className="relative">
            <img src={pendingPreviewUrl} alt="Ảnh đang tải lên" className={`${imageClass} opacity-60`} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={compact ? 18 : 26} className="animate-spin text-indigo-600" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="whitespace-nowrap text-xs font-semibold text-indigo-700">Đang tải ảnh lên…</span>
            <button
              type="button"
              onClick={cancelUpload}
              className="whitespace-nowrap inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <X size={13} />
              Huỷ
            </button>
          </div>
        </div>
      ) : value ? (
        <div className="relative inline-block max-w-full rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <img src={resolveMediaUrl(value)} alt="Ảnh đã tải lên" className={imageClass} />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Đổi ảnh
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="whitespace-nowrap inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Xoá
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          id={dropzoneId}
          aria-labelledby={label ? `${labelId} ${dropzoneId}` : undefined}
          onDragOver={event => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`group w-full rounded-2xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center text-center outline-none focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-50 ${
            compact ? 'px-3 py-3 gap-1' : 'px-4 py-8 gap-2'
          } ${isDragging ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40'}`}
        >
          <ImagePlus size={compact ? 16 : 24} className="text-indigo-400" />
          <p className={`font-semibold text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>
            {compact ? 'Thêm ảnh' : 'Kéo thả ảnh vào đây hoặc bấm để chọn'}
          </p>
          {!compact && <p className="text-xs text-slate-400">Định dạng PNG, JPG, GIF, WEBP — tối đa 4 MB</p>}
          {/*
            "bấm để chọn" đọc như một thao tác chuột/chạm. Ô này thực ra dùng được trọn vẹn bằng bàn
            phím (đây là <button> thật, tự nằm trong thứ tự Tab) — chỉ là không có gì nói cho người
            dùng bàn phím biết trước. Dòng này chỉ hiện khi đang focus bằng bàn phím, không chiếm chỗ
            lúc bình thường.
          */}
          <p
            className={`hidden group-focus-visible:block font-semibold text-indigo-500 ${compact ? 'text-[10px]' : 'text-xs'}`}
          >
            Nhấn Enter hoặc Space để chọn ảnh
          </p>
        </button>
      )}

      {errorMessage && (
        <p role="alert" className="text-xs text-red-500 mt-2 font-medium">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
