/**
 * Danh mục kỳ học (`/api/terms`) — chỉ quản trị viên. Kỳ là nhãn gom lớp theo thời gian ("Học kỳ 1 · 2026–2027" ở đại học, "Lớp 11" ở
 * phổ thông); học sinh lọc lớp và bảng điểm theo kỳ.
 */
import { apiClient } from '../lib/apiClient'
import type { AcademicTerm } from '../types'

export interface TermPayload {
  name: string
  /** `yyyy-MM-dd` hoặc `null` khi bỏ trống. */
  startsOn: string | null
  endsOn: string | null
  isCurrent: boolean
}

export function listTerms(): Promise<AcademicTerm[]> {
  return apiClient.get<AcademicTerm[]>('/api/terms')
}

export function createTerm(payload: TermPayload): Promise<AcademicTerm> {
  return apiClient.post<AcademicTerm>('/api/terms', payload)
}

export function updateTerm(id: number, payload: TermPayload): Promise<AcademicTerm> {
  return apiClient.put<AcademicTerm>(`/api/terms/${id}`, payload)
}

/** Server trả 409 khi kỳ còn lớp, kèm số lớp trong thông điệp. */
export async function deleteTerm(id: number): Promise<void> {
  await apiClient.remove(`/api/terms/${id}`)
}
