import { useState, type ReactNode } from 'react'
import {
  BookOpen, CalendarDays, Mail, Phone, ShieldCheck, type LucideIcon,
} from 'lucide-react'
import ErrorState from '../../../components/common/ErrorState'
import { SkeletonBlock } from '../../../components/common/Skeleton'
import AdminLayout from '../../../components/layout/AdminLayout'
import StudentLayout from '../../../components/layout/StudentLayout'
import TeacherLayout from '../../../components/layout/TeacherLayout'
import { useAsync } from '../../../hooks/useAsync'
import { formatDate } from '../../../lib/format'
import { fetchProfile } from '../../../services/authService'
import type { UserProfile, UserRole } from '../../../types'
import AvatarEditor from '../components/AvatarEditor'
import ChangePasswordForm from '../components/ChangePasswordForm'
import ProfileInfoForm from '../components/ProfileInfoForm'
import StudentScoreSummary from '../components/StudentScoreSummary'

interface ProfilePageProps {
  audience: UserRole
}

const roleLabels: Record<UserRole, string> = {
  teacher: 'Giáo viên',
  student: 'Học sinh',
  admin: 'Quản trị viên',
}

const chipBase = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold'

function ProfileShell({ audience, children }: { audience: UserRole; children: ReactNode }) {
  if (audience === 'teacher') {
    return (
      <TeacherLayout pageTitle="Hồ sơ cá nhân" pageSubtitle="Quản lý thông tin tài khoản và mật khẩu">
        {children}
      </TeacherLayout>
    )
  }

  if (audience === 'admin') {
    return (
      <AdminLayout pageTitle="Hồ sơ cá nhân" pageSubtitle="Quản lý thông tin tài khoản và mật khẩu">
        {children}
      </AdminLayout>
    )
  }

  return (
    <StudentLayout>
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-800">Hồ sơ cá nhân</h1>
        <p className="text-slate-500 text-sm mt-1">Quản lý thông tin tài khoản và mật khẩu của bạn.</p>
      </div>
      {children}
    </StudentLayout>
  )
}

function InfoLine({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
      <Icon size={15} className="text-slate-400 flex-shrink-0" />
      <span className="truncate">{text}</span>
    </p>
  )
}

function ProfileHeroCard({ profile, onSaved }: { profile: UserProfile; onSaved: (profile: UserProfile) => void }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-start gap-5">
        <AvatarEditor profile={profile} onSaved={onSaved} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-800">{profile.fullName}</h2>
            <span className={`${chipBase} bg-indigo-50 text-indigo-700`}>
              <ShieldCheck size={12} />
              {roleLabels[profile.role]}
            </span>
            {profile.groups?.map(group => (
              <span key={group.id} className={`${chipBase} bg-violet-50 text-violet-700`}>{group.name}</span>
            ))}
            {profile.code && <span className={`${chipBase} bg-slate-100 text-slate-600`}>{profile.code}</span>}
          </div>

          <p className="text-xs text-slate-400 mt-1.5">Tên đăng nhập: {profile.username}</p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
            <InfoLine icon={Mail} text={profile.email} />
            <InfoLine icon={Phone} text={profile.phone ? profile.phone : 'Chưa cập nhật số điện thoại'} />
            {profile.role === 'teacher' && (
              <InfoLine icon={BookOpen} text={profile.subject ? profile.subject : 'Chưa cập nhật môn giảng dạy'} />
            )}
            <InfoLine icon={CalendarDays} text={`Tham gia từ ${formatDate(profile.joinedAt)}`} />
          </div>
        </div>
      </div>
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row gap-5">
        <SkeletonBlock className="h-20 w-20 rounded-3xl" />
        <div className="flex-1 space-y-3">
          <SkeletonBlock className="h-5 w-56" />
          <SkeletonBlock className="h-3 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-3 w-2/3" />
            <SkeletonBlock className="h-3 w-2/3" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <SkeletonBlock className="h-5 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonBlock className="h-11 rounded-xl" />
            <SkeletonBlock className="h-11 rounded-xl" />
            <SkeletonBlock className="h-11 rounded-xl" />
            <SkeletonBlock className="h-11 rounded-xl" />
          </div>
          <SkeletonBlock className="h-10 w-40 rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="h-11 rounded-xl" />
          <SkeletonBlock className="h-11 rounded-xl" />
          <SkeletonBlock className="h-11 rounded-xl" />
          <SkeletonBlock className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage({ audience }: ProfilePageProps) {
  const { data, loading, error, reload } = useAsync(() => fetchProfile(), [])
  // Giữ bản vừa lưu để thẻ hồ sơ và thanh điều hướng đổi ngay, không phải tải lại trang
  const [savedProfile, setSavedProfile] = useState<UserProfile | undefined>(undefined)
  const profile = savedProfile ?? data

  // Thử lại thì bỏ bản đang giữ trong bộ nhớ để chắc chắn lấy dữ liệu mới
  const handleRetry = () => {
    setSavedProfile(undefined)
    reload()
  }

  return (
    <ProfileShell audience={audience}>
      {loading && <ProfileSkeleton />}
      {!loading && error && <ErrorState message={error} onRetry={handleRetry} />}
      {/* Không lỗi mà vẫn không có hồ sơ thì vẫn phải có lối thoát, không để màn hình trắng */}
      {!loading && !error && !profile && (
        <ErrorState message="Chưa đọc được hồ sơ của bạn. Vui lòng thử lại." onRetry={handleRetry} />
      )}
      {!loading && !error && profile && (
        <div className="space-y-5">
          <ProfileHeroCard profile={profile} onSaved={setSavedProfile} />

          {profile.role === 'student' && <StudentScoreSummary />}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <ProfileInfoForm profile={profile} onSaved={setSavedProfile} />
            </div>
            <ChangePasswordForm />
          </div>
        </div>
      )}
    </ProfileShell>
  )
}
