/**
 * Việc học của chính học sinh đang đăng nhập (`/api/my/groups`, `/api/my/transcript`): các lớp em học và bảng điểm theo môn.
 * Danh tính suy từ token ở server; không có id học sinh nào trên đường dẫn.
 */
import { apiClient } from '../lib/apiClient'
import type { AcademicTerm, MyGroup, Transcript, TranscriptExam, TranscriptSubject } from '../types'

interface MyGroupDto extends Omit<MyGroup, 'subjectName'> {
  subjectName?: string
}

interface TranscriptExamDto extends Omit<TranscriptExam, 'score'> {
  score?: number
}

interface TranscriptSubjectDto extends Omit<TranscriptSubject, 'average' | 'exams'> {
  average?: number
  exams: TranscriptExamDto[]
}

interface TranscriptDto {
  overallAverage?: number
  subjects: TranscriptSubjectDto[]
}

function toMyGroup(dto: MyGroupDto): MyGroup {
  return { ...dto, subjectName: dto.subjectName ?? null }
}

export async function listMyGroups(): Promise<MyGroup[]> {
  const items = await apiClient.get<MyGroupDto[]>('/api/my/groups')
  return items.map(toMyGroup)
}

export async function getMyGroup(groupId: number): Promise<MyGroup> {
  return toMyGroup(await apiClient.get<MyGroupDto>(`/api/my/groups/${groupId}`))
}

/** Các kỳ em có lớp; kỳ `id = 0` là lớp chưa phân kỳ. Kỳ hiện tại đứng đầu. */
export function listMyTerms(): Promise<AcademicTerm[]> {
  return apiClient.get<AcademicTerm[]>('/api/my/terms')
}

/** `termId`: bỏ trống là mọi kỳ; `0` là bài của lớp chưa phân kỳ. */
export async function getMyTranscript(termId?: number): Promise<Transcript> {
  const dto = await apiClient.get<TranscriptDto>('/api/my/transcript', { termId })

  return {
    overallAverage: dto.overallAverage ?? null,
    subjects: dto.subjects.map(subject => ({
      ...subject,
      average: subject.average ?? null,
      exams: subject.exams.map(exam => ({ ...exam, score: exam.score ?? null })),
    })),
  }
}

export const UNASSIGNED_SUBJECT = 'Chưa gán môn'

/** Các môn khác nhau trong những lớp em đang học (lớp chưa có môn gộp thành một mục "Chưa gán môn"), theo thứ tự tên. */
export function distinctSubjects(groups: ReadonlyArray<Pick<MyGroup, 'subjectName'>>): string[] {
  return [...new Set(groups.map(group => group.subjectName ?? UNASSIGNED_SUBJECT))].sort((a, b) => a.localeCompare(b, 'vi'))
}

/**
 * Nhãn ngắn "em đang học gì" cho nơi chật chỗ (dưới tên ở thanh đầu trang): một lớp thì ghi tên lớp; nhiều lớp thì đếm THEO MÔN —
 * "3 môn", hoặc chính tên môn khi các lớp cùng một môn.
 */
export function describeStudyLoad(groups: ReadonlyArray<Pick<MyGroup, 'name' | 'subjectName'>>): string {
  if (groups.length === 0) return 'Học sinh'
  if (groups.length === 1) return groups[0].name

  const subjects = distinctSubjects(groups)
  return subjects.length === 1 ? subjects[0] : `${subjects.length} môn`
}

// Thanh đầu trang có mặt ở mọi trang của học sinh và dựng lại mỗi lần đổi trang: giữ kết quả một lúc để không gọi lại mỗi lần.
const GROUPS_CACHE_MS = 60_000
let groupsCache: { userId: number | undefined; at: number; data: MyGroup[] } | null = null

/** Gắn với id người dùng: đổi tài khoản trong vòng một phút không được nhìn thấy các lớp của người trước. */
export async function listMyGroupsCached(userId: number | undefined): Promise<MyGroup[]> {
  if (groupsCache && groupsCache.userId === userId && Date.now() - groupsCache.at < GROUPS_CACHE_MS) return groupsCache.data

  const data = await listMyGroups()
  groupsCache = { userId, at: Date.now(), data }
  return data
}

