import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import RequireRole from './RequireRole'
import LoginPage from '../features/auth/pages/LoginPage'
import ProfilePage from '../features/auth/pages/ProfilePage'
import AdminDashboardPage from '../features/admin/pages/AdminDashboardPage'
import TeacherDashboardPage from '../features/dashboard/pages/TeacherDashboardPage'
import StudentDashboardPage from '../features/dashboard/pages/StudentDashboardPage'
import StudentDetailPage from '../features/students/pages/StudentDetailPage'
import StudentListPage from '../features/students/pages/StudentListPage'
import StudentEditorPage from '../features/students/pages/StudentEditorPage'
import StudentGroupPage from '../features/student-groups/pages/StudentGroupPage'
import StudentGroupDetailPage from '../features/student-groups/pages/StudentGroupDetailPage'
import QuestionBankPage from '../features/question-bank/pages/QuestionBankPage'
import QuestionEditorPage from '../features/question-bank/pages/QuestionEditorPage'
import ExamListPage from '../features/exams/pages/ExamListPage'
import ExamBuilderPage from '../features/exams/pages/ExamBuilderPage'
import ExamDetailPage from '../features/exams/pages/ExamDetailPage'
import ExamAssignPage from '../features/exams/pages/ExamAssignPage'
import StudentExamListPage from '../features/exam-taking/pages/StudentExamListPage'
import ExamIntroPage from '../features/exam-taking/pages/ExamIntroPage'
import TakeExamPage from '../features/exam-taking/pages/TakeExamPage'
import ExamSubmittedPage from '../features/exam-taking/pages/ExamSubmittedPage'
import TeacherResultsPage from '../features/results/pages/TeacherResultsPage'
import StudentResultsPage from '../features/results/pages/StudentResultsPage'
import ResultDetailPage from '../features/results/pages/ResultDetailPage'
import NotificationsPage from '../features/notifications/pages/NotificationsPage'
import NotFoundPage from '../features/misc/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dang-nhap" replace />} />
      <Route path="/dang-nhap" element={<LoginPage />} />

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
        <Route path="/giao-vien/nhom-lop" element={<StudentGroupPage />} />
        <Route path="/giao-vien/nhom-lop/:id" element={<StudentGroupDetailPage />} />
        <Route path="/giao-vien/cau-hoi" element={<QuestionBankPage />} />
        <Route path="/giao-vien/cau-hoi/tao" element={<QuestionEditorPage />} />
        <Route path="/giao-vien/cau-hoi/:id/sua" element={<QuestionEditorPage />} />
        <Route path="/giao-vien/bai-kiem-tra" element={<ExamListPage />} />
        <Route path="/giao-vien/bai-kiem-tra/tao" element={<ExamBuilderPage />} />
        <Route path="/giao-vien/bai-kiem-tra/:id/sua" element={<ExamBuilderPage />} />
        <Route path="/giao-vien/bai-kiem-tra/:id" element={<ExamDetailPage />} />
        <Route path="/giao-vien/bai-kiem-tra/:id/giao-bai" element={<ExamAssignPage />} />
        <Route path="/giao-vien/ket-qua" element={<TeacherResultsPage />} />
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
        <Route path="/quan-tri" element={<AdminDashboardPage />} />
        <Route path="/quan-tri/hoc-sinh" element={<StudentListPage />} />
        <Route path="/quan-tri/hoc-sinh/tao" element={<StudentEditorPage />} />
        <Route path="/quan-tri/hoc-sinh/:id/sua" element={<StudentEditorPage />} />
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
        <Route path="/hoc-sinh/bai-kiem-tra" element={<StudentExamListPage />} />
        <Route path="/hoc-sinh/bai-kiem-tra/:assignmentId" element={<ExamIntroPage />} />
        <Route path="/hoc-sinh/bai-kiem-tra/:assignmentId/lam-bai" element={<TakeExamPage />} />
        <Route path="/hoc-sinh/bai-kiem-tra/:attemptId/da-nop" element={<ExamSubmittedPage />} />
        <Route path="/hoc-sinh/ket-qua" element={<StudentResultsPage />} />
        <Route path="/hoc-sinh/ket-qua/:attemptId" element={<ResultDetailPage audience="student" />} />
        <Route path="/hoc-sinh/thong-bao" element={<NotificationsPage audience="student" />} />
        <Route path="/hoc-sinh/ho-so" element={<ProfilePage audience="student" />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
