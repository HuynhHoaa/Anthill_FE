import { KeyRound, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ChangePasswordForm from '../components/ChangePasswordForm'

/**
 * Màn hình bắt buộc đổi mật khẩu (§5): hiện ra thay cho mọi trang khác khi tài khoản đang mang mật
 * khẩu do quản trị viên cấp (tạo tài khoản, hoặc cấp lại) — `RequireRole` đưa người dùng tới đây và
 * không cho đi đâu khác cho tới khi đổi xong.
 *
 * Tái dùng `ChangePasswordForm` — form đổi mật khẩu duy nhất của hệ thống — thay vì viết lại: cùng
 * một quy tắc kiểm mật khẩu mới, cùng một lời gọi `POST /api/auth/change-password`.
 */
export default function ForceChangePasswordPage() {
  const navigate = useNavigate()

  const handleSuccess = () => {
    // changePassword() đã xoá phiên (SecurityStamp xoay làm token hiện tại chết ngay). Đăng nhập
    // lại bằng mật khẩu mới là cách duy nhất để biết chắc MustChangePassword giờ là false — server
    // xác nhận qua chính response của lần đăng nhập đó, không phải một giá trị đặt lạc quan ở đây.
    navigate('/dang-nhap', {
      replace: true,
      state: { passwordChanged: true },
    })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FFF6EC 0%, #F8FAFC 45%, #FFF3E6 100%)' }}
    >
      <div
        className="absolute -top-32 -left-24 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'rgba(255, 132, 0, 0.08)' }}
      />
      <div
        className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: 'rgba(255, 160, 31, 0.08)' }}
      />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <ShieldAlert size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Cần đổi mật khẩu trước khi tiếp tục</p>
            <p className="text-sm text-amber-700 leading-relaxed mt-1">
              Mật khẩu hiện tại do quản trị viên cấp. Vì lý do an toàn, hãy đặt một mật khẩu mới chỉ
              mình bạn biết trước khi vào phần còn lại của hệ thống.
            </p>
          </div>
        </div>

        <ChangePasswordForm
          heading="Đặt mật khẩu mới"
          description="Nhập mật khẩu được cấp và mật khẩu mới bạn muốn dùng từ nay."
          onSuccess={handleSuccess}
        />

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-5">
          <KeyRound size={13} />
          Đổi xong bạn sẽ cần đăng nhập lại bằng mật khẩu mới.
        </p>
      </div>
    </div>
  )
}
