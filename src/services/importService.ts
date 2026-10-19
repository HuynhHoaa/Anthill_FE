/**
 * Nhập học sinh, giáo viên và lớp từ file Excel — chỉ quản trị viên.
 *
 * Mỗi kỳ có vài nghìn học sinh, không ai nhập tay từng em. Mỗi lần gọi là **một trong hai bước** trên cùng một endpoint:
 * `dryRun: true` kiểm tra và đếm mà không ghi gì (cho người dùng xem trước), `dryRun: false` ghi thật và kiểm tra lại từ đầu —
 * server không tin kết quả xem trước. Dòng hỏng không làm hỏng cả mẻ: dòng hợp lệ được nhập, dòng hỏng được liệt kê kèm số
 * dòng trong file Excel và lý do.
 */
import { apiClient, apiDownload } from '../lib/apiClient'

/**
 * `school` là nhập tổng hợp: MỘT file, mỗi dòng một học sinh kèm lớp và giáo viên chủ nhiệm; một lần tải lên tạo giáo viên, lớp
 * (kèm chủ nhiệm) và học sinh rồi xếp học sinh vào lớp. Ba loại còn lại nhập riêng từng thứ.
 */
export type ImportKind = 'students' | 'teachers' | 'groups' | 'school'

/** Một dòng của file Excel bị từ chối, và vì sao. */
export interface ImportIssue {
  /** Số dòng trong file Excel (dòng tiêu đề là 1). */
  row: number
  /** Tên cột có vấn đề; vắng mặt khi lỗi nằm ở cả dòng. */
  column?: string
  message: string
}

/** Một tài khoản vừa tạo, đủ để đối chiếu danh sách. */
export interface ImportedAccount {
  fullName: string
  /** Tên đăng nhập (với giáo viên là email). */
  username: string
  /** Mã học sinh; vắng mặt với giáo viên. */
  code?: string
  /** Tên lớp (học sinh) hoặc tên môn (giáo viên). */
  group?: string
}

/** Một học sinh trong danh sách xem trước của nhập tổng hợp. */
export interface SchoolPreviewStudent {
  /** Số dòng trong file Excel. */
  row: number
  code: string
  fullName: string
  /** Đã có tài khoản: nhập sẽ chỉ xếp thêm vào lớp. */
  exists: boolean
}

/** Một lớp trong danh sách xem trước: lớp, giáo viên chủ nhiệm, môn và học sinh sẽ vào lớp (chỉ gồm những gì nhập được). */
export interface SchoolPreviewGroup {
  name: string
  /** Lớp đã có (nhập chỉ xếp thêm học sinh vào). */
  exists: boolean
  teacherName: string
  teacherEmail: string
  /** Giáo viên đã có trong hệ thống. */
  teacherExists: boolean
  subject: string
  /** Kỳ học ghi cho lớp trong file; vắng khi lớp không ghi kỳ. */
  termName?: string | null
  students: SchoolPreviewStudent[]
}

/** Số liệu theo từng loại bản ghi của nhập tổng hợp. */
export interface SchoolBreakdown {
  /** Chỉ có khi xem trước: từng lớp kèm giáo viên, môn và học sinh để quản trị viên soát trước khi nhập. */
  preview: SchoolPreviewGroup[]
  /** Môn file ghi mà hệ thống chưa có: được tạo cùng lần nhập (xem trước thì chỉ liệt kê). */
  subjectsCreated: string[]
  /** Kỳ học file ghi mà hệ thống chưa có: được tạo cùng lớp (xem trước thì chỉ liệt kê). */
  termsCreated: string[]
  teachersCreated: number
  teachersUnchanged: number
  groupsCreated: number
  groupsUnchanged: number
  /** Số lớp được công bố ngay trong lần nhập này. */
  groupsPublished: number
  studentsCreated: number
  studentsPlaced: number
  studentsUnchanged: number
}

export interface ImportResult {
  /** `true`: chỉ kiểm tra, chưa ghi gì. */
  dryRun: boolean
  /** Số dòng dữ liệu đọc được (không tính tiêu đề và dòng trống). */
  totalRows: number
  /** Bản ghi mới được tạo (hoặc sẽ được tạo khi `dryRun`). */
  created: number
  /** Học sinh đã có tài khoản nhưng chưa có lớp, nay được xếp lớp. */
  placed: number
  /** Dòng khớp với bản ghi đã có và không còn gì để làm. */
  unchanged: number
  /** Số dòng bị từ chối — đếm đủ, kể cả khi `issues` bị cắt. */
  failed: number
  /** Các dòng bị từ chối theo thứ tự dòng, tối đa 500. */
  issues: ImportIssue[]
  issuesTruncated: boolean
  accounts: ImportedAccount[]
  /** Chỉ có ở nhập tổng hợp: số liệu tách theo giáo viên, lớp, học sinh (các số ở trên là tổng gộp). */
  school?: SchoolBreakdown
}

/** Khớp ImportLimits.MaxFileBytes ở server. */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024

/** Số dòng tối đa mỗi lần nhập, khớp StudentImportService / TeacherImportService / GroupImportService. */
export const IMPORT_MAX_ROWS: Record<ImportKind, number> = {
  students: 5000,
  teachers: 1000,
  groups: 500,
  school: 20000,
}

export const IMPORT_MIN_PASSWORD_LENGTH = 6

const templateFileNames: Record<ImportKind, string> = {
  students: 'mau-nhap-hoc-sinh.xlsx',
  teachers: 'mau-nhap-giao-vien.xlsx',
  groups: 'mau-nhap-lop.xlsx',
  school: 'mau-nhap-danh-sach-truong.xlsx',
}

/** Lý do không nên gửi file này lên, hoặc `undefined` khi file qua được các kiểm tra phía trình duyệt. */
export function checkImportFile(file: File): string | undefined {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return 'Chỉ nhận file Excel đuôi .xlsx. File .xls hay .csv thì mở bằng Excel rồi lưu lại thành .xlsx.'
  }
  if (file.size === 0) return 'File rỗng. Hãy chọn file khác.'
  if (file.size > IMPORT_MAX_FILE_BYTES) return 'File lớn hơn 5 MB. Hãy tách thành nhiều file.'
  return undefined
}

/** Tải file mẫu. Trả blob và tên file gợi ý để lưu. */
export async function downloadImportTemplate(kind: ImportKind): Promise<{ blob: Blob; fileName: string }> {
  const blob = await apiDownload(`/api/imports/${kind}/template`)
  return { blob, fileName: templateFileNames[kind] }
}

function buildForm(file: File, fields: Record<string, string | undefined>): FormData {
  const form = new FormData()
  form.append('file', file, file.name)
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== '') form.append(key, value)
  })
  return form
}

export interface ImportStudentsOptions {
  /** Lớp áp cho những dòng để trống ô Lớp. */
  groupId?: number
  /** Mật khẩu ban đầu dùng chung cho các tài khoản mới; chỉ bắt buộc khi thật sự có tài khoản mới để tạo. */
  password?: string
  dryRun: boolean
}

export function importStudents(file: File, options: ImportStudentsOptions): Promise<ImportResult> {
  return apiClient.postForm<ImportResult>(
    '/api/imports/students',
    buildForm(file, {
      groupId: options.groupId === undefined ? undefined : String(options.groupId),
      password: options.password,
      dryRun: String(options.dryRun),
    }),
  )
}

export interface ImportTeachersOptions {
  /** Môn áp cho những dòng để trống ô Môn. */
  subjectId?: number
  password?: string
  dryRun: boolean
}

export function importTeachers(file: File, options: ImportTeachersOptions): Promise<ImportResult> {
  return apiClient.postForm<ImportResult>(
    '/api/imports/teachers',
    buildForm(file, {
      subjectId: options.subjectId === undefined ? undefined : String(options.subjectId),
      password: options.password,
      dryRun: String(options.dryRun),
    }),
  )
}

export function importGroups(file: File, options: { dryRun: boolean }): Promise<ImportResult> {
  return apiClient.postForm<ImportResult>(
    '/api/imports/groups',
    buildForm(file, { dryRun: String(options.dryRun) }),
  )
}

export interface ImportSchoolOptions {
  /** Mật khẩu ban đầu dùng chung cho mọi tài khoản mới (giáo viên lẫn học sinh). */
  password?: string
  /** Công bố ngay các lớp vừa tạo để giáo viên thấy; mặc định lớp mới ở dạng nháp. */
  publishGroups: boolean
  dryRun: boolean
}

interface SchoolImportResponse extends SchoolBreakdown {
  dryRun: boolean
  totalRows: number
  failed: number
  issues: ImportIssue[]
  issuesTruncated: boolean
  accounts: ImportedAccount[]
}

/**
 * Nhập tổng hợp từ một file. Server trả số liệu tách theo loại; ở đây gộp thêm các tổng (`created` = tài khoản mới của cả giáo
 * viên lẫn học sinh, `placed` = học sinh có sẵn được xếp thêm lớp, `unchanged` = mọi thứ đã có) để hộp nhập dùng chung được với
 * ba loại nhập riêng.
 */
export async function importSchool(file: File, options: ImportSchoolOptions): Promise<ImportResult> {
  const response = await apiClient.postForm<SchoolImportResponse>(
    '/api/imports/school',
    buildForm(file, {
      password: options.password,
      publishGroups: String(options.publishGroups),
      dryRun: String(options.dryRun),
    }),
  )

  return {
    dryRun: response.dryRun,
    totalRows: response.totalRows,
    created: response.teachersCreated + response.studentsCreated,
    placed: response.studentsPlaced,
    unchanged: response.teachersUnchanged + response.groupsUnchanged + response.studentsUnchanged,
    failed: response.failed,
    issues: response.issues,
    issuesTruncated: response.issuesTruncated,
    accounts: response.accounts,
    school: {
      preview: response.preview,
      subjectsCreated: response.subjectsCreated,
      termsCreated: response.termsCreated ?? [],
      teachersCreated: response.teachersCreated,
      teachersUnchanged: response.teachersUnchanged,
      groupsCreated: response.groupsCreated,
      groupsUnchanged: response.groupsUnchanged,
      groupsPublished: response.groupsPublished,
      studentsCreated: response.studentsCreated,
      studentsPlaced: response.studentsPlaced,
      studentsUnchanged: response.studentsUnchanged,
    },
  }
}

/** Số dòng nhập được (sẽ ghi gì đó): tài khoản mới, em có sẵn được xếp lớp, và với nhập tổng hợp cả lớp mới. */
export function importableCount(result: ImportResult): number {
  return result.school
    ? result.school.teachersCreated + result.school.groupsCreated + result.school.studentsCreated + result.school.studentsPlaced
    : result.created + result.placed
}
