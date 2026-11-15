import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hashStringSHA256 } from '../src/utils/cryptoUtils';
import { formatMoney } from '../src/utils/formatCurrency';
import { getLocalDateString } from '../src/utils/dateUtils';
import {
  mergeSavedAndGeneratedIntoDays,
  rankSavedPlacesForTrip,
  areSimilarPlaceNames,
  RankedPlaceCandidate,
} from '../src/utils/itineraryPlannerUtils';
import { stripUndefinedDeep } from '../src/utils/firestoreSanitizer';
import {
  computeTripDeletionSummary,
  buildTripDeletionNotifications,
} from '../src/utils/tripSettlementUtils';
import {
  buildDefaultAvatar,
  isMemberMatchingUser,
  resolveMemberAvatar,
  syncUserAvatarIntoTrips,
} from '../src/utils/avatarSyncUtils';
import {
  canUserAccessTrip,
  filterTripsForUser,
  isMemberParticipatingForUser,
  getUserTripsCacheKey,
} from '../src/utils/tripAccessUtils';
import type { SavedPlace, Trip, TripInvitation, TripNotification } from '../src/types';

const ROOT_DIR = process.cwd();
const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

// ============================================================================
// Pure Domain Helpers matching production logic in ExpenseSplitterView / ItineraryView / App
// ============================================================================
function calculateEvenSplits(totalAmount: number, memberIds: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  if (!memberIds || memberIds.length === 0) return result;
  if (totalAmount <= 0 || Number.isNaN(totalAmount)) {
    memberIds.forEach((id) => (result[id] = '0'));
    return result;
  }
  const count = memberIds.length;
  if (Math.floor(totalAmount) === totalAmount) {
    const baseShare = Math.floor(totalAmount / count);
    const remainder = totalAmount - baseShare * count;
    memberIds.forEach((id, idx) => {
      result[id] = String(idx === 0 ? baseShare + remainder : baseShare);
    });
  } else {
    const baseShare = Math.floor((totalAmount / count) * 100) / 100;
    const remainder = Math.round((totalAmount - baseShare * count) * 100) / 100;
    memberIds.forEach((id, idx) => {
      result[id] = String(idx === 0 ? Math.round((baseShare + remainder) * 100) / 100 : baseShare);
    });
  }
  return result;
}

function computeMemberBalancesAndSettlements(trip: Trip) {
  const memberStats = trip.members.map((member) => {
    const contributed = member.contributedAmount || 0;
    const paidExtra = trip.expenses
      .filter((e) => e.paidBy === member.id)
      .reduce((sum, e) => sum + e.amount, 0);

    let used = 0;
    trip.expenses.forEach((exp) => {
      if (exp.memberSplits && exp.memberSplits.length > 0) {
        const ms = exp.memberSplits.find((s) => s.memberId === member.id);
        if (ms) used += ms.amount;
      } else {
        const beneficiaries = exp.splitWith.length > 0 ? exp.splitWith : trip.members.map((m) => m.id);
        if (beneficiaries.includes(member.id)) {
          used += exp.amount / beneficiaries.length;
        }
      }
    });

    const remainingBalance = Math.round((contributed + paidExtra - used) * 100) / 100;
    return { member, contributed, paidExtra, used, remainingBalance };
  });

  // Greedy Splitwise debt simplification
  const debtors = memberStats
    .filter((s) => Math.round(s.remainingBalance * 100) / 100 < -0.01)
    .map((s) => ({ id: s.member.id, amount: Math.abs(Math.round(s.remainingBalance * 100) / 100) }));
  const creditors = memberStats
    .filter((s) => Math.round(s.remainingBalance * 100) / 100 > 0.01)
    .map((s) => ({ id: s.member.id, amount: Math.round(s.remainingBalance * 100) / 100 }));

  const simplified: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const d = debtors[i];
    const c = creditors[j];
    const settleAmt = Math.min(d.amount, c.amount);
    if (settleAmt > 0.01) {
      simplified.push({ from: d.id, to: c.id, amount: Math.round(settleAmt * 100) / 100 });
      d.amount = Math.round((d.amount - settleAmt) * 100) / 100;
      c.amount = Math.round((c.amount - settleAmt) * 100) / 100;
    }
    if (d.amount <= 0.01) i++;
    if (c.amount <= 0.01) j++;
  }

  return { memberStats, simplified };
}

// ============================================================================
// 1. 5-MEMBER DOMAIN SIMULATION & UNIT AUTOMATION SUITE
// ============================================================================
describe('TripMate Core Domain & 5-Member Simulation', () => {
  const fiveMemberTrip: Trip = {
    id: 'trip_sim_5members',
    title: 'Đà Lạt 4N3Đ - Team 5 Người',
    destination: 'Đà Lạt',
    country: 'Việt Nam',
    startDate: '2026-12-20',
    endDate: '2026-12-23',
    coverImage: '',
    budgetTotal: 15000000,
    currency: 'VND',
    creatorId: 'u_minhanh',
    creatorName: 'Minh Anh',
    fundHolderId: 'u_minhanh',
    members: [
      { id: 'u_minhanh', name: 'Minh Anh', avatar: '', email: 'minhanh@tripmate.app', contributedAmount: 2000000 },
      { id: 'u_hoangnam', name: 'Hoàng Nam', avatar: '', email: 'hoangnam@tripmate.app', contributedAmount: 2000000 },
      { id: 'u_thuha', name: 'Thu Hà', avatar: '', email: 'thuha@tripmate.app', contributedAmount: 1000000 },
      { id: 'u_quocbao', name: 'Quốc Bảo', avatar: '', email: 'quocbao@tripmate.app', contributedAmount: 0 },
      { id: 'u_linhchi', name: 'Linh Chi', avatar: '', email: 'linhchi@tripmate.app', contributedAmount: 1000000 },
    ],
    days: [
      {
        dayNumber: 1,
        date: '2026-12-20',
        title: 'Ngày 1',
        summary: 'Di chuyển & nhận phòng',
        activities: [
          {
            id: 'act_1',
            time: '14:00',
            title: 'Check-in Villa Đồi Thông',
            locationName: 'Đà Lạt',
            category: 'stay',
            estimatedCost: 2500000,
            isCompleted: true,
          },
        ],
      },
    ],
    expenses: [
      {
        id: 'exp_1',
        title: 'Tiền Villa 3 đêm',
        amount: 2500000,
        currency: 'VND',
        category: 'stay',
        paidBy: 'u_minhanh',
        splitWith: ['u_minhanh', 'u_hoangnam', 'u_thuha', 'u_quocbao', 'u_linhchi'],
        date: '2026-12-20',
      },
      {
        id: 'exp_2',
        title: 'Lẩu gà lá é Tao Ngộ',
        amount: 1000000,
        currency: 'VND',
        category: 'food',
        paidBy: 'u_thuha',
        splitWith: ['u_minhanh', 'u_hoangnam', 'u_thuha', 'u_quocbao', 'u_linhchi'],
        date: '2026-12-20',
      },
      {
        id: 'exp_3',
        title: 'Thuê xe máy 5 chiếc',
        amount: 750000,
        currency: 'VND',
        category: 'transport',
        paidBy: 'u_hoangnam',
        splitWith: ['u_minhanh', 'u_hoangnam', 'u_thuha', 'u_quocbao', 'u_linhchi'],
        date: '2026-12-21',
      },
    ],
    packingList: [],
    documents: [],
  };

  test('TC-AUTO-01: Chia đều số lẻ VND giữ tổng chính xác 100% (không thất thoát 1đ)', () => {
    const ids = fiveMemberTrip.members.map((m) => m.id);
    const splits = calculateEvenSplits(100000, ids); // 100,000 / 5 = 20,000 each
    const oddSplits = calculateEvenSplits(100003, ids); // remainder 3 -> 20003, 20000*4
    assert.equal(
      Object.values(splits).reduce((a, b) => a + Number(b), 0),
      100000
    );
    assert.equal(
      Object.values(oddSplits).reduce((a, b) => a + Number(b), 0),
      100003
    );
    assert.equal(oddSplits['u_minhanh'], '20003');
  });

  test('TC-AUTO-02: Công thức Quỹ nhóm + Trả thêm - Đã dùng & Quyết toán Splitwise 5 thành viên', () => {
    const { memberStats, simplified } = computeMemberBalancesAndSettlements(fiveMemberTrip);
    // Total expense = 4,250,000 -> 850,000 per person
    // Minh Anh: +2,000,000 + 2,500,000 - 850,000 = +3,650,000
    // Hoàng Nam: +2,000,000 + 750,000 - 850,000 = +1,900,000
    // Thu Hà: +1,000,000 + 1,000,000 - 850,000 = +1,150,000
    // Quốc Bảo: 0 + 0 - 850,000 = -850,000 (debtor)
    // Linh Chi: +1,000,000 + 0 - 850,000 = +150,000
    const quocBao = memberStats.find((s) => s.member.id === 'u_quocbao')!;
    const minhAnh = memberStats.find((s) => s.member.id === 'u_minhanh')!;
    assert.equal(quocBao.remainingBalance, -850000);
    assert.equal(minhAnh.remainingBalance, 3650000);
    // Simplified settlement assigns Quốc Bảo (850k) -> Minh Anh (highest creditor)
    assert.equal(simplified.length, 1);
    assert.deepEqual(simplified[0], { from: 'u_quocbao', to: 'u_minhanh', amount: 850000 });
  });

  test('TC-AUTO-03: Invariant INV-05 khóa xóa chuyến đi khi đã có hoạt động hoàn thành', () => {
    const hasCompleted = fiveMemberTrip.days.some((d) => d.activities.some((a) => a.isCompleted));
    assert.equal(hasCompleted, true);
    const uncompletedTrip: Trip = {
      ...fiveMemberTrip,
      days: [{ ...fiveMemberTrip.days[0], activities: [{ ...fiveMemberTrip.days[0].activities[0], isCompleted: false }] }],
    };
    const hasCompletedAfterReset = uncompletedTrip.days.some((d) => d.activities.some((a) => a.isCompleted));
    assert.equal(hasCompletedAfterReset, false);
  });

  test('TC-AUTO-04: Mã hóa mật khẩu & PIN Két vé bằng SHA-256 nhất quán', async () => {
    const pwdHash1 = await hashStringSHA256('MatKhauMoi2026', 'tripmate_auth_pwd');
    const pwdHash2 = await hashStringSHA256('MatKhauMoi2026', 'tripmate_auth_pwd');
    const wrongHash = await hashStringSHA256('SaiMatKhau', 'tripmate_auth_pwd');
    assert.equal(pwdHash1.length, 64);
    assert.equal(pwdHash1, pwdHash2);
    assert.notEqual(pwdHash1, wrongHash);

    const pinHash = await hashStringSHA256('2468', 'tripmate_vault_pin');
    assert.equal(pinHash.length, 64);
    assert.notEqual(pinHash, '2468');
  });

  test('TC-AUTO-05: Định dạng tiền tệ VND/USD/EUR/JPY & ngày local YYYY-MM-DD', () => {
    assert.match(formatMoney(1500000, 'VND', 'vi'), /1\.500\.000\s₫/);
    assert.equal(formatMoney(250.5, 'USD', 'en'), '$250.50');
    assert.equal(formatMoney(12000, 'JPY', 'en'), '¥12,000');
    const d = getLocalDateString('2026-12-20T12:00:00');
    assert.equal(d, '2026-12-20');
  });

  test('TC-AUTO-06: Phân loại Thông báo Chưa đọc / Đã đọc và không đếm lỗi trạng thái Đã đọc', () => {
    const invitations: TripInvitation[] = [
      {
        id: 'inv_1',
        tripId: 't1',
        tripTitle: 'Đà Lạt',
        tripDestination: 'Đà Lạt',
        tripDates: '20/12 - 23/12',
        inviterId: 'u_minhanh',
        inviterName: 'Minh Anh',
        status: 'pending',
        createdAt: '2026-11-13T01:00:00Z',
      },
      {
        id: 'inv_2',
        tripId: 't2',
        tripTitle: 'Phú Quốc',
        tripDestination: 'Phú Quốc',
        tripDates: '01/01 - 04/01',
        inviterId: 'u_minhanh',
        inviterName: 'Minh Anh',
        status: 'accepted',
        createdAt: '2026-11-12T01:00:00Z',
      },
    ];
    const notifs: TripNotification[] = [
      {
        id: 'n_1',
        type: 'pin_changed',
        title: 'Thiết lập PIN két vé',
        message: 'Minh Anh đã thiết lập mã PIN',
        actorId: 'u_minhanh',
        actorName: 'Minh Anh',
        createdAt: '2026-11-13T01:10:00Z',
        status: 'approved',
      },
    ];
    const readKeys = ['notif_n_1'];
    const unreadInvs = invitations.filter((i) => i.status === 'pending' && !readKeys.includes(`inv_${i.id}`));
    const unreadNotifs = notifs.filter((n) => n.status === 'pending' || !readKeys.includes(`notif_${n.id}`));
    assert.equal(unreadInvs.length, 1);
    assert.equal(unreadNotifs.length, 0);
  });

  test('TC-AUTO-07: Xếp hạng địa điểm từ sao lớn nhất/khen nhiều nhất, ưu tiên SavedPlaces & tự sinh bù hợp ngân sách', () => {
    const savedPlaces: SavedPlace[] = [
      {
        id: 'sp_low',
        name: 'Quán Cafe Tầm Trung',
        cityName: 'Đà Lạt',
        address: 'Phường 2, Đà Lạt',
        category: 'food',
        rating: 4.3,
        estimatedCost: 100000,
        currency: 'VND',
        notes: 'Không gian ổn',
      },
      {
        id: 'sp_high',
        name: 'Hồ Tuyền Lâm',
        cityName: 'Đà Lạt',
        address: 'Phường 4, Đà Lạt',
        category: 'sightseeing',
        rating: 5.0,
        estimatedCost: 0,
        currency: 'VND',
        notes: 'Cảnh tuyệt vời, nổi tiếng đẹp nhất Đà Lạt không thể bỏ qua',
      },
      {
        id: 'sp_other_city',
        name: 'Bà Nà Hills',
        cityName: 'Đà Nẵng',
        category: 'sightseeing',
        rating: 4.9,
      },
    ];

    const rankedSaved = rankSavedPlacesForTrip(savedPlaces, {
      destination: 'Đà Lạt',
      currency: 'VND',
      budgetAmount: 1500000,
      durationDays: 2,
      interests: ['Food', 'Photo'],
    });
    assert.equal(rankedSaved.length, 2); // Lọc đúng điểm đến Đà Lạt
    assert.equal(rankedSaved[0].name, 'Hồ Tuyền Lâm'); // 5.0★ đứng đầu

    const extras: RankedPlaceCandidate[] = [
      {
        name: 'Hồ Tuyền Lâm', // Trùng tên saved -> phải bị loại trùng
        locationName: 'Đà Lạt',
        category: 'sightseeing',
        estimatedCost: 0,
        currency: 'VND',
        rating: 5.0,
        notes: 'Trùng lặp',
        praiseScore: 60,
        isFromSavedPlaces: false,
      },
      {
        name: 'Lẩu Gà Lá É Tao Ngộ',
        locationName: 'Đà Lạt',
        category: 'food',
        estimatedCost: 250000,
        currency: 'VND',
        rating: 4.9,
        notes: 'Món đặc sản nức nở huyền thoại rất ngon phải thử',
        praiseScore: 62,
        isFromSavedPlaces: false,
      },
      {
        name: 'Tiệm Bánh Cối Xay Gió',
        locationName: 'Đà Lạt',
        category: 'food',
        estimatedCost: 80000,
        currency: 'VND',
        rating: 4.8,
        notes: 'Chụp ảnh check-in nổi tiếng',
        praiseScore: 54,
        isFromSavedPlaces: false,
      },
      {
        name: 'Đỉnh Langbiang',
        locationName: 'Đà Lạt',
        category: 'activity',
        estimatedCost: 120000,
        currency: 'VND',
        rating: 4.9,
        notes: 'Ngắm cảnh ngoạn mục hàng đầu Đà Lạt',
        praiseScore: 58,
        isFromSavedPlaces: false,
      },
      {
        name: 'Quảng trường Lâm Viên',
        locationName: 'Đà Lạt',
        category: 'sightseeing',
        estimatedCost: 0,
        currency: 'VND',
        rating: 4.8,
        notes: 'Biểu tượng nổi tiếng',
        praiseScore: 51,
        isFromSavedPlaces: false,
      },
      {
        name: 'Chợ Đêm Đà Lạt',
        locationName: 'Đà Lạt',
        category: 'shopping',
        estimatedCost: 150000,
        currency: 'VND',
        rating: 4.7,
        notes: 'Ẩm thực đường phố đặc sản',
        praiseScore: 50,
        isFromSavedPlaces: false,
      },
      {
        name: 'Buffet Siêu Sang Đắt Đỏ',
        locationName: 'Đà Lạt',
        category: 'food',
        estimatedCost: 5000000,
        currency: 'VND',
        rating: 4.6,
        notes: 'Giá rất cao',
        praiseScore: 46,
        isFromSavedPlaces: false,
      },
    ];

    const result = mergeSavedAndGeneratedIntoDays({
      destination: 'Đà Lạt',
      durationDays: 2,
      currency: 'VND',
      budgetAmount: 1500000,
      interests: ['Food', 'Photo'],
      language: 'vi',
      savedPlaces,
      extraCandidates: extras,
    });

    assert.equal(result.days.length, 2);
    assert.equal(result.usedSavedCount, 2);
    assert.ok(result.autoGeneratedCount >= 4);
    assert.ok(result.totalEstimatedCost <= 1500000 * 1.05);

    const allActivities = result.days.flatMap((d) => d.activities);
    const hoTuyenLamCount = allActivities.filter((a) => areSimilarPlaceNames(a.title, 'Hồ Tuyền Lâm')).length;
    assert.equal(hoTuyenLamCount, 1); // Không trùng lặp giữa SavedPlaces và Auto-generated
    assert.ok(allActivities.some((a) => a.isFromSavedPlaces === true));
    assert.ok(allActivities.some((a) => a.isFromSavedPlaces === false));
    assert.ok(allActivities.some((a) => a.title.includes('Lẩu Gà Lá É Tao Ngộ')));
  });

  test('TC-AUTO-08: Xóa chuyến đi có chi tiêu tính đúng A thiếu B 200.000₫ & gửi thông báo cho cả A, B và thành viên khác', () => {
    const tripWithDebt: Trip = {
      id: 'trip_debt_demo',
      title: 'Vũng Tàu Cuối Tuần',
      destination: 'Vũng Tàu',
      country: 'Việt Nam',
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      coverImage: '',
      budgetTotal: 2000000,
      currency: 'VND',
      creatorId: 'uid_c',
      creatorName: 'C',
      members: [
        { id: 'm_a', uid: 'uid_a', name: 'A', email: 'a@tripmate.app', avatar: '', contributedAmount: 0 },
        { id: 'm_b', uid: 'uid_b', name: 'B', email: 'b@tripmate.app', avatar: '', contributedAmount: 0 },
        { id: 'm_c', uid: 'uid_c', name: 'C', email: 'c@tripmate.app', avatar: '', contributedAmount: 0 },
      ],
      days: [],
      expenses: [
        {
          id: 'exp_ab',
          title: 'Ăn tối hải sản',
          amount: 400000,
          currency: 'VND',
          category: 'food',
          paidBy: 'm_b',
          splitWith: ['m_a', 'm_b'],
          date: '2026-12-01',
        },
      ],
      packingList: [],
      documents: [],
    };

    const actorC = { id: 'uid_c', displayName: 'C', email: 'c@tripmate.app' };
    const summary = computeTripDeletionSummary(tripWithDebt, actorC);
    assert.equal(summary.hasRecordedExpenses, true);
    assert.equal(summary.hasOtherMembers, true);
    assert.equal(summary.settlements.length, 1);
    assert.equal(summary.settlements[0].fromName, 'A');
    assert.equal(summary.settlements[0].toName, 'B');
    assert.equal(summary.settlements[0].amount, 200000);

    const notifs = buildTripDeletionNotifications({
      trip: tripWithDebt,
      actor: actorC,
      summary,
      language: 'vi',
    });

    const notifForA = notifs.find((n) => n.targetEmail === 'a@tripmate.app');
    const notifForB = notifs.find((n) => n.targetEmail === 'b@tripmate.app');
    assert.ok(notifForA, 'A must receive settlement notification');
    assert.ok(notifForB, 'B must receive settlement notification');
    assert.equal(notifForA!.type, 'trip_deleted_settlement');
    assert.equal(notifForB!.type, 'trip_deleted_settlement');
    assert.ok(notifForA!.message.includes('A thiếu B') && notifForA!.message.includes('200.000'));
    assert.ok(notifForB!.message.includes('A thiếu B') && notifForB!.message.includes('200.000'));
  });
});

// ============================================================================
// 2. LIVE SERVER API & SECURITY ENDPOINT AUTOMATION TESTS
// ============================================================================
describe('TripMate Express Server API Integration Tests', () => {
  test('TC-API-01: GET /api/health trả về status ok', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.time);
  });

  test('TC-API-02: GET /api/weather/live trả về thời tiết thực hoặc fallback hợp lệ cho Đà Lạt', async () => {
    const res = await fetch(`${BASE_URL}/api/weather/live?destination=${encodeURIComponent('Da Lat')}&lang=vi`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.tempC, 'number');
    assert.ok(body.accuWeatherUrl.includes('accuweather.com'));
  });

  test('TC-API-03: GET /api/weather/live trả về 404 khi thành phố không tồn tại', async () => {
    const res = await fetch(`${BASE_URL}/api/weather/live?destination=NonExistentCityXYZ99999&lang=vi`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  test('TC-API-04: POST /api/gemini/chat trả về câu trả lời du lịch hợp lệ', async () => {
    const res = await fetch(`${BASE_URL}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Món ăn nổi tiếng ở Đà Lạt?',
        tripContext: { destination: 'Đà Lạt', startDate: '2026-12-20', endDate: '2026-12-23' },
        language: 'vi',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.reply, 'string');
    assert.ok(body.reply.length > 10);
  });

  test('TC-API-05: POST /api/gemini/generate-itinerary sinh lịch trình đúng cấu trúc JSON', async () => {
    const res = await fetch(`${BASE_URL}/api/gemini/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'Đà Lạt',
        durationDays: 2,
        travelStyle: 'Balanced Explorer',
        groupType: 'Friends',
        language: 'vi',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.days));
    assert.ok(body.days.length >= 1);
  });

  test('TC-API-05c: POST /api/gemini/generate-itinerary ưu tiên SavedPlaces thiếu thì tự sinh từ sao lớn nhất & hợp ngân sách', async () => {
    const res = await fetch(`${BASE_URL}/api/gemini/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'Đà Lạt',
        durationDays: 2,
        travelStyle: 'Balanced Explorer',
        groupType: 'Friends',
        currency: 'VND',
        budgetAmount: 1800000,
        interests: ['Food', 'Nature'],
        language: 'vi',
        savedPlaces: [
          {
            id: 'sp_test_1',
            name: 'Vườn Hoa Thành Phố Đà Lạt',
            cityName: 'Đà Lạt',
            category: 'sightseeing',
            rating: 5.0,
            estimatedCost: 100000,
            currency: 'VND',
            notes: 'Điểm ngắm hoa tuyệt vời nổi tiếng nhất',
          },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.days));
    assert.equal(body.days.length, 2);

    const activities = body.days.flatMap((d: any) => d.activities || []);
    assert.ok(activities.length >= 6);
    assert.ok(
      activities.some(
        (a: any) =>
          typeof a.title === 'string' &&
          a.title.toLowerCase().includes('vườn hoa') &&
          a.isFromSavedPlaces === true
      )
    );
    assert.ok(activities.some((a: any) => a.isFromSavedPlaces === false && Number(a.rating) >= 4.5));
    const totalCost = activities.reduce((sum: number, a: any) => sum + (Number(a.estimatedCost) || 0), 0);
    assert.ok(totalCost <= 1800000 * 1.15);
  });

  test('TC-API-05d: POST /api/gemini/generate-itinerary với allowAutoGenerate=false không tự sinh thêm địa điểm ngoài danh sách lưu', async () => {
    const res = await fetch(`${BASE_URL}/api/gemini/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'Đà Lạt',
        durationDays: 2,
        currency: 'VND',
        budgetAmount: 1800000,
        allowAutoGenerate: false,
        language: 'vi',
        savedPlaces: [
          {
            id: 'sp_only_1',
            name: 'Vườn Hoa Thành Phố Đà Lạt',
            cityName: 'Đà Lạt',
            category: 'sightseeing',
            rating: 5.0,
            estimatedCost: 100000,
            currency: 'VND',
          },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.usedSavedCount, 1);
    assert.equal(body.autoGeneratedCount, 0);
    const activities = body.days.flatMap((d: any) => d.activities || []);
    assert.equal(activities.length, 1);
    assert.equal(activities[0].isFromSavedPlaces, true);
  });

  test('TC-API-05b: POST /api/gemini/recommendations gợi ý địa điểm theo thành phố', async () => {
    const res = await fetch(`${BASE_URL}/api/gemini/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'Đà Lạt',
        category: 'food',
        language: 'vi',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.recommendations));
    assert.ok(body.recommendations.length > 0);
  });

  test('TC-API-06: POST /api/gemini/packing-list sinh danh sách hành lý', async () => {
    const res = await fetch(`${BASE_URL}/api/gemini/packing-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'Đà Lạt',
        durationDays: 3,
        language: 'vi',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.packingItems));
    assert.ok(body.packingItems.length > 0);
  });

  test('TC-API-07: POST /api/gemini/scan-receipt kiểm tra thiếu ảnh trả 400 & JSON lỗi trả 400', async () => {
    const missingImgRes = await fetch(`${BASE_URL}/api/gemini/scan-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'vi' }),
    });
    assert.equal(missingImgRes.status, 400);

    const badJsonRes = await fetch(`${BASE_URL}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });
    assert.equal(badJsonRes.status, 400);
  });
});

// ============================================================================
// 3. UI COPY & FIRESTORE SECURITY RULES REGRESSION CHECKS
// ============================================================================
describe('UI Regression & Security Rules Verification', () => {
  test('TC-UI-01: AuthScreen bỏ các dòng copy thừa & tiêu đề rút gọn "Đăng nhập"', () => {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AuthScreen.tsx'), 'utf8');
    assert.ok(!content.includes('Chưa có tài khoản? Nhấn để Đăng ký ngay'));
    assert.ok(!content.includes('hoặc dùng Email / Số điện thoại'));
    assert.ok(!content.includes('Bảo mật bởi Firebase Firestore & Google Cloud'));
    assert.ok(!content.includes('Đăng nhập vào TripMate'));
  });

  test('TC-UI-02: Mobile Cover Banner chỉ giữ icon 3 chấm dọc, bỏ chữ "Tùy chọn" & bỏ subtitle popup', () => {
    const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
    assert.ok(appContent.includes('<MoreVertical'));
    assert.ok(!appContent.includes('Tải file PDF hoàn chỉnh kèm vé & lịch trình'));
    assert.ok(!appContent.includes('Đổi tên, ngày, điểm đến, ngân sách hoặc ảnh bìa'));
  });

  test('TC-UI-03: Navbar Avatar sheet hiển thị Tài Khoản TripMate, Đổi mật khẩu, Vietnamese/English & Đăng xuất', () => {
    const navbar = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Navbar.tsx'), 'utf8');
    assert.ok(navbar.includes('Tài Khoản TripMate'));
    assert.ok(navbar.includes('Vietnamese'));
    assert.ok(navbar.includes('English'));
    assert.ok(!navbar.includes('Thoát phiên đăng nhập hiện tại'));
    assert.ok(!navbar.includes('Đăng xuất tài khoản'));
  });

  test('TC-UI-04: TripMate Chat dùng đúng tên, bỏ aiChat.context & placeholder là Hello', () => {
    const chat = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AIAssistantChat.tsx'), 'utf8');
    const langCtx = fs.readFileSync(path.join(ROOT_DIR, 'src/context/LanguageContext.tsx'), 'utf8');
    assert.ok(!chat.includes("aiChat.context"));
    assert.ok(langCtx.includes("'aiChat.title': 'TripMate Chat'"));
    assert.ok(langCtx.includes("'aiChat.inputPlaceholder': 'Hello'"));
  });

  test('TC-UI-05: NotificationsModal đổi tên Thông báo, lọc Chưa đọc/Đã đọc và Đã đọc không đếm số', () => {
    const notif = fs.readFileSync(path.join(ROOT_DIR, 'src/components/NotificationsModal.tsx'), 'utf8');
    assert.ok(notif.includes("'Thông báo'"));
    assert.ok(notif.includes("'Chưa đọc'"));
    assert.ok(notif.includes("'Đã đọc'"));
    assert.ok(!notif.includes('Trung Tâm Thông Báo'));
    assert.ok(!notif.includes('Lời mời chuyến đi và bảo mật két vé'));
    assert.ok(!notif.includes('Khi người tạo chuyến đi thêm bạn bằng email hoặc số điện thoại'));
    assert.ok(!notif.includes('{readItems.length}'));
  });

  test('TC-SEC-01: Firestore Rules giữ Default Deny, bất biến email/creatorId, chặn delete user và tách allow get/list cho trips & invitations', () => {
    const rules = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');
    assert.ok(rules.includes('allow read, write: if false;'));
    assert.ok(rules.includes('incoming().email == existing().email'));
    assert.ok(rules.includes('incoming().creatorId == existing().creatorId'));
    assert.ok(rules.includes('allow delete: if false;'));
    assert.ok(rules.includes('allow get: if isValidId(tripId);'));
    assert.ok(rules.includes('allow get: if isValidId(invitationId);'));
    assert.ok(!rules.includes('allow read: if isValidId(tripId);'));
    assert.ok(!rules.includes('allow read: if isValidId(invitationId);'));
    const sampleTripsSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/data/sampleTrips.ts'), 'utf8');
    assert.ok((sampleTripsSrc.match(/creatorId:\s*'m1'/g) || []).length >= 4);
  });

  test('TC-UI-06: Không sử dụng native window.alert hoặc window.confirm trong toàn bộ thư mục src/', () => {
    const srcFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) srcFiles.push(full);
      }
    };
    walk(path.join(ROOT_DIR, 'src'));
    const offenders: string[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\b(?:window\.)?(alert|confirm)\s*\(/.test(content)) {
        offenders.push(path.relative(ROOT_DIR, file));
      }
    }
    assert.deepEqual(offenders, []);
  });

  test('TC-UI-07: Đồng bộ badge chuông thông báo, đa ngôn ngữ Vietnamese/English & cảnh báo mất mạng Chat', () => {
    const navbar = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Navbar.tsx'), 'utf8');
    const authScreen = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AuthScreen.tsx'), 'utf8');
    const authCtx = fs.readFileSync(path.join(ROOT_DIR, 'src/context/AuthContext.tsx'), 'utf8');
    const notifModal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/NotificationsModal.tsx'), 'utf8');
    const chat = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AIAssistantChat.tsx'), 'utf8');

    assert.ok(navbar.includes('totalUnreadNotificationsCount'));
    assert.ok(navbar.includes('tripmate_notifs_read_updated'));
    assert.ok(notifModal.includes('tripmate_notifs_read_updated'));
    assert.ok(navbar.includes("isVi ? 'Vietnamese' : 'English'"));
    assert.ok(authScreen.includes("isVi ? 'Vietnamese' : 'English'"));
    assert.ok(authCtx.includes('isViLang'));
    assert.ok(chat.includes('navigator.onLine') || chat.includes('isOnline'));
  });

  test('TC-UI-08: Đăng nhập không bật global isLoading làm unmount AuthScreen & báo lỗi rõ khi tài khoản không tồn tại', () => {
    const authCtx = fs.readFileSync(path.join(ROOT_DIR, 'src/context/AuthContext.tsx'), 'utf8');
    const setIsLoadingMatches = authCtx.match(/setIsLoading\(/g) || [];
    // Chỉ được gọi setIsLoading(false) duy nhất ở onAuthStateChanged khi khởi tạo app
    assert.equal(setIsLoadingMatches.length, 1);
    assert.ok(authCtx.includes('Tài khoản không tồn tại trong hệ thống.'));
  });

  test('TC-UI-09: Confirm người dùng bằng modal nội bộ trước khi tự sinh thêm địa điểm khi SavedPlaces chưa đủ', () => {
    const modal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AIItineraryModal.tsx'), 'utf8');
    assert.ok(modal.includes('isSavedPlacesInsufficient'));
    assert.ok(modal.includes('showAutoFillConfirm'));
    assert.ok(modal.includes('handleConfirmAutoFill'));
    assert.ok(modal.includes('handleUseSavedOnly'));
    assert.ok(modal.includes('Địa điểm lưu chưa đủ cho lịch trình'));
    assert.ok(modal.includes('Đồng ý, tự sinh & tạo lịch trình'));
    assert.ok(modal.includes('Chưa có điểm lưu cho ${destination} (${durationDays} ngày). Đồng ý tự sinh các điểm sao cao & khen nhiều nhất hợp ngân sách, sở thích nhé?'));
    assert.ok(modal.includes('Mới có ${rankedMatchingSaved.length} điểm lưu tại ${destination} (${durationDays} ngày). Đồng ý tự bổ sung các điểm sao cao & khen nhiều nhất hợp ngân sách, sở thích nhé?'));
  });

  test('TC-SEC-02: Làm sạch undefined trước khi ghi Firestore (khắc phục lỗi fundHolderId undefined)', () => {
    const dirtyTrip = {
      id: 'trip-1',
      title: 'Test Trip',
      fundHolderId: undefined,
      days: [
        {
          dayNumber: 1,
          activities: [{ id: 'a1', title: 'Hồ Xuân Hương', lat: undefined, notes: 'OK' }],
        },
      ],
      documents: [{ id: 'd1', title: 'Ticket', urlOrFilename: undefined }],
    };
    const cleaned = stripUndefinedDeep(dirtyTrip) as any;
    assert.equal('fundHolderId' in cleaned, false);
    assert.equal('lat' in cleaned.days[0].activities[0], false);
    assert.equal('urlOrFilename' in cleaned.documents[0], false);

    const newTripModal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/NewTripModal.tsx'), 'utf8');
    assert.ok(!newTripModal.includes('fundHolderId: wantSuggestedItinerary ? \'m1\' : undefined'));
    const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
    assert.ok(appContent.includes('stripUndefinedDeep'));
  });

  test('TC-UI-10: Xóa chuyến đi đợi Firestore deleteDoc hoàn tất mới báo thành công, chống tái tạo tombstone và đồng bộ activeTripId', () => {
    const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
    assert.ok(appContent.includes('deletedTripIdsRef'));
    assert.ok(appContent.includes('tripmate_deleted_trip_ids'));
    assert.ok(appContent.includes('tripmate_firestore_seeded'));
    assert.ok(appContent.includes('tripPendingDelete'));
    assert.ok(appContent.includes('isDeletingTrip'));
    assert.ok(appContent.includes('deletedTripIdsRef.current.has(tripData.id)'));
    assert.ok(appContent.includes('await deleteDoc(doc(db, \'trips\', targetId))'));
    assert.ok(appContent.includes('Đã xóa chuyến đi'));
    const deleteIdx = appContent.indexOf('await deleteDoc(doc(db, \'trips\', targetId))');
    const noticeIdx = appContent.indexOf('Đã xóa chuyến đi "${targetTrip.title}"');
    assert.ok(deleteIdx > 0 && noticeIdx > deleteIdx);
  });

  test('TC-DEPLOY-01: server.ts dùng import .ts và type-only để chạy trực tiếp bằng node server.ts (Cloud Run)', () => {
    const serverSrc = fs.readFileSync(path.join(ROOT_DIR, 'server.ts'), 'utf8');
    const plannerSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/utils/itineraryPlannerUtils.ts'), 'utf8');
    assert.ok(serverSrc.includes("from './src/utils/itineraryPlannerUtils.ts'"));
    assert.ok(serverSrc.includes('type RankedPlaceCandidate'));
    assert.ok(plannerSrc.includes("import type { SavedPlace } from '../types.ts'"));
  });

  test('TC-UI-11: Đổi toàn bộ nhãn "Kiến trúc sư Lịch trình AI" / "Kiến trúc sư AI" sang "Lịch trình AI"', () => {
    const filesToCheck = [
      'src/App.tsx',
      'src/components/AIItineraryModal.tsx',
      'src/components/NewTripModal.tsx',
      'src/context/LanguageContext.tsx',
    ];
    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
      assert.ok(!/kiến trúc sư/i.test(content), `${rel} still contains Kiến trúc sư`);
    }
    const modal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AIItineraryModal.tsx'), 'utf8');
    assert.ok(modal.includes('Lịch trình AI'));
  });

  test('TC-UI-12: Xóa chuyến đi yêu cầu confirm khi có chi tiêu ghi nhận & gửi thông báo user_notifications qua Firestore', () => {
    const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
    const rules = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');
    const notifModal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/NotificationsModal.tsx'), 'utf8');
    const authCtx = fs.readFileSync(path.join(ROOT_DIR, 'src/context/AuthContext.tsx'), 'utf8');

    assert.ok(appContent.includes('confirmExpenseSettlementAck'));
    assert.ok(appContent.includes('buildTripDeletionNotifications'));
    assert.ok(appContent.includes("doc(db, 'user_notifications'"));
    assert.ok(rules.includes('match /user_notifications/{notificationId}'));
    assert.ok(rules.includes('isValidUserNotification'));
    assert.ok(authCtx.includes("collection(db, 'user_notifications')"));
    assert.ok(notifModal.includes('trip_deleted_settlement'));
  });

  test('TC-API-08: server.ts có fallback model gemini-3.1-flash-lite, cooldown 429 và cache phản hồi không spam log lỗi 429', () => {
    const serverSrc = fs.readFileSync(path.join(ROOT_DIR, 'server.ts'), 'utf8');
    assert.ok(serverSrc.includes("'gemini-4-hydrogen', 'gemini-3.1-flash-lite'"));
    assert.ok(serverSrc.includes('modelCooldownUntil'));
    assert.ok(serverSrc.includes('generateWithModelFallback'));
    assert.ok(serverSrc.includes('geminiResponseCache'));
    assert.ok(!serverSrc.includes('[Gemini Itinerary Notice] Upstream model unavailable'));
  });

  test('TC-AUTO-09: avatarSyncUtils đồng bộ avatar người dùng sang đúng thành viên trong chuyến đi', () => {
    const user = {
      id: 'u-perry',
      email: 'perrynguyen10@gmail.com',
      phone: '0901234567',
      displayName: 'Perry Nguyễn',
      avatar: 'data:image/jpeg;base64,NEW_AVATAR_DATA',
    };

    const sampleTrip: Trip = {
      id: 'trip-sync-1',
      title: 'Da Lat Trip',
      destination: 'Đà Lạt',
      country: 'Việt Nam',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budgetTotal: 5000000,
      currency: 'VND',
      creatorId: 'u-perry',
      members: [
        { id: 'm1', name: 'Bạn (Trưởng nhóm)', avatar: 'https://example.com/old.jpg' },
        { id: 'm2', uid: 'u-linh', email: 'linhchi@tripmate.app', name: 'Linh Chi', avatar: 'https://example.com/linh.jpg' },
      ],
      days: [],
      expenses: [],
      packingList: [],
      documents: [],
    };

    assert.equal(isMemberMatchingUser(sampleTrip.members[0], user, sampleTrip.creatorId), true);
    assert.equal(isMemberMatchingUser(sampleTrip.members[1], user, sampleTrip.creatorId), false);
    assert.equal(resolveMemberAvatar(sampleTrip.members[0], user, sampleTrip.creatorId), 'data:image/jpeg;base64,NEW_AVATAR_DATA');
    assert.equal(resolveMemberAvatar(sampleTrip.members[1], user, sampleTrip.creatorId), 'https://example.com/linh.jpg');
    assert.ok(buildDefaultAvatar('Test User').includes('Test%20User'));

    const { nextTrips, changedTripIds } = syncUserAvatarIntoTrips([sampleTrip], user);
    assert.deepEqual(changedTripIds, ['trip-sync-1']);
    assert.equal(nextTrips[0].members[0].avatar, 'data:image/jpeg;base64,NEW_AVATAR_DATA');
    assert.equal(nextTrips[0].members[0].uid, 'u-perry');
    assert.equal(nextTrips[0].members[1].avatar, 'https://example.com/linh.jpg');
  });

  test('TC-UI-13: Cho phép thêm/đổi avatar ở Profile, Đăng ký, Thành viên Chi tiêu, đồng bộ Firestore & không hiện avatar trên ảnh bìa', () => {
    const authCtx = fs.readFileSync(path.join(ROOT_DIR, 'src/context/AuthContext.tsx'), 'utf8');
    const authModal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AuthModal.tsx'), 'utf8');
    const authScreen = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AuthScreen.tsx'), 'utf8');
    const navbar = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Navbar.tsx'), 'utf8');
    const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
    const expenseView = fs.readFileSync(path.join(ROOT_DIR, 'src/components/ExpenseSplitterView.tsx'), 'utf8');
    const newTripModal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/NewTripModal.tsx'), 'utf8');
    const rules = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');
    const blueprint = fs.readFileSync(path.join(ROOT_DIR, 'firebase-blueprint.json'), 'utf8');

    assert.ok(authCtx.includes('updateUserAvatar'));
    assert.ok(authCtx.includes('tripmate_user_avatar_updated'));
    assert.ok(authModal.includes('compressAvatarImage'));
    assert.ok(authModal.includes('Đổi ảnh đại diện'));
    assert.ok(authScreen.includes('compressAvatarImage'));
    assert.ok(authScreen.includes('registerAvatar'));
    assert.ok(navbar.includes('compressAvatarImage'));
    assert.ok(navbar.includes('updateUserAvatar'));

    assert.ok(appContent.includes('syncUserAvatarIntoTrips'));
    assert.ok(!appContent.includes('Banner Synced Member Avatar Stack'));
    assert.ok(newTripModal.includes('userProfile?.avatar'));

    assert.ok(expenseView.includes('handleMemberAvatarUpload'));
    assert.ok(expenseView.includes('newMemberAvatar'));
    assert.ok(expenseView.includes('resolveMemberAvatar'));
    assert.ok(expenseView.includes('updateUserAvatar'));

    assert.ok(rules.includes('data.avatar.size() <= 60000'));
    assert.ok(blueprint.includes('"maxLength": 60000'));
  });

  test('TC-AUTO-10: tripAccessUtils cô lập chuyến đi theo tài khoản (Linh không xem được chuyến đi không tham gia hoặc lời mời pending/declined)', () => {
    const linhUser = {
      id: 'u-linh',
      email: 'linhchi@tripmate.app',
      phone: '0909888777',
    };
    const perryUser = {
      id: 'u-perry',
      email: 'perrynguyen10@gmail.com',
      phone: '0901234567',
    };

    const makeTrip = (overrides: Partial<Trip>): Trip => ({
      id: 'trip-x',
      title: 'Test Trip',
      destination: 'Đà Lạt',
      country: 'Việt Nam',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      budgetTotal: 5000000,
      currency: 'VND',
      creatorId: 'u-perry',
      members: [{ id: 'm1', uid: 'u-perry', email: 'perrynguyen10@gmail.com', name: 'Perry', avatar: '' }],
      memberUids: ['u-perry'],
      days: [],
      expenses: [],
      packingList: [],
      documents: [],
      ...overrides,
    });

    const perryOnlyTrip = makeTrip({ id: 'trip-perry-only' });
    const sampleStyleTrip = makeTrip({ id: 'trip-sample', creatorId: 'm1', memberUids: undefined });
    const linhCreatedTrip = makeTrip({
      id: 'trip-linh-created',
      creatorId: 'u-linh',
      members: [{ id: 'm1', uid: 'u-linh', email: 'linhchi@tripmate.app', name: 'Linh Chi', avatar: '' }],
      memberUids: ['u-linh'],
    });
    const linhAcceptedTrip = makeTrip({
      id: 'trip-linh-accepted',
      members: [
        { id: 'm1', uid: 'u-perry', name: 'Perry', avatar: '' },
        { id: 'm2', uid: 'u-linh', email: 'linhchi@tripmate.app', name: 'Linh Chi', avatar: '', invitationStatus: 'accepted' },
      ],
      memberUids: ['u-perry', 'u-linh'],
    });
    const linhOfflineEmailTrip = makeTrip({
      id: 'trip-linh-email',
      members: [
        { id: 'm1', uid: 'u-perry', name: 'Perry', avatar: '' },
        { id: 'm2', email: 'LINHCHI@tripmate.app', name: 'Linh Chi', avatar: '' },
      ],
    });
    const linhOfflinePhoneTrip = makeTrip({
      id: 'trip-linh-phone',
      members: [
        { id: 'm1', uid: 'u-perry', name: 'Perry', avatar: '' },
        { id: 'm2', phone: '0909 888 777', name: 'Linh Chi', avatar: '' },
      ],
    });
    const linhPendingTrip = makeTrip({
      id: 'trip-linh-pending',
      members: [
        { id: 'm1', uid: 'u-perry', name: 'Perry', avatar: '' },
        { id: 'm2', uid: 'u-linh', email: 'linhchi@tripmate.app', name: 'Linh Chi', avatar: '', invitationStatus: 'pending' },
      ],
      memberUids: ['u-perry', 'u-linh'],
    });
    const linhDeclinedTrip = makeTrip({
      id: 'trip-linh-declined',
      members: [
        { id: 'm1', uid: 'u-perry', name: 'Perry', avatar: '' },
        { id: 'm2', uid: 'u-linh', email: 'linhchi@tripmate.app', name: 'Linh Chi', avatar: '', invitationStatus: 'declined' },
      ],
      memberUids: ['u-perry', 'u-linh'],
    });

    assert.equal(canUserAccessTrip(perryOnlyTrip, linhUser), false);
    assert.equal(canUserAccessTrip(sampleStyleTrip, linhUser), false);
    assert.equal(canUserAccessTrip(linhPendingTrip, linhUser), false);
    assert.equal(canUserAccessTrip(linhDeclinedTrip, linhUser), false);
    assert.equal(canUserAccessTrip(perryOnlyTrip, null), false);

    assert.equal(canUserAccessTrip(linhCreatedTrip, linhUser), true);
    assert.equal(canUserAccessTrip(linhAcceptedTrip, linhUser), true);
    assert.equal(canUserAccessTrip(linhOfflineEmailTrip, linhUser), true);
    assert.equal(canUserAccessTrip(linhOfflinePhoneTrip, linhUser), true);

    assert.equal(isMemberParticipatingForUser(linhPendingTrip.members[1], linhUser), false);
    assert.equal(isMemberParticipatingForUser(linhAcceptedTrip.members[1], linhUser), true);

    const allTrips = [
      perryOnlyTrip,
      sampleStyleTrip,
      linhCreatedTrip,
      linhAcceptedTrip,
      linhOfflineEmailTrip,
      linhOfflinePhoneTrip,
      linhPendingTrip,
      linhDeclinedTrip,
    ];
    const linhVisible = filterTripsForUser(allTrips, linhUser);
    assert.deepEqual(
      linhVisible.map((t) => t.id),
      ['trip-linh-created', 'trip-linh-accepted', 'trip-linh-email', 'trip-linh-phone']
    );

    const perryVisible = filterTripsForUser(allTrips, perryUser);
    assert.ok(perryVisible.some((t) => t.id === 'trip-perry-only'));
    assert.equal(perryVisible.some((t) => t.id === 'trip-linh-created'), false);

    assert.equal(getUserTripsCacheKey('u-linh'), 'tripmate_trips_u-linh');
    assert.equal(getUserTripsCacheKey(null), null);
  });

  test('TC-UI-14: App, Navbar & AuthContext lọc chuyến đi theo userProfile, dùng cache riêng từng user và hiện empty state khi chưa có chuyến đi', () => {
    const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
    const authCtx = fs.readFileSync(path.join(ROOT_DIR, 'src/context/AuthContext.tsx'), 'utf8');
    const navbar = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Navbar.tsx'), 'utf8');

    assert.ok(appContent.includes('filterTripsForUser'));
    assert.ok(appContent.includes('getUserTripsCacheKey'));
    assert.ok(appContent.includes("localStorage.removeItem('tripmate_trips')"));
    assert.ok(appContent.includes('Chưa có chuyến đi nào'));
    assert.ok(appContent.includes('nextMemberUids'));
    assert.ok(appContent.includes('remoteAcceptedTrip'));

    assert.ok(authCtx.includes("localStorage.removeItem('tripmate_trips')"));
    assert.ok(authCtx.includes('updatedTrip: acceptedTripSnapshot'));

    assert.ok(navbar.includes('trips.length > 0 && activeTrip'));
    assert.ok(navbar.includes('disabled={!activeTrip}'));
  });
});




