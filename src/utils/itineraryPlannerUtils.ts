import type { SavedPlace } from '../types.ts';

export interface RankedPlaceCandidate {
  id?: string;
  name: string;
  locationName: string;
  category: 'sightseeing' | 'food' | 'stay' | 'transport' | 'activity' | 'shopping';
  estimatedCost: number;
  currency: string;
  rating: number;
  notes: string;
  praiseScore: number;
  isFromSavedPlaces: boolean;
  openTime?: string;
  closeTime?: string;
  lat?: number;
  lng?: number;
}

const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  VND: 25000,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150,
  AUD: 1.53,
};

export function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function normalizePlaceKey(name: string): string {
  return normalizeText(name)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areSimilarPlaceNames(a: string, b: string): boolean {
  const ka = normalizePlaceKey(a);
  const kb = normalizePlaceKey(b);
  if (!ka || !kb) return false;
  if (ka === kb || ka.includes(kb) || kb.includes(ka)) return true;
  const wordsA = new Set(ka.split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(kb.split(' ').filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap += 1;
  });
  const ratio = overlap / Math.min(wordsA.size, wordsB.size);
  return overlap >= 3 && ratio >= 0.75;
}

export function convertCurrencyApprox(
  amount: number,
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD'
): number {
  const cleanAmount = Number(amount) || 0;
  if (cleanAmount <= 0) return 0;
  const from = (fromCurrency || 'USD').toUpperCase();
  const to = (toCurrency || 'USD').toUpperCase();
  if (from === to) return cleanAmount;

  const fromRate = USD_EXCHANGE_RATES[from] || 1;
  const toRate = USD_EXCHANGE_RATES[to] || 1;
  const inUSD = cleanAmount / fromRate;
  const converted = inUSD * toRate;

  if (to === 'VND') {
    return Math.max(1000, Math.round(converted / 5000) * 5000);
  }
  if (to === 'JPY') {
    return Math.max(100, Math.round(converted / 100) * 100);
  }
  return Math.round(converted * 10) / 10;
}

export function doesPlaceMatchDestination(placeCityName: string, tripDestination: string): boolean {
  const p = normalizeText(placeCityName);
  const d = normalizeText(tripDestination);
  if (!p || !d) return false;
  if (p === d || d.includes(p) || p.includes(d)) return true;

  // Handle common city/region aliases
  const aliases: string[][] = [
    ['ho chi minh', 'sai gon', 'saigon', 'tphcm', 'tp hcm', 'hcm'],
    ['ha noi', 'hanoi'],
    ['da nang', 'danang', 'hoi an', 'hoian'],
    ['da lat', 'dalat'],
    ['vung tau', 'vungtau'],
    ['phu quoc', 'phuquoc'],
    ['nha trang', 'nhatrang'],
    ['tokyo', 'japan', 'nhat ban'],
  ];
  return aliases.some((group) => group.some((a) => p.includes(a)) && group.some((a) => d.includes(a)));
}

export function extractTargetCategories(interests: string[] = []): string[] {
  const cats = new Set<string>();
  interests.forEach((raw) => {
    const val = normalizeText(raw);
    if (val === 'food' || val.includes('am thuc') || val.includes('food') || val.includes('an uong') || val.includes('quan ngon')) {
      cats.add('food');
    }
    if (
      val === 'temple' ||
      val === 'photo' ||
      val === 'art' ||
      val === 'culture' ||
      val.includes('di tich') ||
      val.includes('chua') ||
      val.includes('chup anh') ||
      val.includes('check-in') ||
      val.includes('bao tang') ||
      val.includes('nghe thuat') ||
      val.includes('van hoa') ||
      val.includes('sightseeing')
    ) {
      cats.add('sightseeing');
    }
    if (
      val === 'nature' ||
      val === 'nightlife' ||
      val === 'photo' ||
      val.includes('thien nhien') ||
      val.includes('leo nui') ||
      val.includes('ve dem') ||
      val.includes('bar') ||
      val.includes('activity') ||
      val.includes('trai nghiem')
    ) {
      cats.add('activity');
    }
    if (val === 'shopping' || val.includes('mua sam') || val.includes('cho dem') || val.includes('shopping')) {
      cats.add('shopping');
    }
  });
  return Array.from(cats);
}

const POSITIVE_PRAISE_PATTERNS = [
  'tuyet voi',
  'nuc no',
  'me hon',
  'huyen thoai',
  'noi tieng',
  'tru danh',
  'dac san',
  'cuc ngon',
  'sieu',
  'dep nhat',
  'top',
  'hang dau',
  'khong the bo qua',
  'phai thu',
  'rat ngon',
  'ngoan muc',
  'famous',
  'iconic',
  'legendary',
  'best',
  'must-visit',
  'must-try',
  'highly rated',
  'world-renowned',
  'breathtaking',
  'stunning',
  'signature',
  'authentic',
];

export function computePraiseScore(notes?: string, source?: string, rating?: number): number {
  const combined = normalizeText(`${notes || ''} ${source || ''}`);
  let score = (Number(rating) || 4.5) * 10;
  for (const kw of POSITIVE_PRAISE_PATTERNS) {
    if (combined.includes(kw)) {
      score += 3;
    }
  }
  if ((notes || '').trim().length > 40) {
    score += 2;
  }
  if (source && normalizeText(source).length > 2) {
    score += 1;
  }
  return Math.round(score * 10) / 10;
}

export function normalizeCategory(
  rawCat?: string
): 'sightseeing' | 'food' | 'stay' | 'transport' | 'activity' | 'shopping' {
  const c = normalizeText(rawCat || '');
  if (c === 'food' || c.includes('an') || c.includes('cafe') || c.includes('restaurant')) return 'food';
  if (c === 'shopping' || c.includes('mua') || c.includes('cho')) return 'shopping';
  if (c === 'stay' || c.includes('hotel') || c.includes('khach san')) return 'stay';
  if (c === 'transport' || c.includes('di chuyen') || c.includes('xe')) return 'transport';
  if (c === 'activity' || c.includes('trai nghiem') || c.includes('vui choi')) return 'activity';
  return 'sightseeing';
}

export function rankSavedPlacesForTrip(
  savedPlaces: SavedPlace[],
  options: {
    destination: string;
    currency: string;
    budgetAmount?: number;
    durationDays?: number;
    interests?: string[];
    travelStyle?: string;
  }
): RankedPlaceCandidate[] {
  const {
    destination,
    currency = 'USD',
    budgetAmount,
    durationDays = 3,
    interests = [],
    travelStyle = '',
  } = options;

  const targetCategories = extractTargetCategories(interests);
  const matchingDest = savedPlaces.filter((p) => doesPlaceMatchDestination(p.cityName, destination));

  const effectiveBudget = budgetAmount && budgetAmount > 0 ? budgetAmount : convertCurrencyApprox(durationDays * 80, 'USD', currency);
  const perActivityMax = Math.max(
    convertCurrencyApprox(travelStyle === 'Budget Backpacker' ? 15 : travelStyle === 'Luxury & Wellness' ? 80 : 35, 'USD', currency),
    (effectiveBudget / Math.max(1, durationDays)) * 0.45
  );

  const candidates: RankedPlaceCandidate[] = matchingDest.map((p) => {
    const costInTripCur =
      p.estimatedCost !== undefined
        ? convertCurrencyApprox(p.estimatedCost, p.currency || currency, currency)
        : 0;
    const rating = Math.min(5, Math.max(1, Number(p.rating) || 4.5));
    return {
      id: p.id,
      name: p.name,
      locationName: p.address || p.cityName || destination,
      category: normalizeCategory(p.category),
      estimatedCost: costInTripCur,
      currency,
      rating,
      notes: p.notes || (p.source ? `${p.source}` : ''),
      praiseScore: computePraiseScore(p.notes, p.source, rating),
      isFromSavedPlaces: true,
      openTime: p.openTime,
      closeTime: p.closeTime,
    };
  });

  return sortCandidatesByRatingPraiseBudget(candidates, {
    targetCategories,
    perActivityMax,
  });
}

export function sortCandidatesByRatingPraiseBudget(
  candidates: RankedPlaceCandidate[],
  options: {
    targetCategories: string[];
    perActivityMax: number;
  }
): RankedPlaceCandidate[] {
  const { targetCategories, perActivityMax } = options;

  return [...candidates].sort((a, b) => {
    // 1. Highest star rating first (descending: 5.0 -> 4.9 -> 4.8 -> ...)
    if (Math.abs(b.rating - a.rating) >= 0.05) {
      return b.rating - a.rating;
    }
    // 2. Most praised / detailed positive reviews first
    if (Math.abs(b.praiseScore - a.praiseScore) >= 0.5) {
      return b.praiseScore - a.praiseScore;
    }
    // 3. Matches selected trip interests/categories
    const aCatMatch = targetCategories.length === 0 || targetCategories.includes(a.category) ? 1 : 0;
    const bCatMatch = targetCategories.length === 0 || targetCategories.includes(b.category) ? 1 : 0;
    if (bCatMatch !== aCatMatch) {
      return bCatMatch - aCatMatch;
    }
    // 4. Fits comfortably within per-activity budget
    const aBudgetFit = a.estimatedCost <= perActivityMax ? 1 : 0;
    const bBudgetFit = b.estimatedCost <= perActivityMax ? 1 : 0;
    if (bBudgetFit !== aBudgetFit) {
      return bBudgetFit - aBudgetFit;
    }
    return a.estimatedCost - b.estimatedCost;
  });
}

export function selectOptimalSlotForCategory(
  category: RankedPlaceCandidate['category'],
  openTime?: string
): { preferredSlots: number[]; defaultTimes: string[] } {
  const defaultTimes = ['08:30 AM', '12:00 PM', '03:00 PM', '07:00 PM'];
  const openHour = openTime ? parseInt(openTime.split(':')[0], 10) : NaN;

  if (!Number.isNaN(openHour)) {
    if (openHour >= 16) return { preferredSlots: [3, 2, 1, 0], defaultTimes };
    if (openHour <= 7) return { preferredSlots: [0, 2, 1, 3], defaultTimes };
  }

  if (category === 'food') return { preferredSlots: [1, 3, 0, 2], defaultTimes };
  if (category === 'shopping') return { preferredSlots: [3, 2, 0, 1], defaultTimes };
  if (category === 'stay') return { preferredSlots: [0, 2, 1, 3], defaultTimes };
  return { preferredSlots: [0, 2, 1, 3], defaultTimes };
}

export function mergeSavedAndGeneratedIntoDays(params: {
  destination: string;
  durationDays: number;
  currency: string;
  budgetAmount?: number;
  interests?: string[];
  travelStyle?: string;
  language?: string;
  savedPlaces: SavedPlace[];
  extraCandidates: RankedPlaceCandidate[];
}): {
  days: Array<{
    dayNumber: number;
    title: string;
    summary: string;
    activities: Array<{
      time: string;
      title: string;
      locationName: string;
      category: string;
      estimatedCost: number;
      currency: string;
      rating: number;
      notes: string;
      isFromSavedPlaces: boolean;
      lat?: number;
      lng?: number;
    }>;
  }>;
  usedSavedCount: number;
  autoGeneratedCount: number;
  totalEstimatedCost: number;
} {
  const {
    destination,
    durationDays,
    currency = 'USD',
    budgetAmount,
    interests = [],
    travelStyle = '',
    language = 'vi',
    savedPlaces = [],
    extraCandidates = [],
  } = params;

  const isVi = language === 'vi';
  const daysCount = Math.max(1, Math.min(30, Number(durationDays) || 3));
  const slotsPerDay = 4;
  const totalSlots = daysCount * slotsPerDay;
  const targetCategories = extractTargetCategories(interests);

  const effectiveBudget =
    budgetAmount && budgetAmount > 0
      ? budgetAmount
      : convertCurrencyApprox(daysCount * 80, 'USD', currency);
  const perActivityMax = Math.max(
    convertCurrencyApprox(
      travelStyle === 'Budget Backpacker' ? 15 : travelStyle === 'Luxury & Wellness' ? 85 : 35,
      'USD',
      currency
    ),
    (effectiveBudget / daysCount) * 0.5
  );

  // 1. Rank Saved Places matching destination (highest stars -> most praised -> matches trip interests -> budget fit)
  const rankedSaved = rankSavedPlacesForTrip(savedPlaces, {
    destination,
    currency,
    budgetAmount: effectiveBudget,
    durationDays: daysCount,
    interests,
    travelStyle,
  });

  // 2. Deduplicate and rank extra (auto-generated) places from highest stars -> most praised -> matches interests -> budget
  const uniqueExtras: RankedPlaceCandidate[] = [];
  for (const cand of extraCandidates) {
    const dupInSaved = rankedSaved.some((s) => areSimilarPlaceNames(s.name, cand.name));
    const dupInExtras = uniqueExtras.some((e) => areSimilarPlaceNames(e.name, cand.name));
    if (!dupInSaved && !dupInExtras) {
      uniqueExtras.push({
        ...cand,
        currency,
        praiseScore: cand.praiseScore || computePraiseScore(cand.notes, undefined, cand.rating),
        isFromSavedPlaces: false,
      });
    }
  }
  const rankedExtras = sortCandidatesByRatingPraiseBudget(uniqueExtras, {
    targetCategories,
    perActivityMax,
  });

  // 3. Budget-aware pool selection: Saved places first, then top-rated auto-generated places
  const combinedPool: RankedPlaceCandidate[] = [];
  let runningCost = 0;

  const tryPickFromPool = (pool: RankedPlaceCandidate[], needed: number) => {
    const deferred: RankedPlaceCandidate[] = [];
    for (const item of pool) {
      if (combinedPool.length >= needed) break;
      const projected = runningCost + (item.estimatedCost || 0);
      // Allow item if it fits within budget OR it's free OR we still need places and have few options left
      if (projected <= effectiveBudget * 1.05 || item.estimatedCost === 0) {
        combinedPool.push(item);
        runningCost = projected;
      } else {
        deferred.push(item);
      }
    }
    // If still short of totalSlots, backfill with scaled-to-budget or deferred items
    for (const item of deferred) {
      if (combinedPool.length >= needed) break;
      const remaining = Math.max(0, effectiveBudget - runningCost);
      const adjustedCost = remaining > 0 ? Math.min(item.estimatedCost, Math.round(remaining / Math.max(1, needed - combinedPool.length))) : 0;
      combinedPool.push({
        ...item,
        estimatedCost: adjustedCost,
      });
      runningCost += adjustedCost;
    }
  };

  tryPickFromPool(rankedSaved, totalSlots);
  if (combinedPool.length < totalSlots) {
    tryPickFromPool(rankedExtras, totalSlots);
  }

  // 4. Distribute chosen places into days & time slots smoothly
  const dayBuckets: Array<Array<RankedPlaceCandidate | null>> = Array.from({ length: daysCount }, () =>
    Array(slotsPerDay).fill(null)
  );
  const slotTimes = ['08:30 AM', '12:00 PM', '03:00 PM', '07:00 PM'];

  combinedPool.forEach((place, idx) => {
    const { preferredSlots } = selectOptimalSlotForCategory(place.category, place.openTime);
    const preferredDay = idx % daysCount;
    let placed = false;

    // Try preferred day & preferred category slot first
    for (let dOffset = 0; dOffset < daysCount && !placed; dOffset++) {
      const d = (preferredDay + dOffset) % daysCount;
      for (const s of preferredSlots) {
        if (!dayBuckets[d][s]) {
          dayBuckets[d][s] = place;
          placed = true;
          break;
        }
      }
    }
  });

  let usedSavedCount = 0;
  let autoGeneratedCount = 0;
  let totalEstimatedCost = 0;

  const days = dayBuckets.map((slots, idx) => {
    const dayNum = idx + 1;
    const activities = slots
      .map((item, slotIdx) => {
        if (!item) return null;
        if (item.isFromSavedPlaces) usedSavedCount += 1;
        else autoGeneratedCount += 1;
        totalEstimatedCost += item.estimatedCost || 0;

        return {
          time: slotTimes[slotIdx],
          title: item.name,
          locationName: item.locationName || destination,
          category: item.category,
          estimatedCost: item.estimatedCost || 0,
          currency,
          rating: item.rating,
          notes: item.notes || '',
          isFromSavedPlaces: item.isFromSavedPlaces,
          ...(item.lat !== undefined ? { lat: item.lat } : {}),
          ...(item.lng !== undefined ? { lng: item.lng } : {}),
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    let title = '';
    if (dayNum === 1) {
      title = isVi ? `Ngày 1: Khám phá điểm nổi bật ${destination}` : `Day 1: Top Highlights in ${destination}`;
    } else if (dayNum === daysCount) {
      title = isVi ? `Ngày ${dayNum}: Trải nghiệm chọn lọc & Thư giãn` : `Day ${dayNum}: Curated Gems & Farewell`;
    } else {
      title = isVi ? `Ngày ${dayNum}: Địa điểm đánh giá cao tại ${destination}` : `Day ${dayNum}: Top-Rated Spots in ${destination}`;
    }

    return {
      dayNumber: dayNum,
      title,
      summary: '',
      activities,
    };
  });

  return {
    days,
    usedSavedCount,
    autoGeneratedCount,
    totalEstimatedCost,
  };
}
