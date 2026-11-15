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
  receiptImageUrl?: string;
  rating?: number;
  isFromSavedPlaces?: boolean;
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
  receiptImageUrl?: string;
  receiptItems?: { name: string; price: number; quantity?: number }[];
}

export interface TripMember {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  phone?: string;
  uid?: string; // Link to registered Firebase Auth user UID
  isRegistered?: boolean;
  invitationStatus?: 'accepted' | 'pending' | 'declined' | 'offline';
  invitationId?: string;
  contributedAmount?: number; // Số tiền đã góp vào quỹ nhóm
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  avatar: string;
  createdAt: string;
  passwordHash?: string;
}

export interface TripInvitation {
  id: string;
  tripId: string;
  tripTitle: string;
  tripDestination: string;
  tripDates: string;
  inviterId: string;
  inviterName: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  inviteeUid?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
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

export interface VaultPinSecurity {
  pinHash: string;
  creatorId: string;
  creatorName: string;
  creatorEmail?: string;
  creatorPhone?: string;
  createdAt: string;
}

export interface TripNotification {
  id: string;
  type: 'pin_changed' | 'pin_removed' | 'pin_reset_requested' | 'pin_remove_requested' | 'info';
  title: string;
  message: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  status?: 'pending' | 'approved' | 'rejected';
  requestId?: string;
  actionType?: 'reset_pin' | 'remove_pin';
  requestedNewPinHash?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  resolvedAt?: string;
}

export interface UserTripNotification {
  id: string;
  type: 'trip_deleted' | 'trip_deleted_settlement' | 'info';
  tripId: string;
  tripTitle: string;
  title: string;
  message: string;
  actorId: string;
  actorName: string;
  targetUid?: string;
  targetEmail?: string;
  targetPhone?: string;
  targetMemberName?: string;
  fromMemberId?: string;
  fromMemberName?: string;
  toMemberId?: string;
  toMemberName?: string;
  amount?: number;
  currency?: string;
  status: 'unread' | 'read';
  createdAt: string;
  readAt?: string;
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
  creatorId?: string; // UID of user who created the trip
  creatorName?: string;
  memberUids?: string[]; // UIDs of members who accepted the invitation
  vaultPin?: VaultPinSecurity;
  notifications?: TripNotification[];
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
