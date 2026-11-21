import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Phone, Mail, User, ShieldCheck, KeyRound, Lock, Eye, EyeOff,
  AlertCircle, CheckCircle2, ArrowLeft, ChevronRight, Sparkles, Camera, Loader2
} from 'lucide-react';
import { useAuth, RFC_EMAIL_REGEX } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ForgotPasswordFlow } from './ForgotPasswordFlow';
import { PWAInstallButton } from './PWAInstallButton';
import { compressAvatarImage } from '../utils/imageUtils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEMO_USERS = [
  { name: 'Perry Nguyễn', email: 'perrynguyen10@gmail.com', phone: '0901234567', role: 'Trưởng đoàn / Creator' },
  { name: 'Linh Chi', email: 'linhchi@tripmate.app', phone: '0912345678', role: 'Thành viên 1' },
  { name: 'Minh Quân', email: 'minhquan@tripmate.app', phone: '0987654321', role: 'Thành viên 2' },
  { name: 'Khánh Vy', email: 'khanhvy@tripmate.app', phone: '0933221100', role: 'Thành viên 3' },
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    loginWithGoogle,
    loginWithEmailAndPhone,
    updateUserAvatar,
    changePassword,
    userProfile,
    logout,
    authModalView,
    setAuthModalView,
  } = useAuth();
  const { isVi } = useLanguage();

  // Logged-out auth states
  const [guestMode, setGuestMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showGuestPassword, setShowGuestPassword] = useState(false);

  // Logged-in Change Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [registerAvatar, setRegisterAvatar] = useState<string>('');

  // Reset form messages when modal opens/closes or view changes
  useEffect(() => {
    if (!isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setRegisterAvatar('');
      setAuthModalView('profile');
      setGuestMode('login');
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanIdentifier = email.trim();
    const cleanPwd = password.trim();

    if (guestMode === 'register') {
      if (!displayName.trim()) {
        setErrorMsg(isVi ? 'Vui lòng nhập họ và tên.' : 'Please enter your full name.');
        return;
      }
      if (!cleanIdentifier || !RFC_EMAIL_REGEX.test(cleanIdentifier)) {
        setErrorMsg(isVi ? 'Định dạng Email không hợp lệ.' : 'Invalid email address.');
        return;
      }
      if (cleanPwd.length < 6) {
        setErrorMsg(isVi ? 'Mật khẩu tối thiểu 6 ký tự.' : 'Password must be at least 6 characters.');
        return;
      }
      setIsSubmitting(true);
      const res = await loginWithEmailAndPhone(cleanIdentifier, displayName, phone, true, cleanPwd, registerAvatar || undefined);
      setIsSubmitting(false);
      if (!res.success && res.message) setErrorMsg(res.message);
    } else {
      if (!cleanIdentifier || !cleanPwd) {
        setErrorMsg(isVi ? 'Vui lòng nhập đầy đủ Email/SĐT và mật khẩu.' : 'Please enter Email/Phone and password.');
        return;
      }
      setIsSubmitting(true);
      const res = await loginWithEmailAndPhone(cleanIdentifier, undefined, undefined, false, cleanPwd);
      setIsSubmitting(false);
      if (!res.success && res.message) setErrorMsg(res.message);
    }
  };

  const handleQuickDemo = async (demo: typeof DEMO_USERS[0]) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await loginWithEmailAndPhone(demo.email, demo.name, demo.phone, false, '123456');
    setIsSubmitting(false);
    if (!res.success && res.message) setErrorMsg(res.message);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (userProfile?.passwordHash && !currentPassword.trim()) {
      setErrorMsg(isVi ? 'Vui lòng nhập mật khẩu hiện tại.' : 'Please enter your current password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setErrorMsg(isVi ? 'Mật khẩu mới phải có tối thiểu 6 ký tự.' : 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword.trim() !== confirmNewPassword.trim()) {
      setErrorMsg(isVi ? 'Xác nhận mật khẩu mới không khớp.' : 'New password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message || (isVi ? 'Đổi mật khẩu thất bại.' : 'Failed to change password.'));
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setAuthModalView('profile');
    setSuccessMsg(
      isVi
        ? 'Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật.'
        : 'Password changed successfully!'
    );
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>, forRegister: boolean = false) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(isVi ? 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).' : 'Please select a valid image file.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploadingAvatar(true);
    try {
      const compressed = await compressAvatarImage(file, 160, 0.82);
      if (forRegister) {
        setRegisterAvatar(compressed);
      } else {
        const res = await updateUserAvatar(compressed);
        if (res.success) {
          setSuccessMsg(
            isVi
              ? 'Đã cập nhật & đồng bộ ảnh đại diện lên banner và chi tiêu!'
              : 'Avatar updated & synced across banner and expenses!'
          );
        } else if (res.message) {
          setErrorMsg(res.message);
        }
      }
    } catch {
      setErrorMsg(isVi ? 'Không thể xử lý ảnh. Vui lòng thử ảnh khác.' : 'Could not process image. Please try another.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:my-auto animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-teal-100">
              {userProfile && authModalView !== 'profile' ? (
                <KeyRound className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {userProfile
                  ? authModalView === 'change-password'
                    ? isVi
                      ? 'Đổi Mật Khẩu Tài Khoản'
                      : 'Change Account Password'
                    : authModalView === 'forgot-password'
                    ? isVi
                      ? 'Khôi Phục Mật Khẩu'
                      : 'Reset Password'
                    : isVi
                    ? 'Tài Khoản TripMate'
                    : 'TripMate Account'
                  : isVi
                  ? 'Đăng Ký & Đăng Nhập'
                  : 'Sign In & Register'}
              </h3>
              <p className="text-[11px] text-teal-100/90">
                {userProfile && authModalView !== 'profile'
                  ? isVi
                    ? 'Bảo mật tài khoản của bạn'
                    : 'Secure your account'
                  : isVi
                  ? 'Đồng bộ chuyến đi & nhận lời mời tham gia nhóm'
                  : 'Sync trips & receive group invitations'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-teal-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[80vh] pb-8 sm:pb-6">
          {/* Global feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {userProfile ? (
            /* LOGGED-IN STATES */
            <>
              {/* Account Information Card (shown in both profile and change-password so user always sees account info) */}
              {authModalView !== 'forgot-password' && (
                <div className="p-3.5 bg-teal-50/80 rounded-2xl border border-teal-200 flex items-center gap-3">
                  <label className="relative shrink-0 cursor-pointer group" title={isVi ? 'Thêm / Đổi ảnh đại diện' : 'Add / Change avatar'}>
                    <img
                      src={userProfile.avatar}
                      alt={userProfile.displayName}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-teal-500 shadow-xs group-hover:opacity-85 transition-opacity"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-teal-600 text-white border-2 border-white flex items-center justify-center shadow-xs group-hover:bg-teal-700 transition-colors">
                      {isUploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingAvatar}
                      onChange={(e) => handleAvatarFileChange(e, false)}
                      className="hidden"
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-slate-900 truncate">
                      {userProfile.displayName}
                    </div>
                    <div className="text-xs text-slate-600 truncate flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{userProfile.email}</span>
                    </div>
                    {userProfile.phone && (
                      <div className="text-xs text-slate-600 truncate flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{userProfile.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                        ✓ {isVi ? 'Tài khoản hoạt động' : 'Active Account'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 1: PROFILE OVERVIEW */}
              {authModalView === 'profile' && (
                <div className="space-y-3">
                  {/* Change Password Entry Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setAuthModalView('change-password');
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/70 active:scale-[0.99] border border-slate-200 hover:border-teal-300 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {isVi ? 'Đổi mật khẩu' : 'Change Password'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {userProfile.passwordHash
                            ? isVi
                              ? 'Cập nhật mật khẩu mới hoặc khôi phục khi quên'
                              : 'Update password or reset if forgotten'
                            : isVi
                            ? 'Thiết lập mật khẩu đăng nhập cho tài khoản'
                            : 'Set a login password for your account'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors shrink-0" />
                  </button>

                  {/* Add to Home Screen / Install App (iOS, Android, Windows) */}
                  <PWAInstallButton variant="modal-card" />

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        onClose();
                      }}
                      className="w-full py-2.5 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      {isVi ? 'Đăng xuất' : 'Sign Out'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      {isVi ? 'Đóng' : 'Close'}
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 2: CHANGE PASSWORD FORM + FORGOT PASSWORD LINK */}
              {authModalView === 'change-password' && (
                <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5 animate-in fade-in duration-150">
                  {userProfile.passwordHash ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          {isVi ? 'Mật khẩu hiện tại' : 'Current Password'}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null);
                            setSuccessMsg(null);
                            setAuthModalView('forgot-password');
                          }}
                          className="text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                        >
                          {isVi ? 'Quên mật khẩu?' : 'Forgot password?'}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showCurrentPwd ? 'text' : 'password'}
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder={isVi ? 'Nhập mật khẩu hiện tại' : 'Enter current password'}
                          className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showCurrentPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2">
                      <span>
                        {isVi
                          ? 'Tài khoản Google chưa có mật khẩu riêng. Bạn có thể thiết lập ngay bên dưới.'
                          : 'Google account has no local password yet. Set one below.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setSuccessMsg(null);
                          setAuthModalView('forgot-password');
                        }}
                        className="text-[11px] font-bold text-teal-700 hover:underline shrink-0 cursor-pointer"
                      >
                        {isVi ? 'Xác thực OTP' : 'Use OTP'}
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {isVi ? 'Mật khẩu mới' : 'New Password'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        required
                        minLength={6}
                        maxLength={64}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={isVi ? 'Tối thiểu 6 ký tự' : 'Minimum 6 characters'}
                        className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(!showNewPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {isVi ? 'Xác nhận mật khẩu mới' : 'Confirm New Password'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showConfirmPwd ? 'text' : 'password'}
                        required
                        minLength={6}
                        maxLength={64}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder={isVi ? 'Nhập lại mật khẩu mới' : 'Re-enter new password'}
                        className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setAuthModalView('profile');
                      }}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Quay lại' : 'Back'}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSubmitting
                        ? isVi
                          ? 'Đang cập nhật...'
                          : 'Updating...'
                        : isVi
                        ? 'Cập nhật mật khẩu'
                        : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW 3: FORGOT PASSWORD FLOW INSIDE LOGGED-IN MODAL */}
              {authModalView === 'forgot-password' && (
                <ForgotPasswordFlow
                  theme="light"
                  initialAccount={userProfile}
                  onBack={() => {
                    setErrorMsg(null);
                    setAuthModalView('change-password');
                  }}
                  onSuccess={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setAuthModalView('profile');
                    setSuccessMsg(
                      isVi
                        ? 'Đã khôi phục và đặt lại mật khẩu mới thành công!'
                        : 'Password has been reset successfully!'
                    );
                  }}
                />
              )}
            </>
          ) : (
            /* GUEST (NOT LOGGED IN) MODAL STATES */
            <>
              {guestMode === 'forgot' ? (
                <ForgotPasswordFlow
                  theme="light"
                  initialIdentifier={email}
                  onBack={() => {
                    setGuestMode('login');
                    setErrorMsg(null);
                  }}
                  onSuccess={(accountEmail) => {
                    setEmail(accountEmail);
                    setPassword('');
                    setGuestMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(
                      isVi
                        ? 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.'
                        : 'Password reset successful! Please sign in with your new password.'
                    );
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {/* Tabs: Login / Register */}
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setGuestMode('login');
                        setErrorMsg(null);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        guestMode === 'login'
                          ? 'bg-white text-teal-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {isVi ? 'Đăng nhập' : 'Sign In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestMode('register');
                        setErrorMsg(null);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        guestMode === 'register'
                          ? 'bg-white text-teal-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {isVi ? 'Đăng ký' : 'Register'}
                    </button>
                  </div>

                  {/* Google Sign In */}
                  {guestMode === 'login' && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          setErrorMsg(null);
                          const res = await loginWithGoogle();
                          if (!res.success && res.message) {
                            setErrorMsg(res.message);
                          }
                        }}
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200 rounded-xl font-bold text-xs text-slate-700 transition-all flex items-center justify-center gap-2.5 shadow-2xs cursor-pointer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>{isVi ? 'Đăng nhập với Google' : 'Sign In with Google'}</span>
                      </button>

                      <div className="h-px bg-slate-200" />
                    </>
                  )}

                  {/* Form */}
                  <form onSubmit={handleGuestSubmit} className="space-y-3">
                    {guestMode === 'register' && (
                      <>
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="relative shrink-0 cursor-pointer group">
                            {registerAvatar ? (
                              <img
                                src={registerAvatar}
                                alt="Avatar preview"
                                className="w-11 h-11 rounded-full object-cover border-2 border-teal-500"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-700 border border-teal-200 flex items-center justify-center">
                                <Camera className="w-4 h-4" />
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingAvatar}
                              onChange={(e) => handleAvatarFileChange(e, true)}
                              className="hidden"
                            />
                          </label>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-800">
                              {isVi ? 'Ảnh đại diện' : 'Profile Avatar'}{' '}
                              <span className="font-normal text-slate-400">({isVi ? 'Tùy chọn' : 'Optional'})</span>
                            </div>
                            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer mt-0.5">
                              <span>{registerAvatar ? (isVi ? 'Chọn ảnh khác' : 'Choose another photo') : (isVi ? 'Tải ảnh từ thiết bị' : 'Upload from device')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={isUploadingAvatar}
                                onChange={(e) => handleAvatarFileChange(e, true)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isVi ? 'Họ và tên của bạn' : 'Full Name'}
                          </label>
                          <div className="relative">
                            <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              maxLength={150}
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder={isVi ? 'Ví dụ: Nguyễn Văn An' : 'e.g. John Doe'}
                              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {guestMode === 'register'
                          ? isVi
                            ? 'Địa chỉ Email'
                            : 'Email Address'
                          : isVi
                          ? 'Email hoặc Số điện thoại'
                          : 'Email or Phone'}
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={guestMode === 'register' ? 'email' : 'text'}
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={guestMode === 'register' ? 'ban@example.com' : 'perrynguyen10@gmail.com'}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {guestMode === 'register' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isVi ? 'Số điện thoại' : 'Phone Number'}{' '}
                          <span className="font-normal text-slate-400">({isVi ? 'Tùy chọn' : 'Optional'})</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            maxLength={30}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="0901234567"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          {isVi ? 'Mật khẩu' : 'Password'}
                        </label>
                        {guestMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => {
                              setGuestMode('forgot');
                              setErrorMsg(null);
                              setSuccessMsg(null);
                            }}
                            className="text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                          >
                            {isVi ? 'Quên mật khẩu?' : 'Forgot password?'}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showGuestPassword ? 'text' : 'password'}
                          required
                          minLength={guestMode === 'register' ? 6 : 1}
                          maxLength={64}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={isVi ? 'Nhập mật khẩu' : 'Enter password'}
                          className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGuestPassword(!showGuestPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showGuestPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {guestMode === 'register' && <Sparkles className="w-3.5 h-3.5" />}
                      <span>
                        {isSubmitting
                          ? isVi
                            ? 'Đang xử lý...'
                            : 'Processing...'
                          : guestMode === 'register'
                          ? isVi
                            ? 'Đăng ký tài khoản mới'
                            : 'Create Account'
                          : isVi
                          ? 'Đăng nhập'
                          : 'Sign In'}
                      </span>
                    </button>
                  </form>

                  {/* Demo Switcher */}
                  {guestMode === 'login' && (
                    <div className="pt-3 border-t border-slate-100">
                      <div className="text-[11px] font-bold text-slate-500 mb-2 flex items-center justify-between">
                        <span>{isVi ? 'Tài khoản thử nghiệm nhanh (1 chạm):' : 'Instant Demo Accounts:'}</span>
                        <span className="text-[10px] text-teal-600 font-semibold">
                          {isVi ? 'Mật khẩu: 123456' : 'Pass: 123456'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DEMO_USERS.map((demo) => (
                          <button
                            key={demo.email}
                            type="button"
                            onClick={() => handleQuickDemo(demo)}
                            className="p-2 bg-slate-50 hover:bg-teal-50/80 border border-slate-200 hover:border-teal-300 rounded-xl text-left transition-all cursor-pointer group"
                          >
                            <div className="text-xs font-bold text-slate-800 group-hover:text-teal-900 truncate">
                              {demo.name}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{demo.email}</div>
                            <div className="text-[9px] font-semibold text-teal-700 truncate mt-0.5">{demo.phone}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
