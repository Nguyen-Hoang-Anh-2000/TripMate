import React, { useState, useEffect } from 'react';
import { ActivityItem, Trip, SavedPlace } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { CheckCircle2, DollarSign, Star, Users, MapPin, X } from 'lucide-react';
import { formatMoney } from '../utils/formatCurrency';

interface CompleteActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityItem;
  dayNumber: number;
  trip: Trip;
  savedPlaces: SavedPlace[];
  onConfirm: (data: {
    dayNumber: number;
    activityId: string;
    totalCost: number;
    paidBy: string;
    splitWith: string[];
    memberSplits: { memberId: string; amount: number }[];
    rating: number;
    locationReview: string;
  }) => void;
}

export const CompleteActivityModal: React.FC<CompleteActivityModalProps> = ({
  isOpen,
  onClose,
  activity,
  dayNumber,
  trip,
  savedPlaces,
  onConfirm,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const memberCount = trip.members.length || 1;
  const defaultEstimatedTotal = (activity.estimatedCost || 0) * memberCount;

  const [totalCost, setTotalCost] = useState<string>(String(defaultEstimatedTotal));
  const [paidBy, setPaidBy] = useState<string>(trip.members[0]?.id || 'me');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(trip.members.map((m) => m.id));
  const [memberSplits, setMemberSplits] = useState<{ [memberId: string]: string }>({});

  // Rating & Location Review
  const matchingPlace = savedPlaces.find(
    (p) =>
      p.name.toLowerCase() === activity.locationName.toLowerCase() ||
      activity.locationName.toLowerCase().includes(p.name.toLowerCase()) ||
      activity.title.toLowerCase().includes(p.name.toLowerCase())
  );
  const [rating, setRating] = useState<number>(matchingPlace?.rating || 5);
  const [locationReview, setLocationReview] = useState<string>('');

  // Auto-calculate split evenly among selected members when totalCost or selectedMembers change
  useEffect(() => {
    const num = parseFloat(totalCost) || 0;
    const count = selectedMembers.length || 1;
    const baseShare = Math.floor(num / count);
    const remainder = num - (baseShare * count);
    const newSplits: { [memberId: string]: string } = {};
    selectedMembers.forEach((mId, index) => {
      newSplits[mId] = String(index === 0 ? baseShare + remainder : baseShare);
    });
    setMemberSplits(newSplits);
  }, [totalCost, selectedMembers]);

  if (!isOpen) return null;

  const handleMemberToggle = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      if (selectedMembers.length === 1) return; // Keep at least one
      setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
    } else {
      setSelectedMembers((prev) => [...prev, memberId]);
    }
  };

  const handleSplitChange = (memberId: string, value: string) => {
    setMemberSplits((prev) => ({
      ...prev,
      [memberId]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTotal = parseFloat(totalCost) || 0;
    const splits = selectedMembers.map((mId) => ({
      memberId: mId,
      amount: parseFloat(memberSplits[mId]) || 0,
    }));

    onConfirm({
      dayNumber,
      activityId: activity.id,
      totalCost: finalTotal,
      paidBy,
      splitWith: selectedMembers,
      memberSplits: splits,
      rating,
      locationReview: locationReview.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-300" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                {isVi ? 'Hoàn Thành Hoạt Động & Ghi Nhận Chi Tiêu' : 'Complete Activity & Log Expense'}
              </h3>
              <p className="text-[11px] text-teal-100 truncate max-w-xs">
                {isVi ? `Ngày ${dayNumber}: ` : `Day ${dayNumber}: `}
                {activity.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
          {/* Total Cost Input */}
          <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-teal-900">
                {isVi ? 'Tổng tiền đã chi cho hoạt động *' : 'Total Expense Amount *'}
              </label>
              <span className="text-[10px] text-teal-700 font-medium">
                {isVi ? `(Dự kiến: ${formatMoney(activity.estimatedCost || 0, trip.currency, lang)} × ${memberCount} người)` : `Est: ${memberCount} members`}
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                required
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="VD: 300000"
                className="w-full text-base font-extrabold p-2.5 rounded-xl border border-teal-300 bg-white text-teal-950 focus:outline-hidden focus:ring-2 focus:ring-teal-500 pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-teal-700">
                {trip.currency || 'VND'}
              </span>
            </div>
          </div>

          {/* Payer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isVi ? 'Người thanh toán (Ai trả tiền trước?) *' : 'Paid By *'}
            </label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {trip.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.id === trip.members[0]?.id ? (isVi ? '(Trưởng nhóm)' : '(Organizer)') : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Member Split Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-teal-600" />
                <span>{isVi ? 'Số tiền từng thành viên' : 'Split Amount per Member'}</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                {selectedMembers.length}/{trip.members.length} {isVi ? 'thành viên tham gia' : 'members'}
              </span>
            </div>

            <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              {[...trip.members]
                .sort((a, b) => {
                  const aSel = selectedMembers.includes(a.id) ? 1 : 0;
                  const bSel = selectedMembers.includes(b.id) ? 1 : 0;
                  return bSel - aSel;
                })
                .map((member) => {
                const isSelected = selectedMembers.includes(member.id);
                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-white border border-slate-200' : 'opacity-50'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleMemberToggle(member.id)}
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {member.name}
                      </span>
                    </label>

                    {isSelected && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={memberSplits[member.id] || ''}
                          onChange={(e) => handleSplitChange(member.id, e.target.value)}
                          className="w-24 text-right text-xs font-bold p-1.5 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold">{trip.currency}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Location Rating & Review */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                <span>{isVi ? 'Đánh giá địa điểm' : 'Rate & Review Location'}</span>
              </label>
              <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                {'⭐'.repeat(rating)} ({rating} {isVi ? 'sao' : 'stars'})
              </span>
            </div>

            {/* Stars Picker */}
            <div className="flex items-center gap-1.5 p-2 bg-amber-50/50 rounded-xl border border-amber-200/60 justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className={`p-1.5 rounded-lg transition-transform text-lg cursor-pointer ${
                    s <= rating ? 'scale-110' : 'opacity-40 hover:opacity-80'
                  }`}
                  title={`${s} sao`}
                >
                  ⭐
                </button>
              ))}
            </div>

            {/* Review Note */}
            <div>
              <textarea
                rows={2}
                value={locationReview}
                onChange={(e) => setLocationReview(e.target.value)}
                placeholder={isVi ? 'Nhận xét về địa điểm này (quán ngon, dịch vụ tốt, cảnh đẹp... để lưu vào tab Địa Điểm)' : 'Write a quick review to update saved places...'}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isVi ? 'Lưu & Hoàn Thành' : 'Save & Complete'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
