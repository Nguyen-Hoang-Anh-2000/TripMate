import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Bell, Check, CheckCheck, MapPin, Calendar,
  ShieldCheck, KeyRound, Clock, DollarSign, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trip, TripInvitation, TripNotification, UserTripNotification } from '../types';
import { formatMoney } from '../utils/formatCurrency';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (tripId: string) => void;
  activeTrip?: Trip | null;
  trips?: Trip[];
  onUpdateTrip?: (tripId: string, updatedFields: Partial<Trip>) => void;
}

type ReadFilterTab = 'unread' | 'read';

type UnifiedNotificationItem =
  | {
      kind: 'invitation';
      key: string;
      createdAt: string;
      isRead: boolean;
      invitation: TripInvitation;
    }
  | {
      kind: 'trip_notif';
      key: string;
      createdAt: string;
      isRead: boolean;
      trip: Trip;
      notif: TripNotification;
    }
  | {
      kind: 'user_notif';
      key: string;
      createdAt: string;
      isRead: boolean;
      userNotif: UserTripNotification;
    };

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectTrip,
  activeTrip,
  trips = [],
  onUpdateTrip,
}) => {
  const { invitations, respondToInvitation, userNotifications, markUserNotificationsRead, userProfile } = useAuth();
  const { isVi, lang } = useLanguage();
  const [readFilter, setReadFilter] = useState<ReadFilterTab>('unread');

  const storageKey = `tripmate_read_notifs_${userProfile?.id || 'guest'}`;

  const [readKeys, setReadKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setReadKeys(saved ? (JSON.parse(saved) as string[]) : []);
    } catch {
      setReadKeys([]);
    }
  }, [storageKey]);

  const markAsRead = (keysToMark: string[]) => {
    setReadKeys((prev) => {
      const next = Array.from(new Set([...prev, ...keysToMark]));
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('tripmate_notifs_read_updated'));
      } catch (e) {
        console.warn('Failed saving read notification state:', e);
      }
      return next;
    });
    const remoteIds = keysToMark
      .filter((k) => k.startsWith('unotif_'))
      .map((k) => k.slice('unotif_'.length));
    if (remoteIds.length > 0) {
      markUserNotificationsRead(remoteIds);
    }
  };

  const allTrips = useMemo(
    () => (activeTrip ? [activeTrip, ...trips.filter((t) => t.id !== activeTrip.id)] : trips),
    [activeTrip, trips]
  );

  const unifiedItems = useMemo<UnifiedNotificationItem[]>(() => {
    const invItems: UnifiedNotificationItem[] = invitations.map((inv) => {
      const key = `inv_${inv.id}`;
      const isRead = inv.status !== 'pending' || readKeys.includes(key);
      return {
        kind: 'invitation',
        key,
        createdAt: inv.createdAt,
        isRead,
        invitation: inv,
      };
    });

    const tripNotifItems: UnifiedNotificationItem[] = allTrips.flatMap((t) =>
      (t.notifications || []).map((n) => {
        const key = `notif_${n.id}`;
        const isRead = n.status !== 'pending' && readKeys.includes(key);
        return {
          kind: 'trip_notif',
          key,
          createdAt: n.createdAt,
          isRead,
          trip: t,
          notif: n,
        };
      })
    );

    const userNotifItems: UnifiedNotificationItem[] = (userNotifications || []).map((un) => {
      const key = `unotif_${un.id}`;
      const isRead = un.status === 'read' || readKeys.includes(key);
      return {
        kind: 'user_notif',
        key,
        createdAt: un.createdAt,
        isRead,
        userNotif: un,
      };
    });

    return [...invItems, ...tripNotifItems, ...userNotifItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [invitations, allTrips, userNotifications, readKeys]);

  if (!isOpen) return null;

  const unreadItems = unifiedItems.filter((item) => !item.isRead);
  const readItems = unifiedItems.filter((item) => item.isRead);
  const displayedItems = readFilter === 'unread' ? unreadItems : readItems;

  const handleMarkAllRead = () => {
    const markableKeys = unreadItems
      .filter((item) => !(item.kind === 'trip_notif' && item.notif.status === 'pending'))
      .map((item) => item.key);
    if (markableKeys.length > 0) {
      markAsRead(markableKeys);
    }
  };

  const handleApproveRequest = (trip: Trip, notif: TripNotification) => {
    if (!onUpdateTrip) return;
    const actor = userProfile?.displayName || 'Trưởng đoàn';
    const updatedNotifs: TripNotification[] = (trip.notifications || []).map((n) =>
      n.id === notif.id ? { ...n, status: 'approved' as const, resolvedAt: new Date().toISOString() } : n
    );

    const completionId = `notif_${Date.now()}`;
    if (notif.actionType === 'remove_pin') {
      const completionNotif: TripNotification = {
        id: completionId,
        type: 'pin_removed',
        title: isVi ? 'Mã PIN két giấy tờ đã được gỡ bỏ' : 'Vault PIN Removed',
        message: isVi
          ? `Mã PIN bảo vệ két vé đã được gỡ bỏ thành công sau khi được ${actor} phê duyệt đồng ý vào lúc ${new Date().toLocaleTimeString('vi-VN')}.`
          : `Vault PIN was removed after approval by ${actor} at ${new Date().toLocaleTimeString()}.`,
        actorId: userProfile?.id || 'admin',
        actorName: actor,
        createdAt: new Date().toISOString(),
        status: 'approved',
      };
      onUpdateTrip(trip.id, {
        vaultPin: undefined,
        notifications: [completionNotif, ...updatedNotifs],
      });
      localStorage.removeItem(`tripmate_vault_pin_${trip.id}`);
    } else {
      const approvalNotif: TripNotification = {
        id: completionId,
        type: 'info',
        title: isVi ? 'Yêu cầu đổi PIN đã được phê duyệt' : 'PIN Reset Approved',
        message: isVi
          ? `${actor} đã phê duyệt yêu cầu đặt lại mã PIN của ${notif.actorName}.`
          : `${actor} approved the PIN reset request from ${notif.actorName}.`,
        actorId: userProfile?.id || 'admin',
        actorName: actor,
        createdAt: new Date().toISOString(),
        status: 'approved',
      };
      onUpdateTrip(trip.id, {
        notifications: [approvalNotif, ...updatedNotifs],
      });
    }
    markAsRead([`notif_${notif.id}`, `notif_${completionId}`]);
  };

  const handleRejectRequest = (trip: Trip, notif: TripNotification) => {
    if (!onUpdateTrip) return;
    const actor = userProfile?.displayName || 'Trưởng đoàn';
    const updatedNotifs: TripNotification[] = (trip.notifications || []).map((n) =>
      n.id === notif.id ? { ...n, status: 'rejected' as const, resolvedAt: new Date().toISOString() } : n
    );
    const rejectionId = `notif_${Date.now()}`;
    const rejectionNotif: TripNotification = {
      id: rejectionId,
      type: 'info',
      title: isVi ? 'Yêu cầu bảo mật bị từ chối' : 'Security Request Rejected',
      message: isVi
        ? `${actor} đã từ chối yêu cầu thao tác mã PIN của ${notif.actorName}.`
        : `${actor} rejected the PIN request from ${notif.actorName}.`,
      actorId: userProfile?.id || 'admin',
      actorName: actor,
      createdAt: new Date().toISOString(),
      status: 'rejected',
    };
    onUpdateTrip(trip.id, {
      notifications: [rejectionNotif, ...updatedNotifs],
    });
    markAsRead([`notif_${notif.id}`, `notif_${rejectionId}`]);
  };

  const hasMarkableUnread = unreadItems.some(
    (item) => !(item.kind === 'trip_notif' && item.notif.status === 'pending')
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-600/30 flex items-center justify-center text-teal-400">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {isVi ? 'Thông báo' : 'Notifications'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Read / Unread Filter */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReadFilter('unread')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  readFilter === 'unread'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{isVi ? 'Chưa đọc' : 'Unread'}</span>
                {unreadItems.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      readFilter === 'unread'
                        ? 'bg-amber-400 text-slate-900'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {unreadItems.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setReadFilter('read')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  readFilter === 'read'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{isVi ? 'Đã đọc' : 'Read'}</span>
              </button>
            </div>

            {readFilter === 'unread' && hasMarkableUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-teal-300 hover:text-teal-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{isVi ? 'Đọc tất cả' : 'Mark all read'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-3 overflow-y-auto max-h-[75vh]">
          {displayedItems.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-600">
                {readFilter === 'unread'
                  ? isVi
                    ? 'Không có thông báo chưa đọc'
                    : 'No unread notifications'
                  : isVi
                  ? 'Chưa có thông báo đã đọc'
                  : 'No read notifications'}
              </p>
            </div>
          ) : (
            displayedItems.map((item) => {
              if (item.kind === 'invitation') {
                const inv = item.invitation;
                if (inv.status === 'pending') {
                  return (
                    <div
                      key={item.key}
                      className="p-3.5 sm:p-4 bg-teal-50/60 rounded-2xl border border-teal-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                            {isVi ? 'Lời mời từ:' : 'Invited by:'} {inv.inviterName}
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">
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

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={async () => {
                            await respondToInvitation(inv.id, true, inv.tripId);
                            markAsRead([item.key]);
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
                            markAsRead([item.key]);
                          }}
                          className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                        >
                          {isVi ? 'Từ chối' : 'Decline'}
                        </button>
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead([item.key])}
                            className="py-2 px-2.5 bg-white hover:bg-teal-50 border border-slate-200 text-teal-700 rounded-xl font-semibold text-[11px] transition-colors cursor-pointer"
                            title={isVi ? 'Đánh dấu đã đọc' : 'Mark as read'}
                          >
                            {isVi ? 'Đã đọc' : 'Mark read'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.key}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{inv.tripTitle}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {isVi ? 'Từ:' : 'From:'} {inv.inviterName}
                        {inv.tripDestination ? ` • ${inv.tripDestination}` : ''}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        inv.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {inv.status === 'accepted'
                        ? isVi
                          ? '✓ Đã tham gia'
                          : 'Accepted'
                        : isVi
                        ? 'Đã từ chối'
                        : 'Declined'}
                    </span>
                  </div>
                );
              }

              if (item.kind === 'user_notif') {
                const un = item.userNotif;
                const isSettlement = un.type === 'trip_deleted_settlement';
                return (
                  <div
                    key={item.key}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isSettlement
                        ? 'bg-amber-50/85 border-amber-300 shadow-xs'
                        : 'bg-rose-50/70 border-rose-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isSettlement
                              ? 'bg-amber-500 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {isSettlement ? (
                            <DollarSign className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                            {un.tripTitle}
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                            {un.title}
                          </h4>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isSettlement
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {isSettlement
                          ? isVi
                            ? 'Giải quyết tiền'
                            : 'Settlement'
                          : isVi
                          ? 'Chuyến đi đã xóa'
                          : 'Trip Deleted'}
                      </span>
                    </div>

                    {isSettlement && un.fromMemberName && un.toMemberName && typeof un.amount === 'number' && (
                      <div className="mt-2 px-3 py-2 rounded-xl bg-white border border-amber-200 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-800">
                          {un.fromMemberName} {isVi ? 'thiếu' : 'owes'} {un.toMemberName}
                        </span>
                        <span className="font-extrabold text-rose-600">
                          {formatMoney(un.amount, un.currency || 'VND', lang)}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-slate-700 mt-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/70 leading-relaxed">
                      {un.message}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 gap-2">
                      <span className="truncate">
                        {isVi ? 'Thực hiện bởi:' : 'By:'}{' '}
                        <strong className="text-slate-600">{un.actorName}</strong>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span>
                          {new Date(un.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          {new Date(un.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead([item.key])}
                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 text-teal-700 font-semibold text-[10px] cursor-pointer transition-colors"
                          >
                            {isVi ? 'Đã đọc' : 'Mark read'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              const { trip, notif } = item;
              const isPending = notif.status === 'pending';
              const isRemoved = notif.type === 'pin_removed';

              return (
                <div
                  key={item.key}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isPending
                      ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                      : isRemoved
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-teal-50/50 border-teal-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                          isPending
                            ? 'bg-amber-500 text-white'
                            : isRemoved
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-teal-600 text-white'
                        }`}
                      >
                        {isPending ? (
                          <Clock className="w-4 h-4" />
                        ) : isRemoved ? (
                          <KeyRound className="w-4 h-4" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                          {trip.title}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                          {notif.title}
                        </h4>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : isRemoved
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isPending
                        ? isVi
                          ? 'Chờ phê duyệt'
                          : 'Pending'
                        : notif.status === 'rejected'
                        ? isVi
                          ? 'Đã từ chối'
                          : 'Rejected'
                        : isVi
                        ? 'Đã duyệt / Hoàn tất'
                        : 'Approved'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 mt-2 bg-white/70 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 gap-2">
                    <span className="truncate">
                      {isVi ? 'Thao tác bởi:' : 'By:'}{' '}
                      <strong className="text-slate-600">{notif.actorName}</strong>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span>
                        {new Date(notif.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        {new Date(notif.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                      {!isPending && !item.isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead([item.key])}
                          className="px-2 py-0.5 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 text-teal-700 font-semibold text-[10px] cursor-pointer transition-colors"
                        >
                          {isVi ? 'Đã đọc' : 'Mark read'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2 pt-2.5 mt-2 border-t border-amber-200">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(trip, notif)}
                        className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Đồng ý phê duyệt' : 'Approve Request'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(trip, notif)}
                        className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {isVi ? 'Từ chối' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
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
