import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  signInAnonymously
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
import { UserProfile, TripInvitation } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmailAndPhone: (email: string, displayName?: string, phone?: string, isRegister?: boolean) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  invitations: TripInvitation[];
  unreadInvitationsCount: number;
  respondToInvitation: (invitationId: string, accept: boolean, tripId: string) => Promise<void>;
  searchRegisteredUser: (searchVal: string) => Promise<UserProfile | null>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isNotificationsModalOpen: boolean;
  setIsNotificationsModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

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

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Load existing profile from cache first for fast render
        const cached = localStorage.getItem('tripmate_user_profile');
        if (cached) {
          try {
            setUserProfile(JSON.parse(cached));
          } catch {}
        }
        await syncUserProfile(user);
      } else {
        setUserProfile(null);
        localStorage.removeItem('tripmate_user_profile');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to in-app invitations for active user profile or currentUser
  useEffect(() => {
    const targetUid = userProfile?.id || currentUser?.uid;
    if (!targetUid) {
      setInvitations([]);
      return;
    }

    try {
      const invRef = collection(db, 'invitations');
      const q = query(
        invRef,
        where('inviteeUid', '==', targetUid)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const list: TripInvitation[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<TripInvitation, 'id'>) });
        });
        setInvitations(list);
      }, (err) => {
        console.warn('Error listening to invitations:', err);
      });

      return () => unsub();
    } catch (e) {
      console.warn('Firestore invitation query error:', e);
    }
  }, [currentUser, userProfile?.id]);

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await syncUserProfile(res.user);
        setIsAuthModalOpen(false);
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      alert('Không thể mở popup Google trong khung xem trước. Bạn có thể sử dụng tính năng "Đăng ký / Đăng nhập bằng Email/SĐT".');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign In / Registration with Email & Phone
  const DEMO_EMAILS = ['perrynguyen10@gmail.com', 'linhchi@tripmate.app', 'minhquan@tripmate.app', 'khanhvy@tripmate.app'];

  const loginWithEmailAndPhone = async (
    emailOrPhone: string, 
    displayName?: string, 
    phone?: string,
    isRegister?: boolean
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true);
      const cleanInput = emailOrPhone.trim().toLowerCase();
      const cleanPhone = (phone || '').trim();
      const isInputEmail = cleanInput.includes('@');
      const cleanEmail = isInputEmail ? cleanInput : '';
      const fallbackPhone = !isInputEmail ? cleanInput : cleanPhone;

      // Ensure valid Firebase Auth session
      let user = auth.currentUser;
      if (!user) {
        const res = await signInAnonymously(auth);
        user = res.user;
      }

      const usersRef = collection(db, 'users');

      // ----------------------------------------------------------------------
      // CASE 1: ĐĂNG KÝ TÀI KHOẢN MỚI (isRegister === true)
      // Đảm bảo Email và Số điện thoại KHÔNG ĐƯỢC TRÙNG với tài khoản đã đăng ký
      // ----------------------------------------------------------------------
      if (isRegister) {
        if (!cleanEmail) {
          return {
            success: false,
            message: 'Vui lòng nhập địa chỉ Email hợp lệ.'
          };
        }

        // 1. Kiểm tra trùng Email
        const qEmail = query(usersRef, where('email', '==', cleanEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          return {
            success: false,
            message: 'Email này đã được đăng ký tài khoản. Vui lòng nhập Email khác hoặc chuyển sang tab Đăng nhập.'
          };
        }

        // 2. Kiểm tra trùng Số điện thoại (nếu có nhập)
        if (cleanPhone) {
          const qPhone = query(usersRef, where('phone', '==', cleanPhone));
          const snapPhone = await getDocs(qPhone);
          if (!snapPhone.empty) {
            return {
              success: false,
              message: 'Số điện thoại này đã được sử dụng cho tài khoản khác. Vui lòng nhập số điện thoại khác.'
            };
          }
        }

        // Tạo tài khoản mới hợp lệ
        const targetUid = user.uid;
        const finalName = displayName?.trim() || cleanEmail.split('@')[0];
        const finalAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalName)}`;

        const profile: UserProfile = {
          id: targetUid,
          displayName: finalName,
          email: cleanEmail,
          phone: cleanPhone,
          avatar: finalAvatar,
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
        }
      }

      // Nếu là tài khoản Demo mẫu và chưa được tạo trên Firestore, tự động khởi tạo để sẵn sàng test
      const isDemo = DEMO_EMAILS.includes(cleanEmail);
      if (!existingUserDoc && isDemo) {
        const targetUid = user.uid;
        const finalName = displayName?.trim() || cleanEmail.split('@')[0];
        const finalAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalName)}`;
        const demoProfile: UserProfile = {
          id: targetUid,
          displayName: finalName,
          email: cleanEmail,
          phone: cleanPhone || '',
          avatar: finalAvatar,
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
          message: 'Tài khoản chưa được đăng ký trong hệ thống. Vui lòng chuyển sang tab Đăng ký tài khoản mới.'
        };
      }

      // Đăng nhập thành công với tài khoản đã tìm thấy
      const data = existingUserDoc.data() as UserProfile;
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
      return { success: false, message: err?.message || 'Lỗi xử lý xác thực.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      localStorage.removeItem('tripmate_user_profile');
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

      // Trigger event or callback for trip synchronization
      window.dispatchEvent(
        new CustomEvent('tripmate_invitation_responded', {
          detail: {
            invitationId,
            tripId,
            accept,
            userProfile,
          },
        })
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invitations/${invitationId}`);
    }
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
        logout,
        invitations,
        unreadInvitationsCount,
        respondToInvitation,
        searchRegisteredUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
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
