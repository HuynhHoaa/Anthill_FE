import { mockStudentGroups, mockStudents } from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { matchesSearch, nextId, paginate, todayLabel } from '../lib/format'
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME, syncGroupCounts } from './groupService'
import type { Paged, Student, StudentStatus } from '../types'

export interface StudentPayload {
  fullName: string
  email: string
  username: string
  code: string
  groupId: number
  status: StudentStatus
}

export interface ListStudentsParams {
  search?: string
  /** Lọc theo tên nhóm lớp, hoặc 'all' để bỏ lọc. */
  group?: string
  status?: 'all' | StudentStatus
  page?: number
  pageSize?: number
}

function findStudent(id: number): Student {
  const student = mockStudents.find(item => item.id === id)
  if (!student) {
    throw new Error('Không tìm thấy học sinh.')
  }
  return student
}

function resolveGroupName(groupId: number): string {
  if (groupId === UNASSIGNED_GROUP_ID) return UNASSIGNED_GROUP_NAME
  const group = mockStudentGroups.find(item => item.id === groupId)
  if (!group) {
    throw new Error('Nhóm lớp không tồn tại.')
  }
  return group.name
}

function validatePayload(payload: StudentPayload, currentId?: number): StudentPayload {
  const fullName = payload.fullName.trim()
  const email = payload.email.trim()
  const username = payload.username.trim()
  const code = payload.code.trim()

  if (!fullName) {
    throw new Error('Họ và tên không được để trống.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email không đúng định dạng.')
  }
  if (username.length < 3) {
    throw new Error('Tên đăng nhập phải có ít nhất 3 ký tự.')
  }
  if (!code) {
    throw new Error('Mã học sinh không được để trống.')
  }

  const isOther = (student: Student) => student.id !== currentId
  if (mockStudents.some(student => isOther(student) && student.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email này đã được sử dụng bởi học sinh khác.')
  }
  if (
    mockStudents.some(student => isOther(student) && student.username.toLowerCase() === username.toLowerCase())
  ) {
    throw new Error('Tên đăng nhập này đã tồn tại.')
  }
  if (mockStudents.some(student => isOther(student) && student.code.toLowerCase() === code.toLowerCase())) {
    throw new Error('Mã học sinh này đã tồn tại.')
  }

  return { fullName, email, username, code, groupId: payload.groupId, status: payload.status }
}

export function listStudents(params: ListStudentsParams): Promise<Paged<Student>> {
  return simulate(() => {
    const filtered = mockStudents.filter(student => {
      if (!matchesSearch(params.search, [student.fullName, student.email, student.username, student.code])) {
        return false
      }
      if (params.group && params.group !== 'all' && student.group !== params.group) {
        return false
      }
      if (params.status && params.status !== 'all' && student.status !== params.status) {
        return false
      }
      return true
    })

    const page = paginate(filtered, params.page, params.pageSize)
    return { ...page, items: page.items.map(student => ({ ...student })) }
  })
}

export function getStudent(id: number): Promise<Student> {
  return simulate(() => ({ ...findStudent(id) }))
}

export function createStudent(payload: StudentPayload): Promise<Student> {
  return simulate(() => {
    const validated = validatePayload(payload)
    const student: Student = {
      id: nextId(mockStudents),
      fullName: validated.fullName,
      email: validated.email,
      username: validated.username,
      code: validated.code,
      group: resolveGroupName(validated.groupId),
      groupId: validated.groupId,
      status: validated.status,
      createdAt: todayLabel(),
      completedExams: 0,
      averageScore: 0,
    }

    // Thêm lên đầu để học sinh vừa tạo hiện ngay ở trang đầu danh sách.
    mockStudents.unshift(student)
    syncGroupCounts()
    return { ...student }
  })
}

export function updateStudent(id: number, payload: StudentPayload): Promise<Student> {
  return simulate(() => {
    const student = findStudent(id)
    const validated = validatePayload(payload, id)

    student.fullName = validated.fullName
    student.email = validated.email
    student.username = validated.username
    student.code = validated.code
    student.groupId = validated.groupId
    student.group = resolveGroupName(validated.groupId)
    student.status = validated.status

    syncGroupCounts()
    return { ...student }
  })
}

export function setStudentStatus(id: number, status: StudentStatus): Promise<Student> {
  return simulate(() => {
    const student = findStudent(id)
    student.status = status
    return { ...student }
  })
}
