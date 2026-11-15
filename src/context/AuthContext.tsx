import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, TripInvitation, UserTripNotification } from '../types';
import { hashStringSHA256 } from '../utils/cryptoUtils';

export const RFC_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const isViLang = () => typeof window === 'undefined' || localStorage.getItem('tripmate_lang') !== 'en';

export type AuthModalView = 'profile' | 'change-password' | 'forgot-password';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  loginWithEmailAndPhone: (email: string, displayName?: string, phone?: string, isRegister?: boolean, password?: string, customAvatar?: string) => Promise<{ success: boolean; message?: string }>;
  updateUserAvatar: (avatarUrl: string) => Promise<{ success: boolean; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  findAccountForReset: (identifier: string) => Promise<{ success: boolean; account?: UserProfile; message?: string }>;
  resetAccountPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  invitations: TripInvitation[];
  unreadInvitationsCount: number;
  respondToInvitation: (invitationId: string, accept: boolean, tripId: string) => Promise<void>;
  userNotifications: UserTripNotification[];
  markUserNotificationsRead: (notificationIds: string[]) => Promise<void>;
  searchRegisteredUser: (searchVal: string) => Promise<UserProfile | null>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalView: AuthModalView;
  setAuthModalView: (view: AuthModalView) => void;
  openAuthModal: (view?: AuthModalView) => void;
  isNotificationsModalOpen: boolean;
  setIsNotificationsModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserTripNotification[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<AuthModalView>('profile');
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  const openAuthModal = (view: AuthModalView = 'profile') => {
    setAuthModalView(view);
    setIsAuthModalOpen(true);
  };

  // Sync user profile to Firestore
  const syncUserProfile = async (user: User, customName?: string, customPhone?: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const email = user.email || `${user.uid}@tripmate.app`;
      const displayName = customName || user.displayName || email.split('@')[0];
      const avatar = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

      let profile: UserProfile;
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        profile = {
          ...data,
          displayName: customName || data.displayName || displayName,
          phone: customPhone || data.phone || '',
          avatar: data.avatar || avatar,
        };
        await updateDoc(userRef, {
          displayName: profile.displayName,
          phone: profile.phone || '',
          avatar: profile.avatar,
        });
      } else {
        profile = {
          id: user.uid,
          displayName,
          email,
          phone: customPhone || '',
          avatar,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, profile);
      }
      setUserProfile(profile);
      // Cache local storage
      localStorage.setItem('tripmate_user_profile', JSON.stringify(profile));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  // Auth state listener & local profile restoration
  useEffect(() => {
    // 1. Immediately check local stored user profile for instant fast render
    const cached = localStorage.getItem('tripmate_user_profile');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) {
          setUserProfile(parsed);
        }
      } catch (e) {
        console.warn('Failed parsing cached profile:', e);
      }
    }

    // 2. Firebase Auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await syncUserProfile(user);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to in-app invitations for active user profile or currentUser (by UID & Email)
  useEffect(() => {
    const targetUid = userProfile?.id || currentUser?.uid;
    const targetEmail = (userProfile?.email || currentUser?.email || '').trim().toLowerCase();

    if (!targetUid && !targetEmail) {
      setInvitations([]);
      return;
    }

    try {
      const invRef = collection(db, 'invitations');
      const unsubs: (() => void)[] = [];
      const invitationsMap = new Map<string, TripInvitation>();

      const updateList = () => {
        setInvitations(Array.from(invitationsMap.values()));
      };

      if (targetUid) {
        const qUid = query(invRef, where('inviteeUid', '==', targetUid));
        const unsubUid = onSnapshot(
          qUid,
          (snapshot) => {
            snapshot.forEach((d) => {
              invitationsMap.set(d.id, { id: d.id, ...(d.data() as Omit<TripInvitation, 'id'>) });
            });
            updateList();
          },
          (err) => console.warn('Error listening to invitations by UID:', err)
        );
        unsubs.push(unsubUid);
      }

      if (targetEmail) {
        const qEmail = query(invRef, where('inviteeEmail', '==', targetEmail));
        const unsubEmail = onSnapshot(
          qEmail,
          (snapshot) => {
            snapshot.forEach((d) => {
              invitationsMap.set(d.id, { id: d.id, ...(d.data() as Omit<TripInvitation, 'id'>) });
            });
            updateList();
          },
          (err) => console.warn('Error listening to invitations by Email:', err)
        );
        unsubs.push(unsubEmail);
      }

      return () => {
        unsubs.forEach((u) => u());
      };
    } catch (e) {
      console.warn('Firestore invitation query error:', e);
    }
  }, [currentUser, userProfile?.id, userProfile?.email]);

  // Listen to persistent cross-user notifications (e.g., trip deletions & expense debt settlements)
  useEffect(() => {
    const targetUid = userProfile?.id || currentUser?.uid;
    const targetEmail = (userProfile?.email || currentUser?.email || '').trim().toLowerCase();
    const targetPhone = (userProfile?.phone || '').trim();

    if (!targetUid && !targetEmail && !targetPhone) {
      setUserNotifications([]);
      return;
    }

    try {
      const notifRef = collection(db, 'user_notifications');
      const unsubs: (() => void)[] = [];
      const notifMap = new Map<string, UserTripNotification>();

      const syncList = () => {
        setUserNotifications(
          Array.from(notifMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      };

      if (targetUid) {
        const qUid = query(notifRef, where('targetUid', '==', targetUid));
        unsubs.push(
          onSnapshot(
            qUid,
            (snapshot) => {
              snapshot.forEach((d) => {
                notifMap.set(d.id, { id: d.id, ...(d.data() as Omit<UserTripNotification, 'id'>) });
              });
              syncList();
            },
            (err) => console.warn('Error listening to user_notifications by UID:', err)
          )
        );
      }

      if (targetEmail) {
        const qEmail = query(notifRef, where('targetEmail', '==', targetEmail));
        unsubs.push(
          onSnapshot(
            qEmail,
            (snapshot) => {
              snapshot.forEach((d) => {
                notifMap.set(d.id, { id: d.id, ...(d.data() as Omit<UserTripNotification, 'id'>) });
              });
              syncList();
            },
            (err) => console.warn('Error listening to user_notifications by Email:', err)
          )
        );
      }

      if (targetPhone) {
        const qPhone = query(notifRef, where('targetPhone', '==', targetPhone));
        unsubs.push(
          onSnapshot(
            qPhone,
            (snapshot) => {
              snapshot.forEach((d) => {
                notifMap.set(d.id, { id: d.id, ...(d.data() as Omit<UserTripNotification, 'id'>) });
              });
              syncList();
            },
            (err) => console.warn('Error listening to user_notifications by Phone:', err)
          )
        );
      }

      return () => {
        unsubs.forEach((u) => u());
      };
    } catch (e) {
      console.warn('Firestore user_notifications query error:', e);
    }
  }, [currentUser, userProfile?.id, userProfile?.email, userProfile?.phone]);

  // Login with Google
  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    const vi = isViLang();
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await syncUserProfile(res.user);
        setIsAuthModalOpen(false);
      }
      return { success: true };
    } catch (err) {
      console.error('Google sign-in error:', err);
      return {
        success: false,
        message: vi
          ? 'Không thể mở popup Google trong khung xem trước. Bạn có thể sử dụng tính năng "Đăng nhập bằng Email/SĐT".'
          : 'Unable to open Google sign-in popup in preview mode. Please use Email/Phone sign-in instead.',
      };
    }
  };

  // Sign In / Registration with Email & Phone
  const DEMO_EMAILS = ['perrynguyen10@gmail.com', 'linhchi@tripmate.app', 'minhquan@tripmate.app', 'khanhvy@tripmate.app'];

  const loginWithEmailAndPhone = async (
    emailOrPhone: string, 
    displayName?: string, 
    phone?: string,
    isRegister?: boolean,
    password?: string,
    customAvatar?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const cleanInput = emailOrPhone.trim().toLowerCase();
      const cleanPhone = (phone || '').trim();
      const isInputEmail = cleanInput.includes('@');
      const cleanEmail = isInputEmail ? cleanInput : '';
      const fallbackPhone = !isInputEmail ? emailOrPhone.trim() : cleanPhone;

      // Deterministic user ID generation for in-app session
      const seed = cleanEmail || fallbackPhone || 'user';
      const targetUid = auth.currentUser?.uid || ('usr_' + Math.abs(seed.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)).toString(36) + '_' + Date.now().toString(36).slice(-6));

      const usersRef = collection(db, 'users');

      // ----------------------------------------------------------------------
      // CASE 1: ĐĂNG KÝ TÀI KHOẢN MỚI (isRegister === true)
      // ----------------------------------------------------------------------
      const vi = isViLang();
      if (isRegister) {
        if (!cleanEmail || !RFC_EMAIL_REGEX.test(cleanEmail)) {
          return {
            success: false,
            message: vi
              ? 'Định dạng Email không hợp lệ (ví dụ: name@domain.com).'
              : 'Invalid email format (e.g. name@domain.com).',
          };
        }

        const cleanName = (displayName || '').trim();
        if (cleanName.length > 150) {
          return {
            success: false,
            message: vi
              ? 'Họ và tên không được vượt quá 150 ký tự.'
              : 'Full name cannot exceed 150 characters.',
          };
        }

        if (cleanPhone.length > 30) {
          return {
            success: false,
            message: vi
              ? 'Số điện thoại không được vượt quá 30 ký tự.'
              : 'Phone number cannot exceed 30 characters.',
          };
        }

        if (!password || password.trim().length < 6) {
          return {
            success: false,
            message: vi
              ? 'Vui lòng thiết lập mật khẩu tối thiểu 6 ký tự để bảo vệ tài khoản.'
              : 'Password must be at least 6 characters.',
          };
        }

        // 1. Kiểm tra trùng Email
        const qEmail = query(usersRef, where('email', '==', cleanEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          return {
            success: false,
            message: vi
              ? 'Email này đã được đăng ký tài khoản. Vui lòng nhập Email khác hoặc chuyển sang tab Đăng nhập.'
              : 'This email is already registered. Please use another email or sign in.',
          };
        }

        // 2. Kiểm tra trùng Số điện thoại (nếu có nhập)
        if (cleanPhone) {
          const qPhone = query(usersRef, where('phone', '==', cleanPhone));
          const snapPhone = await getDocs(qPhone);
          if (!snapPhone.empty) {
            return {
              success: false,
              message: vi
                ? 'Số điện thoại này đã được sử dụng cho tài khoản khác. Vui lòng nhập số điện thoại khác.'
                : 'This phone number is already used by another account.',
            };
          }
        }

        // Hash mật khẩu an toàn
        const passwordHash = await hashStringSHA256(password.trim(), 'tripmate_auth_pwd');

        // Tạo tài khoản mới hợp lệ
        const finalName = cleanName || cleanEmail.split('@')[0];
        const cleanCustomAvatar = customAvatar && customAvatar.trim().length <= 60000 ? customAvatar.trim() : '';
        const finalAvatar = cleanCustomAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalName)}`;

        const profile: UserProfile = {
          id: targetUid,
          displayName: finalName,
          email: cleanEmail,
          phone: cleanPhone,
          avatar: finalAvatar,
          passwordHash,
          createdAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'users', targetUid), profile);
        setUserProfile(profile);
        localStorage.setItem('tripmate_user_profile', JSON.stringify(profile));
        setIsAuthModalOpen(false);
        return { success: true };
      }

      // ----------------------------------------------------------------------
      // CASE 2: ĐĂNG NHẬP (isRegister === false hoặc undefined)
      // ----------------------------------------------------------------------
      let existingUserDoc: any = null;

      // Tìm theo Email
      if (cleanEmail) {
        const qEmail = query(usersRef, where('email', '==', cleanEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          existingUserDoc = snapEmail.docs[0];
        }
      }

      // Tìm theo Số điện thoại nếu chưa tìm thấy bằng Email
      if (!existingUserDoc && fallbackPhone) {
        const qPhone = query(usersRef, where('phone', '==', fallbackPhone));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          existingUserDoc = snapPhone.docs[0];
        } else {
          const compactPhone = fallbackPhone.replace(/[\s\-().]/g, '');
          if (compactPhone && compactPhone !== fallbackPhone) {
            const qCompact = query(usersRef, where('phone', '==', compactPhone));
            const snapCompact = await getDocs(qCompact);
            if (!snapCompact.empty) {
              existingUserDoc = snapCompact.docs[0];
            }
          }
        }
      }

      // Nếu là tài khoản Demo mẫu và chưa được tạo trên Firestore, tự động khởi tạo để sẵn sàng test
      const isDemo = DEMO_EMAILS.includes(cleanEmail);
      if (!existingUserDoc && isDemo) {
        const finalName = displayName?.trim() || cleanEmail.split('@')[0];
        const finalAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalName)}`;
        const demoPwdHash = await hashStringSHA256('123456', 'tripmate_auth_pwd');
        const demoProfile: UserProfile = {
          id: targetUid,
          displayName: finalName,
          email: cleanEmail,
          phone: cleanPhone || '',
          avatar: finalAvatar,
          passwordHash: demoPwdHash,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', targetUid), demoProfile);
        setUserProfile(demoProfile);
        localStorage.setItem('tripmate_user_profile', JSON.stringify(demoProfile));
        setIsAuthModalOpen(false);
        return { success: true };
      }

      // Nếu không tìm thấy tài khoản đã đăng ký
      if (!existingUserDoc) {
        return {
          success: false,
          message: vi
            ? 'Tài khoản không tồn tại trong hệ thống. Vui lòng kiểm tra lại Email / Số điện thoại hoặc chuyển sang tab Đăng ký tài khoản mới.'
            : 'Account does not exist in the system. Please check your Email / Phone or switch to Sign Up.',
        };
      }

      const data = existingUserDoc.data() as UserProfile;

      // Xác thực mật khẩu: nếu tài khoản có passwordHash, bắt buộc phải khớp
      if (data.passwordHash) {
        // Cho phép 1-click login đối với demo accounts nếu gọi trực tiếp không truyền password
        if (!password && !isDemo) {
          return {
            success: false,
            message: vi
              ? 'Vui lòng nhập mật khẩu tài khoản để đăng nhập.'
              : 'Please enter your account password to sign in.',
          };
        }

        if (password) {
          const inputHash = await hashStringSHA256(password.trim(), 'tripmate_auth_pwd');
          if (data.passwordHash !== inputHash && data.passwordHash !== password.trim()) {
            return {
              success: false,
              message: vi
                ? 'Mật khẩu đăng nhập không chính xác. Vui lòng thử lại.'
                : 'Incorrect password. Please try again.',
            };
          }
        }
      } else {
        // Tài khoản cũ chưa có passwordHash: yêu cầu nhập mật khẩu và lưu lại
        if (!password && !isDemo) {
          return {
            success: false,
            message: vi
              ? 'Tài khoản cần xác thực mật khẩu. Vui lòng nhập mật khẩu (mặc định: 123456).'
              : 'Password verification required. Please enter your password (default: 123456).',
          };
        }
        if (password) {
          const newHash = await hashStringSHA256(password.trim(), 'tripmate_auth_pwd');
          await updateDoc(doc(db, 'users', existingUserDoc.id), { passwordHash: newHash });
        }
      }

      // Đăng nhập thành công với tài khoản đã tìm thấy
      const profile: UserProfile = {
        ...data,
        id: existingUserDoc.id,
      };

      setUserProfile(profile);
      localStorage.setItem('tripmate_user_profile', JSON.stringify(profile));
      setIsAuthModalOpen(false);
      return { success: true };

    } catch (err: any) {
      console.error('Email/Phone login error:', err);
      return {
        success: false,
        message: err?.message || (isViLang() ? 'Lỗi xử lý xác thực.' : 'Authentication error.'),
      };
    }
  };

  // Find an existing registered account in Firestore users collection for Password Reset (NEVER auto-create)
  const findAccountForReset = async (
    identifier: string
  ): Promise<{ success: boolean; account?: UserProfile; message?: string }> => {
    const vi = isViLang();
    const rawTrimmed = identifier.trim();
    if (!rawTrimmed) {
      return {
        success: false,
        message: vi
          ? 'Vui lòng nhập Email hoặc Số điện thoại đã đăng ký.'
          : 'Please enter your registered Email or Phone number.',
      };
    }

    try {
      const usersRef = collection(db, 'users');
      let foundDoc: any = null;

      if (rawTrimmed.includes('@')) {
        const cleanEmail = rawTrimmed.toLowerCase();
        if (!RFC_EMAIL_REGEX.test(cleanEmail)) {
          return {
            success: false,
            message: vi
              ? 'Định dạng Email không hợp lệ (ví dụ: name@domain.com).'
              : 'Invalid email format (e.g. name@domain.com).',
          };
        }
        const qEmail = query(usersRef, where('email', '==', cleanEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          foundDoc = snapEmail.docs[0];
        }
      } else {
        const qPhone = query(usersRef, where('phone', '==', rawTrimmed));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          foundDoc = snapPhone.docs[0];
        } else {
          const compactPhone = rawTrimmed.replace(/[\s\-().]/g, '');
          if (compactPhone && compactPhone !== rawTrimmed) {
            const qCompact = query(usersRef, where('phone', '==', compactPhone));
            const snapCompact = await getDocs(qCompact);
            if (!snapCompact.empty) {
              foundDoc = snapCompact.docs[0];
            }
          }
        }
      }

      if (!foundDoc) {
        return {
          success: false,
          message: vi
            ? 'Tài khoản không tồn tại trong hệ thống. Vui lòng kiểm tra lại Email / Số điện thoại hoặc đăng ký tài khoản mới.'
            : 'Account does not exist in the system. Please check your Email / Phone or sign up.',
        };
      }

      const accountData = {
        id: foundDoc.id,
        ...(foundDoc.data() as Omit<UserProfile, 'id'>),
      };

      return {
        success: true,
        account: accountData,
      };
    } catch (err: any) {
      console.error('Find account for reset error:', err);
      handleFirestoreError(err, OperationType.GET, 'users');
      return {
        success: false,
        message: vi
          ? 'Không thể kiểm tra tài khoản lúc này. Vui lòng thử lại.'
          : 'Unable to verify account right now. Please try again.',
      };
    }
  };

  // Reset password for a verified existing user ID in Firestore
  const resetAccountPassword = async (
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    const vi = isViLang();
    const cleanNew = newPassword.trim();
    if (cleanNew.length < 6) {
      return {
        success: false,
        message: vi
          ? 'Mật khẩu mới phải có tối thiểu 6 ký tự.'
          : 'New password must be at least 6 characters.',
      };
    }
    if (cleanNew.length > 64) {
      return {
        success: false,
        message: vi
          ? 'Mật khẩu mới không được vượt quá 64 ký tự.'
          : 'New password cannot exceed 64 characters.',
      };
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return {
          success: false,
          message: vi
            ? 'Tài khoản không tồn tại trong hệ thống.'
            : 'Account does not exist in the system.',
        };
      }

      const passwordHash = await hashStringSHA256(cleanNew, 'tripmate_auth_pwd');
      await updateDoc(userRef, { passwordHash });

      // If resetting the currently logged-in user, keep local profile in sync
      if (userProfile && userProfile.id === userId) {
        const updatedProfile: UserProfile = {
          ...userProfile,
          passwordHash,
        };
        setUserProfile(updatedProfile);
        localStorage.setItem('tripmate_user_profile', JSON.stringify(updatedProfile));
      }

      return { success: true };
    } catch (err: any) {
      console.error('Reset password error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      return {
        success: false,
        message:
          err?.message ||
          (vi ? 'Không thể đặt lại mật khẩu. Vui lòng thử lại.' : 'Unable to reset password. Please try again.'),
      };
    }
  };

  // Change password for currently logged-in user
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    const vi = isViLang();
    if (!userProfile) {
      return {
        success: false,
        message: vi
          ? 'Bạn cần đăng nhập để thực hiện đổi mật khẩu.'
          : 'You must sign in to change your password.',
      };
    }

    const cleanCurrent = currentPassword.trim();
    const cleanNew = newPassword.trim();

    if (cleanNew.length < 6) {
      return {
        success: false,
        message: vi
          ? 'Mật khẩu mới phải có tối thiểu 6 ký tự.'
          : 'New password must be at least 6 characters.',
      };
    }
    if (cleanNew.length > 64) {
      return {
        success: false,
        message: vi
          ? 'Mật khẩu mới không được vượt quá 64 ký tự.'
          : 'New password cannot exceed 64 characters.',
      };
    }

    try {
      const userRef = doc(db, 'users', userProfile.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return {
          success: false,
          message: vi
            ? 'Tài khoản không tồn tại trong hệ thống.'
            : 'Account does not exist in the system.',
        };
      }

      const userData = userSnap.data() as UserProfile;

      if (userData.passwordHash) {
        if (!cleanCurrent) {
          return {
            success: false,
            message: vi ? 'Vui lòng nhập mật khẩu hiện tại.' : 'Please enter your current password.',
          };
        }
        const currentHash = await hashStringSHA256(cleanCurrent, 'tripmate_auth_pwd');
        if (userData.passwordHash !== currentHash && userData.passwordHash !== cleanCurrent) {
          return {
            success: false,
            message: vi ? 'Mật khẩu hiện tại không chính xác.' : 'Current password is incorrect.',
          };
        }
      }

      const newHash = await hashStringSHA256(cleanNew, 'tripmate_auth_pwd');
      if (userData.passwordHash && (userData.passwordHash === newHash || cleanCurrent === cleanNew)) {
        return {
          success: false,
          message: vi
            ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
            : 'New password must differ from current password.',
        };
      }

      await updateDoc(userRef, { passwordHash: newHash });

      const updatedProfile: UserProfile = {
        ...userProfile,
        ...userData,
        id: userProfile.id,
        passwordHash: newHash,
      };
      setUserProfile(updatedProfile);
      localStorage.setItem('tripmate_user_profile', JSON.stringify(updatedProfile));

      return { success: true };
    } catch (err: any) {
      console.error('Change password error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.id}`);
      return {
        success: false,
        message:
          err?.message ||
          (vi
            ? 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.'
            : 'Unable to change password right now. Please try again.'),
      };
    }
  };

  // Update logged-in user's avatar & propagate sync event to trips (banner + expenses)
  const updateUserAvatar = async (
    avatarUrl: string
  ): Promise<{ success: boolean; message?: string }> => {
    const vi = isViLang();
    if (!userProfile) {
      return {
        success: false,
        message: vi ? 'Bạn cần đăng nhập để cập nhật ảnh đại diện.' : 'Please sign in to update your avatar.',
      };
    }

    const cleanAvatar = (avatarUrl || '').trim();
    if (!cleanAvatar) {
      return {
        success: false,
        message: vi ? 'Ảnh đại diện không hợp lệ.' : 'Invalid avatar image.',
      };
    }
    if (cleanAvatar.length > 60000) {
      return {
        success: false,
        message: vi
          ? 'Ảnh quá lớn, vui lòng chọn ảnh có dung lượng nhỏ hơn.'
          : 'Image is too large, please choose a smaller image.',
      };
    }

    try {
      const userRef = doc(db, 'users', userProfile.id);
      await updateDoc(userRef, { avatar: cleanAvatar });

      const updatedProfile: UserProfile = {
        ...userProfile,
        avatar: cleanAvatar,
      };
      setUserProfile(updatedProfile);
      localStorage.setItem('tripmate_user_profile', JSON.stringify(updatedProfile));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tripmate_user_avatar_updated', {
            detail: { userId: userProfile.id, avatar: cleanAvatar, userProfile: updatedProfile },
          })
        );
      }

      return { success: true };
    } catch (err: any) {
      console.error('Update avatar error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.id}`);
      return {
        success: false,
        message: err?.message || (vi ? 'Không thể lưu ảnh đại diện. Vui lòng thử lại.' : 'Unable to save avatar.'),
      };
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      localStorage.removeItem('tripmate_user_profile');
      localStorage.removeItem('tripmate_trips');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Search registered user by email or phone
  const searchRegisteredUser = async (searchVal: string): Promise<UserProfile | null> => {
    const val = searchVal.trim().toLowerCase();
    if (!val) return null;

    try {
      const usersRef = collection(db, 'users');
      // 1. Search by email
      const qEmail = query(usersRef, where('email', '==', val));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const d = snapEmail.docs[0];
        return { id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) };
      }

      // 2. Search by phone
      const qPhone = query(usersRef, where('phone', '==', val));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        const d = snapPhone.docs[0];
        return { id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) };
      }
    } catch (err) {
      console.warn('User search error:', err);
    }
    return null;
  };

  // Accept or decline trip invitation
  const respondToInvitation = async (invitationId: string, accept: boolean, tripId: string) => {
    try {
      const invRef = doc(db, 'invitations', invitationId);
      const newStatus = accept ? 'accepted' : 'declined';
      await updateDoc(invRef, {
        status: newStatus,
        respondedAt: new Date().toISOString(),
      });

      // Update local state immediately
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: newStatus } : i))
      );

      // If accepted, also sync directly into the trip's members in Firestore
      let acceptedTripSnapshot: any = null;
      if (accept && userProfile) {
        try {
          const tripRef = doc(db, 'trips', tripId);
          const tripSnap = await getDoc(tripRef);
          if (tripSnap.exists()) {
            const tripData = tripSnap.data() as any;
            const existingMembers: any[] = Array.isArray(tripData.members) ? tripData.members : [];
            const idx = existingMembers.findIndex(
              (m) =>
                (invitationId && m.invitationId === invitationId) ||
                (m.uid && m.uid === userProfile.id) ||
                (m.email && m.email.toLowerCase() === userProfile.email.toLowerCase()) ||
                (userProfile.phone && m.phone === userProfile.phone)
            );
            const updatedMembers = [...existingMembers];
            if (idx >= 0) {
              updatedMembers[idx] = {
                ...updatedMembers[idx],
                uid: userProfile.id,
                name: userProfile.displayName,
                avatar: userProfile.avatar || updatedMembers[idx].avatar,
                email: userProfile.email,
                phone: userProfile.phone,
                isRegistered: true,
                invitationStatus: 'accepted',
              };
            } else {
              updatedMembers.push({
                id: `m-${userProfile.id}`,
                name: userProfile.displayName,
                avatar: userProfile.avatar,
                email: userProfile.email,
                phone: userProfile.phone,
                uid: userProfile.id,
                isRegistered: true,
                invitationStatus: 'accepted',
                contributedAmount: 0,
              });
            }
            const memberUids = Array.from(new Set([...(tripData.memberUids || []), userProfile.id]));
            await updateDoc(tripRef, {
              members: updatedMembers,
              memberUids,
            });
            acceptedTripSnapshot = {
              id: tripId,
              ...tripData,
              members: updatedMembers,
              memberUids,
            };
          }
        } catch (tripSyncErr) {
          console.warn('Error updating trip members on accept:', tripSyncErr);
        }
      }

      // Trigger event or callback for trip synchronization
      window.dispatchEvent(
        new CustomEvent('tripmate_invitation_responded', {
          detail: {
            invitationId,
            tripId,
            accept,
            userProfile,
            updatedTrip: acceptedTripSnapshot,
          },
        })
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invitations/${invitationId}`);
    }
  };

  const markUserNotificationsRead = async (notificationIds: string[]) => {
    const cleanIds = Array.from(new Set(notificationIds.filter(Boolean)));
    if (cleanIds.length === 0) return;
    const readAt = new Date().toISOString();
    setUserNotifications((prev) =>
      prev.map((n) => (cleanIds.includes(n.id) ? { ...n, status: 'read', readAt } : n))
    );
    await Promise.all(
      cleanIds.map((nid) =>
        updateDoc(doc(db, 'user_notifications', nid), {
          status: 'read',
          readAt,
        }).catch((err) => console.warn('Failed marking user notification read:', err))
      )
    );
  };

  const unreadInvitationsCount = invitations.filter((i) => i.status === 'pending').length;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isLoading,
        loginWithGoogle,
        loginWithEmailAndPhone,
        updateUserAvatar,
        changePassword,
        findAccountForReset,
        resetAccountPassword,
        logout,
        invitations,
        unreadInvitationsCount,
        respondToInvitation,
        userNotifications,
        markUserNotificationsRead,
        searchRegisteredUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalView,
        setAuthModalView,
        openAuthModal,
        isNotificationsModalOpen,
        setIsNotificationsModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
