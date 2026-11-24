import React, { useState } from 'react';
import { 
  Compass, Mail, Phone, User, ArrowRight, Sparkles, CheckCircle2, 
  Globe, Lock, AlertCircle, ArrowLeft, Eye, EyeOff, Camera, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ForgotPasswordFlow } from './ForgotPasswordFlow';
import { compressAvatarImage } from '../utils/imageUtils';

const DEMO_ACCOUNTS = [
  { name: 'Perry Nguyễn', email: 'perrynguyen10@gmail.com', phone: '0901234567', roleVi: 'Trưởng đoàn', roleEn: 'Trip Leader', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Perry' },
  { name: 'Linh Chi', email: 'linhchi@tripmate.app', phone: '0912345678', roleVi: 'Thành viên nhóm', roleEn: 'Group Member', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LinhChi' },
  { name: 'Minh Quân', email: 'minhquan@tripmate.app', phone: '0987654321', roleVi: 'Thành viên nhóm', roleEn: 'Group Member', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MinhQuan' },
  { name: 'Khánh Vy', email: 'khanhvy@tripmate.app', phone: '0933221100', roleVi: 'Thành viên nhóm', roleEn: 'Group Member', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=KhanhVy' },
];

export const AuthScreen: React.FC = () => {
  const { loginWithGoogle, loginWithEmailAndPhone, isLoading } = useAuth();
  const { lang, setLang, isVi } = useLanguage();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Register fields
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerAvatar, setRegisterAvatar] = useState<string>('');
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'vi' : 'en');
  };

  const RFC_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const val = loginIdentifier.trim();
    const pwd = loginPassword.trim();
    if (!val) {
      setErrorMessage(isVi ? 'Vui lòng nhập Email hoặc Số điện thoại.' : 'Please enter your Email or Phone number.');
      return;
    }
    if (!pwd) {
      setErrorMessage(isVi ? 'Vui lòng nhập mật khẩu để đăng nhập.' : 'Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const res = await loginWithEmailAndPhone(val, undefined, undefined, false, pwd);
    setIsSubmitting(false);

    if (!res.success && res.message) {
      setErrorMessage(res.message);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = registerName.trim();
    const cleanEmail = registerEmail.trim();
    const cleanPhone = registerPhone.trim();
    const cleanPassword = registerPassword.trim();

    if (!cleanName) {
      setErrorMessage(isVi ? 'Vui lòng nhập họ và tên của bạn.' : 'Please enter your full name.');
      return;
    }
    if (cleanName.length > 150) {
      setErrorMessage(isVi ? 'Họ và tên không được vượt quá 150 ký tự.' : 'Full name cannot exceed 150 characters.');
      return;
    }
    if (!cleanEmail || !RFC_EMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage(isVi ? 'Vui lòng nhập địa chỉ Email hợp lệ (ví dụ: name@domain.com).' : 'Please enter a valid email address (e.g. name@domain.com).');
      return;
    }
    if (cleanPhone.length > 30) {
      setErrorMessage(isVi ? 'Số điện thoại không được vượt quá 30 ký tự.' : 'Phone number cannot exceed 30 characters.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMessage(isVi ? 'Vui lòng nhập mật khẩu tối thiểu 6 ký tự để bảo vệ tài khoản.' : 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    const res = await loginWithEmailAndPhone(cleanEmail, cleanName, cleanPhone, true, cleanPassword, registerAvatar || undefined);
    setIsSubmitting(false);

    if (!res.success && res.message) {
      setErrorMessage(res.message);
    } else {
      setSuccessMessage(isVi ? 'Đăng ký thành công! Đang chuyển vào ứng dụng...' : 'Registration successful! Entering app...');
    }
  };

  const handleDemoLogin = async (demo: typeof DEMO_ACCOUNTS[0]) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    const res = await loginWithEmailAndPhone(demo.email, demo.name, demo.phone, false, '123456');
    setIsSubmitting(false);
    if (!res.success && res.message) {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-[#07090E] text-slate-100 flex flex-col justify-between relative overflow-x-hidden overflow-y-auto font-sans selection:bg-teal-500 selection:text-white">
      
      {/* Fixed Ambient Glow Background Wrapper (never causes mobile overflow) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div 
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[540px] sm:w-[720px] h-[420px] sm:h-[500px] rounded-full blur-[120px] opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(13, 148, 136, 0.5) 0%, rgba(5, 150, 105, 0.2) 40%, transparent 80%)'
          }}
        />
        <div 
          className="absolute -bottom-40 -left-20 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] rounded-full blur-[120px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, transparent 70%)'
          }}
        />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      {/* Top Header with Brand Mark and Language Switcher */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-teal-500/20 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950/80 rounded-[11px] sm:rounded-[14px] flex items-center justify-center text-teal-400">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 animate-[spin_18s_linear_infinite]" />
            </div>
          </div>
          <div>
            <span className="font-display text-base sm:text-lg font-black tracking-tight text-white block leading-none">
              TripMate
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-teal-400/90 block mt-0.5">
              Smart Travel Hub
            </span>
          </div>
        </div>

        {/* Language Switcher */}
        <button
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer min-h-[36px]"
          title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        >
          <Globe className="w-3.5 h-3.5 text-teal-400" />
          <span>{isVi ? 'Tiếng Việt' : 'English'}</span>
        </button>
      </header>

      {/* Main Centered Login & Register Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-3.5 sm:px-4 py-2 sm:py-6 my-auto">
        <div className="backdrop-blur-2xl bg-slate-900/85 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.8)] relative overflow-hidden transition-all duration-200">
          
          {/* Subtle Top Accent Highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 opacity-90" />

          {/* Optional clean header only in register mode */}
          {mode === 'register' && (
            <div className="text-center mb-4 animate-in fade-in duration-150">
              <h2 className="font-display text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {isVi ? 'Đăng ký tài khoản mới' : 'Create an Account'}
              </h2>
            </div>
          )}

          {/* Segmented Tab Switcher (Đăng nhập / Đăng ký) */}
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl mb-4 sm:mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`py-2.5 sm:py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'Đăng nhập' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`py-2.5 sm:py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'Đăng ký tài khoản' : 'Sign Up'}
              </button>
            </div>
          )}

          {/* Error & Success Toasts */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. LOGIN MODE */}
          {mode === 'login' && (
            <div className="space-y-3.5 sm:space-y-4">
              {/* Google Sign In */}
              <button
                type="button"
                onClick={async () => {
                  setErrorMessage(null);
                  const res = await loginWithGoogle();
                  if (!res.success && res.message) {
                    setErrorMessage(res.message);
                  }
                }}
                disabled={isSubmitting || isLoading}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 active:scale-[0.99] border border-white/15 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer disabled:opacity-50 min-h-[42px]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isVi ? 'Đăng nhập với Google' : 'Sign in with Google'}</span>
              </button>

              <div className="h-px bg-white/10" />

              {/* Login Form */}
              <form noValidate onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {isVi ? 'Email hoặc Số điện thoại' : 'Email or Phone Number'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder={isVi ? 'Ví dụ: perrynguyen10@gmail.com' : 'e.g. user@tripmate.app'}
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full text-sm sm:text-xs py-2.5 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors min-h-[42px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      {isVi ? 'Mật khẩu' : 'Password'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs sm:text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer shrink-0"
                    >
                      {isVi ? 'Quên mật khẩu?' : 'Forgot password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      placeholder={isVi ? 'Nhập mật khẩu' : 'Enter password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full text-sm sm:text-xs py-2.5 pl-9 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full py-3 sm:py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[42px]"
                >
                  <span>{isSubmitting ? (isVi ? 'Đang xác thực...' : 'Authenticating...') : (isVi ? 'Đăng nhập' : 'Sign In')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Collapsible Quick 1-Click Demo Account Testing */}
              <div className="pt-3.5 mt-3.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowDemoAccounts((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 text-[11px] text-slate-300 hover:text-white py-1 cursor-pointer transition-colors"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>{isVi ? 'Dùng thử nhanh (4 tài khoản mẫu)' : 'Quick Demo Accounts'}</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showDemoAccounts ? 'rotate-180' : ''}`} />
                </button>
                {showDemoAccounts && (
                  <div className="mt-2.5 space-y-2 animate-in fade-in duration-150">
                    <div className="text-[10px] text-slate-400 flex justify-end">
                      <span>{isVi ? 'Mật khẩu: 123456' : 'Password: 123456'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {DEMO_ACCOUNTS.map((demo) => (
                        <button
                          key={demo.email}
                          type="button"
                          onClick={() => handleDemoLogin(demo)}
                          disabled={isSubmitting || isLoading}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 min-w-0"
                        >
                          <img
                            src={demo.avatar}
                            alt={demo.name}
                            className="w-7 h-7 rounded-full object-cover border border-teal-500/50 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-white truncate">{demo.name}</div>
                            <div className="text-[9px] text-teal-300/80 truncate">{isVi ? demo.roleVi : demo.roleEn}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 1.5 FORGOT PASSWORD MODE */}
          {mode === 'forgot' && (
            <ForgotPasswordFlow
              theme="dark"
              initialIdentifier={loginIdentifier}
              onBack={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              onSuccess={(accountEmail) => {
                setLoginIdentifier(accountEmail);
                setLoginPassword('');
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(
                  isVi
                    ? 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.'
                    : 'Password reset successful! Please sign in with your new password.'
                );
              }}
            />
          )}

          {/* 2. REGISTER MODE (DÀNH CHO NGƯỜI CHƯA ĐĂNG KÝ) */}
          {mode === 'register' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <form noValidate onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Optional Avatar Upload */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <label className="relative cursor-pointer group shrink-0" title={isVi ? 'Chọn ảnh đại diện' : 'Choose profile photo'}>
                    <img
                      src={
                        registerAvatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(registerName.trim() || 'TripMate')}`
                      }
                      alt={registerName || 'Avatar preview'}
                      className="w-12 h-12 rounded-full object-cover border-2 border-teal-400/70 bg-slate-800 shadow-xs group-hover:opacity-80 transition-opacity"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-teal-500 text-white border border-slate-900 flex items-center justify-center shadow-xs">
                      <Camera className="w-3 h-3" />
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setIsCompressingAvatar(true);
                        try {
                          const compressed = await compressAvatarImage(file);
                          setRegisterAvatar(compressed);
                        } catch (err) {
                          console.warn('Avatar upload error:', err);
                        } finally {
                          setIsCompressingAvatar(false);
                        }
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white">
                      {isVi ? 'Ảnh đại diện' : 'Profile Avatar'}{' '}
                      <span className="text-[10px] font-normal text-slate-400">({isVi ? 'Tùy chọn' : 'Optional'})</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      {isCompressingAvatar
                        ? (isVi ? 'Đang xử lý ảnh...' : 'Processing image...')
                        : (isVi ? 'Tải ảnh cá nhân để đồng bộ ở Banner và Chi tiêu.' : 'Upload a photo synced across Banner and Expenses.')}
                    </p>
                    {registerAvatar && (
                      <button
                        type="button"
                        onClick={() => setRegisterAvatar('')}
                        className="mt-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        {isVi ? 'Gỡ ảnh đã chọn' : 'Remove photo'}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {isVi ? 'Họ và tên của bạn' : 'Full Name'} <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      maxLength={150}
                      placeholder={isVi ? 'Ví dụ: Hoàng Long' : 'e.g. John Doe'}
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full text-sm sm:text-xs py-2.5 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors min-h-[42px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {isVi ? 'Địa chỉ Email' : 'Email Address'} <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      maxLength={120}
                      placeholder={isVi ? 'Ví dụ: hoanglong@example.com' : 'e.g. user@example.com'}
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full text-sm sm:text-xs py-2.5 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors min-h-[42px]"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isVi ? 'Dùng để người tạo chuyến đi tìm kiếm và gửi lời mời qua app.' : 'Used by trip creators to invite you into trips.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {isVi ? 'Số điện thoại' : 'Phone Number'} <span className="text-slate-500">({isVi ? 'Tùy chọn' : 'Optional'})</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      maxLength={30}
                      placeholder={isVi ? 'Ví dụ: 0912345678' : 'e.g. 0912345678'}
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      className="w-full text-sm sm:text-xs py-2.5 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors min-h-[42px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {isVi ? 'Thiết lập mật khẩu' : 'Password'} <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      maxLength={64}
                      placeholder={isVi ? 'Tối thiểu 6 ký tự' : 'Minimum 6 characters'}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full text-sm sm:text-xs py-2.5 pl-9 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full py-3 sm:py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 min-h-[42px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isSubmitting ? (isVi ? 'Đang tạo tài khoản...' : 'Creating Account...') : (isVi ? 'Đăng ký tài khoản' : 'Create Account')}</span>
                </button>
              </form>

              {/* Switch back to Login */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>{isVi ? 'Đã có tài khoản? Quay lại Đăng nhập' : 'Already have an account? Sign in'}</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-3 sm:py-4 text-[11px] text-slate-500 shrink-0">
        <span>TripMate © 2026</span>
      </footer>

    </div>
  );
};
