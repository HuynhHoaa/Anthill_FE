/**
 * Kỳ học dưới quyền QUẢN TRỊ VIÊN: danh mục kỳ để gom lớp theo thời gian. Bấm một dòng để sửa; kỳ còn lớp thì không xoá được.
 */
import { useState } from 'react'
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import RowActionMenu, { type RowMenuItem } from '../../../components/common/RowActionMenu'
import { SkeletonTable } from '../../../components/common/Skeleton'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { openOnRowClick } from '../../../lib/rowClick'
import { deleteTerm, listTerms } from '../../../services/termService'
import type { AcademicTerm } from '../../../types'
import TermFormModal from '../components/TermFormModal'

const primaryButtonStyle = { background: 'linear-gradient(135deg,#FF8400,#FFA01F)' }
const headerCellClass = 'px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500'

/** `yyyy-MM-dd` → `dd/mm/yyyy`. */
function formatDay(iso?: string): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

function periodText(term: AcademicTerm): string {
  const from = formatDay(term.startsOn)
  const to = formatDay(term.endsOn)
  if (from && to) return `${from} – ${to}`
  if (from) return `Từ ${from}`
  if (to) return `Đến ${to}`
  return 'Chưa đặt ngày'
}

export default function AdminTermListPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: terms, loading, error, reload } = useAsync(() => listTerms(), [])
  const [formTarget, setFormTarget] = useState<AcademicTerm | 'new' | null>(null)

  const handleDelete = async (term: AcademicTerm) => {
    const ok = await confirm({
      title: 'Xoá kỳ học',
      message: `Xoá kỳ “${term.name}”? Kỳ chưa có lớp nào nên không ảnh hưởng tới ai.`,
      confirmLabel: 'Xoá kỳ',
      tone: 'danger',
      onConfirm: async () => {
        await deleteTerm(term.id)
      },
    })
    if (ok) {
      toast.success(`Đã xoá kỳ ${term.name}.`)
      reload()
    }
  }

  const tools = (
    <div className="flex items-center justify-end w-full">
      <button
        type="button"
        onClick={() => setFormTarget('new')}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
        style={primaryButtonStyle}
      >
        <Plus size={16} /> Thêm kỳ học
      </button>
    </div>
  )

  return (
    <AdminLayout
      pageTitle="Kỳ học"
      pageSubtitle={terms ? `${terms.length} kỳ · gom lớp theo thời gian để học sinh lọc lớp và bảng điểm` : 'Gom lớp theo thời gian: học kỳ, hay cấp lớp'}
      compactContent
      headerTools={tools}
    >
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !terms ? (
        <SkeletonTable rows={4} cols={4} />
      ) : !terms || terms.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Chưa có kỳ học nào"
          description="Thêm kỳ (ví dụ “Học kỳ 1 · 2026–2027”, hay “Lớp 11”) rồi gán cho các lớp. Học sinh sẽ lọc lớp và bảng điểm theo kỳ."
          action={
            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm"
              style={primaryButtonStyle}
            >
              <Plus size={16} /> Thêm kỳ học
            </button>
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up">
          <table className="stack-table w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                <th className={headerCellClass}>Kỳ học</th>
                <th className={headerCellClass}>Thời gian</th>
                <th className={headerCellClass}>Số lớp</th>
                <th className={headerCellClass}>Trạng thái</th>
                <th className={`${headerCellClass} text-right whitespace-nowrap`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {terms.map(term => {
                const items: RowMenuItem[] = [
                  { key: 'edit', label: 'Sửa kỳ', icon: Pencil, onSelect: () => setFormTarget(term) },
                  {
                    key: 'delete',
                    label: 'Xoá kỳ',
                    icon: Trash2,
                    tone: 'danger',
                    disabled: term.groupCount > 0,
                    disabledHint: term.groupCount > 0 ? `Còn ${term.groupCount} lớp trong kỳ này` : undefined,
                    onSelect: () => void handleDelete(term),
                  },
                ]

                return (
                  <tr
                    key={term.id}
                    onClick={openOnRowClick(() => setFormTarget(term))}
                    className="border-b border-slate-50 last:border-0 hover:bg-indigo-100/70 transition-colors cursor-pointer"
                  >
                    <td data-card="head" className="px-5 py-3">
                      <span className="font-semibold text-slate-800">{term.name}</span>
                    </td>
                    <td data-label="Thời gian" className="px-5 py-3 text-slate-600">{periodText(term)}</td>
                    <td data-label="Số lớp" className="px-5 py-3">
                      <span className="font-semibold text-slate-800">{term.groupCount}</span>{' '}
                      <span className="text-xs text-slate-400">lớp</span>
                    </td>
                    <td data-label="Trạng thái" className="px-5 py-3">
                      {term.isCurrent ? (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600">Kỳ hiện tại</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td data-card="foot" className="px-5 py-3 text-right">
                      <RowActionMenu items={items} label={`Thao tác với kỳ ${term.name}`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <TermFormModal
        open={formTarget !== null}
        term={formTarget === 'new' || formTarget === null ? undefined : formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={() => {
          setFormTarget(null)
          reload()
        }}
      />
    </AdminLayout>
  )
}
