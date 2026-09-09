import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
}

export interface AsyncResult<T> extends AsyncState<T> {
  reload: () => void
}

/**
 * Gộp deps thành một chuỗi khoá để so sánh theo giá trị.
 * Nhờ vậy trang có thể truyền thẳng object bộ lọc mà không sợ vòng lặp gọi lại vô tận.
 */
function buildDependencyKey(deps: unknown[]): string {
  try {
    return JSON.stringify(deps)
  } catch {
    return deps.map(String).join('|')
  }
}

function toErrorMessage(caught: unknown): string {
  if (caught instanceof Error && caught.message) return caught.message
  if (typeof caught === 'string' && caught) return caught
  return 'Đã xảy ra lỗi khi tải dữ liệu.'
}

/**
 * Gọi một hàm bất đồng bộ và theo dõi đủ ba trạng thái loading / error / data.
 * Mỗi lần deps đổi sẽ phát một request mới và bỏ qua kết quả của request cũ,
 * nên gõ nhanh vào ô tìm kiếm không thể làm dữ liệu nhảy về kết quả đến muộn.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncResult<T> {
  // loader là arrow function mới ở mỗi lần render nên không được đưa vào dependency array,
  // chỉ giữ tham chiếu mới nhất để lần chạy sau luôn dùng đúng bản hiện tại.
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)
  const dependencyKey = buildDependencyKey(deps)
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: undefined,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setState(previous => ({ data: previous.data, loading: true, error: undefined }))

    loaderRef
      .current()
      .then(result => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return
        setState({ data: result, loading: false, error: undefined })
      })
      .catch((caught: unknown) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return
        setState({ data: undefined, loading: false, error: toErrorMessage(caught) })
      })
  }, [dependencyKey, reloadToken])

  const reload = useCallback(() => {
    setReloadToken(token => token + 1)
  }, [])

  return { data: state.data, loading: state.loading, error: state.error, reload }
}

export default useAsync
