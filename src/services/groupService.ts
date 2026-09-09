import { mockStudentGroups, mockStudents } from '../data/mockEduQuiz'
import { simulate } from '../lib/delay'
import { matchesSearch, nextId, todayLabel } from '../lib/format'
import type { Student, StudentGroup } from '../types'

/** Học sinh chưa thuộc nhóm lớp nào. */
export const UNASSIGNED_GROUP_ID = 0
export const UNASSIGNED_GROUP_NAME = 'Chưa phân nhóm'

export interface GroupPayload {
  name: string
  description: string
}

function countStudentsOf(groupId: number): number {
  return mockStudents.filter(student => student.groupId === groupId).length
}

/** Đồng bộ lại sĩ số của mọi nhóm sau khi học sinh được thêm, chuyển nhóm hoặc gỡ ra. */
export function syncGroupCounts(): void {
  mockStudentGroups.forEach(group => {
    group.studentCount = countStudentsOf(group.id)
  })
}

function findGroup(id: number): StudentGroup {
  const group = mockStudentGroups.find(item => item.id === id)
  if (!group) {
    throw new Error('Không tìm thấy nhóm lớp.')
  }
  return group
}

function findStudent(id: number): Student {
  const student = mockStudents.find(item => item.id === id)
  if (!student) {
    throw new Error('Không tìm thấy học sinh.')
  }
  return student
}

function validatePayload(payload: GroupPayload, currentId?: number): GroupPayload {
  const name = payload.name.trim()
  const description = payload.description.trim()

  if (!name) {
    throw new Error('Tên nhóm lớp không được để trống.')
  }
  if (name.length < 2) {
    throw new Error('Tên nhóm lớp phải có ít nhất 2 ký tự.')
  }
  const duplicated = mockStudentGroups.some(
    group => group.id !== currentId && group.name.toLowerCase() === name.toLowerCase(),
  )
  if (duplicated) {
    throw new Error('Tên nhóm lớp đã tồn tại.')
  }

  return { name, description }
}

export function listGroups(params: { search?: string } = {}): Promise<StudentGroup[]> {
  return simulate(() => {
    syncGroupCounts()
    return mockStudentGroups
      .filter(group => matchesSearch(params.search, [group.name, group.description]))
      .map(group => ({ ...group }))
  })
}

export function getGroup(id: number): Promise<StudentGroup> {
  return simulate(() => {
    syncGroupCounts()
    return { ...findGroup(id) }
  })
}

export function createGroup(payload: GroupPayload): Promise<StudentGroup> {
  return simulate(() => {
    const validated = validatePayload(payload)
    const group: StudentGroup = {
      id: nextId(mockStudentGroups),
      name: validated.name,
      description: validated.description,
      studentCount: 0,
      createdAt: todayLabel(),
    }
    mockStudentGroups.unshift(group)
    return { ...group }
  })
}

export function updateGroup(id: number, payload: GroupPayload): Promise<StudentGroup> {
  return simulate(() => {
    const group = findGroup(id)
    const validated = validatePayload(payload, id)
    const previousName = group.name

    group.name = validated.name
    group.description = validated.description

    // Tên nhóm được lưu kèm trong bản ghi học sinh nên phải cập nhật theo.
    if (previousName !== group.name) {
      mockStudents.forEach(student => {
        if (student.groupId === group.id) {
          student.group = group.name
        }
      })
    }

    group.studentCount = countStudentsOf(group.id)
    return { ...group }
  })
}

export function deleteGroup(id: number): Promise<void> {
  return simulate(() => {
    const group = findGroup(id)
    const studentCount = countStudentsOf(group.id)
    if (studentCount > 0) {
      throw new Error(
        `Không thể xóa nhóm còn ${studentCount} học sinh. Hãy chuyển học sinh sang nhóm khác trước.`,
      )
    }

    const index = mockStudentGroups.findIndex(item => item.id === id)
    mockStudentGroups.splice(index, 1)
  })
}

export function listGroupStudents(groupId: number): Promise<Student[]> {
  return simulate(() => {
    findGroup(groupId)
    return mockStudents.filter(student => student.groupId === groupId).map(student => ({ ...student }))
  })
}

/** Học sinh có thể thêm vào nhóm: mọi học sinh chưa thuộc nhóm này. */
export function listAssignableStudents(groupId: number): Promise<Student[]> {
  return simulate(() => {
    findGroup(groupId)
    return mockStudents.filter(student => student.groupId !== groupId).map(student => ({ ...student }))
  })
}

export function addStudentToGroup(groupId: number, studentId: number): Promise<void> {
  return simulate(() => {
    const group = findGroup(groupId)
    const student = findStudent(studentId)
    if (student.groupId === group.id) {
      throw new Error('Học sinh đã thuộc nhóm lớp này.')
    }

    student.groupId = group.id
    student.group = group.name
    syncGroupCounts()
  })
}

export function removeStudentFromGroup(groupId: number, studentId: number): Promise<void> {
  return simulate(() => {
    findGroup(groupId)
    const student = findStudent(studentId)
    if (student.groupId !== groupId) {
      throw new Error('Học sinh không thuộc nhóm lớp này.')
    }

    student.groupId = UNASSIGNED_GROUP_ID
    student.group = UNASSIGNED_GROUP_NAME
    syncGroupCounts()
  })
}
