import React, { useState } from 'react';
import { Bell, X, Check, MapPin, Calendar, UserCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trip, TripInvitation } from '../types';

interface InvitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (trip: Trip) => void;
}

export const InvitationsModal: React.FC<InvitationsModalProps> = ({ isOpen, onClose, onSelectTrip }) => {
  const { isVi } = useLanguage();
  const { pendingInvitations, acceptInvitation, declineInvitation } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async (inv: TripInvitation) => {
    setProcessingId(inv.id);
    try {
      await acceptInvitation(inv, (acceptedTrip) => {
        onSelectTrip?.(acceptedTrip);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invId: string) => {
    setProcessingId(invId);
    try {
      await declineInvitation(invId);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base">
                {isVi ? 'Lời Mời Tham Gia Chuyến Đi' : 'Trip Invitations'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {pendingInvitations.length} {isVi ? 'lời mời đang chờ phản hồi' : 'pending invitations'}
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

        {/* Body */}
        <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto space-y-3">
          {pendingInvitations.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium">
                {isVi ? 'Bạn không có lời mời chuyến đi nào đang chờ.' : 'You have no pending trip invitations.'}
              </p>
            </div>
          ) : (
            pendingInvitations.map((inv) => (
              <div 
                key={inv.id}
                className="p-4 bg-slate-50 hover:bg-slate-50/80 rounded-2xl border border-slate-200 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                      {isVi ? 'Lời mời từ' : 'Invited by'} {inv.inviterName}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {inv.tripTitle}
                    </h4>
                    {inv.tripDestination && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{inv.tripDestination}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(inv.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
                  {isVi 
                    ? `Khi bạn đồng ý, chuyến đi "${inv.tripTitle}" sẽ hiển thị trong tài khoản của bạn với đầy đủ lịch trình và sổ chi tiêu chung.`
                    : `Accepting will add "${inv.tripTitle}" to your account with full itinerary and shared expense access.`}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDecline(inv.id)}
                    disabled={processingId === inv.id}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isVi ? 'Từ chối' : 'Decline'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAccept(inv)}
                    disabled={processingId === inv.id}
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {processingId === inv.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isVi ? 'Đồng ý' : 'Accept'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
