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
| State dùng chung | React Context (Toast, Confirm, Realtime) + localStorage / sessionStorage |
| Realtime | SignalR (`@microsoft/signalr`), xem mục 6 |
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
│   │   ├── RequireRole.tsx          # chặn route theo role
│   │   └── RealtimeProvider.tsx     # giữ một kết nối SignalR cho cả phiên, đẩy toast theo sự kiện
│   │
│   ├── assets/
│   │
│   ├── components/
│   │   ├── brand/
│   │   │   └── AnthillMark.tsx        # dấu hiệu Anthill: chữ A dựng như ngọn đồi, thanh ngang là ba chú kiến; cùng hình với public/favicon.svg
│   │   ├── common/
│   │   │   ├── Badge.tsx
│   │   │   ├── CountUp.tsx            # con số chạy từ 0 / giá trị cũ tới giá trị mới (tổng quan); giảm chuyển động thì hiện thẳng
│   │   │   ├── ComboboxInput.tsx      # ô nhập có danh sách gợi ý riêng (thay <datalist>); ô Chủ đề của câu hỏi
│   │   │   ├── DateTimeInput.tsx      # ô ngày giờ dd/mm/yyyy + chọn giờ 00–23, phút 00–59 (thay <input type="datetime-local">, không phụ thuộc ngôn ngữ trình duyệt)
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── ConfirmProvider.tsx
│   │   │   ├── ConnectionBanner.tsx   # dải "Đang kết nối lại..." khi mất realtime quá 4 giây
│   │   │   ├── ConsequenceList.tsx
│   │   │   ├── HistoryTimeline.tsx    # dòng thời gian lịch sử (học sinh, giáo viên, lớp): ai làm gì, lúc nào, lý do
│   │   │   ├── IssuedPasswordModal.tsx # mật khẩu vừa cấp, hiện đúng một lần; chỉ nút "Tôi đã chép lại" mới đóng được
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── ExportExcelButton.tsx  # nút xuất file Excel: gọi server, lưu file xuống máy, báo bằng thông báo nổi; khoá nút khi đang chờ
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── InfoTip.tsx            # dấu chấm than đặt cuối tiêu đề, bấm mở khung giải thích (portal; Esc chỉ đóng khung, không đóng hộp thoại chứa nó)
│   │   │   ├── Modal.tsx              # vẽ qua portal vào <body>: `fixed` + `z-50` không bị tổ tiên có transform / hoạt ảnh nhốt lại hay thẻ phía sau đè lên
│   │   │   ├── Pagination.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── SlidingSegments.tsx    # thanh tab / nút chọn có vạch nền trượt sang mục mới (đo offsetLeft/offsetWidth của nút `data-tab-active`)
│   │   │   ├── SlideSwap.tsx          # nội dung trượt qua lại khi đổi khoá (khung xem câu hỏi)
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
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── ProfilePage.tsx
│   │   │   ├── components/
│   │   │   │   ├── ChangePasswordForm.tsx
│   │   │   │   ├── LoginStage.tsx             # tấm "tổ kiến" bên trái trang đăng nhập: ba tầng đồi = ba vai trò, đàn kiến bò bằng SVG animateMotion (đứng yên khi chọn giảm chuyển động)
│   │   │   │   ├── ProfileInfoForm.tsx
│   │   │   │   └── StudentScoreSummary.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useApiStatus.ts            # hỏi /health/live một lần để báo "máy chủ đang thức dậy" (máy chủ miễn phí ngủ sau 15 phút)
│   │   │   └── login.css                      # kiểu và hoạt ảnh riêng của trang đăng nhập (chữ hiệu Bricolage Grotesque, vòng ping, ba chấm kiến chạy)
│   │   │
│   │   ├── dashboard/
│   │   │   └── pages/
│   │   │       ├── TeacherDashboardPage.tsx
│   │   │       └── StudentDashboardPage.tsx
│   │   │
│   │   ├── students/
│   │   │   ├── pages/
│   │   │   │   ├── StudentListPage.tsx
│   │   │   │   ├── StudentEditorPage.tsx     # tạo và sửa hồ sơ (đổi lớp, khoá làm ở hồ sơ, không nằm trong form)
│   │   │   │   ├── AdminStudentDetailPage.tsx # Admin: bài được giao (kể cả chưa làm) và lịch sử thay đổi
│   │   │   │   └── StudentDetailPage.tsx     # Teacher xem chỉ đọc: thẻ hồ sơ (điểm trung bình nằm bên phải) và lịch sử làm bài
│   │   │   ├── components/
│   │   │   │   ├── StudentAdminActions.tsx   # sửa, khoá, xoá tài khoản (mỗi việc đều hỏi lý do) và danh sách lớp của em
│   │   │   │   ├── StudentClassManager.tsx   # các lớp em đang học: xếp thêm, chuyển, gỡ từng lớp (lớp khoá thì mờ)
│   │   │   │   ├── StudentStatusPill.tsx
│   │   │   │   └── StudentTextField.tsx
│   │   │   └── hooks/useStudentAccountActions.tsx
│   │   │
│   │   ├── teachers/                         # chỉ Admin: nhà trường cấp tài khoản, gán môn, khoá khi giáo viên nghỉ
│   │   │   ├── pages/
│   │   │   │   ├── AdminTeacherListPage.tsx  # danh sách + tìm, lọc môn và trạng thái; bấm cả dòng để mở hồ sơ
│   │   │   │   └── AdminTeacherDetailPage.tsx # lớp đang phụ trách và lịch sử khoá
│   │   │   ├── components/TeacherFormModal.tsx
│   │   │   └── hooks/useTeacherAccountActions.tsx # khoá (hỏi lý do), mở khoá, cấp lại mật khẩu
│   │   │
│   │   ├── imports/                          # nhập từ Excel: cả trường (một file), hoặc riêng học sinh, giáo viên, lớp
│   │   │   ├── importCopy.ts                 # câu chữ theo từng loại (school, students, teachers, groups)
│   │   │   └── components/
│   │   │       ├── ImportExcelButton.tsx     # nút "Nhập Excel" kèm hộp thoại, đặt vào thanh công cụ của trang
│   │   │       ├── SchoolPreviewList.tsx     # nhập cả trường: xem trước, mỗi lớp một tab (đầu tab ghi giáo viên, thân tab là bảng học sinh cuộn, vẽ từng lượt 200 em, ô tìm trong mọi lớp)
│   │   │       └── ImportExcelModal.tsx      # ba bước trong một hộp: chọn file → xem trước (dryRun) → nhập; mật khẩu chung của đợt. Loại "school" thêm ô môn chung, ô công bố lớp ngay và bảng đếm giáo viên / lớp / học sinh
│   │   │
│   │   ├── terms/                            # kỳ học (chỉ admin): danh sách, thêm / sửa / xoá; học sinh lọc lớp và bảng điểm theo kỳ
│   │   │   ├── pages/AdminTermListPage.tsx   # bấm cả dòng để sửa; kỳ còn lớp thì khoá nút xoá
│   │   │   └── components/TermFormModal.tsx  # ngày gõ dd/mm/yyyy (tự chèn dấu /), ô "Kỳ hiện tại"
│   │   │
│   │   ├── student-groups/
│   │   │   ├── pages/
│   │   │   │   ├── AdminGroupListPage.tsx
│   │   │   │   ├── AdminGroupDetailPage.tsx
│   │   │   │   ├── TeacherGroupListPage.tsx
│   │   │   │   └── TeacherGroupDetailPage.tsx # hai tab: Học sinh | Bài kiểm tra trong lớp (bấm một bài mở GroupExamResultsModal → bấm một em xem lại bài làm); nút Xuất bảng điểm
│   │   │   ├── hooks/useRemoveFromGroup.tsx  # hộp gỡ khỏi lớp kèm lý do, dùng chung hai trang
│   │   │   └── components/
│   │   │       ├── AddStudentsModal.tsx      # liệt kê em chưa học lớp này (kể cả em đang học lớp khác)
│   │   │       ├── AssignToGroupModal.tsx    # xếp thêm một em vào một lớp (không cần lý do)
│   │   │       ├── TransferStudentModal.tsx  # chuyển lớp: chọn lớp đích và nhập lý do
│   │   │       ├── GroupStudentsPanel.tsx    # ba tab của trang quản lý lớp: Học sinh, Bài kiểm tra, Thiết lập
│   │   │       ├── GroupExamsPanel.tsx       # các bài đã giao cho lớp, kể cả đề cũ
│   │   │       ├── GroupExamResultsModal.tsx # kết quả từng em của một đề trong lớp (điểm, thời gian làm, giờ nộp); bấm dòng mở bài làm; dùng chung cho admin và giáo viên qua `audience`
│   │   │       ├── GroupSettingsPanel.tsx    # giáo viên phụ trách, công bố, khoá và mở khoá, xoá lớp
│   │   │       ├── GroupHistoryPanel.tsx     # lịch sử lớp: lập lớp, đổi giáo viên, khoá và mở khoá kèm lý do
│   │   │       ├── ChangeTeacherModal.tsx    # đổi giáo viên phụ trách: lý do bắt buộc khi đang có người khác
│   │   │       ├── GroupFormModal.tsx
│   │   │       ├── GroupHealthIndicator.tsx
│   │   │       ├── TeacherAvatar.tsx
│   │   │       ├── groupHealth.ts
│   │   │       ├── groupTheme.ts
│   │   │       └── teacherOptions.ts         # nhãn giáo viên trong ô chọn (môn, trạng thái khoá)
│   │   │
│   │   ├── question-bank/
│   │   │   ├── pages/
│   │   │   │   ├── QuestionBankPage.tsx
│   │   │   │   └── QuestionEditorPage.tsx    # tạo và sửa; ba tab Nội dung câu hỏi / Đáp án / Xem trước, nút quay lại ở thanh tiêu đề
│   │   │   ├── components/
│   │   │   │   ├── AnswerEditorRow.tsx
│   │   │   │   └── QuestionPreview.tsx
│   │   │   └── utils/
│   │   │       ├── questionConfirmations.tsx
│   │   │       └── questionAudience.ts       # giáo viên hay quản trị viên: cùng cặp trang, khác khu vực và quyền
│   │   │
│   │   ├── exams/
│   │   │   ├── pages/
│   │   │   │   ├── ExamListPage.tsx
│   │   │   │   ├── ExamBuilderEntry.tsx      # cửa vào của /tao và /:id/sua: chọn trình soạn đúng kiểu đề
│   │   │   │   ├── ExamQuestionListBuilderPage.tsx  # soạn đề theo danh sách câu hỏi; ba tab Cấu hình / Nội dung / Giao bài (mỗi tab có icon)
│   │   │   │   ├── ExamBuilderPage.tsx       # soạn đề theo ma trận (đề cũ)
│   │   │   │   └── ExamDetailPage.tsx        # hai tab Theo dõi / Giao bài, nạp đề và lượt giao một lần
│   │   │   ├── components/
│   │   │   │   ├── AssignWindowFields.tsx    # cặp ô giờ mở – đóng dùng ở cả hai chỗ giao bài
│   │   │   │   ├── ComposeShortfallNotice.tsx # khung vàng nằm lại trên danh sách khi Soạn tự động rút không đủ số câu (toast mờ đi nên dễ bị bỏ sót); ở lại tới khi bấm "Đã hiểu"
│   │   │   │   ├── ComposeQuestionsDialog.tsx # "Soạn tự động": số câu từng mức → rút từ ngân hàng
│   │   │   │   ├── DifficultyRatioBar.tsx
│   │   │   │   ├── DifficultyRatioEditor.tsx
│   │   │   │   ├── ExamAssignPanel.tsx       # tab Giao bài của trang chi tiết
│   │   │   │   ├── ExamClassAssignment.tsx   # tab Giao bài của form tạo đề (chỉ giao theo lớp)
│   │   │   │   ├── ExamPaperSplitPanel.tsx   # mục "Chia đề cho mỗi lớp" ở tab Cấu hình của form soạn: số đề, số câu và tỷ lệ mỗi đề, điểm theo mức (tự tính, mọi đề nhỏ đúng 10 nhờ điểm cộng thêm 0.01 cho vài câu mức cao nhất), xem trước trùng/dư
│   │   │   │   ├── ExamPaperViewer.tsx       # tab Nội dung của đề chia nhiều đề: xem đề lớn hoặc các câu của từng đề nhỏ theo lớp và mã đề
│   │   │   │   ├── ExamPapersCard.tsx        # thẻ "Chia đề" của trang chi tiết: kế hoạch chia và số em mỗi đề của từng lớp (chỉ giáo viên)
│   │   │   │   ├── ExamQuestionCard.tsx      # một câu trong đề dạng thẻ: nội dung, đáp án, ô điểm
│   │   │   │   ├── ExamQuestionListSummary.tsx # khối "Câu hỏi của đề" ở trang chi tiết
│   │   │   │   ├── ExamTrackingPanel.tsx     # tab Theo dõi của trang chi tiết
│   │   │   │   ├── FieldError.tsx
│   │   │   │   ├── QuestionBody.tsx          # tên (nếu đã đặt) + nội dung + ảnh + đáp án của một câu, dùng chung thẻ và khung xem
│   │   │   │   └── QuestionPickerDialog.tsx  # chọn câu từ ngân hàng; bấm dòng để xem, bấm ô vuông để chọn; kéo để nạp thêm, không phân trang; lọc "Lớp đã nhận" (ẩn câu lớp đó đã nhận ở đề trước)
│   │   │   └── utils/
│   │   │       ├── blueprintRatio.ts
│   │   │       ├── classAssignment.ts
│   │   │       ├── examConfirmations.tsx     # câu chữ các hộp xác nhận: câu dẫn ngắn + khối nhãn — giá trị + gạch đầu dòng
│   │   │       ├── examDraftStorage.ts       # nháp form ma trận
│   │   │       ├── examListDraftStorage.ts   # nháp form theo danh sách (kèm câu đã chọn và lớp đã chọn)
│   │   │       ├── examScheduleFormat.ts
│   │   │       ├── examScoring.ts
│   │   │       ├── paperPlan.ts              # tính trước việc chia đề lớn thành N đề nhỏ (khớp PaperPlanner của server)
│   │   │       ├── paperSpec.ts              # cấu hình chia đề trong form: mặc định, gợi ý từ đề lớn, điểm theo mức và điểm cộng thêm (`bonusUnits`)
│   │   │       └── questionListScoring.ts    # tổng điểm, đếm theo mức, chia đều / chia theo mức độ
│   │   │
│   │   ├── exam-taking/
│   │   │   ├── pages/
│   │   │   │   ├── ExamIntroPage.tsx
│   │   │   │   ├── TakeExamPage.tsx
│   │   │   │   └── ExamSubmittedPage.tsx
│   │   │   ├── components/StudentExamBrowser.tsx  # các bài của MỘT lớp: lọc theo trạng thái, tìm, xem lại kết quả và đáp án
│   │   │   ├── hooks/useCountdown.ts
│   │   │   └── utils/examClock.ts, examProgressStorage.ts
│   │   │
│   │   ├── student-learning/
│   │   │   ├── hooks/useTermSelection.ts     # kỳ đang xem, giữ trong địa chỉ ?ky= (mặc định kỳ hiện tại; ẩn khi em chỉ có một mục)
│   │   │   ├── components/TermSelect.tsx     # ô chọn kỳ dùng chung cho Lớp học của tôi và Bảng điểm
│   │   │   └── pages/
│   │   │       ├── StudentGroupListPage.tsx  # "Lớp học của tôi": thẻ từng lớp kèm tiến độ, lọc theo kỳ (ở máy)
│   │   │       ├── StudentGroupPage.tsx      # một lớp: thông tin lớp + các bài của em ở lớp đó
│   │   │       └── StudentTranscriptPage.tsx # "Bảng điểm": môn học, điểm trung bình môn, bài làm nên điểm; lọc theo kỳ (máy chủ tính), nút xuất Excel theo kỳ đang chọn
│   │   │
│   │   ├── results/
│   │   │   ├── pages/
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
│   │   ├── termService.ts             # danh mục kỳ học (chỉ Admin)
│   │   ├── myLearningService.ts       # lớp học, kỳ học và bảng điểm của học sinh
│   │   ├── teacherService.ts          # tài khoản giáo viên (chỉ Admin)
│   │   ├── importService.ts           # nhập Excel: tải file mẫu, kiểm tra (dryRun), nhập thật (importSchool cho file tổng hợp, kèm số đếm theo từng loại bản ghi)
│   │   ├── questionService.ts
│   │   ├── examService.ts
│   │   ├── attemptService.ts
│   │   ├── resultService.ts
│   │   ├── dashboardService.ts
│   │   ├── notificationService.ts
│   │   ├── realtime.ts              # client SignalR, bus sự kiện, vòng nối lại
│   │   ├── uploadService.ts         # upload ảnh câu hỏi/đáp án, kiểm tra trước loại và dung lượng
│   │   └── mappers.ts               # đổi DTO của backend sang model của giao diện
│   │
│   ├── hooks/
│   │   ├── useAsync.ts              # có thêm refresh(): nạp ngầm khi sự kiện realtime báo dữ liệu đã đổi
│   │   ├── useRealtime.ts           # useUnreadCount, useRealtimeEvent, useRealtimeRefresh
│   │   ├── useDebouncedValue.ts
│   │   └── useMediaQuery.ts
│   │
│   ├── lib/
│   │   ├── apiClient.ts              # có thêm apiDownload: tải file nhị phân kèm token (file mẫu Excel)
│   │   ├── download.ts               # lưu blob xuống máy, dựng CSV mở được bằng Excel (BOM, sep=, chặn công thức)
│   │   ├── format.ts
│   │   ├── questionTitle.ts          # tên hiển thị của câu hỏi: tên đã đặt, hoặc phần đầu nội dung
│   │   └── topicTheme.ts
│   │
│   ├── styles/
│   │   └── index.css              # kèm các hiệu ứng dùng chung: rowIn (hàng bảng vào lần lượt), stagger-in, bar-grow, animate-tab-in, animate-flash, animate-pop, animate-sheen, animate-float, hover-lift, nút lún khi bấm; tất cả tắt khi chọn giảm chuyển động
│   │
│   ├── types/
│   │   └── index.ts                 # model dùng chung toàn app
│   │
│   └── main.tsx                     # BrowserRouter → ToastProvider → RealtimeProvider → ConfirmProvider → App
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

- `/quan-tri` chuyển thẳng tới danh sách lớp: Admin không có trang tổng quan riêng, con số cần theo dõi nằm ở phụ đề của từng danh sách.
- Class List — `/quan-tri/nhom-lop`: chỉ để xem và lập lớp mới (chọn luôn giáo viên phụ trách); bấm dòng hoặc nút Quản lý để vào lớp. Nút Nhập Excel để lập nhiều lớp một lúc.
- Class Detail — `/quan-tri/nhom-lop/:id`: ba tab Học sinh / Bài kiểm tra / Thiết lập (`?tab=bai-kiem-tra`, `?tab=thiet-lap`). Học sinh: xếp Student chưa có lớp, nhập cả danh sách bằng Excel (dòng để trống ô Lớp vào lớp này), chuyển lớp và gỡ khỏi lớp (đều kèm lý do). Bài kiểm tra: mọi đề đã giao cho lớp kể cả đề cũ, mở từng đề để xem kết quả từng em. Thiết lập: giáo viên phụ trách (đổi kèm lý do) và lịch sử lớp, công bố / bỏ công bố, sửa và xóa lớp.
- Teacher List — `/quan-tri/giao-vien`: tìm, lọc môn và trạng thái; thêm giáo viên, nhập Excel. Teacher Detail — `/quan-tri/giao-vien/:id`: lớp đang phụ trách, lịch sử khoá, sửa, khoá kèm lý do, cấp lại mật khẩu.
- Student List — `/quan-tri/hoc-sinh`: nút Nhập Excel để nhập cả đợt học sinh.
- Create Student — `/quan-tri/hoc-sinh/tao`.
- Student Detail — `/quan-tri/hoc-sinh/:id`: thông tin, điểm, mọi bài được giao (kể cả chưa làm / hết hạn) và tab Lịch sử thay đổi (`?tab=lich-su`); các thao tác chuyển lớp, gỡ lớp, khóa, xóa ở cột bên phải.
- Edit Student — `/quan-tri/hoc-sinh/:id/sua`: sửa hồ sơ, cấp lại mật khẩu, xóa mềm, khôi phục; đổi lớp và khóa là nút riêng có hộp lý do.
- Result Detail (chỉ đọc) — `/quan-tri/ket-qua/:attemptId`: mở từ hồ sơ học sinh.
- Question Bank — `/quan-tri/cau-hoi`, tạo `/quan-tri/cau-hoi/tao`, sửa `/quan-tri/cau-hoi/:id/sua`: ngân hàng của mọi môn (cột Soạn bởi, lọc theo môn khi có từ hai môn, nút xóa); dùng chung `QuestionBankPage` và `QuestionEditorPage` với giáo viên qua prop `audience`.

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
- Exam Detail — `/giao-vien/bai-kiem-tra/:id`, hai tab Theo dõi và Giao bài; `?tab=giao-bai` mở thẳng tab Giao bài.
  Địa chỉ cũ `/giao-vien/bai-kiem-tra/:id/giao-bai` chuyển hướng về đó.
- Result Detail — `/giao-vien/ket-qua/:attemptId`. Không còn bảng kết quả chung; địa chỉ `/giao-vien/ket-qua` chuyển về
  danh sách lớp. Vào bài làm từ hồ sơ học sinh (lớp → học sinh) hoặc từ tab Theo dõi của bài kiểm tra (đề → lớp → học sinh).

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
Nhóm lớp
→ Tạo lớp (chọn luôn Teacher phụ trách; lớp mới ở trạng thái nháp)
→ Thêm Student vào lớp (từng em, hoặc nhập danh sách từ Excel)
→ Công bố lớp (hộp xác nhận cảnh báo nếu lớp chưa có Student; lớp chưa có Teacher thì server từ chối)
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

Ảnh câu hỏi và ảnh đáp án đi qua `ImageUploader`: chọn hoặc kéo thả là upload ngay qua `POST /api/uploads/images` (kiểm tra trước đuôi file, loại ảnh và trần 4 MB giống server), hiện ảnh xem trước kèm trạng thái đang tải, cho huỷ, đổi hoặc xoá ảnh, và hiện nguyên thông điệp lỗi của server. Ảnh của đáp án dùng kiểu thu nhỏ (`compact`), ảnh của câu hỏi giữ khung kéo thả đầy đủ. Còn ô ảnh nào đang tải thì nút lưu câu hỏi bị khoá; ba tab của trình soạn luôn nằm trong DOM (chỉ ẩn) để đổi tab không huỷ lượt tải. Form chỉ giữ đường dẫn tương đối server trả về; mọi chỗ vẽ ảnh (ngân hàng câu hỏi, trình soạn, làm bài, xem lại kết quả) ghép đường dẫn với `VITE_API_BASE_URL` qua `resolveMediaUrl`. Ảnh đã tải lên mà không được lưu hoặc bị thay thì không bị xoá từ giao diện, vì bản đề đã sinh vẫn có thể trỏ tới ảnh cũ.

### 5.4. Teacher Creates Exam Blueprint

```text
Teacher Dashboard
→ Bài kiểm tra
→ Tạo bài kiểm tra
→ Nhập tên, mô tả, thời gian làm bài, lịch mở/đóng chung
→ Chọn tổng số câu, chủ đề
→ Nhập tỷ lệ Easy / Medium / Hard (có preset và nút cân bằng về 100%)
→ Nhập điểm một câu ở từng mức độ (hiện "n / 100", có nút "Gợi ý chia điểm")
→ Preview số câu khả dụng (gọi POST /api/exams/blueprint-preview sau 400ms kể từ lần chỉnh cuối)
→ Lưu nháp / Lưu bài kiểm tra / Lưu và giao bài
```

UI cần validate:

- Easy + Medium + Hard = 100% (trừ khi lưu nháp).
- Tổng số câu phải lớn hơn 0.
- Ngân hàng câu hỏi phải đủ số câu theo từng difficulty (trừ khi lưu nháp).
- Điểm từng mức độ: không âm, tối đa 2 chữ số thập phân, mức có câu thì lớn hơn 0. Tổng (số câu mỗi mức × điểm mức đó) khác 10 **không** chặn lưu: form hiện "n / 10" và nói thiếu hay thừa bao nhiêu; khi chốt (không phải nháp) mà chưa đủ thì hộp xác nhận hiện thêm đúng con số đó, chọn "Quay lại chỉnh" thì đưa về mục điểm. Không hỏi với bản nháp, và không hỏi với một đề đã xuất bản mà lần lưu không đổi bộ câu. Số câu mỗi mức tính cục bộ bằng cùng công thức với server (`features/exams/utils/examScoring.ts`); cách chia số câu không thể ra đúng 10 thì form điền cách chia sát 10 nhất và gợi ý số câu gần nhất chia được đúng (riêng đề chia nhiều đề luôn đúng 10 nhờ điểm cộng thêm, `paperSpec.ts`).
- Thời gian làm bài phải hợp lệ và không dài hơn khoảng mở bài.

Form soạn đề được giữ tạm trong sessionStorage khi Teacher rời trang đi bổ sung câu hỏi cho ngân hàng.

Khi đã có Student bắt đầu làm bài, server khoá cấu hình đề (`blueprintFrozen`): số câu, ba tỷ lệ, chủ đề, điểm từng mức độ, thời gian làm bài và tuỳ chọn trộn bị tắt trên form, chỉ tên, mô tả và tuỳ chọn hiện kết quả còn sửa được; lịch có luật khoá riêng theo giờ (`scheduleLocked`): đề đã giao mà còn dưới 2 giờ nữa là mở, hoặc đang mở, thì hai ô lịch bị tắt kèm một dòng giải thích, hết giờ đóng thì mở lại. Trang giao bài và trang chi tiết đề đọc cùng cờ ở từng khung giờ của lớp và từng em. Builder giải thích lý do và có nút "Nhân bản đề" để tạo một bản nháp cùng cấu hình rồi sửa trên bản sao. Nháp khôi phục từ sessionStorage, hay lần lưu bị từ chối (409) vì có em vừa bắt đầu giữa chừng hoặc vì lịch vừa bị khoá giờ, đều giữ phần còn sửa được và lấy lại các trường bị khoá từ server kèm một ghi chú. Bản sao chép nguyên lịch mở/đóng của đề gốc, nên builder cảnh báo khi giờ đóng đã qua.

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

Giao lại một lớp kèm khung giờ mới là cách dời giờ cho những Student của lớp đó chưa bắt đầu làm bài. Exam Detail hiện trạng thái và khung giờ thực tế của từng Student, và cho thu hồi bài **theo lớp**: nút "Thu hồi lớp" gỡ bài khỏi những Student của lớp chưa bắt đầu làm, em đã bắt đầu giữ nguyên bài.

### 5.6. Student Takes Exam

```text
Student Dashboard
→ Bài kiểm tra của tôi (Đang mở / Sắp tới / Đã xong / Hết hạn)
→ Màn giới thiệu bài (nút bắt đầu chỉ bật khi server trả canStart)
→ Làm bài: xem câu hỏi text/hình ảnh, chọn đáp án, đánh dấu câu cần xem lại
→ Nộp bài (hoặc tự nộp khi hết giờ)
→ Màn đã nộp: xem điểm nếu Teacher cho phép
```

Đồng hồ làm bài tính theo mốc hết giờ tuyệt đối dựng từ `expiresAt` và `serverNow` của server rồi đặt lên đồng hồ đơn điệu `performance.now()`, nên máy đặt sai giờ hay chỉnh giờ giữa buổi thi đều không làm nó nhảy. Vì đồng hồ đơn điệu có thể đứng khi máy ngủ, trang hỏi lại `GET /api/exam-attempts/{id}/time` khi tab hiện lại, có mạng lại, hoặc khi hai đồng hồ của máy lệch nhau, và chỉ nhận mốc sớm hơn mốc đang giữ. Đáp án được lưu nháp lên server sau 800ms kể từ lần chọn cuối. Tải lại trang thì server trả về đúng lượt đang làm; câu đang xem và các câu đã đánh dấu được giữ trong localStorage theo từng lượt.

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

- Backend có SignalR hub (`/hubs/notifications`) đẩy sự kiện giao bài, đổi giờ, nộp bài, tự nộp bài, sắp hết hạn và số thông báo chưa đọc.
- Frontend nối hub bằng `@microsoft/signalr` trong `src/services/realtime.ts`, và **chỉ** file đó biết tới thư viện. `RealtimeProvider` mở kết nối khi có token, đóng khi đăng xuất, bị thu hồi phiên hay đổi người đăng nhập.
- Kết nối tự viết vòng nối lại (0, 1, 2, 5, 10, 20, 30 giây, lệch ngẫu nhiên ±20%) thay cho `withAutomaticReconnect`: thư viện không thử lại khi lần mở **đầu tiên** hỏng và không cho chen bước kiểm phiên vào giữa các lần thử. Mỗi lần đứt, client hỏi lại một endpoint REST có token để 401 (phiên bị thu hồi) đi qua `apiClient` như mọi request.
- Client **không gọi phương thức hub nào**: mỗi kết nối đã tự vào group riêng của người dùng, vào thêm `JoinExamGroup` thì giáo viên nhận `ExamSubmitted` hai lần.
- Chuông thông báo đọc `useUnreadCount()` từ provider: một lần `GET /api/notifications/unread-count` khi mở phiên và sau mỗi lần nối lại, còn lại nhận `UnreadCountChanged`.
- Trang nào hiển thị dữ liệu mà một sự kiện làm cũ đi thì gắn `useRealtimeRefresh(sự kiện, refresh)` với `refresh` của `useAsync`: nạp lại ngầm, không bật khung xương, hỏng thì giữ nguyên dữ liệu đang hiện, các sự kiện đến liền nhau được gom 500 ms thành một lần nạp.
- Toast theo vai trò (học sinh: bài mới, đổi giờ, sắp đóng, bị tự nộp; giáo viên: học sinh nộp bài, gộp khi nhiều em nộp liền nhau) và không hiện ở trang làm bài. Dải mất kết nối chỉ hiện sau 4 giây.
- SignalR chỉ dùng để nhận event; mọi nghiệp vụ vẫn đi qua REST API.

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
