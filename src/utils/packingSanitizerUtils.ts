import { PackingItem, Trip } from '../types';

const LEGACY_CHARGER_TYPO_RE = /sạc\s*nhanh\s*thoại/i;
const LEGACY_BLANKET_TYPO_RE = /mền\s*đông/i;

export function sanitizePackingItemName(name: string): string {
  if (!name) return name;
  let next = name;
  if (LEGACY_CHARGER_TYPO_RE.test(next)) {
    next = next.replace(/sạc\s*nhanh\s*thoại/gi, 'Sạc dự phòng & Cáp sạc');
  }
  if (LEGACY_BLANKET_TYPO_RE.test(next)) {
    next = next.replace(/mền\s*đông/gi, 'Đồ giữ ấm');
  }
  return next;
}

export function sanitizeTripLegacyTypos(trip: Trip): { trip: Trip; changed: boolean } {
  if (!trip || !Array.isArray(trip.packingList) || trip.packingList.length === 0) {
    return { trip, changed: false };
  }

  let changed = false;
  const seenNormalizedNames = new Set<string>();
  const cleanedPackingList: PackingItem[] = [];

  for (const item of trip.packingList) {
    const rawName = String(item?.name || '');
    const sanitizedName = sanitizePackingItemName(rawName);
    if (sanitizedName !== rawName) {
      changed = true;
    }
    const normalizedKey = `${String(item?.category || '').toLowerCase()}::${sanitizedName.trim().toLowerCase()}`;
    if (seenNormalizedNames.has(normalizedKey)) {
      changed = true;
      continue;
    }
    seenNormalizedNames.add(normalizedKey);
    cleanedPackingList.push(
      sanitizedName !== rawName ? { ...item, name: sanitizedName } : item
    );
  }

  if (!changed) {
    return { trip, changed: false };
  }

  return {
    trip: { ...trip, packingList: cleanedPackingList },
    changed: true,
  };
}
