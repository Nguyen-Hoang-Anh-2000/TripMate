import React, { useState, useEffect } from 'react';
import {
  Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, ArrowRight,
  AlertCircle, CheckCircle2, ShieldCheck, KeyRound, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserProfile } from '../types';

interface ForgotPasswordFlowProps {
  theme?: 'dark' | 'light';
  initialAccount?: UserProfile | null;
  initialIdentifier?: string;
  onBack: () => void;
  onSuccess: (accountEmail: string) => void;
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function maskPhone(phone: string): string {
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  return `${clean.slice(0, 3)}***${clean.slice(-3)}`;
}

export const ForgotPasswordFlow: React.FC<ForgotPasswordFlowProps> = ({
  theme = 'dark',
  initialAccount = null,
  initialIdentifier = '',
  onBack,
  onSuccess,
}) => {
  const { findAccountForReset, resetAccountPassword } = useAuth();
  const { isVi } = useLanguage();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState(initialIdentifier || initialAccount?.email || '');
  const [verifiedAccount, setVerifiedAccount] = useState<UserProfile | null>(null);
  const [isVerifyingInitial, setIsVerifyingInitial] = useState<boolean>(!!initialAccount);

  // OTP state
  const [otpChannel, setOtpChannel] = useState<'email' | 'phone'>('email');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpLocked, setOtpLocked] = useState(false);

  // New password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verify initialAccount against Firestore users collection so it is guaranteed to exist
  useEffect(() => {
    let isMounted = true;
    const verifyInitial = async () => {
      if (!initialAccount) {
        setIsVerifyingInitial(false);
        return;
      }
      setIsVerifyingInitial(true);
      const lookupVal = initialAccount.email || initialAccount.phone || '';
      const res = await findAccountForReset(lookupVal);
      if (!isMounted) return;
      if (res.success && res.account) {
        setVerifiedAccount(res.account);
        setOtpChannel('email');
      } else {
        setVerifiedAccount(null);
        setErrorMsg(
          res.message ||
            (isVi
              ? 'Tài khoản không tồn tại trong hệ thống.'
              : 'Account does not exist in the system.')
        );
      }
      setIsVerifyingInitial(false);
    };
    verifyInitial();
    return () => {
      isMounted = false;
    };
  }, [initialAccount?.id]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = identifier.trim();
    if (!clean) {
      setErrorMsg(
        isVi
          ? 'Vui lòng nhập Email hoặc Số điện thoại đã đăng ký.'
          : 'Please enter your registered Email or Phone number.'
      );
      return;
    }

    setIsSubmitting(true);
    const res = await findAccountForReset(clean);
    setIsSubmitting(false);

    if (!res.success || !res.account) {
      setVerifiedAccount(null);
      setErrorMsg(
        res.message ||
          (isVi
            ? 'Tài khoản không tồn tại trong hệ thống.'
            : 'Account does not exist in the system.')
      );
      return;
    }

    setVerifiedAccount(res.account);
    // Default channel matches what user typed if available
    if (!clean.includes('@') && res.account.phone) {
      setOtpChannel('phone');
    } else {
      setOtpChannel('email');
    }
  };

  const handleSendOtp = () => {
    if (!verifiedAccount) return;
    setErrorMsg(null);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpInput('');
    setOtpAttempts(0);
    setOtpLocked(false);
    setOtpCountdown(60);
    setStep(2);
  };

  const handleResendOtp = () => {
    if (otpCountdown > 0 || !verifiedAccount) return;
    setErrorMsg(null);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpInput('');
    setOtpAttempts(0);
    setOtpLocked(false);
    setOtpCountdown(60);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (otpLocked || !generatedOtp) {
      setErrorMsg(
        isVi
          ? 'Mã OTP đã hết hiệu lực do nhập sai nhiều lần. Vui lòng gửi lại mã mới.'
          : 'OTP invalidated due to too many failed attempts. Please request a new code.'
      );
      return;
    }

    const cleanOtp = otpInput.trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg(isVi ? 'Vui lòng nhập đủ 6 chữ số mã OTP.' : 'Please enter the 6-digit OTP code.');
      return;
    }

    if (cleanOtp !== generatedOtp) {
      const nextAttempts = otpAttempts + 1;
      setOtpAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setOtpLocked(true);
        setGeneratedOtp(null);
        setErrorMsg(
          isVi
            ? 'Bạn đã nhập sai quá 5 lần. Mã OTP đã bị vô hiệu hóa, vui lòng bấm gửi lại mã mới.'
            : 'Too many invalid attempts (5/5). Please request a new OTP code.'
        );
      } else {
        setErrorMsg(
          isVi
            ? `Mã OTP không chính xác (${nextAttempts}/5 lần thử).`
            : `Invalid OTP code (${nextAttempts}/5 attempts).`
        );
      }
      return;
    }

    setStep(3);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!verifiedAccount) return;

    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (cleanNew.length < 6) {
      setErrorMsg(
        isVi ? 'Mật khẩu mới phải có tối thiểu 6 ký tự.' : 'New password must be at least 6 characters.'
      );
      return;
    }
    if (cleanNew.length > 64) {
      setErrorMsg(
        isVi ? 'Mật khẩu mới không được vượt quá 64 ký tự.' : 'New password cannot exceed 64 characters.'
      );
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setErrorMsg(
        isVi ? 'Xác nhận mật khẩu mới không khớp.' : 'Password confirmation does not match.'
      );
      return;
    }

    setIsSubmitting(true);
    const res = await resetAccountPassword(verifiedAccount.id, cleanNew);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(
        res.message ||
          (isVi ? 'Không thể cập nhật mật khẩu mới.' : 'Unable to update password.')
      );
      return;
    }

    onSuccess(verifiedAccount.email);
  };

  const inputClass = isDark
    ? 'w-full text-xs py-2.5 pl-9 pr-9 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors'
    : 'w-full text-xs py-2.5 pl-9 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors';

  const labelClass = isDark
    ? 'block text-xs font-semibold text-slate-300 mb-1.5'
    : 'block text-xs font-bold text-slate-700 mb-1.5';

  const cardBgClass = isDark
    ? 'bg-white/5 border border-white/10'
    : 'bg-slate-50 border border-slate-200';

  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const titleTextClass = isDark ? 'text-white' : 'text-slate-900';

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Header & Step Progress */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isVi ? 'Quay lại' : 'Back'}</span>
        </button>

        <div className="flex items-center gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step
                  ? 'w-6 bg-teal-500'
                  : s < step
                  ? 'w-3 bg-emerald-500/70'
                  : isDark
                  ? 'w-3 bg-white/15'
                  : 'w-3 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center gap-2.5">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isDark
              ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
              : 'bg-teal-50 text-teal-600 border border-teal-200'
          }`}
        >
          <KeyRound className="w-4 h-4" />
        </div>
        <div>
          <h3 className={`text-sm font-extrabold ${titleTextClass}`}>
            {isVi ? 'Khôi phục mật khẩu' : 'Reset Password'}
          </h3>
          <p className={`text-[11px] ${mutedTextClass}`}>
            {step === 1
              ? isVi
                ? 'Bước 1/3: Xác minh tài khoản đã đăng ký'
                : 'Step 1/3: Verify existing account'
              : step === 2
              ? isVi
                ? 'Bước 2/3: Nhập mã OTP xác thực'
                : 'Step 2/3: Verify OTP code'
              : isVi
              ? 'Bước 3/3: Thiết lập mật khẩu mới'
              : 'Step 3/3: Set a new password'}
          </p>
        </div>
      </div>

      {/* Error Box */}
      {errorMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
            isDark
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Find existing account & choose OTP channel */}
      {step === 1 && (
        <div className="space-y-3.5">
          {isVerifyingInitial ? (
            <div className={`p-4 rounded-2xl text-xs text-center ${cardBgClass} ${mutedTextClass}`}>
              {isVi ? 'Đang kiểm tra tài khoản trong hệ thống...' : 'Verifying account...'}
            </div>
          ) : !verifiedAccount ? (
            <form onSubmit={handleFindAccount} className="space-y-3">
              <div>
                <label className={labelClass}>
                  {isVi ? 'Email hoặc Số điện thoại đã đăng ký' : 'Registered Email or Phone Number'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={isVi ? 'Ví dụ: name@example.com hoặc 0901234567' : 'e.g. name@example.com or 0901234567'}
                    className={inputClass}
                    autoFocus
                  />
                </div>
                <p className={`text-[10px] mt-1 ${mutedTextClass}`}>
                  {isVi
                    ? 'Chỉ hỗ trợ khôi phục cho tài khoản đã đăng ký trong hệ thống.'
                    : 'Only existing registered accounts can reset their password.'}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>
                  {isSubmitting
                    ? isVi
                      ? 'Đang kiểm tra...'
                      : 'Checking...'
                    : isVi
                    ? 'Kiểm tra tài khoản'
                    : 'Find Account'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="space-y-3.5">
              {/* Verified existing account card */}
              <div className={`p-3 rounded-2xl flex items-center gap-3 ${cardBgClass}`}>
                <img
                  src={verifiedAccount.avatar}
                  alt={verifiedAccount.displayName}
                  className="w-10 h-10 rounded-full object-cover border border-teal-500/60 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold truncate ${titleTextClass}`}>
                    {verifiedAccount.displayName}
                  </div>
                  <div className={`text-[11px] truncate ${mutedTextClass}`}>
                    {maskEmail(verifiedAccount.email)}
                    {verifiedAccount.phone ? ` • ${maskPhone(verifiedAccount.phone)}` : ''}
                  </div>
                </div>
                {!initialAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedAccount(null);
                      setErrorMsg(null);
                    }}
                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg cursor-pointer ${
                      isDark ? 'text-teal-400 hover:bg-white/10' : 'text-teal-700 hover:bg-teal-50'
                    }`}
                  >
                    {isVi ? 'Đổi' : 'Change'}
                  </button>
                )}
              </div>

              {/* Choose OTP Channel */}
              <div>
                <label className={labelClass}>
                  {isVi ? 'Chọn phương thức nhận mã OTP (6 số)' : 'Choose OTP delivery method'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpChannel('email')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      otpChannel === 'email'
                        ? isDark
                          ? 'bg-teal-500/15 border-teal-400 text-white'
                          : 'bg-teal-50 border-teal-500 text-teal-900'
                        : isDark
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Mail className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      <span>Email</span>
                    </div>
                    <div className={`text-[10px] truncate mt-0.5 ${mutedTextClass}`}>
                      {maskEmail(verifiedAccount.email)}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!verifiedAccount.phone}
                    onClick={() => verifiedAccount.phone && setOtpChannel('phone')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      !verifiedAccount.phone
                        ? isDark
                          ? 'bg-white/5 border-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                          : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                        : otpChannel === 'phone'
                        ? isDark
                          ? 'bg-teal-500/15 border-teal-400 text-white cursor-pointer'
                          : 'bg-teal-50 border-teal-500 text-teal-900 cursor-pointer'
                        : isDark
                        ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Phone className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      <span>{isVi ? 'Số ĐT' : 'Phone'}</span>
                    </div>
                    <div className={`text-[10px] truncate mt-0.5 ${mutedTextClass}`}>
                      {verifiedAccount.phone
                        ? maskPhone(verifiedAccount.phone)
                        : isVi
                        ? 'Chưa liên kết SĐT'
                        : 'No phone linked'}
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isVi ? 'Gửi mã OTP xác thực' : 'Send OTP Code'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Enter & Verify OTP */}
      {step === 2 && verifiedAccount && (
        <form onSubmit={handleVerifyOtp} className="space-y-3.5">
          {/* Simulated OTP Banner */}
          <div
            className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
              isDark
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-200'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {isVi ? 'Mã OTP mô phỏng gửi đến:' : 'Simulated OTP sent to:'}{' '}
                <strong className="font-mono">
                  {otpChannel === 'email'
                    ? maskEmail(verifiedAccount.email)
                    : maskPhone(verifiedAccount.phone || '')}
                </strong>
              </span>
            </div>
            {generatedOtp && !otpLocked && (
              <div className="flex items-center justify-between pt-1">
                <span className={`text-[11px] ${isDark ? 'text-teal-300/80' : 'text-teal-700'}`}>
                  {isVi ? 'Mã xác thực của bạn:' : 'Your verification code:'}
                </span>
                <span className="font-mono text-sm font-black tracking-[0.25em] px-2.5 py-1 rounded-lg bg-teal-600 text-white">
                  {generatedOtp}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {isVi ? 'Nhập mã OTP 6 chữ số' : 'Enter 6-digit OTP code'}
              </label>
              <button
                type="button"
                disabled={otpCountdown > 0}
                onClick={handleResendOtp}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                  otpCountdown > 0
                    ? isDark
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-slate-400 cursor-not-allowed'
                    : isDark
                    ? 'text-teal-400 hover:text-teal-300 cursor-pointer'
                    : 'text-teal-700 hover:text-teal-800 cursor-pointer'
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                <span>
                  {otpCountdown > 0
                    ? isVi
                      ? `Gửi lại (${otpCountdown}s)`
                      : `Resend (${otpCountdown}s)`
                    : isVi
                    ? 'Gửi lại mã OTP'
                    : 'Resend OTP'}
                </span>
              </button>
            </div>

            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="● ● ● ● ● ●"
                className={`${inputClass} font-mono tracking-[0.3em] text-center pl-9 pr-3`}
                autoFocus
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setErrorMsg(null);
              }}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isVi ? 'Quay lại' : 'Back'}
            </button>
            <button
              type="submit"
              disabled={otpLocked || otpInput.length < 6}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isVi ? 'Xác nhận OTP' : 'Verify OTP'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Set New Password */}
      {step === 3 && verifiedAccount && (
        <form onSubmit={handleSaveNewPassword} className="space-y-3.5">
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
              isDark
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="truncate">
              {isVi ? 'Đã xác thực:' : 'Verified:'}{' '}
              <strong>{maskEmail(verifiedAccount.email)}</strong>
            </span>
          </div>

          <div>
            <label className={labelClass}>
              {isVi ? 'Mật khẩu mới' : 'New Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                maxLength={64}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isVi ? 'Tối thiểu 6 ký tự' : 'Minimum 6 characters'}
                className={inputClass}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-500 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              {isVi ? 'Xác nhận mật khẩu mới' : 'Confirm New Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                maxLength={64}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={isVi ? 'Nhập lại mật khẩu mới' : 'Re-enter new password'}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-500 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>
              {isSubmitting
                ? isVi
                  ? 'Đang lưu mật khẩu...'
                  : 'Saving password...'
                : isVi
                ? 'Đặt lại mật khẩu mới'
                : 'Save New Password'}
            </span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
};
