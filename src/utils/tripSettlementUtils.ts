import type { Trip, TripMember, UserProfile, UserTripNotification } from '../types.ts';
import { formatMoney } from './formatCurrency.ts';

export interface TripSettlementTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  currency: string;
}

export interface TripDeletionSummary {
  otherMembers: TripMember[];
  totalMembersCount: number;
  recordedExpensesCount: number;
  totalSpent: number;
  currency: string;
  settlements: TripSettlementTransfer[];
  hasOtherMembers: boolean;
  hasRecordedExpenses: boolean;
}

export function isMemberMatchingUser(member: TripMember, user?: Partial<UserProfile> | null): boolean {
  if (!user) return false;
  if (user.id && (member.uid === user.id || member.id === user.id || member.id === `m-${user.id}`)) {
    return true;
  }
  const userEmail = (user.email || '').trim().toLowerCase();
  if (userEmail && (member.email || '').trim().toLowerCase() === userEmail) {
    return true;
  }
  const userPhone = (user.phone || '').replace(/[\s\-().]/g, '');
  const memPhone = (member.phone || '').replace(/[\s\-().]/g, '');
  if (userPhone && memPhone && userPhone === memPhone) {
    return true;
  }
  return false;
}

/**
 * Computes recorded expenses and simplified Splitwise-style settlements for a trip,
 * matching ExpenseSplitterView's accounting formula:
 *   remainingBalance = contributed + paidExtra - used
 */
export function computeTripDeletionSummary(
  trip: Trip,
  actor?: Partial<UserProfile> | null
): TripDeletionSummary {
  const currency = trip.currency || 'VND';
  const members = Array.isArray(trip.members) ? trip.members : [];
  const otherMembers = members.filter((m) => !isMemberMatchingUser(m, actor));

  // Unify manual expenses + completed activities (avoid double counting linked expenseId)
  const unifiedRecords: Array<{
    amount: number;
    paidBy: string;
    splitWith: string[];
    memberSplits?: { memberId: string; amount: number }[];
  }> = [];

  const processedActivityIds = new Set<string>();
  (trip.expenses || []).forEach((exp) => {
    if (exp.activityId) processedActivityIds.add(exp.activityId);
    unifiedRecords.push({
      amount: Number(exp.amount) || 0,
      paidBy: exp.paidBy || trip.fundHolderId || members[0]?.id || 'm1',
      splitWith: Array.isArray(exp.splitWith) ? exp.splitWith : [],
      memberSplits: exp.memberSplits,
    });
  });

  (trip.days || []).forEach((day) => {
    (day.activities || []).forEach((act) => {
      if (act.isCompleted && !processedActivityIds.has(act.id)) {
        processedActivityIds.add(act.id);
        const cost = act.actualCost !== undefined ? Number(act.actualCost) : Number(act.estimatedCost || 0);
        unifiedRecords.push({
          amount: cost,
          paidBy: act.paidBy || trip.fundHolderId || members[0]?.id || 'm1',
          splitWith: Array.isArray(act.splitWith) && act.splitWith.length > 0 ? act.splitWith : members.map((m) => m.id),
          memberSplits: act.memberSplits,
        });
      }
    });
  });

  const totalSpent = unifiedRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const memberStats = members.map((member) => {
    const contributed = Number(member.contributedAmount) || 0;
    const paidExtra = unifiedRecords
      .filter((e) => e.paidBy === member.id)
      .reduce((sum, e) => sum + e.amount, 0);

    let used = 0;
    unifiedRecords.forEach((exp) => {
      if (exp.memberSplits && exp.memberSplits.length > 0) {
        const ms = exp.memberSplits.find((s) => s.memberId === member.id);
        if (ms) used += Number(ms.amount) || 0;
      } else {
        const beneficiaries = exp.splitWith.length > 0 ? exp.splitWith : members.map((m) => m.id);
        if (beneficiaries.includes(member.id)) {
          used += exp.amount / (beneficiaries.length || 1);
        }
      }
    });

    const remainingBalance = Math.round((contributed + paidExtra - used) * 100) / 100;
    return { member, remainingBalance };
  });

  const debtors = memberStats
    .filter((s) => s.remainingBalance < -0.01)
    .map((s) => ({ member: s.member, amount: Math.abs(s.remainingBalance) }));
  const creditors = memberStats
    .filter((s) => s.remainingBalance > 0.01)
    .map((s) => ({ member: s.member, amount: s.remainingBalance }));

  const settlements: TripSettlementTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debtor = debtors[i];
    const creditor = creditors[j];
    const settleAmt = Math.min(debtor.amount, creditor.amount);

    if (settleAmt > 0.01) {
      settlements.push({
        fromId: debtor.member.id,
        fromName: debtor.member.name,
        toId: creditor.member.id,
        toName: creditor.member.name,
        amount: Math.round(settleAmt * 100) / 100,
        currency,
      });
      debtor.amount = Math.round((debtor.amount - settleAmt) * 100) / 100;
      creditor.amount = Math.round((creditor.amount - settleAmt) * 100) / 100;
    }

    if (debtor.amount <= 0.01) i++;
    if (creditor.amount <= 0.01) j++;
  }

  return {
    otherMembers,
    totalMembersCount: members.length,
    recordedExpensesCount: unifiedRecords.length,
    totalSpent,
    currency,
    settlements,
    hasOtherMembers: otherMembers.length > 0,
    hasRecordedExpenses: unifiedRecords.length > 0,
  };
}

/**
 * Generates persistent notifications to deliver to participating members and
 * both sides (debtor A and creditor B) of every unsettled expense balance when a trip is deleted.
 */
export function buildTripDeletionNotifications(params: {
  trip: Trip;
  actor: Partial<UserProfile> | null | undefined;
  summary: TripDeletionSummary;
  language?: 'vi' | 'en';
  nowIso?: string;
}): Array<Omit<UserTripNotification, 'id'> & { id: string }> {
  const {
    trip,
    actor,
    summary,
    language = 'vi',
    nowIso = new Date().toISOString(),
  } = params;
  const isVi = language === 'vi';
  const safeIdPart = (val: string) => (val || 'id').replace(/[^a-zA-Z0-9_-]/g, '_');
  const clamp = (val: string, max: number) => (val || '').slice(0, max);

  const actorId = clamp(actor?.id || trip.creatorId || 'creator', 128);
  const actorName = clamp(actor?.displayName || trip.creatorName || (isVi ? 'Trưởng đoàn' : 'Trip Organizer'), 150);
  const safeTripTitle = clamp(trip.title || 'Trip', 200);
  const baseStamp = Date.now();
  const notifications: Array<Omit<UserTripNotification, 'id'> & { id: string }> = [];
  const notifiedMemberIdsForDebt = new Set<string>();
  const memberById = new Map<string, TripMember>((trip.members || []).map((m) => [m.id, m]));

  // 1. Settlement notifications: send to BOTH debtor (A) and creditor (B)
  summary.settlements.forEach((s, idx) => {
    const formattedAmount = formatMoney(s.amount, s.currency, language);
    const fromMember = memberById.get(s.fromId);
    const toMember = memberById.get(s.toId);

    if (fromMember) {
      notifiedMemberIdsForDebt.add(fromMember.id);
      notifications.push({
        id: clamp(`unotif_del_debt_${safeIdPart(trip.id)}_${safeIdPart(fromMember.id)}_${idx}_${baseStamp}`, 120),
        type: 'trip_deleted_settlement',
        tripId: clamp(trip.id, 128),
        tripTitle: safeTripTitle,
        title: clamp(
          isVi
            ? `Giải quyết tiền: Bạn thiếu ${s.toName} ${formattedAmount}`
            : `Settlement Due: You owe ${s.toName} ${formattedAmount}`,
          200
        ),
        message: clamp(
          isVi
            ? `Chuyến đi "${safeTripTitle}" đã bị xóa bởi ${actorName}. Theo bảng quyết toán chi tiêu, ${s.fromName} thiếu ${s.toName} ${formattedAmount}. Vui lòng thanh toán trực tiếp cho ${s.toName}.`
            : `Trip "${safeTripTitle}" was deleted by ${actorName}. Per expense settlement, ${s.fromName} owes ${s.toName} ${formattedAmount}. Please settle this balance with ${s.toName}.`,
          1000
        ),
        actorId,
        actorName,
        targetUid: clamp(fromMember.uid || fromMember.id, 128),
        ...(fromMember.email ? { targetEmail: clamp(fromMember.email.trim().toLowerCase(), 200) } : {}),
        ...(fromMember.phone ? { targetPhone: clamp(fromMember.phone.trim(), 30) } : {}),
        targetMemberName: clamp(fromMember.name, 150),
        fromMemberId: s.fromId,
        fromMemberName: clamp(s.fromName, 150),
        toMemberId: s.toId,
        toMemberName: clamp(s.toName, 150),
        amount: s.amount,
        currency: clamp(s.currency, 10),
        status: 'unread',
        createdAt: nowIso,
      });
    }

    if (toMember) {
      notifiedMemberIdsForDebt.add(toMember.id);
      notifications.push({
        id: clamp(`unotif_del_cred_${safeIdPart(trip.id)}_${safeIdPart(toMember.id)}_${idx}_${baseStamp}`, 120),
        type: 'trip_deleted_settlement',
        tripId: clamp(trip.id, 128),
        tripTitle: safeTripTitle,
        title: clamp(
          isVi
            ? `Giải quyết tiền: ${s.fromName} thiếu bạn ${formattedAmount}`
            : `Settlement Notice: ${s.fromName} owes you ${formattedAmount}`,
          200
        ),
        message: clamp(
          isVi
            ? `Chuyến đi "${safeTripTitle}" đã bị xóa bởi ${actorName}. Theo bảng quyết toán chi tiêu, ${s.fromName} thiếu ${s.toName} ${formattedAmount}. Vui lòng liên hệ ${s.fromName} để hoàn tất đối soát.`
            : `Trip "${safeTripTitle}" was deleted by ${actorName}. Per expense settlement, ${s.fromName} owes ${s.toName} ${formattedAmount}. Please coordinate with ${s.fromName} to settle.`,
          1000
        ),
        actorId,
        actorName,
        targetUid: clamp(toMember.uid || toMember.id, 128),
        ...(toMember.email ? { targetEmail: clamp(toMember.email.trim().toLowerCase(), 200) } : {}),
        ...(toMember.phone ? { targetPhone: clamp(toMember.phone.trim(), 30) } : {}),
        targetMemberName: clamp(toMember.name, 150),
        fromMemberId: s.fromId,
        fromMemberName: clamp(s.fromName, 150),
        toMemberId: s.toId,
        toMemberName: clamp(s.toName, 150),
        amount: s.amount,
        currency: clamp(s.currency, 10),
        status: 'unread',
        createdAt: nowIso,
      });
    }
  });

  // 2. General trip-deleted notification for all remaining participating members
  summary.otherMembers.forEach((member, idx) => {
    if (notifiedMemberIdsForDebt.has(member.id)) return;
    const formattedTotal = formatMoney(summary.totalSpent, summary.currency, language);
    notifications.push({
      id: clamp(`unotif_del_info_${safeIdPart(trip.id)}_${safeIdPart(member.id)}_${idx}_${baseStamp}`, 120),
      type: 'trip_deleted',
      tripId: clamp(trip.id, 128),
      tripTitle: safeTripTitle,
      title: clamp(
        isVi ? `Chuyến đi "${safeTripTitle}" đã bị xóa` : `Trip "${safeTripTitle}" was deleted`,
        200
      ),
      message: clamp(
        summary.hasRecordedExpenses
          ? isVi
            ? `Chuyến đi "${safeTripTitle}" (${trip.destination}) đã được ${actorName} xóa. Chuyến đi có ${summary.recordedExpensesCount} khoản chi tiêu (tổng ${formattedTotal}), công nợ của bạn hiện đã cân bằng.`
            : `Trip "${safeTripTitle}" (${trip.destination}) was deleted by ${actorName}. The trip recorded ${summary.recordedExpensesCount} expense(s) totaling ${formattedTotal}; your balance is settled.`
          : isVi
          ? `Chuyến đi "${safeTripTitle}" (${trip.destination}) mà bạn tham gia đã được ${actorName} xóa.`
          : `Trip "${safeTripTitle}" (${trip.destination}) that you joined has been deleted by ${actorName}.`,
        1000
      ),
      actorId,
      actorName,
      targetUid: clamp(member.uid || member.id, 128),
      ...(member.email ? { targetEmail: clamp(member.email.trim().toLowerCase(), 200) } : {}),
      ...(member.phone ? { targetPhone: clamp(member.phone.trim(), 30) } : {}),
      targetMemberName: clamp(member.name, 150),
      status: 'unread',
      createdAt: nowIso,
    });
  });

  return notifications;
}
