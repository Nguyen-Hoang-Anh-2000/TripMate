export type StandardCategoryType = 'sightseeing' | 'food' | 'stay' | 'transport' | 'activity' | 'shopping' | 'flight' | 'other';
export type CategoryType = StandardCategoryType | string;

export interface CategoryConfig {
  id: string;
  nameVi: string;
  nameEn: string;
  icon?: string;
  color?: string;
}

export interface ActivityItem {
  id: string;
  time: string; // e.g. "09:00 AM"
  title: string;
  locationName: string;
  lat?: number;
  lng?: number;
  category: CategoryType;
  estimatedCost?: number;
  currency?: string;
  notes?: string;
  isCompleted?: boolean;
  openTime?: string;
  closeTime?: string;
  actualCost?: number;
  paidBy?: string;
  splitWith?: string[];
  memberSplits?: { memberId: string; amount: number }[];
  expenseId?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string; // YYYY-MM-DD or display text
  title: string;
  summary: string;
  activities: ActivityItem[];
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: CategoryType;
  paidBy: string; // member id or name
  splitWith: string[]; // member ids or names
  memberSplits?: { memberId: string; amount: number }[];
  date: string;
  receiptNote?: string;
  activityId?: string;
}

export interface TripMember {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  contributedAmount?: number; // Số tiền đã góp vào quỹ nhóm
}

export interface PackingItem {
  id: string;
  category: 'Essentials' | 'Clothing' | 'Electronics' | 'Toiletries' | 'Documents' | 'Gear' | string;
  name: string;
  quantity: number;
  isPacked: boolean;
  assignedTo?: string;
}

export interface TravelDocument {
  id: string;
  title: string;
  docType: 'Flight Ticket' | 'Hotel Voucher' | 'Bus Ticket' | 'Insurance' | 'Passport/Visa' | 'Other';
  codeOrNumber?: string;
  notes?: string;
  urlOrFilename?: string;
  date?: string;
  cost?: number;
  paidBy?: string; // member id or 'fund'
  splitWith?: string[]; // member ids
  expenseId?: string; // linked expense id in trip.expenses
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  budgetTotal: number;
  currency: string;
  members: TripMember[];
  days: ItineraryDay[];
  expenses: Expense[];
  packingList: PackingItem[];
  documents: TravelDocument[];
  notes?: string;
  weatherForecast?: {
    avgTempC: number;
    condition: string;
    icon: string; // emoji or code
  };
  fundHolderId?: string; // ID thành viên đang giữ tiền đã góp của nhóm (thủ quỹ)
}

export interface SavedPlace {
  id: string;
  cityName: string; // e.g. "Đà Lạt", "Vũng Tàu", "Đà Nẵng", "Tokyo"
  name: string;
  category: CategoryType;
  address?: string;
  estimatedCost?: number;
  currency?: string;
  rating?: number; // 1 to 5
  notes?: string;
  source?: string; // e.g. "Bạn bè mách", "TikTok", "Facebook"
  openTime?: string;
  closeTime?: string;
  createdAt: string;
}

export interface AIItineraryPrompt {
  destination: string;
  durationDays: number;
  travelStyle: 'Budget Backpacker' | 'Balanced Explorer' | 'Luxury & Wellness' | 'Cultural & Foodie' | 'Family Friendly' | 'Thill & Adventure';
  interests: string[];
  groupType: 'Solo' | 'Couple' | 'Friends' | 'Family';
  budgetAmount?: number;
}
