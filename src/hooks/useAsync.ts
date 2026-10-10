import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
}

export interface AsyncResult<T> extends AsyncState<T> {
  /** Nạp lại và hiện trạng thái đang tải — dùng khi người dùng chủ động bấm "Thử lại" hay vừa sửa dữ liệu. */
  reload: () => void
  /**
   * Nạp lại **ngầm**: không bật `loading`, và nếu lần nạp này hỏng thì giữ nguyên dữ liệu đang hiện.
   * Dùng khi sự kiện realtime báo dữ liệu đã đổi — người đang xem không được thấy khung xương hiện lại
   * hay cả trang thành màn hình lỗi chỉ vì một lượt hỏi nền.
   */
  refresh: () => void
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
  // Lần chạy kế tiếp của effect là một lượt `refresh` (ngầm) chứ không phải `reload` hay đổi deps.
  const silentRef = useRef(false)
  const lastDependencyKeyRef = useRef(dependencyKey)
  // Đang có một lần nạp "ồn" (có hiện loading) chưa xong. Lúc đó refresh không được lặng lẽ nuốt kết
  // quả: loading đã bật sẵn, nên nó phải đi tiếp như một lần nạp thường để còn tắt được loading.
  const loudRequestRef = useRef(false)
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

    // Deps đổi cùng lúc với refresh thì đó là một truy vấn khác hẳn, không còn là "làm tươi" cái cũ.
    const silent =
      silentRef.current && lastDependencyKeyRef.current === dependencyKey && !loudRequestRef.current
    silentRef.current = false
    lastDependencyKeyRef.current = dependencyKey

    if (!silent) {
      loudRequestRef.current = true
      setState(previous => ({ data: previous.data, loading: true, error: undefined }))
    }

    loaderRef
      .current()
      .then(result => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return
        loudRequestRef.current = false
        setState({ data: result, loading: false, error: undefined })
      })
      .catch((caught: unknown) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return
        loudRequestRef.current = false
        if (silent) return
        setState({ data: undefined, loading: false, error: toErrorMessage(caught) })
      })
  }, [dependencyKey, reloadToken])

  const reload = useCallback(() => {
    silentRef.current = false
    setReloadToken(token => token + 1)
  }, [])

  const refresh = useCallback(() => {
    silentRef.current = true
    setReloadToken(token => token + 1)
  }, [])

  return { data: state.data, loading: state.loading, error: state.error, reload, refresh }
}

export default useAsync
