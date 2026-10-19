import type { GroupTeacher } from '../../../types'

/** Nhãn một giáo viên trong ô chọn: tên, môn nếu có, và lý do khi tài khoản không chọn được. */
export function teacherOptionLabel(teacher: GroupTeacher): string {
  const subject = teacher.subject ? ` · ${teacher.subject}` : ''
  const locked = teacher.status === 'locked' ? ' (đang bị khoá)' : ''
  return `${teacher.fullName}${subject}${locked}`
}
