# Anthill Frontend Technology & Structure

## 1. Frontend Context

Frontend của Anthill là web application phục vụ 3 role: **Admin**, **Teacher** và **Student**.

Admin (hiệu trưởng / giám đốc trung tâm) dùng hệ thống để lập và công bố lớp, xếp Student vào lớp, phân công Teacher và quản lý tài khoản Student. Teacher dùng hệ thống để xem các lớp được phân công, soạn ngân hàng câu hỏi, tạo bài kiểm tra theo tỷ lệ câu dễ / trung bình / khó, giao bài cho lớp (có thể đặt khung giờ riêng từng lớp) và xem kết quả. Student dùng hệ thống để xem bài kiểm tra được giao, làm bài và xem kết quả.

Frontend không tập trung vào quản lý khóa học. Trọng tâm chính là trải nghiệm tạo bài kiểm tra và làm bài kiểm tra.

Mọi dữ liệu đi qua API thật của backend; frontend không còn dữ liệu giả lập nên phải chạy cùng backend. Quyền hạn và mọi quy tắc nghiệp vụ (phạm vi dữ liệu, chấm điểm, hạn nộp, quyền xem điểm và đáp án) do server quyết định; giao diện chỉ hiển thị và điều hướng.

---

## 2. Frontend Stack

Đang sử dụng:

- ReactJS 19 + TypeScript.
- Vite.
- React Router (react-router-dom 7).
- Tailwind CSS v4 (plugin `@tailwindcss/vite`).
- lucide-react cho icon.
- oxlint.

Không dùng thư viện quản lý state, thư viện gọi dữ liệu hay thư viện form: dữ liệu tải qua hook `useAsync` tự viết trên nền `fetch`, form validate bằng code tự viết.

| Nhu cầu | Công nghệ |
|---|---|
| Build frontend | Vite + ReactJS |
| Routing | React Router |
| UI Styling | Tailwind CSS |
| Icon | lucide-react |
| Form & Validation | Tự viết, hiện lỗi theo từng trường do server trả về |
| API Call | `fetch` qua `src/lib/apiClient.ts` |
| Tải dữ liệu | Hook `useAsync` |
| State dùng chung | React Context (Toast, Confirm) + localStorage / sessionStorage |
| Realtime | Chưa kết nối (xem mục 6) |
| Lint | oxlint |

---

## 3. Frontend Folder Structure

```text
EduQuiz.Frontend/
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── app/
│   │   ├── App.tsx                  # khai báo route, bắt 401 giữa phiên
│   │   └── RequireRole.tsx          # chặn route theo role
│   │
│   ├── assets/
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Badge.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── ConfirmProvider.tsx
│   │   │   ├── ConsequenceList.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Toast.tsx
│   │   │
│   │   └── layout/
│   │       ├── AdminLayout.tsx
│   │       ├── TeacherLayout.tsx
│   │       ├── StudentLayout.tsx
│   │       ├── DashboardLayout.tsx  # khung sidebar dùng chung cho Admin và Teacher
│   │       ├── Sidebar.tsx
│   │       └── Header.tsx
│   │
│   ├── features/
│   │   ├── admin/
│   │   │   └── pages/AdminDashboardPage.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── ProfilePage.tsx
│   │   │   └── components/
│   │   │       ├── ChangePasswordForm.tsx
│   │   │       ├── ProfileInfoForm.tsx
│   │   │       └── StudentScoreSummary.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── pages/
│   │   │       ├── TeacherDashboardPage.tsx
│   │   │       └── StudentDashboardPage.tsx
│   │   │
│   │   ├── students/
│   │   │   ├── pages/
│   │   │   │   ├── StudentListPage.tsx
│   │   │   │   ├── StudentEditorPage.tsx     # tạo và sửa
│   │   │   │   └── StudentDetailPage.tsx     # Teacher xem chỉ đọc
│   │   │   ├── components/
│   │   │   │   ├── StudentStatusPill.tsx
│   │   │   │   └── StudentTextField.tsx
│   │   │   └── hooks/useStudentAccountActions.tsx
│   │   │
│   │   ├── student-groups/
│   │   │   ├── pages/
│   │   │   │   ├── AdminGroupListPage.tsx
│   │   │   │   ├── AdminGroupDetailPage.tsx
│   │   │   │   ├── TeacherGroupListPage.tsx
│   │   │   │   └── TeacherGroupDetailPage.tsx
│   │   │   └── components/
│   │   │       ├── AddStudentsModal.tsx
│   │   │       ├── AddTeachersModal.tsx
│   │   │       ├── GroupFormModal.tsx
│   │   │       ├── GroupHealthIndicator.tsx
│   │   │       ├── GroupStudentTable.tsx
│   │   │       ├── GroupTeacherList.tsx
│   │   │       ├── groupHealth.ts
│   │   │       └── groupTheme.ts
│   │   │
│   │   ├── question-bank/
│   │   │   ├── pages/
│   │   │   │   ├── QuestionBankPage.tsx
│   │   │   │   └── QuestionEditorPage.tsx    # tạo và sửa
│   │   │   ├── components/
│   │   │   │   ├── AnswerEditorRow.tsx
│   │   │   │   └── QuestionPreview.tsx
│   │   │   └── utils/questionConfirmations.ts
│   │   │
│   │   ├── exams/
│   │   │   ├── pages/
│   │   │   │   ├── ExamListPage.tsx
│   │   │   │   ├── ExamBuilderPage.tsx       # tạo và sửa
│   │   │   │   ├── ExamDetailPage.tsx
│   │   │   │   └── ExamAssignPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── DifficultyRatioBar.tsx
│   │   │   │   ├── DifficultyRatioEditor.tsx
│   │   │   │   └── FieldError.tsx
│   │   │   └── utils/
│   │   │       ├── blueprintRatio.ts
│   │   │       ├── examConfirmations.ts
│   │   │       ├── examDraftStorage.ts
│   │   │       └── examScheduleFormat.ts
│   │   │
│   │   ├── exam-taking/
│   │   │   ├── pages/
│   │   │   │   ├── StudentExamListPage.tsx
│   │   │   │   ├── ExamIntroPage.tsx
│   │   │   │   ├── TakeExamPage.tsx
│   │   │   │   └── ExamSubmittedPage.tsx
│   │   │   ├── hooks/useCountdown.ts
│   │   │   └── utils/examProgressStorage.ts
│   │   │
│   │   ├── results/
│   │   │   ├── pages/
│   │   │   │   ├── TeacherResultsPage.tsx
│   │   │   │   ├── StudentResultsPage.tsx
│   │   │   │   └── ResultDetailPage.tsx      # dùng chung, tham số audience
│   │   │   └── components/ScoreRing.tsx
│   │   │
│   │   ├── notifications/
│   │   │   └── pages/NotificationsPage.tsx   # dùng chung cho cả ba role
│   │   │
│   │   └── misc/
│   │       └── pages/NotFoundPage.tsx
│   │
│   ├── services/                    # mỗi nghiệp vụ một service, trang không gọi API trực tiếp
│   │   ├── authService.ts
│   │   ├── studentService.ts
│   │   ├── groupService.ts
│   │   ├── questionService.ts
│   │   ├── examService.ts
│   │   ├── attemptService.ts
│   │   ├── resultService.ts
│   │   ├── dashboardService.ts
│   │   ├── notificationService.ts
│   │   ├── uploadService.ts         # upload ảnh câu hỏi/đáp án, kiểm tra trước loại và dung lượng
│   │   └── mappers.ts               # đổi DTO của backend sang model của giao diện
│   │
│   ├── hooks/
│   │   ├── useAsync.ts
│   │   ├── useDebouncedValue.ts
│   │   └── useMediaQuery.ts
│   │
│   ├── lib/
│   │   ├── apiClient.ts
│   │   ├── format.ts
│   │   └── topicTheme.ts
│   │
│   ├── styles/
│   │   └── index.css
│   │
│   ├── types/
│   │   └── index.ts                 # model dùng chung toàn app
│   │
│   └── main.tsx                     # BrowserRouter → ToastProvider → ConfirmProvider → App
│
├── .env.example                     # VITE_API_BASE_URL
├── package.json
└── README.md
```

---

## 4. Main Pages

URL dùng tiếng Việt không dấu. Mỗi nhóm route được bọc trong `RequireRole`; chưa đăng nhập thì về `/dang-nhap` (đăng nhập xong quay lại đúng trang đang định vào), sai role thì về dashboard của role mình.

### Auth Pages

- Login Page — `/dang-nhap`, có tab chọn role.
- Profile Page — `/<khu vực>/ho-so`: cập nhật thông tin cá nhân, đổi mật khẩu.
- Notifications Page — `/<khu vực>/thong-bao`, cho cả ba role.

### Admin Pages (`/quan-tri`)

- Admin Dashboard — `/quan-tri`.
- Class List — `/quan-tri/nhom-lop`.
- Class Detail — `/quan-tri/nhom-lop/:id`: xếp Student, phân công Teacher, công bố / bỏ công bố.
- Student List — `/quan-tri/hoc-sinh`.
- Create Student — `/quan-tri/hoc-sinh/tao`.
- Edit Student — `/quan-tri/hoc-sinh/:id/sua`: sửa, khóa, cấp lại mật khẩu, xóa mềm, khôi phục.

### Teacher Pages (`/giao-vien`)

- Teacher Dashboard — `/giao-vien`.
- Class List (chỉ đọc) — `/giao-vien/nhom-lop`.
- Class Detail (chỉ đọc) — `/giao-vien/nhom-lop/:id`.
- Student Detail (chỉ đọc) — `/giao-vien/hoc-sinh/:id`.
- Question Bank — `/giao-vien/cau-hoi`.
- Create Question — `/giao-vien/cau-hoi/tao`.
- Edit Question — `/giao-vien/cau-hoi/:id/sua`.
- Exam List — `/giao-vien/bai-kiem-tra`.
- Exam Builder — `/giao-vien/bai-kiem-tra/tao`, `/giao-vien/bai-kiem-tra/:id/sua`.
- Exam Detail — `/giao-vien/bai-kiem-tra/:id`.
- Assign Exam — `/giao-vien/bai-kiem-tra/:id/giao-bai`.
- Exam Results — `/giao-vien/ket-qua`.
- Result Detail — `/giao-vien/ket-qua/:attemptId`.

### Student Pages (`/hoc-sinh`)

- Student Dashboard — `/hoc-sinh`.
- My Assigned Exams — `/hoc-sinh/bai-kiem-tra`.
- Exam Intro — `/hoc-sinh/bai-kiem-tra/:assignmentId`.
- Take Exam — `/hoc-sinh/bai-kiem-tra/:assignmentId/lam-bai`.
- Exam Submitted — `/hoc-sinh/bai-kiem-tra/:attemptId/da-nop`.
- My Results — `/hoc-sinh/ket-qua`.
- Result Detail — `/hoc-sinh/ket-qua/:attemptId`.

---

## 5. Important UI Flows

### 5.1. Admin Sets Up a Class

```text
Admin Dashboard
→ Nhóm lớp
→ Tạo lớp (lớp mới ở trạng thái nháp)
→ Thêm Student vào lớp
→ Phân công Teacher
→ Công bố lớp (hộp xác nhận cảnh báo nếu lớp chưa có Student hoặc Teacher)
→ Teacher được phân công thấy lớp trong khu vực của mình
```

### 5.2. Admin Manages Student Accounts

```text
Admin Dashboard
→ Học sinh
→ Tạo tài khoản / Sửa / Khóa / Cấp lại mật khẩu (mật khẩu mới hiện đúng một lần)
→ Xóa: nhập lý do bắt buộc → tài khoản vào danh sách chờ xóa
→ Trong 60 ngày: Khôi phục được
→ Hết 60 ngày: backend xóa dữ liệu cá nhân, giữ kết quả làm bài
```

Dashboard của Admin hiện cảnh báo khi có tài khoản đang chờ xóa, kèm đường dẫn tới danh sách đã lọc.

### 5.3. Teacher Creates Question Bank

```text
Teacher Dashboard
→ Ngân hàng câu hỏi
→ Tạo câu hỏi
→ Nhập nội dung câu hỏi
→ Chọn chủ đề, difficulty: Easy / Medium / Hard, chế độ Shared / Private
→ Thêm đáp án (có thể kèm ảnh)
→ Chọn đáp án đúng
→ Save
```

Ảnh câu hỏi và ảnh đáp án đi qua `ImageUploader`: chọn hoặc kéo thả là upload ngay qua `POST /api/uploads/images` (kiểm tra trước đuôi file, loại ảnh và trần 4 MB giống server), hiện ảnh xem trước kèm trạng thái đang tải, cho huỷ, đổi hoặc xoá ảnh, và hiện nguyên thông điệp lỗi của server. Còn ô ảnh nào đang tải thì nút lưu câu hỏi bị khoá. Form chỉ giữ đường dẫn tương đối server trả về; mọi chỗ vẽ ảnh (ngân hàng câu hỏi, trình soạn, làm bài, xem lại kết quả) ghép đường dẫn với `VITE_API_BASE_URL` qua `resolveMediaUrl`. Ảnh đã tải lên mà không được lưu hoặc bị thay thì không bị xoá từ giao diện, vì bản đề đã sinh vẫn có thể trỏ tới ảnh cũ.

### 5.4. Teacher Creates Exam Blueprint

```text
Teacher Dashboard
→ Bài kiểm tra
→ Tạo bài kiểm tra
→ Nhập tên, mô tả, thời gian làm bài, lịch mở/đóng chung
→ Chọn tổng số câu, chủ đề, điểm mỗi câu
→ Nhập tỷ lệ Easy / Medium / Hard (có preset và nút cân bằng về 100%)
→ Preview số câu khả dụng (gọi POST /api/exams/blueprint-preview sau 400ms kể từ lần chỉnh cuối)
→ Lưu nháp / Lưu bài kiểm tra / Lưu và giao bài
```

UI cần validate:

- Easy + Medium + Hard = 100% (trừ khi lưu nháp).
- Tổng số câu phải lớn hơn 0.
- Ngân hàng câu hỏi phải đủ số câu theo từng difficulty (trừ khi lưu nháp).
- Thời gian làm bài phải hợp lệ và không dài hơn khoảng mở bài.

Form soạn đề được giữ tạm trong sessionStorage khi Teacher rời trang đi bổ sung câu hỏi cho ngân hàng.

Khi đã có Student bắt đầu làm bài, server khoá cấu hình đề (`blueprintFrozen`): số câu, ba tỷ lệ, chủ đề, điểm mỗi câu, thời gian làm bài và tuỳ chọn trộn bị tắt trên form, chỉ tên, mô tả và tuỳ chọn hiện kết quả còn sửa được; lịch có luật khoá riêng theo giờ (`scheduleLocked`): đề đã giao mà còn dưới 2 giờ nữa là mở, hoặc đang mở, thì hai ô lịch bị tắt kèm một dòng giải thích, hết giờ đóng thì mở lại. Trang giao bài và trang chi tiết đề đọc cùng cờ ở từng khung giờ của lớp và từng em. Builder giải thích lý do và có nút "Nhân bản đề" để tạo một bản nháp cùng cấu hình rồi sửa trên bản sao. Nháp khôi phục từ sessionStorage, hay lần lưu bị từ chối (409) vì có em vừa bắt đầu giữa chừng hoặc vì lịch vừa bị khoá giờ, đều giữ phần còn sửa được và lấy lại các trường bị khoá từ server kèm một ghi chú. Bản sao chép nguyên lịch mở/đóng của đề gốc, nên builder cảnh báo khi giờ đóng đã qua.

### 5.5. Teacher Assigns Exam

```text
Exam Detail
→ Giao bài
→ Chọn lớp (chỉ lớp đã công bố và được phân công) và/hoặc từng Student
→ Chọn đề chung hay mỗi Student một đề riêng
→ (Tùy chọn) Đặt khung giờ riêng cho lượt giao này
→ Confirm Assign
→ Màn hình báo số Student được giao mới và số bị bỏ qua theo lý do
→ Student mới được giao nhận thông báo trong ứng dụng
```

Giao lại một lớp kèm khung giờ mới là cách dời giờ cho những Student của lớp đó chưa bắt đầu làm bài. Exam Detail hiện trạng thái và khung giờ thực tế của từng Student, và cho thu hồi bài của Student chưa bắt đầu làm.

### 5.6. Student Takes Exam

```text
Student Dashboard
→ Bài kiểm tra của tôi (Đang mở / Sắp tới / Đã xong / Hết hạn)
→ Màn giới thiệu bài (nút bắt đầu chỉ bật khi server trả canStart)
→ Làm bài: xem câu hỏi text/hình ảnh, chọn đáp án, đánh dấu câu cần xem lại
→ Nộp bài (hoặc tự nộp khi hết giờ)
→ Màn đã nộp: xem điểm nếu Teacher cho phép
```

Đồng hồ làm bài tính theo mốc hết giờ tuyệt đối dựng từ `expiresAt` và `serverNow` của server, nên máy đặt sai giờ vẫn đếm đúng. Đáp án được lưu nháp lên server sau 800ms kể từ lần chọn cuối. Tải lại trang thì server trả về đúng lượt đang làm; câu đang xem và các câu đã đánh dấu được giữ trong localStorage theo từng lượt.

### 5.7. Viewing Results

```text
Teacher: Kết quả → lọc theo bài kiểm tra / Student / lớp / trạng thái / từ khóa → Chi tiết bài làm
Student: Kết quả của tôi → Chi tiết bài làm
```

Bộ lọc trang kết quả của Teacher nằm trên query string nên chép link là mở lại đúng bộ lọc. Ở trang chi tiết, Student chỉ thấy đáp án đúng từng câu khi server đã gửi kèm (sau khi mọi lớp được giao bài đã qua giờ đóng); giao diện không tự suy.

---

## 6. Data Flow & Realtime

Luồng dữ liệu:

```text
Page
→ useAsync(loader, deps)        # loading / error / data, bỏ qua kết quả của request cũ
→ services/*Service.ts          # đường dẫn /api/... và mapper DTO → model giao diện
→ lib/apiClient.ts              # gắn token, ghép VITE_API_BASE_URL, dịch mã lỗi sang tiếng Việt
→ Backend REST API
```

- `apiClient` giữ lại lỗi theo từng trường (`errors`) để form hiện lỗi ngay dưới ô nhập.
- Khi request có token mà nhận 401 (tài khoản vừa bị khóa, mật khẩu vừa đổi…), `apiClient` gọi handler do `App` đăng ký: xóa phiên và đưa người dùng về trang đăng nhập. `apiClient` không phụ thuộc react-router.
- Frontend không cấu hình proxy; thiếu `VITE_API_BASE_URL` thì mọi lời gọi API đều hỏng.
- Ảnh do API phục vụ (`/uploads/...`) nằm ở origin của API, không phải origin của trang: thẻ `img` luôn nhận `resolveMediaUrl(url)`. Hàm này chỉ gọi lúc hiển thị, không gọi trong mapper, để form sửa câu hỏi không ghi địa chỉ tuyệt đối của máy đang chạy xuống database.

Realtime:

- Backend có SignalR hub (`/hubs/notifications`) đẩy sự kiện giao bài, nộp bài, tự nộp bài và số thông báo chưa đọc.
- Frontend **chưa** cài `@microsoft/signalr` và chưa kết nối hub. Số thông báo chưa đọc được tải lại qua `GET /api/notifications/unread-count` mỗi khi chuyển trang.
- Khi nối realtime, SignalR chỉ dùng để nhận event; mọi nghiệp vụ vẫn đi qua REST API.

```text
REST API xử lý nghiệp vụ chính
→ Backend lưu database
→ Backend gửi SignalR event
→ Frontend nhận event và cập nhật UI
```

---

## 7. State Management

Không có global store. Dữ liệu danh sách (Student, lớp, câu hỏi, bài kiểm tra, kết quả) luôn tải theo trang qua `useAsync`, không giữ trong bộ nhớ dùng chung.

| Dữ liệu | Nơi giữ |
|---|---|
| JWT | localStorage `anthill.token` |
| Bản sao hồ sơ người dùng (để `RequireRole` quyết định ngay khi render) | localStorage `anthill.session` |
| Câu đang xem và câu đã đánh dấu khi làm bài | localStorage, theo từng lượt làm bài |
| Form soạn đề đang dở | sessionStorage |
| Bộ lọc và số trang của danh sách | Query string trên URL |
| Toast, hộp xác nhận | React Context (`ToastProvider`, `ConfirmProvider`) |

Bản sao hồ sơ trong localStorage chỉ dùng để điều hướng; sửa nó chỉ đổi được menu, còn mọi lời gọi sai role vẫn bị server từ chối.

---

## 8. UI Notes

- UI dùng tiếng Việt.
- Admin và Teacher dùng sidebar dọc (thu gọn được, từ 1024px trên thiết bị có chuột thì rê chuột để nở ra đè lên nội dung); Student dùng navbar ngang.
- Dashboard Admin có thống kê nhanh: tổng Student, đang hoạt động, đã khóa, số lớp, và cảnh báo tài khoản chờ xóa.
- Dashboard Teacher có thống kê nhanh: Student trong lớp mình, câu hỏi, bài kiểm tra, bài đã giao, bài đang mở, bài nộp trong tuần.
- Question Bank cần filter rõ theo difficulty, topic và trạng thái.
- Exam Builder cần có phần cấu hình tỷ lệ câu hỏi thật dễ hiểu.
- Take Exam Page cần có timer rõ ràng.
- Câu hỏi có hình ảnh cần hiển thị responsive, không làm vỡ layout.
- Trạng thái bài làm, trạng thái tài khoản và trạng thái lớp hiển thị bằng badge.
- Thao tác có hệ quả dùng hộp xác nhận chung: nói rõ hệ quả cụ thể, chạy thao tác ngay trong hộp, lỗi server hiện tại chỗ; biến thể có ô nhập dùng cho lý do xóa bắt buộc.
