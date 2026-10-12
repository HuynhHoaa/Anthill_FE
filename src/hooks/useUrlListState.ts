import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDebouncedValue } from './useDebouncedValue'

export interface UrlFilterSpec {
  /** Giá trị khi chưa lọc. Không được ghi lên URL, để địa chỉ của một danh sách chưa lọc luôn trơn. */
  default: string
  /**
   * Các giá trị hợp lệ. Có thì một giá trị lạ trên URL rơi về mặc định (ví dụ `?trang-thai=abc`); không có
   * thì nhận mọi chuỗi, dùng cho những bộ lọc mà tập giá trị do dữ liệu quyết định như chủ đề.
   */
  allowed?: readonly string[]
}

interface UrlListStateOptions {
  /** Thời gian chờ sau lần gõ cuối trước khi từ khoá được ghi lên URL và gửi đi. */
  debounceMs?: number
  searchKey?: string
  pageKey?: string
}

/** Trang lớn hơn mức này vô nghĩa với mọi danh sách, và một số quá lớn làm server trả 400. */
const MAX_PAGE = 100_000

/** URL gõ tay có thể chứa 'abc', '0' hay số âm: mọi giá trị lạ rơi về trang đầu. */
function toSafePage(raw: string | null): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 1
  const page = Math.floor(parsed)
  return page > 0 ? Math.min(page, MAX_PAGE) : 1
}

/**
 * Tìm kiếm, bộ lọc và số trang của một trang danh sách, giữ trên query string của URL.
 *
 * Vì sao URL: giáo viên lọc ra "đang mở", sang trang 3, bấm một đề rồi bấm Back. State trong component
 * chết cùng trang, nên họ quay về danh sách đầy đủ ở trang 1. Có trong URL thì Back, F5 và chép liên kết
 * đều giữ nguyên chỗ đang đứng. Trang kết quả đã làm vậy; hook này là cùng khuôn cho các danh sách khác.
 *
 * - Mọi thay đổi dùng `replace`: đổi một bộ lọc không đẩy thêm một mục lịch sử, nên Back đi về trang
 *   trước đó chứ không lội ngược từng lần bấm lọc.
 * - Đổi từ khoá hay bộ lọc thì về trang 1 trong cùng một lần ghi, nên truy vấn không bao giờ thấy từ
 *   khoá mới đi cùng số trang cũ.
 * - Ô tìm kiếm giữ state riêng để phản hồi tức thì từng phím; chỉ giá trị đã chờ (`debounceMs`) mới lên
 *   URL, và `search` trả về chính là giá trị trên URL.
 */
export function useUrlListState<K extends string>(
  specs: Record<K, UrlFilterSpec>,
  options: UrlListStateOptions = {},
) {
  const { debounceMs = 300, searchKey = 'q', pageKey = 'trang' } = options
  const [searchParams, setSearchParams] = useSearchParams()

  // Callback cần giá trị mới nhất mà không phải đổi danh tính theo từng lần render.
  const specsRef = useRef(specs)
  specsRef.current = specs
  const paramsRef = useRef(searchParams)
  paramsRef.current = searchParams

  /**
   * Đường ghi duy nhất lên URL. `patch` chứa các khoá cần đổi; giá trị rỗng hay bằng mặc định thì xoá
   * khoá. Không có khoá trang trong `patch` thì về trang 1.
   */
  const commit = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(paramsRef.current)

      for (const [key, value] of Object.entries(patch)) {
        const fallback = key === pageKey ? '1' : key === searchKey ? '' : specsRef.current[key as K]?.default
        if (value === undefined || value === '' || value === fallback) next.delete(key)
        else next.set(key, value)
      }
      if (!(pageKey in patch)) next.delete(pageKey)

      // Hai lần ghi liên tiếp trong cùng một nhịp phải nối tiếp nhau chứ không đè nhau.
      paramsRef.current = next
      setSearchParams(next, { replace: true })
    },
    [pageKey, searchKey, setSearchParams],
  )

  const urlSearch = searchParams.get(searchKey) ?? ''
  const [searchInput, setSearchInput] = useState(urlSearch)
  const debouncedInput = useDebouncedValue(searchInput, debounceMs)
  // Giá trị từ khoá mà chính hook này vừa ghi hay vừa đọc từ URL, để nhận ra tiếng vọng của mình.
  const syncedSearchRef = useRef(urlSearch)

  // Gõ xong thì ghi lên URL (và về trang 1).
  useEffect(() => {
    if (debouncedInput === syncedSearchRef.current) return
    syncedSearchRef.current = debouncedInput
    commit({ [searchKey]: debouncedInput })
  }, [debouncedInput, searchKey, commit])

  // URL đổi từ bên ngoài (bấm lại mục menu dẫn về danh sách trơn, Back) thì ô tìm kiếm theo kịp.
  useEffect(() => {
    if (urlSearch === syncedSearchRef.current) return
    syncedSearchRef.current = urlSearch
    setSearchInput(urlSearch)
  }, [urlSearch])

  const filters = {} as Record<K, string>
  for (const key of Object.keys(specs) as K[]) {
    const spec = specs[key]
    const raw = searchParams.get(key)?.trim()
    filters[key] = raw && (!spec.allowed || spec.allowed.includes(raw)) ? raw : spec.default
  }

  const setFilter = useCallback((key: K, value: string) => commit({ [key]: value }), [commit])
  const setPage = useCallback((page: number) => commit({ [pageKey]: String(page) }), [commit, pageKey])

  /** Xoá từ khoá và mọi bộ lọc, về trang 1, không chờ debounce. */
  const clearAll = useCallback(() => {
    const patch: Record<string, string | undefined> = { [searchKey]: undefined }
    for (const key of Object.keys(specsRef.current)) patch[key] = undefined
    syncedSearchRef.current = ''
    setSearchInput('')
    commit(patch)
  }, [commit, searchKey])

  return {
    /** Nội dung ô tìm kiếm, cập nhật theo từng phím. */
    searchInput,
    setSearchInput,
    /** Từ khoá đã chốt (nằm trên URL): dùng cho truy vấn, nhãn "khớp bộ lọc" và trạng thái rỗng. */
    search: urlSearch,
    filters,
    setFilter,
    page: toSafePage(searchParams.get(pageKey)),
    setPage,
    clearAll,
  }
}

export default useUrlListState
