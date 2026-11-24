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

export interface MemberFinancialStat {
  member: TripMember;
  contributed: number;
  paidExtra: number;
  used: number;
  remainingBalance: number;
  netSettlementBalance: number;
}

export interface ExpenseFundComputation {
  totalContributed: number;
  totalSpent: number;
  paidByFundTotal: number;
  fundRemaining: number;
  contributorsCount: number;
  fundHolderId: string;
  memberStats: MemberFinancialStat[];
  detailedSettlements: TripSettlementTransfer[];
  simplifiedSettlements: TripSettlementTransfer[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Computes accurate group fund balances and both Detailed and Splitwise-simplified settlements.
 * Accounts for `fundRemaining = totalContributed - paidByFundTotal` physically held by `fundHolderId`
 * so the Treasurer properly refunds remaining pool money to positive-balance members.
 */
export function computeExpenseFundSettlements(trip: Trip): ExpenseFundComputation {
  const currency = trip.currency || 'VND';
  const members = Array.isArray(trip.members) ? trip.members : [];
  const fundHolderId = trip.fundHolderId || members[0]?.id || '';
  const memberById = new Map(members.map((m) => [m.id, m]));

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
      paidBy: exp.paidBy || fundHolderId || 'm1',
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
          paidBy: act.paidBy || fundHolderId || 'm1',
          splitWith: Array.isArray(act.splitWith) && act.splitWith.length > 0 ? act.splitWith : members.map((m) => m.id),
          memberSplits: act.memberSplits,
        });
      }
    });
  });

  const totalContributed = members.reduce((sum, m) => sum + (Number(m.contributedAmount) || 0), 0);
  const totalSpent = unifiedRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const paidByFundTotal = unifiedRecords
    .filter((r) => r.paidBy === 'fund')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const fundRemaining = round2(totalContributed - paidByFundTotal);
  const contributorsCount = members.filter((m) => (Number(m.contributedAmount) || 0) > 0).length;

  const memberStats: MemberFinancialStat[] = members.map((member) => {
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

    const remainingBalance = round2(contributed + paidExtra - used);
    // The Treasurer physically holds `fundRemaining`. Their net settlement balance relative to clearing
    // the trip ledger and distributing idle pool funds is `remainingBalance - fundRemaining`.
    const netSettlementBalance =
      member.id === fundHolderId
        ? round2(remainingBalance - fundRemaining)
        : remainingBalance;

    return {
      member,
      contributed,
      paidExtra: round2(paidExtra),
      used: round2(used),
      remainingBalance,
      netSettlementBalance,
    };
  });

  const makeTransfer = (fromId: string, toId: string, amount: number): TripSettlementTransfer => ({
    fromId,
    fromName: memberById.get(fromId)?.name || fromId,
    toId,
    toName: memberById.get(toId)?.name || toId,
    amount: round2(amount),
    currency,
  });

  // 1. Detailed settlements (non-simplified):
  // - Consumers with negative netSettlementBalance (not Treasurer refunding pool) pay direct payers first,
  //   or reimburse the Treasurer for fund-paid deficit.
  // - If Treasurer still holds excess pool cash (`netSettlementBalance < 0`), Treasurer refunds positive-balance creditors.
  const detailedSettlements: TripSettlementTransfer[] = [];
  {
    const credMap = new Map<string, number>();
    memberStats.forEach((s) => {
      if (s.netSettlementBalance > 0.01) {
        credMap.set(s.member.id, s.netSettlementBalance);
      }
    });

    const consumerDebtors = memberStats
      .filter((s) => s.remainingBalance < -0.01 && s.netSettlementBalance < -0.01)
      .map((s) => ({
        id: s.member.id,
        debtAmount: Math.min(Math.abs(s.remainingBalance), Math.abs(s.netSettlementBalance)),
      }));

    const paidForDebtorByPayer: Record<string, Record<string, number>> = {};
    consumerDebtors.forEach((d) => {
      paidForDebtorByPayer[d.id] = {};
    });

    unifiedRecords.forEach((exp) => {
      const payerId = exp.paidBy === 'fund' ? fundHolderId : exp.paidBy;
      if (!payerId) return;

      consumerDebtors.forEach((d) => {
        if (payerId === d.id) return;
        let shareForD = 0;
        if (exp.memberSplits && exp.memberSplits.length > 0) {
          const ms = exp.memberSplits.find((s) => s.memberId === d.id);
          if (ms) shareForD = Number(ms.amount) || 0;
        } else {
          const beneficiaries = exp.splitWith.length > 0 ? exp.splitWith : members.map((m) => m.id);
          if (beneficiaries.includes(d.id)) {
            shareForD = exp.amount / (beneficiaries.length || 1);
          }
        }
        if (shareForD > 0) {
          paidForDebtorByPayer[d.id][payerId] = (paidForDebtorByPayer[d.id][payerId] || 0) + shareForD;
        }
      });
    });

    let treasurerExtraCashDebt = (() => {
      const thStat = memberStats.find((s) => s.member.id === fundHolderId);
      if (!thStat || thStat.netSettlementBalance >= -0.01) return 0;
      const thConsumerDebt = thStat.remainingBalance < -0.01
        ? Math.min(Math.abs(thStat.remainingBalance), Math.abs(thStat.netSettlementBalance))
        : 0;
      return Math.max(0, round2(Math.abs(thStat.netSettlementBalance) - thConsumerDebt));
    })();

    // Step A: Consumer debtors settle direct expenses + fund share
    consumerDebtors.forEach((d) => {
      let remDebt = d.debtAmount;

      // Prioritize direct personal payers first (excluding group fund collection unless needed)
      const payersForD = Object.entries(paidForDebtorByPayer[d.id] || {})
        .sort(([, a], [, b]) => b - a);

      for (const [payerId, paidAmt] of payersForD) {
        if (remDebt <= 0.01) break;
        const credAvail = credMap.get(payerId) || 0;
        if (credAvail > 0.01) {
          const amt = Math.min(remDebt, paidAmt, credAvail);
          if (amt > 0.01) {
            detailedSettlements.push(makeTransfer(d.id, payerId, amt));
            remDebt = round2(remDebt - amt);
            credMap.set(payerId, round2(credAvail - amt));
          }
        } else if (payerId === fundHolderId && d.id !== fundHolderId && fundHolderId) {
          // Consumer debtor owes the group fund (held by Treasurer), so transfer goes to Treasurer first,
          // which increases Treasurer's pool to refund positive creditors in Step B.
          const amt = Math.min(remDebt, paidAmt);
          if (amt > 0.01) {
            detailedSettlements.push(makeTransfer(d.id, fundHolderId, amt));
            remDebt = round2(remDebt - amt);
            treasurerExtraCashDebt = round2(treasurerExtraCashDebt + amt);
          }
        }
      }

      if (remDebt > 0.01) {
        for (const [credId, credAvail] of credMap.entries()) {
          if (remDebt <= 0.01) break;
          if (credId === d.id || credAvail <= 0.01) continue;
          const amt = Math.min(remDebt, credAvail);
          if (amt > 0.01) {
            detailedSettlements.push(makeTransfer(d.id, credId, amt));
            remDebt = round2(remDebt - amt);
            credMap.set(credId, round2(credAvail - amt));
          }
        }
      }
    });

    // Step B: Treasurer refunds remaining held fund cash to positive-balance members
    if (treasurerExtraCashDebt > 0.01 && fundHolderId) {
      let remRefund = treasurerExtraCashDebt;
      for (const [credId, credAvail] of credMap.entries()) {
        if (remRefund <= 0.01) break;
        if (credId === fundHolderId || credAvail <= 0.01) continue;
        const amt = Math.min(remRefund, credAvail);
        if (amt > 0.01) {
          detailedSettlements.push(makeTransfer(fundHolderId, credId, amt));
          remRefund = round2(remRefund - amt);
          credMap.set(credId, round2(credAvail - amt));
        }
      }
    }
  }

  // 2. Splitwise greedy minimization on `netSettlementBalance` (minimizes total bank transfers)
  const simplifiedSettlements: TripSettlementTransfer[] = [];
  {
    const dList = memberStats
      .filter((s) => s.netSettlementBalance < -0.01)
      .map((s) => ({ id: s.member.id, amount: Math.abs(s.netSettlementBalance) }));
    const cList = memberStats
      .filter((s) => s.netSettlementBalance > 0.01)
      .map((s) => ({ id: s.member.id, amount: s.netSettlementBalance }));

    while (dList.length > 0 && cList.length > 0) {
      dList.sort((a, b) => b.amount - a.amount);
      cList.sort((a, b) => b.amount - a.amount);

      const debtor = dList[0];
      const creditor = cList[0];
      const settleAmt = Math.min(debtor.amount, creditor.amount);

      if (settleAmt > 0.01) {
        simplifiedSettlements.push(makeTransfer(debtor.id, creditor.id, settleAmt));
        debtor.amount = round2(debtor.amount - settleAmt);
        creditor.amount = round2(creditor.amount - settleAmt);
      }

      if (debtor.amount <= 0.01) dList.shift();
      if (creditor.amount <= 0.01) cList.shift();
    }
  }

  return {
    totalContributed,
    totalSpent,
    paidByFundTotal,
    fundRemaining,
    contributorsCount,
    fundHolderId,
    memberStats,
    detailedSettlements,
    simplifiedSettlements,
  };
}

/**
 * Computes recorded expenses and simplified Splitwise-style settlements for a trip,
 * accounting for group fund remaining held by the treasurer.
 */
export function computeTripDeletionSummary(
  trip: Trip,
  actor?: Partial<UserProfile> | null
): TripDeletionSummary {
  const currency = trip.currency || 'VND';
  const members = Array.isArray(trip.members) ? trip.members : [];
  const otherMembers = members.filter((m) => !isMemberMatchingUser(m, actor));
  const computed = computeExpenseFundSettlements(trip);
  const recordedExpensesCount = (trip.expenses || []).length +
    (trip.days || []).reduce(
      (sum, d) => sum + (d.activities || []).filter((a) => a.isCompleted && !(trip.expenses || []).some((e) => e.activityId === a.id)).length,
      0
    );

  return {
    otherMembers,
    totalMembersCount: members.length,
    recordedExpensesCount,
    totalSpent: computed.totalSpent,
    currency,
    settlements: computed.simplifiedSettlements,
    hasOtherMembers: otherMembers.length > 0,
    hasRecordedExpenses: recordedExpensesCount > 0,
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
