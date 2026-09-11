/**
 * Danh sách hệ quả trong hộp xác nhận.
 *
 * Tách thành một chỗ để mọi hộp liệt kê hệ quả trông giống nhau: người dùng quen mắt với một kiểu
 * danh sách thì đọc nhanh hơn, và không hộp nào vô tình dồn năm hệ quả vào một câu dài khó đọc.
 */
export default function ConsequenceList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 list-disc pl-4 marker:text-slate-300">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
