import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Info, Loader2, Plus, Save } from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import ComboboxInput from '../../../components/common/ComboboxInput'
import ErrorState from '../../../components/common/ErrorState'
import SlidingSegments from '../../../components/common/SlidingSegments'
import ImageUploader from '../../../components/common/ImageUploader'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import { useConfirm } from '../../../components/common/ConfirmProvider'
import { useToast } from '../../../components/common/Toast'
import { useAsync } from '../../../hooks/useAsync'
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard'
import { getCurrentUser } from '../../../services/authService'
import {
  createQuestion,
  getQuestion,
  listSubjects,
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
  type Subject,
} from '../../../types'
import AnswerEditorRow from '../components/AnswerEditorRow'
import QuestionPreview from '../components/QuestionPreview'
import SaveQuestionDialog from '../components/SaveQuestionDialog'
import { questionStatusConfirmCopy } from '../utils/questionConfirmations'
import { questionBankPath, type QuestionAudience } from '../utils/questionAudience'

const MIN_ANSWERS = 2
const MAX_ANSWERS = 6
/** Khớp trần của server (`SaveQuestionRequestValidator.MaxTitleLength`). */
const MAX_TITLE_LENGTH = 200
/** Khớp trần của server (`SaveQuestionRequestValidator.MaxTopicLength`). */
const MAX_TOPIC_LENGTH = 128

const difficultyOptions: DifficultyLevel[] = ['easy', 'medium', 'hard']
const statusOptions: QuestionStatus[] = ['active', 'hidden']

type EditorTab = 'noi-dung' | 'dap-an' | 'xem-truoc'

/** `shortLabel` cho màn hình hẹp, nơi ba nhãn đầy đủ không vừa một hàng. */
const editorTabs: { id: EditorTab; label: string; shortLabel: string }[] = [
  { id: 'noi-dung', label: 'Nội dung câu hỏi', shortLabel: 'Nội dung' },
  { id: 'dap-an', label: 'Đáp án', shortLabel: 'Đáp án' },
  { id: 'xem-truoc', label: 'Xem trước', shortLabel: 'Xem trước' },
]

/** Mục kiểm nào thuộc tab nào: bấm vào một mục chưa đạt thì nhảy tới đúng tab cần sửa. */
const CHECK_TAB: Record<string, EditorTab> = {
  subject: 'noi-dung',
  title: 'noi-dung',
  content: 'noi-dung',
  topic: 'noi-dung',
  point: 'noi-dung',
  answerCount: 'dap-an',
  answerContent: 'dap-an',
  correctAnswer: 'dap-an',
}

const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const labelClass = 'block text-xs font-semibold text-slate-600 mb-1'
const inputClass =
  'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'
const selectClass =
  'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50'
/** Ô còn thiếu: sáng viền và nền màu hổ phách ngay từ đầu, để người dùng thấy ô nào phải điền mà không phải đọc danh sách. */
const attentionClass =
  'w-full px-3 py-2 rounded-xl border border-amber-400 bg-amber-50/70 text-sm outline-none transition-colors ring-4 ring-amber-100 focus:border-amber-500 focus:ring-amber-100'

function createBlankAnswers(): AnswerOption[] {
  return [1, 2, 3, 4].map(answerId => ({ id: answerId, content: '', isCorrect: answerId === 1 }))
}

function answerLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

interface FormValues {
  title: string
  content: string
  imageUrl?: string
  topic: string
  difficulty: DifficultyLevel
  allowMultiple: boolean
  point: string
  status: QuestionStatus
  answers: { content: string; imageUrl?: string; isCorrect: boolean }[]
}

/** Dấu vết của những gì đang nhập, bỏ khoảng trắng thừa: so với dấu vết lúc mở (hay lúc lưu xong) để biết còn gì chưa lưu. */
function snapshotOf(values: FormValues): string {
  return JSON.stringify({
    ...values,
    title: values.title.trim(),
    content: values.content.trim(),
    topic: values.topic.trim(),
    answers: values.answers.map(answer => ({
      content: answer.content.trim(),
      imageUrl: answer.imageUrl,
      isCorrect: answer.isCorrect,
    })),
  })
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

interface QuestionEditorPageProps {
  /** Giáo viên soạn trong môn của mình. Quản trị viên phải chọn môn khi tạo và sửa được câu của bất kỳ ai. */
  audience: QuestionAudience
}

export default function QuestionEditorPage({ audience }: QuestionEditorPageProps) {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const isAdmin = audience === 'admin'
  const basePath = questionBankPath[audience]
  const Layout = isAdmin ? AdminLayout : TeacherLayout

  const questionId = Number(id)
  const isEdit = Boolean(id)
  const hasValidQuestionId = Number.isInteger(questionId) && questionId > 0

  // Giáo viên đang soạn đề mà thiếu câu thì đi vòng qua đây, xong phải được trả về đúng chỗ cũ. Quản trị viên không soạn đề nên
  // không có đường vòng này.
  const isReturningToExamBuilder = !isAdmin && searchParams.get('quay-lai') === 'de'
  const returnExamId = readReturnExamId(searchParams.get('de'))
  const examBuilderPath = returnExamId === undefined
    ? '/giao-vien/bai-kiem-tra/tao'
    : `/giao-vien/bai-kiem-tra/${returnExamId}/sua`
  const backPath = isReturningToExamBuilder ? examBuilderPath : basePath

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

  // Môn của câu hỏi. Giáo viên không chọn (server lấy từ tài khoản). Quản trị viên chọn khi tạo; khi sửa thì môn đã cố định. Chỉ
  // có một môn thì chọn sẵn.
  const subjectsState = useAsync<Subject[]>(() => (isAdmin ? listSubjects() : Promise.resolve([])), [isAdmin])
  const subjects = subjectsState.data ?? []
  const [subjectChoice, setSubjectChoice] = useState('')
  const subjectId: number | undefined = !isAdmin
    ? undefined
    : isEdit
      ? existingQuestion?.subjectId
      : subjectChoice !== ''
        ? Number(subjectChoice)
        : subjects.length === 1
          ? subjects[0].id
          : undefined

  // Gợi ý chủ đề theo môn đang soạn: quản trị viên đọc cả ngân hàng nên không thu hẹp thì sẽ thấy chủ đề của môn khác.
  const { data: topicSuggestions } = useAsync(() => listTopics(isAdmin ? subjectId : undefined), [isAdmin, subjectId])

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string>()
  // Chỉ điền sẵn chủ đề khi tạo mới, ở chế độ sửa thì dữ liệu của câu hỏi mới là nguồn đúng.
  const [topic, setTopic] = useState(() => (isEdit ? '' : (searchParams.get('chu-de') ?? '')))
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('easy')
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [pointInput, setPointInput] = useState('0.5')
  const [status, setStatus] = useState<QuestionStatus>('active')
  const [answers, setAnswers] = useState<AnswerOption[]>(createBlankAnswers)
  const [answerIdsWithImageEditor, setAnswerIdsWithImageEditor] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<EditorTab>('noi-dung')
  // Ô ảnh nào đang tải lên ('question' hoặc 'answer-<id>'). Còn ô nào thì chưa được lưu: ảnh chưa có
  // đường dẫn từ server, lưu lúc này là mất ảnh giáo viên vừa chọn.
  const [uploadingImageKeys, setUploadingImageKeys] = useState<string[]>([])
  const isUploadingImage = uploadingImageKeys.length > 0
  // Đổi khoá để khối xem trước quên đáp án đã bấm thử của câu vừa lưu.
  const [previewInstanceId, setPreviewInstanceId] = useState(0)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  // Dấu vết "sạch": lúc mới mở form tạo, lúc câu cũ vừa nạp xong, và lúc vừa lưu xong để soạn tiếp. Khác dấu vết hiện tại
  // nghĩa là còn thay đổi chưa lưu. Câu cũ chưa nạp xong thì chưa có gì để so (null), không coi là thay đổi.
  const [cleanSnapshot, setCleanSnapshot] = useState<string | null>(() => (isEdit
    ? null
    : snapshotOf({
      title: '',
      content: '',
      imageUrl: undefined,
      topic: searchParams.get('chu-de') ?? '',
      difficulty: 'easy',
      allowMultiple: false,
      point: '0.5',
      status: 'active',
      answers: createBlankAnswers(),
    })))

  // Đổ dữ liệu câu hỏi cũ vào form ngay khi service trả về.
  useEffect(() => {
    if (!existingQuestion) return
    setTitle(existingQuestion.title)
    setContent(existingQuestion.content)
    setImageUrl(existingQuestion.imageUrl)
    setTopic(existingQuestion.topic)
    setDifficulty(existingQuestion.difficulty)
    setAllowMultiple(existingQuestion.allowMultiple)
    setPointInput(String(existingQuestion.defaultPoint))
    setStatus(existingQuestion.status)
    setAnswers(existingQuestion.answers.map(answer => ({ ...answer })))
    setAnswerIdsWithImageEditor(
      existingQuestion.answers.filter(answer => answer.imageUrl).map(answer => answer.id),
    )
    setCleanSnapshot(snapshotOf({
      title: existingQuestion.title,
      content: existingQuestion.content,
      imageUrl: existingQuestion.imageUrl,
      topic: existingQuestion.topic,
      difficulty: existingQuestion.difficulty,
      allowMultiple: existingQuestion.allowMultiple,
      point: String(existingQuestion.defaultPoint),
      status: existingQuestion.status,
      answers: existingQuestion.answers,
    }))
  }, [existingQuestion])

  const defaultPoint = Number(pointInput)
  const correctAnswerIndex = answers.findIndex(answer => answer.isCorrect)
  const correctAnswerCount = answers.filter(answer => answer.isCorrect).length
  const correctLetters = answers
    .map((answer, index) => (answer.isCorrect ? answerLetter(index) : null))
    .filter((letter): letter is string => letter !== null)

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
        key: 'subject',
        label: 'Môn học',
        // Chỉ quản trị viên khi tạo mới phải chọn: giáo viên lấy môn từ tài khoản, còn sửa thì môn đã có sẵn.
        passed: !isAdmin || isEdit || subjectId !== undefined,
        hint: subjectId !== undefined ? 'Đã chọn môn' : 'Chưa chọn môn học',
      },
      {
        key: 'title',
        label: 'Tên câu hỏi',
        passed: title.trim().length > 0,
        hint: title.trim().length > 0 ? title.trim() : 'Chưa nhập tên câu hỏi',
      },
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
        // Câu một đáp án: đúng một ô. Câu nhiều đáp án: từ một ô trở lên (có thể chỉ một ô đúng).
        passed: allowMultiple ? correctAnswerCount >= 1 : correctAnswerCount === 1,
        hint:
          correctAnswerCount === 0
            ? 'Chưa chọn đáp án đúng'
            : allowMultiple
              ? `Đang chọn ${correctAnswerCount} đáp án đúng: ${correctLetters.join(', ')}`
              : correctAnswerCount === 1
                ? `Đang chọn đáp án ${answerLetter(correctAnswerIndex)}`
                : 'Chỉ được chọn duy nhất một đáp án đúng',
      },
    ]
  }, [
    allowMultiple, answers.length, content, correctAnswerCount, correctAnswerIndex, correctLetters, defaultPoint,
    emptyAnswerLetters, isAdmin, isEdit, subjectId, title, topic,
  ])

  const failedChecks = checks.filter(check => !check.passed)
  const isValid = failedChecks.length === 0
  const canSave = isValid && !saving && !isUploadingImage

  const currentSnapshot = snapshotOf({
    title, content, imageUrl, topic, difficulty, allowMultiple, point: pointInput, status, answers,
  })
  const hasUnsavedChanges = cleanSnapshot !== null && currentSnapshot !== cleanSnapshot
  const guard = useUnsavedChangesGuard(hasUnsavedChanges)

  // Ô nào còn thiếu thì sáng lên ngay trên form (thay cho hộp liệt kê "còn N mục cần hoàn thiện" ở bên phải).
  const isFailed = (key: string) => failedChecks.some(check => check.key === key)
  const subjectMissing = isFailed('subject')
  const titleMissing = isFailed('title')
  const contentMissing = isFailed('content')
  const topicMissing = isFailed('topic')
  const pointMissing = isFailed('point')
  const answersTooFew = answers.length < MIN_ANSWERS
  const correctMissing = isFailed('correctAnswer') && correctAnswerCount === 0

  const setImageUploading = (key: string, uploading: boolean) => {
    setUploadingImageKeys(currentKeys => {
      if (uploading) return currentKeys.includes(key) ? currentKeys : [...currentKeys, key]
      return currentKeys.filter(currentKey => currentKey !== key)
    })
  }

  // Câu một đáp án: chọn ô nào thì chỉ ô đó đúng. Câu nhiều đáp án: bấm là bật hoặc tắt riêng ô đó.
  const setCorrectAnswer = (answerId: number) => {
    setAnswers(currentAnswers => currentAnswers.map(answer => {
      if (allowMultiple) return answer.id === answerId ? { ...answer, isCorrect: !answer.isCorrect } : answer
      return { ...answer, isCorrect: answer.id === answerId }
    }))
  }

  // Đổi loại câu. Sang "một đáp án" mà đang có nhiều ô đúng thì chỉ giữ ô đúng đầu tiên, và nói ra để giáo
  // viên không tưởng các ô kia vẫn còn đúng.
  const changeAllowMultiple = (next: boolean) => {
    if (next === allowMultiple) return
    setAllowMultiple(next)
    if (next || correctAnswerCount <= 1) return

    const keep = answers.findIndex(answer => answer.isCorrect)
    setAnswers(currentAnswers => currentAnswers.map((answer, index) => ({ ...answer, isCorrect: index === keep })))
    toast.info(`Câu một đáp án chỉ có một đáp án đúng: đã giữ đáp án ${answerLetter(keep)}.`)
  }

  const updateAnswerContent = (answerId: number, value: string) => {
    setAnswers(currentAnswers => currentAnswers.map(answer => (
      answer.id === answerId ? { ...answer, content: value } : answer
    )))
  }

  // Xoá ảnh thì giữ nguyên ô tải ảnh để giáo viên chọn lại được ảnh khác ngay.
  const updateAnswerImage = (answerId: number, url: string | undefined) => {
    setAnswers(currentAnswers => currentAnswers.map(answer => (
      answer.id === answerId ? { ...answer, imageUrl: url } : answer
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

  // Id lớn nhất từng cấp trong lần soạn này. Xoá đáp án cuối rồi thêm đáp án mới không được nhận lại id vừa bỏ,
  // nếu không phần xem trước coi đáp án mới là "đã chọn" theo lựa chọn cũ.
  const largestAnswerIdRef = useRef(0)

  // Sinh id ngay trong hàm cập nhật để hai lần bấm liên tiếp không tạo ra hai đáp án trùng id.
  const addAnswer = () => {
    setAnswers(currentAnswers => {
      if (currentAnswers.length >= MAX_ANSWERS) return currentAnswers
      const largestNow = currentAnswers.reduce((largestId, answer) => Math.max(largestId, answer.id), 0)
      largestAnswerIdRef.current = Math.max(largestAnswerIdRef.current, largestNow) + 1
      return [
        ...currentAnswers,
        { id: largestAnswerIdRef.current, content: '', isCorrect: currentAnswers.length === 0 },
      ]
    })
  }

  const removeAnswer = (answerId: number) => {
    if (answers.length <= MIN_ANSWERS) return
    const removedAnswer = answers.find(answer => answer.id === answerId)
    const nextAnswers = answers.filter(answer => answer.id !== answerId)
    // Xoá mất đáp án đúng cuối cùng thì chuyển quyền đó cho đáp án đầu tiên còn lại. Câu nhiều đáp án còn ô
    // đúng khác thì không đụng tới ô nào.
    if (removedAnswer?.isCorrect && nextAnswers.length > 0 && nextAnswers.every(answer => !answer.isCorrect)) {
      nextAnswers[0] = { ...nextAnswers[0], isCorrect: true }
    }
    setAnswers(nextAnswers)
    setAnswerIdsWithImageEditor(currentIds => currentIds.filter(currentId => currentId !== answerId))
  }

  const buildPayload = (): QuestionPayload => ({
    title: title.trim(),
    content: content.trim(),
    imageUrl,
    topic: topic.trim(),
    difficulty,
    allowMultiple,
    defaultPoint,
    answers: answers.map(answer => ({ ...answer, content: answer.content.trim() })),
    // Chỉ quản trị viên gửi môn, và chỉ khi tạo: sửa thì câu hỏi không chuyển môn giữa chừng.
    subjectId: isAdmin && !isEdit ? subjectId : undefined,
  })

  // Giữ lại chủ đề, độ khó và điểm vì giáo viên thường nhập liền một mạch nhiều câu cùng dạng.
  const resetForNextQuestion = () => {
    setCleanSnapshot(snapshotOf({
      title: '', content: '', imageUrl: undefined, topic, difficulty, allowMultiple, point: pointInput, status,
      answers: createBlankAnswers(),
    }))
    setTitle('')
    setContent('')
    setImageUrl(undefined)
    setAnswers(createBlankAnswers())
    setAnswerIdsWithImageEditor([])
    setPreviewInstanceId(currentId => currentId + 1)
    // Câu mới bắt đầu từ đề bài, không phải từ tab Đáp án hay Xem trước đang đứng ở câu vừa lưu.
    setActiveTab('noi-dung')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async (keepCreating: boolean) => {
    if (!canSave) return

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
      const otherAuthor =
        isAdmin && existingQuestion && existingQuestion.createdByUserId !== getCurrentUser()?.id
          ? existingQuestion.createdBy || undefined
          : undefined
      const statusCopy =
        existingQuestion && existingQuestion.status !== status
          ? questionStatusConfirmCopy({ title, content, difficulty }, status, otherAuthor)
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
      guard.leaveWithoutAsking(() => navigate(backPath))
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
      guard.leaveWithoutAsking(() => navigate(backPath))
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Không lưu được câu hỏi. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  // Nằm trên thanh tiêu đề (hẹp hơn cỡ lg thì xuống đầu nội dung) để không chiếm một hàng của form — cùng
  // chỗ với nút quay lại của các trang soạn và chi tiết bài kiểm tra.
  const backLink = (
    <div className="flex w-full justify-start lg:justify-end">
      <NavLink
        to={backPath}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        <ArrowLeft size={16} />
        {isReturningToExamBuilder ? 'Quay lại bài kiểm tra đang soạn' : 'Quay lại ngân hàng câu hỏi'}
      </NavLink>
    </div>
  )

  const examBuilderNotice = isReturningToExamBuilder && (
    <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 flex items-start gap-2">
      <Info size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-indigo-700 leading-relaxed">
        Đang thêm câu cho bài kiểm tra đang soạn: cấu hình đề được giữ nguyên, lưu xong là quay về đúng chỗ cũ. Cần
        thêm nhiều câu thì bấm nút lưu rồi chọn <strong className="font-semibold">Lưu và tạo câu tiếp theo</strong>.
      </p>
    </div>
  )

  const pageTitle = isEdit ? 'Sửa câu hỏi' : 'Tạo câu hỏi'
  const pageSubtitle =
    isAdmin && isEdit && existingQuestion
      ? `Câu hỏi của ${existingQuestion.createdBy || 'giáo viên'} · ${existingQuestion.subject || 'môn chưa rõ'}`
      : isAdmin
        ? 'Câu hỏi thuộc môn đã chọn; giáo viên của môn đó dùng được'
        : 'Câu hỏi trắc nghiệm một hoặc nhiều đáp án đúng'

  if (isEdit && loadingQuestion) {
    return (
      <Layout pageTitle={pageTitle} pageSubtitle={pageSubtitle} compactContent headerTools={backLink}>
        <div>
          <div className="space-y-3">
            <SkeletonBlock className="h-10 w-72 rounded-2xl" />
            <div className={`${cardClass} p-4 space-y-3`}>
              <SkeletonBlock className="h-10 w-full rounded-xl" />
              <SkeletonBlock className="h-24 w-full rounded-xl" />
              <SkeletonBlock className="h-10 w-full rounded-xl" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(rowKey => (
                  <SkeletonBlock key={rowKey} className="h-10 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (isEdit && questionError) {
    return (
      <Layout pageTitle={pageTitle} pageSubtitle={pageSubtitle} compactContent headerTools={backLink}>
        <ErrorState message={questionError} onRetry={reloadQuestion} />
      </Layout>
    )
  }

  // Nằm cùng hàng với các tab, bên phải: khung soạn được kéo ra hết chiều ngang, không còn cột nút riêng. Bấm chỉ mở hộp xác nhận.
  const saveButton = (
    <button
      type="button"
      onClick={() => setSaveDialogOpen(true)}
      disabled={!canSave}
      title={!isValid ? 'Điền các ô đang sáng viền vàng để lưu được' : undefined}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
    >
      {saving || isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      {isUploadingImage ? 'Đang tải ảnh lên…' : isEdit ? 'Lưu thay đổi' : 'Tạo câu hỏi'}
    </button>
  )

  return (
    <Layout pageTitle={pageTitle} pageSubtitle={pageSubtitle} compactContent headerTools={backLink}>
      {examBuilderNotice}

      <div className="min-w-0 animate-fade-in-up">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <SlidingSegments
            role="tablist"
            aria-label="Các phần của câu hỏi"
            activeKey={activeTab}
            className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 w-full sm:w-fit"
          >
            {editorTabs.map(tab => {
              const isActive = activeTab === tab.id
              // Chấm vàng ở tab KHÁC tab đang mở: nhắc rằng bên đó còn ô chưa xong. Ở tab đang mở thì chính các ô
              // còn thiếu đã sáng viền vàng.
              const needsWork = !isActive && failedChecks.some(check => CHECK_TAB[check.key] === tab.id)

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`question-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`question-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  data-tab-active={isActive}
                  className={`relative z-10 inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === 'dap-an' && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {answers.length}
                    </span>
                  )}
                  {tab.id === 'dap-an' && allowMultiple && (
                    <span className="px-1.5 h-5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold flex items-center">
                      Nhiều đáp án
                    </span>
                  )}
                  {needsWork && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-amber-500"
                      title="Phần này còn mục chưa hoàn thiện"
                      aria-label="còn mục chưa hoàn thiện"
                    />
                  )}
                </button>
              )
            })}
          </SlidingSegments>

          {saveButton}
          </div>

          {/* Cả ba phần luôn nằm trong DOM và chỉ bị ẩn khi không mở: ô tải ảnh đang chạy mà bị gỡ khỏi màn
              hình thì lượt tải bị huỷ, và đổi tab không được phép làm mất ảnh giáo viên vừa chọn. */}
          <section
            role="tabpanel"
            id="question-panel-noi-dung"
            aria-labelledby="question-tab-noi-dung"
            hidden={activeTab !== 'noi-dung'}
            className={`${cardClass} p-4 space-y-3 animate-tab-in`}
          >
            <div>
              <label htmlFor="question-title" className={labelClass}>
                Tên câu hỏi <span className="text-red-500">*</span>{' '}
                <span className="font-normal text-slate-400">· để giáo viên tìm lại, học sinh không thấy</span>
              </label>
              <input
                id="question-title"
                value={title}
                maxLength={MAX_TITLE_LENGTH}
                onChange={event => setTitle(event.target.value)}
                aria-required="true"
                data-attention={titleMissing ? 'true' : undefined}
                className={titleMissing ? attentionClass : inputClass}
                placeholder="Ví dụ: Tính điện trở tương đương"
              />
            </div>

            <div>
              <label htmlFor="question-content" className={labelClass}>
                Đề bài <span className="text-red-500">*</span>
              </label>
              <textarea
                id="question-content"
                value={content}
                onChange={event => setContent(event.target.value)}
                rows={4}
                aria-required="true"
                data-attention={contentMissing ? 'true' : undefined}
                className={`${contentMissing ? attentionClass : inputClass} resize-y`}
                placeholder="Nhập nội dung câu hỏi"
              />
            </div>

            <ImageUploader
              key={previewInstanceId}
              label="Hình minh họa cho câu hỏi (không bắt buộc)"
              value={imageUrl}
              onChange={setImageUrl}
              onUploadingChange={uploading => setImageUploading('question', uploading)}
            />

            <div
              className={`grid grid-cols-2 gap-3 ${
                isAdmin
                  ? 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]'
                  : 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]'
              }`}
            >
              {isAdmin && (
                <div className="col-span-2 md:col-span-1">
                  <label htmlFor="question-subject" className={labelClass}>
                    Môn học {!isEdit && <span className="text-red-500">*</span>}
                  </label>
                  {isEdit ? (
                    <p
                      id="question-subject"
                      title="Câu hỏi không chuyển sang môn khác được"
                      className="truncate px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600"
                    >
                      {existingQuestion?.subject || '—'}
                    </p>
                  ) : (
                    <select
                      id="question-subject"
                      value={subjectId === undefined ? '' : String(subjectId)}
                      onChange={event => setSubjectChoice(event.target.value)}
                      disabled={subjects.length === 1}
                      aria-required="true"
                      data-attention={subjectMissing ? 'true' : undefined}
                      className={subjectMissing ? attentionClass : selectClass}
                    >
                      <option value="">Chọn môn</option>
                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {subjectsState.error && !isEdit && (
                    <p className="mt-1 text-xs text-red-600">Không tải được danh sách môn. Tải lại trang để thử lại.</p>
                  )}
                </div>
              )}
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="question-topic" className={labelClass}>
                  Chủ đề <span className="text-red-500">*</span>
                </label>
                <ComboboxInput
                  id="question-topic"
                  value={topic}
                  onChange={setTopic}
                  options={topicSuggestions ?? []}
                  maxLength={MAX_TOPIC_LENGTH}
                  placeholder="Ví dụ: Điện học"
                  noun="chủ đề"
                  attention={topicMissing}
                />
              </div>
              <div>
                <label htmlFor="question-difficulty" className={labelClass}>
                  Độ khó
                </label>
                <select
                  id="question-difficulty"
                  value={difficulty}
                  onChange={event => setDifficulty(event.target.value as DifficultyLevel)}
                  className={selectClass}
                >
                  {difficultyOptions.map(difficultyOption => (
                    <option key={difficultyOption} value={difficultyOption}>
                      {difficultyLabels[difficultyOption]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="question-point" className={labelClass}>
                  Điểm <span className="text-red-500">*</span>
                </label>
                <input
                  id="question-point"
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={pointInput}
                  onChange={event => setPointInput(event.target.value)}
                  data-attention={pointMissing ? 'true' : undefined}
                  className={pointMissing ? attentionClass : inputClass}
                />
              </div>
              <div>
                <label htmlFor="question-status" className={labelClass}>
                  Trạng thái
                </label>
                <select
                  id="question-status"
                  value={status}
                  onChange={event => setStatus(event.target.value as QuestionStatus)}
                  className={selectClass}
                >
                  {statusOptions.map(statusOption => (
                    <option key={statusOption} value={statusOption}>
                      {questionStatusLabels[statusOption]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-snug">
              Chủ đề nhóm câu theo bài hoặc chương: ngân hàng lọc theo đó, và “Soạn tự động” cũng lấy câu theo đó.
              Điểm là điểm mặc định khi đưa câu vào đề.
            </p>
          </section>

          <section
            role="tabpanel"
            id="question-panel-dap-an"
            aria-labelledby="question-tab-dap-an"
            hidden={activeTab !== 'dap-an'}
            className={`${cardClass} p-4 animate-tab-in`}
          >
            <SlidingSegments
              role="radiogroup"
              aria-label="Loại câu hỏi"
              activeKey={String(allowMultiple)}
              indicatorClassName="rounded-lg"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 mb-3"
            >
              {[
                { value: false, label: 'Một đáp án đúng' },
                { value: true, label: 'Nhiều đáp án đúng' },
              ].map(option => (
                <button
                  key={String(option.value)}
                  type="button"
                  role="radio"
                  aria-checked={allowMultiple === option.value}
                  onClick={() => changeAllowMultiple(option.value)}
                  data-tab-active={allowMultiple === option.value}
                  className={`relative z-10 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    allowMultiple === option.value
                      ? 'text-indigo-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </SlidingSegments>

            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs text-slate-500">
                {allowMultiple
                  ? `Bấm các ô chữ cái để chọn những đáp án đúng; học sinh phải chọn đúng và đủ mới được điểm · từ ${MIN_ANSWERS} đến ${MAX_ANSWERS} đáp án`
                  : `Bấm ô chữ cái để chọn đáp án đúng · từ ${MIN_ANSWERS} đến ${MAX_ANSWERS} đáp án`}
              </p>
              <button
                type="button"
                onClick={addAnswer}
                disabled={answers.length >= MAX_ANSWERS}
                title={answers.length >= MAX_ANSWERS ? `Tối đa ${MAX_ANSWERS} đáp án` : 'Thêm một đáp án mới'}
                data-attention={answersTooFew ? 'true' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-50 ${
                  answersTooFew
                    ? 'text-amber-800 bg-amber-50 border border-amber-400 ring-4 ring-amber-100 hover:bg-amber-100'
                    : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                }`}
              >
                <Plus size={14} /> Thêm đáp án
              </button>
            </div>

            <div className="space-y-2">
              {answers.map((answer, index) => (
                <AnswerEditorRow
                  key={answer.id}
                  answer={answer}
                  index={index}
                  allowMultiple={allowMultiple}
                  canRemove={answers.length > MIN_ANSWERS}
                  imageOpen={answerIdsWithImageEditor.includes(answer.id) || Boolean(answer.imageUrl)}
                  contentMissing={!answer.content.trim() && !answer.imageUrl}
                  correctMissing={correctMissing}
                  onContentChange={value => updateAnswerContent(answer.id, value)}
                  onImageChange={url => updateAnswerImage(answer.id, url)}
                  onImageUploadingChange={uploading => setImageUploading(`answer-${answer.id}`, uploading)}
                  onToggleImage={() => toggleAnswerImageEditor(answer.id)}
                  onMarkCorrect={() => setCorrectAnswer(answer.id)}
                  onRemove={() => removeAnswer(answer.id)}
                />
              ))}
            </div>
          </section>

          <div
            role="tabpanel"
            id="question-panel-xem-truoc"
            aria-labelledby="question-tab-xem-truoc"
            hidden={activeTab !== 'xem-truoc'}
            className="animate-tab-in"
          >
            <QuestionPreview
              key={previewInstanceId}
              content={content}
              imageUrl={imageUrl}
              topic={topic}
              difficulty={difficulty}
              allowMultiple={allowMultiple}
              point={Number.isFinite(defaultPoint) ? defaultPoint : 0}
              answers={answers}
            />
          </div>
        </div>

      </div>

      <SaveQuestionDialog
        open={saveDialogOpen}
        isEdit={isEdit}
        saving={saving}
        preview={{
          content: content.trim(),
          imageUrl,
          topic: topic.trim(),
          difficulty,
          allowMultiple,
          point: Number.isFinite(defaultPoint) ? defaultPoint : 0,
          answers,
        }}
        onClose={() => setSaveDialogOpen(false)}
        onSave={keepCreating => {
          setSaveDialogOpen(false)
          void handleSave(keepCreating)
        }}
      />
    </Layout>
  )
}
