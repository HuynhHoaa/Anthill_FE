/**
 * Bảng màu xoay vòng cho nhóm lớp và avatar học sinh.
 * Màu được suy ra từ id nên mỗi lần render đều cho ra cùng một kết quả.
 */

export interface GroupAccent {
  iconBg: string
  iconColor: string
  bar: string
}

export interface AvatarTone {
  bg: string
  text: string
}

const groupAccents: GroupAccent[] = [
  { iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', bar: '#6366F1' },
  { iconBg: 'bg-violet-50', iconColor: 'text-violet-600', bar: '#8B5CF6' },
  { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', bar: '#10B981' },
  { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', bar: '#F59E0B' },
  { iconBg: 'bg-sky-50', iconColor: 'text-sky-600', bar: '#0EA5E9' },
]

const avatarTones: AvatarTone[] = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
]

function toSafeIndex(value: number, length: number): number {
  if (!Number.isFinite(value) || length <= 0) return 0
  return Math.abs(Math.trunc(value)) % length
}

export function getGroupAccent(groupId: number): GroupAccent {
  return groupAccents[toSafeIndex(groupId, groupAccents.length)]
}

export function getAvatarTone(studentId: number): AvatarTone {
  return avatarTones[toSafeIndex(studentId, avatarTones.length)]
}
