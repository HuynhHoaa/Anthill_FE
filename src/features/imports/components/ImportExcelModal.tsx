import { useEffect, useId, useState, type ChangeEvent, type DragEvent } from 'react'
import { AlertCircle, Check, Copy, Download, FileSpreadsheet, Loader2, Shuffle, Upload } from 'lucide-react'
import InfoTip from '../../../components/common/InfoTip'
import Modal from '../../../components/common/Modal'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { buildCsv, saveBlob } from '../../../lib/download'
import { listOpenGroups } from '../../../services/groupService'
import {
  IMPORT_MAX_ROWS,
  IMPORT_MIN_PASSWORD_LENGTH,
  checkImportFile,
  downloadImportTemplate,
  importGroups,
  importSchool,
  importStudents,
  importTeachers,
  importableCount,
  type ImportKind,
  type ImportResult,
} from '../../../services/importService'
import { listSubjects } from '../../../services/questionService'
import { IMPORT_COPY } from '../importCopy'
import SchoolPreviewList from './SchoolPreviewList'

interface ImportExcelModalProps {
  kind: ImportKind
  /**
   * Mở từ trang một lớp: những dòng để trống ô Lớp vào lớp này, và không chọn lớp khác ở đây. Chỉ có nghĩa với học sinh.
   */
  fixedGroup?: { id: number; name: string }
  onClose: () => void
  /** Gọi ngay sau khi nhập thật xong để trang cha tải lại danh sách; hộp vẫn mở cho tới khi bấm "Xong". */
  onImported: () => void
}

type Phase = 'pick' | 'checking' | 'preview' | 'importing' | 'done'

const primaryButtonStyle = { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }
const primaryButtonClass =
  'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed'
const secondaryButtonClass =
  'px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const selectClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50'

// Bỏ các ký tự dễ nhầm (0/O, 1/l/I) vì mật khẩu này được đọc to hoặc in ra phát cho cả lớp.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generatePassword(length = 8): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, value => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('')
}

function formatCount(value: number): string {
  return value.toLocaleString('vi-VN')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toOptionalId(value: string): number | undefined {
  const id = Number(value)
  return value !== '' && Number.isInteger(id) && id > 0 ? id : undefined
}

/**
 * Nhập hàng loạt từ file Excel, ba bước trong một hộp: chọn file, xem trước, rồi nhập.
 *
 * Bước xem trước chính là hộp xác nhận: nó chạy đúng đường mã của lần nhập thật (chỉ là không ghi), nên con số hiện ra là con
 * số sẽ xảy ra. Dòng hỏng không chặn cả mẻ; người dùng thấy rõ dòng nào hỏng vì sao, có thể nhập phần hợp lệ ngay rồi sửa
 * file và gửi lại nguyên file (dòng đã nhập được nhận ra, không bị báo trùng).
 */
export default function ImportExcelModal({ kind, fixedGroup, onClose, onImported }: ImportExcelModalProps) {
  const toast = useToast()
  const copy = IMPORT_COPY[kind]
  const fileInputId = useId()
  const defaultSelectId = useId()
  const passwordId = useId()

  const [phase, setPhase] = useState<Phase>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [defaultId, setDefaultId] = useState('')
  const [publishGroups, setPublishGroups] = useState(false)
  const [password, setPassword] = useState('')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  const needsGroupChoice = kind === 'students' && fixedGroup === undefined
  // Nhập cả trường lấy môn từ cột "Môn giảng dạy" của file, không có ô chọn môn chung.
  const needsSubjectChoice = kind === 'teachers'
  const groupsQuery = useAsync(() => (needsGroupChoice ? listOpenGroups() : Promise.resolve([])), [needsGroupChoice])
  const subjectsQuery = useAsync(() => (needsSubjectChoice ? listSubjects() : Promise.resolve([])), [needsSubjectChoice])

  const busy = phase === 'checking' || phase === 'importing'
  const hasPassword = kind !== 'groups'
  const passwordKept = phase === 'done' && hasPassword && (result?.created ?? 0) > 0

  // Mật khẩu vừa đặt cho cả đợt không xem lại được ở đâu khác: đóng tab giữa chừng thì trình duyệt hỏi lại.
  useEffect(() => {
    if (!passwordKept && !busy) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [passwordKept, busy])

  const runImport = (target: File, dryRun: boolean): Promise<ImportResult> => {
    const sharedPassword = dryRun ? undefined : password
    if (kind === 'students') {
      return importStudents(target, {
        groupId: fixedGroup?.id ?? toOptionalId(defaultId),
        password: sharedPassword,
        dryRun,
      })
    }
    if (kind === 'teachers') {
      return importTeachers(target, { subjectId: toOptionalId(defaultId), password: sharedPassword, dryRun })
    }
    if (kind === 'school') {
      return importSchool(target, {
        password: sharedPassword,
        publishGroups,
        dryRun,
      })
    }
    return importGroups(target, { dryRun })
  }

  const pickFile = (candidate: File) => {
    const problem = checkImportFile(candidate)
    if (problem) {
      setFileError(problem)
      return
    }
    setFile(candidate)
    setFileError(null)
    setError(null)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const candidate = event.target.files?.[0]
    // Xoá giá trị để chọn lại đúng file vừa chọn (sau khi sửa trong Excel) vẫn kích hoạt sự kiện.
    event.target.value = ''
    if (candidate) pickFile(candidate)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const candidate = event.dataTransfer.files[0]
    if (candidate) pickFile(candidate)
  }

  const handleTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      const template = await downloadImportTemplate(kind)
      saveBlob(template.blob, template.fileName)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không tải được file mẫu.')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleCheck = async () => {
    if (!file) return
    setPhase('checking')
    setError(null)
    try {
      setPreview(await runImport(file, true))
      setPhase('preview')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không kiểm tra được file.')
      setPhase('pick')
    }
  }

  const handleImport = async () => {
    if (!file || !preview) return
    setPhase('importing')
    setError(null)
    try {
      setResult(await runImport(file, false))
      setPhase('done')
      onImported()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không nhập được file.')
      setPhase('preview')
    }
  }

  const handleBackToPick = () => {
    setPreview(null)
    setError(null)
    setPhase('pick')
  }

  const handleDownloadIssues = (target: ImportResult) => {
    saveBlob(
      buildCsv([
        ['Dòng', 'Cột', 'Lý do'],
        ...target.issues.map(issue => [issue.row, issue.column ?? '', issue.message]),
      ]),
      `loi-nhap-${copy.fileSlug}.csv`,
    )
  }

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password)
      toast.success('Đã chép mật khẩu.')
    } catch {
      toast.error('Trình duyệt không cho chép tự động. Hãy bôi đen mật khẩu rồi chép thủ công.')
    }
  }

  const importable = preview ? importableCount(preview) : 0
  // Nhãn nút đếm DÒNG của file, không đếm bản ghi: một dòng nhập tổng hợp có thể tạo cả giáo viên, lớp lẫn học sinh.
  const importableRows = preview ? (preview.school ? Math.max(0, preview.totalRows - preview.failed) : importable) : 0
  const needsPassword = hasPassword && (preview?.created ?? 0) > 0
  const passwordTooShort = needsPassword && password.length < IMPORT_MIN_PASSWORD_LENGTH
  const canImport = phase === 'preview' && importable > 0 && !passwordTooShort

  const footer = (() => {
    if (phase === 'done') {
      return (
        <button type="button" onClick={onClose} className={primaryButtonClass} style={primaryButtonStyle}>
          Xong
        </button>
      )
    }
    if (phase === 'preview' || phase === 'importing') {
      return (
        <>
          <button type="button" onClick={handleBackToPick} disabled={busy} className={secondaryButtonClass}>
            Chọn file khác
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={!canImport || busy}
            className={primaryButtonClass}
            style={primaryButtonStyle}
          >
            {phase === 'importing' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {importable > 0 ? `Nhập ${formatCount(importableRows)} dòng` : 'Nhập'}
          </button>
        </>
      )
    }
    return (
      <>
        <button type="button" onClick={onClose} disabled={busy} className={secondaryButtonClass}>
          Huỷ
        </button>
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={!file || busy}
          className={primaryButtonClass}
          style={primaryButtonStyle}
        >
          {phase === 'checking' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {phase === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra file'}
        </button>
      </>
    )
  })()

  return (
    <Modal
      open
      // Xem trước cả trường cần chỗ cho dải tab lớp và bảng học sinh: file thật có thể có hàng nghìn em.
      size={kind === 'school' && (phase === 'preview' || phase === 'importing') ? 'xl' : 'lg'}
      title={copy.title}
      icon={<FileSpreadsheet size={20} />}
      showCloseButton={false}
      dismissible={!busy && !passwordKept}
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {(phase === 'pick' || phase === 'checking') && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-sm text-slate-600 inline-flex items-center gap-1.5">
                Tải file mẫu, điền danh sách (tối đa {formatCount(IMPORT_MAX_ROWS[kind])} dòng mỗi lần) rồi chọn file bên dưới.
                <InfoTip title="Cách điền file" label="Giải thích cách điền file">
                  <ul className="space-y-1.5 list-disc pl-4">
                    {copy.tips.map(tip => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </InfoTip>
              </p>
              <button
                type="button"
                onClick={() => void handleTemplate()}
                disabled={downloadingTemplate}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {downloadingTemplate ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Tải file mẫu
              </button>
            </div>

            {kind === 'students' && fixedGroup && (
              <p className="text-sm text-slate-600 leading-relaxed">
                Dòng nào để trống ô Lớp sẽ vào lớp <strong className="font-semibold text-slate-800">{fixedGroup.name}</strong>.
              </p>
            )}

            {needsGroupChoice && (
              <div>
                <label htmlFor={defaultSelectId} className="block text-sm font-semibold text-slate-700 mb-2">
                  Lớp cho các dòng để trống ô Lớp <span className="font-normal text-slate-400">(không bắt buộc)</span>
                </label>
                <select
                  id={defaultSelectId}
                  value={defaultId}
                  onChange={event => setDefaultId(event.target.value)}
                  disabled={busy || groupsQuery.loading}
                  className={selectClass}
                >
                  <option value="">{groupsQuery.loading ? 'Đang tải danh sách lớp…' : 'Không chọn'}</option>
                  {(groupsQuery.data ?? []).map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            )}

            {needsSubjectChoice && (
              <div>
                <label htmlFor={defaultSelectId} className="block text-sm font-semibold text-slate-700 mb-2">
                  Môn cho các dòng để trống ô Môn <span className="font-normal text-slate-400">(không bắt buộc)</span>
                </label>
                <select
                  id={defaultSelectId}
                  value={defaultId}
                  onChange={event => setDefaultId(event.target.value)}
                  disabled={busy || subjectsQuery.loading}
                  className={selectClass}
                >
                  <option value="">{subjectsQuery.loading ? 'Đang tải danh sách môn…' : 'Không chọn'}</option>
                  {(subjectsQuery.data ?? []).map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
            )}

            {kind === 'school' && (
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={publishGroups}
                  onChange={event => setPublishGroups(event.target.checked)}
                  disabled={busy}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                />
                <span className="text-sm text-slate-700 leading-relaxed">
                  <span className="font-semibold">Công bố các lớp mới ngay</span>
                  <span className="block text-xs text-slate-400">
                    Giáo viên chủ nhiệm thấy lớp ngay. Bỏ chọn thì lớp mới ở dạng nháp, công bố từng lớp sau.
                  </span>
                </span>
              </label>
            )}

            <div>
              <label
                htmlFor={fileInputId}
                onDragOver={event => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors focus-within:ring-4 focus-within:ring-indigo-50 ${
                  dragging ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                } ${busy ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  id={fileInputId}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={handleFileInput}
                  disabled={busy}
                />
                {file ? (
                  <>
                    <FileSpreadsheet size={26} className="text-emerald-500" />
                    <span className="text-sm font-semibold text-slate-800 break-all">{file.name}</span>
                    <span className="text-xs text-slate-400">{formatFileSize(file.size)} · bấm để chọn file khác</span>
                  </>
                ) : (
                  <>
                    <Upload size={26} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Kéo file Excel vào đây hoặc bấm để chọn</span>
                    <span className="text-xs text-slate-400">File .xlsx, tối đa 5 MB</span>
                  </>
                )}
              </label>
              {fileError && <p className="mt-1.5 text-xs text-red-500">{fileError}</p>}
            </div>
          </>
        )}

        {(phase === 'preview' || phase === 'importing') && preview && (
          <PreviewBody
            kind={kind}
            preview={preview}
            fileName={file?.name ?? ''}
            password={password}
            passwordId={passwordId}
            passwordTooShort={passwordTooShort}
            needsPassword={needsPassword}
            disabled={busy}
            onPasswordChange={setPassword}
            onGeneratePassword={() => setPassword(generatePassword())}
            onDownloadIssues={() => handleDownloadIssues(preview)}
          />
        )}

        {phase === 'done' && result && (
          <DoneBody
            kind={kind}
            result={result}
            password={hasPassword && result.created > 0 ? password : null}
            onCopyPassword={() => void handleCopyPassword()}
            onDownloadIssues={() => handleDownloadIssues(result)}
          />
        )}
      </div>
    </Modal>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'indigo' | 'emerald' | 'slate' | 'red' }) {
  const toneClass = {
    indigo: 'text-indigo-600 bg-indigo-50/70 border-indigo-100',
    emerald: 'text-emerald-600 bg-emerald-50/70 border-emerald-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-100',
    red: 'text-red-600 bg-red-50/70 border-red-100',
  }[tone]

  // Một viên nhỏ trên một dòng (số + nhãn): file nhiều nghìn dòng cần chỗ cho danh sách lớp, không phải cho sáu thẻ lớn.
  return (
    <div className={`inline-flex items-baseline gap-1.5 rounded-xl border px-3 py-1.5 ${toneClass}`}>
      <span className="text-base font-bold tabular-nums">{formatCount(value)}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

interface PreviewBodyProps {
  kind: ImportKind
  preview: ImportResult
  fileName: string
  password: string
  passwordId: string
  passwordTooShort: boolean
  needsPassword: boolean
  disabled: boolean
  onPasswordChange: (value: string) => void
  onGeneratePassword: () => void
  onDownloadIssues: () => void
}

function PreviewBody({
  kind, preview, fileName, password, passwordId, passwordTooShort, needsPassword, disabled,
  onPasswordChange, onGeneratePassword, onDownloadIssues,
}: PreviewBodyProps) {
  const copy = IMPORT_COPY[kind]
  const importable = importableCount(preview)
  const allKnown = importable === 0 && preview.failed === 0

  return (
    <>
      <p className="text-sm text-slate-500 inline-flex items-center gap-2 max-w-full">
        <FileSpreadsheet size={16} className="text-emerald-500 flex-shrink-0" />
        <span className="font-medium text-slate-700 truncate">{fileName}</span>
        <span className="flex-shrink-0">· {formatCount(preview.totalRows)} dòng</span>
      </p>

      {preview.school ? (
        <div className="flex flex-wrap gap-2">
          <Stat label="Giáo viên mới" value={preview.school.teachersCreated} tone="indigo" />
          <Stat label="Lớp mới" value={preview.school.groupsCreated} tone="indigo" />
          <Stat label="Học sinh mới" value={preview.school.studentsCreated} tone="indigo" />
          <Stat label="Xếp thêm vào lớp" value={preview.school.studentsPlaced} tone="emerald" />
          <Stat label="Đã có sẵn" value={preview.unchanged} tone="slate" />
          <Stat label="Dòng lỗi" value={preview.failed} tone={preview.failed > 0 ? 'red' : 'slate'} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Stat label={copy.createdLabel} value={preview.created} tone="indigo" />
          {copy.placedLabel && <Stat label={copy.placedLabel} value={preview.placed} tone="emerald" />}
          <Stat label="Đã có sẵn" value={preview.unchanged} tone="slate" />
          <Stat label="Dòng lỗi" value={preview.failed} tone={preview.failed > 0 ? 'red' : 'slate'} />
        </div>
      )}

      {preview.school && preview.school.subjectsCreated.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2">
          <p className="text-sm text-amber-800 leading-relaxed">
            Môn mới sẽ được tạo từ file:{' '}
            <strong className="font-semibold">{preview.school.subjectsCreated.join(', ')}</strong>. Soát lại chính tả, gõ sai thì sửa file rồi chọn lại.
          </p>
        </div>
      )}

      {preview.school && preview.school.termsCreated.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2">
          <p className="text-sm text-amber-800 leading-relaxed">
            Kỳ học mới sẽ được tạo từ file:{' '}
            <strong className="font-semibold">{preview.school.termsCreated.join(', ')}</strong>. Kỳ không gắn ngày; vào trang Kỳ học để đặt kỳ hiện tại.
          </p>
        </div>
      )}

      {preview.school && (
        <SchoolPreviewList groups={preview.school.preview} newSubjects={preview.school.subjectsCreated} newTerms={preview.school.termsCreated} />
      )}

      {preview.school && preview.school.groupsPublished > 0 && (
        <p className="text-sm text-slate-600 leading-relaxed">
          {formatCount(preview.school.groupsPublished)} lớp mới sẽ được công bố ngay: giáo viên chủ nhiệm thấy lớp sau khi nhập.
        </p>
      )}

      {allKnown && (
        <p className="text-sm text-slate-600 leading-relaxed">
          Cả {formatCount(preview.totalRows)} dòng đã có trong hệ thống, không có gì mới để nhập.
        </p>
      )}

      {importable === 0 && preview.failed > 0 && (
        <p className="text-sm text-red-600 leading-relaxed">
          Không có dòng nào nhập được. Sửa các lỗi bên dưới trong file Excel rồi chọn lại file.
        </p>
      )}

      {preview.issues.length > 0 && (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">
              Dòng lỗi
              <span className="font-normal text-slate-400">
                {preview.issuesTruncated
                  ? ` · hiện ${formatCount(preview.issues.length)} dòng đầu trong ${formatCount(preview.failed)}`
                  : ` · ${formatCount(preview.failed)}`}
              </span>
            </span>
            <button
              type="button"
              onClick={onDownloadIssues}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <Download size={14} /> Tải danh sách lỗi
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-2 w-16">Dòng</th>
                  <th className="px-2 py-2 w-40 hidden sm:table-cell">Cột</th>
                  <th className="px-2 py-2">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {preview.issues.map((issue, index) => (
                  <tr key={`${issue.row}-${index}`} className="border-b border-slate-50 last:border-0 align-top">
                    <td className="px-4 py-2 tabular-nums text-slate-500">{issue.row}</td>
                    <td className="px-2 py-2 text-slate-600 hidden sm:table-cell">{issue.column ?? '—'}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {/* Màn hẹp không đủ chỗ cho một cột riêng: tên cột đứng ngay trên lý do. */}
                      {issue.column && <span className="block text-xs font-semibold text-slate-400 sm:hidden">{issue.column}</span>}
                      {issue.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importable > 0 && preview.failed > 0 && (
        <p className="text-sm text-slate-500 leading-relaxed">
          Nhập các dòng hợp lệ ngay được. Sửa các dòng lỗi trong file rồi nhập lại nguyên file: dòng đã nhập sẽ được nhận ra, không bị trùng.
        </p>
      )}

      {needsPassword && (
        <div>
          <label htmlFor={passwordId} className="block text-sm font-semibold text-slate-700 mb-2">
            <span className="inline-flex items-center gap-1.5">
              Mật khẩu ban đầu <span className="text-red-500">*</span>
              <InfoTip label="Giải thích về mật khẩu ban đầu">
                Dùng chung cho {formatCount(preview.created)} tài khoản mới. Mỗi người bị buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
                Mật khẩu chỉ hiện lại ở bước cuối, sau đó không xem lại được.
              </InfoTip>
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id={passwordId}
              type="text"
              value={password}
              onChange={event => onPasswordChange(event.target.value)}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              placeholder={`Ít nhất ${IMPORT_MIN_PASSWORD_LENGTH} ký tự`}
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono outline-none bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={onGeneratePassword}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <Shuffle size={15} /> Tạo ngẫu nhiên
            </button>
          </div>
          {passwordTooShort && password.length > 0 && (
            <p className="mt-1.5 text-xs text-amber-600">
              Cần thêm ít nhất {IMPORT_MIN_PASSWORD_LENGTH - password.length} ký tự nữa.
            </p>
          )}
        </div>
      )}
    </>
  )
}

interface DoneBodyProps {
  kind: ImportKind
  result: ImportResult
  /** Mật khẩu chung của đợt vừa tạo; `null` khi không có tài khoản mới. */
  password: string | null
  onCopyPassword: () => void
  onDownloadIssues: () => void
}

function DoneBody({ kind, result, password, onCopyPassword, onDownloadIssues }: DoneBodyProps) {
  const copy = IMPORT_COPY[kind]
  const school = result.school
  const nothingDone = importableCount(result) === 0

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${
            nothingDone ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          <Check size={18} />
        </span>
        <div className="space-y-1 text-sm text-slate-700 leading-relaxed pt-1.5">
          {nothingDone && <p className="font-semibold">Không có gì mới để nhập.</p>}
          {school ? (
            <>
              {(school.teachersCreated > 0 || school.groupsCreated > 0 || school.studentsCreated > 0) && (
                <p className="font-semibold">
                  Đã tạo {formatCount(school.teachersCreated)} giáo viên, {formatCount(school.groupsCreated)} lớp và{' '}
                  {formatCount(school.studentsCreated)} học sinh.
                </p>
              )}
              {school.studentsPlaced > 0 && (
                <p className="font-semibold">Đã xếp thêm lớp cho {formatCount(school.studentsPlaced)} học sinh có sẵn.</p>
              )}
              {school.subjectsCreated.length > 0 && (
                <p className="font-semibold">Đã thêm môn mới: {school.subjectsCreated.join(', ')}.</p>
              )}
              {school.termsCreated.length > 0 && (
                <p className="font-semibold">Đã thêm kỳ học mới: {school.termsCreated.join(', ')}.</p>
              )}
              {school.groupsPublished > 0 && (
                <p className="font-semibold">Đã công bố {formatCount(school.groupsPublished)} lớp: giáo viên chủ nhiệm thấy lớp ngay.</p>
              )}
              {school.groupsCreated > school.groupsPublished && (
                <p className="text-slate-500">
                  {formatCount(school.groupsCreated - school.groupsPublished)} lớp mới đang ở dạng nháp: vào từng lớp bấm Công bố để giáo viên thấy.
                </p>
              )}
              {result.unchanged > 0 && <p className="text-slate-500">{formatCount(result.unchanged)} mục đã có từ trước.</p>}
              {result.created > 0 && copy.doneHint && <p className="text-slate-500">{copy.doneHint}</p>}
            </>
          ) : (
            <>
              {result.created > 0 && <p className="font-semibold">{copy.doneCreated(result.created)}</p>}
              {result.placed > 0 && <p className="font-semibold">Đã xếp lớp cho {formatCount(result.placed)} học sinh có sẵn.</p>}
              {result.unchanged > 0 && <p className="text-slate-500">{formatCount(result.unchanged)} dòng đã có từ trước.</p>}
              {result.created > 0 && copy.doneHint && <p className="text-slate-500">{copy.doneHint}</p>}
            </>
          )}
        </div>
      </div>

      {password !== null && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mật khẩu ban đầu của cả đợt</div>
          <div className="flex items-center gap-3">
            <code className="flex-1 min-w-0 font-mono text-lg font-bold text-slate-800 tracking-wide break-all select-all">
              {password}
            </code>
            <button
              type="button"
              onClick={onCopyPassword}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 transition-colors flex-shrink-0"
            >
              <Copy size={14} /> Chép
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mật khẩu chỉ hiện ở đây. Đóng hộp là không xem lại được; ai cũng phải đổi mật khẩu ở lần đăng nhập đầu tiên.
          </p>
        </div>
      )}

      {result.failed > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-sm text-amber-800 leading-relaxed">
            {formatCount(result.failed)} dòng chưa nhập được. Sửa trong file rồi nhập lại nguyên file; dòng đã nhập sẽ được nhận ra.
          </p>
          <button
            type="button"
            onClick={onDownloadIssues}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 whitespace-nowrap"
          >
            <Download size={14} /> Tải danh sách lỗi
          </button>
        </div>
      )}
    </div>
  )
}
