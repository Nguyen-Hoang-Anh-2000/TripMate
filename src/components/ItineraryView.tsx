import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Clock, MapPin, Plus, CheckCircle2, Circle, Trash2, 
  Sparkles, Utensils, Hotel, Car, Camera, ShoppingBag, Compass, Tag, X,
  Search, Calendar, Filter, ChevronDown, ChevronUp, Edit3, ExternalLink,
  Navigation, BookmarkCheck, DollarSign, Users, ArrowRight, Check, CreditCard,
  RotateCcw, RefreshCw, PiggyBank, AlertCircle, Upload, Image, Receipt
} from 'lucide-react';
import { Trip, ActivityItem, CategoryType, SavedPlace, Expense } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';
import { CategoryConfig, getSavedCategories, CategorySettingsModal } from './CategorySettingsModal';

interface ItineraryViewProps {
  trip: Trip;
  savedPlaces?: SavedPlace[];
  onAddActivity: (dayNumber: number, activity: Omit<ActivityItem, 'id'>) => void;
  onEditActivity?: (dayNumber: number, activityId: string, updatedActivity: Partial<ActivityItem>, newDayNumber?: number) => void;
  onToggleActivityCheck: (dayNumber: number, activityId: string) => void;
  onDeleteActivity: (dayNumber: number, activityId: string) => void;
  onOpenAIModal: () => void;
  onAddExpense?: (expense: Omit<Expense, 'id'>) => void;
  onSaveActivityExpense?: (
    dayNumber: number,
    activityId: string,
    data: {
      amount: number;
      paidBy: string;
      splitWith: string[];
      memberSplits?: { memberId: string; amount: number }[];
      recordExpense: boolean;
      unitPrice?: number;
      expenseId?: string;
      receiptImageUrl?: string;
    }
  ) => void;
  onNavigateToExpenses?: () => void;
}

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  sightseeing: <Camera className="w-3.5 h-3.5" />,
  food: <Utensils className="w-3.5 h-3.5" />,
  stay: <Hotel className="w-3.5 h-3.5" />,
  transport: <Car className="w-3.5 h-3.5" />,
  activity: <Compass className="w-3.5 h-3.5" />,
  shopping: <ShoppingBag className="w-3.5 h-3.5" />,
  flight: <Car className="w-3.5 h-3.5" />,
  other: <Tag className="w-3.5 h-3.5" />,
};

const CATEGORY_BADGES: Record<CategoryType, string> = {
  sightseeing: 'bg-purple-50 text-purple-700 border-purple-200',
  food: 'bg-amber-50 text-amber-700 border-amber-200',
  stay: 'bg-blue-50 text-blue-700 border-blue-200',
  transport: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  activity: 'bg-teal-50 text-teal-700 border-teal-200',
  shopping: 'bg-pink-50 text-pink-700 border-pink-200',
  flight: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const formatToDDMMYYYY = (dateStr?: string, dayNumber: number = 1, tripStartDate?: string): string => {
  if (tripStartDate) {
    const parts = tripStartDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + (dayNumber - 1));
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
  }

  if (dateStr) {
    const ddmmyyyyMatch = dateStr.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
    if (ddmmyyyyMatch) return ddmmyyyyMatch[0];

    const yyyymmddMatch = dateStr.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (yyyymmddMatch) {
      const [, y, m, d] = yyyymmddMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    const p = new Date(dateStr);
    if (!isNaN(p.getTime())) {
      const dd = String(p.getDate()).padStart(2, '0');
      const mm = String(p.getMonth() + 1).padStart(2, '0');
      const yyyy = p.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  return `Ngày ${dayNumber}`;
};

export const calculateEvenSplits = (totalAmount: number, memberIds: string[]): { [memberId: string]: string } => {
  const result: { [memberId: string]: string } = {};
  if (!memberIds || memberIds.length === 0) return result;

  if (totalAmount <= 0 || isNaN(totalAmount)) {
    memberIds.forEach((id) => {
      result[id] = '0';
    });
    return result;
  }

  const count = memberIds.length;
  // If the total is an integer (standard for currencies like VND)
  if (Math.floor(totalAmount) === totalAmount) {
    const baseShare = Math.floor(totalAmount / count);
    const remainder = totalAmount - (baseShare * count);
    memberIds.forEach((id, index) => {
      // Put remainder on the first member so sum strictly equals totalAmount
      result[id] = String(index === 0 ? baseShare + remainder : baseShare);
    });
  } else {
    const baseShare = Math.floor((totalAmount / count) * 100) / 100;
    const remainder = Math.round((totalAmount - (baseShare * count)) * 100) / 100;
    memberIds.forEach((id, index) => {
      const share = index === 0 ? Math.round((baseShare + remainder) * 100) / 100 : baseShare;
      result[id] = String(share);
    });
  }

  return result;
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  trip,
  savedPlaces = [],
  onAddActivity,
  onEditActivity,
  onToggleActivityCheck,
  onDeleteActivity,
  onOpenAIModal,
  onAddExpense,
  onSaveActivityExpense,
  onNavigateToExpenses,
}) => {
  const { lang, t } = useLanguage();
  const isVi = lang === 'vi';
  const [activeDayTab, setActiveDayTab] = useState<number | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  
  // Category dropdown state
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [dropdownSearchInput, setDropdownSearchInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Day dropdown state (with search-like feature)
  const [isDayDropdownOpen, setIsDayDropdownOpen] = useState(false);
  const [daySearchInput, setDaySearchInput] = useState('');
  const dayDropdownRef = useRef<HTMLDivElement>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetDayNumber, setTargetDayNumber] = useState<number>(trip.days[0]?.dayNumber || 1);

  // Delete activity confirmation modal state
  const [activityToDelete, setActivityToDelete] = useState<{ activity: ActivityItem; dayNumber: number } | null>(null);

  // Completion Expense Prompt Modal state
  const [completedActivityPrompt, setCompletedActivityPrompt] = useState<{
    activity: ActivityItem;
    dayNumber: number;
    unitPrice: number;
    amount: string;
    isAmountManuallyEdited?: boolean;
    paidBy: string;
    splitWith: string[];
    memberSplits: { [memberId: string]: string };
    recordExpense: boolean;
    receiptImageUrl?: string;
  } | null>(null);
  const [paidBySearch, setPaidBySearch] = useState('');
  const [isPaidByDropdownOpen, setIsPaidByDropdownOpen] = useState(false);
  const [isSplitWithDropdownOpen, setIsSplitWithDropdownOpen] = useState(false);
  const [splitWithSearch, setSplitWithSearch] = useState('');
  const [isCompletedParticipantsExpanded, setIsCompletedParticipantsExpanded] = useState(true);
  const [completedParticipantsFilter, setCompletedParticipantsFilter] = useState<'all' | 'selected'>('all');
  const paidByRef = useRef<HTMLDivElement>(null);
  const splitWithRef = useRef<HTMLDivElement>(null);

  // Activity Receipt Scanning & Viewer states
  const [isScanningActivityReceipt, setIsScanningActivityReceipt] = useState(false);
  const [activityScanNotice, setActivityScanNotice] = useState<string | null>(null);
  const [viewingActivityReceiptImage, setViewingActivityReceiptImage] = useState<string | null>(null);
  const [pendingCostOverwrite, setPendingCostOverwrite] = useState<{
    scannedTotal: number;
    currentCost: number;
  } | null>(null);
  const itineraryCameraInputRef = useRef<HTMLInputElement>(null);
  const itineraryFileInputRef = useRef<HTMLInputElement>(null);

  // Handle receipt image upload & AI OCR total cost extraction
  const handleItineraryReceiptUpload = (file: File) => {
    if (!completedActivityPrompt) return;
    if (!file.type.startsWith('image/')) {
      setActivityScanNotice(isVi ? 'Vui lòng chọn tệp hình ảnh (PNG, JPG, WEBP).' : 'Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setIsScanningActivityReceipt(true);
      setActivityScanNotice(null);
      setPendingCostOverwrite(null);

      try {
        const res = await fetch('/api/gemini/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            language: isVi ? 'vi' : 'en',
            currency: trip.currency || 'VND',
          }),
        });
        const json = await res.json();
        const scannedTotal = json?.data?.totalAmount ? Number(json.data.totalAmount) : 0;

        const currentCostNum = parseFloat(completedActivityPrompt.amount);
        const isCostZeroOrEmpty =
          !completedActivityPrompt.amount ||
          isNaN(currentCostNum) ||
          currentCostNum === 0 ||
          completedActivityPrompt.amount.trim() === '';

        if (isCostZeroOrEmpty && scannedTotal > 0) {
          // Rule 1: Nếu mục chi phí đang = 0 hoặc rỗng thì AI tự lấy tổng tiền trong hóa đơn điền vào!
          const splits = calculateEvenSplits(scannedTotal, completedActivityPrompt.splitWith);
          setCompletedActivityPrompt((prev) =>
            prev
              ? {
                  ...prev,
                  amount: String(scannedTotal),
                  memberSplits: splits,
                  receiptImageUrl: base64,
                  isAmountManuallyEdited: true,
                }
              : null
          );
          setActivityScanNotice(
            isVi
              ? `✓ Đã lưu hóa đơn. AI tự động điền tổng tiền: ${formatMoney(scannedTotal, trip.currency, lang)}`
              : `✓ Receipt saved. AI auto-filled total: ${formatMoney(scannedTotal, trip.currency, lang)}`
          );
        } else {
          // Rule 2: Mục chi phí đã có giá (> 0)
          setCompletedActivityPrompt((prev) =>
            prev
              ? {
                  ...prev,
                  receiptImageUrl: base64,
                }
              : null
          );

          if (scannedTotal > 0) {
            if (Math.abs(scannedTotal - currentCostNum) >= 0.01) {
              // Hỏi người dùng có muốn ghi đè lên chi phí hiện tại không
              setPendingCostOverwrite({
                scannedTotal,
                currentCost: currentCostNum,
              });
            } else {
              setActivityScanNotice(
                isVi
                  ? `✓ Đã lưu ảnh hóa đơn (khớp với chi phí hiện tại: ${formatMoney(currentCostNum, trip.currency, lang)}).`
                  : `✓ Receipt attached (matches current cost: ${formatMoney(currentCostNum, trip.currency, lang)}).`
              );
            }
          } else {
            setActivityScanNotice(isVi ? '✓ Đã đính kèm ảnh hóa đơn thành công.' : '✓ Receipt image attached successfully.');
          }
        }
      } catch (err) {
        console.warn('[Activity Receipt Scan Error]:', err);
        setCompletedActivityPrompt((prev) =>
          prev
            ? {
                ...prev,
                receiptImageUrl: base64,
              }
            : null
        );
        setActivityScanNotice(isVi ? '✓ Đã lưu ảnh hóa đơn vào hoạt động.' : '✓ Receipt image attached.');
      } finally {
        setIsScanningActivityReceipt(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Open modal to view/edit expense details for completed activity
  const handleOpenEditCompletedExpense = (act: ActivityItem, dayNum: number) => {
    const linkedExpense = trip.expenses?.find(
      (e) =>
        e.activityId === act.id ||
        (act.expenseId && e.id === act.expenseId) ||
        (e.title.trim().toLowerCase() === act.title.trim().toLowerCase() &&
          e.receiptNote &&
          e.receiptNote.includes(`Ngày ${dayNum}`))
    );

    const initialAmount =
      act.actualCost !== undefined
        ? act.actualCost
        : linkedExpense
        ? linkedExpense.amount
        : act.estimatedCost !== undefined && act.estimatedCost > 0
        ? act.estimatedCost
        : 0;

    const initialPayer =
      act.paidBy ||
      linkedExpense?.paidBy ||
      trip.members[0]?.id ||
      '';

    const initialSplitWith =
      act.splitWith && act.splitWith.length > 0
        ? act.splitWith
        : linkedExpense?.splitWith && linkedExpense.splitWith.length > 0
        ? linkedExpense.splitWith
        : trip.members.map((m) => m.id);

    // Initialize member splits - default equal split
    let initialSplits: { [memberId: string]: string } = {};
    const existingSplits = act.memberSplits || linkedExpense?.memberSplits;
    if (existingSplits && existingSplits.length > 0) {
      existingSplits.forEach((s) => {
        initialSplits[s.memberId] = String(s.amount);
      });
      initialSplitWith.forEach((id) => {
        if (initialSplits[id] === undefined) initialSplits[id] = '0';
      });
    } else {
      initialSplits = calculateEvenSplits(initialAmount, initialSplitWith);
    }

    const initialReceiptImage = act.receiptImageUrl || linkedExpense?.receiptImageUrl;

    setCompletedActivityPrompt({
      activity: act,
      dayNumber: dayNum,
      unitPrice: 0,
      amount: initialAmount > 0 ? String(initialAmount) : '',
      isAmountManuallyEdited: true,
      paidBy: initialPayer,
      splitWith: initialSplitWith,
      memberSplits: initialSplits,
      recordExpense: true,
      receiptImageUrl: initialReceiptImage,
    });
    setActivityScanNotice(null);
    setPendingCostOverwrite(null);
    setPaidBySearch('');
    setIsPaidByDropdownOpen(false);
    setSplitWithSearch('');
    setIsCompletedParticipantsExpanded(true);
    setCompletedParticipantsFilter('all');
  };

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (paidByRef.current && !paidByRef.current.contains(e.target as Node)) {
        setIsPaidByDropdownOpen(false);
      }
      if (splitWithRef.current && !splitWithRef.current.contains(e.target as Node)) {
        setIsSplitWithDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveCompletedActivityPrompt = () => {
    if (!completedActivityPrompt) return;
    const costVal = parseFloat(completedActivityPrompt.amount);
    const hasValidAmount = !isNaN(costVal) && costVal >= 0;
    const participantCount = completedActivityPrompt.splitWith.length || trip.members.length || 1;
    const fallbackAmount = completedActivityPrompt.unitPrice > 0 
      ? completedActivityPrompt.unitPrice * participantCount 
      : (completedActivityPrompt.activity.actualCost ?? completedActivityPrompt.activity.estimatedCost ?? 0);
    const finalAmount = hasValidAmount ? costVal : fallbackAmount;
    const finalPayer = completedActivityPrompt.paidBy || trip.members[0]?.id || 'm1';
    const finalSplitWith = completedActivityPrompt.splitWith.length > 0
      ? completedActivityPrompt.splitWith
      : trip.members.map((m) => m.id);

    const memberSplitsArray = finalSplitWith.map((mId) => ({
      memberId: mId,
      amount: parseFloat(completedActivityPrompt.memberSplits?.[mId] || '0') || 0,
    }));
    const memberSplitsSum = memberSplitsArray.reduce((acc, curr) => acc + curr.amount, 0);
    // Ensure final amount matches member splits sum if member splits were entered
    const effectiveAmount = memberSplitsSum > 0 && (!hasValidAmount || Math.abs(memberSplitsSum - finalAmount) > 0.01)
      ? memberSplitsSum
      : finalAmount;

    // 1. If onSaveActivityExpense is provided, use it to update both activity and linked expense in-place!
    // (Never duplicates expense records in expense history)
    if (onSaveActivityExpense) {
      onSaveActivityExpense(
        completedActivityPrompt.dayNumber,
        completedActivityPrompt.activity.id,
        {
          amount: effectiveAmount,
          paidBy: finalPayer,
          splitWith: finalSplitWith,
          memberSplits: memberSplitsArray,
          recordExpense: completedActivityPrompt.recordExpense,
          unitPrice: completedActivityPrompt.unitPrice,
          receiptImageUrl: completedActivityPrompt.receiptImageUrl,
        }
      );
    } else {
      if (onEditActivity) {
        onEditActivity(
          completedActivityPrompt.dayNumber,
          completedActivityPrompt.activity.id,
          {
            actualCost: effectiveAmount,
            estimatedCost: effectiveAmount,
            paidBy: finalPayer,
            splitWith: finalSplitWith,
            memberSplits: memberSplitsArray,
            isCompleted: true,
            receiptImageUrl: completedActivityPrompt.receiptImageUrl,
          }
        );
      }
      if (completedActivityPrompt.recordExpense && onAddExpense) {
        onAddExpense({
          title: completedActivityPrompt.activity.title,
          amount: effectiveAmount,
          currency: completedActivityPrompt.activity.currency || trip.currency || 'VND',
          category: completedActivityPrompt.activity.category || 'activity',
          paidBy: finalPayer,
          splitWith: finalSplitWith,
          memberSplits: memberSplitsArray,
          date: new Date().toISOString().split('T')[0],
          activityId: completedActivityPrompt.activity.id,
          receiptImageUrl: completedActivityPrompt.receiptImageUrl,
          receiptNote: `${isVi ? 'Chi tiêu tự động từ hoạt động:' : 'Auto-recorded from activity:'} ${completedActivityPrompt.activity.title} (${isVi ? `Ngày ${completedActivityPrompt.dayNumber}` : `Day ${completedActivityPrompt.dayNumber}`})`,
        });
      }
    }

    setPendingCostOverwrite(null);
    setCompletedActivityPrompt(null);
  };

  // Editing activity modal state
  const [editingActivity, setEditingActivity] = useState<{ activity: ActivityItem; dayNumber: number } | null>(null);
  const [editDayNumber, setEditDayNumber] = useState<number>(1);
  const [editTitle, setEditTitle] = useState('');
  const [editLocationName, setEditLocationName] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editCategory, setEditCategory] = useState<CategoryType>('sightseeing');
  const [editEstimatedCost, setEditEstimatedCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Merged expense fields in Activity Edit Modal
  const [editRecordExpense, setEditRecordExpense] = useState(true);
  const [editActualCost, setEditActualCost] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editSplitWith, setEditSplitWith] = useState<string[]>([]);
  const [editMemberSplits, setEditMemberSplits] = useState<{ [memberId: string]: string }>({});
  const [isEditPaidByDropdownOpen, setIsEditPaidByDropdownOpen] = useState(false);
  const [editPaidBySearch, setEditPaidBySearch] = useState('');
  const [isEditSplitWithDropdownOpen, setIsEditSplitWithDropdownOpen] = useState(false);
  const [editSplitWithSearch, setEditSplitWithSearch] = useState('');
  const [isEditParticipantsExpanded, setIsEditParticipantsExpanded] = useState(true);
  const [editParticipantsFilter, setEditParticipantsFilter] = useState<'all' | 'selected'>('all');
  const editPaidByRef = useRef<HTMLDivElement>(null);
  const editSplitWithRef = useRef<HTMLDivElement>(null);

  // Location search droplist in Add Modal
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Close droplist popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsFilterDropdownOpen(false);
      }
      if (dayDropdownRef.current && !dayDropdownRef.current.contains(target)) {
        setIsDayDropdownOpen(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(target)) {
        setIsLocationDropdownOpen(false);
      }
      if (editPaidByRef.current && !editPaidByRef.current.contains(target)) {
        setIsEditPaidByDropdownOpen(false);
      }
      if (editSplitWithRef.current && !editSplitWithRef.current.contains(target)) {
        setIsEditSplitWithDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Categories configuration state
  const [categoriesList, setCategoriesList] = useState<CategoryConfig[]>(() => getSavedCategories());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [category, setCategory] = useState<CategoryType>('sightseeing');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSavedPlaceId, setSelectedSavedPlaceId] = useState<string>('');

  const categories: { label: string; value: string; icon?: string }[] = useMemo(() => [
    { label: t('cat.all'), value: 'all', icon: '✨' },
    ...categoriesList.map((c) => ({
      label: `${c.icon ? c.icon + ' ' : ''}${isVi ? c.nameVi : c.nameEn}`,
      value: c.id,
      icon: c.icon,
    })),
  ], [categoriesList, isVi, t]);

  // Filtered days for Day search droplist
  const filteredDaysForDropdown = useMemo(() => {
    const q = daySearchInput.trim().toLowerCase();
    if (!q) return trip.days;
    return trip.days.filter((d) => {
      const dayNumStr = `ngày ${d.dayNumber} day ${d.dayNumber}`;
      const title = d.title.toLowerCase();
      const date = d.date.toLowerCase();
      return dayNumStr.includes(q) || title.includes(q) || date.includes(q);
    });
  }, [daySearchInput, trip.days]);

  // Filtered categories for droplist
  const filteredCategories = useMemo(() => {
    const q = dropdownSearchInput.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => cat.label.toLowerCase().includes(q) || cat.value.toLowerCase().includes(q));
  }, [dropdownSearchInput, categories]);

  // Matching activities preview inside search droplist
  const matchingActivityHighlights = useMemo(() => {
    const q = dropdownSearchInput.trim().toLowerCase();
    if (!q) return [];
    const matches: { id: string; title: string; dayNumber: number; category: string }[] = [];
    trip.days.forEach((d) => {
      d.activities.forEach((act) => {
        if (act.title.toLowerCase().includes(q) || act.locationName.toLowerCase().includes(q)) {
          if (matches.length < 5) {
            matches.push({ id: act.id, title: act.title, dayNumber: d.dayNumber, category: act.category });
          }
        }
      });
    });
    return matches;
  }, [dropdownSearchInput, trip.days]);

  // Toggle single day expand/collapse
  const toggleDay = (dayNum: number) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum],
    }));
  };

  // Calculate totals
  const totalActivitiesCount = trip.days.reduce((sum, d) => sum + d.activities.length, 0);
  const completedActivitiesCount = trip.days.reduce(
    (sum, d) => sum + d.activities.filter((a) => a.isCompleted).length,
    0
  );
  const totalTripCost = trip.days.reduce(
    (sum, d) => sum + d.activities.reduce((dSum, a) => dSum + (a.estimatedCost || 0), 0),
    0
  );
  const totalSpent = useMemo(() => {
    let total = 0;
    const processedActivityIds = new Set<string>();

    // 1. Tất cả các khoản chi tiêu từ trip.expenses
    (trip.expenses || []).forEach((exp) => {
      let actId = exp.activityId;
      if (actId) {
        processedActivityIds.add(actId);
      } else {
        for (const day of trip.days) {
          for (const act of day.activities) {
            if (act.expenseId && act.expenseId === exp.id) {
              actId = act.id;
              processedActivityIds.add(act.id);
              break;
            }
            const expTitle = exp.title.trim().toLowerCase();
            const actTitle = act.title.trim().toLowerCase();
            if (expTitle === actTitle || expTitle.includes(actTitle) || actTitle.includes(expTitle)) {
              actId = act.id;
              processedActivityIds.add(act.id);
              break;
            }
            if (exp.receiptNote && exp.receiptNote.toLowerCase().includes(actTitle)) {
              actId = act.id;
              processedActivityIds.add(act.id);
              break;
            }
          }
          if (actId) break;
        }
      }
      total += Number(exp.amount) || 0;
    });

    // 2. Các hoạt động đã hoàn thành trong lịch trình chưa có trong trip.expenses
    trip.days.forEach((day) => {
      day.activities.forEach((act) => {
        if (act.isCompleted && !processedActivityIds.has(act.id)) {
          processedActivityIds.add(act.id);
          const cost = act.actualCost !== undefined ? Number(act.actualCost) : Number(act.estimatedCost || 0);
          total += cost;
        }
      });
    });

    return total;
  }, [trip.expenses, trip.days]);

  // Matching saved places for location search droplist in Add modal (filtered by trip destination)
  const tripSavedPlaces = useMemo(() => {
    if (!savedPlaces || savedPlaces.length === 0) return [];
    const dest = (trip.destination || '').trim().toLowerCase();
    if (!dest) return savedPlaces;
    // Filter places in this trip's destination city
    const filtered = savedPlaces.filter((p) => {
      const cName = (p.cityName || '').trim().toLowerCase();
      return cName === dest || cName.includes(dest) || dest.includes(cName);
    });
    // If none match the destination specifically, fall back to all saved places
    return filtered.length > 0 ? filtered : savedPlaces;
  }, [savedPlaces, trip.destination]);

  const matchingSavedPlaces = useMemo(() => {
    if (!tripSavedPlaces || tripSavedPlaces.length === 0) return [];
    const q = locationName.trim().toLowerCase();
    if (!q) return tripSavedPlaces;
    return tripSavedPlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        p.cityName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [tripSavedPlaces, locationName]);

  const handleOpenAddModal = (dayNum?: number) => {
    if (dayNum) {
      setTargetDayNumber(dayNum);
    } else if (typeof activeDayTab === 'number') {
      setTargetDayNumber(activeDayTab);
    } else {
      setTargetDayNumber(trip.days[0]?.dayNumber || 1);
    }
    setTitle('');
    setLocationName('');
    setTime('09:00 AM');
    setCategory('sightseeing');
    setEstimatedCost('');
    setNotes('');
    setSelectedSavedPlaceId('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (act: ActivityItem, dayNum: number) => {
    setEditingActivity({ activity: act, dayNumber: dayNum });
    setEditDayNumber(dayNum);
    setEditTitle(act.title);
    setEditLocationName(act.locationName);
    setEditTime(act.time || '09:00 AM');
    setEditCategory(act.category);
    setEditEstimatedCost(act.estimatedCost !== undefined ? String(act.estimatedCost) : '');
    setEditNotes(act.notes || '');

    // Expense initialization
    const linkedExpense = trip.expenses?.find(
      (e) =>
        e.activityId === act.id ||
        (act.expenseId && e.id === act.expenseId) ||
        (e.title.trim().toLowerCase() === act.title.trim().toLowerCase() &&
          e.receiptNote &&
          e.receiptNote.includes(`Ngày ${dayNum}`))
    );

    // Unified Cost: prioritize actualCost if completed, else linkedExpense amount, else estimatedCost
    const initialAmount =
      act.actualCost !== undefined && act.actualCost > 0
        ? act.actualCost
        : linkedExpense && linkedExpense.amount > 0
        ? linkedExpense.amount
        : act.estimatedCost !== undefined && act.estimatedCost > 0
        ? act.estimatedCost
        : 0;

    const costString = initialAmount > 0 ? String(initialAmount) : (act.estimatedCost !== undefined ? String(act.estimatedCost) : '');
    setEditEstimatedCost(costString);
    setEditActualCost(costString);

    const initialPayer =
      act.paidBy ||
      linkedExpense?.paidBy ||
      trip.members[0]?.id ||
      '';

    const initialSplitWith =
      act.splitWith && act.splitWith.length > 0
        ? act.splitWith
        : linkedExpense?.splitWith && linkedExpense.splitWith.length > 0
        ? linkedExpense.splitWith
        : trip.members.map((m) => m.id);

    setEditPaidBy(initialPayer);
    setEditSplitWith(initialSplitWith);

    // Initialize editMemberSplits
    let initialSplits: { [mId: string]: string } = {};
    const existingSplits = act.memberSplits || linkedExpense?.memberSplits;
    if (existingSplits && existingSplits.length > 0) {
      existingSplits.forEach((s) => {
        initialSplits[s.memberId] = String(s.amount);
      });
      initialSplitWith.forEach((id) => {
        if (initialSplits[id] === undefined) initialSplits[id] = '0';
      });
    } else {
      initialSplits = calculateEvenSplits(initialAmount, initialSplitWith);
    }
    setEditMemberSplits(initialSplits);

    setEditRecordExpense(act.expenseId ? true : (linkedExpense ? true : true));
    setIsEditPaidByDropdownOpen(false);
    setEditPaidBySearch('');
    setIsEditSplitWithDropdownOpen(false);
    setEditSplitWithSearch('');
    setIsEditParticipantsExpanded(true);
    setEditParticipantsFilter('all');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !editTitle.trim() || !editLocationName.trim()) return;

    const isCompleted = !!editingActivity.activity.isCompleted;
    // Unified cost: parsed from editEstimatedCost (which is synchronized with editActualCost)
    const rawCost = editEstimatedCost.trim() || editActualCost.trim();
    const parsedCost = rawCost ? parseFloat(rawCost) : 0;
    const costVal = !isNaN(parsedCost) && parsedCost >= 0 ? parsedCost : 0;

    const finalPayer = editPaidBy || trip.members[0]?.id || 'm1';
    const finalSplitWith = editSplitWith.length > 0 ? editSplitWith : trip.members.map((m) => m.id);

    const splitsArray = finalSplitWith.map((mId) => ({
      memberId: mId,
      amount: parseFloat(editMemberSplits[mId] || '0') || 0,
    }));
    const splitsSum = splitsArray.reduce((acc, curr) => acc + curr.amount, 0);
    const effectiveCost = splitsSum > 0 && Math.abs(splitsSum - costVal) > 0.01 && costVal === 0
      ? splitsSum
      : costVal;

    // Identify linked expense id to prevent duplicates
    const linkedExpense = trip.expenses?.find(
      (exp) =>
        exp.activityId === editingActivity.activity.id ||
        (editingActivity.activity.expenseId && exp.id === editingActivity.activity.expenseId) ||
        (exp.title.trim().toLowerCase() === editingActivity.activity.title.trim().toLowerCase() &&
          exp.receiptNote &&
          exp.receiptNote.includes(`Ngày ${editingActivity.dayNumber}`))
    );
    const linkedExpenseId = editingActivity.activity.expenseId || linkedExpense?.id;

    // 1. If activity is completed and onSaveActivityExpense exists, update both activity & expense in-place!
    if (isCompleted && onSaveActivityExpense) {
      // First update general activity properties (title, time, location, category, dayNumber, notes)
      if (onEditActivity) {
        onEditActivity(
          editingActivity.dayNumber,
          editingActivity.activity.id,
          {
            title: editTitle.trim(),
            locationName: editLocationName.trim(),
            time: editTime.trim() || '09:00 AM',
            category: editCategory,
            estimatedCost: effectiveCost,
            actualCost: effectiveCost,
            notes: editNotes.trim(),
            paidBy: finalPayer,
            splitWith: finalSplitWith,
            memberSplits: splitsArray,
            expenseId: linkedExpenseId,
          },
          editDayNumber
        );
      }

      // Then save the expense information linked to this activity (in-place update, never duplicate)
      onSaveActivityExpense(
        editDayNumber,
        editingActivity.activity.id,
        {
          amount: effectiveCost,
          paidBy: finalPayer,
          splitWith: finalSplitWith,
          memberSplits: splitsArray,
          recordExpense: editRecordExpense,
          expenseId: linkedExpenseId,
        }
      );
    } else if (onEditActivity) {
      onEditActivity(
        editingActivity.dayNumber,
        editingActivity.activity.id,
        {
          title: editTitle.trim(),
          locationName: editLocationName.trim(),
          time: editTime.trim() || '09:00 AM',
          category: editCategory,
          estimatedCost: effectiveCost,
          actualCost: isCompleted ? effectiveCost : effectiveCost,
          notes: editNotes.trim(),
          ...(isCompleted
            ? {
                paidBy: finalPayer,
                splitWith: finalSplitWith,
                memberSplits: splitsArray,
                expenseId: linkedExpenseId,
              }
            : {}),
        },
        editDayNumber
      );
    }

    setEditingActivity(null);
  };

  const handlePickSavedPlace = (savedPlaceId: string) => {
    setSelectedSavedPlaceId(savedPlaceId);
    const found = savedPlaces.find((p) => p.id === savedPlaceId);
    if (found) {
      setTitle(found.name);
      setLocationName(found.address ? `${found.name}, ${found.address}` : `${found.name}, ${found.cityName}`);
      setCategory(found.category);
      if (found.estimatedCost !== undefined) {
        setEstimatedCost(String(found.estimatedCost));
      }
      if (found.notes) {
        setNotes(found.notes);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLocation = locationName.trim();
    const finalTitle = title.trim() || finalLocation;
    if (!finalTitle) return;

    onAddActivity(targetDayNumber, {
      time: time || '10:00 AM',
      title: finalTitle,
      locationName: finalLocation || finalTitle,
      category,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0,
      currency: trip.currency || 'VND',
      notes: notes.trim(),
      isCompleted: false,
    });

    // Auto expand day so user sees the newly added activity
    setExpandedDays((prev) => ({ ...prev, [targetDayNumber]: true }));
    setIsAddModalOpen(false);
  };

  // Filter days and activities based on search query, day select, and category
  const filteredDays = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    // First, filter by day selection if not 'all'
    const baseDays = activeDayTab === 'all'
      ? trip.days
      : trip.days.filter((d) => d.dayNumber === activeDayTab);

    return baseDays.map((day) => {
      const filteredActivities = day.activities.filter((act) => {
        // Category filter
        const matchCategory = selectedCategory === 'all' ? true : act.category === selectedCategory;
        if (!matchCategory) return false;

        // Search query filter (like search on title, location, category)
        if (!query) return true;

        const titleMatch = act.title.toLowerCase().includes(query);
        const locMatch = act.locationName.toLowerCase().includes(query);
        const catMatch = t(`cat.${act.category}`).toLowerCase().includes(query);

        return titleMatch || locMatch || catMatch;
      });

      return {
        ...day,
        activities: filteredActivities,
      };
    });
  }, [trip.days, activeDayTab, selectedCategory, searchQuery, t]);

  const totalFilteredCount = filteredDays.reduce((sum, d) => sum + d.activities.length, 0);

  return (
    <div className="space-y-4">
      
      {/* 1. Mobile-First Compact Droplist Filter Bar (Day Search Droplist + Category Search Droplist + Add Activity) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs relative z-20">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
          
          {/* Day Selector Search-Like Droplist */}
          <div className="relative col-span-1" ref={dayDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsDayDropdownOpen(!isDayDropdownOpen);
                setIsFilterDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-between text-xs font-semibold py-2 px-2.5 rounded-xl border transition-colors shadow-2xs cursor-pointer truncate ${
                activeDayTab !== 'all'
                  ? 'border-teal-500 bg-teal-50/70 text-teal-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="truncate flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">
                  {activeDayTab === 'all'
                    ? (isVi ? 'Tất cả ngày' : 'All Days')
                    : (() => {
                        const selectedDayObj = trip.days.find((d) => d.dayNumber === activeDayTab);
                        const onlyD = selectedDayObj?.date ? selectedDayObj.date.split(' - ')[0].trim() : '';
                        return isVi
                          ? `Ngày ${activeDayTab}${onlyD ? ` (${onlyD})` : ''}`
                          : `Day ${activeDayTab}${onlyD ? ` (${onlyD})` : ''}`;
                      })()}
                </span>
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {activeDayTab !== 'all' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDayTab('all');
                      setDaySearchInput('');
                    }}
                    className="p-0.5 hover:bg-teal-200/60 rounded text-teal-700"
                    title={isVi ? 'Xóa lọc ngày' : 'Reset day filter'}
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDayDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Day Search Droplist Menu */}
            {isDayDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                {/* Search input inside day droplist */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={daySearchInput}
                    onChange={(e) => setDaySearchInput(e.target.value)}
                    placeholder={isVi ? 'Tìm ngày (VD: 1, 20/08)...' : 'Search day (e.g. 1, 20/08)...'}
                    className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                  {daySearchInput && (
                    <button
                      type="button"
                      onClick={() => setDaySearchInput('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Days list */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDayTab('all');
                      setIsDayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      activeDayTab === 'all'
                        ? 'bg-teal-50 text-teal-800 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{isVi ? '📅 Tất cả ngày' : '📅 All Days'}</span>
                    {activeDayTab === 'all' && <span className="text-teal-600 text-xs">✓</span>}
                  </button>

                  {filteredDaysForDropdown.map((d) => {
                    const onlyD = d.date ? d.date.split(' - ')[0].trim() : '';
                    const isSelected = activeDayTab === d.dayNumber;
                    return (
                      <button
                        key={d.dayNumber}
                        type="button"
                        onClick={() => {
                          setActiveDayTab(d.dayNumber);
                          setExpandedDays((prev) => ({ ...prev, [d.dayNumber]: true }));
                          setIsDayDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50 text-teal-800 font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-slate-900">
                            {isVi ? `Ngày ${d.dayNumber}` : `Day ${d.dayNumber}`}
                          </span>
                          {onlyD && <span className="text-slate-400 ml-1 font-normal">({onlyD})</span>}
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-1.5">
                          {d.activities.length} {isVi ? 'mục' : 'acts'}
                        </span>
                      </button>
                    );
                  })}

                  {filteredDaysForDropdown.length === 0 && (
                    <div className="text-center py-3 text-xs text-slate-400 italic">
                      {isVi ? 'Không tìm thấy ngày phù hợp' : 'No matching days'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search-Like Droplist (Category / Activity Searchable Filter) */}
          <div className="relative col-span-1" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsFilterDropdownOpen(!isFilterDropdownOpen);
                setIsDayDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-between text-xs font-semibold py-2 px-2.5 rounded-xl border transition-colors shadow-2xs cursor-pointer truncate ${
                selectedCategory !== 'all' || searchQuery
                  ? 'border-teal-500 bg-teal-50/70 text-teal-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="truncate flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">
                  {searchQuery
                    ? `🔍 "${searchQuery}"`
                    : selectedCategory !== 'all'
                    ? (categories.find((c) => c.value === selectedCategory)?.label || selectedCategory)
                    : (isVi ? 'Tất cả thể loại' : 'All Categories')}
                </span>
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {(selectedCategory !== 'all' || searchQuery) && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory('all');
                      setSearchQuery('');
                      setDropdownSearchInput('');
                    }}
                    className="p-0.5 hover:bg-teal-200/60 rounded text-teal-700"
                    title={isVi ? 'Xóa lọc' : 'Clear filter'}
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Droplist Menu with search input inside - anchored right on mobile to prevent overflow/layout breaking */}
            {isFilterDropdownOpen && (
              <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                {/* Search input inside droplist */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={dropdownSearchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDropdownSearchInput(val);
                      setSearchQuery(val);
                    }}
                    placeholder={isVi ? 'Gõ tìm kiếm hoạt động...' : 'Type to search activity...'}
                    className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                  {dropdownSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownSearchInput('');
                        setSearchQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Categories selection list */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                    {isVi ? 'Theo Thể loại' : 'By Category'}
                  </div>
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.value);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        selectedCategory === cat.value && !searchQuery
                          ? 'bg-teal-50 text-teal-800 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {selectedCategory === cat.value && !searchQuery && (
                        <span className="text-teal-600 text-xs">✓</span>
                      )}
                    </button>
                  ))}

                  {/* Direct matching activity items */}
                  {matchingActivityHighlights.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                        {isVi ? 'Gợi ý hoạt động khớp' : 'Matching Activities'}
                      </div>
                      {matchingActivityHighlights.map((act) => (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => {
                            setSearchQuery(act.title);
                            setDropdownSearchInput(act.title);
                            setExpandedDays((prev) => ({ ...prev, [act.dayNumber]: true }));
                            setIsFilterDropdownOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate font-medium">{act.title}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                            {isVi ? `Ngày ${act.dayNumber}` : `Day ${act.dayNumber}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category Configuration Link */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFilterDropdownOpen(false);
                        setIsCategoryModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50/80 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Cấu hình Thể loại' : 'Manage Categories'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button: Add Activity */}
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <button
              onClick={() => handleOpenAddModal()}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer min-h-[36px]"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              <span>{t('itinerary.addActivity')}</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. Overview Info Bar - Showing both Total Expected and Total Spent */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {searchQuery ? (
            <span className="font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200 text-[11px]">
              {isVi ? `Tìm thấy ${totalFilteredCount} kết quả` : `Found ${totalFilteredCount} results`}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium">
              {isVi ? `Đã hoàn thành ${completedActivitiesCount}/${totalActivitiesCount} hoạt động` : `Done ${completedActivitiesCount}/${totalActivitiesCount} activities`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/90 border border-blue-200/80 text-[11px] sm:text-xs">
            <span className="text-slate-500 font-medium">{isVi ? 'Tổng dự kiến:' : 'Expected:'}</span>
            <span className="font-extrabold text-blue-700">
              {formatMoney(totalTripCost, trip.currency, lang)}
            </span>
          </div>

          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-[11px] sm:text-xs"
            title={isVi ? 'Tổng tiền đã chi của tất cả hoạt động đã hoàn thành trong chuyến đi' : 'Total spent on all completed activities across all days'}
          >
            <span className="text-slate-500 font-medium">{isVi ? 'Đã chi:' : 'Spent:'}</span>
            <span className="font-extrabold text-emerald-700">
              {formatMoney(totalSpent, trip.currency, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Days & Activity Cards List (Collapsed by default, toggled with ^ icon) */}
      <div className="space-y-3">
        {filteredDays.length === 0 || totalFilteredCount === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-2xs">
            <p className="text-xs text-slate-500 font-medium">
              {searchQuery 
                ? (isVi ? `Không tìm thấy hoạt động nào phù hợp với từ khóa "${searchQuery}"` : `No activities found matching "${searchQuery}"`)
                : (isVi ? 'Chưa có hoạt động nào trong mục này' : 'No activities in this section')}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDropdownSearchInput('');
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {isVi ? 'Xóa từ khóa tìm kiếm' : 'Clear search'}
              </button>
            )}
          </div>
        ) : (
          filteredDays.map((day) => {
            if (day.activities.length === 0 && searchQuery) {
              return null;
            }

            const dayCompletedCost = day.activities
              .filter((a) => a.isCompleted)
              .reduce((sum, a) => {
                const matchedExpense = trip.expenses?.find(
                  (e) =>
                    e.title.trim().toLowerCase() === a.title.trim().toLowerCase() ||
                    (e.receiptNote &&
                      e.receiptNote.toLowerCase().includes(a.title.trim().toLowerCase()) &&
                      e.receiptNote.includes(`Ngày ${day.dayNumber}`))
                );
                return sum + (matchedExpense ? matchedExpense.amount : (a.estimatedCost || 0));
              }, 0);
            const formattedDate = formatToDDMMYYYY(day.date, day.dayNumber, trip.startDate);
            const cleanTitle = day.title ? day.title.replace(/^(ngày|day)\s*\d+[\s:–-]*/i, '').trim() : '';
            const isExpanded = !!expandedDays[day.dayNumber];

            return (
              <div
                key={day.dayNumber}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Day Header - Clean, orderly, structured without cluttered title/date */}
                <div
                  onClick={() => toggleDay(day.dayNumber)}
                  className={`px-3.5 py-3 cursor-pointer transition-colors select-none ${
                    isExpanded ? 'bg-slate-50/90 border-b border-slate-100' : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Left: Badge + Date + Title */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-semibold text-xs shadow-2xs">
                          {isVi ? `Ngày ${day.dayNumber}` : `Day ${day.dayNumber}`}
                        </span>
                        <span className="text-xs font-normal text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formattedDate}
                        </span>
                      </div>

                      {cleanTitle ? (
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-800 truncate" title={cleanTitle}>
                            {cleanTitle}
                          </h3>
                        </div>
                      ) : null}
                    </div>

                    {/* Right: Activity count, Cost, Add button & Chevron */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {day.activities.length} {isVi ? 'hoạt động' : 'acts'}
                        </span>

                        {day.activities.length > 0 && (
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                              dayCompletedCost > 0
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                : 'text-slate-400 bg-slate-50 border-slate-200/70'
                            }`}
                            title={isVi ? 'Tổng số tiền hoạt động đã hoàn thành trong ngày' : 'Total money of completed activities in this day'}
                          >
                            {formatMoney(dayCompletedCost, trip.currency, lang)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddModal(day.dayNumber);
                          }}
                          className="p-1.5 hover:bg-slate-200/70 text-slate-600 hover:text-teal-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          title={t('itinerary.addActivityToDay', { day: day.dayNumber })}
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <div
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                          title={isExpanded ? (isVi ? 'Thu gọn' : 'Collapse') : (isVi ? 'Xem chi tiết' : 'Expand')}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-teal-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clean progress bar when collapsed */}
                  {!isExpanded && day.activities.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(day.activities.filter((a) => a.isCompleted).length / day.activities.length) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {day.activities.filter((a) => a.isCompleted).length}/{day.activities.length} {isVi ? 'xong' : 'done'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Activities List: only shown when expanded (default is collapsed) */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 animate-in fade-in-50 duration-150">
                    {day.activities.length === 0 ? (
                      <div className="text-center py-5 text-slate-400 space-y-2">
                        <p className="text-xs italic">{t('itinerary.emptyHint')}</p>
                        <button
                          onClick={() => handleOpenAddModal(day.dayNumber)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t('itinerary.addActivity')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {day.activities.map((act) => (
                          <div
                            key={act.id}
                            className={`group p-3 rounded-xl border transition-all ${
                              act.isCompleted
                                ? 'bg-emerald-50/30 border-emerald-200/80 shadow-2xs'
                                : 'bg-white hover:bg-slate-50/40 border-slate-200 hover:border-teal-300 shadow-2xs'
                            }`}
                          >
                            {/* Row 1: Checkbox + Time + Title + Category */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <button
                                  onClick={() => {
                                    const nextState = !act.isCompleted;
                                    onToggleActivityCheck(day.dayNumber, act.id);
                                    if (nextState) {
                                      handleOpenEditCompletedExpense(act, day.dayNumber);
                                    }
                                  }}
                                  className="mt-0.5 text-slate-400 hover:text-teal-600 transition-colors shrink-0 cursor-pointer p-0.5"
                                  title={act.isCompleted ? (isVi ? 'Đánh dấu chưa hoàn thành' : 'Mark incomplete') : (isVi ? 'Đánh dấu đã hoàn thành' : 'Mark complete')}
                                >
                                  {act.isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5 text-teal-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 hover:border-teal-500" />
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {act.time}
                                    </span>

                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                                        CATEGORY_BADGES[act.category] || CATEGORY_BADGES.other
                                      }`}
                                    >
                                      {CATEGORY_ICONS[act.category]}
                                      <span>{t(`cat.${act.category}`) || act.category}</span>
                                    </span>
                                  </div>

                                  <h4
                                    className={`text-xs sm:text-sm font-semibold text-slate-800 leading-snug break-words ${
                                      act.isCompleted ? 'line-through text-slate-400 font-normal' : ''
                                    }`}
                                  >
                                    {act.title}
                                  </h4>
                                </div>
                              </div>

                              {/* Action Buttons: Edit, Delete */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(act, day.dayNumber)}
                                  className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title={isVi ? 'Chỉnh sửa hoạt động' : 'Edit activity'}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivityToDelete({ activity: act, dayNumber: day.dayNumber });
                                  }}
                                  className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title={isVi ? 'Xóa hoạt động này' : 'Delete this activity'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Location & Google Maps Link & Price */}
                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
                              <div className="flex items-center gap-1 text-slate-500 min-w-0 truncate">
                                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span className="text-[11px] truncate font-medium text-slate-600">
                                  {act.locationName}
                                </span>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                    act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center w-5 h-5 text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 rounded-md transition-colors shrink-0 ml-1"
                                  title={isVi ? 'Mở trên Google Maps' : 'Open in Google Maps'}
                                >
                                  <MapPin className="w-3 h-3" />
                                </a>
                              </div>

                              {act.estimatedCost !== undefined && (
                                <div className="shrink-0 font-bold text-[11px] text-emerald-700">
                                  {act.estimatedCost > 0
                                    ? formatMoney(act.estimatedCost, act.currency || trip.currency, lang)
                                    : (isVi ? 'Miễn phí' : 'Free')}
                                </div>
                              )}
                            </div>

                            {/* Row 3 (if completed): Display actual spent money, payer & participants + Edit button */}
                            {act.isCompleted && (() => {
                              const cardExpense = trip.expenses?.find(
                                (e) =>
                                  e.activityId === act.id ||
                                  (act.expenseId && e.id === act.expenseId) ||
                                  (e.title.trim().toLowerCase() === act.title.trim().toLowerCase() &&
                                    e.receiptNote &&
                                    e.receiptNote.includes(`Ngày ${day.dayNumber}`))
                              );
                              const cardCost =
                                act.actualCost !== undefined
                                  ? act.actualCost
                                  : cardExpense
                                  ? cardExpense.amount
                                  : act.estimatedCost || 0;

                              const cardPayerId = act.paidBy || cardExpense?.paidBy || trip.members[0]?.id;
                              const isFundPayer = cardPayerId === 'fund';
                              const cardPayer = isFundPayer ? null : trip.members.find((m) => m.id === cardPayerId);
                              const cardSplitIds =
                                act.splitWith && act.splitWith.length > 0
                                  ? act.splitWith
                                  : cardExpense?.splitWith && cardExpense.splitWith.length > 0
                                  ? cardExpense.splitWith
                                  : trip.members.map((m) => m.id);

                              return (
                                <div className="mt-2 pt-2 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px] bg-emerald-50/70 rounded-lg px-2.5 py-1.5 text-emerald-950">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-extrabold text-emerald-700">
                                      {isVi ? 'Đã chi:' : 'Spent:'} {formatMoney(cardCost, act.currency || trip.currency, lang)}
                                    </span>
                                    <span className="text-emerald-300">•</span>
                                    {isFundPayer ? (
                                      <span className="font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                        <PiggyBank className="w-3 h-3 text-amber-700" />
                                        {isVi ? 'Quỹ' : 'Group Fund'}
                                      </span>
                                    ) : (
                                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                                        <CreditCard className="w-3 h-3 text-teal-600" />
                                        {cardPayer?.name || (isVi ? 'Chưa gán' : 'Unassigned')}
                                      </span>
                                    )}
                                    <span className="text-emerald-300">•</span>
                                    <span className="text-slate-600 font-medium">
                                      {cardSplitIds.length} {isVi ? 'người chia' : 'participants'}
                                    </span>
                                    {(act.receiptImageUrl || cardExpense?.receiptImageUrl) && (
                                      <>
                                        <span className="text-emerald-300">•</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingActivityReceiptImage(act.receiptImageUrl || cardExpense?.receiptImageUrl || null);
                                          }}
                                          className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:text-teal-950 bg-teal-100/70 hover:bg-teal-200/80 px-2 py-0.5 rounded-md cursor-pointer transition-colors shadow-2xs"
                                          title={isVi ? 'Xem ảnh hóa đơn' : 'View receipt image'}
                                        >
                                          <Receipt className="w-3 h-3 text-teal-700" />
                                          <span>{isVi ? 'Hóa đơn' : 'Receipt'}</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditCompletedExpense(act, day.dayNumber);
                                    }}
                                    className="text-[10px] font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer shrink-0 ml-auto"
                                  >
                                    {isVi ? 'Sửa chi tiêu' : 'Edit expense'}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Simple, Mobile-Friendly Add Activity Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base">
                  {isVi ? 'Thêm Hoạt động' : 'Add Activity'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-3.5">
              
              {/* Day selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Chọn ngày' : 'Select Day'}
                </label>
                <select
                  value={targetDayNumber}
                  onChange={(e) => setTargetDayNumber(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                >
                  {trip.days.map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      {isVi
                        ? `Ngày ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`
                        : `Day ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location with Droplist */}
              <div className="relative" ref={locationDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('itinerary.fieldLocation')} *
                  </label>
                  {tripSavedPlaces && tripSavedPlaces.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                      className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-teal-600" />
                      <span>{trip.destination || (isVi ? 'Điểm đến' : 'Destination')} ({tripSavedPlaces.length})</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={isVi ? `Nhập địa điểm tại ${trip.destination || 'chuyến đi'}...` : `Type location in ${trip.destination || 'trip'}...`}
                    value={locationName}
                    onChange={(e) => {
                      setLocationName(e.target.value);
                      setIsLocationDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (tripSavedPlaces && tripSavedPlaces.length > 0) {
                        setIsLocationDropdownOpen(true);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden pr-8"
                  />
                  {locationName && (
                    <button
                      type="button"
                      onClick={() => setLocationName('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Droplist of Locations in Trip Destination */}
                {isLocationDropdownOpen && tripSavedPlaces && tripSavedPlaces.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-2 max-h-52 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center justify-between">
                      <span>{trip.destination || (isVi ? 'Địa điểm' : 'Locations')}</span>
                      <span>{matchingSavedPlaces.length}</span>
                    </div>

                    {matchingSavedPlaces.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          handlePickSavedPlace(sp.id);
                          setIsLocationDropdownOpen(false);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-teal-50/80 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 group-hover:text-teal-900 truncate">
                            {sp.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <span className="font-semibold text-teal-700">[{sp.cityName}]</span>
                            <span>{sp.address || sp.category}</span>
                          </div>
                        </div>

                        {sp.estimatedCost !== undefined && sp.estimatedCost > 0 && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                            {formatMoney(sp.estimatedCost, sp.currency || trip.currency, lang)}
                          </span>
                        )}
                      </button>
                    ))}

                    {matchingSavedPlaces.length === 0 && (
                      <div className="text-center py-2 text-xs text-slate-400 italic">
                        {isVi ? `Không có địa điểm nào khớp với "${locationName}". Bạn có thể nhập tự do!` : `No location matches "${locationName}". You can type freely!`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('itinerary.fieldTime')}
                  </label>
                  <input
                    type="text"
                    placeholder="09:00 AM"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('itinerary.fieldCategory')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}{isVi ? c.nameVi : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Chi phí' : t('itinerary.fieldEstCost')}
                  </label>
                  <input
                    type="number"
                    placeholder={isVi ? "50000" : "0"}
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('itinerary.fieldNotes')}
                </label>
                <input
                  type="text"
                  placeholder={isVi ? 'Ví dụ: Đặt bàn trước 1 ngày, chuẩn bị áo ấm' : 'e.g., Buy tickets online in advance'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {isVi ? 'Lưu' : 'Save'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}



      {/* 5.5 Modal: Ghi nhận chi tiêu khi hoàn thành hoạt động */}
      {completedActivityPrompt && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header (fixed at top of modal) */}
            <div className="px-5 py-3.5 bg-teal-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4 text-teal-100" />
                </div>
                <h3 className="text-sm sm:text-base font-bold leading-tight">
                  {isVi
                    ? (completedActivityPrompt.activity.isCompleted ? 'Cập nhật chi tiêu hoạt động' : 'Ghi nhận chi tiêu')
                    : (completedActivityPrompt.activity.isCompleted ? 'Update Activity Expense' : 'Record Expense')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompletedActivityPrompt(null);
                  setPendingCostOverwrite(null);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-teal-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveCompletedActivityPrompt();
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              {/* Scrollable Form Content */}
              <div className="p-5 space-y-4 text-slate-800 overflow-y-auto flex-1 overscroll-contain">
                {/* Activity Info Banner */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {isVi ? `Hoạt động - Ngày ${completedActivityPrompt.dayNumber}` : `Activity - Day ${completedActivityPrompt.dayNumber}`}
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {completedActivityPrompt.activity.title}
                  </div>
                  {completedActivityPrompt.activity.locationName && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="truncate">{completedActivityPrompt.activity.locationName}</span>
                    </div>
                  )}
                </div>

                {/* Radio button / Option: Ghi nhận chi tiêu */}
                <div
                  onClick={() => {
                    setCompletedActivityPrompt({
                      ...completedActivityPrompt,
                      recordExpense: !completedActivityPrompt.recordExpense,
                    });
                  }}
                  className={`p-3 rounded-xl border flex items-center cursor-pointer select-none transition-colors ${
                    completedActivityPrompt.recordExpense
                      ? 'bg-teal-50/80 border-teal-300'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      completedActivityPrompt.recordExpense
                        ? 'border-teal-600 bg-teal-600'
                        : 'border-slate-400 bg-white'
                    }`}>
                      {completedActivityPrompt.recordExpense && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {isVi ? 'Ghi nhận chi tiêu' : 'Record Expense'}
                    </span>
                  </div>
                </div>

                {/* Expense Details: only shown when recordExpense is true */}
                {completedActivityPrompt.recordExpense && (
                  <div className="space-y-4 pt-1">
                    {/* Amount Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          {isVi ? `Chi phí (${trip.currency || 'VND'})` : `Cost (${trip.currency || 'USD'})`}
                        </label>
                        {completedActivityPrompt.unitPrice > 0 && (
                          <span className="text-[11px] text-teal-700 font-semibold">
                            {formatMoney(completedActivityPrompt.unitPrice, trip.currency, lang)} / {isVi ? 'người' : 'person'}
                          </span>
                        )}
                      </div>
                      
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={completedActivityPrompt.amount}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = parseFloat(val) || 0;
                            // Mặc định chia đều cho các thành viên được tích tham gia
                            const splits = calculateEvenSplits(num, completedActivityPrompt.splitWith);
                            setCompletedActivityPrompt({
                              ...completedActivityPrompt,
                              amount: val,
                              memberSplits: splits,
                              isAmountManuallyEdited: true,
                            });
                          }}
                          placeholder={completedActivityPrompt.unitPrice > 0 ? String(completedActivityPrompt.unitPrice * (completedActivityPrompt.splitWith.length || 1)) : '0'}
                          className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                        />
                      </div>

                      {/* Formula & Calculation helper badge */}
                      {completedActivityPrompt.unitPrice > 0 && (
                        <div className="mt-1.5 p-2 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-emerald-800 text-[11px] sm:text-xs">
                            <span className="font-semibold">{formatMoney(completedActivityPrompt.unitPrice, trip.currency, lang)}</span>
                            <span className="text-slate-400">×</span>
                            <span className="font-semibold">{completedActivityPrompt.splitWith.length} {isVi ? 'người tham gia' : 'people'}</span>
                            <span className="text-slate-400">=</span>
                            <span className="font-extrabold text-emerald-700">
                              {formatMoney(completedActivityPrompt.unitPrice * completedActivityPrompt.splitWith.length, trip.currency, lang)}
                            </span>
                          </div>
                          {completedActivityPrompt.isAmountManuallyEdited && (
                            <button
                              type="button"
                              onClick={() => {
                                setCompletedActivityPrompt({
                                  ...completedActivityPrompt,
                                  amount: String(completedActivityPrompt.unitPrice * completedActivityPrompt.splitWith.length),
                                  isAmountManuallyEdited: false,
                                });
                              }}
                              className="text-[11px] text-teal-700 hover:text-teal-900 underline font-semibold cursor-pointer shrink-0 ml-2"
                              title={isVi ? 'Tính lại theo số người' : 'Reset to formula'}
                            >
                              {isVi ? 'Đặt lại' : 'Reset'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Receipt Photo Capture / Upload & AI Auto-fill */}
                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-teal-600" />
                          <span>{isVi ? 'Ảnh hóa đơn / Biên lai' : 'Receipt Photo'}</span>
                          <span className="text-[10px] font-normal text-slate-400">({isVi ? 'Tùy chọn' : 'Optional'})</span>
                        </label>
                        {completedActivityPrompt.receiptImageUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingActivityReceiptImage(completedActivityPrompt.receiptImageUrl || null)}
                            className="text-[11px] text-teal-600 hover:text-teal-800 font-semibold cursor-pointer underline"
                          >
                            {isVi ? 'Xem ảnh' : 'View'}
                          </button>
                        )}
                      </div>

                      {/* Hidden camera & file inputs */}
                      <input
                        ref={itineraryCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleItineraryReceiptUpload(file);
                          e.target.value = '';
                        }}
                      />
                      <input
                        ref={itineraryFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleItineraryReceiptUpload(file);
                          e.target.value = '';
                        }}
                      />

                      {/* Uploaded state preview */}
                      {completedActivityPrompt.receiptImageUrl ? (
                        <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-teal-200">
                          <img
                            src={completedActivityPrompt.receiptImageUrl}
                            alt="Receipt"
                            onClick={() => setViewingActivityReceiptImage(completedActivityPrompt.receiptImageUrl || null)}
                            className="w-14 h-14 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-90 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{isVi ? 'Đã lưu ảnh hóa đơn' : 'Receipt attached'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={() => itineraryCameraInputRef.current?.click()}
                                disabled={isScanningActivityReceipt}
                                className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                              >
                                {isVi ? 'Chụp lại' : 'Retake'}
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => itineraryFileInputRef.current?.click()}
                                disabled={isScanningActivityReceipt}
                                className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                              >
                                {isVi ? 'Tải ảnh khác' : 'Change'}
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletedActivityPrompt({
                                    ...completedActivityPrompt,
                                    receiptImageUrl: undefined,
                                  });
                                  setActivityScanNotice(null);
                                  setPendingCostOverwrite(null);
                                }}
                                className="text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                              >
                                {isVi ? 'Xóa' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Capture & Upload action buttons */
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => itineraryCameraInputRef.current?.click()}
                            disabled={isScanningActivityReceipt}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-300 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Camera className="w-4 h-4 text-teal-600 shrink-0" />
                            <span className="truncate">{isVi ? 'Chụp ảnh' : 'Take Photo'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => itineraryFileInputRef.current?.click()}
                            disabled={isScanningActivityReceipt}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-300 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="truncate">{isVi ? 'Tải ảnh lên' : 'Upload'}</span>
                          </button>
                        </div>
                      )}

                      {/* AI Scanning indicator */}
                      {isScanningActivityReceipt && (
                        <div className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600 shrink-0" />
                          <span>{isVi ? 'AI đang đọc hóa đơn & trích xuất tổng tiền...' : 'AI scanning receipt for total amount...'}</span>
                        </div>
                      )}

                      {/* Interactive prompt: Question asking if user wants to overwrite existing cost */}
                      {pendingCostOverwrite && (
                        <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2.5 animate-in fade-in-50">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-950 leading-snug">
                              <span className="font-bold">
                                {isVi ? 'Hóa đơn có tổng tiền: ' : 'Receipt total detected: '}
                              </span>
                              <span className="font-extrabold text-amber-800">
                                {formatMoney(pendingCostOverwrite.scannedTotal, trip.currency, lang)}
                              </span>
                              <div className="text-slate-600 text-[11px] mt-0.5">
                                {isVi
                                  ? `Chi phí hiện tại đang là ${formatMoney(pendingCostOverwrite.currentCost, trip.currency, lang)}. Bạn có muốn ghi đè chi phí này bằng số tiền trên hóa đơn không?`
                                  : `Current cost is ${formatMoney(pendingCostOverwrite.currentCost, trip.currency, lang)}. Would you like to overwrite it with the amount from the receipt?`}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (!completedActivityPrompt) return;
                                const newTotal = pendingCostOverwrite.scannedTotal;
                                const splits = calculateEvenSplits(newTotal, completedActivityPrompt.splitWith);
                                setCompletedActivityPrompt({
                                  ...completedActivityPrompt,
                                  amount: String(newTotal),
                                  memberSplits: splits,
                                  isAmountManuallyEdited: true,
                                });
                                setActivityScanNotice(
                                  isVi
                                    ? `✓ Đã ghi đè chi phí theo hóa đơn: ${formatMoney(newTotal, trip.currency, lang)}`
                                    : `✓ Cost overwritten from receipt: ${formatMoney(newTotal, trip.currency, lang)}`
                                );
                                setPendingCostOverwrite(null);
                              }}
                              className="py-1.5 px-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-lg font-bold text-xs transition-colors cursor-pointer text-center shadow-2xs truncate"
                            >
                              {isVi ? `Ghi đè (${formatMoney(pendingCostOverwrite.scannedTotal, trip.currency, lang)})` : 'Overwrite'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActivityScanNotice(
                                  isVi
                                    ? `✓ Đã giữ nguyên chi phí hiện tại (${formatMoney(pendingCostOverwrite.currentCost, trip.currency, lang)}). Đã lưu ảnh hóa đơn.`
                                    : `✓ Retained current cost. Receipt image saved.`
                                );
                                setPendingCostOverwrite(null);
                              }}
                              className="py-1.5 px-2 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 border border-slate-300 rounded-lg font-semibold text-xs transition-colors cursor-pointer text-center shadow-2xs truncate"
                            >
                              {isVi ? 'Giữ nguyên' : 'Keep Current'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Scan feedback notice */}
                      {activityScanNotice && (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 font-medium leading-relaxed">
                          {activityScanNotice}
                        </div>
                      )}
                    </div>

                    {/* Paid By - Searchable Droplist with Checkbox */}
                    <div ref={paidByRef} className="relative">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isVi ? 'Người chi tiền' : 'Payer'}
                      </label>
                      
                      {/* Trigger Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsPaidByDropdownOpen(!isPaidByDropdownOpen);
                          setIsSplitWithDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-left text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {completedActivityPrompt.paidBy === 'fund' ? (
                            <>
                              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 border border-amber-300 shrink-0 font-bold">
                                <PiggyBank className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-amber-800 truncate">{isVi ? 'Quỹ' : 'Group Fund'}</span>
                            </>
                          ) : (() => {
                            const selectedMember = trip.members.find((m) => m.id === completedActivityPrompt.paidBy) || trip.members[0];
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

                      {/* Dropdown Menu */}
                      {isPaidByDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-30 p-2 space-y-2 animate-in fade-in-50 duration-100">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              autoFocus
                              value={paidBySearch}
                              onChange={(e) => setPaidBySearch(e.target.value)}
                              placeholder={isVi ? 'Tìm tên người chi...' : 'Search payer...'}
                              className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-teal-500"
                            />
                          </div>

                          {/* Member Options with Checkboxes */}
                          <div className="max-h-44 overflow-y-auto space-y-1">
                            {/* Tùy chọn Quỹ */}
                            {('quỹ'.includes(paidBySearch.toLowerCase()) || 'quy'.includes(paidBySearch.toLowerCase()) || 'fund'.includes(paidBySearch.toLowerCase()) || !paidBySearch) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletedActivityPrompt({
                                    ...completedActivityPrompt,
                                    paidBy: 'fund',
                                  });
                                  setIsPaidByDropdownOpen(false);
                                  setPaidBySearch('');
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                                  completedActivityPrompt.paidBy === 'fund' ? 'bg-amber-50 text-amber-950 font-bold border border-amber-200' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 border border-amber-300 shrink-0">
                                    <PiggyBank className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="text-xs truncate font-semibold">{isVi ? 'Quỹ' : 'Group Fund'}</span>
                                </div>
                                <div className="shrink-0 ml-2">
                                  {completedActivityPrompt.paidBy === 'fund' ? (
                                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-slate-300" />
                                  )}
                                </div>
                              </button>
                            )}

                            {trip.members
                              .filter((m) => m.name.toLowerCase().includes(paidBySearch.toLowerCase()))
                              .map((member) => {
                                const isSelected = completedActivityPrompt.paidBy === member.id;
                                return (
                                  <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => {
                                      setCompletedActivityPrompt({
                                        ...completedActivityPrompt,
                                        paidBy: member.id,
                                      });
                                      setIsPaidByDropdownOpen(false);
                                      setPaidBySearch('');
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                                      isSelected ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
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
                                    <div className="shrink-0 ml-2">
                                      {isSelected ? (
                                        <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-slate-300" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            {trip.members.filter((m) => m.name.toLowerCase().includes(paidBySearch.toLowerCase())).length === 0 && (
                              <p className="text-xs text-center text-slate-400 py-2">
                                {isVi ? 'Không tìm thấy người này' : 'No member found'}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Người tham gia - Hiển thị chia đều, nhập số tiền từng thành viên, ẩn/hiện bằng mũi nhọn, tích lên đầu */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label 
                          onClick={() => setIsCompletedParticipantsExpanded(!isCompletedParticipantsExpanded)}
                          className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          <Users className="w-3.5 h-3.5 text-teal-600" />
                          <span>{isVi ? 'Người tham gia' : 'Participants'}</span>
                          <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded-full">
                            {completedActivityPrompt.splitWith.length}/{trip.members.length} {isVi ? 'người' : 'members'}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          {/* Nút Chọn tất cả / Bỏ chọn */}
                          {isCompletedParticipantsExpanded && (
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = trip.members.map((m) => m.id);
                                const isAll = completedActivityPrompt.splitWith.length === allIds.length;
                                const fallbackPayer = completedActivityPrompt.paidBy && completedActivityPrompt.paidBy !== 'fund' ? completedActivityPrompt.paidBy : allIds[0];
                                const nextSplitWith = isAll ? [fallbackPayer] : allIds;
                                const num = parseFloat(completedActivityPrompt.amount) || 0;
                                const nextSplits = calculateEvenSplits(num, nextSplitWith);
                                setCompletedActivityPrompt({
                                  ...completedActivityPrompt,
                                  splitWith: nextSplitWith,
                                  memberSplits: nextSplits,
                                });
                              }}
                              className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold px-2 py-0.5 rounded-md hover:bg-teal-100/60 cursor-pointer transition-colors"
                            >
                              {completedActivityPrompt.splitWith.length === trip.members.length
                                ? (isVi ? 'Bỏ chọn' : 'Deselect all')
                                : (isVi ? 'Chọn tất cả' : 'Select all')}
                            </button>
                          )}

                          {/* Ẩn / hiện chỉ bằng icon mũi nhọn xuống / mũi nhọn lên */}
                          <button
                            type="button"
                            onClick={() => setIsCompletedParticipantsExpanded(!isCompletedParticipantsExpanded)}
                            className="p-1 rounded-lg text-teal-800 hover:bg-teal-100/80 cursor-pointer transition-colors border border-teal-300/80 bg-white shadow-2xs flex items-center justify-center"
                            title={isCompletedParticipantsExpanded ? (isVi ? 'Thu gọn' : 'Collapse') : (isVi ? 'Mở rộng' : 'Expand')}
                            aria-label={isCompletedParticipantsExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isCompletedParticipantsExpanded ? (
                              <ChevronUp className="w-4 h-4 text-teal-700" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-teal-700" />
                            )}
                          </button>
                        </div>
                      </div>

                      {!isCompletedParticipantsExpanded ? (
                        /* Khi Thu gọn: Hiển thị avatar stack các thành viên tham gia */
                        <div
                          onClick={() => setIsCompletedParticipantsExpanded(true)}
                          className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors shadow-2xs group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                              {completedActivityPrompt.splitWith.slice(0, 6).map((id) => {
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
                              {completedActivityPrompt.splitWith.length === trip.members.length
                                ? (isVi ? 'Tất cả thành viên đang tham gia' : 'All members participating')
                                : `${completedActivityPrompt.splitWith.length} ${isVi ? 'thành viên tham gia' : 'members participating'}`}
                            </span>
                          </div>
                          <ChevronDown className="w-4 h-4 text-teal-700 shrink-0 ml-2 group-hover:translate-y-0.5 transition-transform" />
                        </div>
                      ) : (
                        /* Khi Mở rộng */
                        <div className="space-y-2">
                          {trip.members.length > 3 && (
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder={isVi ? 'Tìm người tham gia...' : 'Search participants...'}
                                  value={splitWithSearch}
                                  onChange={(e) => setSplitWithSearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                                />
                              </div>
                              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0 text-[10px] font-semibold">
                                <button
                                  type="button"
                                  onClick={() => setCompletedParticipantsFilter('all')}
                                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                    completedParticipantsFilter === 'all'
                                      ? 'bg-teal-600 text-white font-bold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {isVi ? 'Tất cả' : 'All'} ({trip.members.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCompletedParticipantsFilter('selected')}
                                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                    completedParticipantsFilter === 'selected'
                                      ? 'bg-teal-600 text-white font-bold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {isVi ? 'Đã chọn' : 'Selected'} ({completedActivityPrompt.splitWith.length})
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Danh sách thành viên - Sắp xếp người có tích tham gia lên đầu & cho phép nhập số tiền */}
                          <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200 overscroll-contain">
                            {trip.members
                              .filter((m) => {
                                const matchSearch = m.name.toLowerCase().includes(splitWithSearch.toLowerCase());
                                if (!matchSearch) return false;
                                if (completedParticipantsFilter === 'selected') {
                                  return completedActivityPrompt.splitWith.includes(m.id);
                                }
                                return true;
                              })
                              .sort((a, b) => {
                                const aSelected = completedActivityPrompt.splitWith.includes(a.id) ? 1 : 0;
                                const bSelected = completedActivityPrompt.splitWith.includes(b.id) ? 1 : 0;
                                return bSelected - aSelected;
                              })
                              .map((member) => {
                                const isSelected = completedActivityPrompt.splitWith.includes(member.id);
                                return (
                                  <div
                                    key={member.id}
                                    onClick={() => {
                                      const current = completedActivityPrompt.splitWith;
                                      const next = isSelected
                                        ? current.filter((id) => id !== member.id)
                                        : [...current, member.id];
                                      const finalSplit = next.length > 0 ? next : [member.id];
                                      const num = parseFloat(completedActivityPrompt.amount) || 0;
                                      const nextSplits = calculateEvenSplits(num, finalSplit);
                                      setCompletedActivityPrompt({
                                        ...completedActivityPrompt,
                                        splitWith: finalSplit,
                                        memberSplits: nextSplits,
                                      });
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-teal-50/90 text-teal-950 font-semibold border border-teal-300'
                                        : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <div className="shrink-0">
                                        {isSelected ? (
                                          <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                        ) : (
                                          <Circle className="w-4 h-4 text-slate-300" />
                                        )}
                                      </div>
                                      <img
                                        src={member.avatar}
                                        alt={member.name}
                                        className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                                      />
                                      <span className="text-xs truncate">{member.name}</span>
                                    </div>

                                    {/* Nhập số tiền của từng thành viên tham gia */}
                                    {isSelected && (
                                      <div 
                                        className="shrink-0 ml-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={completedActivityPrompt.memberSplits?.[member.id] ?? ''}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            const val = e.target.value;
                                            setCompletedActivityPrompt({
                                              ...completedActivityPrompt,
                                              memberSplits: {
                                                ...(completedActivityPrompt.memberSplits || {}),
                                                [member.id]: val,
                                              },
                                            });
                                          }}
                                          placeholder="0"
                                          className="w-24 text-right text-xs font-bold px-2 py-1 bg-white border border-teal-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-teal-500 text-slate-800"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>

                          {/* Thanh đối chiếu: Tổng chi phí từng thành viên bằng chi phí */}
                          {(() => {
                            const memberSplitsTotal = completedActivityPrompt.splitWith.reduce((acc, mId) => {
                              const val = parseFloat(completedActivityPrompt.memberSplits?.[mId] || '0');
                              return acc + (isNaN(val) ? 0 : val);
                            }, 0);
                            const totalCostNum = parseFloat(completedActivityPrompt.amount) || 0;
                            const diff = Math.round((memberSplitsTotal - totalCostNum) * 100) / 100;
                            const isBalanced = Math.abs(diff) < 0.01;

                            return (
                              <div className={`p-3 rounded-xl border transition-colors text-xs ${
                                isBalanced
                                  ? 'bg-teal-50/80 border-teal-200 text-teal-900'
                                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    {isBalanced ? (
                                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                                    ) : (
                                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                    )}
                                    <span className="text-slate-600 font-semibold">{isVi ? 'Tổng:' : 'Total:'}</span>
                                    <span className="font-extrabold text-slate-900">{formatMoney(memberSplitsTotal, trip.currency, lang)}</span>
                                  </div>
                                </div>

                                {/* Dư / thiếu số tiền xuống hàng dưới tổng */}
                                {!isBalanced && (
                                  <div className="mt-1 pl-4 text-xs font-semibold text-amber-700">
                                    {diff > 0 
                                      ? (isVi ? `Dư: +${formatMoney(diff, trip.currency, lang)}` : `Over: +${formatMoney(diff, trip.currency, lang)}`) 
                                      : (isVi ? `Thiếu: -${formatMoney(Math.abs(diff), trip.currency, lang)}` : `Short: -${formatMoney(Math.abs(diff), trip.currency, lang)}`)}
                                  </div>
                                )}

                                {!isBalanced && (
                                  <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-amber-200/70">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCompletedActivityPrompt({
                                          ...completedActivityPrompt,
                                          amount: String(memberSplitsTotal),
                                        });
                                      }}
                                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs text-center"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">{isVi ? 'Cập nhật' : 'Update'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const splits = calculateEvenSplits(totalCostNum, completedActivityPrompt.splitWith);
                                        setCompletedActivityPrompt({
                                          ...completedActivityPrompt,
                                          memberSplits: splits,
                                        });
                                      }}
                                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 border border-slate-300 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs text-center"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                      <span className="truncate">{isVi ? 'Chia đều lại' : 'Split equally'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="flex items-center justify-end gap-2 p-4 bg-slate-50/80 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCompletedActivityPrompt(null);
                    setPendingCostOverwrite(null);
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  {isVi ? 'Đóng' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompletedActivityPrompt}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Lưu' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Activity Edit Modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-5 py-3.5 bg-blue-700 text-white flex items-center justify-between shrink-0">
              <h3 className="font-display font-bold text-sm sm:text-base flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" />
                <span>{isVi ? 'Chỉnh Sửa Hoạt Động' : 'Edit Activity'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
              
              {/* Day selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Ngày trong chuyến đi' : 'Day'}
                </label>
                <select
                  value={editDayNumber}
                  onChange={(e) => setEditDayNumber(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                >
                  {trip.days.map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      {isVi
                        ? `Ngày ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`
                        : `Day ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Tên hoạt động *' : 'Activity Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Địa điểm *' : 'Location *'}
                </label>
                <input
                  type="text"
                  required
                  value={editLocationName}
                  onChange={(e) => setEditLocationName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Thời gian' : 'Time'}
                  </label>
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Thể loại' : 'Category'}
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CategoryType)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}{isVi ? c.nameVi : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unified Cost (Chi phí) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Chi phí' : 'Cost'} ({editingActivity.activity.currency || trip.currency || 'VND'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editEstimatedCost}
                    onChange={(e) => {
                      setEditEstimatedCost(e.target.value);
                      setEditActualCost(e.target.value);
                      const num = parseFloat(e.target.value) || 0;
                      // Mặc định chia đều cho các thành viên được tích tham gia
                      setEditMemberSplits(calculateEvenSplits(num, editSplitWith));
                    }}
                    placeholder="0"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Lưu ý' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Merged Expense Management Section */}
              {editingActivity.activity.isCompleted && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-200/60">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <CreditCard className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-emerald-950">
                          {isVi ? 'Ghi nhận chi tiêu' : 'Record expense'}
                        </span>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-900 select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={editRecordExpense}
                          onChange={(e) => setEditRecordExpense(e.target.checked)}
                          className="w-4 h-4 rounded-md border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>{editRecordExpense ? (isVi ? 'Đang bật' : 'On') : (isVi ? 'Tắt' : 'Off')}</span>
                      </label>
                    </div>

                    {editRecordExpense && (
                      <div className="space-y-3.5">
                        {/* Paid By Droplist */}
                        <div ref={editPaidByRef} className="relative">
                          <label className="block text-xs font-bold text-emerald-900 mb-1">
                            {isVi ? 'Người chi tiền' : 'Payer'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditPaidByDropdownOpen(!isEditPaidByDropdownOpen);
                            }}
                            className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-emerald-300/80 hover:border-emerald-400 text-left text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {editPaidBy === 'fund' ? (
                                <>
                                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 border border-amber-300 shrink-0 font-bold">
                                    <PiggyBank className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="font-bold text-amber-800 truncate">{isVi ? 'Quỹ' : 'Group Fund'}</span>
                                </>
                              ) : (() => {
                                const selectedMember = trip.members.find((m) => m.id === editPaidBy) || trip.members[0];
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
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isEditPaidByDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isEditPaidByDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                              <div className="relative mb-2">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder={isVi ? 'Tìm thành viên...' : 'Search member...'}
                                  value={editPaidBySearch}
                                  onChange={(e) => setEditPaidBySearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {/* Tùy chọn Quỹ */}
                                {('quỹ'.includes(editPaidBySearch.toLowerCase()) || 'quy'.includes(editPaidBySearch.toLowerCase()) || 'fund'.includes(editPaidBySearch.toLowerCase()) || !editPaidBySearch) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditPaidBy('fund');
                                      setIsEditPaidByDropdownOpen(false);
                                      setEditPaidBySearch('');
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                                      editPaidBy === 'fund' ? 'bg-amber-50 text-amber-950 font-bold border border-amber-200' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 border border-amber-300 shrink-0">
                                        <PiggyBank className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-xs truncate font-semibold">{isVi ? 'Quỹ' : 'Group Fund'}</span>
                                    </div>
                                    <div className="shrink-0 ml-2">
                                      {editPaidBy === 'fund' && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                                    </div>
                                  </button>
                                )}

                                {trip.members
                                  .filter((m) => m.name.toLowerCase().includes(editPaidBySearch.toLowerCase()))
                                  .map((member) => (
                                    <button
                                      key={member.id}
                                      type="button"
                                      onClick={() => {
                                        setEditPaidBy(member.id);
                                        setIsEditPaidByDropdownOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                                        editPaidBy === member.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
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
                                      {editPaidBy === member.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Người tham gia - Khung người tham gia có icon ẩn / hiện mũi nhọn lên / xuống & sắp xếp tích lên đầu */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label 
                              onClick={() => setIsEditParticipantsExpanded(!isEditParticipantsExpanded)}
                              className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 cursor-pointer select-none"
                            >
                              <Users className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{isVi ? 'Người tham gia' : 'Participants'}</span>
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-full">
                                {editSplitWith.length}/{trip.members.length} {isVi ? 'người' : 'members'}
                              </span>
                            </label>

                            <div className="flex items-center gap-1.5">
                              {/* Nút Chọn tất cả / Bỏ chọn */}
                              {isEditParticipantsExpanded && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allIds = trip.members.map((m) => m.id);
                                    const isAll = editSplitWith.length === allIds.length;
                                    const fallbackPayer = editPaidBy && editPaidBy !== 'fund' ? editPaidBy : allIds[0];
                                    const nextSplitWith = isAll ? [fallbackPayer] : allIds;
                                    const num = parseFloat(editEstimatedCost) || 0;
                                    setEditSplitWith(nextSplitWith);
                                    setEditMemberSplits(calculateEvenSplits(num, nextSplitWith));
                                  }}
                                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold px-2 py-0.5 rounded-md hover:bg-emerald-100/60 cursor-pointer transition-colors"
                                >
                                  {editSplitWith.length === trip.members.length
                                    ? (isVi ? 'Bỏ chọn' : 'Deselect all')
                                    : (isVi ? 'Chọn tất cả' : 'Select all')}
                                </button>
                              )}

                              {/* Ẩn / hiện chỉ bằng icon mũi nhọn xuống / mũi nhọn lên */}
                              <button
                                type="button"
                                onClick={() => setIsEditParticipantsExpanded(!isEditParticipantsExpanded)}
                                className="p-1 rounded-lg text-emerald-800 hover:bg-emerald-100/80 cursor-pointer transition-colors border border-emerald-300/80 bg-white shadow-2xs flex items-center justify-center"
                                title={isEditParticipantsExpanded ? (isVi ? 'Thu gọn' : 'Collapse') : (isVi ? 'Mở rộng' : 'Expand')}
                                aria-label={isEditParticipantsExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isEditParticipantsExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-emerald-700" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-emerald-700" />
                                )}
                              </button>
                            </div>
                          </div>

                          {!isEditParticipantsExpanded ? (
                            /* Khi Ẩn: Thu gọn với danh sách avatar và icon mũi nhọn xuống */
                            <div
                              onClick={() => setIsEditParticipantsExpanded(true)}
                              className="p-2.5 bg-white rounded-xl border border-emerald-300/80 flex items-center justify-between cursor-pointer hover:bg-emerald-50/50 transition-colors shadow-2xs group"
                            >
                              <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                                  {editSplitWith.slice(0, 6).map((id) => {
                                    const m = trip.members.find((mb) => mb.id === id);
                                    if (!m) return null;
                                    return (
                                      <img
                                        key={id}
                                        src={m.avatar}
                                        alt={m.name}
                                        title={m.name}
                                        className="w-5 h-5 rounded-full object-cover border-2 border-white ring-1 ring-emerald-300"
                                      />
                                    );
                                  })}
                                </div>
                                <span className="text-xs text-slate-700 font-medium truncate">
                                  {editSplitWith.length === trip.members.length
                                    ? (isVi ? 'Tất cả thành viên đang tham gia' : 'All members participating')
                                    : `${editSplitWith.length} ${isVi ? 'thành viên tham gia' : 'members participating'}`}
                                </span>
                              </div>
                              <ChevronDown className="w-4 h-4 text-emerald-700 shrink-0 ml-2 group-hover:translate-y-0.5 transition-transform" />
                            </div>
                          ) : (
                            /* Khi Hiện tất cả */
                            <div className="space-y-2">
                              {/* Search & Filter if members > 3 */}
                              {trip.members.length > 3 && (
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder={isVi ? 'Tìm người tham gia...' : 'Search participants...'}
                                      value={editSplitWithSearch}
                                      onChange={(e) => setEditSplitWithSearch(e.target.value)}
                                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-emerald-300/80 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-emerald-200/70 shrink-0 text-[10px] font-semibold">
                                    <button
                                      type="button"
                                      onClick={() => setEditParticipantsFilter('all')}
                                      className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                        editParticipantsFilter === 'all'
                                          ? 'bg-emerald-600 text-white font-bold'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      {isVi ? 'Tất cả' : 'All'} ({trip.members.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditParticipantsFilter('selected')}
                                      className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                        editParticipantsFilter === 'selected'
                                          ? 'bg-emerald-600 text-white font-bold'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      {isVi ? 'Đã chọn' : 'Selected'} ({editSplitWith.length})
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Khung người tham gia - Sắp xếp người có tích tham gia lên đầu & cho phép nhập số tiền */}
                              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white rounded-xl border border-emerald-300/80 shadow-2xs overscroll-contain">
                                {trip.members
                                  .filter((m) => {
                                    const matchSearch = m.name.toLowerCase().includes(editSplitWithSearch.toLowerCase());
                                    if (!matchSearch) return false;
                                    if (editParticipantsFilter === 'selected') {
                                      return editSplitWith.includes(m.id);
                                    }
                                    return true;
                                  })
                                  .sort((a, b) => {
                                    const aSelected = editSplitWith.includes(a.id) ? 1 : 0;
                                    const bSelected = editSplitWith.includes(b.id) ? 1 : 0;
                                    // Sắp xếp người có tích tham gia lên đầu
                                    if (aSelected !== bSelected) {
                                      return bSelected - aSelected;
                                    }
                                    return 0;
                                  })
                                  .map((member) => {
                                    const isSelected = editSplitWith.includes(member.id);
                                    return (
                                      <div
                                        key={member.id}
                                        onClick={() => {
                                          const current = editSplitWith;
                                          const next = isSelected
                                            ? current.filter((id) => id !== member.id)
                                            : [...current, member.id];
                                          const finalSplit = next.length > 0 ? next : [member.id];
                                          const num = parseFloat(editEstimatedCost) || 0;
                                          setEditSplitWith(finalSplit);
                                          setEditMemberSplits(calculateEvenSplits(num, finalSplit));
                                        }}
                                        className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                                          isSelected
                                            ? 'bg-emerald-50/90 text-emerald-950 font-semibold border border-emerald-300'
                                            : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <div className="shrink-0">
                                            {isSelected ? (
                                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            ) : (
                                              <Circle className="w-4 h-4 text-slate-300" />
                                            )}
                                          </div>
                                          <img
                                            src={member.avatar}
                                            alt={member.name}
                                            className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                                          />
                                          <span className="text-xs truncate">{member.name}</span>
                                        </div>

                                        {/* Nhập số tiền của từng thành viên tham gia */}
                                        {isSelected && (
                                          <div 
                                            className="shrink-0 ml-2"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <input
                                              type="number"
                                              min="0"
                                              step="any"
                                              value={editMemberSplits[member.id] ?? ''}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                const val = e.target.value;
                                                setEditMemberSplits((prev) => ({
                                                  ...prev,
                                                  [member.id]: val,
                                                }));
                                              }}
                                              placeholder="0"
                                              className="w-24 text-right text-xs font-bold px-2 py-1 bg-white border border-emerald-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-800"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                {trip.members.filter((m) => m.name.toLowerCase().includes(editSplitWithSearch.toLowerCase())).length === 0 && (
                                  <p className="text-xs text-center text-slate-400 py-2">
                                    {isVi ? 'Không tìm thấy người này' : 'No participant found'}
                                  </p>
                                )}
                              </div>

                              {/* Thanh đối chiếu: Tổng chi phí từng thành viên bằng chi phí */}
                              {(() => {
                                const memberSplitsTotal = editSplitWith.reduce((acc, mId) => {
                                  const val = parseFloat(editMemberSplits[mId] || '0');
                                  return acc + (isNaN(val) ? 0 : val);
                                }, 0);
                                const totalCostNum = parseFloat(editEstimatedCost) || 0;
                                const diff = Math.round((memberSplitsTotal - totalCostNum) * 100) / 100;
                                const isBalanced = Math.abs(diff) < 0.01;

                                return (
                                  <div className={`p-3 rounded-xl border transition-colors text-xs ${
                                    isBalanced
                                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                      : 'bg-amber-50/80 border-amber-200 text-amber-900'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-bold">
                                        {isBalanced ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        ) : (
                                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                        )}
                                        <span className="text-slate-600 font-semibold">{isVi ? 'Tổng:' : 'Total:'}</span>
                                        <span className="font-extrabold text-slate-900">{formatMoney(memberSplitsTotal, trip.currency, lang)}</span>
                                      </div>
                                    </div>

                                    {/* Dư / thiếu số tiền xuống hàng dưới tổng */}
                                    {!isBalanced && (
                                      <div className="mt-1 pl-4 text-xs font-semibold text-amber-700">
                                        {diff > 0 
                                          ? (isVi ? `Dư: +${formatMoney(diff, trip.currency, lang)}` : `Over: +${formatMoney(diff, trip.currency, lang)}`) 
                                          : (isVi ? `Thiếu: -${formatMoney(Math.abs(diff), trip.currency, lang)}` : `Short: -${formatMoney(Math.abs(diff), trip.currency, lang)}`)}
                                      </div>
                                    )}

                                    {!isBalanced && (
                                      <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-amber-200/70">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditEstimatedCost(String(memberSplitsTotal));
                                            setEditActualCost(String(memberSplitsTotal));
                                          }}
                                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs text-center"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                          <span className="truncate">{isVi ? 'Cập nhật' : 'Update'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const splits = calculateEvenSplits(totalCostNum, editSplitWith);
                                            setEditMemberSplits(splits);
                                          }}
                                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 border border-slate-300 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs text-center"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                          <span className="truncate">{isVi ? 'Chia đều lại' : 'Split equally'}</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (editingActivity) {
                      setActivityToDelete({ activity: editingActivity.activity, dayNumber: editingActivity.dayNumber });
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Xóa' : 'Delete'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingActivity(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    {isVi ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    {isVi ? 'Lưu' : 'Save'}
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 7. Modal: Xác nhận xóa hoạt động */}
      {activityToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base">
                  {isVi ? 'Xóa hoạt động?' : 'Delete Activity?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isVi
                    ? `Bạn có chắc muốn xóa hoạt động "${activityToDelete.activity.title}" khỏi Ngày ${activityToDelete.dayNumber}?`
                    : `Are you sure you want to delete "${activityToDelete.activity.title}" from Day ${activityToDelete.dayNumber}?`}
                </p>
              </div>
            </div>

            {activityToDelete.activity.isCompleted && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                {isVi
                  ? 'Hoạt động này đã hoàn thành. Khi xóa, khoản chi tiêu liên kết với hoạt động này cũng sẽ được tự động xóa khỏi tab Chi tiêu.'
                  : 'This activity is marked as completed. Deleting it will also remove its linked expense from the Expenses tab.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivityToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteActivity(activityToDelete.dayNumber, activityToDelete.activity.id);
                  if (editingActivity?.activity.id === activityToDelete.activity.id) {
                    setEditingActivity(null);
                  }
                  setActivityToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                {isVi ? 'Xác nhận' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Settings Modal */}
      <CategorySettingsModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categoriesList}
        onUpdateCategories={(newCats) => setCategoriesList(newCats)}
      />

      {/* Fullscreen Receipt Image Viewer */}
      {viewingActivityReceiptImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          onClick={() => setViewingActivityReceiptImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-600" />
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  {isVi ? 'Ảnh Hóa Đơn / Biên Lai' : 'Receipt Image'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingActivityReceiptImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-slate-100/50">
              <img
                src={viewingActivityReceiptImage}
                alt="Receipt Full Preview"
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-xs"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
