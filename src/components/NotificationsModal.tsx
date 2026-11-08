import React from 'react';
import { X, Bell, Check, MapPin, Calendar, UserCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (tripId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectTrip,
}) => {
  const { invitations, respondToInvitation } = useAuth();
  const { lang, isVi } = useLanguage();

  if (!isOpen) return null;

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');
  const pastInvitations = invitations.filter((i) => i.status !== 'pending');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-600/30 flex items-center justify-center text-teal-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {isVi ? 'Lời Mời Tham Gia Chuyến Đi' : 'Trip Invitations'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isVi ? 'Xem và phản hồi các chuyến đi bạn được mời' : 'Review and accept your trip invitations'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {invitations.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-600">
                {isVi ? 'Hiện không có lời mời nào' : 'No invitations at this time'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                {isVi
                  ? 'Khi người tạo chuyến đi thêm bạn bằng email hoặc số điện thoại, lời mời sẽ hiển thị tại đây.'
                  : 'When a trip creator invites you by email or phone, invitations will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping" />
                    <span>{isVi ? 'Lời mời đang chờ bạn đồng ý' : 'Pending Invitations'} ({pendingInvitations.length})</span>
                  </div>

                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3.5 sm:p-4 bg-teal-50/60 rounded-2xl border border-teal-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                            {isVi ? 'Người mời:' : 'Invited by:'} {inv.inviterName}
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                            {inv.tripTitle}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                            {inv.tripDestination && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                                <span>{inv.tripDestination}</span>
                              </span>
                            )}
                            {inv.tripDates && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{inv.tripDates}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          {isVi ? 'Chờ xác nhận' : 'Pending'}
                        </span>
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-teal-100 text-[11px] text-slate-600">
                        {isVi
                          ? 'Khi đồng ý, bạn sẽ được thêm vào danh sách thành viên chính thức và có quyền xem toàn bộ lịch trình, chi tiêu, tài liệu của chuyến đi.'
                          : 'Upon accepting, you will officially join this trip and gain full access to its itinerary and expenses.'}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await respondToInvitation(inv.id, true, inv.tripId);
                            if (onSelectTrip) onSelectTrip(inv.tripId);
                            onClose();
                          }}
                          className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Đồng ý tham gia' : 'Accept Invitation'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await respondToInvitation(inv.id, false, inv.tripId);
                          }}
                          className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                        >
                          {isVi ? 'Từ chối' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Past Invitations */}
              {pastInvitations.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {isVi ? 'Lịch sử lời mời' : 'Past Invitations'}
                  </div>
                  {pastInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">{inv.tripTitle}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {isVi ? 'Từ:' : 'From:'} {inv.inviterName} • {inv.tripDestination}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        inv.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {inv.status === 'accepted'
                          ? (isVi ? '✓ Đã tham gia' : 'Accepted')
                          : (isVi ? 'Đã từ chối' : 'Declined')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
