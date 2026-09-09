interface SkeletonBlockProps {
  className?: string
}

/** Khối xám nhấp nháy, dùng làm mảnh ghép cho mọi khung xương. */
export function SkeletonBlock({ className = 'h-4 w-full' }: SkeletonBlockProps) {
  return <div className={`skeleton rounded-lg ${className}`} />
}

interface SkeletonTableProps {
  rows?: number
  cols?: number
}

/** Khung xương cho bảng danh sách: 1 hàng tiêu đề + n hàng dữ liệu. */
export function SkeletonTable({ rows = 6, cols = 5 }: SkeletonTableProps) {
  const columnKeys = Array.from({ length: cols }, (_, index) => index)
  const rowKeys = Array.from({ length: rows }, (_, index) => index)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="bg-slate-50/60 px-5 py-3.5 flex gap-4">
        {columnKeys.map(columnKey => (
          <SkeletonBlock key={columnKey} className="h-3 flex-1" />
        ))}
      </div>
      {rowKeys.map(rowKey => (
        <div key={rowKey} className="px-5 py-4 flex items-center gap-4 border-b border-slate-50 last:border-b-0">
          {columnKeys.map(columnKey => (
            <SkeletonBlock
              key={columnKey}
              className={columnKey === 0 ? 'h-4 flex-1' : 'h-3.5 flex-1'}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface SkeletonCardsProps {
  count?: number
  className?: string
}

/** Khung xương cho lưới thẻ. className cho phép trang tự chọn số cột. */
export function SkeletonCards({
  count = 6,
  className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5',
}: SkeletonCardsProps) {
  const cardKeys = Array.from({ length: count }, (_, index) => index)

  return (
    <div className={className}>
      {cardKeys.map(cardKey => (
        <div key={cardKey} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <SkeletonBlock className="h-11 w-11 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-3 w-1/3" />
            </div>
          </div>
          <div className="space-y-2.5">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-5/6" />
          </div>
          <div className="flex gap-2 mt-5">
            <SkeletonBlock className="h-8 w-24 rounded-xl" />
            <SkeletonBlock className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
