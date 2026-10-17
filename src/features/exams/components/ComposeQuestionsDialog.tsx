import { useEffect, useState } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import Modal from '../../../components/common/Modal'
import { useAsync } from '../../../hooks/useAsync'
import { composeQuestions, previewBlueprint, type ComposeQuestionsResult } from '../../../services/examService'
import { listTopics } from '../../../services/questionService'
import { difficultyLabels, type DifficultyLevel, type StudentGroup } from '../../../types'

const LEVELS: readonly DifficultyLevel[] = ['easy', 'medium', 'hard']

const DEFAULT_COUNTS: Record<DifficultyLevel, number> = { easy: 6, medium: 10, hard: 4 }

/** Giá trị ô chọn cho "không giới hạn chương": phải chọn rõ ràng, không để mặc định lọt mọi chương. */
const ALL_TOPICS = '__all__'

const selectClass =
  'w-full px-4 py-2.5 rounded-xl border bg-white text-sm outline-none focus:ring-4 transition-colors'

interface ComposeQuestionsDialogProps {
  open: boolean
  onClose: () => void
  /** Id các câu đã có trong đề, để không rút trùng. */
  existingIds: number[]
  /** Lớp của giáo viên, để chọn "không lặp lại câu lớp đã nhận". */
  groups: StudentGroup[]
  /** Nhận các câu rút được. Hộp tự đóng sau đó. */
  onComposed: (result: ComposeQuestionsResult) => void
}

/**
 * "Soạn tự động": giáo viên chọn chương (chủ đề) và nói cần bao nhiêu câu mỗi mức, hệ thống rút ngẫu nhiên từ ngân hàng và bỏ
 * thẳng vào đề để duyệt. Không rút được đủ thì vẫn trả những gì có — kết quả nói mức nào thiếu.
 *
 * - **Chương phải chọn rõ ràng** (không có mặc định "mọi chủ đề"): đề cho một chương không được lọt câu của chương khác.
 * - **Đề nhiều chương**: soạn chương này xong, mở hộp lần nữa chọn chương sau — câu mới được thêm vào cuối đề và không rút lại
 *   câu đã có. Sau mỗi lần soạn, ô chương về trống để chọn chương tiếp theo; số câu và lớp đã chọn được giữ.
 * - **Không lặp câu cũ của lớp**: chọn các lớp sẽ làm đề này, hệ thống bỏ những câu mà các lớp đó đã nhận ở đề trước.
 */
export default function ComposeQuestionsDialog({
  open, onClose, existingIds, groups, onComposed,
}: ComposeQuestionsDialogProps) {
  const [counts, setCounts] = useState<Record<DifficultyLevel, number>>(DEFAULT_COUNTS)
  const [topic, setTopic] = useState('')
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSubmitting(false)
  }, [open])

  const topicChosen = topic !== ''
  const topicsQuery = useAsync(() => listTopics(), [])
  // Số câu DÙNG ĐƯỢC (đang bật) của chương đã chọn, theo từng mức. Dùng bản xem trước ma trận vì nó đếm đúng theo chủ đề và chỉ
  // đếm câu đang bật; tổng quan ngân hàng không lọc theo chủ đề và tính cả câu đang ẩn nên không dùng ở đây.
  const availableQuery = useAsync(
    () => (open && topicChosen
      ? previewBlueprint({
        topic: topic === ALL_TOPICS ? '' : topic,
        totalQuestions: 1,
        easyPercentage: 34,
        mediumPercentage: 33,
        hardPercentage: 33,
      })
      : Promise.resolve(undefined)),
    [open, topic],
  )

  const total = LEVELS.reduce((sum, level) => sum + counts[level], 0)
  const available = availableQuery.data?.available
  const canSubmit = total > 0 && topicChosen && !submitting

  const toggleGroup = (groupId: number) => {
    setGroupIds(current => (current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId]))
  }

  const submit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const result = await composeQuestions({
        easy: counts.easy,
        medium: counts.medium,
        hard: counts.hard,
        topic: topic === ALL_TOPICS ? undefined : topic,
        excludeQuestionIds: existingIds,
        // Chỉ gửi lớp còn tồn tại trong danh sách hiện tại: lớp vừa bị gỡ khỏi quyền giáo viên sẽ bị server từ chối.
        excludeAssignedToGroupIds: groupIds.filter(id => groups.some(group => group.id === id)),
      })
      // Soạn xong một chương thì về ô trống: chương kế tiếp phải được chọn lại, không vô tình rút thêm từ chương cũ.
      setTopic('')
      onComposed(result)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Không soạn được. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Soạn tự động"
      description="Hệ thống rút ngẫu nhiên câu hỏi của chương bạn chọn và đưa vào đề để bạn duyệt. Chưa lưu gì cho tới khi bạn bấm Lưu."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            title={!topicChosen ? 'Chọn chương cần soạn trước' : undefined}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {total > 0 ? `Soạn ${total} câu` : 'Soạn'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="compose-topic" className="block text-sm font-semibold text-slate-700 mb-2">
            Chương (chủ đề) <span className="text-red-500">*</span>
          </label>
          <select
            id="compose-topic"
            value={topic}
            onChange={event => setTopic(event.target.value)}
            data-attention={topicChosen ? undefined : 'true'}
            className={`${selectClass} ${
              topicChosen
                ? 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-50'
                : 'border-amber-400 bg-amber-50/70 ring-4 ring-amber-100 focus:border-amber-500 focus:ring-amber-100'
            }`}
          >
            <option value="">— Chọn chương cần soạn —</option>
            {(topicsQuery.data ?? []).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
            <option value={ALL_TOPICS}>Mọi chương (không giới hạn)</option>
          </select>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            Đề gồm nhiều chương: soạn chương này xong, bấm "Soạn tự động" lần nữa và chọn chương sau — câu mới được thêm vào
            cuối đề, không rút lại câu đã có.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {LEVELS.map(level => (
            <div key={level}>
              <label htmlFor={`compose-${level}`} className="block text-sm font-semibold text-slate-700 mb-2">
                Câu {difficultyLabels[level]}
              </label>
              <input
                id={`compose-${level}`}
                type="number"
                min={0}
                max={500}
                value={counts[level]}
                onChange={event => {
                  const parsed = Math.floor(Number(event.target.value))
                  setCounts(current => ({
                    ...current,
                    [level]: Number.isFinite(parsed) ? Math.min(500, Math.max(0, parsed)) : 0,
                  }))
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                {!topicChosen ? 'Chọn chương để xem' : available ? `Có ${available[level] ?? 0} câu dùng được` : 'Đang đếm…'}
              </p>
            </div>
          ))}
        </div>

        {groups.length > 0 && (
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-700 mb-1">
              Không lặp lại câu lớp đã nhận <span className="font-normal text-slate-400">· tuỳ chọn</span>
            </legend>
            <p className="mb-2 text-xs text-slate-400 leading-relaxed">
              Tích các lớp sẽ làm đề này: hệ thống bỏ những câu đã nằm trong các đề từng giao cho các lớp đó.
              {groupIds.length > 0 && ' Số câu rút được có thể ít hơn số ghi ở trên.'}
            </p>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
              {groups.map(group => (
                <label
                  key={group.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={groupIds.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="flex-1 min-w-0 truncate">{group.name}</span>
                  <span className="text-xs text-slate-400">{group.studentCount} học sinh</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {existingIds.length > 0 && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {existingIds.length} câu đang có trong đề sẽ không bị rút lại. Câu soạn tự động được thêm vào cuối danh sách.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}
      </div>
    </Modal>
  )
}
