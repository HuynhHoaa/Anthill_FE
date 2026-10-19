import type { ImportKind } from '../../services/importService'

export interface ImportCopy {
  /** Tiêu đề hộp thoại. */
  title: string
  /** Tên trong tên file danh sách lỗi: `loi-nhap-<slug>.csv`. */
  fileSlug: string
  /** Nhãn ô đếm bản ghi mới ở bước xem trước. */
  createdLabel: string
  /** Nhãn ô đếm "xếp thêm lớp cho em đã có"; chỉ học sinh có. */
  placedLabel?: string
  /** Giải thích cách điền, gom vào dấu chấm than thay vì bày sẵn. */
  tips: string[]
  /** Câu mô tả kết quả sau khi nhập thật. */
  doneCreated: (count: number) => string
  /** Câu dặn sau khi nhập xong, nếu có. */
  doneHint?: string
}

export const IMPORT_COPY: Record<ImportKind, ImportCopy> = {
  students: {
    title: 'Nhập học sinh từ Excel',
    fileSlug: 'hoc-sinh',
    createdLabel: 'Tài khoản mới',
    placedLabel: 'Xếp thêm vào lớp',
    tips: [
      'Chỉ cần mã học sinh và họ tên. Email, số điện thoại, tên đăng nhập và lớp có thể để trống.',
      'Tên đăng nhập để trống thì dùng mã học sinh. Email để trống thì hệ thống tạo một email tạm.',
      'Mã đã có trong hệ thống thì dòng đó nói về học sinh cũ: hồ sơ không bị sửa, chỉ xếp thêm em vào lớp ghi trên dòng nếu em chưa học lớp đó.',
      'Một học sinh học được nhiều lớp cùng lúc: ghi thêm lớp thì em được xếp thêm, không rời lớp đang học. Muốn chuyển hay gỡ lớp thì làm ở hồ sơ học sinh và phải ghi lý do.',
      'Lớp đã khoá không nhận thêm em: dòng ghi lớp đó bị báo lỗi, các dòng khác vẫn nhập.',
    ],
    doneCreated: count => `Đã tạo ${count} tài khoản học sinh.`,
  },
  teachers: {
    title: 'Nhập giáo viên từ Excel',
    fileSlug: 'giao-vien',
    createdLabel: 'Tài khoản mới',
    tips: [
      'Cần họ tên, email, số điện thoại và môn giảng dạy. Email chính là tên đăng nhập của giáo viên.',
      'Môn ghi theo tên hoặc mã môn. Dòng để trống ô Môn thì dùng môn chọn chung ở bước này.',
      'Email đã có trong hệ thống: nếu là giáo viên cùng họ tên thì dòng đó được tính là đã nhập, không sửa hồ sơ; nếu khác thì báo lỗi.',
    ],
    doneCreated: count => `Đã tạo ${count} tài khoản giáo viên.`,
  },
  school: {
    title: 'Nhập danh sách trường từ Excel',
    fileSlug: 'danh-sach-truong',
    createdLabel: 'Tài khoản mới',
    placedLabel: 'Xếp thêm vào lớp',
    tips: [
      'Một file cho cả trường: mỗi dòng là một học sinh, ghi kèm lớp và giáo viên chủ nhiệm của lớp đó. Hệ thống tạo giáo viên, tạo lớp (kèm chủ nhiệm) và xếp học sinh vào lớp trong một lần.',
      'Cần mã học sinh, họ tên, lớp, tên, email và số điện thoại của giáo viên chủ nhiệm. Thông tin giáo viên chỉ cần điền một lần cho mỗi lớp (các dòng sau để trống hoặc điền lặp lại đều được).',
      'Môn của giáo viên ghi ở cột Môn giảng dạy; môn chưa có trong hệ thống sẽ được tạo mới (bước xem trước liệt kê để bạn soát lại). Giáo viên đã có thì để trống ô môn cũng được.',
      'Cột Kỳ học (không bắt buộc) ghi kỳ của lớp, ví dụ "Học kỳ 1 · 2026–2027" hay "Lớp 11": điền một lần cho mỗi lớp, kỳ chưa có sẽ được tạo mới. Học sinh lọc lớp và bảng điểm theo kỳ.',
      'Cùng tên lớp là một lớp, cùng email giáo viên là một người. Hai dòng cùng lớp mà ghi hai giáo viên khác nhau thì dòng sau bị báo lỗi.',
      'Ô gộp (merge) cho lớp và giáo viên cả nhóm dòng được đọc đúng.',
      'Lỗi ở giáo viên hay lớp thì các học sinh của lớp đó chưa được xếp; dòng khác vẫn nhập. Sửa file rồi nhập lại nguyên file: dòng đã nhập sẽ được nhận ra.',
      'Giáo viên và học sinh đã có thì hồ sơ không bị sửa; học sinh có sẵn chỉ được xếp thêm vào lớp ghi trên dòng.',
    ],
    doneCreated: count => `Đã tạo ${count} tài khoản mới.`,
    doneHint: 'Mọi tài khoản mới đều phải đổi mật khẩu ở lần đăng nhập đầu tiên.',
  },
  groups: {
    title: 'Nhập lớp từ Excel',
    fileSlug: 'lop',
    createdLabel: 'Lớp mới',
    tips: [
      'Cần tên lớp và email của giáo viên phụ trách. Mỗi lớp có đúng một giáo viên, nên giáo viên phải có tài khoản trước.',
      'Lớp mới là bản nháp. Xếp học sinh vào lớp rồi công bố để giáo viên và học sinh thấy lớp.',
      'Tên lớp đã có: nếu cùng giáo viên thì dòng đó được tính là đã nhập; nếu khác giáo viên thì báo lỗi, vì đổi giáo viên phải ghi lý do ở trang lớp.',
    ],
    doneCreated: count => `Đã lập ${count} lớp mới (bản nháp).`,
    doneHint: 'Xếp học sinh vào lớp rồi công bố để giáo viên và học sinh thấy lớp.',
  },
}
