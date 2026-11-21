import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Compass, Plus, MessageSquare, Globe, ChevronDown, Bell, User, LogOut,
  ChevronRight, KeyRound, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft,
  AlertCircle, CheckCircle2, X, Camera, Loader2
} from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ForgotPasswordFlow } from './ForgotPasswordFlow';
import { PWAInstallButton } from './PWAInstallButton';
import { compressAvatarImage } from '../utils/imageUtils';

interface NavbarProps {
  trips: Trip[];
  activeTrip?: Trip;
  onSelectTrip: (tripId: string) => void;
  onOpenNewTripModal: () => void;
  onOpenAIItineraryModal: () => void;
  onToggleAiChat: () => void;
  isAiChatOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  trips,
  activeTrip,
  onSelectTrip,
  onOpenNewTripModal,
  onToggleAiChat,
  isAiChatOpen,
}) => {
  const { lang, setLang } = useLanguage();
  const {
    userProfile,
    invitations,
    userNotifications,
    setIsAuthModalOpen,
    openAuthModal,
    setIsNotificationsModalOpen,
    changePassword,
    updateUserAvatar,
    logout,
  } = useAuth();

  const notifStorageKey = `tripmate_read_notifs_${userProfile?.id || 'guest'}`;
  const [readNotifKeys, setReadNotifKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(notifStorageKey);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncReadKeys = () => {
      try {
        const saved = localStorage.getItem(notifStorageKey);
        setReadNotifKeys(saved ? (JSON.parse(saved) as string[]) : []);
      } catch {
        setReadNotifKeys([]);
      }
    };
    syncReadKeys();
    window.addEventListener('tripmate_notifs_read_updated', syncReadKeys);
    window.addEventListener('storage', syncReadKeys);
    return () => {
      window.removeEventListener('tripmate_notifs_read_updated', syncReadKeys);
      window.removeEventListener('storage', syncReadKeys);
    };
  }, [notifStorageKey]);

  const totalUnreadNotificationsCount = useMemo(() => {
    const unreadInvs = invitations.filter(
      (i) => i.status === 'pending' && !readNotifKeys.includes(`inv_${i.id}`)
    ).length;
    const unreadTripNotifs = trips.reduce((sum, tr) => {
      const count = (tr.notifications || []).filter(
        (n) => n.status === 'pending' || !readNotifKeys.includes(`notif_${n.id}`)
      ).length;
      return sum + count;
    }, 0);
    const unreadUserNotifs = (userNotifications || []).filter(
      (u) => u.status === 'unread' && !readNotifKeys.includes(`unotif_${u.id}`)
    ).length;
    return unreadInvs + unreadTripNotifs + unreadUserNotifs;
  }, [invitations, trips, userNotifications, readNotifKeys]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileSheetView, setMobileSheetView] = useState<'main' | 'change-password' | 'forgot-password'>('main');

  // Inline Change Password states inside Mobile Avatar Sheet
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [sheetErrorMsg, setSheetErrorMsg] = useState<string | null>(null);
  const [sheetSuccessMsg, setSheetSuccessMsg] = useState<string | null>(null);
  const [isSubmittingPwd, setIsSubmittingPwd] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      setMobileSheetView('main');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSheetErrorMsg(null);
      setSheetSuccessMsg(null);
    }
  }, [isMobileMenuOpen]);

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'vi' : 'en');
  };

  const isVi = lang === 'vi';

  const handleMobileChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSheetErrorMsg(null);
    setSheetSuccessMsg(null);

    if (userProfile?.passwordHash && !currentPassword.trim()) {
      setSheetErrorMsg(isVi ? 'Vui lòng nhập mật khẩu hiện tại.' : 'Please enter your current password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setSheetErrorMsg(isVi ? 'Mật khẩu mới phải có tối thiểu 6 ký tự.' : 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword.trim() !== confirmNewPassword.trim()) {
      setSheetErrorMsg(isVi ? 'Xác nhận mật khẩu mới không khớp.' : 'New password confirmation does not match.');
      return;
    }

    setIsSubmittingPwd(true);
    const res = await changePassword(currentPassword, newPassword);
    setIsSubmittingPwd(false);

    if (!res.success) {
      setSheetErrorMsg(res.message || (isVi ? 'Đổi mật khẩu thất bại.' : 'Failed to change password.'));
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setMobileSheetView('main');
    setSheetSuccessMsg(
      isVi
        ? 'Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật.'
        : 'Password changed successfully!'
    );
  };

  const handleMobileAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSheetErrorMsg(isVi ? 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).' : 'Please select a valid image file.');
      return;
    }
    setSheetErrorMsg(null);
    setSheetSuccessMsg(null);
    setIsUploadingAvatar(true);
    try {
      const compressed = await compressAvatarImage(file, 160, 0.82);
      const res = await updateUserAvatar(compressed);
      if (res.success) {
        setSheetSuccessMsg(
          isVi
            ? 'Đã cập nhật & đồng bộ ảnh đại diện lên banner và chi tiêu!'
            : 'Avatar updated & synced across banner and expenses!'
        );
      } else if (res.message) {
        setSheetErrorMsg(res.message);
      }
    } catch {
      setSheetErrorMsg(isVi ? 'Không thể xử lý ảnh đại diện.' : 'Unable to process avatar image.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 sm:h-14 gap-2">
          
          {/* Left: Brand Logo & Compact Trip Selector */}
          <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
            {/* Logo */}
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>

            <span className="font-display text-base font-extrabold text-slate-900 tracking-tight hidden md:inline shrink-0">
              TripMate
            </span>

            {/* Quick Trip Selector Pill */}
            {trips.length > 0 && activeTrip ? (
              <div className="relative flex items-center min-w-0 max-w-[170px] sm:max-w-[240px]">
                <select
                  value={activeTrip.id}
                  onChange={(e) => onSelectTrip(e.target.value)}
                  className="w-full appearance-none text-xs font-bold text-slate-800 bg-slate-100/90 hover:bg-slate-200/90 active:bg-slate-200 py-1.5 pl-2.5 pr-6 rounded-xl border border-slate-200/70 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer truncate transition-colors"
                  title={activeTrip.title}
                >
                  {trips.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-1.5 pointer-events-none shrink-0" />
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenNewTripModal}
                className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>{isVi ? 'Tạo chuyến' : 'New Trip'}</span>
              </button>
            )}
          </div>

          {/* Right Actions: Clean, spacious, and responsive */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Desktop Only Actions */}
            <div className="hidden sm:flex items-center gap-1.5">
              {/* New Trip Button */}
              <button
                type="button"
                onClick={onOpenNewTripModal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer min-h-[36px]"
                title={isVi ? 'Tạo chuyến đi mới' : 'New Trip'}
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>{isVi ? 'Tạo chuyến đi' : 'New Trip'}</span>
              </button>

              {/* AI Assistant Button */}
              <button
                type="button"
                disabled={!activeTrip}
                onClick={onToggleAiChat}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors min-h-[36px] ${
                  !activeTrip
                    ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : isAiChatOpen
                    ? 'bg-teal-50 text-teal-800 border-teal-300 cursor-pointer'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                }`}
                title={
                  !activeTrip
                    ? isVi
                      ? 'Hãy tạo hoặc tham gia chuyến đi để dùng Trợ lý AI'
                      : 'Create or join a trip to use AI Assistant'
                    : isVi
                    ? 'Mở trợ lý AI'
                    : 'Open AI Assistant'
                }
              >
                <MessageSquare className={`w-3.5 h-3.5 ${!activeTrip ? 'text-slate-400' : 'text-teal-600'}`} />
                <span>{isVi ? 'Trợ lý AI' : 'AI Assistant'}</span>
              </button>

              {/* Language Switcher Desktop */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer min-h-[36px]"
                title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
              >
                <Globe className="w-3.5 h-3.5 text-teal-600" />
                <span>{isVi ? 'Vietnamese' : 'English'}</span>
              </button>
            </div>

            {/* Notification Bell (Both Mobile & Desktop) */}
            <button
              type="button"
              onClick={() => setIsNotificationsModalOpen(true)}
              className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              title={isVi ? `Thông báo (${totalUnreadNotificationsCount} mới)` : `Notifications (${totalUnreadNotificationsCount} unread)`}
            >
              <Bell className="w-4 h-4 text-slate-700" />
              {totalUnreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[9px] font-extrabold text-white shadow-xs animate-pulse">
                  {totalUnreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Desktop User Profile Button */}
            {userProfile ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openAuthModal('profile')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-teal-50 hover:bg-teal-100/80 text-teal-900 border border-teal-200 transition-colors cursor-pointer min-h-[36px]"
                  title={userProfile.displayName}
                >
                  <img
                    src={userProfile.avatar}
                    alt={userProfile.displayName}
                    className="w-6 h-6 rounded-full object-cover border border-teal-400 shrink-0"
                  />
                  <span className="max-w-[110px] truncate font-bold text-teal-900">
                    {userProfile.displayName}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                  }}
                  className="inline-flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer min-h-[36px]"
                  title={isVi ? 'Đăng xuất' : 'Sign Out'}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer min-h-[36px]"
              >
                <User className="w-3.5 h-3.5" />
                <span>{isVi ? 'Đăng nhập' : 'Sign In'}</span>
              </button>
            )}

            {/* Mobile Only: Avatar / Account Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer overflow-hidden shadow-2xs"
              title={isVi ? 'Tài khoản & Tùy chọn' : 'Account & Menu'}
            >
              {userProfile ? (
                <img
                  src={userProfile.avatar}
                  alt={userProfile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-slate-700" />
              )}
            </button>

          </div>

        </div>
      </div>

      {/* Mobile Avatar Sheet: Direct Account Info + Inline Change Password + Quick Actions */}
      {isMobileMenuOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end sm:hidden animate-in fade-in duration-150"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl border-t border-slate-200/90 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-200 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle & Top Header */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto -mt-1" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {mobileSheetView === 'change-password'
                    ? isVi
                      ? 'Đổi Mật Khẩu Tài Khoản'
                      : 'Change Password'
                    : mobileSheetView === 'forgot-password'
                    ? isVi
                      ? 'Khôi Phục Mật Khẩu'
                      : 'Reset Password'
                    : isVi
                    ? 'Tài Khoản TripMate'
                    : 'TripMate Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Toasts */}
            {sheetErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{sheetErrorMsg}</span>
              </div>
            )}
            {sheetSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{sheetSuccessMsg}</span>
              </div>
            )}

            {/* Full TripMate Account Info Card (always visible directly outside in main & change-password views) */}
            {mobileSheetView !== 'forgot-password' && (
              <div className="p-3.5 bg-teal-50/80 rounded-2xl border border-teal-200 flex items-center gap-3">
                {userProfile ? (
                  <>
                    <label className="relative shrink-0 cursor-pointer group" title={isVi ? 'Thêm / Đổi ảnh đại diện' : 'Add / Change avatar'}>
                      <img
                        src={userProfile.avatar}
                        alt={userProfile.displayName}
                        className="w-14 h-14 rounded-full object-cover border-2 border-teal-500 shadow-xs"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-teal-600 text-white border-2 border-white flex items-center justify-center shadow-xs">
                        {isUploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingAvatar}
                        onChange={handleMobileAvatarChange}
                        className="hidden"
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-extrabold text-slate-900 truncate">
                        {userProfile.displayName}
                      </div>
                      <div className="text-xs text-slate-600 truncate flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{userProfile.email}</span>
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
                  </>
                ) : (
                  <div
                    onClick={() => {
                      openAuthModal('profile');
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-between w-full cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900">
                          {isVi ? 'Khách du lịch' : 'Guest Traveler'}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {isVi ? 'Chạm để đăng nhập hoặc đăng ký →' : 'Tap to sign in or register →'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-teal-700 shrink-0" />
                  </div>
                )}
              </div>
            )}

            {/* VIEW 1: MAIN ACCOUNT & QUICK ACTIONS */}
            {mobileSheetView === 'main' && (
              <div className="space-y-1.5">
                {/* 2. New Trip */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenNewTripModal();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left cursor-pointer border border-transparent hover:border-slate-200/60"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shrink-0 shadow-xs">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      {isVi ? 'Tạo chuyến đi mới' : 'Create New Trip'}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>

                {/* 3. AI Assistant Chat */}
                {activeTrip && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleAiChat();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-teal-50/60 active:bg-teal-100/60 transition-colors text-left cursor-pointer border border-transparent hover:border-teal-200/60"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0 shadow-2xs">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{isVi ? 'Trợ lý du lịch AI' : 'AI Travel Assistant'}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-teal-100 text-teal-800">
                          Gemini
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isVi ? 'Hỏi đáp địa điểm, văn hóa, ẩm thực' : 'Ask about local spots, tips & culture'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                )}

                {/* 4. Add to Home Screen (iOS, Android, Windows) for logged-in users */}
                {userProfile && <PWAInstallButton variant="sheet-row" />}

                {/* 5. Language Switcher */}
                <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white text-slate-600 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                      <Globe className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {isVi ? 'Ngôn ngữ hiển thị' : 'App Language'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setLang('vi')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isVi
                          ? 'bg-white text-teal-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Vietnamese
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                        !isVi
                          ? 'bg-white text-teal-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* 6. Change Password (directly above Sign Out) */}
                {userProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSheetErrorMsg(null);
                      setSheetSuccessMsg(null);
                      setMobileSheetView('change-password');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-teal-50/50 hover:bg-teal-50 active:bg-teal-100/70 transition-colors text-left cursor-pointer border border-teal-200/70"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900">{isVi ? 'Đổi mật khẩu' : 'Change Password'}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {isVi ? 'Đổi mật khẩu hoặc khôi phục khi quên' : 'Update or reset password'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-teal-600 shrink-0" />
                  </button>
                )}

                {/* 7. Sign Out (if logged in) */}
                {userProfile && (
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-50 active:bg-rose-100/60 transition-colors text-left cursor-pointer text-rose-700 border border-transparent hover:border-rose-200/60"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold">{isVi ? 'Đăng xuất' : 'Sign Out'}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-rose-300 shrink-0" />
                  </button>
                )}

                {/* Close Sheet Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isVi ? 'Đóng' : 'Close'}
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 2: INLINE CHANGE PASSWORD FORM + FORGOT PASSWORD LINK */}
            {mobileSheetView === 'change-password' && userProfile && (
              <form onSubmit={handleMobileChangePassword} className="space-y-3.5 animate-in fade-in duration-150">
                {userProfile.passwordHash ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        {isVi ? 'Mật khẩu hiện tại' : 'Current Password'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSheetErrorMsg(null);
                          setSheetSuccessMsg(null);
                          setMobileSheetView('forgot-password');
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
                        className="w-full pl-9 pr-10 py-2.5 text-sm sm:text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                        setSheetErrorMsg(null);
                        setSheetSuccessMsg(null);
                        setMobileSheetView('forgot-password');
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
                      className="w-full pl-9 pr-10 py-2.5 text-sm sm:text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      className="w-full pl-9 pr-10 py-2.5 text-sm sm:text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSheetErrorMsg(null);
                      setMobileSheetView('main');
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Quay lại' : 'Back'}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPwd}
                    className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingPwd
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

            {/* VIEW 3: INLINE FORGOT PASSWORD FLOW INSIDE MOBILE AVATAR SHEET */}
            {mobileSheetView === 'forgot-password' && userProfile && (
              <ForgotPasswordFlow
                theme="light"
                initialAccount={userProfile}
                onBack={() => {
                  setSheetErrorMsg(null);
                  setMobileSheetView('change-password');
                }}
                onSuccess={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setMobileSheetView('main');
                  setSheetSuccessMsg(
                    isVi
                      ? 'Đã khôi phục và đặt lại mật khẩu mới thành công!'
                      : 'Password has been reset successfully!'
                  );
                }}
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
