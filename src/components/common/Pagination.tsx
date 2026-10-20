import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

type PageItem = number | 'gap-start' | 'gap-end'

const numberButtonClass =
  'w-9 h-9 rounded-xl text-sm font-semibold transition-all flex items-center justify-center'

/** Rút gọn dãy số trang: luôn giữ trang đầu, trang cuối và cửa sổ quanh trang hiện tại. */
function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const windowStart = Math.max(2, currentPage - 1)
  const windowEnd = Math.min(totalPages - 1, currentPage + 1)
  const items: PageItem[] = [1]

  if (windowStart > 2) items.push('gap-start')
  for (let pageNumber = windowStart; pageNumber <= windowEnd; pageNumber += 1) {
    items.push(pageNumber)
  }
  if (windowEnd < totalPages - 1) items.push('gap-end')
  items.push(totalPages)

  return items
}

export default function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  if (total <= pageSize || pageSize <= 0) return null

  const totalPages = Math.ceil(total / pageSize)
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const firstItemIndex = (currentPage - 1) * pageSize + 1
  const lastItemIndex = Math.min(currentPage * pageSize, total)
  const pageItems = buildPageItems(currentPage, totalPages)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 pt-4">
      <p className="text-sm text-slate-500">
        Hiển thị <strong className="text-slate-700 font-semibold">{firstItemIndex}–{lastItemIndex}</strong> trong{' '}
        <strong className="text-slate-700 font-semibold">{total}</strong>
      </p>

      <nav className="flex items-center gap-1.5" aria-label="Phân trang">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Trang trước"
          className={`${numberButtonClass} border border-slate-200 bg-white text-slate-600 ${
            currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <ChevronLeft size={16} />
        </button>

        {pageItems.map(item =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === currentPage ? 'page' : undefined}
              className={
                item === currentPage
                  ? `${numberButtonClass} text-white shadow-sm`
                  : `${numberButtonClass} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300`
              }
              style={item === currentPage ? { background: 'linear-gradient(135deg,#FF8400,#FFA01F)' } : undefined}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="w-6 text-center text-sm text-slate-400 select-none">
              …
            </span>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Trang sau"
          className={`${numberButtonClass} border border-slate-200 bg-white text-slate-600 ${
            currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  )
}
