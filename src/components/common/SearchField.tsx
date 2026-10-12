import { Search, X } from 'lucide-react'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Nhãn cho trình đọc màn hình; ô không có nhãn hiển thị riêng. */
  label: string
}

/**
 * Ô tìm kiếm gọn, đủ thấp để nằm trong thanh tiêu đề (`Header`) hay trong một hàng công cụ.
 * Có nút xoá khi đã có chữ.
 */
export default function SearchField({ value, onChange, placeholder, label }: SearchFieldProps) {
  return (
    <div className="relative w-full">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        placeholder={placeholder}
        aria-label={label}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Xoá tìm kiếm"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}
