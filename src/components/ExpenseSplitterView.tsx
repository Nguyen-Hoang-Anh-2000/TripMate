import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  DollarSign, Plus, Users, CreditCard, ArrowRight, Trash2, CheckCircle, CheckCircle2, Circle,
  Receipt, ArrowUpRight, ShieldCheck, Wallet, PiggyBank, Edit2, Edit3, Check, X, 
  AlertCircle, UserPlus, Eye, RefreshCw, Calendar, Tag, FileText, ChevronRight, ChevronDown, ChevronUp,
  Search, RotateCcw, Download, Sparkles, Copy, SlidersHorizontal, Image, Camera, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Trip, Expense, CategoryType, TripMember } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';
import { calculateEvenSplits } from './ItineraryView';
import { ReceiptScannerModal, ScannedReceiptData } from './ReceiptScannerModal';

interface ExpenseSplitterViewProps {
  trip: Trip;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (expenseId: string, activityId?: string) => void;
  onUpdateExpense?: (item: {
    id: string;
    sourceType: 'completed_activity' | 'manual_expense';
    activityId?: string;
    expenseId?: string;
    title: string;
    amount: number;
    currency?: string;
    category: CategoryType;
    paidBy: string;
    splitWith: string[];
    memberSplits?: { memberId: string; amount: number }[];
    date?: string;
    dayNumber?: number;
    note?: string;
    receiptImageUrl?: string;
  }) => void;
  onAddMember?: (member: Omit<TripMember, 'id'> & { contributedAmount?: number }) => void;
  onUpdateMember?: (memberId: string, data: Partial<TripMember>) => void;
  onDeleteMember?: (memberId: string) => void;
  onSetFundHolder?: (memberId: string) => void;
}

export interface UnifiedExpenseItem {
  id: string;
  sourceType: 'completed_activity' | 'manual_expense';
  title: string;
  amount: number;
  currency: string;
  category: CategoryType;
  paidBy: string;
  splitWith: string[];
  memberSplits?: { memberId: string; amount: number }[];
  date?: string;
  dayNumber?: number;
  activityId?: string;
  expenseId?: string;
  note?: string;
  receiptImageUrl?: string;
  receiptItems?: { name: string; price: number; quantity?: number }[];
}

export const ExpenseSplitterView: React.FC<ExpenseSplitterViewProps> = ({
  trip,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onSetFundHolder,
}) => {
  const { t, lang } = useLanguage();
  const isVi = lang === 'vi';

  // Forms & Modal state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TripMember | null>(null);

  // Selected Expense for Detail & Edit Modal
  const [selectedExpense, setSelectedExpense] = useState<UnifiedExpenseItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<CategoryType>('other');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editSplitWith, setEditSplitWith] = useState<string[]>([]);
  const [editMemberSplits, setEditMemberSplits] = useState<{ [memberId: string]: string }>({});
  const [isEditPaidByDropdownOpen, setIsEditPaidByDropdownOpen] = useState(false);
  const [editPaidBySearch, setEditPaidBySearch] = useState('');
  const [isEditParticipantsExpanded, setIsEditParticipantsExpanded] = useState(true);
  const [editSplitWithSearch, setEditSplitWithSearch] = useState('');
  const [editParticipantsFilter, setEditParticipantsFilter] = useState<'all' | 'selected'>('all');
  const editPaidByRef = useRef<HTMLDivElement>(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [expenseToDelete, setExpenseToDelete] = useState<UnifiedExpenseItem | null>(null);

  // Close paidBy dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editPaidByRef.current && !editPaidByRef.current.contains(e.target as Node)) {
        setIsEditPaidByDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick edit member contribution
  const [editingContribMemberId, setEditingContribMemberId] = useState<string | null>(null);
  const [editingContribValue, setEditingContribValue] = useState<string>('');

  // Add Member form state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberContributed, setNewMemberContributed] = useState('0');

  // Add Expense form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CategoryType>('food');
  const [paidBy, setPaidBy] = useState(trip.members[0]?.id || 'm1');
  const [splitWith, setSplitWith] = useState<string[]>(trip.members.map((m) => m.id));
  const [addMemberSplits, setAddMemberSplits] = useState<{ [memberId: string]: string }>(() =>
    calculateEvenSplits(0, trip.members.map((m) => m.id))
  );
  const [isAddParticipantsExpanded, setIsAddParticipantsExpanded] = useState(true);
  const [addSplitWithSearch, setAddSplitWithSearch] = useState('');
  const [addParticipantsFilter, setAddParticipantsFilter] = useState<'all' | 'selected'>('all');

  // AI OCR Receipt Scanner states
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [attachedReceiptUrl, setAttachedReceiptUrl] = useState<string | null>(null);

  // Simplified Debts & Settlement states
  const [isSimplifiedDebts, setIsSimplifiedDebts] = useState<boolean>(true);
  const [copiedSettlement, setCopiedSettlement] = useState<boolean>(false);

  // Validation & Error states
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Receipt image preview modal
  const [viewingReceiptImage, setViewingReceiptImage] = useState<string | null>(null);

  const handleApplyReceipt = (data: ScannedReceiptData) => {
    setTitle(data.storeName);
    setAmount(String(data.totalAmount));
    setCategory(data.category);
    setAttachedReceiptUrl(data.receiptImageBase64 || null);
    setAddFormError(null);

    const resetIds = trip.members.map((m) => m.id);
    setSplitWith(resetIds);
    setAddMemberSplits(calculateEvenSplits(data.totalAmount, resetIds));
    setShowExpenseForm(true);
  };

  // Current designated fund holder (defaults to trip.fundHolderId or first member)
  const fundHolderId = trip.fundHolderId || trip.members[0]?.id || '';
  const fundHolder = trip.members.find((m) => m.id === fundHolderId) || trip.members[0];

  const handleOpenExpenseDetails = (item: UnifiedExpenseItem) => {
    setSelectedExpense(item);
    setEditTitle(item.title);
    setEditAmount(String(item.amount));
    setEditCategory(item.category || 'other');
    setEditPaidBy(item.paidBy || 'fund');
    const finalSplitWith = item.splitWith && item.splitWith.length > 0 ? item.splitWith : trip.members.map((m) => m.id);
    setEditSplitWith(finalSplitWith);

    let initialSplits: { [mId: string]: string } = {};
    const existingSplits = item.memberSplits;
    if (existingSplits && existingSplits.length > 0) {
      existingSplits.forEach((s) => {
        initialSplits[s.memberId] = String(s.amount);
      });
      finalSplitWith.forEach((id) => {
        if (initialSplits[id] === undefined) initialSplits[id] = '0';
      });
    } else {
      initialSplits = calculateEvenSplits(item.amount, finalSplitWith);
    }
    setEditMemberSplits(initialSplits);

    setEditDate(item.date || '');
    setEditNote(item.note || '');
    setIsEditPaidByDropdownOpen(false);
    setEditPaidBySearch('');
    setEditSplitWithSearch('');
    setEditParticipantsFilter('all');
    setIsEditParticipantsExpanded(true);
  };

  const handleToggleEditSplitWith = (memberId: string) => {
    const current = editSplitWith;
    const isSelected = current.includes(memberId);
    const next = isSelected ? current.filter((id) => id !== memberId) : [...current, memberId];
    const finalSplit = next.length > 0 ? next : [memberId];
    const num = parseFloat(editAmount) || 0;
    setEditSplitWith(finalSplit);
    setEditMemberSplits(calculateEvenSplits(num, finalSplit));
  };

  const handleSelectAllEditSplitWith = () => {
    const allIds = trip.members.map((m) => m.id);
    const isAll = editSplitWith.length === allIds.length;
    const fallbackPayer = editPaidBy && editPaidBy !== 'fund' ? editPaidBy : allIds[0];
    const nextSplitWith = isAll ? [fallbackPayer] : allIds;
    const num = parseFloat(editAmount) || 0;
    setEditSplitWith(nextSplitWith);
    setEditMemberSplits(calculateEvenSplits(num, nextSplitWith));
  };

  const handleSaveExpenseDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!editTitle.trim()) return;

    const formattedMemberSplits: { memberId: string; amount: number }[] = editSplitWith.map((mId) => ({
      memberId: mId,
      amount: parseFloat(editMemberSplits[mId] || '0') || 0,
    }));

    if (onUpdateExpense) {
      onUpdateExpense({
        id: selectedExpense.id,
        sourceType: selectedExpense.sourceType,
        activityId: selectedExpense.activityId,
        expenseId: selectedExpense.expenseId,
        title: editTitle.trim(),
        amount: parsedAmount,
        currency: selectedExpense.currency || trip.currency || 'VND',
        category: editCategory,
        paidBy: editPaidBy,
        splitWith: editSplitWith.length > 0 ? editSplitWith : trip.members.map((m) => m.id),
        memberSplits: formattedMemberSplits,
        date: editDate,
        dayNumber: selectedExpense.dayNumber,
        note: editNote.trim(),
      });
    }

    setSelectedExpense(null);
  };

  const handleConfirmDeleteExpense = () => {
    if (!expenseToDelete) return;
    onDeleteExpense(expenseToDelete.expenseId || expenseToDelete.id, expenseToDelete.activityId);
    setExpenseToDelete(null);
    if (selectedExpense && selectedExpense.id === expenseToDelete.id) {
      setSelectedExpense(null);
    }
  };

  // =========================================================================
  // 1. UNIFIED EXPENSE LIST:
  // "Tổng tiền đã chi là tổng tiền đã chi >> là tổng chi phí đã hoàn thành hoạt động + chi tiêu được thêm mới"
  // "Lịch sử chi tiêu ghi nhận các hoạt động hoàn thành và chi tiêu đã thêm"
  // =========================================================================
  const unifiedExpenses = useMemo<UnifiedExpenseItem[]>(() => {
    const records: UnifiedExpenseItem[] = [];
    const processedActivityIds = new Set<string>();

    // Helper kiểm tra xem expense có gắn với hoạt động nào trong lịch trình không
    const findLinkedActivity = (exp: Expense) => {
      for (const day of trip.days) {
        for (const act of day.activities) {
          if (exp.activityId && act.id === exp.activityId) {
            return { act, dayNumber: day.dayNumber, date: day.date };
          }
          if (act.expenseId && act.expenseId === exp.id) {
            return { act, dayNumber: day.dayNumber, date: day.date };
          }
          const expTitle = exp.title.trim().toLowerCase();
          const actTitle = act.title.trim().toLowerCase();
          if (expTitle === actTitle) {
            return { act, dayNumber: day.dayNumber, date: day.date };
          }
          if (exp.receiptNote && exp.receiptNote.toLowerCase().includes(actTitle)) {
            return { act, dayNumber: day.dayNumber, date: day.date };
          }
          if (expTitle.includes(actTitle) || actTitle.includes(expTitle)) {
            return { act, dayNumber: day.dayNumber, date: day.date };
          }
        }
      }
      return null;
    };

    // A. Thêm các khoản từ trip.expenses
    trip.expenses.forEach((exp) => {
      let dayNum: number | undefined;
      let actId = exp.activityId;
      let foundDate: string | undefined = exp.date;

      const linked = findLinkedActivity(exp);
      if (linked) {
        actId = linked.act.id;
        processedActivityIds.add(linked.act.id);
        dayNum = linked.dayNumber;
        if (!foundDate) foundDate = linked.date;
      }

      records.push({
        id: exp.id,
        sourceType: actId ? 'completed_activity' : 'manual_expense',
        title: exp.title,
        amount: Number(exp.amount) || 0,
        currency: exp.currency || trip.currency || 'VND',
        category: exp.category || 'other',
        paidBy: exp.paidBy || trip.fundHolderId || trip.members[0]?.id || 'm1',
        splitWith: exp.splitWith && exp.splitWith.length > 0 ? exp.splitWith : trip.members.map((m) => m.id),
        memberSplits: exp.memberSplits,
        date: foundDate,
        dayNumber: dayNum,
        activityId: actId,
        expenseId: exp.id,
        note: exp.receiptNote,
        receiptImageUrl: exp.receiptImageUrl,
        receiptItems: exp.receiptItems,
      });
    });

    // B. Thêm các hoạt động đã hoàn thành trong lịch trình mà chưa có trong trip.expenses
    trip.days.forEach((day) => {
      day.activities.forEach((act) => {
        if (act.isCompleted && !processedActivityIds.has(act.id)) {
          processedActivityIds.add(act.id);
          const cost = act.actualCost !== undefined ? Number(act.actualCost) : Number(act.estimatedCost || 0);
          records.push({
            id: act.expenseId || `act-completed-${act.id}`,
            sourceType: 'completed_activity',
            title: act.title,
            amount: cost,
            currency: act.currency || trip.currency || 'VND',
            category: act.category || 'activity',
            paidBy: act.paidBy || trip.fundHolderId || trip.members[0]?.id || 'm1',
            splitWith: act.splitWith && act.splitWith.length > 0 ? act.splitWith : trip.members.map((m) => m.id),
            memberSplits: act.memberSplits,
            date: day.date,
            dayNumber: day.dayNumber,
            activityId: act.id,
            expenseId: act.expenseId,
            note: act.notes,
          });
        }
      });
    });

    return records;
  }, [trip.expenses, trip.days, trip.currency, trip.fundHolderId, trip.members]);

  // Đếm số lượng chi tiêu thêm và hoạt động hoàn tất
  const manualExpensesCount = useMemo(() => {
    return unifiedExpenses.filter((e) => e.sourceType === 'manual_expense').length;
  }, [unifiedExpenses]);

  const completedActivitiesCount = useMemo(() => {
    return unifiedExpenses.filter((e) => e.sourceType === 'completed_activity').length;
  }, [unifiedExpenses]);

  // =========================================================================
  // 2. TỔNG QUAN TỔNG TIỀN ĐÃ GÓP & TỔNG TIỀN ĐÃ CHI
  // =========================================================================
  const totalContributed = trip.members.reduce((sum, m) => sum + (Number(m.contributedAmount) || 0), 0);
  const totalSpent = unifiedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const fundRemaining = totalContributed - totalSpent;

  // =========================================================================
  // 3. THÀNH VIÊN VÀ QUỸ ĐÓNG GÓP:
  // + Đã trả thêm: giá trị chi phí người đã chi tiền khi hoàn thành hoạt động / chi tiêu
  // + Tiền đã dùng: chi phí được chia ra trong thành viên tham gia khi hoàn thành hoạt động / chi tiêu
  // Số dư còn lại: A góp + A đã trả thêm - A đã dùng = A còn lại
  // =========================================================================
  const memberStats = trip.members.map((member) => {
    const contributed = member.contributedAmount || 0;

    // Tiền thành viên đã trả thêm: giá trị chi phí người đã chi tiền khi hoàn thành hoạt động / thêm chi tiêu
    const paidExtra = unifiedExpenses
      .filter((e) => e.paidBy === member.id)
      .reduce((sum, e) => sum + e.amount, 0);

    // Tiền đã dùng: chi phí được chia ra trong thành viên tham gia khi hoàn thành hoạt động / chi tiêu
    let used = 0;
    unifiedExpenses.forEach((exp) => {
      if (exp.memberSplits && exp.memberSplits.length > 0) {
        const ms = exp.memberSplits.find((s) => s.memberId === member.id);
        if (ms) {
          used += ms.amount;
        }
      } else {
        const beneficiaries = exp.splitWith.length > 0 ? exp.splitWith : trip.members.map((m) => m.id);
        if (beneficiaries.includes(member.id)) {
          used += exp.amount / (beneficiaries.length || 1);
        }
      }
    });

    // Công thức: A góp + A đã trả thêm - A đã dùng = A còn lại
    const remainingBalance = Math.round((contributed + paidExtra - used) * 100) / 100;

    return {
      member,
      contributed,
      paidExtra,
      used,
      remainingBalance,
    };
  });

  // =========================================================================
  // 4. QUYẾT TOÁN CÔNG NỢ THÀNH VIÊN
  // Quy tắc tính toán:
  // - Nếu thành viên có số dư >= 0 (số dư dương hoặc bằng 0):
  //   tiền đóng quỹ và tiền đã trả thêm đủ bù chi phí, thành viên KHÔNG NỢ AI.
  // - Nếu thành viên có số dư âm (remainingBalance < 0):
  //   thành viên đang nợ người đã trả thêm trong các hoạt động/chi tiêu mà họ tham gia.
  // =========================================================================
  const settlements = useMemo(() => {
    // 1. Phân loại người có số dư âm (debtors) và người có số dư dương (creditors)
    const debtors = memberStats
      .filter((s) => s.remainingBalance < -0.01)
      .map((s) => ({
        id: s.member.id,
        debtAmount: Math.abs(s.remainingBalance),
      }));

    const creditors = memberStats
      .filter((s) => s.remainingBalance > 0.01)
      .map((s) => ({
        id: s.member.id,
        availableCredit: s.remainingBalance,
      }));

    // Nếu không có ai âm tiền, không ai nợ ai (mọi người đều có số dư dương/hợp lệ)
    if (debtors.length === 0 || creditors.length === 0) {
      return [];
    }

    // 2. Tính xem mỗi người chi tiền (Payer) đã trả bao nhiêu cho mỗi người bị âm tiền (Debtor)
    // trong các hoạt động/chi tiêu mà con nợ có tham gia
    const paidForDebtorByPayer: Record<string, Record<string, number>> = {};
    debtors.forEach((d) => {
      paidForDebtorByPayer[d.id] = {};
    });

    unifiedExpenses.forEach((exp) => {
      const payerId = exp.paidBy;
      if (payerId === 'fund') return; // Quỹ chung chi trả, không ai là chủ nợ cá nhân cho khoản chi này

      debtors.forEach((d) => {
        if (payerId === d.id) return; // Không tính tự trả cho chính mình

        let shareForD = 0;
        if (exp.memberSplits && exp.memberSplits.length > 0) {
          const ms = exp.memberSplits.find((s) => s.memberId === d.id);
          if (ms) shareForD = ms.amount;
        } else {
          const beneficiaries = exp.splitWith.length > 0 ? exp.splitWith : trip.members.map((m) => m.id);
          if (beneficiaries.includes(d.id)) {
            shareForD = exp.amount / (beneficiaries.length || 1);
          }
        }

        if (shareForD > 0) {
          paidForDebtorByPayer[d.id][payerId] = (paidForDebtorByPayer[d.id][payerId] || 0) + shareForD;
        }
      });
    });

    const result: { from: string; to: string; amount: number }[] = [];

    // Map theo dõi số tiền credit còn lại của các thành viên có số dư dương
    const credMap = new Map<string, number>();
    creditors.forEach((c) => credMap.set(c.id, c.availableCredit));

    // 3. Giải quyết công nợ:
    // Ưu tiên nợ người đã trực tiếp trả thêm cho các hoạt động mà con nợ tham gia
    debtors.forEach((d) => {
      let remainingDebt = d.debtAmount;

      // Danh sách người đã chi trả cho d, xếp theo số tiền trả nhiều nhất trước
      const payersForD = Object.entries(paidForDebtorByPayer[d.id] || {})
        .sort(([, amtA], [, amtB]) => amtB - amtA);

      for (const [payerId, paidAmt] of payersForD) {
        if (remainingDebt <= 0.01) break;
        const credAvailable = credMap.get(payerId) || 0;
        if (credAvailable <= 0.01) continue;

        const settleAmt = Math.min(remainingDebt, paidAmt, credAvailable);
        if (settleAmt > 0.01) {
          result.push({
            from: d.id,
            to: payerId,
            amount: Math.round(settleAmt * 100) / 100,
          });
          remainingDebt -= settleAmt;
          credMap.set(payerId, credAvailable - settleAmt);
        }
      }

      // 4. Nếu vẫn còn nợ (ví dụ chi phí dùng chung hoặc người chi đã hết hạn mức credit),
      // giải quyết với các thành viên còn dư hạn mức dương khác (như người giữ quỹ hoặc thành viên khác)
      if (remainingDebt > 0.01) {
        for (const [credId, credAvailable] of credMap.entries()) {
          if (remainingDebt <= 0.01) break;
          if (credId === d.id || credAvailable <= 0.01) continue;

          const settleAmt = Math.min(remainingDebt, credAvailable);
          if (settleAmt > 0.01) {
            result.push({
              from: d.id,
              to: credId,
              amount: Math.round(settleAmt * 100) / 100,
            });
            remainingDebt -= settleAmt;
            credMap.set(credId, credAvailable - settleAmt);
          }
        }
      }
    });

    return result;
  }, [memberStats, unifiedExpenses, trip.members]);

  // 4. Splitwise-style greedy minimization of transactions
  const simplifiedSettlements = useMemo(() => {
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];

    memberStats.forEach((s) => {
      const bal = Math.round(s.remainingBalance * 100) / 100;
      if (bal < -0.01) {
        debtors.push({ id: s.member.id, amount: Math.abs(bal) });
      } else if (bal > 0.01) {
        creditors.push({ id: s.member.id, amount: bal });
      }
    });

    const result: { from: string; to: string; amount: number }[] = [];
    let i = 0;
    let j = 0;

    const dList = debtors.map((d) => ({ ...d }));
    const cList = creditors.map((c) => ({ ...c }));

    while (i < dList.length && j < cList.length) {
      dList.sort((a, b) => b.amount - a.amount);
      cList.sort((a, b) => b.amount - a.amount);

      const debtor = dList[i];
      const creditor = cList[j];
      const settleAmt = Math.min(debtor.amount, creditor.amount);

      if (settleAmt > 0.01) {
        result.push({
          from: debtor.id,
          to: creditor.id,
          amount: Math.round(settleAmt * 100) / 100,
        });
        debtor.amount = Math.round((debtor.amount - settleAmt) * 100) / 100;
        creditor.amount = Math.round((creditor.amount - settleAmt) * 100) / 100;
      }

      if (debtor.amount <= 0.01) i++;
      if (creditor.amount <= 0.01) j++;
    }

    return result;
  }, [memberStats]);

  // Active settlements based on user toggle
  const activeSettlements = isSimplifiedDebts ? simplifiedSettlements : settlements;

  // Export genuine Excel (.xlsx) workbook
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Sheet 1: Tổng quan & Quyết toán công nợ
    const overviewData: (string | number)[][] = [
      ['BÁO CÁO QUẢN LÝ TÀI CHÍNH & HÓA ĐƠN CHI TIÊU DU LỊCH'],
      ['Tên chuyến đi:', trip.title],
      ['Điểm đến:', `${trip.destination}, ${trip.country}`],
      ['Thời gian:', `${trip.startDate} đến ${trip.endDate}`],
      ['Tổng chi phí thực tế:', totalSpent],
      ['Tổng tiền đã đóng quỹ:', totalContributed],
      ['Số dư quỹ nhóm hiện tại:', fundRemaining],
      ['Đơn vị tiền tệ:', trip.currency || 'VND'],
      ['Người giữ quỹ nhóm:', fundHolder.name],
      ['Thời gian xuất hóa đơn:', new Date().toLocaleString('vi-VN')],
      [],
      [`BẢNG QUYẾT TOÁN CÔNG NỢ ${isSimplifiedDebts ? '(ĐÃ TỐI ƯU HÓA RÚT GỌN GIAO DỊCH)' : '(TIÊU CHUẨN)'}`],
      ['STT', 'Người chuyển', 'Người nhận', `Số tiền (${trip.currency || 'VND'})`, 'Nội dung chuyển khoản'],
    ];

    if (activeSettlements.length === 0) {
      overviewData.push([1, 'Tất cả thành viên', 'Không ai nợ ai', 0, 'Đã cân bằng toàn bộ tài chính']);
    } else {
      activeSettlements.forEach((s, idx) => {
        const fromName = getMemberName(s.from);
        const toName = getMemberName(s.to);
        overviewData.push([
          idx + 1,
          fromName,
          toName,
          s.amount,
          `Chuyển tiền quyết toán chuyến đi ${trip.title}`,
        ]);
      });
    }

    overviewData.push([]);
    overviewData.push(['BẢNG TỔNG KẾT TÀI CHÍNH TỪNG THÀNH VIÊN']);
    overviewData.push(['STT', 'Tên thành viên', 'Tiền đã đóng quỹ', 'Tiền tự chi riêng', 'Tổng tiền đã bỏ ra', 'Phần chi phí phải chịu', 'Số dư ròng (Chênh lệch)']);
    memberStats.forEach((s, idx) => {
      const totalOut = s.contributed + s.paidDirectly;
      overviewData.push([
        idx + 1,
        s.member.name,
        s.contributed,
        s.paidDirectly,
        totalOut,
        s.consumedTotal,
        s.remainingBalance,
      ]);
    });

    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    wsOverview['!cols'] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 38 },
      { wch: 22 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Tong_Quan_Quyet_Toan');

    // 2. Sheet 2: Chi tiết hóa đơn và từng khoản chi
    const expenseData: (string | number)[][] = [
      ['STT', 'Ngày', 'Danh mục', 'Tên khoản chi / Hoạt động', `Số tiền (${trip.currency || 'VND'})`, 'Người thanh toán', 'Thành viên cùng chia', 'Nguồn phát sinh', 'Ghi chú / Món ăn'],
    ];

    unifiedExpenses.forEach((exp, idx) => {
      const payerName = exp.paidBy === 'fund'
        ? `Quỹ chung (${fundHolder.name} giữ)`
        : (trip.members.find((m) => m.id === exp.paidBy)?.name || exp.paidBy);
      const splitNames = exp.splitWith.map((id) => trip.members.find((m) => m.id === id)?.name || id).join(', ');
      const source = exp.sourceType === 'completed_activity' ? 'Hoạt động lịch trình' : 'Chi tiêu thủ công/Hóa đơn';
      expenseData.push([
        idx + 1,
        exp.date || '',
        exp.category,
        exp.title,
        exp.amount,
        payerName,
        splitNames,
        source,
        exp.note || '',
      ]);
    });

    const wsExpenses = XLSX.utils.aoa_to_sheet(expenseData);
    wsExpenses['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 32 },
      { wch: 18 },
      { wch: 22 },
      { wch: 35 },
      { wch: 24 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Chi_Tiet_Hoa_Don');

    const safeTitle = trip.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '_').trim() || 'ChuyenDi';
    const fileName = `Hoa_Don_Chi_Tieu_${safeTitle}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
  };

  // Copy settlement summary for chat apps
  const handleCopySettlement = () => {
    const lines: string[] = [];
    lines.push(`📊 TỔNG KẾT CHI TIÊU & QUYẾT TOÁN - ${trip.title.toUpperCase()}`);
    lines.push(`📍 Điểm đến: ${trip.destination}, ${trip.country}`);
    lines.push(`💰 Tổng chi tiêu: ${formatMoney(totalSpent, trip.currency, lang)}`);
    lines.push(`👥 Thành viên: ${trip.members.length} người`);
    lines.push('');

    if (activeSettlements.length === 0) {
      lines.push('✅ Tất cả thành viên đều có số dư hợp lệ, không ai nợ ai!');
      if (fundRemaining > 0) {
        lines.push(`💵 Quỹ chung còn dư: ${formatMoney(fundRemaining, trip.currency, lang)}.`);
      }
    } else {
      lines.push(`📌 Phương án chuyển tiền ${isSimplifiedDebts ? '(Đã tối ưu hóa số lần chuyển)' : ''}:`);
      activeSettlements.forEach((s, idx) => {
        const fromName = getMemberName(s.from);
        const toName = getMemberName(s.to);
        lines.push(`${idx + 1}. ${fromName} 👉 chuyển cho ${toName}: ${formatMoney(s.amount, trip.currency, lang)}`);
      });
    }

    lines.push('');
    lines.push('🎉 Chúc cả nhóm có chuyến đi trọn vẹn và an toàn!');

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSettlement(true);
    setTimeout(() => setCopiedSettlement(false), 2500);
  };

  // =========================================================================
  // Handlers
  // =========================================================================
  const handleToggleMemberSplit = (memberId: string) => {
    const current = splitWith;
    const isSelected = current.includes(memberId);
    const next = isSelected ? current.filter((id) => id !== memberId) : [...current, memberId];
    const finalSplit = next.length > 0 ? next : [memberId];
    const num = parseFloat(amount) || 0;
    setSplitWith(finalSplit);
    setAddMemberSplits(calculateEvenSplits(num, finalSplit));
  };

  const handleSelectAllAddSplitWith = () => {
    const allIds = trip.members.map((m) => m.id);
    const isAll = splitWith.length === allIds.length;
    const fallbackPayer = paidBy && paidBy !== 'fund' ? paidBy : allIds[0];
    const nextSplitWith = isAll ? [fallbackPayer] : allIds;
    const num = parseFloat(amount) || 0;
    setSplitWith(nextSplitWith);
    setAddMemberSplits(calculateEvenSplits(num, nextSplitWith));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setAddFormError(isVi ? 'Vui lòng nhập tên khoản chi tiêu.' : 'Please enter an expense title.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAddFormError(isVi ? 'Vui lòng nhập số tiền hợp lệ lớn hơn 0.' : 'Please enter a valid amount greater than 0.');
      return;
    }

    const finalSplitWith = splitWith.length > 0 ? splitWith : trip.members.map((m) => m.id);
    if (finalSplitWith.length === 0) {
      setAddFormError(isVi ? 'Vui lòng chọn ít nhất 1 thành viên chịu chi phí.' : 'Please select at least 1 participant.');
      return;
    }

    const formattedMemberSplits: { memberId: string; amount: number }[] = finalSplitWith.map((mId) => ({
      memberId: mId,
      amount: parseFloat(addMemberSplits[mId] || '0') || 0,
    }));

    onAddExpense({
      title: cleanTitle,
      amount: parsedAmount,
      currency: trip.currency || 'VND',
      category,
      paidBy,
      splitWith: finalSplitWith,
      memberSplits: formattedMemberSplits,
      date: new Date().toISOString().split('T')[0],
      receiptImageUrl: attachedReceiptUrl || undefined,
    });

    const resetIds = trip.members.map((m) => m.id);
    setTitle('');
    setAmount('');
    setAttachedReceiptUrl(null);
    setSplitWith(resetIds);
    setAddMemberSplits(calculateEvenSplits(0, resetIds));
    setAddSplitWithSearch('');
    setAddParticipantsFilter('all');
    setIsAddParticipantsExpanded(true);
    setAddFormError(null);
    setShowExpenseForm(false);
  };

  const handleSaveAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const contributed = parseFloat(newMemberContributed) || 0;
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newMemberName.trim())}`;

    if (onAddMember) {
      onAddMember({
        name: newMemberName.trim(),
        avatar: defaultAvatar,
        contributedAmount: contributed,
      });
    }

    setNewMemberName('');
    setNewMemberContributed('0');
    setShowAddMemberModal(false);
  };

  const handleSaveInlineContribution = (memberId: string) => {
    const num = parseFloat(editingContribValue) || 0;
    if (onUpdateMember) {
      onUpdateMember(memberId, { contributedAmount: num });
    }
    setEditingContribMemberId(null);
  };

  const handleConfirmDeleteMember = () => {
    if (memberToDelete && onDeleteMember) {
      onDeleteMember(memberToDelete.id);
      setMemberToDelete(null);
    }
  };

  const getMemberName = (id: string) => {
    if (id === 'fund') return isVi ? 'Quỹ' : 'Group Fund';
    return trip.members.find((m) => m.id === id)?.name || (isVi ? 'Thành viên' : 'Member');
  };

  const formatDisplayDate = (dStr?: string) => {
    if (!dStr) return '';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dStr)) return dStr;
    const match = dStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return dStr;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Quick Actions (Quét hóa đơn AI & Xuất Excel / CSV) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsReceiptScannerOpen(true)}
            className="px-3.5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs hover:shadow-sm cursor-pointer"
            title={isVi ? 'Quét hóa đơn tự động bằng AI Gemini Vision' : 'Scan receipt using AI Vision'}
          >
            <Sparkles className="w-4 h-4 text-violet-200" />
            <span>{isVi ? 'Quét hóa đơn AI' : 'Scan Receipt AI'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-white hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            title={isVi ? 'Xuất toàn bộ hóa đơn và quyết toán chi tiêu dạng file Excel (.xlsx)' : 'Export expense invoices to Excel (.xlsx)'}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isVi ? 'Xuất hóa đơn Excel' : 'Export Excel (.xlsx)'}</span>
          </button>
        </div>

        {/* Right: Thêm chi tiêu button */}
        <button
          type="button"
          onClick={() => {
            const resetIds = trip.members.map((m) => m.id);
            setTitle('');
            setAmount('');
            setAttachedReceiptUrl(null);
            setPaidBy('fund');
            setSplitWith(resetIds);
            setAddMemberSplits(calculateEvenSplits(0, resetIds));
            setAddSplitWithSearch('');
            setAddParticipantsFilter('all');
            setIsAddParticipantsExpanded(true);
            setAddFormError(null);
            setShowExpenseForm(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isVi ? 'Thêm chi tiêu' : 'Add Expense'}</span>
        </button>
      </div>

      {/* Budget Warning Banner if expenses exceed allocated budget */}
      {trip.budgetTotal > 0 && totalSpent > trip.budgetTotal && (
        <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isVi
                ? `Cảnh báo ngân sách: Tổng chi tiêu (${formatMoney(totalSpent, trip.currency, lang)}) đã vượt ngân sách dự kiến (${formatMoney(trip.budgetTotal, trip.currency, lang)}), vượt ${formatMoney(totalSpent - trip.budgetTotal, trip.currency, lang)}.`
                : `Budget Alert: Total expenses exceed planned budget by ${formatMoney(totalSpent - trip.budgetTotal, trip.currency, lang)}.`}
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded-md shrink-0">
            {Math.round((totalSpent / trip.budgetTotal) * 100)}% {isVi ? 'ngân sách' : 'budget'}
          </span>
        </div>
      )}

      {/* 1. Top Overview Stats Bar - Responsive 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
        
        {/* Card 1: Tổng tiền đã góp */}
        <div className="bg-white p-3 sm:p-4.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden group hover:border-teal-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              {isVi ? 'Tổng tiền đã góp' : 'Total Contributed'}
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
              <PiggyBank className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2.5">
            <span className="text-base sm:text-xl lg:text-2xl font-extrabold text-slate-900 block truncate leading-tight">
              {formatMoney(totalContributed, trip.currency, lang)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-teal-700 font-semibold mt-0.5 block truncate">
              {trip.members.length} {isVi ? 'người đóng quỹ' : 'contributors'}
            </span>
          </div>
        </div>

        {/* Card 2: Tổng tiền đã chi (Hoàn thành hoạt động + Chi tiêu được thêm mới) */}
        <div 
          className="bg-white p-3 sm:p-4.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden group hover:border-amber-300 transition-all flex flex-col justify-between"
          title={isVi ? 'Tổng tiền đã chi của tất cả chi tiêu và các hoạt động hoàn tất' : 'Total spent of all expenses and completed activities'}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              {isVi ? 'Tổng tiền đã chi' : 'Total Spent'}
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2.5">
            <span className="text-base sm:text-xl lg:text-2xl font-extrabold text-slate-900 block truncate leading-tight">
              {formatMoney(totalSpent, trip.currency, lang)}
            </span>
            <span 
              className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 block truncate"
              title={isVi ? `Gồm ${manualExpensesCount} chi tiêu và ${completedActivitiesCount} hoạt động hoàn tất` : undefined}
            >
              {isVi
                ? (completedActivitiesCount > 0 && manualExpensesCount > 0
                    ? `${unifiedExpenses.length} khoản (${manualExpensesCount} chi tiêu, ${completedActivitiesCount} hoạt động)`
                    : `${unifiedExpenses.length} khoản (tất cả chi tiêu & hoạt động)`)
                : `${unifiedExpenses.length} ${unifiedExpenses.length === 1 ? 'record' : 'records'}`}
            </span>
          </div>
        </div>

        {/* Card 3: Số dư quỹ nhóm */}
        <div className={`p-3 sm:p-4.5 rounded-xl sm:rounded-2xl border shadow-2xs relative overflow-hidden transition-all flex flex-col justify-between ${
          fundRemaining >= 0 
            ? 'bg-emerald-50/50 border-emerald-200/80' 
            : 'bg-rose-50/50 border-rose-200/80'
        }`}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider truncate">
              {isVi ? 'Số dư quỹ nhóm' : 'Fund Balance'}
            </span>
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
              fundRemaining >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2.5">
            <span className={`text-base sm:text-xl lg:text-2xl font-extrabold block truncate leading-tight ${
              fundRemaining >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {formatMoney(fundRemaining, trip.currency, lang)}
            </span>
            <div className="mt-0.5 flex items-center gap-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full truncate ${
                fundRemaining >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {fundRemaining >= 0 
                  ? (isVi ? '✓ Quỹ còn tiền' : 'Available') 
                  : (isVi ? '⚠ Quỹ thâm hụt' : 'Deficit')}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Thành viên giữ tiền đã góp của nhóm */}
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden group hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              {isVi ? 'Người giữ quỹ' : 'Treasurer'}
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          {/* 2 hàng: Hàng 1 tên người giữ quỹ, Hàng 2 combobox chọn người giữ quỹ */}
          <div className="mt-2 space-y-2">
            {/* Hàng 1: Tên và avatar người giữ quỹ */}
            <div className="flex items-center gap-2 min-w-0">
              {fundHolder ? (
                <>
                  <img
                    src={fundHolder.avatar}
                    alt={fundHolder.name}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-blue-200 shrink-0 shadow-2xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={fundHolder.name}>
                      {fundHolder.name}
                    </p>
                    <p className="text-[10px] text-blue-600 font-medium truncate">
                      {isVi ? 'Thủ quỹ nhóm' : 'Group treasurer'}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic truncate">{isVi ? 'Chưa chọn người giữ quỹ' : 'No treasurer selected'}</p>
              )}
            </div>

            {/* Hàng 2: Combobox chọn người giữ quỹ nằm ở dưới */}
            {onSetFundHolder && trip.members.length > 0 && (
              <div className="pt-0.5">
                <select
                  value={fundHolderId}
                  onChange={(e) => onSetFundHolder(e.target.value)}
                  className="w-full text-xs font-semibold text-blue-800 bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors truncate"
                  title={isVi ? 'Chọn người giữ quỹ' : 'Change treasurer'}
                >
                  {trip.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 2. Member Fund & Contribution Management Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <span>{isVi ? 'Thành viên & Quỹ đóng góp' : 'Members & Contribution Funds'}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onAddMember && (
              <button
                type="button"
                onClick={() => setShowAddMemberModal(true)}
                className="py-1.5 px-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isVi ? 'Thêm thành viên' : 'Add Member'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Member cards grid or empty state */}
        {memberStats.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-300 space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">
                {isVi ? 'Chưa có người tham gia' : 'No participants yet'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                {isVi
                  ? 'Nhấn "Thêm thành viên" để thêm người vào chuyến đi và phân chia chi phí.'
                  : 'Click "Add Member" to add participants and split expenses.'}
              </p>
            </div>
            {onAddMember && (
              <button
                type="button"
                onClick={() => setShowAddMemberModal(true)}
                className="mt-2 py-1.5 px-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isVi ? 'Thêm thành viên' : 'Add Member'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {memberStats.map(({ member, contributed, paidExtra, used, remainingBalance }) => {
              const isTreasurer = member.id === fundHolderId;
              const isEditing = editingContribMemberId === member.id;

              return (
                <div 
                  key={member.id} 
                  className={`p-4 rounded-xl border transition-all ${
                    isTreasurer 
                      ? 'bg-blue-50/40 border-blue-200/80 ring-1 ring-blue-200' 
                      : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80'
                  }`}
                >
                {/* Member Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img 
                      src={member.avatar} 
                      alt={member.name} 
                      className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-2xs shrink-0" 
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">{member.name}</span>
                        {isTreasurer && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{isVi ? 'Giữ quỹ' : 'Treasurer'}</span>
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <p className="text-[11px] text-slate-400 truncate">{member.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions for member */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Set as Treasurer button */}
                    {!isTreasurer && onSetFundHolder && (
                      <button
                        type="button"
                        onClick={() => onSetFundHolder(member.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title={isVi ? 'Đặt làm người giữ quỹ' : 'Set as treasurer'}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Member button */}
                    {onDeleteMember && trip.members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMemberToDelete(member)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title={isVi ? 'Xóa thành viên' : 'Delete member'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Member Breakdown: Tiền đã góp, Đã trả thêm, Tiền đã dùng, Số dư còn lại */}
                <div className="mt-3 space-y-2 text-xs">
                  {/* Tiền đã góp */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <PiggyBank className="w-3.5 h-3.5 text-teal-600" />
                      <span>{isVi ? 'Tiền đã góp:' : 'Contributed:'}</span>
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editingContribValue}
                          onChange={(e) => setEditingContribValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineContribution(member.id);
                            if (e.key === 'Escape') setEditingContribMemberId(null);
                          }}
                          className="w-24 text-right text-xs font-bold px-2 py-0.5 bg-white border border-teal-400 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlineContribution(member.id)}
                          className="p-1 text-teal-700 hover:bg-teal-100 rounded cursor-pointer"
                          title={isVi ? 'Lưu' : 'Save'}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingContribMemberId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-200 rounded cursor-pointer"
                          title={isVi ? 'Hủy' : 'Cancel'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">
                          {formatMoney(contributed, trip.currency, lang)}
                        </span>
                        {onUpdateMember && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContribMemberId(member.id);
                              setEditingContribValue(String(contributed));
                            }}
                            className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                            title={isVi ? 'Sửa số tiền đã góp' : 'Edit contribution'}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Đã trả thêm: giá trị chi phí người đã chi tiền khi hoàn thành hoạt động / chi tiêu */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1" title={isVi ? 'Giá trị chi phí người này đã trực tiếp chi tiền' : 'Amount paid for group expenses'}>
                      <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                      <span>{isVi ? 'Đã trả thêm:' : 'Paid extra:'}</span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatMoney(paidExtra, trip.currency, lang)}
                    </span>
                  </div>

                  {/* Tiền đã dùng: chi phí được chia ra trong thành viên tham gia khi hoàn thành hoạt động / chi tiêu */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1" title={isVi ? 'Chi phí được chia ra cho thành viên này tham gia' : 'Share consumed by this member'}>
                      <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isVi ? 'Tiền đã dùng:' : 'Used / Consumed:'}</span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatMoney(used, trip.currency, lang)}
                    </span>
                  </div>

                  {/* Số dư còn lại: Công thức A góp + A đã trả thêm - A đã dùng (ĐÃ BỎ CHỮ Góp + Trả thêm - Dùng) */}
                  <div className={`mt-2 pt-2.5 border-t border-slate-200 flex items-center justify-between ${
                    remainingBalance > 0 
                      ? 'text-emerald-700' 
                      : remainingBalance < 0 
                      ? 'text-rose-600' 
                      : 'text-slate-600'
                  }`}>
                    <div>
                      <span className="font-bold text-xs block">
                        {isVi ? 'Số dư còn lại:' : 'Remaining Balance:'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs sm:text-sm font-extrabold ${
                        remainingBalance > 0 
                          ? 'text-emerald-700' 
                          : remainingBalance < 0 
                          ? 'text-rose-600' 
                          : 'text-slate-700'
                      }`}>
                        {remainingBalance > 0 ? '+' : ''}{formatMoney(remainingBalance, trip.currency, lang)}
                      </span>
                      <span className={`text-[10px] font-bold block ${
                        remainingBalance > 0 
                          ? 'text-emerald-600' 
                          : remainingBalance < 0 
                          ? 'text-rose-500' 
                          : 'text-slate-400'
                      }`}>
                        {remainingBalance > 0 
                          ? (isVi ? '(Được nhận lại)' : '(To receive)') 
                          : remainingBalance < 0 
                          ? (isVi ? '(Cần đóng thêm)' : '(To pay in)') 
                          : (isVi ? '(Đã cân bằng)' : '(Settled)')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* 3. Settlement Summary & Expenses History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settlements Calculation ("Ai nợ ai" / "Quyết toán") */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-display font-semibold text-slate-900 text-base">{t('expenses.settlementSummary')}</h3>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                {isVi ? 'Phương án chuyển tiền thanh toán nợ' : 'Settlement and debt payment'}
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleCopySettlement}
              className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                copiedSettlement
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200'
              }`}
              title={isVi ? 'Sao chép bảng quyết toán để gửi vào nhóm chat Zalo' : 'Copy settlement to clipboard'}
            >
              {copiedSettlement ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-semibold">{isVi ? 'Đã sao chép!' : 'Copied!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">{isVi ? 'Sao chép' : 'Copy'}</span>
                </>
              )}
            </button>
          </div>

          {/* Toggle Tối ưu hóa nợ (Splitwise-style) */}
          <div className="mt-3.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
              <div>
                <span className="text-xs font-semibold text-slate-800 block leading-tight">
                  {isVi ? 'Tối ưu hóa số lần chuyển' : 'Simplify Debts (Splitwise)'}
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {isVi ? 'Thu gọn giao dịch ít lần chuyển nhất' : 'Minimize number of bank transfers'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSimplifiedDebts(!isSimplifiedDebts)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isSimplifiedDebts ? 'bg-teal-600' : 'bg-slate-300'
              }`}
              title={isVi ? 'Bật/Tắt chế độ tối ưu hóa nợ nhóm' : 'Toggle simplified debts'}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isSimplifiedDebts ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {activeSettlements.length === 0 ? (
              <div className="p-4 text-center bg-emerald-50/60 rounded-xl border border-emerald-100">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-emerald-900">{t('expenses.allSettled')}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {trip.members.length === 0
                    ? (isVi ? 'Chưa có người tham gia để tính quyết toán.' : 'No participants to settle.')
                    : fundRemaining >= 0 
                    ? (isVi ? 'Tất cả thành viên đều có số dư hợp lệ, không ai nợ ai.' : 'All members have positive balance, no pending debts.')
                    : (isVi ? 'Không có công nợ cần quyết toán giữa các cá nhân.' : t('expenses.noPendingDebts'))}
                </p>
                {fundRemaining > 0 && (
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">
                    {isVi ? `Quỹ chung còn dư ${formatMoney(fundRemaining, trip.currency, lang)} cho cả nhóm` : `Group fund surplus: ${formatMoney(fundRemaining, trip.currency, lang)}`}
                  </p>
                )}
              </div>
            ) : (
              activeSettlements.map((s, idx) => (
                <div key={idx} className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between transition-colors">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      <span className="text-slate-900 font-semibold">{getMemberName(s.from)}</span>{' '}
                      <span className="text-rose-600 text-[11px] font-normal">{t('expenses.owes')}</span>{' '}
                      <span className="text-teal-700 font-semibold">{getMemberName(s.to)}</span>
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 shrink-0">
                    {formatMoney(s.amount, trip.currency, lang)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expenses Log & Add Expense Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-slate-900 text-base">{t('expenses.historyTitle')}</h3>
              <span className="text-xs text-slate-500">
                {isVi 
                  ? `Ghi nhận ${unifiedExpenses.length} khoản (${manualExpensesCount} chi tiêu, ${completedActivitiesCount} hoạt động hoàn tất)`
                  : `Tracking ${unifiedExpenses.length} records (${manualExpensesCount} expenses, ${completedActivitiesCount} completed)`}
              </span>
            </div>



            {/* Expenses List: Hiển thị toàn bộ các khoản chi tiêu một cách đồng bộ */}
            <div className="mt-4 space-y-2.5">
              {unifiedExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">
                  {isVi ? 'Chưa có khoản chi tiêu nào.' : 'No expenses recorded.'}
                </p>
              ) : (
                unifiedExpenses.map((item) => {
                  const linkedDay = item.dayNumber ? trip.days.find((d) => d.dayNumber === item.dayNumber) : null;
                  const rawDate = linkedDay?.date || item.date;
                  const dateStr = formatDisplayDate(rawDate);
                  const dateLabel = item.dayNumber 
                    ? `${isVi ? `Ngày ${item.dayNumber}` : `Day ${item.dayNumber}`}${dateStr ? ` (${dateStr})` : ''}`
                    : (dateStr || (isVi ? 'Chi tiêu thêm' : 'Manual'));

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => handleOpenExpenseDetails(item)}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-teal-300 hover:shadow-xs transition-all flex items-center justify-between gap-2.5 cursor-pointer group"
                      title={isVi ? 'Bấm để xem chi tiết chi tiêu' : 'Click to view expense details'}
                    >
                      <div className="flex items-start gap-3 min-w-0 pr-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          item.activityId 
                            ? 'bg-emerald-100/90 text-emerald-700 group-hover:bg-emerald-200/90' 
                            : 'bg-slate-200/80 text-slate-700 group-hover:bg-teal-100 group-hover:text-teal-700'
                        }`}>
                          {item.activityId ? <RefreshCw className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-teal-700 transition-colors truncate">
                              {item.title}
                            </h4>
                            {item.activityId && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md shrink-0">
                                {isVi ? 'Hoạt động' : 'Activity'}
                              </span>
                            )}
                            {item.receiptImageUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingReceiptImage(item.receiptImageUrl!);
                                }}
                                className="text-[10px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200/80 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                                title={isVi ? 'Xem ảnh hóa đơn' : 'View receipt image'}
                              >
                                <Camera className="w-3 h-3 text-violet-600" />
                                <span>{isVi ? 'Hóa đơn' : 'Receipt'}</span>
                              </button>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 mt-1 truncate flex items-center gap-1.5 flex-wrap">
                            {item.paidBy === 'fund' ? (
                              <span className="font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0">
                                <PiggyBank className="w-3 h-3 text-amber-700" />
                                <span>{isVi ? 'Quỹ' : 'Group Fund'}</span>
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-700 truncate">{getMemberName(item.paidBy)}</span>
                            )}
                            <span className="shrink-0 text-slate-500">
                              ({item.splitWith.length} {isVi ? 'người tham gia' : 'participants'})
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                        <div className="flex flex-col items-end text-right">
                          {/* Phần ngày */}
                          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{dateLabel}</span>
                          </span>

                          {/* Số tiền nằm dưới phần ngày */}
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors mt-1">
                            {formatMoney(item.amount, item.currency || trip.currency, lang)}
                          </span>
                        </div>

                        {/* Nút Xem chi tiết & Chỉnh sửa */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExpenseDetails(item);
                          }}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title={isVi ? 'Chi tiết chi tiêu' : 'Expense details'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Nút Xóa */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpenseToDelete(item);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={isVi ? 'Xóa chi tiêu' : 'Delete expense'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modal: Thêm chi tiêu (Popup) */}
      {showExpenseForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] my-auto overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-white">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>🧾</span>
                <span>{isVi ? 'Thêm Chi Tiêu' : 'Add Expense'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
                {/* Form Error Alert */}
                {addFormError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addFormError}</span>
                  </div>
                )}

                {/* AI Receipt Scanning Trigger Banner */}
                <div className="p-3 bg-violet-50/70 border border-violet-200/80 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-violet-900 leading-tight">
                        {isVi ? 'Bạn có hóa đơn hoặc biên lai giấy?' : 'Have a paper receipt or bill photo?'}
                      </p>
                      <p className="text-[10px] text-violet-700 font-normal mt-0.5">
                        {isVi ? 'Quét để AI tự động điền tên quán, số tiền & ngày' : 'Let AI auto-fill merchant, total & date'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExpenseForm(false);
                      setIsReceiptScannerOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{isVi ? 'Quét ngay' : 'Scan'}</span>
                  </button>
                </div>

                {/* Attached Receipt Image Thumbnail Preview if present */}
                {attachedReceiptUrl && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={attachedReceiptUrl}
                        alt="Attached Receipt"
                        onClick={() => setViewingReceiptImage(attachedReceiptUrl)}
                        className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                        title={isVi ? 'Bấm để xem ảnh phóng to' : 'Click to view full image'}
                      />
                      <div>
                        <span className="text-xs font-medium text-slate-800 block">
                          {isVi ? 'Ảnh biên lai đã đính kèm' : 'Attached receipt image'}
                        </span>
                        <span className="text-[10px] text-teal-700 font-medium">
                          {isVi ? '✓ Đã nhận diện bởi AI' : '✓ Extracted with AI'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedReceiptUrl(null)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title={isVi ? 'Gỡ ảnh' : 'Remove image'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isVi ? 'Tên chi tiêu *' : 'Description *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isVi ? 'Ví dụ: Ăn trưa lẩu gà' : 'e.g. Lunch'}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('expenses.fieldAmount', { currency: trip.currency })}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="100000"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        const num = parseFloat(e.target.value) || 0;
                        setAddMemberSplits(calculateEvenSplits(num, splitWith));
                      }}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('itinerary.fieldCategory')}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CategoryType)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden cursor-pointer"
                    >
                      <option value="food">{t('cat.food')}</option>
                      <option value="stay">{t('cat.stay')}</option>
                      <option value="transport">{t('cat.transport')}</option>
                      <option value="sightseeing">{t('cat.sightseeing')}</option>
                      <option value="shopping">{t('cat.shopping')}</option>
                      <option value="activity">{isVi ? 'Hoạt động trải nghiệm' : 'Activity'}</option>
                      <option value="other">{t('cat.other')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('expenses.fieldPaidBy')}
                  </label>
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden font-medium cursor-pointer"
                  >
                    <option value="fund">💰 {isVi ? 'Quỹ' : 'Group Fund'}</option>
                    {trip.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.id === fundHolderId ? (isVi ? '(Thủ quỹ nhóm)' : '(Treasurer)') : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Người tham gia */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      onClick={() => setIsAddParticipantsExpanded(!isAddParticipantsExpanded)}
                      className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      <span>{isVi ? 'Người tham gia' : 'Participants'}</span>
                      <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded-full">
                        {splitWith.length}/{trip.members.length} {isVi ? 'người' : 'members'}
                      </span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      {isAddParticipantsExpanded && (
                        <button
                          type="button"
                          onClick={handleSelectAllAddSplitWith}
                          className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold px-2 py-0.5 rounded-md hover:bg-teal-100/60 cursor-pointer transition-colors"
                        >
                          {splitWith.length === trip.members.length
                            ? (isVi ? 'Bỏ chọn' : 'Deselect all')
                            : (isVi ? 'Chọn tất cả' : 'Select all')}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsAddParticipantsExpanded(!isAddParticipantsExpanded)}
                        className="p-1 rounded-lg text-teal-800 hover:bg-teal-100/80 cursor-pointer transition-colors border border-teal-300/80 bg-white shadow-2xs flex items-center justify-center"
                        title={isAddParticipantsExpanded ? (isVi ? 'Thu gọn' : 'Collapse') : (isVi ? 'Mở rộng' : 'Expand')}
                        aria-label={isAddParticipantsExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isAddParticipantsExpanded ? (
                          <ChevronUp className="w-4 h-4 text-teal-700" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-teal-700" />
                        )}
                      </button>
                    </div>
                  </div>

                  {!isAddParticipantsExpanded ? (
                    <div
                      onClick={() => setIsAddParticipantsExpanded(true)}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors shadow-2xs group"
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
                            ? (isVi ? 'Tất cả thành viên đang tham gia' : 'All members participating')
                            : `${splitWith.length} ${isVi ? 'thành viên tham gia' : 'members participating'}`}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-teal-700 shrink-0 ml-2 group-hover:translate-y-0.5 transition-transform" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trip.members.length > 3 && (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder={isVi ? 'Tìm người tham gia...' : 'Search participants...'}
                              value={addSplitWithSearch}
                              onChange={(e) => setAddSplitWithSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0 text-[10px] font-semibold">
                            <button
                              type="button"
                              onClick={() => setAddParticipantsFilter('all')}
                              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                addParticipantsFilter === 'all'
                                  ? 'bg-teal-600 text-white font-bold'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {isVi ? 'Tất cả' : 'All'} ({trip.members.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddParticipantsFilter('selected')}
                              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                                addParticipantsFilter === 'selected'
                                  ? 'bg-teal-600 text-white font-bold'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {isVi ? 'Đã chọn' : 'Selected'} ({splitWith.length})
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50/60 rounded-xl border border-slate-200 overscroll-contain">
                        {trip.members
                          .filter((m) => {
                            const matchSearch = m.name.toLowerCase().includes(addSplitWithSearch.toLowerCase());
                            if (!matchSearch) return false;
                            if (addParticipantsFilter === 'selected') {
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
                                onClick={() => handleToggleMemberSplit(member.id)}
                                className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-teal-50 text-teal-950 font-semibold border border-teal-300'
                                    : 'hover:bg-slate-100 bg-white text-slate-700 border border-slate-200/60'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                      isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <img
                                    src={member.avatar}
                                    alt={member.name}
                                    className="w-5 h-5 rounded-full object-cover border border-slate-200"
                                  />
                                  <span className="text-xs truncate">{member.name}</span>
                                </div>

                                {isSelected && (
                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={addMemberSplits[member.id] ?? ''}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const val = e.target.value;
                                        setAddMemberSplits((prev) => ({
                                          ...prev,
                                          [member.id]: val,
                                        }));
                                      }}
                                      placeholder="0"
                                      className="w-24 text-right text-xs font-bold px-2 py-1 bg-white border border-teal-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-teal-500 text-slate-800"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        {trip.members.filter((m) => m.name.toLowerCase().includes(addSplitWithSearch.toLowerCase())).length === 0 && (
                          <p className="text-xs text-center text-slate-400 py-2">
                            {isVi ? 'Không tìm thấy người này' : 'No participant found'}
                          </p>
                        )}
                      </div>

                      {/* Thanh đối chiếu */}
                      {(() => {
                        const memberSplitsTotal = splitWith.reduce((acc, mId) => {
                          const val = parseFloat(addMemberSplits[mId] || '0');
                          return acc + (isNaN(val) ? 0 : val);
                        }, 0);
                        const totalCostNum = parseFloat(amount) || 0;
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
                                    setAmount(String(memberSplitsTotal));
                                  }}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs text-center"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{isVi ? 'Cập nhật' : 'Update'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddMemberSplits(calculateEvenSplits(totalCostNum, splitWith));
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

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 shrink-0 bg-slate-50/80">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  {isVi ? 'Lưu' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Thêm thành viên mới */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-600" />
                <span>{isVi ? 'Thêm thành viên vào chuyến đi' : 'Add Trip Member'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Tên thành viên' : 'Member Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={isVi ? 'Ví dụ: Hoàng Long' : 'e.g. John Doe'}
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? `Số tiền đã góp vào quỹ (${trip.currency || 'VND'})` : `Initial Contribution (${trip.currency || 'VND'})`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="2000000"
                  value={newMemberContributed}
                  onChange={(e) => setNewMemberContributed(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-bold text-slate-800"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {isVi ? 'Số tiền người này đã chuyển/góp vào quỹ chung của nhóm.' : 'Amount this member already contributed to the group pool.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  {isVi ? 'Thêm thành viên' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Xác nhận xóa thành viên */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base">
                  {isVi ? 'Xóa thành viên?' : 'Delete Member?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isVi 
                    ? `Bạn có chắc muốn xóa "${memberToDelete.name}" khỏi chuyến đi?` 
                    : `Are you sure you want to remove "${memberToDelete.name}" from this trip?`}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
              {isVi 
                ? 'Các khoản chi tiêu liên quan sẽ được tự động cập nhật lại cho các thành viên còn lại.' 
                : 'Related expenses will be automatically redistributed among remaining members.'}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMember}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                {isVi ? 'Xác nhận' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Chi tiết chi tiêu */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-400" />
                <h3 className="font-display font-bold text-sm sm:text-base">
                  {isVi ? 'Chi tiết chi tiêu' : 'Expense Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveExpenseDetails} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              
              {/* Day / Source info badge */}
              {selectedExpense.activityId ? (() => {
                const linkedDay = trip.days.find((d) => 
                  (selectedExpense.dayNumber && d.dayNumber === selectedExpense.dayNumber) || 
                  d.activities.some((a) => a.id === selectedExpense.activityId)
                );
                const dayNum = selectedExpense.dayNumber || linkedDay?.dayNumber;
                const rawDate = linkedDay?.date || selectedExpense.date;
                const dateStr = formatDisplayDate(rawDate);

                return (
                  <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-950 font-bold">
                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {dayNum ? (isVi ? `Ngày ${dayNum}` : `Day ${dayNum}`) : ''}
                      {dateStr ? ` (${dateStr})` : ''}
                    </span>
                  </div>
                );
              })() : (
                <div className="p-2.5 sm:p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-2 text-xs text-slate-700 font-bold">
                  <Tag className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{isVi ? 'Khoản chi tiêu thêm' : 'Manual Expense'}</span>
                  {selectedExpense.date && (
                    <span className="font-normal text-slate-500">({formatDisplayDate(selectedExpense.date)})</span>
                  )}
                </div>
              )}

              {/* Title & Amount Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Tên chi tiêu / Hoạt động' : 'Expense / Activity Title'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden font-medium"
                    placeholder={isVi ? 'Tên chi tiêu' : 'Title'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? `Tổng tiền đã chi (${trip.currency || 'VND'})` : `Total Spent (${trip.currency || 'VND'})`} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editAmount}
                    onChange={(e) => {
                      setEditAmount(e.target.value);
                      const num = parseFloat(e.target.value) || 0;
                      setEditMemberSplits(calculateEvenSplits(num, editSplitWith));
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden font-bold text-slate-900"
                    placeholder="100000"
                  />
                </div>
              </div>

              {/* Category & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('itinerary.fieldCategory')}
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CategoryType)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden"
                  >
                    <option value="food">{t('cat.food')}</option>
                    <option value="stay">{t('cat.stay')}</option>
                    <option value="transport">{t('cat.transport')}</option>
                    <option value="sightseeing">{t('cat.sightseeing')}</option>
                    <option value="shopping">{t('cat.shopping')}</option>
                    <option value="activity">{isVi ? 'Hoạt động trải nghiệm' : 'Activity'}</option>
                    <option value="other">{t('cat.other')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Ngày chi tiêu' : 'Expense Date'}
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Paid By - Searchable Droplist with Checkbox & Quỹ */}
              <div ref={editPaidByRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? 'Người chi tiền' : 'Payer'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditPaidByDropdownOpen(!isEditPaidByDropdownOpen)}
                  className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-left text-xs transition-colors cursor-pointer shadow-2xs font-medium"
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
                        placeholder={isVi ? 'Tìm người chi...' : 'Search payer...'}
                        value={editPaidBySearch}
                        onChange={(e) => setEditPaidBySearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
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
                              setEditPaidBySearch('');
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                              editPaidBy === member.id ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
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
                            {editPaidBy === member.id && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Người tham gia - Khung người tham gia có icon ẩn / hiện mũi nhọn lên / xuống & sắp xếp tích lên đầu & thanh đối chiếu */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label 
                    onClick={() => setIsEditParticipantsExpanded(!isEditParticipantsExpanded)}
                    className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Users className="w-3.5 h-3.5 text-teal-600" />
                    <span>{isVi ? 'Người tham gia' : 'Participants'}</span>
                    <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded-full">
                      {editSplitWith.length}/{trip.members.length} {isVi ? 'người' : 'members'}
                    </span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    {/* Nút Chọn tất cả / Bỏ chọn */}
                    {isEditParticipantsExpanded && (
                      <button
                        type="button"
                        onClick={handleSelectAllEditSplitWith}
                        className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold px-2 py-0.5 rounded-md hover:bg-teal-100/60 cursor-pointer transition-colors"
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
                      className="p-1 rounded-lg text-teal-800 hover:bg-teal-100/80 cursor-pointer transition-colors border border-teal-300/80 bg-white shadow-2xs flex items-center justify-center"
                      title={isEditParticipantsExpanded ? (isVi ? 'Thu gọn' : 'Collapse') : (isVi ? 'Mở rộng' : 'Expand')}
                      aria-label={isEditParticipantsExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isEditParticipantsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-teal-700" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-teal-700" />
                      )}
                    </button>
                  </div>
                </div>

                {!isEditParticipantsExpanded ? (
                  /* Khi Thu gọn: Hiển thị avatar stack các thành viên tham gia */
                  <div
                    onClick={() => setIsEditParticipantsExpanded(true)}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors shadow-2xs group"
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
                              className="w-5 h-5 rounded-full object-cover border-2 border-white ring-1 ring-teal-300"
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
                    <ChevronDown className="w-4 h-4 text-teal-700 shrink-0 ml-2 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                ) : (
                  /* Khi Mở rộng */
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
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0 text-[10px] font-semibold">
                          <button
                            type="button"
                            onClick={() => setEditParticipantsFilter('all')}
                            className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                              editParticipantsFilter === 'all'
                                ? 'bg-teal-600 text-white font-bold'
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
                                ? 'bg-teal-600 text-white font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {isVi ? 'Đã chọn' : 'Selected'} ({editSplitWith.length})
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Danh sách thành viên - Sắp xếp người có tích tham gia lên đầu & cho phép nhập số tiền */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200 overscroll-contain">
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
                          return bSelected - aSelected;
                        })
                        .map((member) => {
                          const isSelected = editSplitWith.includes(member.id);
                          return (
                            <div
                              key={member.id}
                              onClick={() => handleToggleEditSplitWith(member.id)}
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
                                    className="w-24 text-right text-xs font-bold px-2 py-1 bg-white border border-teal-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-teal-500 text-slate-800"
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
                      const totalCostNum = parseFloat(editAmount) || 0;
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
                                  setEditAmount(String(memberSplitsTotal));
                                }}
                                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs text-center"
                              >
                                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{isVi ? 'Cập nhật' : 'Update'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditMemberSplits(calculateEvenSplits(totalCostNum, editSplitWith));
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

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Ghi chú' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder={isVi ? 'Ghi chú thêm về khoản chi tiêu này...' : 'Additional notes...'}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 bg-white focus:outline-hidden resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseToDelete(selectedExpense);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Xóa' : 'Delete'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExpense(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    {isVi ? 'Đóng' : 'Close'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    {isVi ? 'Lưu' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Xác nhận xóa chi tiêu */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base">
                  {isVi ? 'Xóa chi tiêu?' : 'Delete Expense?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isVi 
                    ? `Bạn có chắc muốn xóa khoản chi tiêu "${expenseToDelete.title}"?` 
                    : `Are you sure you want to delete "${expenseToDelete.title}"?`}
                </p>
              </div>
            </div>

            {expenseToDelete.activityId && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                {isVi 
                  ? 'Khoản chi tiêu này thuộc hoạt động lịch trình. Khi xóa, chi phí thực tế sẽ được đặt lại về 0 và đồng bộ sang tab Lịch trình.' 
                  : 'This expense is linked to an itinerary activity. Deleting will reset the actual cost to 0 and sync with the Itinerary tab.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExpense}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                {isVi ? 'Xác nhận' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        onClose={() => setIsReceiptScannerOpen(false)}
        currency={trip.currency || 'VND'}
        onApplyReceipt={handleApplyReceipt}
      />

      {/* Fullscreen Receipt Image Viewer Modal */}
      {viewingReceiptImage && (
        <div 
          onClick={() => setViewingReceiptImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white shrink-0">
              <span className="text-xs font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-violet-400" />
                <span>{isVi ? 'Ảnh hóa đơn / biên lai chi tiêu' : 'Receipt Image Viewer'}</span>
              </span>
              <button
                type="button"
                onClick={() => setViewingReceiptImage(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center bg-black/50">
              <img
                src={viewingReceiptImage}
                alt="Receipt Full View"
                className="max-h-[78vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
