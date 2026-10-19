/** Ngày hôm nay (giờ máy) dạng 2026-10-19, để gắn vào tên file xuất. */
export function dateStamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Rút một tên (có dấu, có khoảng trắng) thành mảnh tên file chỉ gồm chữ thường, số và dấu gạch: "Lớp 10A1" → "lop-10a1". */
export function fileSlug(value: string, maxLength = 32): string {
  const slug = value
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
  return slug || 'lop'
}

/** Lưu một blob xuống máy bằng cách giả một cú bấm vào liên kết tải về. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Thu hồi chậm một nhịp: thu hồi ngay thì vài trình duyệt chưa kịp bắt đầu tải.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Một ô CSV. Ô bắt đầu bằng `=`, `+`, `-`, `@` (hoặc tab, xuống dòng) bị Excel hiểu là công thức khi mở file; dữ liệu ở đây lấy từ
 * file Excel người dùng nhập vào nên không thể tin là sạch. Thêm dấu nháy đơn ở đầu thì Excel coi là văn bản.
 */
export function csvCell(value: string | number | undefined): string {
  let text = value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Dựng file CSV mở được bằng Excel tiếng Việt: có BOM UTF-8 để dấu không vỡ, và dòng `sep=,` đầu file để Excel chia cột bằng
 * dấu phẩy dù máy đặt dấu phân cách danh sách khác (nhiều máy tiếng Việt dùng dấu chấm phẩy — không có dòng này cả bảng dồn
 * vào một cột).
 */
export function buildCsv(rows: (string | number | undefined)[][]): Blob {
  const body = rows.map(row => row.map(csvCell).join(',')).join('\r\n')
  return new Blob(['﻿', 'sep=,\r\n', body, '\r\n'], { type: 'text/csv;charset=utf-8' })
}
