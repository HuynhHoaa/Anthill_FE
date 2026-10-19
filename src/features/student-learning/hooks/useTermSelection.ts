import { useSearchParams } from 'react-router-dom'
import type { AcademicTerm } from '../../../types'

/** Lựa chọn kỳ của học sinh: `'all'` là mọi kỳ; số là mã kỳ (0 = lớp chưa phân kỳ). */
export type TermSelection = 'all' | number

const PARAM = 'ky'
const ALL_VALUE = 'tat-ca'

/**
 * Kỳ đang xem ở "Lớp học của tôi" và "Bảng điểm", giữ trong địa chỉ (`?ky=`) nên tải lại trang vẫn giữ kỳ (các liên kết trên menu không mang
 * tham số này, nên sang trang kia thì mở lại kỳ hiện tại).
 *
 * Chưa chọn gì thì mở sẵn kỳ hiện tại của nhà trường (nếu em có lớp trong đó), không thì kỳ mới nhất em có lớp. Em chỉ có một kỳ (hoặc
 * chưa kỳ nào) thì không có gì để lọc: `visible = false` và luôn là "mọi kỳ". `selection` là `undefined` khi danh sách kỳ còn đang nạp.
 */
export function useTermSelection(terms: AcademicTerm[] | undefined) {
  const [params, setParams] = useSearchParams()

  const raw = params.get(PARAM)
  const known = new Set((terms ?? []).map(term => term.id))
  const requested: TermSelection | undefined =
    raw === ALL_VALUE ? 'all' : raw !== null && /^\d+$/.test(raw) && known.has(Number(raw)) ? Number(raw) : undefined

  const visible = (terms?.length ?? 0) > 1
  const fallback: TermSelection | undefined =
    terms === undefined
      ? undefined
      : !visible
        ? 'all'
        : terms.find(term => term.isCurrent && term.id !== 0)?.id ?? terms.find(term => term.id !== 0)?.id ?? 'all'

  const selection = visible ? requested ?? fallback : fallback

  const select = (value: TermSelection) => {
    setParams(
      previous => {
        const next = new URLSearchParams(previous)
        next.set(PARAM, value === 'all' ? ALL_VALUE : String(value))
        return next
      },
      { replace: true },
    )
  }

  return { selection, select, visible }
}
