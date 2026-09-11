import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Info, ListChecks, Loader2, Plus, Save } from 'lucide-react'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import ErrorState from '../../../components/common/ErrorState'
import ImageUploader from '../../../components/common/ImageUploader'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import {
  createQuestion,
  getQuestion,
  listTopics,
  setQuestionStatus,
  updateQuestion,
  type QuestionPayload,
} from '../../../services/questionService'
import {
  difficultyLabels,
  questionStatusLabels,
  type AnswerOption,
  type DifficultyLevel,
  type Question,
  type QuestionStatus,
} from '../../../types'
import AnswerEditorRow from '../components/AnswerEditorRow'
import QuestionPreview from '../components/QuestionPreview'
import { questionStatusConfirmCopy } from '../utils/questionConfirmations'

const MIN_ANSWERS = 2
const MAX_ANSWERS = 6

const difficultyOptions: DifficultyLevel[] = ['easy', 'medium', 'hard']
const statusOptions: QuestionStatus[] = ['active', 'hidden']

function createBlankAnswers(): AnswerOption[] {
  return [1, 2, 3, 4].map(answerId => ({ id: answerId, content: '', isCorrect: answerId === 1 }))
}

function answerLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

interface ValidationCheck {
  key: string
  label: string
  passed: boolean
  hint: string
}

/** Mã đề trên query chỉ dùng được khi là số nguyên dương, ngoài ra coi như đang tạo đề mới. */
function readReturnExamId(rawValue: string | null): number | undefined {
  if (rawValue === null) return undefined
  const parsed = Number(rawValue)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export default function QuestionEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()

  const questionId = Number(id)
  const isEdit = Boolean(id)
  const hasValidQuestionId = Number.isInteger(questionId) && questionId > 0

  // Giáo viên đang soạn đề mà thiếu câu thì đi vòng qua đây, xong phải được trả về đúng chỗ cũ.
  const isReturningToExamBuilder = searchParams.get('quay-lai') === 'de'
  const returnExamId = readReturnExamId(searchParams.get('de'))
  const examBuilderPath = returnExamId === undefined
    ? '/giao-vien/bai-kiem-tra/tao'
    : `/giao-vien/bai-kiem-tra/${returnExamId}/sua`
  const backPath = isReturningToExamBuilder ? examBuilderPath : '/giao-vien/cau-hoi'

  // Đường dẫn sửa với mã không hợp lệ phải báo lỗi rõ ràng thay vì âm thầm mở form tạo mới.
  const loadQuestion = (): Promise<Question | undefined> => {
    if (!isEdit) return Promise.resolve(undefined)
    if (!hasValidQuestionId) return Promise.reject(new Error('Mã câu hỏi trên đường dẫn không hợp lệ.'))
    return getQuestion(questionId)
  }

  const {
    data: existingQuestion,
    loading: loadingQuestion,
    error: questionError,
    reload: reloadQuestion,
  } = useAsync(loadQuestion, [isEdit, questionId])

  const { data: topicSuggestions } = useAsync(() => listTopics(), [])

  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string>()
  // Chỉ điền sẵn chủ đề khi tạo mới, ở chế độ sửa thì dữ liệu của câu hỏi mới là nguồn đúng.
  const [topic, setTopic] = useState(() => (isEdit ? '' : (searchParams.get('chu-de') ?? '')))
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('easy')
  const [pointInput, setPointInput] = useState('0.5')
  const [status, setStatus] = useState<QuestionStatus>('active')
  const [answers, setAnswers] = useState<AnswerOption[]>(createBlankAnswers)
  const [answerIdsWithImageEditor, setAnswerIdsWithImageEditor] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  // Đổi khoá để khối xem trước quên đáp án đã bấm thử của câu vừa lưu.
  const [previewInstanceId, setPreviewInstanceId] = useState(0)

  // Đổ dữ liệu câu hỏi cũ vào form ngay khi service trả về.
  useEffect(() => {
    if (!existingQuestion) return
    setContent(existingQuestion.content)
    setImageUrl(existingQuestion.imageUrl)
    setTopic(existingQuestion.topic)
    setDifficulty(existingQuestion.difficulty)
    setPointInput(String(existingQuestion.defaultPoint))
    setStatus(existingQuestion.status)
    setAnswers(existingQuestion.answers.map(answer => ({ ...answer })))
    setAnswerIdsWithImageEditor(
      existingQuestion.answers.filter(answer => answer.imageUrl).map(answer => answer.id),
    )
  }, [existingQuestion])

  const defaultPoint = Number(pointInput)
  const correctAnswerIndex = answers.findIndex(answer => answer.isCorrect)
  const correctAnswerCount = answers.filter(answer => answer.isCorrect).length

  const emptyAnswerLetters = useMemo(
    () =>
      answers
        .map((answer, index) => (!answer.content.trim() && !answer.imageUrl ? answerLetter(index) : null))
        .filter((letter): letter is string => letter !== null),
    [answers],
  )

  const checks = useMemo<ValidationCheck[]>(() => {
    const trimmedContent = content.trim()
    const trimmedTopic = topic.trim()
    const hasValidPoint = Number.isFinite(defaultPoint) && defaultPoint > 0

    return [
      {
        key: 'content',
        label: 'Nội dung câu hỏi',
        passed: trimmedContent.length > 0,
        hint: trimmedContent.length > 0 ? `Đã nhập ${trimmedContent.length} ký tự` : 'Chưa nhập nội dung câu hỏi',
      },
      {
        key: 'topic',
        label: 'Chủ đề',
        passed: trimmedTopic.length > 0,
        hint: trimmedTopic.length > 0 ? trimmedTopic : 'Chưa chọn hoặc nhập chủ đề',
      },
      {
        key: 'point',
        label: 'Điểm mặc định',
        passed: hasValidPoint,
        hint: hasValidPoint ? `${defaultPoint} điểm cho câu này` : 'Điểm mặc định phải lớn hơn 0',
      },
      {
        key: 'answerCount',
        label: 'Số lượng đáp án',
        passed: answers.length >= MIN_ANSWERS && answers.length <= MAX_ANSWERS,
        hint:
          answers.length < MIN_ANSWERS
            ? `Cần thêm ít nhất ${MIN_ANSWERS - answers.length} đáp án nữa`
            : answers.length > MAX_ANSWERS
              ? `Chỉ được tối đa ${MAX_ANSWERS} đáp án`
              : `${answers.length} đáp án (cho phép từ ${MIN_ANSWERS} đến ${MAX_ANSWERS})`,
      },
      {
        key: 'answerContent',
        label: 'Nội dung các đáp án',
        passed: emptyAnswerLetters.length === 0,
        hint:
          emptyAnswerLetters.length === 0
            ? 'Mọi đáp án đều đã có nội dung hoặc ảnh'
            : `Đáp án ${emptyAnswerLetters.join(', ')} chưa có nội dung hoặc ảnh`,
      },
      {
        key: 'correctAnswer',
        label: 'Đáp án đúng',
        passed: correctAnswerCount === 1,
        hint:
          correctAnswerCount === 1
            ? `Đang chọn đáp án ${answerLetter(correctAnswerIndex)}`
            : correctAnswerCount === 0
              ? 'Chưa chọn đáp án đúng'
              : 'Chỉ được chọn duy nhất một đáp án đúng',
      },
    ]
  }, [answers.length, content, correctAnswerCount, correctAnswerIndex, defaultPoint, emptyAnswerLetters, topic])

  const failedChecks = checks.filter(check => !check.passed)
  const isValid = failedChecks.length === 0

  const setCorrectAnswer = (answerId: number) => {
    setAnswers(currentAnswers => currentAnswers.map(answer => ({
      ...answer,
      isCorrect: answer.id === answerId,
    })))
  }

  const updateAnswerContent = (answerId: number, value: string) => {
    setAnswers(currentAnswers => currentAnswers.map(answer => (
      answer.id === answerId ? { ...answer, content: value } : answer
    )))
  }

  // Xoá ảnh thì giữ nguyên ô tải ảnh để giáo viên chọn lại được ảnh khác ngay.
  const updateAnswerImage = (answerId: number, dataUrl: string | undefined) => {
    setAnswers(currentAnswers => currentAnswers.map(answer => (
      answer.id === answerId ? { ...answer, imageUrl: dataUrl } : answer
    )))
    setAnswerIdsWithImageEditor(currentIds => (
      currentIds.includes(answerId) ? currentIds : [...currentIds, answerId]
    ))
  }

  const toggleAnswerImageEditor = (answerId: number) => {
    const isOpen = answerIdsWithImageEditor.includes(answerId)
    if (isOpen) {
      setAnswerIdsWithImageEditor(currentIds => currentIds.filter(currentId => currentId !== answerId))
      setAnswers(currentAnswers => currentAnswers.map(answer => (
        answer.id === answerId ? { ...answer, imageUrl: undefined } : answer
      )))
      return
    }
    setAnswerIdsWithImageEditor(currentIds => [...currentIds, answerId])
  }

  // Sinh id ngay trong hàm cập nhật để hai lần bấm liên tiếp không tạo ra hai đáp án trùng id.
  const addAnswer = () => {
    setAnswers(currentAnswers => {
      if (currentAnswers.length >= MAX_ANSWERS) return currentAnswers
      const nextAnswerId = currentAnswers.reduce((largestId, answer) => Math.max(largestId, answer.id), 0) + 1
      return [...currentAnswers, { id: nextAnswerId, content: '', isCorrect: currentAnswers.length === 0 }]
    })
  }

  const removeAnswer = (answerId: number) => {
    if (answers.length <= MIN_ANSWERS) return
    const removedAnswer = answers.find(answer => answer.id === answerId)
    const nextAnswers = answers.filter(answer => answer.id !== answerId)
    // Xoá mất đáp án đúng thì chuyển quyền đó cho đáp án đầu tiên còn lại.
    if (removedAnswer?.isCorrect && nextAnswers.length > 0) {
      nextAnswers[0] = { ...nextAnswers[0], isCorrect: true }
    }
    setAnswers(nextAnswers)
    setAnswerIdsWithImageEditor(currentIds => currentIds.filter(currentId => currentId !== answerId))
  }

  const buildPayload = (): QuestionPayload => ({
    content: content.trim(),
    imageUrl,
    topic: topic.trim(),
    difficulty,
    defaultPoint,
    answers: answers.map(answer => ({ ...answer, content: answer.content.trim() })),
  })

  // Giữ lại chủ đề, độ khó và điểm vì giáo viên thường nhập liền một mạch nhiều câu cùng dạng.
  const resetForNextQuestion = () => {
    setContent('')
    setImageUrl(undefined)
    setAnswers(createBlankAnswers())
    setAnswerIdsWithImageEditor([])
    setPreviewInstanceId(currentId => currentId + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async (keepCreating: boolean) => {
    if (!isValid || saving) return

    if (isEdit) {
      // Ẩn/hiện câu hỏi đi qua một endpoint riêng chứ không nằm trong nội dung câu hỏi. So với
      // trạng thái trong phản hồi để chỉ gọi thêm khi ô chọn thật sự khác — bỏ hẳn lời gọi này thì
      // ô "Trạng thái" trên form trở thành một điều khiển giả, bấm xong không có gì xảy ra.
      const persist = async () => {
        const saved = await updateQuestion(questionId, buildPayload())
        if (saved.status !== status) await setQuestionStatus(saved.id, status)
      }

      // Đổi ô trạng thái rồi bấm Lưu là ẩn hoặc hiện câu hỏi thật, nên hỏi lại đúng như nút ẩn ở
      // ngân hàng câu hỏi — hai lối vào cùng một việc thì không được một lối hỏi, một lối không.
      // Hiện lại thì cả hai lối đều không hỏi — quy tắc đó nằm trong questionStatusConfirmCopy.
      const statusCopy =
        existingQuestion && existingQuestion.status !== status
          ? questionStatusConfirmCopy({ content, difficulty }, status)
          : null
      if (statusCopy) {
        const saved = await confirm({
          ...statusCopy,
          confirmLabel: 'Lưu và ẩn câu hỏi',
          onConfirm: persist,
        })
        if (!saved) return
      } else {
        setSaving(true)
        try {
          await persist()
        } catch (caught) {
          toast.error(caught instanceof Error ? caught.message : 'Không lưu được câu hỏi. Vui lòng thử lại.')
          setSaving(false)
          return
        }
      }

      toast.success('Đã lưu thay đổi cho câu hỏi.')
      navigate(backPath)
      return
    }

    setSaving(true)
    try {
      const created = await createQuestion(buildPayload())
      if (created.status !== status) await setQuestionStatus(created.id, status)
      if (keepCreating) {
        toast.success('Đã tạo câu hỏi. Mời bạn nhập câu tiếp theo.')
        resetForNextQuestion()
        return
      }
      toast.success(
        isReturningToExamBuilder
          ? 'Đã thêm câu hỏi. Quay lại bài kiểm tra bạn đang soạn.'
          : 'Đã thêm câu hỏi mới vào ngân hàng.',
      )
      navigate(backPath)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không lưu được câu hỏi. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const backLink = (
    <div className="mb-5">
      <NavLink
        to={backPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft size={16} />
        {isReturningToExamBuilder ? 'Quay lại bài kiểm tra đang soạn' : 'Quay lại ngân hàng câu hỏi'}
      </NavLink>
    </div>
  )

  const examBuilderNotice = isReturningToExamBuilder && (
    <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 flex items-start gap-2.5">
      <Info size={17} className="text-indigo-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-indigo-700 leading-relaxed">
        Đang thêm câu hỏi cho bài kiểm tra đang soạn. Cấu hình đề vẫn được giữ nguyên — lưu xong câu
        hỏi là bạn quay về đúng chỗ cũ. Cần bổ sung nhiều câu thì dùng nút{' '}
        <strong className="font-semibold">Lưu và tạo câu tiếp theo</strong>.
      </p>
    </div>
  )

  const pageTitle = isEdit ? 'Sửa câu hỏi' : 'Tạo câu hỏi'
  const pageSubtitle = 'Câu hỏi trắc nghiệm một đáp án đúng'

  if (isEdit && loadingQuestion) {
    return (
      <TeacherLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle}>
        {backLink}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-28 w-full rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SkeletonBlock className="h-11 rounded-xl" />
                <SkeletonBlock className="h-11 rounded-xl" />
                <SkeletonBlock className="h-11 rounded-xl" />
              </div>
              <SkeletonBlock className="h-24 w-full rounded-2xl" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
              <SkeletonBlock className="h-4 w-28" />
              {[1, 2, 3, 4].map(rowKey => (
                <SkeletonBlock key={rowKey} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3 h-fit">
            <SkeletonBlock className="h-4 w-32" />
            {[1, 2, 3, 4, 5].map(rowKey => (
              <SkeletonBlock key={rowKey} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </TeacherLayout>
    )
  }

  if (isEdit && questionError) {
    return (
      <TeacherLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle}>
        {backLink}
        <ErrorState message={questionError} onRetry={reloadQuestion} />
      </TeacherLayout>
    )
  }

  return (
    <TeacherLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle}>
      {backLink}
      {examBuilderNotice}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start animate-fade-in-up">
        <div className="space-y-6 min-w-0">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-800 mb-5">Nội dung câu hỏi</h2>

            <div className="space-y-5">
              <div>
                <label htmlFor="question-content" className="block text-sm font-semibold text-slate-700 mb-2">
                  Đề bài
                </label>
                <textarea
                  id="question-content"
                  value={content}
                  onChange={event => setContent(event.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  placeholder="Nhập nội dung câu hỏi"
                />
              </div>

              <ImageUploader
                label="Hình minh họa cho câu hỏi (không bắt buộc)"
                value={imageUrl}
                onChange={setImageUrl}
              />

              <div>
                <label htmlFor="question-topic" className="block text-sm font-semibold text-slate-700 mb-2">
                  Chủ đề
                </label>
                <input
                  id="question-topic"
                  list="question-topic-options"
                  value={topic}
                  onChange={event => setTopic(event.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  placeholder="Ví dụ: Điện học"
                />
                <datalist id="question-topic-options">
                  {(topicSuggestions ?? []).map(topicOption => (
                    <option key={topicOption} value={topicOption} />
                  ))}
                </datalist>
                <p className="text-xs text-slate-400 mt-2">
                  Chọn một chủ đề có sẵn trong ngân hàng hoặc gõ tên chủ đề mới.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="question-difficulty" className="block text-sm font-semibold text-slate-700 mb-2">
                    Độ khó
                  </label>
                  <select
                    id="question-difficulty"
                    value={difficulty}
                    onChange={event => setDifficulty(event.target.value as DifficultyLevel)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 bg-white"
                  >
                    {difficultyOptions.map(difficultyOption => (
                      <option key={difficultyOption} value={difficultyOption}>
                        {difficultyLabels[difficultyOption]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="question-point" className="block text-sm font-semibold text-slate-700 mb-2">
                    Điểm mặc định
                  </label>
                  <input
                    id="question-point"
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={pointInput}
                    onChange={event => setPointInput(event.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div>
                  <label htmlFor="question-status" className="block text-sm font-semibold text-slate-700 mb-2">
                    Trạng thái
                  </label>
                  <select
                    id="question-status"
                    value={status}
                    onChange={event => setStatus(event.target.value as QuestionStatus)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 bg-white"
                  >
                    {statusOptions.map(statusOption => (
                      <option key={statusOption} value={statusOption}>
                        {questionStatusLabels[statusOption]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Đáp án</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bấm vào ô chữ cái để chọn đáp án đúng. Mỗi câu có từ {MIN_ANSWERS} đến {MAX_ANSWERS} đáp án.
                </p>
              </div>
              <button
                type="button"
                onClick={addAnswer}
                disabled={answers.length >= MAX_ANSWERS}
                title={answers.length >= MAX_ANSWERS ? `Tối đa ${MAX_ANSWERS} đáp án` : 'Thêm một đáp án mới'}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-50"
              >
                <Plus size={15} /> Thêm đáp án
              </button>
            </div>

            <div className="space-y-3">
              {answers.map((answer, index) => (
                <AnswerEditorRow
                  key={answer.id}
                  answer={answer}
                  index={index}
                  canRemove={answers.length > MIN_ANSWERS}
                  imageOpen={answerIdsWithImageEditor.includes(answer.id) || Boolean(answer.imageUrl)}
                  onContentChange={value => updateAnswerContent(answer.id, value)}
                  onImageChange={dataUrl => updateAnswerImage(answer.id, dataUrl)}
                  onToggleImage={() => toggleAnswerImageEditor(answer.id)}
                  onMarkCorrect={() => setCorrectAnswer(answer.id)}
                  onRemove={() => removeAnswer(answer.id)}
                />
              ))}
            </div>
          </section>

          <QuestionPreview
            key={previewInstanceId}
            content={content}
            imageUrl={imageUrl}
            topic={topic}
            difficulty={difficulty}
            point={Number.isFinite(defaultPoint) ? defaultPoint : 0}
            answers={answers}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <ListChecks size={17} className="text-indigo-500" />
              <h2 className="text-base font-bold text-slate-800">Kiểm tra nhanh</h2>
            </div>
            <p className={`text-sm font-semibold mb-4 ${isValid ? 'text-emerald-600' : 'text-amber-600'}`}>
              {isValid
                ? 'Câu hỏi đã hợp lệ, có thể lưu.'
                : `Còn ${failedChecks.length} mục cần hoàn thiện.`}
            </p>

            <ul className="space-y-3">
              {checks.map(check => (
                <li key={check.key} className="flex items-start gap-2.5">
                  {check.passed ? (
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{check.label}</p>
                    <p className={`text-xs mt-0.5 break-words ${check.passed ? 'text-slate-400' : 'text-amber-600'}`}>
                      {check.hint}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={!isValid || saving}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {isEdit ? 'Lưu thay đổi' : 'Tạo câu hỏi'}
            </button>

            {!isEdit && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={!isValid || saving}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50"
              >
                <Plus size={16} /> Lưu và tạo câu tiếp theo
              </button>
            )}

            <NavLink
              to={backPath}
              className="w-full inline-flex items-center justify-center px-5 py-3 rounded-2xl text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Huỷ
            </NavLink>
          </div>
        </aside>
      </div>
    </TeacherLayout>
  )
}
