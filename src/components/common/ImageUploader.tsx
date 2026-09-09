import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

interface ImageUploaderProps {
  value?: string
  onChange: (dataUrl: string | undefined) => void
  label?: string
  compact?: boolean
}

const MAX_FILE_SIZE = 2 * 1024 * 1024

export default function ImageUploader({ value, onChange, label, compact = false }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [isDragging, setIsDragging] = useState(false)

  const readImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Chỉ chấp nhận tệp ảnh (PNG, JPG, SVG…).')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('Ảnh vượt quá 2MB. Vui lòng chọn ảnh có dung lượng nhỏ hơn.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setErrorMessage(undefined)
      onChange(typeof reader.result === 'string' ? reader.result : undefined)
    }
    reader.onerror = () => setErrorMessage('Không đọc được tệp ảnh. Vui lòng thử lại.')
    reader.readAsDataURL(file)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) readImageFile(file)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) readImageFile(file)
  }

  const handleRemove = () => {
    setErrorMessage(undefined)
    onChange(undefined)
  }

  return (
    <div>
      {label && <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {value ? (
        <div className="relative inline-block rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <img
            src={value}
            alt="Ảnh đã tải lên"
            className={`rounded-xl object-contain bg-white ${compact ? 'max-h-20' : 'max-h-44'}`}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Đổi ảnh
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Xóa
            </button>
          </div>
        </div>
      ) : (
        <div
          role="presentation"
          onDragOver={event => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full rounded-2xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center text-center ${
            compact ? 'px-3 py-3 gap-1' : 'px-4 py-8 gap-2'
          } ${isDragging ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40'}`}
        >
          <ImagePlus size={compact ? 16 : 24} className="text-indigo-400" />
          <p className={`font-semibold text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>
            {compact ? 'Thêm ảnh' : 'Kéo thả ảnh vào đây hoặc bấm để chọn'}
          </p>
          {!compact && <p className="text-xs text-slate-400">Định dạng PNG, JPG, SVG — tối đa 2MB</p>}
        </div>
      )}

      {errorMessage && <p className="text-xs text-red-500 mt-2 font-medium">{errorMessage}</p>}
    </div>
  )
}
