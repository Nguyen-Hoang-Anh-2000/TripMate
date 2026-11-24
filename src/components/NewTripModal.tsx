import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  AlertCircle,
  Search,
  Check,
  Mail,
  Loader2,
  ChevronDown,
  UserPlus,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { Trip, ItineraryDay, TripMember, UserProfile } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { getLocalDateString } from '../utils/dateUtils';
import { compressImage } from '../utils/imageUtils';
import { buildDefaultAvatar } from '../utils/avatarSyncUtils';
import { normalizeText } from '../utils/itineraryPlannerUtils';
import { InterestsComboSelect } from './InterestsComboSelect';

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTrip: (newTrip: Trip, openAiArchitect?: boolean) => void;
}

interface PendingInviteDraft {
  key: string;
  uid?: string;
  name: string;
  email?: string;
  phone?: string;
  avatar: string;
  isRegistered: boolean;
}

const COVER_PRESETS = [
  { key: 'preset.dalat', defaultLabel: 'Việt Nam / Đà Lạt', url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.vungtau', defaultLabel: 'Việt Nam / Vũng Tàu', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.phuquoc', defaultLabel: 'Việt Nam / Phú Quốc', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.japan', defaultLabel: 'Nhật Bản / Tokyo', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.amalfi', defaultLabel: 'Ý / Amalfi', url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.paris', defaultLabel: 'Pháp / Paris', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80' },
];

const inferCountryFromDestination = (dest: string, isVi: boolean): string => {
  const n = normalizeText(dest);
  if (!n) return '';
  if (/(da lat|vung tau|phu quoc|da nang|nha trang|ha noi|sai gon|ho chi minh|tp hcm|hoi an|hue|sapa|sa pa|quy nhon|phan thiet|mui ne|can tho|ha long|ninh binh|ha giang|con dao|cat ba|moc chau|tam dao|binh thuan|khanh hoa|lam dong|kien giang|viet nam|vietnam)/.test(n)) {
    return isVi ? 'Việt Nam' : 'Vietnam';
  }
  if (/(tokyo|kyoto|osaka|sapporo|fukuoka|nagoya|nara|okinawa|nhat ban|japan)/.test(n)) {
    return isVi ? 'Nhật Bản' : 'Japan';
  }
  if (/(seoul|busan|jeju|incheon|han quoc|korea)/.test(n)) {
    return isVi ? 'Hàn Quốc' : 'South Korea';
  }
  if (/(bangkok|phuket|chiang mai|pattaya|krabi|thai lan|thailand)/.test(n)) {
    return isVi ? 'Thái Lan' : 'Thailand';
  }
  if (/singapore/.test(n)) return 'Singapore';
  if (/(paris|nice|lyon|marseille|phap|france)/.test(n)) {
    return isVi ? 'Pháp' : 'France';
  }
  if (/(london|manchester|edinburgh|anh|united kingdom|uk)/.test(n)) {
    return isVi ? 'Anh' : 'United Kingdom';
  }
  if (/(rome|milan|venice|florence|amalfi|italy|italia)/.test(n)) {
    return isVi ? 'Ý' : 'Italy';
  }
  if (/(taipei|taichung|kaohsiung|dai loan|taiwan)/.test(n)) {
    return isVi ? 'Đài Loan' : 'Taiwan';
  }
  if (/(kuala lumpur|penang|malaysia)/.test(n)) return 'Malaysia';
  if (/(bali|jakarta|indonesia)/.test(n)) return 'Indonesia';
  if (/(sydney|melbourne|brisbane|uc|australia)/.test(n)) {
    return isVi ? 'Úc' : 'Australia';
  }
  if (/(new york|los angeles|san francisco|las vegas|usa|america)/.test(n)) {
    return isVi ? 'Mỹ' : 'United States';
  }
  return '';
};

export const NewTripModal: React.FC<NewTripModalProps> = ({
  isOpen,
  onClose,
  onCreateTrip,
}) => {
  const { lang, t } = useLanguage();
  const { userProfile, searchRegisteredUser } = useAuth();
  const isVi = lang === 'vi';

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetTotal, setBudgetTotal] = useState(isVi ? '5000000' : '500');
  const [currency, setCurrency] = useState(isVi ? 'VND' : 'USD');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0].url);
  const [uploadError, setUploadError] = useState('');
  const [tripFormError, setTripFormError] = useState<string | null>(null);

  // Interests combo selectbox state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Invite members combo selectbox state
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isMemberInputFocused, setIsMemberInputFocused] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [invitedMembers, setInvitedMembers] = useState<PendingInviteDraft[]>([]);
  const [isSearchingExactUser, setIsSearchingExactUser] = useState(false);

  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const memberSearchInputRef = useRef<HTMLInputElement>(null);

  // Inline checkbox: open AI itinerary after creating trip if checked
  const [wantSuggestedItinerary, setWantSuggestedItinerary] = useState(false);

  // Helper to reset all form inputs to pristine state
  const resetForm = () => {
    setTitle('');
    setDestination('');
    setCountry('');
    setStartDate('');
    setEndDate('');
    setBudgetTotal(isVi ? '5000000' : '500');
    setCurrency(isVi ? 'VND' : 'USD');
    setCoverImage(COVER_PRESETS[0].url);
    setUploadError('');
    setTripFormError(null);
    setSelectedInterests([]);
    setInvitedMembers([]);
    setMemberSearchTerm('');
    setIsMemberDropdownOpen(false);
    setIsMemberInputFocused(false);
    setWantSuggestedItinerary(false);
  };

  // Reset form and fetch registered TripMate accounts whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    resetForm();

    let cancelled = false;
    const loadRegisteredUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (cancelled) return;
        const currentEmail = (userProfile?.email || '').trim().toLowerCase();
        const currentPhone = (userProfile?.phone || '').replace(/[\s\-().]/g, '').trim();
        const seenKeys = new Set<string>();
        const list: UserProfile[] = [];

        snap.forEach((d) => {
          const data = d.data() as Omit<UserProfile, 'id'>;
          const uid = d.id;
          const email = (data.email || '').trim().toLowerCase();
          const phone = (data.phone || '').replace(/[\s\-().]/g, '').trim();

          if (userProfile?.id && uid === userProfile.id) return;
          if (currentEmail && email && email === currentEmail) return;
          if (currentPhone && phone && phone === currentPhone) return;
          if (!data.displayName && !email) return;

          const dedupeKey = email || uid;
          if (seenKeys.has(dedupeKey)) return;
          seenKeys.add(dedupeKey);

          list.push({
            ...data,
            id: uid,
          });
        });

        list.sort((a, b) =>
          (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'vi')
        );
        setRegisteredUsers(list);
      } catch (err) {
        console.warn('Unable to load TripMate users list:', err);
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    };

    loadRegisteredUsers();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userProfile?.id, userProfile?.email, userProfile?.phone]);

  // Close invite member dropdown on outside click or Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setIsMemberDropdownOpen(false);
        setIsMemberInputFocused(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMemberDropdownOpen(false);
        setIsMemberInputFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Exact email/phone fallback search when typing in invite member box
  useEffect(() => {
    const trimmed = memberSearchTerm.trim();
    if (trimmed.length < 3) return;
    const looksLikeContact = trimmed.includes('@') || /^[+0-9\s\-()]{6,}$/.test(trimmed);
    if (!looksLikeContact) return;

    const alreadyListed = registeredUsers.some(
      (u) =>
        (u.email || '').toLowerCase() === trimmed.toLowerCase() ||
        (u.phone || '').replace(/[\s\-().]/g, '') === trimmed.replace(/[\s\-().]/g, '')
    );
    if (alreadyListed) return;

    const timer = setTimeout(async () => {
      setIsSearchingExactUser(true);
      try {
        const found = await searchRegisteredUser(trimmed);
        if (found && found.id !== userProfile?.id) {
          setRegisteredUsers((prev) =>
            prev.some((u) => u.id === found.id) ? prev : [found, ...prev]
          );
        }
      } catch (err) {
        console.warn('Exact user search error:', err);
      } finally {
        setIsSearchingExactUser(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [memberSearchTerm, registeredUsers, searchRegisteredUser, userProfile?.id]);

  const filteredRegisteredUsers = useMemo(() => {
    const rawLower = memberSearchTerm.trim().toLowerCase();
    const cleanPhoneQuery = rawLower.replace(/[\s\-().]/g, '');
    const q = normalizeText(memberSearchTerm);
    if (!rawLower) return [];
    return registeredUsers.filter((u) => {
      const emailLower = (u.email || '').toLowerCase();
      const phoneClean = (u.phone || '').replace(/[\s\-().]/g, '');
      const nameNorm = normalizeText(u.displayName || '');
      return (
        emailLower.includes(rawLower) ||
        (phoneClean && cleanPhoneQuery && phoneClean.includes(cleanPhoneQuery)) ||
        (q && nameNorm.includes(q))
      );
    });
  }, [registeredUsers, memberSearchTerm]);

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Calculate day count between start and end date
  const getDaysCount = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 3;
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = e.getTime() - s.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const effectiveStartDate = startDate || getLocalDateString();
  const effectiveEndDate = endDate || getLocalDateString(Date.now() + 86400000 * 2);

  // Toggle selecting/deselecting a registered user to invite
  const handleToggleRegisteredInvitee = (user: UserProfile) => {
    const draftKey = `uid:${user.id}`;
    const exists = invitedMembers.some((m) => m.key === draftKey || (m.uid && m.uid === user.id));
    if (exists) {
      setInvitedMembers((prev) => prev.filter((m) => m.key !== draftKey && m.uid !== user.id));
    } else {
      setInvitedMembers((prev) => [
        ...prev,
        {
          key: draftKey,
          uid: user.id,
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          phone: user.phone,
          avatar: user.avatar || buildDefaultAvatar(user.displayName || user.email),
          isRegistered: true,
        },
      ]);
    }
  };

  const handleRemoveInvitee = (draftKey: string) => {
    setInvitedMembers((prev) => prev.filter((m) => m.key !== draftKey));
  };

  const handleAddOfflineInvitee = (rawInput: string) => {
    const clean = rawInput.trim();
    if (!clean) return;
    const isEmail = clean.includes('@');
    const isPhone = /^[+0-9\s\-()]{6,}$/.test(clean);
    const displayName = isEmail ? clean.split('@')[0] : clean;
    const draftKey = `offline:${Date.now()}:${clean.toLowerCase()}`;
    setInvitedMembers((prev) => [
      ...prev,
      {
        key: draftKey,
        name: displayName,
        ...(isEmail ? { email: clean } : {}),
        ...(isPhone ? { phone: clean } : {}),
        avatar: buildDefaultAvatar(displayName),
        isRegistered: false,
      },
    ]);
    setMemberSearchTerm('');
  };

  // Handle local image file upload from mobile or desktop
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(isVi ? 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).' : 'Please select an image file.');
      return;
    }
    setUploadError('');

    try {
      const compressedDataUrl = await compressImage(file, 1400, 0.75);
      setCoverImage(compressedDataUrl);
    } catch (err) {
      console.warn('Cover compression error, falling back:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setCoverImage(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate completely empty days without any prefilled activities
  const generateEmptyDays = (startStr: string, endStr: string): ItineraryDay[] => {
    const daysCount = getDaysCount(startStr, endStr);
    const s = new Date(startStr);

    return Array.from({ length: daysCount }, (_, idx) => {
      const dayNum = idx + 1;
      const dateObj = new Date(s);
      dateObj.setDate(s.getDate() + idx);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      const formattedDate = `${dd}/${mm}/${yyyy}`;

      return {
        dayNumber: dayNum,
        date: isVi ? `Ngày ${dayNum} - ${formattedDate}` : `Day ${dayNum} - ${formattedDate}`,
        title: isVi ? `Ngày ${dayNum}` : `Day ${dayNum}`,
        summary: '',
        activities: [],
      };
    });
  };

  // Create trip directly: open AI Itinerary only if user checked "Tạo lịch trình gợi ý"
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTripFormError(null);
    if (!title.trim()) {
      setTripFormError(isVi ? 'Vui lòng nhập tên chuyến đi.' : 'Please enter a trip title.');
      return;
    }
    if (!destination.trim()) {
      setTripFormError(isVi ? 'Vui lòng nhập điểm đến.' : 'Please enter a destination.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setTripFormError(isVi ? 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' : 'End date must be on or after the start date.');
      return;
    }
    setIsMemberDropdownOpen(false);
    handleConfirmCreate(wantSuggestedItinerary);
  };

  const handleConfirmCreate = (openAiItinerary: boolean) => {
    const finalDays = generateEmptyDays(effectiveStartDate, effectiveEndDate);
    const nowTs = Date.now();

    const shouldIncludeCreator = Boolean(
      userProfile?.id || openAiItinerary || invitedMembers.length > 0
    );

    const creatorMember: TripMember = {
      id: 'm1',
      ...(userProfile?.id ? { uid: userProfile.id } : {}),
      name: userProfile?.displayName || (isVi ? 'Bạn (Trưởng nhóm)' : 'Alex Rivera (You)'),
      ...(userProfile?.email ? { email: userProfile.email } : {}),
      ...(userProfile?.phone ? { phone: userProfile.phone } : {}),
      avatar: userProfile?.avatar || buildDefaultAvatar(userProfile?.displayName || 'TripMate'),
      ...(userProfile?.id ? { isRegistered: true, invitationStatus: 'accepted' as const } : {}),
      contributedAmount: 0,
    };

    const invitedTripMembers: TripMember[] = invitedMembers.map((inv, idx) => {
      const memberId = `m-${nowTs}-${idx + 1}`;
      if (inv.isRegistered && inv.uid) {
        return {
          id: memberId,
          name: inv.name,
          avatar: inv.avatar || buildDefaultAvatar(inv.name),
          ...(inv.email ? { email: inv.email } : {}),
          ...(inv.phone ? { phone: inv.phone } : {}),
          uid: inv.uid,
          isRegistered: true,
          invitationStatus: 'pending',
          invitationId: `inv-${nowTs}-${idx + 1}`,
          contributedAmount: 0,
        };
      }
      return {
        id: memberId,
        name: inv.name,
        avatar: inv.avatar || buildDefaultAvatar(inv.name),
        ...(inv.email ? { email: inv.email } : {}),
        ...(inv.phone ? { phone: inv.phone } : {}),
        isRegistered: false,
        invitationStatus: 'offline',
        contributedAmount: 0,
      };
    });

    const finalMembers = shouldIncludeCreator
      ? [creatorMember, ...invitedTripMembers]
      : [];

    const inferredCountry = inferCountryFromDestination(destination.trim(), isVi);
    const newTrip: Trip = {
      id: `trip-${nowTs}`,
      title: title.trim(),
      destination: destination.trim(),
      country: country.trim() || inferredCountry || destination.trim(),
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      coverImage: coverImage || COVER_PRESETS[0].url,
      budgetTotal: (() => {
        if (!budgetTotal) return isVi ? 5000000 : 500;
        const parsed = parseFloat(budgetTotal);
        if (isNaN(parsed) || parsed < 0) return isVi ? 5000000 : 500;
        return Math.min(parsed, 100000000000);
      })(),
      currency,
      ...(selectedInterests.length > 0 ? { interests: selectedInterests } : {}),
      ...(userProfile?.id ? { creatorId: userProfile.id } : {}),
      ...(userProfile?.displayName ? { creatorName: userProfile.displayName } : {}),
      ...(userProfile?.id ? { memberUids: [userProfile.id] } : {}),
      members: finalMembers,
      ...(finalMembers.length > 0 ? { fundHolderId: 'm1' } : {}),
      days: finalDays,
      expenses: [],
      packingList: [],
      documents: [],
    };

    // If user checked "Tạo lịch trình gợi ý", pass openAiArchitect: true so the AI Itinerary modal opens
    onCreateTrip(newTrip, openAiItinerary);
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <h3 className="font-display font-bold text-sm sm:text-base">
            {t('newTrip.modalTitle')}
          </h3>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <form noValidate onSubmit={handleFormSubmit} className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-3.5">
            {(uploadError || tripFormError) && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{tripFormError || uploadError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldTitle')} *</label>
              <input
                type="text"
                required
                placeholder={t('newTrip.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldDest')} *</label>
                <input
                  type="text"
                  required
                  placeholder={t('newTrip.destPlaceholder')}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldCountry')}</label>
                <input
                  type="text"
                  placeholder={t('newTrip.countryPlaceholder')}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldStart')}</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    if (endDate && newStart && endDate < newStart) {
                      setEndDate(newStart);
                    }
                  }}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldEnd')}</label>
                <input
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    if (startDate && newEnd && newEnd < startDate) {
                      setEndDate(startDate);
                    } else {
                      setEndDate(newEnd);
                    }
                  }}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldBudget')}</label>
                <input
                  type="number"
                  min="0"
                  max="100000000000"
                  step="any"
                  placeholder={t('newTrip.budgetPlaceholder')}
                  value={budgetTotal}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setBudgetTotal('');
                      return;
                    }
                    const num = parseFloat(val);
                    if (!isNaN(num) && num >= 0 && num <= 100000000000) {
                      setBudgetTotal(val);
                    }
                  }}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldCurrency')}</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all cursor-pointer"
                >
                  <option value="USD">USD ($)</option>
                  <option value="VND">VND (₫)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            {/* Sở thích - Combo Selectbox */}
            <InterestsComboSelect
              selectedIds={selectedInterests}
              onChange={setSelectedInterests}
              isVi={isVi}
              label={isVi ? 'Sở thích' : 'Interests'}
              placeholder={isVi ? 'Chọn sở thích chuyến đi...' : 'Select trip interests...'}
              dropdownId="new-trip-interests"
            />

            {/* Thành viên (Tất cả nằm gọn trong Combobox) */}
            <div ref={memberDropdownRef} className="relative space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="new-trip-invite-member-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {isVi ? 'Thành viên' : 'Members'}
                </label>
                {invitedMembers.length > 0 && (
                  <span className="text-[11px] font-semibold text-teal-700">
                    {isVi
                      ? `Đã chọn ${invitedMembers.length} người`
                      : `${invitedMembers.length} invited`}
                  </span>
                )}
              </div>

              {/* Combobox Field: Displays selected summary when closed, or direct email/phone search input */}
              <div
                onClick={() => {
                  setIsMemberInputFocused(true);
                  if (memberSearchTerm.trim().length > 0 || invitedMembers.length > 0) {
                    setIsMemberDropdownOpen(true);
                  }
                  setTimeout(() => memberSearchInputRef.current?.focus(), 0);
                }}
                className={`relative flex items-center rounded-xl border transition-all ${
                  isMemberDropdownOpen || isMemberInputFocused
                    ? 'bg-white border-teal-500 ring-2 ring-teal-500/20'
                    : 'bg-slate-50/40 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-teal-600 ml-3 shrink-0 pointer-events-none" />

                {invitedMembers.length > 0 && !isMemberInputFocused && !memberSearchTerm ? (
                  <div className="flex-1 min-w-0 px-2.5 py-2.5 sm:py-3 text-xs font-medium text-slate-800 truncate cursor-text">
                    {invitedMembers.length <= 2
                      ? invitedMembers.map((m) => m.name).join(', ')
                      : `${invitedMembers.slice(0, 2).map((m) => m.name).join(', ')} (+${invitedMembers.length - 2})`}
                  </div>
                ) : (
                  <input
                    id="new-trip-invite-member-input"
                    ref={memberSearchInputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={
                      isMemberDropdownOpen &&
                      (memberSearchTerm.trim().length > 0 || invitedMembers.length > 0)
                    }
                    aria-controls="new-trip-invite-members-listbox"
                    aria-autocomplete="list"
                    value={memberSearchTerm}
                    onFocus={() => {
                      setIsMemberInputFocused(true);
                      if (memberSearchTerm.trim().length > 0 || invitedMembers.length > 0) {
                        setIsMemberDropdownOpen(true);
                      }
                    }}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setMemberSearchTerm(nextVal);
                      setIsMemberDropdownOpen(nextVal.trim().length > 0 || invitedMembers.length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder={
                      invitedMembers.length > 0
                        ? isVi
                          ? 'Nhập thêm email hoặc SĐT để tìm...'
                          : 'Enter another email or phone...'
                        : isVi
                        ? 'Nhập email hoặc số điện thoại để gợi ý tích chọn...'
                        : 'Enter email or phone to see suggestions...'
                    }
                    className="w-full min-w-0 px-2.5 py-2.5 sm:py-3 text-xs bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                  />
                )}

                {memberSearchTerm ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemberSearchTerm('');
                      if (invitedMembers.length === 0) {
                        setIsMemberDropdownOpen(false);
                      }
                    }}
                    aria-label={isVi ? 'Xóa tìm kiếm thành viên' : 'Clear member search'}
                    className="p-1.5 mr-1.5 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : invitedMembers.length > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextOpen = !isMemberDropdownOpen;
                      setIsMemberDropdownOpen(nextOpen);
                      setIsMemberInputFocused(nextOpen);
                      if (nextOpen) {
                        setTimeout(() => memberSearchInputRef.current?.focus(), 0);
                      }
                    }}
                    aria-label={isVi ? 'Xem thành viên đã chọn' : 'View selected members'}
                    className="p-1.5 mr-1.5 text-slate-400 hover:text-teal-700 cursor-pointer shrink-0"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-150 ${
                        isMemberDropdownOpen ? 'rotate-180 text-teal-600' : ''
                      }`}
                    />
                  </button>
                ) : null}
              </div>

              {/* Suggestions & Selected Members Dropdown (strictly inside Combobox, never rendered outside) */}
              {isMemberDropdownOpen &&
                (memberSearchTerm.trim().length > 0 || invitedMembers.length > 0) && (
                  <div
                    id="new-trip-invite-members-listbox"
                    role="listbox"
                    aria-multiselectable="true"
                    className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/80">
                      {/* Matching Suggestions when typing email or phone */}
                      {memberSearchTerm.trim().length > 0 && (
                        <>
                          {isLoadingUsers || isSearchingExactUser ? (
                            <div className="px-3 py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                              <span>
                                {isVi
                                  ? 'Đang tìm tài khoản phù hợp...'
                                  : 'Searching matching accounts...'}
                              </span>
                            </div>
                          ) : filteredRegisteredUsers.length === 0 ? (
                            <div className="p-2.5 space-y-2 text-center">
                              <div className="text-[11px] text-slate-500">
                                {isVi
                                  ? 'Không tìm thấy tài khoản TripMate khớp từ khóa này.'
                                  : 'No TripMate account matches this search.'}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddOfflineInvitee(memberSearchTerm)}
                                className="w-full py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span className="truncate">
                                  {isVi
                                    ? `+ Thêm "${memberSearchTerm.trim()}" làm thành viên ngoại tuyến`
                                    : `+ Add "${memberSearchTerm.trim()}" as offline member`}
                                </span>
                              </button>
                            </div>
                          ) : (
                            filteredRegisteredUsers.map((account) => {
                              const isSelected = invitedMembers.some(
                                (m) => m.uid === account.id || m.key === `uid:${account.id}`
                              );
                              return (
                                <button
                                  key={account.id}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => handleToggleRegisteredInvitee(account)}
                                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-teal-50/80 text-teal-900'
                                      : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <img
                                      src={
                                        account.avatar ||
                                        buildDefaultAvatar(account.displayName || account.email)
                                      }
                                      alt={account.displayName}
                                      className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                                        <span className="truncate">{account.displayName}</span>
                                        <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                                          TripMate
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {account.email}
                                        {account.phone ? ` • ${account.phone}` : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <span
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? 'bg-teal-600 border-teal-600 text-white'
                                        : 'border-slate-300 bg-white'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </>
                      )}

                      {/* Already Checked / Selected Members kept inside Combobox */}
                      {invitedMembers.length > 0 && memberSearchTerm.trim().length === 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
                            {isVi
                              ? `Thành viên đã chọn (${invitedMembers.length})`
                              : `Selected members (${invitedMembers.length})`}
                          </div>
                          {invitedMembers.map((member) => (
                            <button
                              key={member.key}
                              type="button"
                              role="option"
                              aria-selected={true}
                              onClick={() => handleRemoveInvitee(member.key)}
                              className="w-full flex items-center justify-between gap-2.5 px-3 py-2 text-left text-xs bg-teal-50/60 hover:bg-teal-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <img
                                  src={member.avatar}
                                  alt={member.name}
                                  className="w-7 h-7 rounded-full object-cover border border-teal-200 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                                    <span className="truncate">{member.name}</span>
                                    <span
                                      className={`text-[10px] font-medium px-1.5 py-0.2 rounded shrink-0 ${
                                        member.isRegistered
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}
                                    >
                                      {member.isRegistered
                                        ? isVi
                                          ? 'Mời qua app'
                                          : 'App invite'
                                        : isVi
                                        ? 'Ngoại tuyến'
                                        : 'Offline'}
                                    </span>
                                  </div>
                                  {(member.email || member.phone) && (
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {member.email || member.phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="w-4 h-4 rounded-md border bg-teal-600 border-teal-600 text-white flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>

                    <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-100">
                      <div className="text-[11px] text-slate-600 flex items-start gap-1.5 leading-snug">
                        <Mail className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>
                          {isVi
                            ? 'Tài khoản đã tích chọn sẽ nhận lời mời qua app'
                            : 'Checked accounts receive an in-app invitation'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">{isVi ? 'Ảnh bìa chuyến đi' : 'Cover Photo'}</label>
                <label
                  htmlFor="new-trip-cover-upload"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-teal-600" />
                  <span>{isVi ? 'Tải ảnh' : 'Upload photo'}</span>
                </label>
                <input
                  id="new-trip-cover-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Current Cover Preview */}
              {coverImage && (
                <div className="relative rounded-2xl overflow-hidden h-32 sm:h-40 border border-slate-200 group">
                  <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <label
                      htmlFor="new-trip-cover-upload"
                      className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-xl text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Đổi ảnh' : 'Change photo'}</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Suggested AI Itinerary Checkbox */}
            <label
              htmlFor="new-trip-suggest-ai-checkbox"
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors cursor-pointer select-none ${
                wantSuggestedItinerary
                  ? 'bg-teal-50/70 border-teal-300'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                id="new-trip-suggest-ai-checkbox"
                type="checkbox"
                checked={wantSuggestedItinerary}
                onChange={(e) => setWantSuggestedItinerary(e.target.checked)}
                className="w-4 h-4 rounded-md border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0 accent-teal-600"
              />
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>{isVi ? 'Tạo lịch trình gợi ý' : 'Generate suggested itinerary'}</span>
              </div>
            </label>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{isVi ? 'Tạo chuyến đi' : 'Create Trip'}</span>
              </button>
            </div>
          </form>

      </div>
    </div>
  );
};
