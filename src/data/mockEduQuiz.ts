/**
 * Dữ liệu mock của EduQuiz. Chỉ chứa dữ liệu và vài hàm dựng nhỏ để bảo đảm
 * tính nhất quán giữa các bảng (assignment - result - student - exam).
 * Type nghiệp vụ nằm ở src/types, file này re-export lại để code cũ không gãy.
 */
import { getTopicColor } from '../lib/topicTheme'
import type {
  ActivityItem,
  AppNotification,
  AttemptAnswerDetail,
  AttemptQuestion,
  Exam,
  ExamAssignment,
  ExamLifecycle,
  ExamStatus,
  Question,
  ResultSummary,
  Student,
  StudentExamItem,
  StudentExamItemStatus,
  StudentGroup,
  UserProfile,
  UserRole,
} from '../types'

export type {
  ActivityItem,
  AnswerOption,
  AppNotification,
  AttemptAnswerDetail,
  AttemptDetail,
  AttemptQuestion,
  AttemptSession,
  DifficultyLevel,
  Exam,
  ExamAssignment,
  ExamLifecycle,
  ExamStatus,
  NotificationType,
  Paged,
  Question,
  QuestionStatus,
  ResultSummary,
  Student,
  StudentDashboardData,
  StudentExamItem,
  StudentExamItemStatus,
  StudentGroup,
  StudentStatus,
  TeacherDashboardData,
  UserProfile,
  UserRole,
} from '../types'

export {
  difficultyLabels,
  examStatusLabels,
  lifecycleLabels,
  notificationTypeLabels,
  questionStatusLabels,
  studentExamItemStatusLabels,
  studentStatusLabels,
} from '../types'

// ===== Mốc thời gian =====
// Mọi mốc thời gian được tính tương đối so với lúc module được nạp,
// nhờ vậy bản demo luôn có bài đang mở và bộ đếm ngược còn hiệu lực.

const HOUR_IN_MS = 3600000
const DAY_IN_MS = 24 * HOUR_IN_MS
const moduleLoadedAt = Date.now()

function padNumber(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

function formatDate(date: Date): string {
  return `${padNumber(date.getDate())}/${padNumber(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`
}

function dateAtHourOffset(hourOffset: number): Date {
  return new Date(moduleLoadedAt + hourOffset * HOUR_IN_MS)
}

function dateLabel(dayOffset: number): string {
  return formatDate(new Date(moduleLoadedAt + dayOffset * DAY_IN_MS))
}

function dateTimeLabel(hourOffset: number): string {
  return formatDateTime(dateAtHourOffset(hourOffset))
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

/** Học sinh đang đăng nhập trong bản demo. */
export const demoStudentId = 1

// ===== Nhóm lớp =====

export const mockStudentGroups: StudentGroup[] = [
  {
    id: 1,
    name: 'Lớp 10A',
    description: 'Lớp 10 ban khoa học tự nhiên, học tăng cường mạch Vật lý và Hóa học.',
    studentCount: 7,
    createdAt: dateLabel(-130),
  },
  {
    id: 2,
    name: 'Lớp 10B',
    description: 'Lớp 10 ban cơ bản, tập trung củng cố kiến thức nền.',
    studentCount: 7,
    createdAt: dateLabel(-122),
  },
  {
    id: 3,
    name: 'Lớp 11A',
    description: 'Lớp 11 ban khoa học tự nhiên, ôn luyện theo chuyên đề.',
    studentCount: 7,
    createdAt: dateLabel(-98),
  },
  {
    id: 4,
    name: 'Nhóm ôn tập KHTN',
    description: 'Nhóm luyện đề Khoa học tự nhiên ngoài giờ, tập trung vào bài tập vận dụng.',
    studentCount: 5,
    createdAt: dateLabel(-72),
  },
]

// ===== Học sinh =====
// completedExams = số lượt đã nộp hoặc đã chấm, averageScore = điểm trung bình các lượt đã chấm.
// Hai giá trị này khớp chính xác với mockExamAssignments phía dưới.

export const mockStudents: Student[] = [
  {
    id: 1,
    fullName: 'Trần Thị Lan',
    email: 'lan.tt@student.edu.vn',
    username: 'lan.tt',
    code: 'HS1001',
    group: 'Lớp 10A',
    groupId: 1,
    status: 'active',
    createdAt: dateLabel(-128),
    completedExams: 3,
    averageScore: 8.8,
  },
  {
    id: 2,
    fullName: 'Nguyễn Minh Khoa',
    email: 'khoa.nm@student.edu.vn',
    username: 'khoa.nm',
    code: 'HS1002',
    group: 'Lớp 10A',
    groupId: 1,
    status: 'active',
    createdAt: dateLabel(-128),
    completedExams: 4,
    averageScore: 7.7,
  },
  {
    id: 3,
    fullName: 'Lê Văn Dũng',
    email: 'dung.lv@student.edu.vn',
    username: 'dung.lv',
    code: 'HS1003',
    group: 'Lớp 10A',
    groupId: 1,
    status: 'active',
    createdAt: dateLabel(-127),
    completedExams: 4,
    averageScore: 6.7,
  },
  {
    id: 4,
    fullName: 'Phạm Ngọc Mai',
    email: 'mai.pn@student.edu.vn',
    username: 'mai.pn',
    code: 'HS1004',
    group: 'Lớp 10A',
    groupId: 1,
    status: 'locked',
    createdAt: dateLabel(-127),
    completedExams: 0,
    averageScore: 0,
  },
  {
    id: 5,
    fullName: 'Hoàng Gia Bảo',
    email: 'bao.hg@student.edu.vn',
    username: 'bao.hg',
    code: 'HS1005',
    group: 'Lớp 10A',
    groupId: 1,
    status: 'active',
    createdAt: dateLabel(-126),
    completedExams: 5,
    averageScore: 9.6,
  },
  {
    id: 6,
    fullName: 'Vũ Thị Thanh Hà',
    email: 'ha.vtt@student.edu.vn',
    username: 'ha.vtt',
    code: 'HS1006',
    group: 'Lớp 10A',
    groupId: 1,
    status: 'active',
    createdAt: dateLabel(-126),
    completedExams: 2,
    averageScore: 6,
  },
  {
    id: 7,
    fullName: 'Đặng Quốc Huy',
    email: 'huy.dq@student.edu.vn',
    username: 'huy.dq',
    code: 'HS1007',
    group: 'Lớp 10A',
    groupId: 1,
    status: 'active',
    createdAt: dateLabel(-125),
    completedExams: 5,
    averageScore: 7.9,
  },
  {
    id: 8,
    fullName: 'Bùi Thị Kim Ngân',
    email: 'ngan.btk@student.edu.vn',
    username: 'ngan.btk',
    code: 'HS1008',
    group: 'Lớp 10B',
    groupId: 2,
    status: 'active',
    createdAt: dateLabel(-120),
    completedExams: 2,
    averageScore: 6.1,
  },
  {
    id: 9,
    fullName: 'Đỗ Trung Kiên',
    email: 'kien.dt@student.edu.vn',
    username: 'kien.dt',
    code: 'HS1009',
    group: 'Lớp 10B',
    groupId: 2,
    status: 'active',
    createdAt: dateLabel(-120),
    completedExams: 2,
    averageScore: 6.6,
  },
  {
    id: 10,
    fullName: 'Ngô Phương Linh',
    email: 'linh.np@student.edu.vn',
    username: 'linh.np',
    code: 'HS1010',
    group: 'Lớp 10B',
    groupId: 2,
    status: 'active',
    createdAt: dateLabel(-119),
    completedExams: 2,
    averageScore: 8,
  },
  {
    id: 11,
    fullName: 'Dương Anh Tuấn',
    email: 'tuan.da@student.edu.vn',
    username: 'tuan.da',
    code: 'HS1011',
    group: 'Lớp 10B',
    groupId: 2,
    status: 'active',
    createdAt: dateLabel(-119),
    completedExams: 1,
    averageScore: 6.8,
  },
  {
    id: 12,
    fullName: 'Lý Thị Hồng Nhung',
    email: 'nhung.lth@student.edu.vn',
    username: 'nhung.lth',
    code: 'HS1012',
    group: 'Lớp 10B',
    groupId: 2,
    status: 'locked',
    createdAt: dateLabel(-118),
    completedExams: 0,
    averageScore: 0,
  },
  {
    id: 13,
    fullName: 'Phan Đức Thắng',
    email: 'thang.pd@student.edu.vn',
    username: 'thang.pd',
    code: 'HS1013',
    group: 'Lớp 10B',
    groupId: 2,
    status: 'active',
    createdAt: dateLabel(-118),
    completedExams: 2,
    averageScore: 8.6,
  },
  {
    id: 14,
    fullName: 'Trịnh Bảo Châu',
    email: 'chau.tb@student.edu.vn',
    username: 'chau.tb',
    code: 'HS1014',
    group: 'Lớp 10B',
    groupId: 2,
    status: 'active',
    createdAt: dateLabel(-117),
    completedExams: 2,
    averageScore: 5.5,
  },
  {
    id: 15,
    fullName: 'Nguyễn Hải Đăng',
    email: 'dang.nh@student.edu.vn',
    username: 'dang.nh',
    code: 'HS1015',
    group: 'Lớp 11A',
    groupId: 3,
    status: 'active',
    createdAt: dateLabel(-96),
    completedExams: 2,
    averageScore: 9.5,
  },
  {
    id: 16,
    fullName: 'Trần Khánh Vy',
    email: 'vy.tk@student.edu.vn',
    username: 'vy.tk',
    code: 'HS1016',
    group: 'Lớp 11A',
    groupId: 3,
    status: 'active',
    createdAt: dateLabel(-96),
    completedExams: 2,
    averageScore: 5,
  },
  {
    id: 17,
    fullName: 'Lê Thị Mỹ Duyên',
    email: 'duyen.ltm@student.edu.vn',
    username: 'duyen.ltm',
    code: 'HS1017',
    group: 'Lớp 11A',
    groupId: 3,
    status: 'active',
    createdAt: dateLabel(-95),
    completedExams: 1,
    averageScore: 7,
  },
  {
    id: 18,
    fullName: 'Võ Thành Nam',
    email: 'nam.vt@student.edu.vn',
    username: 'nam.vt',
    code: 'HS1018',
    group: 'Lớp 11A',
    groupId: 3,
    status: 'active',
    createdAt: dateLabel(-95),
    completedExams: 1,
    averageScore: 6,
  },
  {
    id: 19,
    fullName: 'Hồ Thị Diễm Quỳnh',
    email: 'quynh.htd@student.edu.vn',
    username: 'quynh.htd',
    code: 'HS1019',
    group: 'Lớp 11A',
    groupId: 3,
    status: 'locked',
    createdAt: dateLabel(-94),
    completedExams: 0,
    averageScore: 0,
  },
  {
    id: 20,
    fullName: 'Cao Minh Nhật',
    email: 'nhat.cm@student.edu.vn',
    username: 'nhat.cm',
    code: 'HS1020',
    group: 'Lớp 11A',
    groupId: 3,
    status: 'active',
    createdAt: dateLabel(-94),
    completedExams: 2,
    averageScore: 7.5,
  },
  {
    id: 21,
    fullName: 'Đinh Thùy Trang',
    email: 'trang.dt@student.edu.vn',
    username: 'trang.dt',
    code: 'HS1021',
    group: 'Lớp 11A',
    groupId: 3,
    status: 'active',
    createdAt: dateLabel(-93),
    completedExams: 1,
    averageScore: 6,
  },
  {
    id: 22,
    fullName: 'Nguyễn Tấn Phát',
    email: 'phat.nt@student.edu.vn',
    username: 'phat.nt',
    code: 'HS1022',
    group: 'Nhóm ôn tập KHTN',
    groupId: 4,
    status: 'active',
    createdAt: dateLabel(-70),
    completedExams: 2,
    averageScore: 9.8,
  },
  {
    id: 23,
    fullName: 'Trương Mỹ Hạnh',
    email: 'hanh.tm@student.edu.vn',
    username: 'hanh.tm',
    code: 'HS1023',
    group: 'Nhóm ôn tập KHTN',
    groupId: 4,
    status: 'active',
    createdAt: dateLabel(-70),
    completedExams: 2,
    averageScore: 7.3,
  },
  {
    id: 24,
    fullName: 'Lâm Quang Vinh',
    email: 'vinh.lq@student.edu.vn',
    username: 'vinh.lq',
    code: 'HS1024',
    group: 'Nhóm ôn tập KHTN',
    groupId: 4,
    status: 'active',
    createdAt: dateLabel(-69),
    completedExams: 2,
    averageScore: 5.5,
  },
  {
    id: 25,
    fullName: 'Chu Thị Yến Nhi',
    email: 'nhi.cty@student.edu.vn',
    username: 'nhi.cty',
    code: 'HS1025',
    group: 'Nhóm ôn tập KHTN',
    groupId: 4,
    status: 'active',
    createdAt: dateLabel(-69),
    completedExams: 2,
    averageScore: 5.5,
  },
  {
    id: 26,
    fullName: 'Mai Hoàng Long',
    email: 'long.mh@student.edu.vn',
    username: 'long.mh',
    code: 'HS1026',
    group: 'Nhóm ôn tập KHTN',
    groupId: 4,
    status: 'active',
    createdAt: dateLabel(-68),
    completedExams: 0,
    averageScore: 0,
  },
]

// ===== Hình minh họa cho câu hỏi =====
// Vẽ bằng SVG nội tuyến dạng data URI để chạy được cả khi offline.

const plantCellImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='240' viewBox='0 0 420 240'><rect width='420' height='240' rx='12' fill='%23F8FAFC'/><rect x='30' y='40' width='230' height='160' rx='18' fill='%23FFFFFF' stroke='%2364748B' stroke-width='5'/><rect x='40' y='50' width='210' height='140' rx='12' fill='%23F1F5F9' stroke='%2394A3B8' stroke-width='2'/><rect x='58' y='116' width='104' height='62' rx='24' fill='%23E0E7FF' stroke='%236366F1' stroke-width='3'/><ellipse cx='92' cy='80' rx='20' ry='10' fill='%23D1FAE5' stroke='%2310B981' stroke-width='3'/><ellipse cx='150' cy='72' rx='20' ry='10' fill='%23D1FAE5' stroke='%2310B981' stroke-width='3'/><ellipse cx='210' cy='145' rx='20' ry='10' fill='%23D1FAE5' stroke='%2310B981' stroke-width='3'/><circle cx='200' cy='88' r='22' fill='%23FFFFFF' stroke='%238B5CF6' stroke-width='3'/><circle cx='200' cy='88' r='8' fill='%238B5CF6'/><line x1='268' y1='50' x2='238' y2='40' stroke='%2394A3B8' stroke-width='2'/><line x1='268' y1='92' x2='224' y2='89' stroke='%2394A3B8' stroke-width='2'/><line x1='268' y1='146' x2='232' y2='145' stroke='%2394A3B8' stroke-width='2'/><line x1='268' y1='196' x2='164' y2='147' stroke='%2394A3B8' stroke-width='2'/><text x='276' y='56' font-family='Arial' font-size='15' fill='%2364748B'>Thành tế bào</text><text x='276' y='97' font-family='Arial' font-size='15' fill='%236D28D9'>Nhân</text><text x='276' y='151' font-family='Arial' font-size='15' fill='%23047857'>Lục lạp</text><text x='276' y='201' font-family='Arial' font-size='15' fill='%234338CA'>Không bào</text></svg>"

const seriesCircuitImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='200' viewBox='0 0 420 200'><rect width='420' height='200' rx='12' fill='%23F8FAFC'/><path d='M60 60H150M210 60H270M330 60H360V140H222M188 140H60V60' fill='none' stroke='%2364748B' stroke-width='3'/><rect x='150' y='45' width='60' height='30' rx='4' fill='%23FFFFFF' stroke='%236366F1' stroke-width='3'/><rect x='270' y='45' width='60' height='30' rx='4' fill='%23FFFFFF' stroke='%238B5CF6' stroke-width='3'/><line x1='222' y1='116' x2='222' y2='164' stroke='%2364748B' stroke-width='3'/><line x1='188' y1='128' x2='188' y2='152' stroke='%2364748B' stroke-width='7'/><text x='166' y='36' font-family='Arial' font-size='15' fill='%234338CA'>R1</text><text x='286' y='36' font-family='Arial' font-size='15' fill='%236D28D9'>R2</text><text x='196' y='184' font-family='Arial' font-size='15' fill='%2364748B'>U</text></svg>"

const reflectionImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220' viewBox='0 0 420 220'><rect width='420' height='220' rx='12' fill='%23F8FAFC'/><line x1='40' y1='170' x2='380' y2='170' stroke='%2364748B' stroke-width='4'/><path d='M46 176l12 12M76 176l12 12M106 176l12 12M136 176l12 12M166 176l12 12M196 176l12 12M226 176l12 12M256 176l12 12M286 176l12 12M316 176l12 12M346 176l12 12' stroke='%2394A3B8' stroke-width='2'/><line x1='210' y1='170' x2='210' y2='40' stroke='%23CBD5E1' stroke-width='2' stroke-dasharray='6 6'/><line x1='90' y1='50' x2='210' y2='170' stroke='%236366F1' stroke-width='3'/><line x1='210' y1='170' x2='330' y2='50' stroke='%238B5CF6' stroke-width='3'/><text x='174' y='132' font-family='Arial' font-size='16' fill='%234338CA'>i</text><text x='234' y='132' font-family='Arial' font-size='16' fill='%236D28D9'>i'</text><text x='198' y='34' font-family='Arial' font-size='15' fill='%2364748B'>N</text></svg>"

// ===== Ngân hàng câu hỏi =====
// 32 câu, 8 chủ đề, mỗi câu 4 đáp án và đúng 1 đáp án đúng.
// Id đáp án = id câu hỏi * 10 + vị trí, nên duy nhất trên toàn hệ thống.

export const mockQuestions: Question[] = [
  {
    id: 1,
    content: 'Đơn vị đo lực trong hệ đo lường quốc tế (SI) là gì?',
    topic: 'Lực và chuyển động',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-62),
    answers: [
      { id: 11, content: 'Kilôgam (kg)', isCorrect: false },
      { id: 12, content: 'Niutơn (N)', isCorrect: true },
      { id: 13, content: 'Jun (J)', isCorrect: false },
      { id: 14, content: 'Oát (W)', isCorrect: false },
    ],
  },
  {
    id: 2,
    content: 'Một ô tô đi được quãng đường 120 km trong 2 giờ. Tốc độ trung bình của ô tô là bao nhiêu?',
    topic: 'Lực và chuyển động',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-61),
    answers: [
      { id: 21, content: '40 km/h', isCorrect: false },
      { id: 22, content: '60 km/h', isCorrect: true },
      { id: 23, content: '80 km/h', isCorrect: false },
      { id: 24, content: '240 km/h', isCorrect: false },
    ],
  },
  {
    id: 3,
    content: 'Hai lực cân bằng là hai lực có đặc điểm nào sau đây?',
    topic: 'Lực và chuyển động',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-60),
    answers: [
      { id: 31, content: 'Cùng đặt vào một vật, cùng phương và cùng chiều', isCorrect: false },
      { id: 32, content: 'Cùng đặt vào một vật, khác phương và cùng độ lớn', isCorrect: false },
      { id: 33, content: 'Cùng đặt vào một vật, cùng phương, ngược chiều và cùng độ lớn', isCorrect: true },
      { id: 34, content: 'Đặt vào hai vật khác nhau, cùng phương và ngược chiều', isCorrect: false },
    ],
  },
  {
    id: 4,
    content: 'Một vật đang chuyển động thẳng đều trên mặt bàn nằm ngang dưới tác dụng của lực kéo 4 N theo phương ngang. Kết luận nào sau đây đúng?',
    topic: 'Lực và chuyển động',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-59),
    answers: [
      { id: 41, content: 'Lực ma sát tác dụng lên vật có độ lớn 4 N và ngược chiều với lực kéo', isCorrect: true },
      { id: 42, content: 'Lực ma sát tác dụng lên vật có độ lớn 4 N và cùng chiều với lực kéo', isCorrect: false },
      { id: 43, content: 'Không có lực ma sát vì vật vẫn đang chuyển động', isCorrect: false },
      { id: 44, content: 'Hợp lực tác dụng lên vật có độ lớn 4 N theo chiều lực kéo', isCorrect: false },
    ],
  },
  {
    id: 5,
    content: 'Quan sát sơ đồ tế bào thực vật dưới đây, bào quan nào thực hiện quá trình quang hợp?',
    imageUrl: plantCellImage,
    topic: 'Tế bào và cơ thể sống',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-57),
    answers: [
      { id: 51, content: 'Nhân tế bào', isCorrect: false },
      { id: 52, content: 'Lục lạp', isCorrect: true },
      { id: 53, content: 'Không bào', isCorrect: false },
      { id: 54, content: 'Thành tế bào', isCorrect: false },
    ],
  },
  {
    id: 6,
    content: 'Các cấp độ tổ chức của cơ thể đa bào được sắp xếp đúng theo thứ tự từ nhỏ đến lớn là:',
    topic: 'Tế bào và cơ thể sống',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-56),
    answers: [
      { id: 61, content: 'Mô → tế bào → cơ quan → hệ cơ quan → cơ thể', isCorrect: false },
      { id: 62, content: 'Tế bào → mô → cơ quan → hệ cơ quan → cơ thể', isCorrect: true },
      { id: 63, content: 'Tế bào → cơ quan → mô → hệ cơ quan → cơ thể', isCorrect: false },
      { id: 64, content: 'Tế bào → mô → hệ cơ quan → cơ quan → cơ thể', isCorrect: false },
    ],
  },
  {
    id: 7,
    content: 'Tế bào nhân sơ khác tế bào nhân thực ở đặc điểm nào sau đây?',
    topic: 'Tế bào và cơ thể sống',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'hidden',
    updatedAt: dateLabel(-55),
    answers: [
      { id: 71, content: 'Không có màng tế bào', isCorrect: false },
      { id: 72, content: 'Không có chất tế bào', isCorrect: false },
      { id: 73, content: 'Chưa có nhân hoàn chỉnh, vật chất di truyền không được màng nhân bao bọc', isCorrect: true },
      { id: 74, content: 'Không mang vật chất di truyền', isCorrect: false },
    ],
  },
  {
    id: 8,
    content: 'Một tế bào thực hiện quá trình phân chia liên tiếp 3 lần. Số tế bào con được tạo thành là bao nhiêu?',
    topic: 'Tế bào và cơ thể sống',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-54),
    answers: [
      { id: 81, content: '6 tế bào', isCorrect: false },
      { id: 82, content: '8 tế bào', isCorrect: true },
      { id: 83, content: '9 tế bào', isCorrect: false },
      { id: 84, content: '16 tế bào', isCorrect: false },
    ],
  },
  {
    id: 9,
    content: 'Trong một phản ứng hóa học, đại lượng nào sau đây luôn được bảo toàn?',
    topic: 'Phản ứng hóa học',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-50),
    answers: [
      { id: 91, content: 'Số phân tử của các chất', isCorrect: false },
      { id: 92, content: 'Tổng khối lượng của các chất', isCorrect: true },
      { id: 93, content: 'Thể tích của các chất khí', isCorrect: false },
      { id: 94, content: 'Số chất tham gia phản ứng', isCorrect: false },
    ],
  },
  {
    id: 10,
    content: 'Cho phản ứng hóa học 2H2 + O2 → 2H2O. Tỉ lệ số phân tử H2 và số phân tử O2 tham gia phản ứng là bao nhiêu?',
    topic: 'Phản ứng hóa học',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-49),
    answers: [
      { id: 101, content: '1 : 1', isCorrect: false },
      { id: 102, content: '2 : 1', isCorrect: true },
      { id: 103, content: '1 : 2', isCorrect: false },
      { id: 104, content: '4 : 1', isCorrect: false },
    ],
  },
  {
    id: 11,
    content: 'Đốt cháy hoàn toàn 2,4 g magie trong khí oxi thu được 4 g magie oxit. Khối lượng khí oxi đã tham gia phản ứng là bao nhiêu?',
    topic: 'Phản ứng hóa học',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-48),
    answers: [
      { id: 111, content: '1,2 g', isCorrect: false },
      { id: 112, content: '1,6 g', isCorrect: true },
      { id: 113, content: '2,4 g', isCorrect: false },
      { id: 114, content: '6,4 g', isCorrect: false },
    ],
  },
  {
    id: 12,
    content: 'Phương trình hóa học nào sau đây của phản ứng nhôm cháy trong khí oxi đã được cân bằng đúng?',
    topic: 'Phản ứng hóa học',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-47),
    answers: [
      { id: 121, content: 'Al + O2 → Al2O3', isCorrect: false },
      { id: 122, content: '4Al + 3O2 → 2Al2O3', isCorrect: true },
      { id: 123, content: '2Al + 3O2 → 2Al2O3', isCorrect: false },
      { id: 124, content: '4Al + 6O2 → 2Al2O3', isCorrect: false },
    ],
  },
  {
    id: 13,
    content: 'Điện trở tương đương của đoạn mạch gồm hai điện trở R1 và R2 mắc nối tiếp được tính bằng công thức nào?',
    imageUrl: seriesCircuitImage,
    topic: 'Điện học',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-44),
    answers: [
      { id: 131, content: 'R = R1 + R2', isCorrect: true },
      { id: 132, content: 'R = R1 - R2', isCorrect: false },
      { id: 133, content: 'R = R1 × R2', isCorrect: false },
      { id: 134, content: 'R = R1 / R2', isCorrect: false },
    ],
  },
  {
    id: 14,
    content: 'Theo định luật Ôm, cường độ dòng điện chạy qua một dây dẫn được tính bằng công thức nào?',
    topic: 'Điện học',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-43),
    answers: [
      { id: 141, content: 'I = U × R', isCorrect: false },
      { id: 142, content: 'I = R / U', isCorrect: false },
      { id: 143, content: 'I = U / R', isCorrect: true },
      { id: 144, content: 'I = U + R', isCorrect: false },
    ],
  },
  {
    id: 15,
    content: 'Đặt hiệu điện thế 12V vào hai đầu một điện trở 4Ω. Cường độ dòng điện chạy qua điện trở bằng bao nhiêu?',
    topic: 'Điện học',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-42),
    answers: [
      { id: 151, content: '0,33A', isCorrect: false },
      { id: 152, content: '3A', isCorrect: true },
      { id: 153, content: '8A', isCorrect: false },
      { id: 154, content: '48A', isCorrect: false },
    ],
  },
  {
    id: 16,
    content: 'Hai điện trở R1 = 6Ω và R2 = 3Ω mắc song song. Điện trở tương đương của đoạn mạch bằng bao nhiêu?',
    topic: 'Điện học',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-41),
    answers: [
      { id: 161, content: '2Ω', isCorrect: true },
      { id: 162, content: '4,5Ω', isCorrect: false },
      { id: 163, content: '9Ω', isCorrect: false },
      { id: 164, content: '18Ω', isCorrect: false },
    ],
  },
  {
    id: 17,
    content: 'Theo định luật phản xạ ánh sáng, góc phản xạ có quan hệ như thế nào với góc tới?',
    imageUrl: reflectionImage,
    topic: 'Quang học',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-38),
    answers: [
      { id: 171, content: 'Góc phản xạ lớn hơn góc tới', isCorrect: false },
      { id: 172, content: 'Góc phản xạ bằng góc tới', isCorrect: true },
      { id: 173, content: 'Góc phản xạ nhỏ hơn góc tới', isCorrect: false },
      { id: 174, content: 'Góc phản xạ bằng một nửa góc tới', isCorrect: false },
    ],
  },
  {
    id: 18,
    content: 'Ảnh của một vật tạo bởi gương phẳng có đặc điểm nào sau đây?',
    topic: 'Quang học',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-37),
    answers: [
      { id: 181, content: 'Ảnh thật, ngược chiều và nhỏ hơn vật', isCorrect: false },
      { id: 182, content: 'Ảnh ảo, cùng chiều và lớn bằng vật', isCorrect: true },
      { id: 183, content: 'Ảnh thật, cùng chiều và lớn bằng vật', isCorrect: false },
      { id: 184, content: 'Ảnh ảo, ngược chiều và lớn hơn vật', isCorrect: false },
    ],
  },
  {
    id: 19,
    content: 'Hiện tượng khúc xạ ánh sáng xảy ra khi nào?',
    topic: 'Quang học',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'hidden',
    updatedAt: dateLabel(-36),
    answers: [
      { id: 191, content: 'Khi ánh sáng truyền thẳng trong một môi trường trong suốt', isCorrect: false },
      { id: 192, content: 'Khi ánh sáng bị hắt trở lại từ mặt gương', isCorrect: false },
      { id: 193, content: 'Khi ánh sáng truyền xiên góc qua mặt phân cách giữa hai môi trường trong suốt khác nhau', isCorrect: true },
      { id: 194, content: 'Khi ánh sáng bị vật cản chắn hoàn toàn', isCorrect: false },
    ],
  },
  {
    id: 20,
    content: 'Một vật sáng đặt cách thấu kính hội tụ có tiêu cự 10cm một khoảng 30cm. Ảnh thu được có đặc điểm gì?',
    topic: 'Quang học',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-35),
    answers: [
      { id: 201, content: 'Ảnh ảo, cùng chiều và lớn hơn vật', isCorrect: false },
      { id: 202, content: 'Ảnh thật, ngược chiều và nhỏ hơn vật', isCorrect: true },
      { id: 203, content: 'Ảnh thật, ngược chiều và lớn hơn vật', isCorrect: false },
      { id: 204, content: 'Ảnh thật, cùng chiều và bằng vật', isCorrect: false },
    ],
  },
  {
    id: 21,
    content: 'Phản ứng trung hòa là phản ứng xảy ra giữa những chất nào?',
    topic: 'Axit - Bazơ',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-30),
    answers: [
      { id: 211, content: 'Kim loại và phi kim', isCorrect: false },
      { id: 212, content: 'Axit và bazơ', isCorrect: true },
      { id: 213, content: 'Muối và nước', isCorrect: false },
      { id: 214, content: 'Oxit bazơ và kim loại', isCorrect: false },
    ],
  },
  {
    id: 22,
    content: 'Dung dịch nào sau đây làm quỳ tím chuyển sang màu đỏ?',
    topic: 'Axit - Bazơ',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'hidden',
    updatedAt: dateLabel(-29),
    answers: [
      { id: 221, content: 'NaOH', isCorrect: false },
      { id: 222, content: 'NaCl', isCorrect: false },
      { id: 223, content: 'HCl', isCorrect: true },
      { id: 224, content: 'Ca(OH)2', isCorrect: false },
    ],
  },
  {
    id: 23,
    content: 'Một dung dịch có pH = 3 thuộc loại môi trường nào?',
    topic: 'Axit - Bazơ',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-28),
    answers: [
      { id: 231, content: 'Môi trường axit', isCorrect: true },
      { id: 232, content: 'Môi trường trung tính', isCorrect: false },
      { id: 233, content: 'Môi trường bazơ', isCorrect: false },
      { id: 234, content: 'Không xác định được', isCorrect: false },
    ],
  },
  {
    id: 24,
    content: 'Để trung hòa hoàn toàn 0,2 mol H2SO4 cần dùng bao nhiêu mol NaOH?',
    topic: 'Axit - Bazơ',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-27),
    answers: [
      { id: 241, content: '0,1 mol', isCorrect: false },
      { id: 242, content: '0,2 mol', isCorrect: false },
      { id: 243, content: '0,4 mol', isCorrect: true },
      { id: 244, content: '0,8 mol', isCorrect: false },
    ],
  },
  {
    id: 25,
    content: 'Trong bảng tuần hoàn, các nguyên tố hóa học được sắp xếp theo chiều tăng dần của đại lượng nào?',
    topic: 'Bảng tuần hoàn',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-22),
    answers: [
      { id: 251, content: 'Khối lượng riêng', isCorrect: false },
      { id: 252, content: 'Điện tích hạt nhân', isCorrect: true },
      { id: 253, content: 'Số nơtron', isCorrect: false },
      { id: 254, content: 'Nhiệt độ nóng chảy', isCorrect: false },
    ],
  },
  {
    id: 26,
    content: 'Nguyên tố nào sau đây thuộc nhóm khí hiếm?',
    topic: 'Bảng tuần hoàn',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-21),
    answers: [
      { id: 261, content: 'Natri (Na)', isCorrect: false },
      { id: 262, content: 'Nitơ (N)', isCorrect: false },
      { id: 263, content: 'Neon (Ne)', isCorrect: true },
      { id: 264, content: 'Niken (Ni)', isCorrect: false },
    ],
  },
  {
    id: 27,
    content: 'Số thứ tự của chu kì trong bảng tuần hoàn cho biết điều gì về nguyên tử của nguyên tố?',
    topic: 'Bảng tuần hoàn',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-20),
    answers: [
      { id: 271, content: 'Số electron lớp ngoài cùng', isCorrect: false },
      { id: 272, content: 'Số lớp electron', isCorrect: true },
      { id: 273, content: 'Số proton trong hạt nhân', isCorrect: false },
      { id: 274, content: 'Số nơtron trong hạt nhân', isCorrect: false },
    ],
  },
  {
    id: 28,
    content: 'Nguyên tử của nguyên tố X có cấu hình electron 1s²2s²2p⁶3s¹. Vị trí của X trong bảng tuần hoàn là:',
    topic: 'Bảng tuần hoàn',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-19),
    answers: [
      { id: 281, content: 'Chu kì 2, nhóm IA', isCorrect: false },
      { id: 282, content: 'Chu kì 3, nhóm IA', isCorrect: true },
      { id: 283, content: 'Chu kì 3, nhóm VIIA', isCorrect: false },
      { id: 284, content: 'Chu kì 1, nhóm IIIA', isCorrect: false },
    ],
  },
  {
    id: 29,
    content: 'Menđen đã chọn đối tượng nào để nghiên cứu các quy luật di truyền?',
    topic: 'Di truyền',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-14),
    answers: [
      { id: 291, content: 'Ruồi giấm', isCorrect: false },
      { id: 292, content: 'Cây đậu Hà Lan', isCorrect: true },
      { id: 293, content: 'Cây ngô', isCorrect: false },
      { id: 294, content: 'Chuột bạch', isCorrect: false },
    ],
  },
  {
    id: 30,
    content: 'Kiểu gen nào sau đây là kiểu gen dị hợp?',
    topic: 'Di truyền',
    difficulty: 'easy',
    defaultPoint: 0.25,
    status: 'active',
    updatedAt: dateLabel(-13),
    answers: [
      { id: 301, content: 'AA', isCorrect: false },
      { id: 302, content: 'aa', isCorrect: false },
      { id: 303, content: 'Aa', isCorrect: true },
      { id: 304, content: 'AABB', isCorrect: false },
    ],
  },
  {
    id: 31,
    content: 'Cho phép lai Aa × Aa, biết gen A trội hoàn toàn so với gen a. Tỉ lệ kiểu hình ở đời con là bao nhiêu?',
    topic: 'Di truyền',
    difficulty: 'medium',
    defaultPoint: 0.5,
    status: 'active',
    updatedAt: dateLabel(-12),
    answers: [
      { id: 311, content: '1 trội : 1 lặn', isCorrect: false },
      { id: 312, content: '3 trội : 1 lặn', isCorrect: true },
      { id: 313, content: '1 trội : 2 trung gian : 1 lặn', isCorrect: false },
      { id: 314, content: '100% mang tính trạng trội', isCorrect: false },
    ],
  },
  {
    id: 32,
    content: 'Ở người, bệnh mù màu do gen lặn nằm trên nhiễm sắc thể giới tính X quy định. Mẹ có kiểu gen XAXa lấy bố có kiểu gen XAY. Tỉ lệ con trai bị bệnh trong tổng số con sinh ra là bao nhiêu?',
    topic: 'Di truyền',
    difficulty: 'hard',
    defaultPoint: 1,
    status: 'active',
    updatedAt: dateLabel(-11),
    answers: [
      { id: 321, content: '0%', isCorrect: false },
      { id: 322, content: '25%', isCorrect: true },
      { id: 323, content: '50%', isCorrect: false },
      { id: 324, content: '75%', isCorrect: false },
    ],
  },
]

// ===== Bản ghi giao bài (nguồn để suy ra assignment, result và thống kê) =====

interface AssignmentSeed {
  examId: number
  studentId: number
  status: ExamStatus
  /** Số câu đúng, chỉ có ý nghĩa với trạng thái đã chấm. */
  correctCount?: number
}

const assignmentSeeds: AssignmentSeed[] = [
  { examId: 1, studentId: 1, status: 'graded', correctCount: 17 },
  { examId: 1, studentId: 2, status: 'graded', correctCount: 15 },
  { examId: 1, studentId: 3, status: 'graded', correctCount: 13 },
  { examId: 1, studentId: 4, status: 'expired' },
  { examId: 1, studentId: 5, status: 'graded', correctCount: 18 },
  { examId: 1, studentId: 6, status: 'graded', correctCount: 11 },
  { examId: 1, studentId: 7, status: 'graded', correctCount: 16 },
  { examId: 1, studentId: 22, status: 'graded', correctCount: 19 },
  { examId: 1, studentId: 23, status: 'graded', correctCount: 14 },
  { examId: 1, studentId: 24, status: 'graded', correctCount: 12 },
  { examId: 1, studentId: 25, status: 'graded', correctCount: 11 },
  { examId: 1, studentId: 26, status: 'expired' },

  { examId: 2, studentId: 1, status: 'assigned' },
  { examId: 2, studentId: 2, status: 'inprogress' },
  { examId: 2, studentId: 3, status: 'graded', correctCount: 3 },
  { examId: 2, studentId: 5, status: 'graded', correctCount: 4 },
  { examId: 2, studentId: 7, status: 'submitted' },
  { examId: 2, studentId: 8, status: 'graded', correctCount: 2 },
  { examId: 2, studentId: 9, status: 'graded', correctCount: 3 },
  { examId: 2, studentId: 10, status: 'graded', correctCount: 3 },
  { examId: 2, studentId: 11, status: 'inprogress' },
  { examId: 2, studentId: 12, status: 'assigned' },
  { examId: 2, studentId: 13, status: 'graded', correctCount: 3 },
  { examId: 2, studentId: 14, status: 'graded', correctCount: 2 },

  { examId: 3, studentId: 1, status: 'assigned' },
  { examId: 3, studentId: 5, status: 'inprogress' },
  { examId: 3, studentId: 15, status: 'graded', correctCount: 4 },
  { examId: 3, studentId: 16, status: 'submitted' },
  { examId: 3, studentId: 17, status: 'assigned' },
  { examId: 3, studentId: 18, status: 'assigned' },
  { examId: 3, studentId: 19, status: 'assigned' },
  { examId: 3, studentId: 20, status: 'graded', correctCount: 3 },
  { examId: 3, studentId: 21, status: 'assigned' },

  { examId: 4, studentId: 1, status: 'expired' },
  { examId: 4, studentId: 2, status: 'graded', correctCount: 22 },
  { examId: 4, studentId: 3, status: 'graded', correctCount: 19 },
  { examId: 4, studentId: 4, status: 'expired' },
  { examId: 4, studentId: 5, status: 'graded', correctCount: 23 },
  { examId: 4, studentId: 6, status: 'graded', correctCount: 16 },
  { examId: 4, studentId: 7, status: 'graded', correctCount: 20 },
  { examId: 4, studentId: 8, status: 'graded', correctCount: 18 },
  { examId: 4, studentId: 9, status: 'graded', correctCount: 14 },
  { examId: 4, studentId: 10, status: 'graded', correctCount: 21 },
  { examId: 4, studentId: 11, status: 'graded', correctCount: 17 },
  { examId: 4, studentId: 12, status: 'expired' },
  { examId: 4, studentId: 13, status: 'graded', correctCount: 24 },
  { examId: 4, studentId: 14, status: 'graded', correctCount: 15 },

  { examId: 5, studentId: 1, status: 'submitted' },
  { examId: 5, studentId: 2, status: 'graded', correctCount: 3 },
  { examId: 5, studentId: 3, status: 'graded', correctCount: 2 },
  { examId: 5, studentId: 5, status: 'graded', correctCount: 4 },
  { examId: 5, studentId: 7, status: 'graded', correctCount: 3 },
  { examId: 5, studentId: 22, status: 'graded', correctCount: 4 },
  { examId: 5, studentId: 23, status: 'graded', correctCount: 3 },
  { examId: 5, studentId: 24, status: 'graded', correctCount: 2 },
  { examId: 5, studentId: 25, status: 'submitted' },
  { examId: 5, studentId: 26, status: 'expired' },

  { examId: 6, studentId: 1, status: 'assigned' },
  { examId: 6, studentId: 4, status: 'assigned' },
  { examId: 6, studentId: 6, status: 'assigned' },
  { examId: 6, studentId: 22, status: 'assigned' },
  { examId: 6, studentId: 23, status: 'assigned' },
  { examId: 6, studentId: 24, status: 'assigned' },
  { examId: 6, studentId: 25, status: 'assigned' },
  { examId: 6, studentId: 26, status: 'assigned' },

  { examId: 7, studentId: 1, status: 'assigned' },
  { examId: 7, studentId: 2, status: 'assigned' },
  { examId: 7, studentId: 3, status: 'assigned' },
  { examId: 7, studentId: 4, status: 'assigned' },
  { examId: 7, studentId: 5, status: 'assigned' },
  { examId: 7, studentId: 6, status: 'assigned' },
  { examId: 7, studentId: 7, status: 'assigned' },

  { examId: 9, studentId: 1, status: 'graded', correctCount: 9 },
  { examId: 9, studentId: 2, status: 'graded', correctCount: 7 },
  { examId: 9, studentId: 5, status: 'graded', correctCount: 10 },
  { examId: 9, studentId: 7, status: 'graded', correctCount: 8 },
  { examId: 9, studentId: 15, status: 'graded', correctCount: 9 },
  { examId: 9, studentId: 16, status: 'graded', correctCount: 5 },
  { examId: 9, studentId: 17, status: 'graded', correctCount: 7 },
  { examId: 9, studentId: 18, status: 'graded', correctCount: 6 },
  { examId: 9, studentId: 19, status: 'expired' },
  { examId: 9, studentId: 20, status: 'submitted' },
  { examId: 9, studentId: 21, status: 'graded', correctCount: 6 },
]

function isFinishedStatus(status: ExamStatus): boolean {
  return status === 'submitted' || status === 'graded'
}

function countAssignedOf(examId: number): number {
  return assignmentSeeds.filter(seed => seed.examId === examId).length
}

function countSubmittedOf(examId: number): number {
  return assignmentSeeds.filter(seed => seed.examId === examId && isFinishedStatus(seed.status)).length
}

// ===== Bài kiểm tra =====
// Tỷ lệ dễ / trung bình / khó luôn cộng đủ 100 và luôn đủ câu hỏi trong ngân hàng.
// topic rỗng nghĩa là đề tổng hợp, lấy câu hỏi từ mọi chủ đề.

interface ExamSeed {
  id: number
  title: string
  description: string
  durationMinutes: number
  totalQuestions: number
  easyPercentage: number
  mediumPercentage: number
  hardPercentage: number
  pointPerQuestion: number
  topic: string
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  status: ExamStatus
  lifecycle: ExamLifecycle
  showResultAfterSubmit: boolean
  openHourOffset: number
  closeHourOffset: number
  createdDayOffset: number
}

const examSeeds: ExamSeed[] = [
  {
    id: 1,
    title: 'Đề kiểm tra giữa kỳ 1 - Khoa học tự nhiên',
    description: 'Đề tổng hợp giữa kỳ gồm lực và chuyển động, tế bào, điện học, quang học, hóa học và di truyền.',
    durationMinutes: 45,
    totalQuestions: 20,
    easyPercentage: 30,
    mediumPercentage: 50,
    hardPercentage: 20,
    pointPerQuestion: 0.5,
    topic: '',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'graded',
    lifecycle: 'closed',
    showResultAfterSubmit: true,
    openHourOffset: -480,
    closeHourOffset: -336,
    createdDayOffset: -25,
  },
  {
    id: 2,
    title: 'Kiểm tra 15 phút - Điện học',
    description: 'Kiểm tra nhanh định luật Ôm, mạch nối tiếp và mạch song song.',
    durationMinutes: 15,
    totalQuestions: 4,
    easyPercentage: 50,
    mediumPercentage: 25,
    hardPercentage: 25,
    pointPerQuestion: 2.5,
    topic: 'Điện học',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'inprogress',
    lifecycle: 'open',
    showResultAfterSubmit: true,
    openHourOffset: -2,
    closeHourOffset: 3.5,
    createdDayOffset: -6,
  },
  {
    id: 3,
    title: 'Kiểm tra 15 phút - Di truyền',
    description: 'Kiểm tra các quy luật di truyền Mendel và di truyền liên kết giới tính.',
    durationMinutes: 15,
    totalQuestions: 4,
    easyPercentage: 50,
    mediumPercentage: 25,
    hardPercentage: 25,
    pointPerQuestion: 2.5,
    topic: 'Di truyền',
    shuffleQuestions: true,
    shuffleAnswers: false,
    status: 'assigned',
    lifecycle: 'open',
    showResultAfterSubmit: false,
    openHourOffset: -24,
    closeHourOffset: 26,
    createdDayOffset: -4,
  },
  {
    id: 4,
    title: 'Đề ôn tập cuối kỳ 1 - Khoa học tự nhiên',
    description: 'Đề ôn tập tổng hợp cuối kỳ, bao phủ toàn bộ tám chủ đề trong ngân hàng câu hỏi.',
    durationMinutes: 60,
    totalQuestions: 25,
    easyPercentage: 40,
    mediumPercentage: 40,
    hardPercentage: 20,
    pointPerQuestion: 0.4,
    topic: '',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'graded',
    lifecycle: 'closed',
    showResultAfterSubmit: true,
    openHourOffset: -288,
    closeHourOffset: -120,
    createdDayOffset: -18,
  },
  {
    id: 5,
    title: 'Kiểm tra 1 tiết - Lực và chuyển động',
    description: 'Kiểm tra đơn vị đo lực, tốc độ chuyển động và điều kiện cân bằng của vật.',
    durationMinutes: 20,
    totalQuestions: 4,
    easyPercentage: 25,
    mediumPercentage: 50,
    hardPercentage: 25,
    pointPerQuestion: 2.5,
    topic: 'Lực và chuyển động',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'graded',
    lifecycle: 'closed',
    showResultAfterSubmit: false,
    openHourOffset: -216,
    closeHourOffset: -96,
    createdDayOffset: -12,
  },
  {
    id: 6,
    title: 'Bài luyện tập - Phản ứng hóa học',
    description: 'Bài luyện tập về định luật bảo toàn khối lượng và cân bằng phương trình hóa học.',
    durationMinutes: 25,
    totalQuestions: 4,
    easyPercentage: 0,
    mediumPercentage: 50,
    hardPercentage: 50,
    pointPerQuestion: 2.5,
    topic: 'Phản ứng hóa học',
    shuffleQuestions: true,
    shuffleAnswers: false,
    status: 'assigned',
    lifecycle: 'scheduled',
    showResultAfterSubmit: true,
    openHourOffset: 48,
    closeHourOffset: 120,
    createdDayOffset: -3,
  },
  {
    id: 7,
    title: 'Kiểm tra Hóa học - Bảng tuần hoàn',
    description: 'Kiểm tra cách sắp xếp nguyên tố, ý nghĩa chu kì và nhóm trong bảng tuần hoàn.',
    durationMinutes: 15,
    totalQuestions: 4,
    easyPercentage: 50,
    mediumPercentage: 25,
    hardPercentage: 25,
    pointPerQuestion: 2.5,
    topic: 'Bảng tuần hoàn',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'assigned',
    lifecycle: 'scheduled',
    showResultAfterSubmit: true,
    openHourOffset: 120,
    closeHourOffset: 192,
    createdDayOffset: -2,
  },
  {
    id: 8,
    title: 'Đề thi thử học kỳ 1 - Khoa học tự nhiên',
    description: 'Bản nháp đề thi thử học kỳ, đang chờ rà soát lại tỷ lệ câu hỏi trước khi giao.',
    durationMinutes: 90,
    totalQuestions: 25,
    easyPercentage: 40,
    mediumPercentage: 40,
    hardPercentage: 20,
    pointPerQuestion: 0.4,
    topic: '',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'assigned',
    lifecycle: 'draft',
    showResultAfterSubmit: false,
    openHourOffset: 240,
    closeHourOffset: 288,
    createdDayOffset: -1,
  },
  {
    id: 9,
    title: 'Đề luyện tập nhanh - Khoa học tự nhiên',
    description: 'Đề luyện tập ngắn mười câu, dùng để đánh giá nhanh mức độ nắm bài của học sinh.',
    durationMinutes: 20,
    totalQuestions: 10,
    easyPercentage: 30,
    mediumPercentage: 50,
    hardPercentage: 20,
    pointPerQuestion: 1,
    topic: '',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'graded',
    lifecycle: 'closed',
    showResultAfterSubmit: true,
    openHourOffset: -168,
    closeHourOffset: -72,
    createdDayOffset: -10,
  },
  {
    id: 10,
    title: 'Kiểm tra giữa kỳ 2 - Khoa học tự nhiên',
    description: 'Bản nháp đề giữa kỳ 2, chưa chọn nhóm lớp để giao bài.',
    durationMinutes: 45,
    totalQuestions: 20,
    easyPercentage: 30,
    mediumPercentage: 50,
    hardPercentage: 20,
    pointPerQuestion: 0.5,
    topic: '',
    shuffleQuestions: true,
    shuffleAnswers: true,
    status: 'assigned',
    lifecycle: 'draft',
    showResultAfterSubmit: true,
    openHourOffset: 336,
    closeHourOffset: 408,
    createdDayOffset: 0,
  },
]

export const mockExams: Exam[] = examSeeds.map(seed => ({
  id: seed.id,
  title: seed.title,
  description: seed.description,
  durationMinutes: seed.durationMinutes,
  totalQuestions: seed.totalQuestions,
  easyPercentage: seed.easyPercentage,
  mediumPercentage: seed.mediumPercentage,
  hardPercentage: seed.hardPercentage,
  pointPerQuestion: seed.pointPerQuestion,
  topic: seed.topic,
  shuffleQuestions: seed.shuffleQuestions,
  shuffleAnswers: seed.shuffleAnswers,
  assignedCount: countAssignedOf(seed.id),
  submittedCount: countSubmittedOf(seed.id),
  status: seed.status,
  lifecycle: seed.lifecycle,
  openAt: dateTimeLabel(seed.openHourOffset),
  closeAt: dateTimeLabel(seed.closeHourOffset),
  showResultAfterSubmit: seed.showResultAfterSubmit,
  createdAt: dateLabel(seed.createdDayOffset),
}))

// ===== Tra cứu nội bộ khi dựng dữ liệu dẫn xuất =====

const examSeedById = new Map<number, ExamSeed>(examSeeds.map(seed => [seed.id, seed]))
const examById = new Map<number, Exam>(mockExams.map(exam => [exam.id, exam]))
const studentById = new Map<number, Student>(mockStudents.map(student => [student.id, student]))
const questionById = new Map<number, Question>(mockQuestions.map(question => [question.id, question]))

function buildAssignmentId(examId: number, studentId: number): number {
  return examId * 100 + studentId
}

function buildAttemptId(examId: number, studentId: number): number {
  return 5000 + examId * 100 + studentId
}

function buildMaxScore(exam: Exam): number {
  return roundToOneDecimal(exam.totalQuestions * exam.pointPerQuestion)
}

/** Thời gian làm bài thực tế, luôn ngắn hơn thời lượng cho phép. */
function buildSpentMinutes(exam: Exam, studentId: number): number {
  return Math.max(2, Math.round(exam.durationMinutes * (0.55 + (studentId % 7) * 0.06)))
}

// ===== Giao bài và kết quả =====

const builtAssignments: ExamAssignment[] = []
const builtResults: ResultSummary[] = []
const orderWithinExam: Record<number, number> = {}

assignmentSeeds.forEach(seed => {
  const exam = examById.get(seed.examId)
  const examSeed = examSeedById.get(seed.examId)
  const student = studentById.get(seed.studentId)
  if (!exam || !examSeed || !student) return

  const order = orderWithinExam[seed.examId] ?? 0
  orderWithinExam[seed.examId] = order + 1

  const finished = isFinishedStatus(seed.status)
  const hasAttempt = finished || seed.status === 'inprogress'
  const attemptId = hasAttempt ? buildAttemptId(seed.examId, seed.studentId) : undefined
  const correctCount = seed.status === 'graded' ? seed.correctCount ?? 0 : 0
  const score = seed.status === 'graded' ? roundToOneDecimal(correctCount * exam.pointPerQuestion) : undefined
  const spentMinutes = buildSpentMinutes(exam, seed.studentId)

  // Bài đã nộp luôn nằm trong quá khứ, kể cả với đề vẫn đang mở.
  const submittedHourOffset = Math.min(examSeed.closeHourOffset, -1) - order * 0.8
  const submittedAt = finished ? dateTimeLabel(submittedHourOffset) : undefined
  const startedAt = finished
    ? dateTimeLabel(submittedHourOffset - spentMinutes / 60)
    : seed.status === 'inprogress'
      ? dateTimeLabel(-0.3 - order * 0.1)
      : undefined

  builtAssignments.push({
    id: buildAssignmentId(seed.examId, seed.studentId),
    examId: exam.id,
    studentId: student.id,
    studentName: student.fullName,
    studentCode: student.code,
    group: student.group,
    status: seed.status,
    attemptId,
    score,
    startedAt,
    submittedAt,
  })

  if (!finished || attemptId === undefined || submittedAt === undefined) return

  builtResults.push({
    attemptId,
    examId: exam.id,
    examTitle: exam.title,
    studentId: student.id,
    studentName: student.fullName,
    group: student.group,
    status: seed.status,
    score: score ?? 0,
    maxScore: buildMaxScore(exam),
    correctCount,
    totalQuestions: exam.totalQuestions,
    submittedAt,
    durationMinutes: spentMinutes,
  })
})

export const mockExamAssignments: ExamAssignment[] = builtAssignments

export const mockResults: ResultSummary[] = builtResults

// ===== Chi tiết đáp án của một số lượt làm bài =====

/**
 * Dựng chi tiết đáp án từ ngân hàng câu hỏi.
 * selectedOffsets[i] là vị trí đáp án học sinh chọn cho câu thứ i, -1 nghĩa là bỏ trống.
 */
function buildAttemptAnswerDetails(
  questionIds: number[],
  selectedOffsets: number[],
  pointPerQuestion: number,
): AttemptAnswerDetail[] {
  const details: AttemptAnswerDetail[] = []
  questionIds.forEach((questionId, index) => {
    const question = questionById.get(questionId)
    if (!question) return
    const correctAnswer = question.answers.find(answer => answer.isCorrect)
    if (!correctAnswer) return

    const selectedOffset = selectedOffsets[index] ?? -1
    const selectedAnswer = selectedOffset >= 0 ? question.answers[selectedOffset] : undefined
    const selectedAnswerId = selectedAnswer ? selectedAnswer.id : null

    details.push({
      questionId: question.id,
      content: question.content,
      imageUrl: question.imageUrl,
      point: pointPerQuestion,
      answers: question.answers,
      selectedAnswerId,
      correctAnswerId: correctAnswer.id,
      isCorrect: selectedAnswerId === correctAnswer.id,
    })
  })
  return details
}

export const mockAttemptAnswers: Record<number, AttemptAnswerDetail[]> = {
  // Trần Thị Lan - Đề kiểm tra giữa kỳ 1: đúng 17/20.
  [buildAttemptId(1, 1)]: buildAttemptAnswerDetails(
    [1, 5, 13, 14, 21, 29, 2, 3, 6, 9, 10, 15, 18, 23, 27, 31, 4, 16, 24, 32],
    [1, 1, 0, 2, 1, 1, 1, 2, 0, 1, 1, 1, 1, 2, 1, 1, 0, 0, 2, 2],
    0.5,
  ),
  // Trần Thị Lan - Đề luyện tập nhanh: đúng 9/10.
  [buildAttemptId(9, 1)]: buildAttemptAnswerDetails(
    [25, 26, 30, 2, 6, 15, 18, 27, 8, 20],
    [1, 2, 2, 1, 1, 1, 1, 1, 1, 0],
    1,
  ),
  // Lê Văn Dũng - Kiểm tra 15 phút Điện học: đúng 3/4.
  [buildAttemptId(2, 3)]: buildAttemptAnswerDetails([13, 14, 15, 16], [0, 2, 1, 2], 2.5),
  // Nguyễn Minh Khoa - Kiểm tra 1 tiết Lực và chuyển động: đúng 3/4.
  [buildAttemptId(5, 2)]: buildAttemptAnswerDetails([1, 2, 3, 4], [1, 1, 2, 3], 2.5),
}

/** Giữ lại cho các màn hình cũ đang dùng danh sách câu hỏi rút gọn. */
export const mockAttemptQuestions: AttemptQuestion[] = mockQuestions.slice(0, 4).map(question => ({
  id: question.id,
  content: question.content,
  imageUrl: question.imageUrl,
  topic: question.topic,
  point: question.defaultPoint,
  answers: question.answers,
}))

// ===== Hồ sơ người dùng =====

export const mockTeacherProfile: UserProfile = {
  id: 1,
  role: 'teacher',
  fullName: 'Nguyễn Văn An',
  email: 'an.nv@eduquiz.vn',
  username: 'an.nv',
  phone: '0912 345 678',
  school: 'Trường THPT Nguyễn Du',
  subject: 'Khoa học tự nhiên',
  avatarColor: '#6366F1',
  joinedAt: dateLabel(-400),
}

export const mockStudentProfile: UserProfile = {
  id: 1,
  role: 'student',
  fullName: 'Trần Thị Lan',
  email: 'lan.tt@student.edu.vn',
  username: 'lan.tt',
  code: 'HS1001',
  group: 'Lớp 10A',
  phone: '0987 654 321',
  school: 'Trường THPT Nguyễn Du',
  avatarColor: '#8B5CF6',
  joinedAt: dateLabel(-128),
}

export const mockAdminProfile: UserProfile = {
  id: 1,
  role: 'admin',
  fullName: 'Phạm Quốc Huy',
  email: 'huy.pq@eduquiz.vn',
  username: 'huy.pq',
  phone: '0903 112 233',
  school: 'Trường THPT Nguyễn Du',
  avatarColor: '#0EA5E9',
  joinedAt: dateLabel(-520),
}

// ===== Bài kiểm tra dưới góc nhìn học sinh đang đăng nhập =====

interface StudentExamItemSeed {
  examId: number
  status: StudentExamItemStatus
  correctCount?: number
}

const studentExamItemSeeds: StudentExamItemSeed[] = [
  { examId: 2, status: 'open' },
  { examId: 3, status: 'open' },
  { examId: 6, status: 'upcoming' },
  { examId: 7, status: 'upcoming' },
  { examId: 5, status: 'submitted' },
  { examId: 1, status: 'graded', correctCount: 17 },
  { examId: 9, status: 'graded', correctCount: 9 },
  { examId: 4, status: 'expired' },
]

const builtStudentExamItems: StudentExamItem[] = []

studentExamItemSeeds.forEach(seed => {
  const exam = examById.get(seed.examId)
  const examSeed = examSeedById.get(seed.examId)
  if (!exam || !examSeed) return

  const hasAttempt = seed.status === 'submitted' || seed.status === 'graded'
  const correctCount = seed.correctCount ?? 0

  builtStudentExamItems.push({
    assignmentId: buildAssignmentId(seed.examId, demoStudentId),
    examId: exam.id,
    name: exam.title,
    topic: exam.topic,
    topicColor: getTopicColor(exam.topic),
    description: exam.description,
    teacher: mockTeacherProfile.fullName,
    durationMinutes: exam.durationMinutes,
    totalQuestions: exam.totalQuestions,
    status: seed.status,
    openAt: exam.openAt,
    closeAt: exam.closeAt,
    deadline: dateAtHourOffset(examSeed.closeHourOffset),
    attemptId: hasAttempt ? buildAttemptId(seed.examId, demoStudentId) : undefined,
    score: seed.status === 'graded' ? roundToOneDecimal(correctCount * exam.pointPerQuestion) : undefined,
    correctCount: seed.status === 'graded' ? correctCount : undefined,
    maxScore: hasAttempt ? buildMaxScore(exam) : undefined,
  })
})

export const mockStudentExamItems: StudentExamItem[] = builtStudentExamItems

// ===== Thông báo =====

/** Thông báo mock có thêm audience để service lọc theo vai trò. */
export interface MockNotification extends AppNotification {
  audience: UserRole
}

export const mockNotifications: MockNotification[] = [
  {
    id: 1,
    audience: 'teacher',
    type: 'deadline_soon',
    title: 'Bài kiểm tra sắp đóng',
    message: 'Bài "Kiểm tra 15 phút - Điện học" sẽ đóng trong khoảng 3 giờ nữa.',
    createdAt: dateTimeLabel(-0.5),
    isRead: false,
    link: '/giao-vien/bai-kiem-tra/2',
  },
  {
    id: 2,
    audience: 'teacher',
    type: 'exam_submitted',
    title: 'Học sinh vừa nộp bài',
    message: 'Lê Văn Dũng đã nộp bài "Kiểm tra 15 phút - Điện học".',
    createdAt: dateTimeLabel(-2.6),
    isRead: false,
    link: '/giao-vien/ket-qua',
  },
  {
    id: 3,
    audience: 'teacher',
    type: 'exam_submitted',
    title: 'Học sinh vừa nộp bài',
    message: 'Bùi Thị Kim Ngân đã nộp bài "Kiểm tra 15 phút - Điện học".',
    createdAt: dateTimeLabel(-5.2),
    isRead: true,
    link: '/giao-vien/ket-qua',
  },
  {
    id: 4,
    audience: 'teacher',
    type: 'auto_submitted',
    title: 'Hệ thống tự động nộp bài',
    message: 'Bài làm của Cao Minh Nhật đã được tự động nộp khi hết thời gian làm bài.',
    createdAt: dateTimeLabel(-30),
    isRead: true,
    link: '/giao-vien/ket-qua',
  },
  {
    id: 5,
    audience: 'teacher',
    type: 'exam_updated',
    title: 'Đã cập nhật bài kiểm tra',
    message: 'Bạn đã chỉnh tỷ lệ câu hỏi của bản nháp "Đề thi thử học kỳ 1 - Khoa học tự nhiên".',
    createdAt: dateTimeLabel(-20),
    isRead: true,
    link: '/giao-vien/bai-kiem-tra/8',
  },
  {
    id: 6,
    audience: 'student',
    type: 'deadline_soon',
    title: 'Sắp hết hạn nộp bài',
    message: 'Bài "Kiểm tra 15 phút - Điện học" sẽ đóng trong khoảng 3 giờ nữa. Hãy hoàn thành sớm.',
    createdAt: dateTimeLabel(-0.4),
    isRead: false,
    link: '/hoc-sinh/bai-kiem-tra',
  },
  {
    id: 7,
    audience: 'student',
    type: 'exam_assigned',
    title: 'Bạn có bài kiểm tra mới',
    message: 'Giáo viên Nguyễn Văn An đã giao bài "Kiểm tra 15 phút - Điện học" cho lớp của bạn.',
    createdAt: dateTimeLabel(-2.5),
    isRead: false,
    link: '/hoc-sinh/bai-kiem-tra',
  },
  {
    id: 8,
    audience: 'student',
    type: 'exam_assigned',
    title: 'Bạn có bài kiểm tra mới',
    message: 'Bài "Kiểm tra 15 phút - Di truyền" đã được giao cho bạn, hạn nộp còn hơn một ngày.',
    createdAt: dateTimeLabel(-25),
    isRead: false,
    link: '/hoc-sinh/bai-kiem-tra',
  },
  {
    id: 9,
    audience: 'student',
    type: 'exam_updated',
    title: 'Bài kiểm tra được cập nhật',
    message: 'Thời gian mở bài "Bài luyện tập - Phản ứng hóa học" đã được điều chỉnh sang tuần sau.',
    createdAt: dateTimeLabel(-18),
    isRead: true,
    link: '/hoc-sinh/bai-kiem-tra',
  },
  {
    id: 10,
    audience: 'student',
    type: 'exam_submitted',
    title: 'Nộp bài thành công',
    message: 'Bạn đã nộp bài "Kiểm tra 1 tiết - Lực và chuyển động". Điểm sẽ hiển thị sau khi giáo viên chấm.',
    createdAt: dateTimeLabel(-100),
    isRead: true,
    link: '/hoc-sinh/ket-qua',
  },
  // TODO GĐ-C: NotificationType chưa có mục nào cho tài khoản nên nhãn chip vẫn nói về bài kiểm tra.
  {
    id: 11,
    audience: 'admin',
    type: 'exam_assigned',
    title: 'Tài khoản học sinh mới được tạo',
    message: 'Một tài khoản học sinh vừa được tạo và xếp vào Lớp 10A.',
    createdAt: dateTimeLabel(-1.2),
    isRead: false,
    link: '/quan-tri/hoc-sinh',
  },
  {
    id: 12,
    audience: 'admin',
    type: 'deadline_soon',
    title: 'Có tài khoản đang bị khóa',
    message: 'Hệ thống ghi nhận 3 tài khoản học sinh đang bị khóa. Kiểm tra và mở lại nếu cần.',
    createdAt: dateTimeLabel(-6.5),
    isRead: false,
    link: '/quan-tri/hoc-sinh',
  },
  {
    id: 13,
    audience: 'admin',
    type: 'exam_updated',
    title: 'Đã cập nhật thông tin học sinh',
    message: 'Bạn đã đổi nhóm lớp của Trần Thị Lan sang Lớp 10A.',
    createdAt: dateTimeLabel(-28),
    isRead: true,
    link: '/quan-tri/hoc-sinh',
  },
]

// ===== Hoạt động gần đây trên dashboard giáo viên =====

export const mockTeacherActivities: ActivityItem[] = [
  {
    id: 1,
    time: dateTimeLabel(-0.5),
    text: 'Bài "Kiểm tra 15 phút - Điện học" sắp đóng, còn 4 học sinh chưa nộp.',
    tone: 'warning',
  },
  {
    id: 2,
    time: dateTimeLabel(-2.6),
    text: 'Lê Văn Dũng nộp bài "Kiểm tra 15 phút - Điện học" và đạt 7,5 điểm.',
    tone: 'success',
  },
  {
    id: 3,
    time: dateTimeLabel(-6),
    text: 'Đã giao bài "Kiểm tra 15 phút - Di truyền" cho lớp 11A.',
    tone: 'info',
  },
  {
    id: 4,
    time: dateTimeLabel(-20),
    text: 'Cập nhật tỷ lệ câu hỏi cho bản nháp "Đề thi thử học kỳ 1 - Khoa học tự nhiên".',
    tone: 'purple',
  },
  {
    id: 5,
    time: dateTimeLabel(-30),
    text: 'Hệ thống tự động nộp bài của Cao Minh Nhật khi hết thời gian.',
    tone: 'warning',
  },
  {
    id: 6,
    time: dateTimeLabel(-48),
    text: 'Thêm 4 câu hỏi mới vào chủ đề Di truyền trong ngân hàng câu hỏi.',
    tone: 'info',
  },
]
