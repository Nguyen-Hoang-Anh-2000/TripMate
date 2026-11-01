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
  PiggyBank
} from 'lucide-react';
import { Trip, TravelDocument } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface TravelVaultViewProps {
  trip: Trip;
  onAddDocument: (doc: Omit<TravelDocument, 'id'>) => void;
  onEditDocument: (docId: string, doc: Partial<TravelDocument>) => void;
  onDeleteDocument: (docId: string) => void;
}

export const TravelVaultView: React.FC<TravelVaultViewProps> = ({
  trip,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
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
    <div className="space-y-4">
      {/* Top Header & Action Row - Clean and compact without badge count */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isVi ? 'Thêm vé / giấy tờ' : 'Add Document'}</span>
        </button>
      </div>

      {/* Documents Grid */}
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

                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 break-words leading-snug">
                    {doc.title}
                  </h4>

                  {/* Confirmation Code without copy button */}
                  {doc.codeOrNumber && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 select-all">
                        {doc.codeOrNumber}
                      </span>
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

              {/* Action Buttons: Edit & Delete */}
              <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0">
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
    </div>
  );
};
