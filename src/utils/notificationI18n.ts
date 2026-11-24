import { TripNotification, UserTripNotification } from '../types';
import { formatMoney } from './formatCurrency';

export function formatTripNotificationI18n(
  notif: TripNotification,
  lang: 'vi' | 'en'
): { title: string; message: string } {
  const isVi = lang === 'vi';
  const actor = notif.actorName || (isVi ? 'Thành viên' : 'Member');

  if (notif.type === 'pin_reset_requested' || notif.type === 'pin_remove_requested') {
    const isRemove =
      notif.type === 'pin_remove_requested' ||
      notif.actionType === 'remove_pin' ||
      /gỡ bỏ|remove/i.test(notif.title + ' ' + notif.message);

    if (isRemove) {
      return {
        title: isVi
          ? 'Yêu cầu phê duyệt gỡ bỏ mã PIN'
          : 'PIN Removal Approval Request',
        message: isVi
          ? `${actor} đề nghị gỡ bỏ mã PIN khóa Ví Vé & Giấy tờ.`
          : `${actor} requested to remove the Travel Vault PIN lock.`,
      };
    }

    return {
      title: isVi
        ? 'Yêu cầu phê duyệt đặt lại mã PIN'
        : 'PIN Reset Approval Request',
      message: isVi
        ? `${actor} đã xác thực OTP và đề nghị đặt lại mã PIN mới cho Ví Vé & Giấy tờ.`
        : `${actor} verified OTP and requested to set a new Travel Vault PIN.`,
    };
  }

  if (notif.type === 'pin_changed') {
    const isInitialSetup = /thiết lập|created|set/i.test(notif.title + ' ' + notif.message) &&
      !/đổi|changed|reset|đặt lại|duyệt/i.test(notif.title + ' ' + notif.message);

    const isApprovedReset = /duyệt|approved/i.test(notif.title + ' ' + notif.message);

    if (isInitialSetup) {
      return {
        title: isVi ? 'Đã thiết lập mã PIN Ví Vé & Giấy tờ' : 'Travel Vault PIN Enabled',
        message: isVi
          ? `${actor} đã tạo mã PIN bảo vệ tài liệu.`
          : `${actor} set a PIN to protect Travel Vault documents.`,
      };
    }

    if (isApprovedReset) {
      return {
        title: isVi ? 'Yêu cầu đặt lại mã PIN đã được duyệt' : 'PIN Reset Request Approved',
        message: isVi
          ? `${actor} đã phê duyệt đặt lại mã PIN mới cho Ví Vé & Giấy tờ.`
          : `${actor} approved the new Travel Vault PIN.`,
      };
    }

    return {
      title: isVi ? 'Mã PIN Ví Vé & Giấy tờ đã được đổi' : 'Travel Vault PIN Changed',
      message: isVi
        ? `${actor} đã cập nhật mã PIN mới cho Ví Vé & Giấy tờ.`
        : `${actor} updated the Travel Vault PIN.`,
    };
  }

  if (notif.type === 'pin_removed') {
    const isApproved = /duyệt|approved/i.test(notif.title + ' ' + notif.message);
    return {
      title: isVi
        ? isApproved
          ? 'Yêu cầu gỡ bỏ mã PIN đã được duyệt'
          : 'Đã gỡ bỏ mã PIN Ví Vé & Giấy tờ'
        : isApproved
          ? 'PIN Removal Request Approved'
          : 'Travel Vault PIN Removed',
      message: isVi
        ? `${actor} đã gỡ bỏ khóa mã PIN cho Ví Vé & Giấy tờ.`
        : `${actor} removed the Travel Vault PIN lock.`,
    };
  }

  if (notif.type === 'info' && /từ chối|declined|rejected/i.test(notif.title + ' ' + notif.message)) {
    const isRemove = /gỡ bỏ|remove/i.test(notif.title + ' ' + notif.message);
    return {
      title: isVi ? 'Yêu cầu PIN bị từ chối' : 'PIN Request Declined',
      message: isVi
        ? `${actor} đã từ chối yêu cầu ${isRemove ? 'gỡ bỏ' : 'đặt lại'} mã PIN.`
        : `${actor} declined the request to ${isRemove ? 'remove' : 'reset'} the Vault PIN.`,
    };
  }

  return {
    title: notif.title,
    message: notif.message,
  };
}

export function formatUserTripNotificationI18n(
  notif: UserTripNotification,
  lang: 'vi' | 'en'
): { title: string; message: string } {
  const isVi = lang === 'vi';
  const actor = notif.actorName || (isVi ? 'Người tạo chuyến đi' : 'Trip creator');
  const tripTitle = notif.tripTitle || '';

  if (notif.type === 'trip_deleted_settlement') {
    const amountStr =
      notif.amount !== undefined && notif.currency
        ? formatMoney(notif.amount, notif.currency, lang)
        : '';
    const fromName = notif.fromMemberName || '';
    const toName = notif.toMemberName || '';
    const targetName = notif.targetMemberName || '';

    const isDebtor = targetName && fromName && targetName.toLowerCase() === fromName.toLowerCase();
    const isCreditor = targetName && toName && targetName.toLowerCase() === toName.toLowerCase();

    let message: string;
    if (isDebtor) {
      message = isVi
        ? `Chuyến đi "${tripTitle}" đã bị ${actor} xóa. Bạn còn cần thanh toán ${amountStr} cho ${toName}.`
        : `"${tripTitle}" was deleted by ${actor}. You still owe ${amountStr} to ${toName}.`;
    } else if (isCreditor) {
      message = isVi
        ? `Chuyến đi "${tripTitle}" đã bị ${actor} xóa. ${fromName} còn cần thanh toán ${amountStr} cho bạn.`
        : `"${tripTitle}" was deleted by ${actor}. ${fromName} still owes you ${amountStr}.`;
    } else if (fromName && toName && amountStr) {
      message = isVi
        ? `Chuyến đi "${tripTitle}" đã bị ${actor} xóa. Công nợ ghi nhận: ${fromName} trả ${toName} ${amountStr}.`
        : `"${tripTitle}" was deleted by ${actor}. Pending settlement: ${fromName} pays ${toName} ${amountStr}.`;
    } else {
      message = notif.message;
    }

    return {
      title: isVi
        ? `Thông báo công nợ chuyến đi "${tripTitle}"`
        : `Settlement notice: "${tripTitle}"`,
      message,
    };
  }

  if (notif.type === 'trip_deleted') {
    return {
      title: isVi ? `Chuyến đi "${tripTitle}" đã bị xóa` : `Trip "${tripTitle}" deleted`,
      message: isVi
        ? `${actor} đã xóa chuyến đi "${tripTitle}".`
        : `${actor} deleted the trip "${tripTitle}".`,
    };
  }

  return {
    title: notif.title,
    message: notif.message,
  };
}
