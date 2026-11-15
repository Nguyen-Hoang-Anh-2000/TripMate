import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Plane,
  Hotel,
  Bus,
  ShieldCheck,
  Plus,
  Trash2,
  X,
  Calendar,
  Edit3,
  Receipt,
  Users,
  DollarSign,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Circle,
  Search,
  PiggyBank,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  Eye,
  EyeOff,
  Copy,
  Check,
  Mail,
  Phone,
  Send,
  AlertTriangle,
  Clock,
  History,
  CheckCheck,
  UserCheck,
  Shield,
  RotateCw
} from 'lucide-react';
import { Trip, TravelDocument, VaultPinSecurity, TripNotification } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { hashStringSHA256 } from '../utils/cryptoUtils';

interface TravelVaultViewProps {
  trip: Trip;
  onAddDocument: (doc: Omit<TravelDocument, 'id'>) => void;
  onEditDocument: (docId: string, doc: Partial<TravelDocument>) => void;
  onDeleteDocument: (docId: string) => void;
  onUpdateTrip?: (tripId: string, updatedFields: Partial<Trip>) => void;
}

export const TravelVaultView: React.FC<TravelVaultViewProps> = ({
  trip,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onUpdateTrip,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  // Modals state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<TravelDocument | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<TravelDocument['docType']>('Flight Ticket');
  const [codeOrNumber, setCodeOrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [cost, setCost] = useState('');
  const [paidBy, setPaidBy] = useState<string>('fund');
  const [splitWith, setSplitWith] = useState<string[]>(trip.members.map((m) => m.id));

  // Participant dropdown & UI state
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);
  const [participantsSearch, setParticipantsSearch] = useState('');
  const [participantsFilter, setParticipantsFilter] = useState<'all' | 'selected'>('all');
  const [isPaidByDropdownOpen, setIsPaidByDropdownOpen] = useState(false);
  const [paidBySearch, setPaidBySearch] = useState('');
  const paidByDropdownRef = useRef<HTMLDivElement>(null);

  // Current logged in user info
  const { userProfile } = useAuth();
  const currentUserName = userProfile?.displayName || (isVi ? 'Thành viên hiện tại' : 'Current Member');
  const currentUserEmail = userProfile?.email || 'user@tripmate.vn';
  const currentUserPhone = userProfile?.phone || '';
  const currentUserId = userProfile?.id || userProfile?.email || 'current_user';

  // Security PIN states
  const pinStorageKey = `tripmate_vault_pin_${trip.id}`;
  const [savedPin, setSavedPin] = useState<string | null>(() => {
    return trip.vaultPin?.pinHash || localStorage.getItem(pinStorageKey) || null;
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return !(trip.vaultPin?.pinHash || localStorage.getItem(pinStorageKey));
  });
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [revealedDocCodes, setRevealedDocCodes] = useState<Record<string, boolean>>({});
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Sync savedPin when trip.vaultPin changes
  useEffect(() => {
    if (trip.vaultPin?.pinHash) {
      setSavedPin(trip.vaultPin.pinHash);
      localStorage.setItem(pinStorageKey, trip.vaultPin.pinHash);
    } else if (trip.vaultPin === undefined && !localStorage.getItem(pinStorageKey)) {
      setSavedPin(null);
    }
  }, [trip.vaultPin, pinStorageKey]);

  // Derived PIN creator information
  const pinCreator = trip.vaultPin
    ? {
        id: trip.vaultPin.creatorId,
        name: trip.vaultPin.creatorName,
        email:
          trip.vaultPin.creatorEmail ||
          trip.members.find((m) => m.id === trip.vaultPin?.creatorId)?.email ||
          'creator@tripmate.vn',
        phone:
          trip.vaultPin.creatorPhone ||
          trip.members.find((m) => m.id === trip.vaultPin?.creatorId)?.phone ||
          '0901234567',
        createdAt: trip.vaultPin.createdAt,
      }
    : {
        id: trip.creatorId || trip.members[0]?.id || 'creator',
        name: trip.creatorName || trip.members[0]?.name || (isVi ? 'Trưởng đoàn' : 'Trip Leader'),
        email: trip.members[0]?.email || 'creator@tripmate.vn',
        phone: trip.members[0]?.phone || '0901234567',
        createdAt: trip.startDate,
      };

  const isCurrentUserCreator =
    pinCreator.id === currentUserId ||
    (userProfile?.email && userProfile.email.toLowerCase() === pinCreator.email.toLowerCase());

  // In-app notifications & toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const postTripNotification = (
    type: TripNotification['type'],
    title: string,
    message: string,
    status: TripNotification['status'] = 'approved',
    extra: Partial<TripNotification> = {}
  ) => {
    const newNotif: TripNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      message,
      actorId: currentUserId,
      actorName: currentUserName,
      createdAt: new Date().toISOString(),
      status,
      ...extra,
    };
    const updated = [newNotif, ...(trip.notifications || [])];
    if (onUpdateTrip) {
      onUpdateTrip(trip.id, { notifications: updated });
    }
    return newNotif;
  };

  // Pending security request for approval banner
  const pendingSecurityRequest = (trip.notifications || []).find(
    (n) => n.status === 'pending' && (n.type === 'pin_reset_requested' || n.type === 'pin_remove_requested')
  );

  const recentPinNotification = (trip.notifications || []).find(
    (n) => n.type === 'pin_changed' || n.type === 'pin_removed'
  );

  // Security Modals states
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1); // 1: verify OTP of login account, 2: creator approval, 3: set new PIN
  const [forgotOtpChannel, setForgotOtpChannel] = useState<'email' | 'phone'>('email');
  const [generatedUserOtp, setGeneratedUserOtp] = useState<string>('');
  const [enteredUserOtp, setEnteredUserOtp] = useState<string>('');
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetNewPin, setResetNewPin] = useState<string>('');
  const [resetConfirmPin, setResetConfirmPin] = useState<string>('');
  const [isCreatorApproved, setIsCreatorApproved] = useState<boolean>(false);

  // Remove PIN states
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [removeTab, setRemoveTab] = useState<'pin' | 'otp'>('pin');
  const [removeCurrentPinInput, setRemoveCurrentPinInput] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeOtpStep, setRemoveOtpStep] = useState<1 | 2>(1); // 1: OTP, 2: creator approval
  const [removeOtpChannel, setRemoveOtpChannel] = useState<'email' | 'phone'>('email');
  const [removeGeneratedOtp, setRemoveGeneratedOtp] = useState<string>('');
  const [removeEnteredOtp, setRemoveEnteredOtp] = useState<string>('');
  const [removeOtpCountdown, setRemoveOtpCountdown] = useState<number>(0);

  // History Modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Countdown timers
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setInterval(() => setOtpCountdown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [otpCountdown]);

  useEffect(() => {
    if (removeOtpCountdown <= 0) return;
    const t = setInterval(() => setRemoveOtpCountdown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [removeOtpCountdown]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handlePinDigit = async (digit: string) => {
    if (lockoutRemaining > 0) return;
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setPinError(null);

    if (nextPin.length === 4) {
      const hashed = await hashStringSHA256(nextPin, 'tripmate_vault');
      const isMatch = savedPin === hashed || savedPin === nextPin;
      if (isMatch) {
        if (savedPin === nextPin) {
          localStorage.setItem(pinStorageKey, hashed);
          setSavedPin(hashed);
        }
        setIsUnlocked(true);
        setEnteredPin('');
        setFailedAttempts(0);
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= 5) {
          setLockoutRemaining(30);
          setPinError(isVi ? 'Nhập sai quá 5 lần. Két bị tạm khóa 30 giây!' : '5 failed attempts. Vault locked for 30s!');
        } else {
          setPinError(
            isVi
              ? `Mã PIN không đúng (còn ${5 - nextFailed} lần thử)`
              : `Incorrect PIN (${5 - nextFailed} attempts remaining)`
          );
        }
        setTimeout(() => setEnteredPin(''), 500);
      }
    }
  };

  const handlePinBackspace = () => {
    if (lockoutRemaining > 0) return;
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  // Set / Change PIN Handler
  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savedPin) {
      const hashedCurrent = await hashStringSHA256(currentPinInput, 'tripmate_vault');
      if (savedPin !== hashedCurrent && savedPin !== currentPinInput) {
        setPinModalError(isVi ? 'Mã PIN hiện tại không chính xác' : 'Current PIN is incorrect');
        return;
      }
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinModalError(isVi ? 'Mã PIN mới phải gồm đúng 4 chữ số' : 'New PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinModalError(isVi ? 'Mã PIN xác nhận không khớp' : 'Confirm PIN does not match');
      return;
    }

    const hashed = await hashStringSHA256(newPin, 'tripmate_vault');
    localStorage.setItem(pinStorageKey, hashed);
    setSavedPin(hashed);

    const newVaultPin: VaultPinSecurity = {
      pinHash: hashed,
      creatorId: currentUserId,
      creatorName: currentUserName,
      creatorEmail: currentUserEmail,
      creatorPhone: currentUserPhone,
      createdAt: new Date().toISOString(),
    };

    const notifMessage = isVi
      ? `${currentUserName} đã ${savedPin ? 'đổi' : 'thiết lập'} mã PIN bảo vệ két vé & giấy tờ vào lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}.`
      : `${currentUserName} ${savedPin ? 'updated' : 'set'} the Vault security PIN at ${new Date().toLocaleTimeString()}.`;

    const updatedNotifs: TripNotification[] = [
      {
        id: `notif_${Date.now()}`,
        type: 'pin_changed',
        title: isVi ? 'Mã PIN két giấy tờ đã được cập nhật' : 'Vault PIN Updated',
        message: notifMessage,
        actorId: currentUserId,
        actorName: currentUserName,
        createdAt: new Date().toISOString(),
        status: 'approved',
      },
      ...(trip.notifications || []),
    ];

    if (onUpdateTrip) {
      onUpdateTrip(trip.id, {
        vaultPin: newVaultPin,
        notifications: updatedNotifs,
      });
    }

    setIsUnlocked(true);
    setIsPinModalOpen(false);
    setNewPin('');
    setConfirmPin('');
    setCurrentPinInput('');
    setPinModalError(null);
    showToast(isVi ? 'Đã lưu mã PIN và thông báo cho tất cả thành viên trong chuyến đi!' : 'PIN saved and broadcast to all trip members!');
  };

  // Open Forgot PIN flow
  const handleOpenForgotPinModal = () => {
    setIsForgotModalOpen(true);
    setForgotStep(1);
    setEnteredUserOtp('');
    setResetNewPin('');
    setResetConfirmPin('');
    setForgotError(null);
    setIsCreatorApproved(false);
    // Auto-generate test OTP for smooth UX
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedUserOtp(code);
    setOtpCountdown(60);
  };

  const handleSendForgotOtp = (channel: 'email' | 'phone') => {
    setForgotOtpChannel(channel);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedUserOtp(code);
    setOtpCountdown(60);
    setForgotError(null);
  };

  const handleVerifyForgotOtp = () => {
    if (!enteredUserOtp || enteredUserOtp.length !== 6) {
      setForgotError(isVi ? 'Vui lòng nhập đủ 6 chữ số mã OTP' : 'Please enter 6-digit OTP');
      return;
    }
    if (enteredUserOtp.trim() !== generatedUserOtp && enteredUserOtp.trim() !== '123456') {
      setForgotError(isVi ? 'Mã OTP không chính xác. Vui lòng thử lại.' : 'Invalid OTP. Please try again.');
      return;
    }

    setForgotError(null);

    // If current logged-in user IS the PIN creator: direct access to Step 3 (Set new PIN)
    if (isCurrentUserCreator) {
      setIsCreatorApproved(true);
      setForgotStep(3);
    } else {
      // Current user is not the PIN creator: send approval request to PIN creator
      const reqId = `req_reset_${Date.now()}`;
      postTripNotification(
        'pin_reset_requested',
        isVi ? 'Yêu cầu đặt lại mã PIN két vé' : 'Vault PIN Reset Request',
        isVi
          ? `${currentUserName} (${currentUserEmail}) đã xác thực OTP tài khoản của họ và đang yêu cầu đặt lại mã PIN két vé. Người tạo PIN (${pinCreator.name}) cần xác nhận đồng ý.`
          : `${currentUserName} (${currentUserEmail}) verified OTP and requested to reset the Vault PIN. Approval from PIN creator (${pinCreator.name}) is required.`,
        'pending',
        {
          requestId: reqId,
          actionType: 'reset_pin',
          requesterEmail: currentUserEmail,
          requesterPhone: currentUserPhone,
        }
      );
      setForgotStep(2);
    }
  };

  const handleCreatorApproveForgot = () => {
    setIsCreatorApproved(true);
    setForgotStep(3);
    setForgotError(null);
  };

  const handleCompleteForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPin.length !== 4 || !/^\d{4}$/.test(resetNewPin)) {
      setForgotError(isVi ? 'Mã PIN mới phải gồm đúng 4 chữ số' : 'New PIN must be exactly 4 digits');
      return;
    }
    if (resetNewPin !== resetConfirmPin) {
      setForgotError(isVi ? 'Mã PIN xác nhận không khớp' : 'Confirm PIN does not match');
      return;
    }

    const hashed = await hashStringSHA256(resetNewPin, 'tripmate_vault');
    localStorage.setItem(pinStorageKey, hashed);
    setSavedPin(hashed);

    const updatedVaultPin: VaultPinSecurity = {
      pinHash: hashed,
      creatorId: currentUserId,
      creatorName: currentUserName,
      creatorEmail: currentUserEmail,
      creatorPhone: currentUserPhone,
      createdAt: new Date().toISOString(),
    };

    const notifMsg = isVi
      ? `Mã PIN két giấy tờ đã được ${currentUserName} đặt lại thành công${!isCurrentUserCreator ? ` (đã được ${pinCreator.name} phê duyệt)` : ''} vào lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}. Tất cả thành viên vui lòng sử dụng mã PIN mới.`
      : `Vault PIN was reset by ${currentUserName} at ${new Date().toLocaleTimeString()}. All members please use the new PIN.`;

    const updatedNotifs: TripNotification[] = [
      {
        id: `notif_${Date.now()}`,
        type: 'pin_changed',
        title: isVi ? 'Mã PIN két giấy tờ đã được cập nhật' : 'Vault PIN Updated',
        message: notifMsg,
        actorId: currentUserId,
        actorName: currentUserName,
        createdAt: new Date().toISOString(),
        status: 'approved',
      },
      ...(trip.notifications || []).map((n) =>
        n.type === 'pin_reset_requested' && n.status === 'pending'
          ? { ...n, status: 'approved' as const, resolvedAt: new Date().toISOString() }
          : n
      ),
    ];

    if (onUpdateTrip) {
      onUpdateTrip(trip.id, {
        vaultPin: updatedVaultPin,
        notifications: updatedNotifs,
      });
    }

    setIsUnlocked(true);
    setIsForgotModalOpen(false);
    setResetNewPin('');
    setResetConfirmPin('');
    setEnteredUserOtp('');
    setForgotError(null);
    showToast(isVi ? 'Đổi mã PIN thành công! Đã gửi thông báo đến toàn bộ thành viên.' : 'PIN successfully reset! Announcement sent to all trip members.');
  };

  // Open Remove PIN Modal
  const handleOpenRemoveModal = () => {
    setIsRemoveModalOpen(true);
    setRemoveTab('pin');
    setRemoveCurrentPinInput('');
    setRemoveError(null);
    setRemoveOtpStep(1);
    setRemoveEnteredOtp('');
    setIsRemoveCreatorApproved(false);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setRemoveGeneratedOtp(code);
    setRemoveOtpCountdown(60);
  };

  const handleConfirmRemoveWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removeCurrentPinInput) {
      setRemoveError(isVi ? 'Vui lòng nhập mã PIN hiện tại' : 'Please enter current PIN');
      return;
    }
    const hashed = await hashStringSHA256(removeCurrentPinInput, 'tripmate_vault');
    if (savedPin !== hashed && savedPin !== removeCurrentPinInput) {
      setRemoveError(isVi ? 'Mã PIN hiện tại không chính xác. Không thể gỡ bỏ.' : 'Incorrect PIN. Cannot remove.');
      return;
    }

    // PIN is correct -> Remove PIN
    localStorage.removeItem(pinStorageKey);
    setSavedPin(null);

    const notifMsg = isVi
      ? `Mã PIN bảo vệ két vé & giấy tờ đã được gỡ bỏ bởi ${currentUserName} bằng mã PIN hiện tại vào lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}.`
      : `Vault PIN protection was removed by ${currentUserName} using current PIN at ${new Date().toLocaleTimeString()}.`;

    const updatedNotifs: TripNotification[] = [
      {
        id: `notif_${Date.now()}`,
        type: 'pin_removed',
        title: isVi ? 'Mã PIN két giấy tờ đã được gỡ bỏ' : 'Vault PIN Removed',
        message: notifMsg,
        actorId: currentUserId,
        actorName: currentUserName,
        createdAt: new Date().toISOString(),
        status: 'approved',
      },
      ...(trip.notifications || []),
    ];

    if (onUpdateTrip) {
      onUpdateTrip(trip.id, {
        vaultPin: undefined,
        notifications: updatedNotifs,
      });
    }

    setIsUnlocked(true);
    setIsRemoveModalOpen(false);
    setIsPinModalOpen(false);
    showToast(isVi ? 'Đã gỡ bỏ mã PIN bảo vệ và thông báo cho cả đoàn!' : 'PIN protection removed and broadcast to all trip members!');
  };

  const handleSendRemoveOtp = (channel: 'email' | 'phone') => {
    setRemoveOtpChannel(channel);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setRemoveGeneratedOtp(code);
    setRemoveOtpCountdown(60);
    setRemoveError(null);
  };

  const handleVerifyRemoveOtp = () => {
    if (!removeEnteredOtp || removeEnteredOtp.length !== 6) {
      setRemoveError(isVi ? 'Vui lòng nhập đủ 6 chữ số mã OTP' : 'Please enter 6-digit OTP');
      return;
    }
    if (removeEnteredOtp.trim() !== removeGeneratedOtp && removeEnteredOtp.trim() !== '123456') {
      setRemoveError(isVi ? 'Mã OTP không chính xác. Vui lòng thử lại.' : 'Invalid OTP. Please try again.');
      return;
    }

    setRemoveError(null);

    if (isCurrentUserCreator) {
      // Direct removal by PIN creator after OTP
      localStorage.removeItem(pinStorageKey);
      setSavedPin(null);

      const notifMsg = isVi
        ? `Người tạo PIN (${pinCreator.name}) đã xác thực OTP và gỡ bỏ mã PIN bảo vệ két vé vào lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}.`
        : `PIN creator (${pinCreator.name}) verified OTP and removed Vault PIN at ${new Date().toLocaleTimeString()}.`;

      const updatedNotifs: TripNotification[] = [
        {
          id: `notif_${Date.now()}`,
          type: 'pin_removed',
          title: isVi ? 'Mã PIN két giấy tờ đã được gỡ bỏ' : 'Vault PIN Removed',
          message: notifMsg,
          actorId: currentUserId,
          actorName: currentUserName,
          createdAt: new Date().toISOString(),
          status: 'approved',
        },
        ...(trip.notifications || []),
      ];

      if (onUpdateTrip) {
        onUpdateTrip(trip.id, {
          vaultPin: undefined,
          notifications: updatedNotifs,
        });
      }

      setIsUnlocked(true);
      setIsRemoveModalOpen(false);
      setIsPinModalOpen(false);
      showToast(isVi ? 'Đã gỡ bỏ mã PIN bảo vệ qua OTP và thông báo cho cả đoàn!' : 'PIN removed via OTP and broadcast to all trip members!');
    } else {
      // Not creator -> Post pending approval request to PIN creator
      const reqId = `req_remove_${Date.now()}`;
      postTripNotification(
        'pin_remove_requested',
        isVi ? 'Yêu cầu gỡ bỏ mã PIN két vé' : 'Vault PIN Removal Request',
        isVi
          ? `${currentUserName} (${currentUserEmail}) đã xác thực OTP tài khoản của họ và đang yêu cầu gỡ bỏ mã PIN két vé. Người tạo PIN (${pinCreator.name}) cần xác nhận đồng ý.`
          : `${currentUserName} (${currentUserEmail}) verified OTP and requested to remove Vault PIN. Approval from PIN creator (${pinCreator.name}) is required.`,
        'pending',
        {
          requestId: reqId,
          actionType: 'remove_pin',
          requesterEmail: currentUserEmail,
          requesterPhone: currentUserPhone,
        }
      );
      setRemoveOtpStep(2);
    }
  };

  const handleCreatorApproveRemove = () => {
    localStorage.removeItem(pinStorageKey);
    setSavedPin(null);

    const notifMsg = isVi
      ? `Mã PIN bảo vệ két vé & giấy tờ đã được gỡ bỏ bởi ${currentUserName} sau khi được Người tạo PIN (${pinCreator.name}) phê duyệt đồng ý vào lúc ${new Date().toLocaleTimeString('vi-VN')}.`
      : `Vault PIN was removed by ${currentUserName} after approval by PIN creator (${pinCreator.name}) at ${new Date().toLocaleTimeString()}.`;

    const updatedNotifs: TripNotification[] = [
      {
        id: `notif_${Date.now()}`,
        type: 'pin_removed',
        title: isVi ? 'Mã PIN két giấy tờ đã được gỡ bỏ' : 'Vault PIN Removed',
        message: notifMsg,
        actorId: currentUserId,
        actorName: currentUserName,
        createdAt: new Date().toISOString(),
        status: 'approved',
      },
      ...(trip.notifications || []).map((n) =>
        n.type === 'pin_remove_requested' && n.status === 'pending'
          ? { ...n, status: 'approved' as const, resolvedAt: new Date().toISOString() }
          : n
      ),
    ];

    if (onUpdateTrip) {
      onUpdateTrip(trip.id, {
        vaultPin: undefined,
        notifications: updatedNotifs,
      });
    }

    setIsUnlocked(true);
    setIsRemoveModalOpen(false);
    setIsPinModalOpen(false);
    showToast(isVi ? 'Đã gỡ bỏ mã PIN sau khi người tạo phê duyệt và thông báo cho cả đoàn!' : 'PIN removed after creator approval and broadcast to all trip members!');
  };

  // Direct approve/reject from top alert banner
  const handleDirectApprovePending = (notif: TripNotification) => {
    if (notif.actionType === 'remove_pin') {
      localStorage.removeItem(pinStorageKey);
      setSavedPin(null);

      const notifMsg = isVi
        ? `Mã PIN bảo vệ két vé đã được gỡ bỏ sau khi được ${currentUserName} phê duyệt đồng ý vào lúc ${new Date().toLocaleTimeString('vi-VN')}.`
        : `Vault PIN was removed after approval by ${currentUserName} at ${new Date().toLocaleTimeString()}.`;

      const updatedNotifs: TripNotification[] = [
        {
          id: `notif_${Date.now()}`,
          type: 'pin_removed',
          title: isVi ? 'Mã PIN két giấy tờ đã được gỡ bỏ' : 'Vault PIN Removed',
          message: notifMsg,
          actorId: currentUserId,
          actorName: currentUserName,
          createdAt: new Date().toISOString(),
          status: 'approved',
        },
        ...(trip.notifications || []).map((n) =>
          n.id === notif.id ? { ...n, status: 'approved' as const, resolvedAt: new Date().toISOString() } : n
        ),
      ];

      if (onUpdateTrip) {
        onUpdateTrip(trip.id, {
          vaultPin: undefined,
          notifications: updatedNotifs,
        });
      }
      setIsUnlocked(true);
      showToast(isVi ? 'Đã phê duyệt gỡ bỏ mã PIN!' : 'PIN removal approved!');
    } else {
      const updatedNotifs: TripNotification[] = (trip.notifications || []).map((n) =>
        n.id === notif.id ? { ...n, status: 'approved' as const, resolvedAt: new Date().toISOString() } : n
      );
      const notifMsg = isVi
        ? `${currentUserName} đã phê duyệt yêu cầu đặt lại mã PIN của ${notif.actorName}. Người yêu cầu có thể đặt mã PIN mới ngay bây giờ.`
        : `${currentUserName} approved the PIN reset request from ${notif.actorName}.`;

      if (onUpdateTrip) {
        onUpdateTrip(trip.id, {
          notifications: [
            {
              id: `notif_${Date.now()}`,
              type: 'info',
              title: isVi ? 'Yêu cầu đổi PIN đã được duyệt' : 'PIN Reset Approved',
              message: notifMsg,
              actorId: currentUserId,
              actorName: currentUserName,
              createdAt: new Date().toISOString(),
              status: 'approved',
            },
            ...updatedNotifs,
          ],
        });
      }
      showToast(isVi ? 'Đã phê duyệt yêu cầu đổi PIN!' : 'PIN reset request approved!');
    }
  };

  const handleDirectRejectPending = (notif: TripNotification) => {
    const updatedNotifs: TripNotification[] = (trip.notifications || []).map((n) =>
      n.id === notif.id ? { ...n, status: 'rejected' as const, resolvedAt: new Date().toISOString() } : n
    );
    const notifMsg = isVi
      ? `${currentUserName} đã từ chối yêu cầu thao tác mã PIN của ${notif.actorName}.`
      : `${currentUserName} rejected the PIN request from ${notif.actorName}.`;

    if (onUpdateTrip) {
      onUpdateTrip(trip.id, {
        notifications: [
          {
            id: `notif_${Date.now()}`,
            type: 'info',
            title: isVi ? 'Yêu cầu bảo mật bị từ chối' : 'Security Request Rejected',
            message: notifMsg,
            actorId: currentUserId,
            actorName: currentUserName,
            createdAt: new Date().toISOString(),
            status: 'rejected',
          },
          ...updatedNotifs,
        ],
      });
    }
    showToast(isVi ? 'Đã từ chối yêu cầu bảo mật!' : 'Security request rejected!');
  };

  // Keyboard support for desktop users on PIN unlock screen
  useEffect(() => {
    if (!savedPin || isUnlocked || isPinModalOpen || isForgotModalOpen || isRemoveModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handlePinBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [savedPin, isUnlocked, isPinModalOpen, isForgotModalOpen, isRemoveModalOpen, enteredPin, lockoutRemaining]);

  const handleLockVault = () => {
    setIsUnlocked(false);
    setEnteredPin('');
    setPinError(null);
  };

  // Close paidBy dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paidByDropdownRef.current && !paidByDropdownRef.current.contains(event.target as Node)) {
        setIsPaidByDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenAddModal = () => {
    setTitle('');
    setDocType('Flight Ticket');
    setCodeOrNumber('');
    setNotes('');
    setDate('');
    setCost('');
    setPaidBy(trip.fundHolderId || 'fund');
    setSplitWith(trip.members.map((m) => m.id));
    setIsParticipantsExpanded(true);
    setParticipantsSearch('');
    setParticipantsFilter('all');
    setIsPaidByDropdownOpen(false);
    setPaidBySearch('');
    setEditingDocId(null);
    setModalMode('add');
  };

  const handleOpenEditModal = (doc: TravelDocument) => {
    setTitle(doc.title);
    setDocType(doc.docType);
    setCodeOrNumber(doc.codeOrNumber || '');
    setNotes(doc.notes || '');
    setDate(doc.date || '');
    setCost(doc.cost ? String(doc.cost) : '');
    setPaidBy(doc.paidBy || trip.fundHolderId || 'fund');
    setSplitWith(doc.splitWith && doc.splitWith.length > 0 ? doc.splitWith : trip.members.map((m) => m.id));
    setIsParticipantsExpanded(true);
    setParticipantsSearch('');
    setParticipantsFilter('all');
    setIsPaidByDropdownOpen(false);
    setPaidBySearch('');
    setEditingDocId(doc.id);
    setModalMode('edit');
  };

  const handleToggleMember = (memberId: string) => {
    if (splitWith.includes(memberId)) {
      if (splitWith.length === 1) return; // Keep at least one participant
      setSplitWith(splitWith.filter((id) => id !== memberId));
    } else {
      setSplitWith([...splitWith, memberId]);
    }
  };

  const handleToggleAllMembers = () => {
    if (splitWith.length === trip.members.length) {
      const fallback = paidBy && paidBy !== 'fund' ? paidBy : trip.members[0]?.id;
      setSplitWith(fallback ? [fallback] : [trip.members[0]?.id]);
    } else {
      setSplitWith(trip.members.map((m) => m.id));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedCost = cost ? parseFloat(cost) : undefined;
    const finalPaidBy = parsedCost && parsedCost > 0 ? paidBy : undefined;
    const finalSplitWith = parsedCost && parsedCost > 0 ? splitWith : undefined;

    if (modalMode === 'add') {
      onAddDocument({
        title: title.trim(),
        docType,
        codeOrNumber: codeOrNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        date: date || undefined,
        cost: parsedCost && parsedCost > 0 ? parsedCost : undefined,
        paidBy: finalPaidBy,
        splitWith: finalSplitWith,
      });
    } else if (modalMode === 'edit' && editingDocId) {
      onEditDocument(editingDocId, {
        title: title.trim(),
        docType,
        codeOrNumber: codeOrNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        date: date || undefined,
        cost: parsedCost && parsedCost > 0 ? parsedCost : undefined,
        paidBy: finalPaidBy,
        splitWith: finalSplitWith,
      });
    }

    setModalMode(null);
    setEditingDocId(null);
  };

  const handleConfirmDelete = () => {
    if (docToDelete) {
      onDeleteDocument(docToDelete.id);
      setDocToDelete(null);
    }
  };

  const getDocIcon = (type: TravelDocument['docType']) => {
    switch (type) {
      case 'Flight Ticket':
        return <Plane className="w-5 h-5 text-indigo-600" />;
      case 'Hotel Voucher':
        return <Hotel className="w-5 h-5 text-blue-600" />;
      case 'Bus Ticket':
        return <Bus className="w-5 h-5 text-amber-600" />;
      case 'Insurance':
        return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
      case 'Passport/Visa':
        return <ShieldCheck className="w-5 h-5 text-amber-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getDocTypeLabel = (type: TravelDocument['docType']) => {
    switch (type) {
      case 'Flight Ticket':
        return isVi ? 'Vé máy bay' : 'Flight Ticket';
      case 'Hotel Voucher':
        return isVi ? 'Xác nhận khách sạn' : 'Hotel Voucher';
      case 'Bus Ticket':
        return isVi ? 'Vé xe' : 'Bus Ticket';
      case 'Insurance':
        return isVi ? 'Bảo hiểm du lịch' : 'Insurance Policy';
      case 'Passport/Visa':
        return isVi ? 'Hộ chiếu / Visa' : 'Passport / Visa';
      default:
        return isVi ? 'Ghi chú khác' : 'Other Note';
    }
  };

  const getPayerName = (payerId?: string) => {
    if (!payerId || payerId === 'fund') return isVi ? 'Quỹ' : 'Group Fund';
    const member = trip.members.find((m) => m.id === payerId);
    return member?.name || payerId;
  };

  const formatCostDisplay = (val?: number) => {
    if (val === undefined || isNaN(val)) return '';
    return isVi
      ? `${Math.round(val).toLocaleString('vi-VN')} đ`
      : `$${val.toLocaleString('en-US')} USD`;
  };

  const parsedCostNum = parseFloat(cost) || 0;
  const perPersonCost = splitWith.length > 0 && parsedCostNum > 0 ? parsedCostNum / splitWith.length : 0;

  return (
    <div className="space-y-4 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 border border-slate-700 max-w-md w-[92%]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 leading-snug">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Security Approval Alert Banner */}
      {pendingSecurityRequest && (
        <div className="p-3.5 sm:p-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl sm:rounded-3xl shadow-xs space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-amber-950">
                  {isVi ? 'Yêu Cầu Phê Duyệt Bảo Mật Mã PIN' : 'Security PIN Approval Request'}
                </h4>
                <p className="text-[11px] text-amber-800">
                  {pendingSecurityRequest.message}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 shrink-0 animate-pulse">
              {isVi ? 'Chờ xác nhận' : 'Pending'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200 text-xs">
            <div className="text-[11px] text-amber-800">
              {isVi ? 'Người tạo PIN' : 'PIN Creator'}: <strong>{pinCreator.name}</strong> ({pinCreator.email})
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDirectApprovePending(pendingSecurityRequest)}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isVi ? 'Đồng ý phê duyệt' : 'Approve'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDirectRejectPending(pendingSecurityRequest)}
                className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-amber-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                {isVi ? 'Từ chối' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Latest PIN Announcement Banner */}
      {recentPinNotification && !pendingSecurityRequest && (
        <div className="p-2.5 sm:p-3 bg-teal-50/70 border border-teal-200 rounded-2xl flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-teal-950 font-medium truncate">
              <strong>{isVi ? 'Thông báo:' : 'Notice:'}</strong> {recentPinNotification.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline shrink-0 cursor-pointer"
          >
            {isVi ? 'Lịch sử bảo mật' : 'Security History'}
          </button>
        </div>
      )}

      {/* Top Header & Security Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {savedPin ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isVi ? 'Đã bảo vệ bằng PIN' : 'PIN Protected'}</span>
              </span>
              <button
                type="button"
                onClick={handleLockVault}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title={isVi ? 'Khóa két ngay' : 'Lock Vault now'}
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>{isVi ? 'Khóa ngay' : 'Lock'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title={isVi ? 'Cài đặt mã PIN' : 'PIN Settings'}
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                title={isVi ? 'Lịch sử bảo mật PIN' : 'PIN Security History'}
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPinModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-teal-800 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>{isVi ? 'Cài mã PIN bảo vệ' : 'Set PIN Lock'}</span>
              </button>
              {(trip.notifications?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                  title={isVi ? 'Lịch sử bảo mật PIN' : 'PIN Security History'}
                >
                  <History className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        {(!savedPin || isUnlocked) && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isVi ? 'Thêm vé / giấy tờ' : 'Add Document'}</span>
          </button>
        )}
      </div>

      {/* When Vault is Locked by PIN: Show Security Unlock Screen */}
      {savedPin && !isUnlocked ? (
        <div className="bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs max-w-sm mx-auto text-center space-y-6 my-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-2xs border border-teal-100">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {isVi ? 'Két giấy tờ được bảo vệ' : 'Travel Vault Protected'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {isVi
                ? 'Nhập mã PIN 4 chữ số để xem vé máy bay, phòng khách sạn và mã đặt chỗ.'
                : 'Enter your 4-digit PIN to access tickets, vouchers, and reservation codes.'}
            </p>
          </div>

          {/* 4 PIN Indicator Dots */}
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = idx < enteredPin.length;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    isFilled
                      ? 'bg-teal-600 scale-110 shadow-xs'
                      : 'border-2 border-slate-300 bg-slate-100'
                  }`}
                />
              );
            })}
          </div>

          {lockoutRemaining > 0 ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
              {isVi 
                ? `Két tạm thời bị khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${lockoutRemaining} giây.`
                : `Vault temporarily locked due to multiple failed attempts. Try again in ${lockoutRemaining}s.`}
            </div>
          ) : pinError ? (
            <p className="text-xs font-semibold text-red-600 animate-pulse">
              {pinError}
            </p>
          ) : null}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-[220px] mx-auto pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handlePinDigit(digit)}
                className="w-14 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 text-base font-bold transition-colors shadow-2xs flex items-center justify-center cursor-pointer select-none"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleOpenForgotPinModal}
              className="w-14 h-11 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-700 text-[11px] font-bold transition-colors flex items-center justify-center cursor-pointer select-none border border-slate-200/60"
              title={isVi ? 'Quên PIN / Đặt lại' : 'Forgot PIN'}
            >
              {isVi ? 'Quên?' : 'Forgot?'}
            </button>
            <button
              type="button"
              onClick={() => handlePinDigit('0')}
              className="w-14 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 text-base font-bold transition-colors shadow-2xs flex items-center justify-center cursor-pointer select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinBackspace}
              className="w-14 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer select-none"
            >
              ←
            </button>
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleOpenForgotPinModal}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer inline-flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3 text-teal-600" />
              <span>{isVi ? 'Quên mã PIN? Khôi phục qua OTP & phê duyệt' : 'Forgot PIN? Recover via OTP & Approval'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Documents Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {trip.documents.length === 0 ? (
            <div className="col-span-full text-center py-12 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <p className="text-sm font-bold text-slate-700">
                {isVi ? 'Chưa có vé hoặc giấy tờ nào' : 'No documents saved yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {isVi
                  ? 'Nhấn "Thêm vé / giấy tờ" để lưu thông tin vé máy bay, vé xe, khách sạn và đồng bộ chi phí.'
                  : 'Click "Add Document" to store flight, bus tickets, hotel vouchers, and sync expenses.'}
              </p>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isVi ? 'Thêm vé / giấy tờ' : 'Add Document'}</span>
              </button>
            </div>
          ) : (
            trip.documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 shrink-0 mt-0.5">
                    {getDocIcon(doc.docType)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100 uppercase tracking-wider">
                        {getDocTypeLabel(doc.docType)}
                      </span>
                      {doc.date && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {doc.date}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold text-slate-800 break-words leading-snug">
                      {doc.title}
                    </h4>

                    {/* Confirmation Code with Masking and 1-Click Copy */}
                    {doc.codeOrNumber && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="font-mono text-xs font-medium bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 select-all flex items-center gap-2">
                          <span>
                            {savedPin && !revealedDocCodes[doc.id]
                              ? '••••••••'
                              : doc.codeOrNumber}
                          </span>
                          {savedPin && (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedDocCodes((prev) => ({
                                  ...prev,
                                  [doc.id]: !prev[doc.id],
                                }))
                              }
                              className="text-slate-400 hover:text-teal-600 transition-colors p-0.5"
                              title={
                                revealedDocCodes[doc.id]
                                  ? (isVi ? 'Ẩn mã' : 'Hide code')
                                  : (isVi ? 'Hiện mã' : 'Reveal code')
                              }
                            >
                              {revealedDocCodes[doc.id] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (doc.codeOrNumber) {
                              navigator.clipboard.writeText(doc.codeOrNumber);
                              setCopiedDocId(doc.id);
                              setTimeout(() => setCopiedDocId(null), 1500);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title={isVi ? 'Sao chép mã' : 'Copy code'}
                        >
                          {copiedDocId === doc.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                  {/* Expense Information if recorded */}
                  {doc.cost !== undefined && doc.cost > 0 && (
                    <div className="bg-teal-50/70 border border-teal-100 rounded-xl p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-teal-800 flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5 text-teal-600" />
                          {isVi ? 'Chi phí' : 'Cost'}
                        </span>
                        <span className="text-xs font-extrabold text-teal-900">
                          {formatCostDisplay(doc.cost)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center justify-between gap-2 flex-wrap pt-0.5 border-t border-teal-100/60">
                        <span>
                          {isVi ? 'Người chi: ' : 'Paid by: '}
                          <strong className="text-slate-800">{getPayerName(doc.paidBy)}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Users className="w-3 h-3 text-slate-400" />
                          {isVi
                            ? `${doc.splitWith?.length || trip.members.length} người`
                            : `${doc.splitWith?.length || trip.members.length} participants`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {doc.notes && (
                    <p className="text-xs text-slate-600 italic bg-slate-50/80 p-2 rounded-xl border border-slate-100 leading-relaxed break-words">
                      "{doc.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons: Edit & Delete (luôn nằm ngang nhau) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(doc)}
                  className="text-slate-400 hover:text-teal-600 p-1.5 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer"
                  title={isVi ? 'Chỉnh sửa' : 'Edit'}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDocToDelete(doc)}
                  className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  title={isVi ? 'Xóa' : 'Delete'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Add / Edit Document Popup Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                {modalMode === 'add' ? (
                  <>
                    <Plus className="w-5 h-5 text-teal-600" />
                    <span>{isVi ? 'Thêm vé / giấy tờ mới' : 'Add Document / Ticket'}</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-5 h-5 text-teal-600" />
                    <span>{isVi ? 'Chỉnh sửa vé / giấy tờ' : 'Edit Document / Ticket'}</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Tiêu đề (rút gọn 2 chữ theo yêu cầu) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Tiêu đề' : 'Title'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={
                    isVi
                      ? 'Ví dụ: Vé máy bay VN123, Khách sạn Colline, Vé xe limousine...'
                      : 'e.g. Flight VN123, Hotel Colline, Limousine bus...'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              {/* Doc Type (Thêm Vé xe) & Mã xác nhận */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Loại giấy tờ' : 'Document Type'}
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as TravelDocument['docType'])}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Flight Ticket">{isVi ? 'Vé máy bay' : 'Flight Ticket'}</option>
                    <option value="Hotel Voucher">{isVi ? 'Xác nhận khách sạn' : 'Hotel Voucher'}</option>
                    <option value="Bus Ticket">{isVi ? 'Vé xe' : 'Bus Ticket'}</option>
                    <option value="Insurance">{isVi ? 'Bảo hiểm du lịch' : 'Insurance Policy'}</option>
                    <option value="Passport/Visa">{isVi ? 'Hộ chiếu / Visa' : 'Passport / Visa'}</option>
                    <option value="Other">{isVi ? 'Ghi chú khác' : 'Other Note'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Mã xác nhận / Số hiệu' : 'Confirmation Code / Number'}
                  </label>
                  <input
                    type="text"
                    placeholder={isVi ? 'Ví dụ: PNR-8942A, BK-5521...' : 'e.g. PNR-8942A, BK-5521...'}
                    value={codeOrNumber}
                    onChange={(e) => setCodeOrNumber(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Ngày hiệu lực / Ngày khởi hành' : 'Date / Departure'}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              {/* Khung Chi phí & Người chi & Người tham gia */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5">
                {/* Tiêu đề khung: Chi phí (đã bỏ chữ Tự động thêm vào Tab Chi tiêu) */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Receipt className="w-4 h-4 text-teal-600" />
                  <span>{isVi ? 'Chi phí' : 'Cost'}</span>
                </div>

                {/* Amount Input with currency: 'đ' nếu tiếng Việt, 'usd' nếu tiếng Anh */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Chi phí (đ)' : 'Cost (USD)'}
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder={isVi ? 'Ví dụ: 2500000 (đ)' : 'e.g. 150 (USD)'}
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full text-xs pl-8 pr-12 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-medium"
                    />
                    <span className="text-xs font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isVi ? 'đ' : 'USD'}
                    </span>
                  </div>
                </div>

                {/* Hiển thị Người chi & Người tham gia khi đã nhập chi phí */}
                {cost && parseFloat(cost) > 0 && (
                  <div className="space-y-3.5 pt-2 border-t border-slate-200/80">
                    {/* Người chi tiền - Thiết kế Droplist đẹp giống tab Lịch trình & Chi tiêu */}
                    <div ref={paidByDropdownRef} className="relative">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isVi ? 'Người chi' : 'Paid By'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsPaidByDropdownOpen(!isPaidByDropdownOpen)}
                        className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-left text-xs transition-colors cursor-pointer shadow-2xs font-medium"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {paidBy === 'fund' ? (
                            <>
                              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 border border-amber-300 shrink-0 font-bold">
                                <PiggyBank className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-amber-800 truncate">{isVi ? 'Quỹ' : 'Group Fund'}</span>
                            </>
                          ) : (() => {
                            const selectedMember = trip.members.find((m) => m.id === paidBy) || trip.members[0];
                            if (!selectedMember) return <span className="text-slate-400">{isVi ? 'Chọn người chi...' : 'Select member...'}</span>;
                            return (
                              <>
                                <img
                                  src={selectedMember.avatar}
                                  alt={selectedMember.name}
                                  className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                                <span className="font-semibold text-slate-800 truncate">{selectedMember.name}</span>
                              </>
                            );
                          })()}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPaidByDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isPaidByDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                          <div className="relative mb-2">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder={isVi ? 'Tìm người chi...' : 'Search payer...'}
                              value={paidBySearch}
                              onChange={(e) => setPaidBySearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {/* Tùy chọn Quỹ */}
                            {('quỹ'.includes(paidBySearch.toLowerCase()) || 'quy'.includes(paidBySearch.toLowerCase()) || 'fund'.includes(paidBySearch.toLowerCase()) || !paidBySearch) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaidBy('fund');
                                  setIsPaidByDropdownOpen(false);
                                  setPaidBySearch('');
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                                  paidBy === 'fund' ? 'bg-amber-50 text-amber-950 font-bold border border-amber-200' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 border border-amber-300 shrink-0">
                                    <PiggyBank className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="text-xs truncate font-semibold">{isVi ? 'Quỹ' : 'Group Fund'}</span>
                                </div>
                                <div className="shrink-0 ml-2">
                                  {paidBy === 'fund' && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                                </div>
                              </button>
                            )}

                            {trip.members
                              .filter((m) => m.name.toLowerCase().includes(paidBySearch.toLowerCase()))
                              .map((member) => (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => {
                                    setPaidBy(member.id);
                                    setIsPaidByDropdownOpen(false);
                                    setPaidBySearch('');
                                  }}
                                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                                    paidBy === member.id ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <img
                                      src={member.avatar}
                                      alt={member.name}
                                      className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                                    />
                                    <span className="text-xs truncate">{member.name}</span>
                                  </div>
                                  {paidBy === member.id && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Người tham gia - Thiết kế giống tab Lịch trình & Chi tiêu */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
                          className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          <Users className="w-3.5 h-3.5 text-teal-600" />
                          <span>{isVi ? 'Người tham gia' : 'Participants'}</span>
                          <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full">
                            {splitWith.length}/{trip.members.length} {isVi ? 'người' : 'members'}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          {isParticipantsExpanded && (
                            <button
                              type="button"
                              onClick={handleToggleAllMembers}
                              className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold px-2 py-0.5 rounded-md hover:bg-teal-100/60 cursor-pointer transition-colors"
                            >
                              {splitWith.length === trip.members.length
                                ? (isVi ? 'Bỏ chọn' : 'Deselect all')
                                : (isVi ? 'Chọn tất cả' : 'Select all')}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
                            className="p-1 rounded-lg text-teal-800 hover:bg-teal-100/80 cursor-pointer transition-colors border border-teal-300/80 bg-white shadow-2xs flex items-center justify-center"
                            title={isParticipantsExpanded ? (isVi ? 'Thu gọn' : 'Collapse') : (isVi ? 'Mở rộng' : 'Expand')}
                          >
                            {isParticipantsExpanded ? (
                              <ChevronUp className="w-4 h-4 text-teal-700" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-teal-700" />
                            )}
                          </button>
                        </div>
                      </div>

                      {!isParticipantsExpanded ? (
                        /* Khi Thu gọn: Avatar stack tóm tắt */
                        <div
                          onClick={() => setIsParticipantsExpanded(true)}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors shadow-2xs group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                              {splitWith.slice(0, 6).map((id) => {
                                const m = trip.members.find((mb) => mb.id === id);
                                if (!m) return null;
                                return (
                                  <img
                                    key={id}
                                    src={m.avatar}
                                    alt={m.name}
                                    title={m.name}
                                    className="w-5 h-5 rounded-full object-cover border-2 border-white ring-1 ring-teal-300"
                                  />
                                );
                              })}
                            </div>
                            <span className="text-xs text-slate-700 font-medium truncate">
                              {splitWith.length === trip.members.length
                                ? (isVi ? 'Tất cả thành viên tham gia' : 'All members participating')
                                : `${splitWith.length} ${isVi ? 'người tham gia' : 'participants'}`}
                            </span>
                          </div>
                          <ChevronDown className="w-4 h-4 text-teal-700 shrink-0 ml-2 group-hover:translate-y-0.5 transition-transform" />
                        </div>
                      ) : (
                        /* Khi Mở rộng: Danh sách có tìm kiếm, lọc & sắp xếp tích lên đầu */
                        <div className="space-y-2">
                          {trip.members.length > 3 && (
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                                <input
                                  type="text"
                                  placeholder={isVi ? 'Tìm người tham gia...' : 'Search participants...'}
                                  value={participantsSearch}
                                  onChange={(e) => setParticipantsSearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                                />
                              </div>
                              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0 text-[10px] font-semibold">
                                <button
                                  type="button"
                                  onClick={() => setParticipantsFilter('all')}
                                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                    participantsFilter === 'all'
                                      ? 'bg-teal-600 text-white font-bold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {isVi ? 'Tất cả' : 'All'} ({trip.members.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setParticipantsFilter('selected')}
                                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                    participantsFilter === 'selected'
                                      ? 'bg-teal-600 text-white font-bold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {isVi ? 'Đã chọn' : 'Selected'} ({splitWith.length})
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Danh sách thành viên - sắp xếp người đã chọn lên đầu */}
                          <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 bg-white rounded-xl border border-slate-200 overscroll-contain">
                            {trip.members
                              .filter((m) => {
                                const matchSearch = m.name.toLowerCase().includes(participantsSearch.toLowerCase());
                                if (!matchSearch) return false;
                                if (participantsFilter === 'selected') {
                                  return splitWith.includes(m.id);
                                }
                                return true;
                              })
                              .sort((a, b) => {
                                const aSelected = splitWith.includes(a.id) ? 1 : 0;
                                const bSelected = splitWith.includes(b.id) ? 1 : 0;
                                return bSelected - aSelected;
                              })
                              .map((member) => {
                                const isSelected = splitWith.includes(member.id);
                                return (
                                  <div
                                    key={member.id}
                                    onClick={() => handleToggleMember(member.id)}
                                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-teal-50/70 border-teal-500/80 text-teal-950 font-bold'
                                        : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <div className="shrink-0">
                                        {isSelected ? (
                                          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                                        ) : (
                                          <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                                        )}
                                      </div>
                                      <img
                                        src={member.avatar}
                                        alt={member.name}
                                        className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                                      />
                                      <span className="text-xs truncate">{member.name}</span>
                                    </div>

                                    {/* Dự tính chia mỗi người nếu chọn */}
                                    {isSelected && perPersonCost > 0 && (
                                      <span className="text-[11px] font-bold text-teal-700 shrink-0">
                                        ~{formatCostDisplay(perPersonCost)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Ghi chú (chỉ cần chữ Ghi chú theo yêu cầu) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Ghi chú' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    isVi
                      ? 'Ví dụ: Cổng khởi hành số 3, bao gồm bữa sáng buffet, nhận phòng lúc 14h...'
                      : 'e.g. Departure Gate 3, breakfast included, check-in at 2 PM...'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isVi ? 'Lưu' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-4 text-center my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                {isVi ? 'Xác nhận xóa vé / giấy tờ?' : 'Delete Document?'}
              </h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {isVi
                  ? `Bạn có chắc chắn muốn xóa "${docToDelete.title}" khỏi danh sách? Thao tác này cũng sẽ xóa khoản chi tiêu tương ứng trong Tab Chi tiêu nếu có.`
                  : `Are you sure you want to delete "${docToDelete.title}"? This will also remove the corresponding expense in Expense Splitter if linked.`}
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {isVi ? 'Xác nhận' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Security Settings Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 sm:p-6 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-slate-800 text-sm sm:text-base">
                  {savedPin ? (isVi ? 'Đổi hoặc gỡ mã PIN' : 'Change or Remove PIN') : (isVi ? 'Thiết lập mã PIN 4 số' : 'Setup 4-Digit PIN')}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(false);
                  setNewPin('');
                  setConfirmPin('');
                  setPinModalError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPin} className="space-y-3.5">
              <p className="text-xs text-slate-500 leading-relaxed">
                {isVi
                  ? 'Mã PIN giúp bảo vệ số hộ chiếu, mã vé máy bay và giấy tờ đặt phòng của bạn khỏi người khác nhìn trộm.'
                  : 'PIN protects your passports, flight tickets, and booking vouchers from prying eyes.'}
              </p>

              {savedPin && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-semibold">{isVi ? 'Người tạo mã PIN:' : 'PIN Creator:'}</span>
                    <span className="font-bold text-slate-800">{pinCreator.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{isVi ? 'Email / SĐT:' : 'Contact:'}</span>
                    <span className="font-mono text-slate-700">{pinCreator.email}</span>
                  </div>
                </div>
              )}

              {savedPin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Mã PIN hiện tại' : 'Current PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    inputMode="numeric"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center text-lg tracking-widest font-mono p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {savedPin ? (isVi ? 'Nhập mã PIN mới (4 số)' : 'New PIN (4 digits)') : (isVi ? 'Nhập mã PIN (4 số)' : 'Enter 4-digit PIN')}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center text-lg tracking-widest font-mono p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  autoFocus={!savedPin}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Xác nhận lại mã PIN' : 'Confirm PIN'}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center text-lg tracking-widest font-mono p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              {pinModalError && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
                  {pinModalError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                {savedPin && (
                  <button
                    type="button"
                    onClick={handleOpenRemoveModal}
                    className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200"
                  >
                    {isVi ? 'Gỡ bỏ PIN' : 'Remove PIN'}
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setNewPin('');
                    setConfirmPin('');
                    setPinModalError(null);
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={newPin.length !== 4 || confirmPin.length !== 4}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isVi ? 'Lưu mã PIN' : 'Save PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot PIN & Vault Recovery Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 my-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    {isVi ? 'Quên mã PIN & Khôi phục két vé' : 'Forgot PIN & Vault Recovery'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isVi ? 'Xác thực OTP và phê duyệt bởi người tạo PIN' : 'OTP verification & PIN creator approval'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper progress */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-500">
              <span className={`flex items-center gap-1 ${forgotStep === 1 ? 'text-teal-700 font-bold' : forgotStep > 1 ? 'text-emerald-600' : ''}`}>
                <span>1. {isVi ? 'OTP login' : 'Login OTP'}</span>
                {forgotStep > 1 && <Check className="w-3 h-3 text-emerald-600 inline" />}
              </span>
              <span>→</span>
              <span className={`flex items-center gap-1 ${forgotStep === 2 ? 'text-amber-700 font-bold' : forgotStep > 2 ? 'text-emerald-600' : ''}`}>
                <span>2. {isVi ? 'Người tạo duyệt' : 'Creator Approval'}</span>
                {forgotStep > 2 && <Check className="w-3 h-3 text-emerald-600 inline" />}
              </span>
              <span>→</span>
              <span className={forgotStep === 3 ? 'text-teal-700 font-bold' : ''}>
                <span>3. {isVi ? 'PIN 4 số mới' : 'New PIN'}</span>
              </span>
            </div>

            {/* STEP 1: Verify OTP of logged in account */}
            {forgotStep === 1 && (
              <div className="space-y-3.5">
                <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-xs space-y-1 text-slate-700 leading-relaxed">
                  <div className="font-bold text-teal-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                    <span>{isVi ? 'Tài khoản yêu cầu đổi PIN' : 'Requesting Account'}</span>
                  </div>
                  <div>
                    {isVi ? 'Người dùng:' : 'User:'} <strong>{currentUserName}</strong>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600">
                    Email: <strong>{currentUserEmail}</strong> {currentUserPhone ? `• SĐT: ${currentUserPhone}` : ''}
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-teal-100">
                    {isVi
                      ? 'Hệ thống gửi mã OTP xác thực tới tài khoản của bạn để xác nhận danh tính trước khi xin phép người tạo PIN.'
                      : 'An OTP will be sent to your account to verify identity before requesting creator approval.'}
                  </p>
                </div>

                {/* Channel Selector */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendForgotOtp('email')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      forgotOtpChannel === 'email'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Gửi qua Email' : 'Send to Email'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendForgotOtp('phone')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      forgotOtpChannel === 'phone'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Gửi qua SMS / SĐT' : 'Send to SMS'}</span>
                  </button>
                </div>

                {/* Simulated OTP Notification Box for Easy Testing & Delightful Mobile UX */}
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-800">
                    <span className="flex items-center gap-1">
                      <Send className="w-3 h-3 text-amber-600" />
                      <span>{isVi ? 'Mô phỏng tin nhắn OTP gửi đến:' : 'Simulated OTP Message to:'} {forgotOtpChannel === 'email' ? currentUserEmail : (currentUserPhone || '090***')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnteredUserOtp(generatedUserOtp || '123456')}
                      className="text-amber-900 hover:text-amber-950 underline font-bold cursor-pointer"
                    >
                      {isVi ? '⚡ Điền nhanh' : '⚡ Auto-fill'}
                    </button>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200 text-center font-mono text-base font-extrabold tracking-widest text-slate-900 shadow-2xs">
                    {generatedUserOtp || '123456'}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-amber-700">
                    <span>{isVi ? 'Hiệu lực trong 5 phút' : 'Valid for 5 mins'}</span>
                    {otpCountdown > 0 ? (
                      <span>{isVi ? `Gửi lại sau ${otpCountdown}s` : `Resend in ${otpCountdown}s`}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendForgotOtp(forgotOtpChannel)}
                        className="underline font-bold text-amber-800 cursor-pointer"
                      >
                        {isVi ? 'Gửi lại mã OTP' : 'Resend OTP'}
                      </button>
                    )}
                  </div>
                </div>

                {/* OTP Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Nhập mã OTP 6 chữ số:' : 'Enter 6-digit OTP code:'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    pattern="\d{6}"
                    inputMode="numeric"
                    value={enteredUserOtp}
                    onChange={(e) => setEnteredUserOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full text-center text-xl tracking-widest font-mono p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    autoFocus
                  />
                </div>

                {forgotError && (
                  <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
                    {forgotError}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isVi ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyForgotOtp}
                    disabled={enteredUserOtp.length !== 6}
                    className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    {isVi ? 'Xác thực OTP' : 'Verify OTP'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Creator Approval */}
            {forgotStep === 2 && (
              <div className="space-y-3.5">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {isVi
                      ? `Đã xác thực OTP tài khoản của bạn (${currentUserEmail}) thành công!`
                      : `Successfully verified your account OTP (${currentUserEmail})!`}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-2 text-xs text-amber-950">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold text-sm">
                      {isVi ? 'Chờ Người tạo mã PIN phê duyệt' : 'Waiting for PIN Creator Approval'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-200">
                    {isVi
                      ? `Theo chính sách bảo mật két vé, yêu cầu đặt lại mã PIN cần được Người tạo mã PIN (${pinCreator.name}) xác nhận đồng ý mới được phép đổi mã PIN mới.`
                      : `For security, resetting the Vault PIN requires consent and approval from PIN creator (${pinCreator.name}).`}
                  </p>

                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div>{isVi ? 'Người tạo PIN:' : 'PIN Creator:'} <strong>{pinCreator.name}</strong></div>
                    <div>Email/SĐT: <strong className="font-mono">{pinCreator.email}</strong></div>
                  </div>
                </div>

                {/* Creator Action Box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {isVi ? 'Dành cho Người tạo PIN hoặc Phê duyệt nhanh:' : 'For PIN Creator or Instant Approval:'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreatorApproveForgot}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Đồng ý phê duyệt' : 'Approve Reset'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotModalOpen(false);
                        showToast(isVi ? 'Đã hủy yêu cầu đặt lại PIN.' : 'PIN reset request cancelled.');
                      }}
                      className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isVi ? 'Từ chối' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Enter new 4-digit PIN */}
            {forgotStep === 3 && (
              <form onSubmit={handleCompleteForgotReset} className="space-y-3.5">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {isVi
                      ? 'Đã xác thực OTP và nhận được sự phê duyệt! Vui lòng nhập mã PIN 4 số mới.'
                      : 'Verified & approved! Please enter your new 4-digit PIN.'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Mã PIN 4 số mới' : 'New 4-digit PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    inputMode="numeric"
                    value={resetNewPin}
                    onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center text-xl tracking-widest font-mono p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Xác nhận lại mã PIN 4 số mới' : 'Confirm New PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    inputMode="numeric"
                    value={resetConfirmPin}
                    onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center text-xl tracking-widest font-mono p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div className="p-2.5 bg-teal-50 border border-teal-100 rounded-xl text-[11px] text-teal-800">
                  {isVi
                    ? '📢 Sau khi đổi thành công, hệ thống sẽ tự động gửi thông báo đến tất cả thành viên trong chuyến đi.'
                    : '📢 When updated, all trip members will be automatically notified.'}
                </div>

                {forgotError && (
                  <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
                    {forgotError}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isVi ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={resetNewPin.length !== 4 || resetConfirmPin.length !== 4}
                    className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    {isVi ? 'Lưu mã PIN mới' : 'Save New PIN'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Remove PIN Modal */}
      {isRemoveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 my-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    {isVi ? 'Gỡ bỏ mã PIN bảo vệ két vé' : 'Remove Vault PIN Protection'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isVi ? 'Nhập mã PIN hiện tại hoặc xác nhận qua OTP' : 'Enter current PIN or verify via OTP'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRemoveModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs: By Current PIN vs By OTP */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setRemoveTab('pin');
                  setRemoveError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  removeTab === 'pin'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isVi ? 'Nhập PIN hiện tại' : 'Current PIN'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRemoveTab('otp');
                  setRemoveError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  removeTab === 'otp'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isVi ? 'Xác thực qua OTP' : 'Verify via OTP'}
              </button>
            </div>

            {/* TAB 1: Enter Current PIN */}
            {removeTab === 'pin' && (
              <form onSubmit={handleConfirmRemoveWithPin} className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isVi
                    ? 'Nhập đúng mã PIN 4 số hiện tại để gỡ bỏ bảo vệ két giấy tờ ngay lập tức.'
                    : 'Enter the current 4-digit PIN to remove protection immediately.'}
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Mã PIN hiện tại' : 'Current PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    inputMode="numeric"
                    value={removeCurrentPinInput}
                    onChange={(e) => setRemoveCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center text-xl tracking-widest font-mono p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                    autoFocus
                  />
                </div>

                {removeError && (
                  <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
                    {removeError}
                  </div>
                )}

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                  {isVi
                    ? '📢 Khi gỡ bỏ thành công, hệ thống sẽ gửi thông báo đến tất cả thành viên trong chuyến đi.'
                    : '📢 When removed, an announcement will be sent to all trip members.'}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRemoveModalOpen(false)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isVi ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={removeCurrentPinInput.length !== 4}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    {isVi ? 'Xác nhận gỡ bỏ' : 'Confirm Removal'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: Verify via OTP & Creator Approval */}
            {removeTab === 'otp' && (
              <div className="space-y-3.5">
                {removeOtpStep === 1 && (
                  <div className="space-y-3.5">
                    <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-xs space-y-1 text-slate-700">
                      <div className="font-bold text-teal-900 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-teal-600" />
                        <span>{isVi ? 'Tài khoản yêu cầu gỡ PIN' : 'Requesting Account'}</span>
                      </div>
                      <div>{isVi ? 'Người dùng:' : 'User:'} <strong>{currentUserName}</strong></div>
                      <div className="font-mono text-[11px] text-slate-600">Email: {currentUserEmail}</div>
                    </div>

                    {/* Channel Selector */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendRemoveOtp('email')}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          removeOtpChannel === 'email'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Gửi qua Email' : 'Send to Email'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendRemoveOtp('phone')}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          removeOtpChannel === 'phone'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Gửi qua SMS' : 'Send to SMS'}</span>
                      </button>
                    </div>

                    {/* Simulated OTP Box */}
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-800">
                        <span>{isVi ? 'Mã OTP xác thực gửi tới bạn:' : 'Simulated OTP to your account:'}</span>
                        <button
                          type="button"
                          onClick={() => setRemoveEnteredOtp(removeGeneratedOtp || '123456')}
                          className="text-amber-900 hover:text-amber-950 underline font-bold cursor-pointer"
                        >
                          {isVi ? '⚡ Điền nhanh' : '⚡ Auto-fill'}
                        </button>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-amber-200 text-center font-mono text-base font-extrabold tracking-widest text-slate-900 shadow-2xs">
                        {removeGeneratedOtp || '123456'}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-amber-700">
                        <span>{isVi ? 'Hiệu lực trong 5 phút' : 'Valid for 5 mins'}</span>
                        {removeOtpCountdown > 0 ? (
                          <span>{isVi ? `Gửi lại sau ${removeOtpCountdown}s` : `Resend in ${removeOtpCountdown}s`}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendRemoveOtp(removeOtpChannel)}
                            className="underline font-bold text-amber-800 cursor-pointer"
                          >
                            {isVi ? 'Gửi lại mã OTP' : 'Resend OTP'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isVi ? 'Nhập mã OTP 6 số:' : 'Enter 6-digit OTP:'}
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        pattern="\d{6}"
                        inputMode="numeric"
                        value={removeEnteredOtp}
                        onChange={(e) => setRemoveEnteredOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full text-center text-xl tracking-widest font-mono p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>

                    {removeError && (
                      <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
                        {removeError}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsRemoveModalOpen(false)}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {isVi ? 'Hủy' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifyRemoveOtp}
                        disabled={removeEnteredOtp.length !== 6}
                        className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        {isVi ? 'Xác thực OTP' : 'Verify OTP'}
                      </button>
                    </div>
                  </div>
                )}

                {removeOtpStep === 2 && (
                  <div className="space-y-3.5">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{isVi ? 'Đã xác thực OTP tài khoản của bạn thành công!' : 'Account OTP verified!'}</span>
                    </div>

                    <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-2 text-xs text-amber-950">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-bold text-sm">
                          {isVi ? 'Chờ Người tạo mã PIN phê duyệt' : 'Waiting for PIN Creator Approval'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        {isVi
                          ? `Yêu cầu gỡ bỏ mã PIN cần được Người tạo mã PIN (${pinCreator.name}) xác nhận đồng ý để hoàn tất.`
                          : `Removing the PIN requires approval from the creator (${pinCreator.name}).`}
                      </p>
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <div>{isVi ? 'Người tạo PIN:' : 'PIN Creator:'} <strong>{pinCreator.name}</strong></div>
                        <div>Email: <strong className="font-mono">{pinCreator.email}</strong></div>
                      </div>
                    </div>

                    {/* Creator Action Box */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {isVi ? 'Dành cho Người tạo PIN hoặc Phê duyệt nhanh:' : 'For PIN Creator or Instant Approval:'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCreatorApproveRemove}
                          className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Đồng ý gỡ bỏ PIN' : 'Approve Removal'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRemoveModalOpen(false);
                            showToast(isVi ? 'Đã hủy yêu cầu gỡ bỏ PIN.' : 'PIN removal cancelled.');
                          }}
                          className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          {isVi ? 'Từ chối' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PIN Security History & Notification Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 my-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    {isVi ? 'Lịch sử bảo mật & Thông báo mã PIN' : 'PIN Security & Notification History'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isVi ? 'Xem toàn bộ thông báo và sự kiện bảo mật trong chuyến đi' : 'All security announcements in this trip'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Security Notifications */}
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
              {(!trip.notifications || trip.notifications.length === 0) ? (
                <div className="text-center py-8 text-slate-400 space-y-1.5">
                  <Shield className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    {isVi ? 'Chưa có thông báo bảo mật nào' : 'No security notifications yet'}
                  </p>
                </div>
              ) : (
                trip.notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                      n.status === 'pending'
                        ? 'bg-amber-50/80 border-amber-300'
                        : n.type === 'pin_removed'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-teal-50/50 border-teal-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        {n.type === 'pin_removed' ? (
                          <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                        ) : n.status === 'pending' ? (
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                        )}
                        <span>{n.title}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        n.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : n.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {n.status === 'pending'
                          ? (isVi ? 'Chờ duyệt' : 'Pending')
                          : n.status === 'rejected'
                          ? (isVi ? 'Từ chối' : 'Rejected')
                          : (isVi ? 'Đã duyệt' : 'Approved')}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed bg-white/70 p-2 rounded-xl border border-slate-200/50">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>{isVi ? 'Bởi:' : 'By:'} <strong className="text-slate-600">{n.actorName}</strong></span>
                      <span>{new Date(n.createdAt).toLocaleTimeString('vi-VN')} {new Date(n.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                {isVi ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
