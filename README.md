# Anthill — Frontend

Anthill là hệ thống kiểm tra trắc nghiệm trực tuyến dành cho **trường học và trung tâm dạy thêm**: toàn
bộ việc kiểm tra của một đơn vị diễn ra trên cùng một hệ thống. Quản trị viên là hiệu trưởng hoặc giám
đốc trung tâm: lập lớp, cấp tài khoản học sinh, phân công giáo viên vào lớp. Giáo viên chỉ làm việc với
những lớp được phân công: soạn ngân hàng câu hỏi, ra đề, giao bài, xem kết quả. Học sinh làm những bài
được giao. Tài khoản, lớp và quyền hạn thuộc về nhà trường hay trung tâm chứ không thuộc về từng người
dùng — đó là chỗ Anthill khác một ứng dụng trắc nghiệm cho người tự ôn luyện.

Repo này là giao diện web. **Backend: [Anthill_BE](https://github.com/HuynhHoaa/Anthill_BE)** (.NET 10,
PostgreSQL). Mọi dữ liệu đi qua API thật bằng [src/lib/apiClient.ts](src/lib/apiClient.ts); frontend
không có dữ liệu giả lập nên phải chạy cùng backend.

---

## Chạy thử

Cần Node `^20.19.0` hoặc `>=22.12.0` (yêu cầu của Vite 8) và backend Anthill_BE đang chạy ở môi trường
Development — xem README của repo đó. Backend mặc định nghe ở `http://localhost:5002` và khi chạy ở
Development sẽ tự tạo dữ liệu demo bên dưới.

```bash
npm install
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
npm run dev              # http://localhost:5173
```

| Biến | Giá trị trong `.env.example` | Ghi chú |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5002` | Gốc của API, không kèm `/api` — các service đã tự ghi đường dẫn `/api/...` |

Thiếu `.env` thì mọi lời gọi API đều hỏng, vì `vite.config.ts` không cấu hình proxy. Frontend và API
phải cùng giao thức; mặc định cả hai chạy http. Repo chưa cấu hình https cho Vite: muốn dùng thì thêm
`@vitejs/plugin-basic-ssl` hoặc `server.https` vào `vite.config.ts`, rồi đổi biến sang
`https://localhost:7153` (profile `https` của backend). CORS ở Development của backend đã cho phép cổng
5173 (`npm run dev`) và 4173 (`npm run preview`), cả http lẫn https.

Trên Windows PowerShell, nếu `npm` bị execution policy chặn thì dùng `npm.cmd`.

### Build và lint

```bash
npm run build        # tsc -b && vite build
npm run lint         # oxlint
```

Frontend chưa có test tự động. Quy tắc nghiệp vụ (chấm điểm, phân quyền, hạn nộp) được kiểm ở backend:
unit test trong `tests/Anthill.Tests` và các bộ kiểm HTTP trong `tests/api-checks` của Anthill_BE.

### Tài khoản demo

Mật khẩu chung: `anthill123`. Trên trang đăng nhập phải chọn đúng tab vai trò — server đối chiếu với
vai trò lưu trong database và từ chối nếu không khớp. Nút "Điền sẵn" trên trang đăng nhập điền hộ cả
tài khoản lẫn tab.

| Vai trò | Đăng nhập bằng | Dữ liệu mẫu |
|---|---|---|
| Quản trị viên | `huy.pq@anthill.edu.vn` | Phạm Quốc Huy |
| Giáo viên | `an.nv@anthill.edu.vn` | Nguyễn Văn An, môn Khoa học tự nhiên, được phân công Lớp 8A |
| Học sinh | `lan.tt` (hoặc mã `HS1001`) | Trần Thị Lan, thuộc Lớp 8A |

Dữ liệu mẫu chỉ có một môn, ba tài khoản và một lớp đã công bố; ngân hàng câu hỏi và đề kiểm tra để
trống. Muốn thử luồng làm bài:

1. Đăng nhập giáo viên → Ngân hàng câu hỏi → thêm vài câu cho mỗi mức Dễ / Trung bình / Khó.
2. Bài kiểm tra → Tạo bài kiểm tra → chỉnh ma trận cho khớp ngân hàng (khối xem trước báo mỗi mức còn
   thiếu bao nhiêu câu) → Lưu và giao bài cho Lớp 8A.
3. Đăng xuất, đăng nhập học sinh để làm bài.

---

## Ba vai trò, ba giao diện

| Vai trò | Bố cục | Khu vực |
|---|---|---|
| **Quản trị viên** — hiệu trưởng / giám đốc trung tâm | Sidebar dọc, `/quan-tri` | Tổng quan · Nhóm lớp · Học sinh |
| **Giáo viên** | Sidebar dọc, `/giao-vien` | Tổng quan · Nhóm lớp (chỉ đọc) · Bài kiểm tra · Ngân hàng câu hỏi · Kết quả |
| **Học sinh** | Navbar ngang, `/hoc-sinh` | Tổng quan · Bài kiểm tra của tôi · Kết quả của tôi |

Cả ba vai trò đều có trang Thông báo và Hồ sơ cá nhân. Danh sách lớp của giáo viên do server lọc: chỉ
những lớp đã công bố **và** có phân công giáo viên đó.

**Kiểm tra vai trò ở tầng route.** Mỗi nhóm route được bọc trong `RequireRole`
([src/app/RequireRole.tsx](src/app/RequireRole.tsx), khai báo route ở [App.tsx](src/app/App.tsx)). Chưa
đăng nhập thì về `/dang-nhap` kèm địa chỉ đang định vào, để đăng nhập xong quay lại đúng trang đó (giữ
cả query string); sai vai trò thì về trang tổng quan của vai trò mình. `RequireRole` đọc bản sao hồ sơ
trong localStorage để quyết định ngay khi render, nên nó chỉ là lớp điều hướng: sửa bản sao đó thì đổi
được menu, còn quyền theo vai trò do server quyết dựa trên database và mọi lời gọi sai vai trò nhận 403.

Token còn hạn vẫn có thể mất hiệu lực giữa phiên (tài khoản bị khoá, mật khẩu vừa đổi). `apiClient`
phát hiện 401 trên request có mang token và gọi handler do `App` đăng ký; handler xoá phiên rồi đưa
người dùng về trang đăng nhập kèm lời giải thích, thay vì để mọi thao tác tiếp theo lần lượt báo lỗi.
`apiClient` cố ý không phụ thuộc react-router.

---

## Vài chỗ đáng xem

**Đồng hồ làm bài tính theo mốc hết giờ tuyệt đối** ([TakeExamPage.tsx](src/features/exam-taking/pages/TakeExamPage.tsx),
[attemptService.ts](src/services/attemptService.ts)). Mốc hết giờ dựng từ `expiresAt` và `serverNow` do
server trả về, tức đã trừ chênh lệch giữa đồng hồ máy và đồng hồ server; mỗi giây lấy mốc đó trừ
`Date.now()` chứ không trừ dần. Tab chạy nền bị trình duyệt giảm nhịp timer cũng không làm đồng hồ trôi,
máy đặt sai giờ vẫn đếm đúng.
- Tải lại trang thì server trả về đúng lượt đang làm cùng đáp án đã lưu; câu đang xem và các câu đánh
  dấu được giữ trong localStorage theo từng lượt.
- Lưu nháp sau 800ms kể từ lần chọn cuối, kèm số thứ tự tăng dần để server bỏ qua bản lưu đến muộn.
- Nộp bài gửi kèm toàn bộ đáp án đang chọn. Hết giờ thì tự nộp và đóng hộp xác nhận đang mở; tự nộp hỏng
  thì thử lại mỗi 5 giây và giữ một thông báo không tự tắt. Có cờ chặn nộp hai lần khi đồng hồ về 0 đúng
  lúc học sinh bấm nộp.

**Hộp xác nhận dùng chung** ([ConfirmProvider.tsx](src/components/common/ConfirmProvider.tsx),
[ConfirmDialog.tsx](src/components/common/ConfirmDialog.tsx)). Gọi bằng `await confirm({ ..., onConfirm })`.
- Nói hệ quả cụ thể thay vì "Bạn có chắc không?". Khoá một học sinh: học sinh đó bị đăng xuất ngay kể
  cả khi đang làm dở, bài giao trong thời gian bị khoá sẽ bỏ qua học sinh đó. Xoá một đề: bao nhiêu lượt
  giao bị gỡ, học sinh đang làm dở bị dừng. Công bố một lớp chưa có giáo viên: hộp nói rõ lớp sẽ chưa
  hiện với giáo viên nào.
- Thao tác chạy bên trong hộp: nút xác nhận hiện vòng xoay đang xử lý, Huỷ và bấm lần hai bị khoá cho
  tới khi server trả lời, nên không gửi hai lần.
- Server báo lỗi thì lỗi hiện ngay trong hộp, hộp không đóng, người dùng thử lại tại chỗ.
- Mỗi lúc chỉ một hộp; đổi trang thì hộp tự đóng; Enter không bị tính là xác nhận khi bộ gõ tiếng Việt
  đang ghép chữ. Biến thể `confirm.withInput` dùng cho ô lý do bắt buộc.

**Ra đề theo ma trận độ khó, kiểm tra ngân hàng câu hỏi trước khi lưu** ([ExamBuilderPage.tsx](src/features/exams/pages/ExamBuilderPage.tsx),
[blueprintRatio.ts](src/features/exams/utils/blueprintRatio.ts)). Ra đề theo tỷ lệ dễ / trung bình /
khó, có ba preset và nút "Cân bằng về 100%" — giữ nguyên mức vừa chỉnh, chia phần còn lại cho hai mức
kia theo tỷ lệ đang có. Sau 400ms kể từ lần chỉnh cuối, trang gọi `POST /api/exams/blueprint-preview`
để đối chiếu với ngân hàng câu hỏi: mỗi mức cần bao nhiêu câu, ngân hàng có bao nhiêu, thiếu bao nhiêu.
Tổng khác 100% hoặc ngân hàng không đủ câu thì nút "Lưu bài kiểm tra" ("Lưu thay đổi" khi sửa) và "Lưu
và giao bài" bị khoá; đề mới hoặc đề nháp vẫn còn "Lưu nháp", còn đề đã xuất bản thì phải sửa ma trận
cho hợp lệ mới lưu được. Form chia hai tab; lưu mà lỗi nằm ở tab kia thì trang tự chuyển sang tab đó.

**Bộ lọc trang Kết quả nằm trên URL** ([TeacherResultsPage.tsx](src/features/results/pages/TeacherResultsPage.tsx)).
Bài kiểm tra, học sinh, nhóm lớp, trạng thái và số trang đọc thẳng từ query string (`bai-kiem-tra`,
`hoc-sinh`, `nhom`, `trang-thai`, `trang`), không có state song song. Riêng ô từ khoá giữ bản đang gõ
trong state và đẩy lên `q` sau 300ms. Chép link gửi cho đồng nghiệp là mở ra đúng bộ lọc; người nhận
chưa đăng nhập thì đăng nhập xong vẫn về đúng link đó.

**Xoá mềm tài khoản học sinh** ([useStudentAccountActions.tsx](src/features/students/hooks/useStudentAccountActions.tsx),
[studentService.ts](src/services/studentService.ts)). Không có lệnh xoá hẳn. Xoá là đưa vào danh sách chờ
kèm lý do bắt buộc (10–512 ký tự), chặn đăng nhập ngay lập tức. Trong 60 ngày quản trị viên khôi phục
được, và danh sách hiện rõ "Khôi phục được tới <ngày>" do server tính. Hết hạn thì backend xoá dữ liệu
cá nhân (họ tên thành "Học sinh đã xoá") nhưng giữ kết quả bài làm, để bảng điểm của lớp không thiếu
dòng. Cấp lại mật khẩu: server trả mật khẩu mới đúng một lần; nếu người dùng rời trang trước khi nó hiện
ra, giao diện báo rõ thay vì im lặng.

**Phía học sinh: lịch mở và hạn nộp** ([StudentExamListPage.tsx](src/features/exam-taking/pages/StudentExamListPage.tsx),
[StudentDashboardPage.tsx](src/features/dashboard/pages/StudentDashboardPage.tsx)). Bài được chia thành
Đang mở / Sắp tới / Đã xong / Hết hạn; bài sắp tới hiện giờ mở, bài sắp hết hạn có cảnh báo tự cập nhật
khi trang để mở lâu. Có vào làm được hay không do server chốt qua trường `canStart`, giao diện không tự
suy.

**Sidebar thu gọn** ([DashboardLayout.tsx](src/components/layout/DashboardLayout.tsx)): từ 1024px trên
thiết bị có chuột, rê chuột hoặc Tab vào thì nở ra đè lên nội dung chứ không đẩy, nên bảng không nhảy cột.

---

## Công nghệ

React 19 · TypeScript 6 · Vite 8 · Tailwind CSS v4 · react-router-dom 7 · lucide-react · oxlint.
Không dùng thư viện quản lý state hay thư viện gọi dữ liệu: dữ liệu tải qua hook `useAsync` tự viết,
trên nền `fetch`.

```
src/
├── app/             App (khai báo route, bắt 401 giữa phiên), RequireRole
├── components/
│   ├── common/      ConfirmProvider, ConfirmDialog, ConsequenceList, Modal, Toast, Skeleton, Pagination…
│   └── layout/      AdminLayout, TeacherLayout, StudentLayout, DashboardLayout, Sidebar, Header
├── features/        mỗi nghiệp vụ một thư mục: pages, và khi cần thì components / hooks / utils riêng:
│                    admin, auth, dashboard, exam-taking, exams, misc, notifications,
│                    question-bank, results, student-groups, students
├── services/        9 service theo nghiệp vụ + mappers — trang không gọi API trực tiếp
├── hooks/           useAsync, useDebouncedValue, useMediaQuery
├── lib/             apiClient, delay, format, topicTheme
├── styles/          index.css
├── types/           model dùng chung toàn app
└── main.tsx         BrowserRouter → ToastProvider → ConfirmProvider → App
```

---

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/Anthill_Requirement.md](docs/Anthill_Requirement.md) | Đặc tả nghiệp vụ |
| [docs/Anthill_API_Contract.md](docs/Anthill_API_Contract.md) | Hợp đồng API, lập trước khi viết backend bằng cách rút từ tầng service |
| [docs/Anthill_FE_Tech_Structure.md](docs/Anthill_FE_Tech_Structure.md) | Định hướng kiến trúc frontend |
| [docs/Anthill_Workflow_Deploy.md](docs/Anthill_Workflow_Deploy.md) | Quy trình làm việc và phương án deploy |

Tài liệu thiết kế viết trước khi nối API và trước khi có vai trò quản trị viên; chỗ nào khác code thì
lấy code làm chuẩn.
