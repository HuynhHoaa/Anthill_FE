import type { ReactNode } from 'react'

export interface ConfirmFact {
  label: string
  value: ReactNode
}

interface ConfirmFactsProps {
  rows: ConfirmFact[]
  /** Nhãn nhỏ viết hoa phía trên khối, ví dụ "Giao cho". */
  heading?: string
}

/**
 * Khối "nhãn — giá trị" trong hộp xác nhận: những con số hộp đang nói tới (tên, số câu, giờ mở…) xếp thành từng hàng thẳng cột
 * thay vì nhét vào một câu dài. Dùng cho mọi hộp xác nhận có vài thông tin cần đọc lướt; hệ quả vẫn đi qua `ConsequenceList`.
 */
export default function ConfirmFacts({ rows, heading }: ConfirmFactsProps) {
  return (
    <div>
      {heading && (
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{heading}</p>
      )}
      <dl className="rounded-xl border border-slate-100 bg-slate-50/70 divide-y divide-slate-100">
        {rows.map(row => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-3.5 py-2 text-[13px]">
            <dt className="text-slate-500 flex-shrink-0">{row.label}</dt>
            <dd className="min-w-0 break-words text-right font-semibold text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
