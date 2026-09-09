# EduQuiz — Frontend

Giao diện hệ thống kiểm tra trắc nghiệm trực tuyến cho trường phổ thông: giáo viên soạn ngân hàng
câu hỏi và ra đề theo tỷ lệ độ khó, học sinh làm bài có đồng hồ đếm ngược, giáo viên xem kết quả.

**Backend: [EduQuiz_BE](https://github.com/HuynhHoaa/EduQuiz_BE)** — .NET 10 + PostgreSQL.

App hiện chạy bằng tầng service mock, nên **clone về là chạy được ngay, không cần backend hay database**.

---

## Chạy thử

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # tsc -b && vite build
npm run lint         # oxlint
```

Trên Windows PowerShell nếu `npm` bị chặn bởi execution policy, dùng `npm.cmd` thay cho `npm`.

### Đăng nhập

Mật khẩu chung: `eduquiz123`

| Vai trò | Đăng nhập bằng |
|---|---|
| Quản trị viên | `huy.pq@eduquiz.vn` |
| Giáo viên | `an.nv@eduquiz.vn` |
| Học sinh | `lan.tt` |

---

## Ba vai trò, ba bộ khung

| Vai trò | Layout | Khu vực |
|---|---|---|
| **Quản trị viên** | Sidebar dọc | Tổng quan · quản lý tài khoản học sinh |
| **Giáo viên** | Sidebar dọc | Nhóm lớp · bài kiểm tra · ngân hàng câu hỏi · kết quả |
| **Học sinh** | Navbar ngang | Bài kiểm tra của tôi · kết quả của tôi |

Phân quyền thực thi ở **tầng route** bằng `RequireRole`, không phải ẩn nút trên giao diện.
Đổi vai trò trong localStorage cũng không vào được khu vực không thuộc về mình.

---

## Công nghệ

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · react-router-dom 7 · lucide-react · oxlint

```
src/
├── app/          App, RequireRole — khai báo route và chặn theo vai trò
├── components/   common (Modal, Toast, Skeleton, Pagination…) và layout theo vai trò
├── features/     mỗi nghiệp vụ một thư mục: pages, components, hooks, utils riêng
├── services/     9 service — ranh giới duy nhất chạm tới dữ liệu
├── data/         mock dùng chung cho tầng service
├── hooks/        useAsync, useDebouncedValue, useMediaQuery
├── lib/          apiClient, format, delay, topicTheme
└── types/        model dùng chung toàn app
```

---

## Vài chỗ đáng xem

**Tầng service là ranh giới duy nhất chạm dữ liệu** ([src/services/](src/services/)). Mỗi hàm mock
kèm delay giả lập 250–650ms, nhờ vậy trạng thái loading / error / empty được thiết kế thật ngay từ
đầu thay vì thêm vào sau. Khi gắn API thật chỉ thay phần ruột của 9 service này — không trang nào
phải sửa.

**Đồng hồ làm bài tính theo mốc hết giờ tuyệt đối** ([useCountdown.ts](src/features/exam-taking/hooks/useCountdown.ts)),
không trừ dần mỗi giây. Tab bị trình duyệt tiết chế thì đồng hồ không trôi, và tải lại trang vẫn ra
đúng thời gian còn lại. Kèm tự động nộp khi hết giờ, chặn nộp hai lần, lưu nháp có debounce.

**Exam Blueprint** ([ExamBuilderPage.tsx](src/features/exams/pages/ExamBuilderPage.tsx)) — ra đề theo
tỷ lệ ba mức độ khó với preset và nút cân bằng về 100%, đối chiếu trực tiếp với tồn kho ngân hàng
câu hỏi để biết đề có sinh nổi hay không trước khi bấm lưu.

**Deep-link ở trang Kết quả** — bộ lọc đồng bộ với query string, nên chép link gửi cho đồng nghiệp
vẫn giữ nguyên bộ lọc đang xem.

**Sidebar rê chuột tự mở** — nở đè lên nội dung thay vì đẩy, nên bảng bên dưới không nhảy cột.

---

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/EduQuiz_Requirement.md](docs/EduQuiz_Requirement.md) | Đặc tả yêu cầu, 8 giai đoạn nghiệp vụ |
| [docs/EduQuiz_FE_Tech_Structure.md](docs/EduQuiz_FE_Tech_Structure.md) | Kiến trúc frontend |
| [docs/EduQuiz_API_Contract.md](docs/EduQuiz_API_Contract.md) | 68 endpoint, lược đồ database, 6 quy tắc bảo mật, sự kiện SignalR |
| [docs/EduQuiz_Workflow_Deploy.md](docs/EduQuiz_Workflow_Deploy.md) | Quy trình làm việc và phương án deploy |

Hợp đồng API được rút ra **từ chính tầng service này**, nên nó mô tả đúng những gì giao diện thật sự
gọi chứ không phải một bản thiết kế đoán trước.
