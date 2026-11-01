import React from 'react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';
import { X, Users, CheckCircle, Receipt, ArrowRightLeft } from 'lucide-react';

interface SpentBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

export const SpentBreakdownModal: React.FC<SpentBreakdownModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  if (!isOpen) return null;

  const totalSpent = trip.expenses ? trip.expenses.reduce((sum, e) => sum + e.amount, 0) : 0;
  const members = trip.members || [];

  // Completed activities
  const completedActivities: {
    dayNumber: number;
    activityId: string;
    title: string;
    locationName: string;
    time: string;
    cost: number;
  }[] = [];

  trip.days.forEach((day) => {
    day.activities.forEach((act) => {
      if (act.isCompleted) {
        completedActivities.push({
          dayNumber: day.dayNumber,
          activityId: act.id,
          title: act.title,
          locationName: act.locationName,
          time: act.time,
          cost: act.estimatedCost || 0,
        });
      }
    });
  });

  // Calculate per member: paid amount and share
  const memberBalances: {
    [memberId: string]: {
      paid: number;
      share: number;
      balance: number;
    };
  } = {};

  members.forEach((m) => {
    memberBalances[m.id] = { paid: 0, share: 0, balance: 0 };
  });

  (trip.expenses || []).forEach((exp) => {
    if (memberBalances[exp.paidBy]) {
      memberBalances[exp.paidBy].paid += exp.amount;
    }
    const splitCount = exp.splitWith?.length || members.length || 1;
    const sharePerPerson = exp.amount / splitCount;
    const splitMembers = exp.splitWith || members.map((m) => m.id);

    splitMembers.forEach((mId) => {
      if (memberBalances[mId]) {
        memberBalances[mId].share += sharePerPerson;
      }
    });
  });

  members.forEach((m) => {
    const info = memberBalances[m.id];
    if (info) {
      info.balance = info.paid - info.share;
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-sm sm:text-base">
              {isVi ? 'Tổng Hợp Chi Phí Đã Chi' : 'Expense Breakdown'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
          
          {/* Total Group Spend Card */}
          <div className="bg-gradient-to-br from-teal-700 to-emerald-800 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-teal-200 font-bold">
                {isVi ? 'Tổng Đã Chi Của Nhóm' : 'Total Group Spending'}
              </div>
              <div className="text-2xl font-extrabold mt-0.5">
                {formatMoney(totalSpent, trip.currency, lang)}
              </div>
              <div className="text-xs text-teal-100 mt-1">
                {trip.expenses?.length || 0} {isVi ? 'khoản chi tiêu' : 'expenses'} • {completedActivities.length} {isVi ? 'hoạt động hoàn thành' : 'completed activities'}
              </div>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-teal-300">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Per Member Spending Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>{isVi ? 'Chi tiết chi tiêu từng thành viên' : 'Per-Member Spending & Share'}</span>
            </h4>

            <div className="space-y-2">
              {members.map((member) => {
                const bal = memberBalances[member.id] || { paid: 0, share: 0, balance: 0 };
                const isOwed = bal.balance > 0;
                const isOwing = bal.balance < 0;

                return (
                  <div
                    key={member.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="font-bold text-xs text-slate-800 truncate">
                          {member.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {isVi ? 'Đã trả:' : 'Paid:'} <span className="font-semibold text-slate-700">{formatMoney(bal.paid, trip.currency, lang)}</span> • {isVi ? 'Phần chi:' : 'Share:'} <span className="font-semibold text-slate-700">{formatMoney(bal.share, trip.currency, lang)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-extrabold ${
                          isOwed ? 'text-emerald-600' : isOwing ? 'text-amber-600' : 'text-slate-600'
                        }`}
                      >
                        {isOwed ? `+${formatMoney(bal.balance, trip.currency, lang)}` : formatMoney(bal.balance, trip.currency, lang)}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {isOwed ? (isVi ? 'Nhận lại' : 'To receive') : isOwing ? (isVi ? 'Cần trả thêm' : 'Owes') : (isVi ? 'Đủ' : 'Settled')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completed Activities List */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
              <span>{isVi ? 'Hoạt động đã hoàn thành' : 'Completed Activities'} ({completedActivities.length})</span>
            </h4>

            {completedActivities.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {completedActivities.map((act) => (
                  <div
                    key={act.activityId}
                    className="p-2.5 bg-teal-50/40 rounded-xl border border-teal-100 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 truncate">
                        {act.title}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                        <span>{isVi ? `Ngày ${act.dayNumber}` : `Day ${act.dayNumber}`}</span>
                        {act.time && <span>• {act.time}</span>}
                        {act.locationName && <span>• {act.locationName}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="font-extrabold text-emerald-700 text-xs">
                        {formatMoney(act.cost, trip.currency, lang)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                {isVi ? 'Chưa có hoạt động nào được đánh dấu hoàn thành.' : 'No completed activities yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
