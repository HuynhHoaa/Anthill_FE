# EduQuiz Frontend Technology & Structure

## 1. Frontend Context

Frontend của EduQuiz là web application phục vụ 2 role chính: **Teacher** và **Student**.

Teacher sử dụng hệ thống để quản lý Student, tạo ngân hàng câu hỏi, tạo bài kiểm tra theo tỷ lệ câu dễ / trung bình / khó, giao bài kiểm tra và xem kết quả. Student sử dụng hệ thống để xem bài kiểm tra được giao, làm bài và xem kết quả.

Frontend không tập trung vào quản lý khóa học. Trọng tâm chính là trải nghiệm tạo bài kiểm tra và làm bài kiểm tra.

---

## 2. Proposed Frontend Stack

Đề xuất sử dụng:

- ReactJS + TypeScript.
- Vite.
- React Router.
- Tailwind CSS.
- Axios.
- React Hook Form.
- Zod hoặc Yup.
- @microsoft/signalr.
- Zustand hoặc Context API cho state đơn giản.

Gợi ý ưu tiên:

| Nhu cầu | Công nghệ |
|---|---|
| Build frontend | Vite + ReactJS |
| Routing | React Router |
| UI Styling | Tailwind CSS |
| Form | React Hook Form |
| Validation | Zod |
| API Call | Axios |
| Realtime | @microsoft/signalr |
| State Management | Zustand |

---

## 3. Frontend Folder Structure

```text
EduQuiz.Frontend/
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── Loading.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── AuthLayout.tsx
│   │   │   ├── TeacherLayout.tsx
│   │   │   ├── StudentLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── NotificationBell.tsx
│   │   │
│   │   └── exam/
│   │       ├── QuestionCard.tsx
│   │       ├── QuestionImage.tsx
│   │       ├── AnswerOption.tsx
│   │       ├── ExamTimer.tsx
│   │       └── QuestionNavigator.tsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── ProfilePage.tsx
│   │   │   ├── services/authApi.ts
│   │   │   ├── store/authStore.ts
│   │   │   └── types/auth.types.ts
│   │   │
│   │   ├── students/
│   │   │   ├── pages/
│   │   │   │   ├── StudentListPage.tsx
│   │   │   │   ├── StudentCreatePage.tsx
│   │   │   │   └── StudentDetailPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── StudentForm.tsx
│   │   │   │   └── StudentTable.tsx
│   │   │   ├── services/studentApi.ts
│   │   │   └── types/student.types.ts
│   │   │
│   │   ├── student-groups/
│   │   │   ├── pages/
│   │   │   │   └── StudentGroupPage.tsx
│   │   │   ├── services/studentGroupApi.ts
│   │   │   └── types/studentGroup.types.ts
│   │   │
│   │   ├── question-bank/
│   │   │   ├── pages/
│   │   │   │   ├── QuestionBankPage.tsx
│   │   │   │   ├── QuestionCreatePage.tsx
│   │   │   │   └── QuestionEditPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── QuestionForm.tsx
│   │   │   │   ├── AnswerOptionEditor.tsx
│   │   │   │   ├── DifficultyBadge.tsx
│   │   │   │   └── QuestionFilter.tsx
│   │   │   ├── services/questionApi.ts
│   │   │   └── types/question.types.ts
│   │   │
│   │   ├── exams/
│   │   │   ├── pages/
│   │   │   │   ├── ExamListPage.tsx
│   │   │   │   ├── ExamBuilderPage.tsx
│   │   │   │   ├── ExamDetailPage.tsx
│   │   │   │   └── ExamAssignPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── ExamBlueprintForm.tsx
│   │   │   │   ├── DifficultyRatioInput.tsx
│   │   │   │   ├── QuestionAvailabilityPreview.tsx
│   │   │   │   └── AssignStudentSelector.tsx
│   │   │   ├── services/examApi.ts
│   │   │   └── types/exam.types.ts
│   │   │
│   │   ├── exam-taking/
│   │   │   ├── pages/
│   │   │   │   ├── MyAssignedExamsPage.tsx
│   │   │   │   ├── TakeExamPage.tsx
│   │   │   │   └── ExamSubmittedPage.tsx
│   │   │   ├── services/examTakingApi.ts
│   │   │   └── types/examTaking.types.ts
│   │   │
│   │   ├── results/
│   │   │   ├── pages/
│   │   │   │   ├── TeacherResultPage.tsx
│   │   │   │   ├── StudentResultPage.tsx
│   │   │   │   └── ResultDetailPage.tsx
│   │   │   ├── services/resultApi.ts
│   │   │   └── types/result.types.ts
│   │   │
│   │   ├── dashboard/
│   │   │   ├── pages/
│   │   │   │   ├── TeacherDashboardPage.tsx
│   │   │   │   └── StudentDashboardPage.tsx
│   │   │   └── services/dashboardApi.ts
│   │   │
│   │   └── notifications/
│   │       ├── services/notificationApi.ts
│   │       ├── services/signalRService.ts
│   │       └── types/notification.types.ts
│   │
│   ├── lib/
│   │   ├── axiosClient.ts
│   │   ├── signalRClient.ts
│   │   └── constants.ts
│   │
│   ├── routes/
│   │   ├── ProtectedRoute.tsx
│   │   └── RoleRoute.tsx
│   │
│   ├── styles/
│   │   └── index.css
│   │
│   └── main.tsx
│
├── .env
├── package.json
└── README.md
```

---

## 4. Main Pages

### Auth Pages

- Login Page.
- Profile Page.

### Teacher Pages

- Teacher Dashboard.
- Student Management.
- Student Group Management.
- Question Bank.
- Create Question.
- Edit Question.
- Exam List.
- Exam Builder.
- Exam Detail.
- Assign Exam.
- Exam Results.
- Result Detail.

### Student Pages

- Student Dashboard.
- My Assigned Exams.
- Take Exam.
- Exam Submitted.
- My Results.
- Result Detail.

---

## 5. Important UI Flows

### 5.1. Teacher Creates Question Bank

```text
Teacher Dashboard
→ Question Bank
→ Create Question
→ Nhập nội dung câu hỏi
→ Upload hình ảnh nếu có
→ Chọn difficulty: Easy / Medium / Hard
→ Thêm đáp án
→ Chọn đáp án đúng
→ Save
```

### 5.2. Teacher Creates Exam Blueprint

```text
Teacher Dashboard
→ Exam Builder
→ Nhập tên bài kiểm tra
→ Chọn tổng số câu
→ Nhập tỷ lệ Easy / Medium / Hard
→ Chọn chủ đề câu hỏi
→ Cấu hình thời gian làm bài
→ Preview số câu khả dụng
→ Save Exam
```

UI cần validate:

- Easy + Medium + Hard = 100%.
- Tổng số câu phải lớn hơn 0.
- Ngân hàng câu hỏi phải đủ số câu theo từng difficulty.
- Thời gian làm bài phải hợp lệ.

### 5.3. Teacher Assigns Exam

```text
Exam Detail
→ Assign Exam
→ Chọn Student hoặc nhóm Student
→ Chọn random same/different questions
→ Confirm Assign
→ Student nhận thông báo realtime
```

### 5.4. Student Takes Exam

```text
Student Dashboard
→ My Assigned Exams
→ Start Exam
→ Xem câu hỏi text/hình ảnh
→ Chọn đáp án
→ Nộp bài
→ Xem kết quả nếu được phép
```

---

## 6. Frontend Realtime with SignalR

Frontend sử dụng package:

```text
@microsoft/signalr
```

Realtime dùng cho:

- Nhận thông báo bài kiểm tra mới.
- Nhận thông báo bài kiểm tra gần hết hạn.
- Teacher nhận thông báo khi Student nộp bài.
- Cập nhật trạng thái bài làm trong dashboard.

Không dùng SignalR để thay thế REST API. SignalR chỉ dùng để nhận event realtime.

Luồng xử lý:

```text
REST API xử lý nghiệp vụ chính
→ Backend lưu database
→ Backend gửi SignalR event
→ Frontend nhận event và cập nhật UI
```

---

## 7. Suggested State Management

Có thể dùng Zustand với các store chính:

```text
authStore
notificationStore
examTakingStore
```

Không nên đưa toàn bộ dữ liệu vào global store. Các dữ liệu như danh sách Student, Question, Exam nên fetch theo page để tránh rối.

---

## 8. UI Notes

- UI dùng tiếng Việt.
- Dashboard Teacher nên có thống kê nhanh: tổng Student, tổng câu hỏi, tổng bài kiểm tra, bài đã giao.
- Question Bank cần filter rõ theo difficulty và topic.
- Exam Builder cần có phần cấu hình tỷ lệ câu hỏi thật dễ hiểu.
- Take Exam Page cần có timer rõ ràng.
- Câu hỏi có hình ảnh cần hiển thị responsive, không làm vỡ layout.
- Trạng thái bài làm nên hiển thị bằng badge.
