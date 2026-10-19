import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { ImportKind } from '../../../services/importService'
import ImportExcelModal from './ImportExcelModal'

interface ImportExcelButtonProps {
  kind: ImportKind
  /** Mở từ trang một lớp: những dòng để trống ô Lớp vào lớp này. */
  fixedGroup?: { id: number; name: string }
  /** Gọi sau khi nhập thật xong, để trang tải lại danh sách. */
  onImported: () => void
  label?: string
}

/** Nút "Nhập Excel" kèm hộp thoại của nó — trang chỉ cần đặt nút vào thanh công cụ. */
export default function ImportExcelButton({ kind, fixedGroup, onImported, label = 'Nhập Excel' }: ImportExcelButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap"
      >
        <FileSpreadsheet size={16} className="text-emerald-500" /> {label}
      </button>
      {open && (
        <ImportExcelModal kind={kind} fixedGroup={fixedGroup} onClose={() => setOpen(false)} onImported={onImported} />
      )}
    </>
  )
}
