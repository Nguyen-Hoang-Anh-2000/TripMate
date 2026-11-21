export interface TripInterestOption {
  id: string;
  labelVi: string;
  labelEn: string;
}

export const TRIP_INTEREST_OPTIONS: TripInterestOption[] = [
  { id: 'food', labelVi: 'Ẩm thực & Quán ngon', labelEn: 'Food & Dining' },
  { id: 'temple', labelVi: 'Di tích & Chùa chiền', labelEn: 'Historical Temples' },
  { id: 'photo', labelVi: 'Chụp ảnh & Check-in', labelEn: 'Photography & Check-in' },
  { id: 'shopping', labelVi: 'Mua sắm & Chợ đêm', labelEn: 'Shopping & Night Markets' },
  { id: 'nightlife', labelVi: 'Hoạt động về đêm & Bar chill', labelEn: 'Nightlife & Chill' },
  { id: 'nature', labelVi: 'Thiên nhiên & Leo núi', labelEn: 'Nature & Hiking' },
  { id: 'art', labelVi: 'Nghệ thuật & Bảo tàng', labelEn: 'Art & Museums' },
  { id: 'culture', labelVi: 'Văn hóa & Trải nghiệm', labelEn: 'Culture & Local Life' },
];

export const DEFAULT_TRIP_INTERESTS = ['food', 'temple', 'photo'];
