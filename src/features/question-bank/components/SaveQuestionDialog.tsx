import { Loader2, Plus, Save } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import type { AnswerOption, DifficultyLevel } from '../../../types'
import QuestionPreview from './QuestionPreview'

interface SaveQuestionDialogProps {
  open: boolean
  /** Sửa câu đã có: chỉ có "Lưu thay đổi". Tạo mới: thêm "Lưu và tạo câu tiếp theo". */
  isEdit: boolean
  saving: boolean
  /** Câu sắp lưu, cho khối xem trước như học sinh. */
  preview: {
    content: string
    imageUrl?: string
    topic: string
    difficulty: DifficultyLevel
    allowMultiple: boolean
    point: number
    answers: AnswerOption[]
  }
  onClose: () => void
  onSave: (keepCreating: boolean) => void
}

const primaryGradient = 'linear-gradient(135deg,#FF8400,#FFA01F)'

/**
 * Hộp xác nhận lúc bấm nút lưu của trình soạn câu hỏi: cho xem lại câu sắp lưu đúng như học sinh sẽ thấy, rồi chọn luôn bước
 * sau — lưu rồi quay về, hay lưu rồi soạn tiếp câu mới. Nút lưu ngoài trang chỉ mở hộp này, nên bấm nhầm không ghi gì vào
 * ngân hàng; đóng hộp (nút X, Esc, bấm ra ngoài) là quay lại sửa tiếp.
 */
export default function SaveQuestionDialog({ open, isEdit, saving, preview, onClose, onSave }: SaveQuestionDialogProps) {
  return (
    <Modal
      open={open}
      title={isEdit ? 'Lưu thay đổi cho câu hỏi này?' : 'Lưu câu hỏi này vào ngân hàng?'}
      description="Xem lại câu hỏi lần cuối. Đóng hộp này để quay lại sửa."
      onClose={saving ? () => undefined : onClose}
      dismissible={!saving}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
          {!isEdit && (
            <button
              type="button"
              id="save-and-next"
              onClick={() => onSave(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <Plus size={15} /> Lưu và tạo câu tiếp theo
            </button>
          )}
          <button
            type="button"
            id="save-only"
            onClick={() => onSave(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            style={{ background: primaryGradient }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? 'Lưu thay đổi' : 'Lưu'}
          </button>
        </div>
      }
    >
      <QuestionPreview
        content={preview.content}
        imageUrl={preview.imageUrl}
        topic={preview.topic}
        difficulty={preview.difficulty}
        allowMultiple={preview.allowMultiple}
        point={preview.point}
        answers={preview.answers}
      />
    </Modal>
  )
}
