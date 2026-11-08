import React, { useState } from 'react';
import { X, LogIn, UserPlus, Sparkles, Check, Phone, Mail, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

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
  const { loginWithGoogle, loginWithEmailAndPhone, userProfile, logout } = useAuth();
  const { lang, isVi } = useLanguage();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    await loginWithEmailAndPhone(email, displayName, phone);
    setIsSubmitting(false);
  };

  const handleQuickDemo = async (demo: typeof DEMO_USERS[0]) => {
    setIsSubmitting(true);
    await loginWithEmailAndPhone(demo.email, demo.name, demo.phone);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-teal-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {userProfile
                  ? (isVi ? 'Tài Khoản TripMate' : 'TripMate Account')
                  : (isVi ? 'Đăng Ký & Đăng Nhập' : 'Sign In & Register')}
              </h3>
              <p className="text-[11px] text-teal-100/90">
                {isVi ? 'Đồng bộ chuyến đi & nhận lời mời tham gia nhóm' : 'Sync trips & receive group invitations'}
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
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {userProfile ? (
            /* Current Profile State */
            <div className="space-y-4">
              <div className="p-4 bg-teal-50/80 rounded-2xl border border-teal-200 flex items-center gap-3">
                <img
                  src={userProfile.avatar}
                  alt={userProfile.displayName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-teal-500 shadow-xs shrink-0"
                />
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
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                    ✓ {isVi ? 'Tài khoản hoạt động' : 'Active Account'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  {isVi ? 'Đăng xuất tài khoản này' : 'Sign Out'}
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
          ) : (
            /* Sign In / Register Form */
            <div className="space-y-4">
              {/* Google Sign In */}
              <button
                type="button"
                onClick={loginWithGoogle}
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

              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <div className="flex-1 h-px bg-slate-200" />
                <span>{isVi ? 'hoặc nhập Email / SĐT' : 'or with Email / Phone'}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Email & Phone Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Họ và tên của bạn' : 'Full Name'}
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={isVi ? 'Ví dụ: Nguyễn Văn An' : 'e.g. John Doe'}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Địa chỉ Email' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ban@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Số điện thoại' : 'Phone Number'} <span className="font-normal text-slate-400">({isVi ? 'Để bạn bè tìm kiếm' : 'Optional'})</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0901234567"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (isVi ? 'Đang xử lý...' : 'Processing...') : (isVi ? 'Đăng ký / Đăng nhập ngay' : 'Sign In / Register')}
                </button>
              </form>

              {/* Demo Switcher for Instant Testing */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 mb-2 flex items-center justify-between">
                  <span>{isVi ? 'Tài khoản thử nghiệm nhanh (1 chạm):' : 'Instant Demo Accounts:'}</span>
                  <span className="text-[10px] text-teal-600 font-semibold">{isVi ? 'Thử mời bạn bè' : 'Test Invitations'}</span>
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
                      <div className="text-[10px] text-slate-500 truncate">
                        {demo.email}
                      </div>
                      <div className="text-[9px] font-semibold text-teal-700 truncate mt-0.5">
                        {demo.phone}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
