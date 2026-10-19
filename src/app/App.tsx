import { useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { setUnauthorizedHandler } from '../lib/apiClient'
import { logout } from '../services/authService'
import RequireRole from './RequireRole'
import RequireMustChangePassword from './RequireMustChangePassword'
import LoginPage from '../features/auth/pages/LoginPage'
import ForceChangePasswordPage from '../features/auth/pages/ForceChangePasswordPage'
import ProfilePage from '../features/auth/pages/ProfilePage'
import TeacherDashboardPage from '../features/dashboard/pages/TeacherDashboardPage'
import StudentDashboardPage from '../features/dashboard/pages/StudentDashboardPage'
import AdminStudentDetailPage from '../features/students/pages/AdminStudentDetailPage'
import StudentDetailPage from '../features/students/pages/StudentDetailPage'
import StudentListPage from '../features/students/pages/StudentListPage'
import StudentEditorPage from '../features/students/pages/StudentEditorPage'
import AdminGroupListPage from '../features/student-groups/pages/AdminGroupListPage'
import AdminTermListPage from '../features/terms/pages/AdminTermListPage'
import AdminTeacherDetailPage from '../features/teachers/pages/AdminTeacherDetailPage'
import AdminTeacherListPage from '../features/teachers/pages/AdminTeacherListPage'
import AdminGroupDetailPage from '../features/student-groups/pages/AdminGroupDetailPage'
import TeacherGroupListPage from '../features/student-groups/pages/TeacherGroupListPage'
import TeacherGroupDetailPage from '../features/student-groups/pages/TeacherGroupDetailPage'
import QuestionBankPage from '../features/question-bank/pages/QuestionBankPage'
import QuestionEditorPage from '../features/question-bank/pages/QuestionEditorPage'
import ExamListPage from '../features/exams/pages/ExamListPage'
import ExamBuilderEntry from '../features/exams/pages/ExamBuilderEntry'
import ExamDetailPage from '../features/exams/pages/ExamDetailPage'
import StudentGroupListPage from '../features/student-learning/pages/StudentGroupListPage'
import StudentGroupPage from '../features/student-learning/pages/StudentGroupPage'
import StudentTranscriptPage from '../features/student-learning/pages/StudentTranscriptPage'
import ExamIntroPage from '../features/exam-taking/pages/ExamIntroPage'
import TakeExamPage from '../features/exam-taking/pages/TakeExamPage'
import ExamSubmittedPage from '../features/exam-taking/pages/ExamSubmittedPage'
import ResultDetailPage from '../features/results/pages/ResultDetailPage'
import NotificationsPage from '../features/notifications/pages/NotificationsPage'
import NotFoundPage from '../features/misc/pages/NotFoundPage'

/**
 * Trang giao bài đã thành một tab của trang chi tiết đề. Địa chỉ cũ vẫn mở được (thông báo, lịch sử
 * trình duyệt, đường dẫn đã chép) và đưa thẳng tới tab đó.
 */
function ExamAssignRedirect() {
  const { id } = useParams()
  return <Navigate to={`/giao-vien/bai-kiem-tra/${id}?tab=giao-bai`} replace />
}

export default function App() {
  const navigate = useNavigate()

  // Token còn hạn vẫn có thể chết giữa phiên: backend xoay SecurityStamp khi tài khoản bị khoá
  // hoặc đổi mật khẩu, và mọi token phát trước đó mất hiệu lực ngay. Không bắt lại thì người dùng
  // ngồi trước một giao diện trông như đã đăng nhập mà thao tác nào cũng hỏng.
  //
  // Đăng ký ở đây vì đây là nơi đầu tiên có router; apiClient cố ý không biết gì về react-router.
  useEffect(() => {
    setUnauthorizedHandler(message => {
      logout()

      // Vài request đang bay cùng lúc có thể cùng nhận 401. Lần đầu đã đưa người dùng về trang đăng
      // nhập; điều hướng thêm lần nữa thì `from` bị ghi đè bằng chính /dang-nhap và mất đường quay lại.
      const { pathname, search } = window.location
      if (pathname === '/dang-nhap') return

      // Kèm địa chỉ đang đứng để đăng nhập lại xong về đúng chỗ đó: học sinh bị văng ra giữa giờ làm
      // bài cần quay lại bài đang làm, không phải trang tổng quan rồi tự tìm đường. LoginPage chỉ nhận
      // địa chỉ nằm trong khu vực của vai trò vừa đăng nhập.
      navigate('/dang-nhap', {
        replace: true,
        state: { sessionExpired: true, reason: message, from: pathname + search },
      })
    })

    return () => setUnauthorizedHandler(null)
  }, [navigate])

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dang-nhap" replace />} />
      <Route path="/dang-nhap" element={<LoginPage />} />

      {/* Mật khẩu do quản trị viên cấp còn hiệu lực (§5): RequireRole đưa mọi khu vực về đây. Đứng
          ngoài ba nhóm route bên dưới — role nào cũng có thể tới đây, không riêng một vai trò. */}
      <Route
        path="/doi-mat-khau"
        element={
          <RequireMustChangePassword>
            <ForceChangePasswordPage />
          </RequireMustChangePassword>
        }
      />

      {/* ===== Giáo viên ===== */}
      <Route
        element={
          <RequireRole role="teacher">
            <Outlet />
          </RequireRole>
        }
      >
        <Route path="/giao-vien" element={<TeacherDashboardPage />} />
        {/* Quản lý tài khoản học sinh thuộc quản trị viên; giáo viên chỉ xem chi tiết. */}
        <Route path="/giao-vien/hoc-sinh" element={<Navigate to="/giao-vien/nhom-lop" replace />} />
        <Route path="/giao-vien/hoc-sinh/:id" element={<StudentDetailPage />} />
        {/* Lớp học do quản trị viên lập và phân công; giáo viên chỉ có bản chỉ đọc. */}
        <Route path="/giao-vien/nhom-lop" element={<TeacherGroupListPage />} />
        <Route path="/giao-vien/nhom-lop/:id" element={<TeacherGroupDetailPage />} />
        <Route path="/giao-vien/cau-hoi" element={<QuestionBankPage audience="teacher" />} />
        <Route path="/giao-vien/cau-hoi/tao" element={<QuestionEditorPage audience="teacher" />} />
        <Route path="/giao-vien/cau-hoi/:id/sua" element={<QuestionEditorPage audience="teacher" />} />
        <Route path="/giao-vien/bai-kiem-tra" element={<ExamListPage />} />
        <Route path="/giao-vien/bai-kiem-tra/tao" element={<ExamBuilderEntry />} />
        <Route path="/giao-vien/bai-kiem-tra/:id/sua" element={<ExamBuilderEntry />} />
        <Route path="/giao-vien/bai-kiem-tra/:id" element={<ExamDetailPage />} />
        <Route path="/giao-vien/bai-kiem-tra/:id/giao-bai" element={<ExamAssignRedirect />} />
        {/* Không còn bảng kết quả chung: xem bài làm đi từ lớp → học sinh → bài làm. Địa chỉ cũ chuyển về danh sách lớp. */}
        <Route path="/giao-vien/ket-qua" element={<Navigate to="/giao-vien/nhom-lop" replace />} />
        <Route path="/giao-vien/ket-qua/:attemptId" element={<ResultDetailPage audience="teacher" />} />
        <Route path="/giao-vien/thong-bao" element={<NotificationsPage audience="teacher" />} />
        <Route path="/giao-vien/ho-so" element={<ProfilePage audience="teacher" />} />
      </Route>

      {/* ===== Quản trị viên ===== */}
      <Route
        element={
          <RequireRole role="admin">
            <Outlet />
          </RequireRole>
        }
      >
        {/* Quản trị viên không có trang tổng quan: việc của họ nằm ở lớp, học sinh và ngân hàng câu hỏi. Địa chỉ cũ chuyển về danh sách lớp. */}
        <Route path="/quan-tri" element={<Navigate to="/quan-tri/nhom-lop" replace />} />
        <Route path="/quan-tri/nhom-lop" element={<AdminGroupListPage />} />
        <Route path="/quan-tri/ky-hoc" element={<AdminTermListPage />} />
        <Route path="/quan-tri/nhom-lop/:id" element={<AdminGroupDetailPage />} />
        <Route path="/quan-tri/giao-vien" element={<AdminTeacherListPage />} />
        <Route path="/quan-tri/giao-vien/:id" element={<AdminTeacherDetailPage />} />
        <Route path="/quan-tri/hoc-sinh" element={<StudentListPage />} />
        <Route path="/quan-tri/hoc-sinh/tao" element={<StudentEditorPage />} />
        <Route path="/quan-tri/hoc-sinh/:id" element={<AdminStudentDetailPage />} />
        <Route path="/quan-tri/hoc-sinh/:id/sua" element={<StudentEditorPage />} />
        {/* Ngân hàng câu hỏi của mọi môn: quản trị viên xem, tạo, sửa, ẩn và xoá được câu của bất kỳ ai. */}
        <Route path="/quan-tri/cau-hoi" element={<QuestionBankPage audience="admin" />} />
        <Route path="/quan-tri/cau-hoi/tao" element={<QuestionEditorPage audience="admin" />} />
        <Route path="/quan-tri/cau-hoi/:id/sua" element={<QuestionEditorPage audience="admin" />} />
        {/* Quản trị viên xem được bài làm của mọi học sinh, chỉ đọc; đi tới từ hồ sơ học sinh. */}
        <Route path="/quan-tri/ket-qua/:attemptId" element={<ResultDetailPage audience="admin" />} />
        <Route path="/quan-tri/thong-bao" element={<NotificationsPage audience="admin" />} />
        <Route path="/quan-tri/ho-so" element={<ProfilePage audience="admin" />} />
      </Route>

      {/* ===== Học sinh ===== */}
      <Route
        element={
          <RequireRole role="student">
            <Outlet />
          </RequireRole>
        }
      >
        <Route path="/hoc-sinh" element={<StudentDashboardPage />} />
        <Route path="/hoc-sinh/lop-hoc" element={<StudentGroupListPage />} />
        <Route path="/hoc-sinh/lop-hoc/:groupId" element={<StudentGroupPage />} />
        <Route path="/hoc-sinh/bai-kiem-tra" element={<Navigate to="/hoc-sinh/lop-hoc" replace />} />
        <Route path="/hoc-sinh/bai-kiem-tra/:assignmentId" element={<ExamIntroPage />} />
        <Route path="/hoc-sinh/bai-kiem-tra/:assignmentId/lam-bai" element={<TakeExamPage />} />
        <Route path="/hoc-sinh/bai-kiem-tra/:attemptId/da-nop" element={<ExamSubmittedPage />} />
        <Route path="/hoc-sinh/bang-diem" element={<StudentTranscriptPage />} />
        <Route path="/hoc-sinh/ket-qua" element={<Navigate to="/hoc-sinh/bang-diem" replace />} />
        <Route path="/hoc-sinh/ket-qua/:attemptId" element={<ResultDetailPage audience="student" />} />
        <Route path="/hoc-sinh/thong-bao" element={<NotificationsPage audience="student" />} />
        <Route path="/hoc-sinh/ho-so" element={<ProfilePage audience="student" />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
