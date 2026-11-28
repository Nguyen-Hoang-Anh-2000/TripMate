import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Calendar,
  Check,
  Briefcase,
  MapPin,
  FileText,
  RotateCw,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { AIItineraryPrompt, Trip, PackingItem, SavedPlace, TravelDocument } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';
import { getLocalDateString } from '../utils/dateUtils';
import { TRIP_INTEREST_OPTIONS, DEFAULT_TRIP_INTERESTS } from '../data/interestOptions';
import { InterestsComboSelect } from './InterestsComboSelect';
import {
  rankSavedPlacesForTrip,
  mergeSavedAndGeneratedIntoDays,
  convertCurrencyApprox,
  computePraiseScore,
  areSimilarPlaceNames,
  normalizeCategory,
  RankedPlaceCandidate,
} from '../utils/itineraryPlannerUtils';

interface AIItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGeneratedItinerary: (generatedData: any) => void;
  initialDestination?: string;
  initialDurationDays?: number;
  initialBudget?: number;
  targetTrip?: Trip | null;
  savedPlaces?: SavedPlace[];
}

export type TabGenerationKey = 'itinerary' | 'packing' | 'places' | 'vault';

interface TabOption {
  key: TabGenerationKey;
  labelVi: string;
  labelEn: string;
  icon: React.ElementType;
}

const AVAILABLE_TABS: TabOption[] = [
  {
    key: 'itinerary',
    labelVi: 'Lịch trình',
    labelEn: 'Itinerary',
    icon: Calendar,
  },
  {
    key: 'packing',
    labelVi: 'Hành lý',
    labelEn: 'Packing List',
    icon: Briefcase,
  },
  {
    key: 'places',
    labelVi: 'Địa điểm lưu',
    labelEn: 'Saved Places',
    icon: MapPin,
  },
  {
    key: 'vault',
    labelVi: 'Vé & Giấy tờ',
    labelEn: 'Travel Vault',
    icon: FileText,
  },
];

export const getPackingCategoryDisplay = (cat: string, isVietnamese: boolean): string => {
  const c = (cat || '').toLowerCase();
  if (c.includes('essential') || c.includes('thiết yếu')) return isVietnamese ? 'Thiết yếu' : 'Essentials';
  if (c.includes('cloth') || c.includes('quần áo') || c.includes('trang phục')) return isVietnamese ? 'Trang phục' : 'Clothing';
  if (c.includes('electr') || c.includes('điện tử')) return isVietnamese ? 'Đồ điện tử' : 'Electronics';
  if (c.includes('toilet') || c.includes('vệ sinh')) return isVietnamese ? 'Vệ sinh cá nhân' : 'Toiletries';
  if (c.includes('doc') || c.includes('giấy tờ')) return isVietnamese ? 'Giấy tờ' : 'Documents';
  if (c.includes('gear') || c.includes('dụng cụ') || c.includes('tiện ích')) return isVietnamese ? 'Dụng cụ du lịch' : 'Gear';
  return cat;
};

export const formatCleanDayTitle = (rawTitle: string, dayNum: number, isVietnamese: boolean): string => {
  const dayPrefix = isVietnamese ? `Ngày ${dayNum}` : `Day ${dayNum}`;
  if (!rawTitle) return dayPrefix;
  const stripped = rawTitle.replace(/^(ngày|day)\s*\d+[\s:–-]*/i, '').trim();
  if (!stripped || stripped.toLowerCase() === dayPrefix.toLowerCase()) {
    return dayPrefix;
  }
  return `${dayPrefix}: ${stripped}`;
};

export const AIItineraryModal: React.FC<AIItineraryModalProps> = ({
  isOpen,
  onClose,
  onApplyGeneratedItinerary,
  initialDestination,
  initialDurationDays,
  initialBudget,
  targetTrip,
  savedPlaces = [],
}) => {
  const { lang, t, isVi } = useLanguage();

  const [destination, setDestination] = useState(initialDestination || targetTrip?.destination || 'Đà Lạt');
  const [durationDays, setDurationDays] = useState(
    initialDurationDays && initialDurationDays > 0 ? initialDurationDays : (targetTrip?.days?.length || 3)
  );
  const [travelStyle, setTravelStyle] = useState<AIItineraryPrompt['travelStyle']>('Cultural & Foodie');
  const [groupType, setGroupType] = useState<AIItineraryPrompt['groupType']>('Friends');
  const [budgetAmount, setBudgetAmount] = useState(
    initialBudget ? String(initialBudget) : (targetTrip?.budgetTotal ? String(targetTrip.budgetTotal) : '500')
  );

  // Selected interest IDs
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>(DEFAULT_TRIP_INTERESTS);

  const rankedMatchingSaved = useMemo(() => {
    const tripCur = targetTrip?.currency || 'USD';
    const numBudget = budgetAmount ? parseFloat(budgetAmount) : (targetTrip?.budgetTotal || 500);
    return rankSavedPlacesForTrip(savedPlaces, {
      destination,
      currency: tripCur,
      budgetAmount: numBudget,
      durationDays,
      interests: selectedInterestIds,
      travelStyle,
    });
  }, [savedPlaces, destination, targetTrip?.currency, targetTrip?.budgetTotal, budgetAmount, durationDays, selectedInterestIds, travelStyle]);

  // Tab Selection: 4 items (itinerary, packing, places, vault)
  const [selectedTabs, setSelectedTabs] = useState<TabGenerationKey[]>([
    'itinerary',
    'packing',
    'places',
    'vault',
  ]);

  // Variation counter for "Đổi gợi ý khác"
  const [variationIndex, setVariationIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<TabGenerationKey>('itinerary');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAutoFillConfirm, setShowAutoFillConfirm] = useState(false);
  const [autoFillMode, setAutoFillMode] = useState<'auto' | 'saved_only'>('auto');
  const isGeneratingRef = useRef(false);

  const requiredItinerarySlots = durationDays * 4;
  const isSavedPlacesInsufficient =
    selectedTabs.includes('itinerary') && rankedMatchingSaved.length < requiredItinerarySlots;
  const missingSlotsCount = Math.max(0, requiredItinerarySlots - rankedMatchingSaved.length);

  // Sync initial values whenever modal opens or targetTrip changes
  useEffect(() => {
    if (isOpen) {
      const dest = targetTrip?.destination || initialDestination || 'Đà Lạt';
      const days = targetTrip?.days?.length || (initialDurationDays && initialDurationDays > 0 ? initialDurationDays : 3);
      const budget = targetTrip?.budgetTotal || (initialBudget && initialBudget > 0 ? initialBudget : 500);
      const initialInterests =
        targetTrip?.interests && targetTrip.interests.length > 0
          ? targetTrip.interests
          : DEFAULT_TRIP_INTERESTS;

      setDestination(dest);
      setDurationDays(days);
      setBudgetAmount(String(budget));
      setSelectedTabs(['itinerary', 'packing', 'places', 'vault']);
      setSelectedInterestIds(initialInterests);
      setPreviewResult(null);
      setErrorMsg('');
      isGeneratingRef.current = false;
      setLoading(false);
      setShowAutoFillConfirm(false);
      setAutoFillMode('auto');
      setVariationIndex(0);
      setActivePreviewTab('itinerary');
    }
  }, [isOpen, initialDestination, initialDurationDays, initialBudget, targetTrip?.id]);

  if (!isOpen) return null;

  const toggleTab = (key: TabGenerationKey) => {
    if (selectedTabs.includes(key)) {
      if (selectedTabs.length <= 1) return;
      setSelectedTabs(selectedTabs.filter((t) => t !== key));
    } else {
      setSelectedTabs([...selectedTabs, key]);
    }
  };

  const handleSelectAllTabs = () => {
    setSelectedTabs(['itinerary', 'packing', 'places', 'vault']);
  };

  // Helper generators for selected tabs with variation support
  const generateTailoredPacking = (dest: string, days: number, variation: number): PackingItem[] => {
    const isCold = /đà lạt|sapa|hà giang|tam đảo|snow|japan|korea|iceland|hokkaido|europe/i.test(dest);
    const isBeach = /vũng tàu|phú quốc|nha trang|đà nẵng|quy nhơn|phan thiết|phuket|bali|beach/i.test(dest);

    const baseItems: Array<{ category: string; name: string; quantity: number }> = [
      { category: 'Essentials', name: isVi ? 'Căn cước công dân / Hộ chiếu' : 'ID / Passport', quantity: 1 },
      { category: 'Essentials', name: isVi ? 'Ví tiền mặt & Thẻ ngân hàng' : 'Wallet & Credit Cards', quantity: 1 },
      { category: 'Essentials', name: isVi ? 'Thuốc cá nhân (cảm sốt, tiêu hóa, băng dán)' : 'Basic medical & first aid kit', quantity: 1 },
      { category: 'Electronics', name: isVi ? 'Sạc dự phòng 20.000mAh & cáp sạc nhanh' : 'Power bank 20,000mAh & cables', quantity: 1 },
      { category: 'Electronics', name: isVi ? 'Tai nghe du lịch chống ồn' : 'Travel noise-cancelling earphones', quantity: 1 },
      { category: 'Clothing', name: isVi ? `Quần áo mặc hàng ngày (${days} bộ)` : `Daily outfits (${days} sets)`, quantity: days },
      { category: 'Toiletries', name: isVi ? 'Bộ chiết sữa tắm & dầu gội du lịch' : 'Travel shampoo & body wash kit', quantity: 1 },
      { category: 'Toiletries', name: isVi ? 'Bàn chải & kem đánh răng gấp gọn' : 'Toothbrush & toothpaste', quantity: 1 },
      { category: 'Gear', name: isVi ? 'Ô / Dù gấp gọn hoặc áo mưa mỏng' : 'Compact umbrella or rain poncho', quantity: 1 },
    ];

    if (variation % 2 === 1) {
      baseItems.push(
        { category: 'Electronics', name: isVi ? 'Gậy chụp ảnh / Chân tripod điện thoại' : 'Selfie stick / Travel phone tripod', quantity: 1 },
        { category: 'Gear', name: isVi ? 'Bình nước giữ nhiệt du lịch 500ml' : 'Thermos water bottle 500ml', quantity: 1 }
      );
    }

    if (isCold) {
      baseItems.push(
        { category: 'Clothing', name: isVi ? 'Áo len / Áo hoodie ấm' : 'Warm knit sweater / hoodie', quantity: 2 },
        { category: 'Clothing', name: isVi ? 'Áo khoác gió giữ ấm chống sương' : 'Windbreaker / Warm thermal jacket', quantity: 1 },
        { category: 'Gear', name: isVi ? 'Khăn choàng cổ & nón len' : 'Warm scarf & beanie', quantity: 1 },
        { category: 'Toiletries', name: isVi ? 'Son dưỡng môi & kem dưỡng ẩm' : 'Lip balm & hydrating moisturizer', quantity: 1 }
      );
    } else if (isBeach) {
      baseItems.push(
        { category: 'Clothing', name: isVi ? 'Đồ bơi & áo khoác đi biển' : 'Swimwear & beach cover-up', quantity: 2 },
        { category: 'Toiletries', name: isVi ? 'Kem chống nắng SPF 50+ & kính râm' : 'Sunscreen SPF 50+ & sunglasses', quantity: 1 },
        { category: 'Gear', name: isVi ? 'Dép kẹp / Sandal đi biển chịu nước' : 'Water-resistant flip-flops / sandals', quantity: 1 },
        { category: 'Gear', name: isVi ? 'Túi chống nước cho điện thoại' : 'Waterproof phone pouch', quantity: 1 }
      );
    } else {
      baseItems.push(
        { category: 'Clothing', name: isVi ? 'Áo khoác nhẹ chống nắng' : 'Light jacket for sun protection', quantity: 1 },
        { category: 'Clothing', name: isVi ? 'Giày thể thao / sneaker êm chân' : 'Comfortable walking sneakers', quantity: 1 },
        { category: 'Toiletries', name: isVi ? 'Xịt chống côn trùng / muỗi' : 'Mosquito & insect repellent', quantity: 1 }
      );
    }

    return baseItems.map((i, idx) => ({
      id: `p-gen-${idx + 1}`,
      category: i.category,
      name: i.name,
      quantity: i.quantity,
      isPacked: false,
    }));
  };

  const generateTailoredSavedPlaces = (dest: string, cur: string, variation: number): SavedPlace[] => {
    const isDalat = /đà lạt|da lat/i.test(dest);
    const isVungTau = /vũng tàu|vung tau/i.test(dest);

    let placesList: Array<{
      name: string;
      category: string;
      address: string;
      estimatedCost: number;
      rating: number;
      notes: string;
      openTime: string;
      closeTime: string;
    }> = [];

    if (isDalat) {
      const dalatOptions = [
        [
          { name: 'Quán Lẩu gà lá é Tao Ngộ', category: 'food', address: 'Số 5 Đường 3 Tháng 4, Phường 3, Đà Lạt', estimatedCost: cur === 'VND' ? 250000 : 12, rating: 4.8, notes: 'Lẩu thơm nồng lá é ấm sực giữa trời lạnh, thịt gà ta ngọt dai.', openTime: '10:00', closeTime: '22:00' },
          { name: 'Cà phê Đồi Dã Chiến view thung lũng đèn', category: 'food', address: 'Đồi Dã Chiến, Phường 11, Đà Lạt', estimatedCost: cur === 'VND' ? 55000 : 3, rating: 4.9, notes: 'View biển mây ban ngày và thung lũng đèn hoa rực rỡ ban đêm.', openTime: '07:00', closeTime: '22:30' },
          { name: 'Đồi Chè Cầu Đất & Tuabin gió', category: 'sightseeing', address: 'Thôn Cầu Đất, Xã Xuân Trường, Đà Lạt', estimatedCost: 0, rating: 4.8, notes: 'Điểm săn mây bình minh tuyệt đẹp và chụp ảnh đồi chè xanh ngắt.', openTime: '05:00', closeTime: '18:00' },
          { name: 'Máng trượt Thác Datanla', category: 'activity', address: 'Quốc lộ 20 Đèo Prenn, Phường 3, Đà Lạt', estimatedCost: cur === 'VND' ? 200000 : 9, rating: 4.7, notes: 'Đường trượt băng qua rừng thông mát rượi, rất an toàn và nhiều góc chụp đẹp.', openTime: '07:30', closeTime: '17:00' },
        ],
        [
          { name: 'Tiệm Bánh mì xíu mại Hoàng Diệu', category: 'food', address: '26 Hoàng Diệu, Phường 5, Đà Lạt', estimatedCost: cur === 'VND' ? 35000 : 2, rating: 4.8, notes: 'Chén xíu mại nóng hổi béo ngậy kèm bánh mì giòn tan buổi sáng.', openTime: '06:00', closeTime: '11:00' },
          { name: 'Quán nướng Chu - BBQ ngoài trời', category: 'food', address: 'Khu quy hoạch Viện Nghiên Cứu Hạt Nhân, Đà Lạt', estimatedCost: cur === 'VND' ? 200000 : 9, rating: 4.7, notes: 'Bò nướng đá, sườn nướng mật ong thơm phức giữa không khí se lạnh.', openTime: '16:00', closeTime: '23:00' },
          { name: 'Khu du lịch Lang Biang & đỉnh Radar', category: 'sightseeing', address: 'Huyện Lạc Dương, Lâm Đồng', estimatedCost: cur === 'VND' ? 120000 : 5, rating: 4.8, notes: 'Đi xe jeep lên đỉnh ngắm trọn suối Vàng suối Bạc thơ mộng.', openTime: '07:00', closeTime: '17:30' },
          { name: 'Làng Cù Lần & Suối Mơ', category: 'activity', address: 'Đồng Xô, Xã Lát, Lạc Dương', estimatedCost: cur === 'VND' ? 150000 : 7, rating: 4.6, notes: 'Khung cảnh thiên nhiên hoang sơ yên bình, chèo bè bè trên hồ nước.', openTime: '07:30', closeTime: '17:00' },
        ],
        [
          { name: 'Lẩu bò Ba Toa Quán Gỗ', category: 'food', address: '1/29 Hoàng Diệu, Phường 5, Đà Lạt', estimatedCost: cur === 'VND' ? 280000 : 13, rating: 4.8, notes: 'Nồi lẩu bò ngập tràn gân thịt mềm thơm phức nức tiếng nhiều năm.', openTime: '10:00', closeTime: '22:00' },
          { name: 'Vườn dâu tây công nghệ cao Biofresh', category: 'activity', address: 'Khu du lịch Hồ Than Thở, Đà Lạt', estimatedCost: cur === 'VND' ? 50000 : 3, rating: 4.7, notes: 'Tự tay hái những quả dâu tây đỏ mọng sạch chuẩn Châu Âu.', openTime: '08:00', closeTime: '17:00' },
          { name: 'Dinh 1 Bảo Đại & Vườn ngự uyển Pháp', category: 'sightseeing', address: 'Trần Quang Diệu, Phường 10, Đà Lạt', estimatedCost: cur === 'VND' ? 90000 : 4, rating: 4.8, notes: 'Lâu đài kiến trúc Pháp cổ kính bên rừng thông trăm tuổi.', openTime: '07:00', closeTime: '17:30' },
          { name: 'Chợ Đêm Đà Lạt & Phố đi bộ Hòa Bình', category: 'food', address: 'Nguyễn Thị Minh Khai, Đà Lạt', estimatedCost: cur === 'VND' ? 100000 : 5, rating: 4.7, notes: 'Bánh tráng nướng, dâu tây lắc, sữa đậu nành nóng hổi.', openTime: '17:30', closeTime: '23:30' },
        ]
      ];
      placesList = dalatOptions[variation % dalatOptions.length];
    } else if (isVungTau) {
      const vungtauOptions = [
        [
          { name: 'Bánh khọt Gốc Vú Sữa gia truyền', category: 'food', address: '14 Nguyễn Trường Tộ, Phường 2, Vũng Tàu', estimatedCost: cur === 'VND' ? 70000 : 4, rating: 4.8, notes: 'Bánh khọt tôm tươi giòn rụm cuốn rau sống và đu đủ bào ngâm chua ngọt.', openTime: '06:30', closeTime: '21:00' },
          { name: 'Mũi Nghinh Phong & Cổng Trời biển', category: 'sightseeing', address: 'Số 1 Hạ Long, Phường 2, Vũng Tàu', estimatedCost: 0, rating: 4.9, notes: 'Gió biển lồng lộng, góc chụp hình với cổng trời nhìn thẳng ra biển Đông.', openTime: '06:00', closeTime: '18:30' },
          { name: 'Hải Đăng Vũng Tàu & Yaourt Cô Tiên', category: 'sightseeing', address: 'Đỉnh núi Nhỏ, Phường 2, Vũng Tàu', estimatedCost: cur === 'VND' ? 30000 : 2, rating: 4.7, notes: 'Ngắm trọn vịnh Bãi Sau và Bãi Trước, thưởng thức trứng lòng đào.', openTime: '07:00', closeTime: '22:00' },
          { name: 'Chợ đêm hải sản Bãi Sau', category: 'food', address: 'Sau lưng Khách sạn Imperial, Thùy Vân, Vũng Tàu', estimatedCost: cur === 'VND' ? 300000 : 15, rating: 4.6, notes: 'Tự tay chọn ghẹ sống, mực trứng nướng mỡ hành thơm nức.', openTime: '16:00', closeTime: '01:00' },
        ],
        [
          { name: 'Lẩu cá đuối Út Mười', category: 'food', address: '16A Trương Công Định, Phường 1, Vũng Tàu', estimatedCost: cur === 'VND' ? 220000 : 10, rating: 4.7, notes: 'Nước lẩu chua cay măng chua, cá đuối ngọt thịt chấm mắm ớt.', openTime: '10:00', closeTime: '22:00' },
          { name: 'Tượng Chúa Kitô Vua đỉnh Núi Nhỏ', category: 'sightseeing', address: 'Thùy Vân, Phường 2, Vũng Tàu', estimatedCost: 0, rating: 4.9, notes: 'Chinh phục gần 1.000 bậc thang ngắm toàn cảnh biển ngoạn mục.', openTime: '07:00', closeTime: '17:00' },
          { name: 'Cà phê Lightroom view biển Bãi Trước', category: 'food', address: '2/23 Hải Đăng, Phường 2, Vũng Tàu', estimatedCost: cur === 'VND' ? 60000 : 3, rating: 4.8, notes: 'Quán cà phê trên cao ngắm hoàng hôn lãng mạn bậc nhất thành phố.', openTime: '07:30', closeTime: '22:30' },
          { name: 'Bạch Dinh (Villa Blanche) di tích Pháp', category: 'sightseeing', address: '4 Trần Phú, Phường 1, Vũng Tàu', estimatedCost: cur === 'VND' ? 30000 : 1.5, rating: 4.7, notes: 'Biệt thự cổ bên sườn núi Lớn lưu giữ súng thần công cổ.', openTime: '07:30', closeTime: '17:00' },
        ]
      ];
      placesList = vungtauOptions[variation % vungtauOptions.length];
    } else {
      placesList = [
        {
          name: isVi ? `Nhà hàng ẩm thực đặc sản ${dest}` : `Local Specialty Restaurant in ${dest}`,
          category: 'food',
          address: `${dest}`,
          estimatedCost: cur === 'VND' ? 150000 : 10,
          rating: 4.8,
          notes: isVi ? 'Địa điểm ẩm thực nổi tiếng được người bản địa đánh giá cao.' : 'Highly rated authentic local dining spot.',
          openTime: '09:00',
          closeTime: '22:00',
        },
        {
          name: isVi ? `Quán Cà phê view ngắm cảnh đẹp ${dest}` : `Scenic Panorama Cafe in ${dest}`,
          category: 'food',
          address: `${dest}`,
          estimatedCost: cur === 'VND' ? 50000 : 3,
          rating: 4.9,
          notes: isVi ? 'Không gian thoáng mát, view check-in đẹp và đồ uống thanh mát.' : 'Relaxed atmosphere with great city / nature views.',
          openTime: '07:30',
          closeTime: '22:30',
        },
        {
          name: isVi ? `Danh thắng biểu tượng & Quảng trường ${dest}` : `Iconic Landmark & Square of ${dest}`,
          category: 'sightseeing',
          address: `${dest}`,
          estimatedCost: 0,
          rating: 4.8,
          notes: isVi ? 'Biểu tượng lịch sử và văn hóa không thể bỏ qua khi ghé thăm.' : 'Must-visit landmark representing local culture.',
          openTime: '06:00',
          closeTime: '21:00',
        },
        {
          name: isVi ? `Khu trải nghiệm & Mua sắm truyền thống ${dest}` : `Traditional Market & Experience Area`,
          category: 'activity',
          address: `${dest}`,
          estimatedCost: cur === 'VND' ? 100000 : 6,
          rating: 4.7,
          notes: isVi ? 'Nơi mua sắm quà lưu niệm và trải nghiệm nhịp sống sôi động.' : 'Great spot for local souvenirs and cultural immersion.',
          openTime: '08:00',
          closeTime: '22:00',
        },
      ];
    }

    return placesList
      .map((p, idx) => ({
        id: `p-saved-${variation}-${idx + 1}`,
        cityName: dest,
        name: p.name,
        category: p.category,
        address: p.address,
        estimatedCost: p.estimatedCost,
        currency: cur,
        rating: p.rating,
        notes: p.notes,
        source: isVi ? 'Gợi ý sao cao từ AI' : 'AI Top Rated Recommendation',
        openTime: p.openTime,
        closeTime: p.closeTime,
        createdAt: new Date().toISOString(),
      }))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  };

  const generateTailoredDocuments = (dest: string, budget: number, cur: string, variation: number): TravelDocument[] => {
    const isVND = cur === 'VND' || budget > 50000;
    const isFlight = !/vũng tàu|đà lạt|phan thiết/i.test(dest);

    return [
      {
        id: `doc-gen-${variation}-1`,
        title: isFlight
          ? (isVi ? `Vé máy bay khứ hồi đến ${dest}` : `Round-trip flight to ${dest}`)
          : (isVi ? `Vé xe Limousine khứ hồi đến ${dest}` : `Round-trip bus tickets to ${dest}`),
        docType: isFlight ? 'Flight Ticket' : 'Bus Ticket',
        codeOrNumber: isFlight ? `VN-${Math.floor(1000 + Math.random() * 9000)}` : `LIMO-${Math.floor(100 + Math.random() * 900)}`,
        date: targetTrip?.startDate || getLocalDateString(),
        cost: isVND ? (isFlight ? 1800000 : 350000) : (isFlight ? 120 : 25),
        notes: isVi
          ? 'Đã bao gồm hành lý xách tay 10kg & ký gửi 20kg. Vui lòng có mặt trước giờ xuất phát 90 phút.'
          : 'Includes carry-on and check-in baggage. Please arrive 90 min before departure.',
      },
      {
        id: `doc-gen-${variation}-2`,
        title: isVi ? `Xác nhận đặt phòng khách sạn tại ${dest}` : `Hotel Booking Voucher in ${dest}`,
        docType: 'Hotel Voucher',
        codeOrNumber: `HTL-${Math.floor(100000 + Math.random() * 900000)}`,
        date: targetTrip?.startDate || getLocalDateString(),
        cost: isVND ? 1200000 : 80,
        notes: isVi
          ? 'Check-in: 14:00, Check-out: 12:00. Đã bao gồm buffet bữa sáng.'
          : 'Check-in: 14:00, Check-out: 12:00. Includes complimentary breakfast.',
      },
    ];
  };

  // Main generation handler with variation support & explicit user permission for auto-generated places
  const executeGeneration = async (currentVariation: number, allowAutoGenerate: boolean = true) => {
    if (!destination.trim() || isGeneratingRef.current) return;
    if (selectedTabs.length === 0) {
      setErrorMsg(isVi ? 'Vui lòng chọn ít nhất 1 mục để tạo dữ liệu.' : 'Please select at least 1 item to generate data.');
      return;
    }

    isGeneratingRef.current = true;
    setLoading(true);
    setErrorMsg('');

    const tripCur = targetTrip?.currency || 'USD';
    const numBudget = budgetAmount ? parseFloat(budgetAmount) : (targetTrip?.budgetTotal || 500);

    const interestsPayload = selectedInterestIds.map((id) => {
      const opt = TRIP_INTEREST_OPTIONS.find((o) => o.id === id);
      return opt ? (isVi ? opt.labelVi : opt.labelEn) : id;
    });

    try {
      let generatedDays: any[] = [];
      let destinationTitle = destination.trim();
      let country = targetTrip?.country || (isVi ? 'Việt Nam' : 'Global');
      let usedSavedCount = 0;
      let autoGeneratedCount = 0;
      let totalEstimatedCost = 0;

      // 1. Generate Itinerary if selected (strict <= 10s budget before curated fallback)
      if (selectedTabs.includes('itinerary')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const fetchPromise = fetch('/api/gemini/generate-itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              destination: destination.trim(),
              durationDays,
              travelStyle,
              groupType,
              budgetAmount: numBudget,
              currency: tripCur,
              interests: interestsPayload,
              savedPlaces,
              allowAutoGenerate,
              language: lang,
              variation: currentVariation,
              seed: Date.now() + currentVariation * 1000,
            }),
          });

          const hardDeadlinePromise = new Promise<null>((resolve) =>
            setTimeout(() => {
              controller.abort();
              resolve(null);
            }, 10500)
          );

          const res = await Promise.race([fetchPromise, hardDeadlinePromise]);
          const data = res ? await res.json().catch(() => null) : null;
          if (res && res.ok && data && data.days && Array.isArray(data.days) && data.days.length > 0) {
            generatedDays = data.days;
            destinationTitle = data.destinationTitle || destinationTitle;
            country = data.country || country;
            usedSavedCount = typeof data.usedSavedCount === 'number'
              ? data.usedSavedCount
              : generatedDays.reduce((sum: number, d: any) => sum + (d.activities || []).filter((a: any) => a.isFromSavedPlaces).length, 0);
            autoGeneratedCount = typeof data.autoGeneratedCount === 'number'
              ? data.autoGeneratedCount
              : generatedDays.reduce((sum: number, d: any) => sum + (d.activities || []).filter((a: any) => !a.isFromSavedPlaces).length, 0);
            totalEstimatedCost = typeof data.totalEstimatedCost === 'number'
              ? data.totalEstimatedCost
              : generatedDays.reduce((sum: number, d: any) => sum + (d.activities || []).reduce((ds: number, a: any) => ds + (Number(a.estimatedCost) || 0), 0), 0);
          }
        } catch (apiErr) {
          console.warn('Backend itinerary call timeout/fallback:', apiErr);
        } finally {
          clearTimeout(timeoutId);
        }

        // Offline/Client Resilient Fallback: prioritize Saved Places + fill shortage (only if allowAutoGenerate is true)
        if (generatedDays.length === 0) {
          const extraCandidates: RankedPlaceCandidate[] = [];

          if (allowAutoGenerate) {
            const tailoredCurated = generateTailoredSavedPlaces(destination.trim(), tripCur, currentVariation);
            tailoredCurated.forEach((sp) => {
              extraCandidates.push({
                name: sp.name,
                locationName: sp.address || destination.trim(),
                category: normalizeCategory(sp.category),
                estimatedCost: sp.estimatedCost || 0,
                currency: tripCur,
                rating: sp.rating || 4.8,
                notes: sp.notes || '',
                praiseScore: computePraiseScore(sp.notes, sp.source, sp.rating),
                isFromSavedPlaces: false,
                openTime: sp.openTime,
                closeTime: sp.closeTime,
              });
            });

            const fallbackThemes: Array<{ titleVi: string; titleEn: string; cat: RankedPlaceCandidate['category']; costUSD: number; rating: number; notesVi: string; notesEn: string }> = [
              { titleVi: `Quán đặc sản nổi tiếng tại ${destination}`, titleEn: `Top-Rated Local Kitchen in ${destination}`, cat: 'food', costUSD: 12, rating: 4.9, notesVi: 'Được nhiều du khách khen ngon, hương vị chuẩn địa phương.', notesEn: 'Highly praised local flavors.' },
              { titleVi: `Danh thắng biểu tượng tại ${destination}`, titleEn: `Iconic Landmark in ${destination}`, cat: 'sightseeing', costUSD: 6, rating: 4.9, notesVi: 'Điểm check-in nổi bật và phong cảnh ấn tượng.', notesEn: 'Top-rated iconic attraction.' },
              { titleVi: `Cà phê view đẹp & Thư giãn tại ${destination}`, titleEn: `Scenic Viewpoint Cafe in ${destination}`, cat: 'food', costUSD: 4, rating: 4.8, notesVi: 'Không gian thoáng đẹp, được khen nhiều trên mạng xã hội.', notesEn: 'Praised cozy viewpoint cafe.' },
              { titleVi: `Trải nghiệm văn hóa & Dạo cảnh ${destination}`, titleEn: `Cultural Walk & Local Highlights`, cat: 'activity', costUSD: 10, rating: 4.8, notesVi: 'Hoạt động ngoài trời đặc sắc được đánh giá cao.', notesEn: 'Popular outdoor cultural experience.' },
              { titleVi: `Chợ đêm & Ẩm thực đường phố ${destination}`, titleEn: `Night Market & Street Food in ${destination}`, cat: 'shopping', costUSD: 14, rating: 4.7, notesVi: 'Sôi động về đêm với đa dạng món ngon và quà lưu niệm.', notesEn: 'Lively night market with local snacks.' },
              { titleVi: `Bảo tàng di tích cổ kính tại ${destination}`, titleEn: `Heritage Museum in ${destination}`, cat: 'sightseeing', costUSD: 5, rating: 4.7, notesVi: 'Kiến trúc lịch sử lâu đời, không gian yên bình.', notesEn: 'Historic cultural monument.' },
            ];

            fallbackThemes.forEach((act) => {
              const notes = isVi ? act.notesVi : act.notesEn;
              extraCandidates.push({
                name: isVi ? act.titleVi : act.titleEn,
                locationName: destination.trim(),
                category: act.cat,
                estimatedCost: convertCurrencyApprox(act.costUSD, 'USD', tripCur),
                currency: tripCur,
                rating: act.rating,
                notes,
                praiseScore: computePraiseScore(notes, 'Top Rated', act.rating),
                isFromSavedPlaces: false,
              });
            });
          }

          const merged = mergeSavedAndGeneratedIntoDays({
            destination: destination.trim(),
            durationDays,
            currency: tripCur,
            budgetAmount: numBudget,
            interests: interestsPayload,
            travelStyle,
            language: lang,
            savedPlaces,
            extraCandidates,
          });

          generatedDays = merged.days;
          usedSavedCount = merged.usedSavedCount;
          autoGeneratedCount = merged.autoGeneratedCount;
          totalEstimatedCost = merged.totalEstimatedCost;
        }
      }

      // 2. Generate Packing if selected
      let generatedPacking: PackingItem[] = [];
      if (selectedTabs.includes('packing')) {
        generatedPacking = generateTailoredPacking(destination.trim(), durationDays, currentVariation);
      }

      // 3. Generate Saved Places if selected (only generate new places if allowAutoGenerate is permitted)
      let generatedPlaces: SavedPlace[] = [];
      if (selectedTabs.includes('places') && allowAutoGenerate) {
        const curatedPlaces = generateTailoredSavedPlaces(destination.trim(), tripCur, currentVariation);
        const itineraryGeneratedPlaces: SavedPlace[] = [];
        for (const d of generatedDays) {
          for (const a of d.activities || []) {
            if (a.isFromSavedPlaces) continue;
            const alreadySaved = savedPlaces.some((sp) => areSimilarPlaceNames(sp.name, a.title || ''));
            const alreadyAdded =
              curatedPlaces.some((cp) => areSimilarPlaceNames(cp.name, a.title || '')) ||
              itineraryGeneratedPlaces.some((ip) => areSimilarPlaceNames(ip.name, a.title || ''));
            if (!alreadySaved && !alreadyAdded && a.title) {
              itineraryGeneratedPlaces.push({
                id: `p-auto-${currentVariation}-${itineraryGeneratedPlaces.length + 1}`,
                cityName: destination.trim(),
                name: a.title,
                category: a.category || 'sightseeing',
                address: a.locationName || destination.trim(),
                estimatedCost: a.estimatedCost || 0,
                currency: tripCur,
                rating: typeof a.rating === 'number' ? a.rating : 4.8,
                notes: a.notes || '',
                source: isVi ? 'AI đề xuất sao cao' : 'AI Top Rated Pick',
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
        generatedPlaces = [...itineraryGeneratedPlaces, ...curatedPlaces].sort(
          (a, b) => (b.rating || 0) - (a.rating || 0)
        );
      }

      // 4. Generate Travel Documents if selected
      let generatedDocuments: TravelDocument[] = [];
      if (selectedTabs.includes('vault')) {
        generatedDocuments = generateTailoredDocuments(destination.trim(), numBudget, tripCur, currentVariation);
      }

      const resultPayload = {
        targetTripId: targetTrip?.id,
        selectedTabs,
        destinationTitle,
        country,
        overallSummary: '',
        days: generatedDays,
        usedSavedCount,
        autoGeneratedCount,
        totalEstimatedCost,
        tripCurrency: tripCur,
        tripBudget: numBudget,
        packingItems: generatedPacking,
        savedPlaces: generatedPlaces,
        documents: generatedDocuments,
      };

      setPreviewResult(resultPayload);
      setActivePreviewTab(selectedTabs[0] || 'itinerary');
    } catch (err: any) {
      console.error('Error generating data:', err);
      setErrorMsg(isVi ? 'Đã xảy ra lỗi khi tạo dữ liệu. Vui lòng thử lại.' : 'An error occurred. Please try again.');
    } finally {
      isGeneratingRef.current = false;
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setErrorMsg(isVi ? 'Vui lòng nhập điểm đến cho chuyến đi.' : 'Please enter a trip destination.');
      return;
    }
    if (selectedTabs.length === 0) {
      setErrorMsg(isVi ? 'Vui lòng chọn ít nhất 1 mục để tạo dữ liệu.' : 'Please select at least 1 item to generate data.');
      return;
    }

    // Confirm with user BEFORE auto-generating extra places when Saved Places are insufficient
    if (isSavedPlacesInsufficient) {
      setShowAutoFillConfirm(true);
      return;
    }

    setAutoFillMode(selectedTabs.includes('itinerary') ? 'saved_only' : 'auto');
    await executeGeneration(0, !selectedTabs.includes('itinerary'));
  };

  const handleConfirmAutoFill = async () => {
    setShowAutoFillConfirm(false);
    setAutoFillMode('auto');
    await executeGeneration(0, true);
  };

  const handleUseSavedOnly = async () => {
    setShowAutoFillConfirm(false);
    setAutoFillMode('saved_only');
    await executeGeneration(0, false);
  };

  // Handler for "Đổi gợi ý khác"
  const handleRegenerate = async () => {
    const nextVariation = variationIndex + 1;
    setVariationIndex(nextVariation);
    await executeGeneration(nextVariation, autoFillMode === 'auto');
  };

  const handleApply = () => {
    if (!previewResult) return;
    onApplyGeneratedItinerary(previewResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base text-white">
                {isVi ? 'Lịch trình AI' : 'AI Itinerary'}
              </h3>
              <p className="text-[11px] text-teal-200/90 font-medium">
                {!previewResult
                  ? (isVi ? 'Bước 1: Chọn sở thích & ngân sách' : 'Step 1: Preferences & Budget')
                  : (isVi ? 'Bước 2: Xem trước & Áp dụng' : 'Step 2: Preview & Apply')}
                {targetTrip?.destination ? ` • ${targetTrip.destination}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body, Auto-Generate Confirmation, or Preview Mode */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {showAutoFillConfirm && !previewResult ? (
            /* STEP 1.5: IN-APP CONFIRMATION DIALOG WHEN SAVED PLACES ARE INSUFFICIENT */
            <div className="py-3 sm:py-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shadow-2xs">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <h4 className="font-display font-bold text-slate-900 text-base sm:text-lg">
                  {isVi ? 'Địa điểm lưu chưa đủ cho lịch trình' : 'Not Enough Saved Places'}
                </h4>
                <p className="text-xs sm:text-[13px] text-slate-600 max-w-md leading-relaxed">
                  {rankedMatchingSaved.length > 0
                    ? isVi
                      ? `Mới có ${rankedMatchingSaved.length} điểm lưu tại ${destination} (${durationDays} ngày). Đồng ý tự bổ sung các điểm sao cao & khen nhiều nhất hợp ngân sách, sở thích nhé?`
                      : `Only ${rankedMatchingSaved.length} saved places in ${destination} (${durationDays} days). Auto-fill top-rated, most-praised spots matching your budget & interests?`
                    : isVi
                    ? `Chưa có điểm lưu cho ${destination} (${durationDays} ngày). Đồng ý tự sinh các điểm sao cao & khen nhiều nhất hợp ngân sách, sở thích nhé?`
                    : `No saved places for ${destination} (${durationDays} days). Auto-generate top-rated, most-praised spots matching your budget & interests?`}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                  <div className="text-[11px] text-slate-500">{isVi ? 'Đã lưu' : 'Saved'}</div>
                  <div className="text-sm font-bold text-emerald-700 mt-0.5">{rankedMatchingSaved.length}</div>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                  <div className="text-[11px] text-slate-500">{isVi ? 'Thiếu thêm' : 'Missing'}</div>
                  <div className="text-sm font-bold text-amber-600 mt-0.5">{missingSlotsCount}</div>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                  <div className="text-[11px] text-slate-500">{isVi ? 'Ngân sách' : 'Budget'}</div>
                  <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                    {formatMoney(parseFloat(budgetAmount) || 500, targetTrip?.currency || 'USD', lang)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAutoFillConfirm(false)}
                  className="py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  {isVi ? 'Hủy (Không tạo)' : 'Cancel'}
                </button>

                {rankedMatchingSaved.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUseSavedOnly}
                    className="py-2.5 px-4 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors cursor-pointer"
                  >
                    {isVi
                      ? `Chỉ xếp ${rankedMatchingSaved.length} địa điểm đã lưu`
                      : `Use only ${rankedMatchingSaved.length} saved`}
                  </button>
                )}

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmAutoFill}
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isVi ? 'Đồng ý, tự sinh & tạo lịch trình' : 'Yes, auto-generate & create'}</span>
                </button>
              </div>
            </div>
          ) : !previewResult ? (
            /* STEP 1: FORM WITH ITEM CHOOSER */
            <form noValidate onSubmit={handleGenerate} className="space-y-4 sm:space-y-5">
              
              {/* Trip Target Info Card (Destination & Budget already selected) */}
              <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-teal-900 font-semibold truncate">
                    <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="truncate">{destination}</span>
                    <span className="text-teal-400">•</span>
                    <span>{durationDays} {isVi ? 'ngày' : durationDays === 1 ? 'day' : 'days'}</span>
                  </div>
                  <div className="font-bold text-teal-800 shrink-0 bg-white px-2.5 py-1 rounded-xl border border-teal-200/80 shadow-2xs">
                    {formatMoney(parseFloat(budgetAmount) || 500, targetTrip?.currency || 'USD', lang)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-teal-800/90 leading-snug border-t border-teal-200/60 pt-2">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                  <span>
                    {rankedMatchingSaved.length > 0
                      ? isVi
                        ? `Dùng ${rankedMatchingSaved.length} điểm đã lưu tại ${destination} + AI bổ sung.`
                        : `Uses ${rankedMatchingSaved.length} saved spots in ${destination} + AI picks.`
                      : isVi
                      ? `AI sẽ tự chọn điểm nổi bật tại ${destination}.`
                      : `AI will suggest top spots in ${destination}.`}
                  </span>
                </div>
              </div>

              {/* SECTION: CHỌN MỤC GỢI Ý (Đã bỏ Chỉ lịch trình và bỏ mục Chi tiêu) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-900">
                      {isVi ? 'Chọn mục gợi ý' : 'Select suggested items'}
                    </label>
                    <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      {selectedTabs.length}/4
                    </span>
                  </div>

                  <div className="flex items-center text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllTabs}
                      className="text-teal-600 hover:text-teal-700 font-semibold hover:underline cursor-pointer"
                    >
                      {isVi ? 'Chọn tất cả' : 'Select all'}
                    </button>
                  </div>
                </div>

                {/* 4 Compact Item Cards: Lịch trình, Hành lý, Địa điểm lưu, Vé & Giấy tờ */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AVAILABLE_TABS.map((tab) => {
                    const isSelected = selectedTabs.includes(tab.key);
                    const TabIcon = tab.icon;

                    return (
                      <div
                        key={tab.key}
                        onClick={() => toggleTab(tab.key)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 select-none min-h-[42px] ${
                          isSelected
                            ? 'bg-teal-50/80 border-teal-500 shadow-2xs ring-1 ring-teal-500/20'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-teal-600 text-white' : 'border border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </div>

                        <TabIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />

                        <span className={`text-xs font-medium truncate ${isSelected ? 'text-teal-950 font-semibold' : 'text-slate-700'}`}>
                          {isVi ? tab.labelVi : tab.labelEn}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preferences Config */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.durationLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    value={durationDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setDurationDays(isNaN(val) || val < 1 ? 1 : val);
                    }}
                    className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.styleLabel')}</label>
                  <select
                    value={travelStyle}
                    onChange={(e) => setTravelStyle(e.target.value as any)}
                    className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Cultural & Foodie">{t('aiStyle.cultural')}</option>
                    <option value="Balanced Explorer">{t('aiStyle.balanced')}</option>
                    <option value="Budget Backpacker">{t('aiStyle.budget')}</option>
                    <option value="Luxury & Wellness">{t('aiStyle.luxury')}</option>
                    <option value="Family Friendly">{t('aiStyle.family')}</option>
                    <option value="Thrill & Adventure">{t('aiStyle.thrill')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.groupLabel')}</label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value as any)}
                    className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Friends">{t('aiGroup.friends')}</option>
                    <option value="Couple">{t('aiGroup.couple')}</option>
                    <option value="Solo">{t('aiGroup.solo')}</option>
                    <option value="Family">{t('aiGroup.family')}</option>
                  </select>
                </div>
              </div>

              {/* SỞ THÍCH - Combo Selectbox */}
              <InterestsComboSelect
                selectedIds={selectedInterestIds}
                onChange={setSelectedInterestIds}
                isVi={isVi}
                label={isVi ? 'Sở thích' : 'Interests'}
                dropdownId="ai-itinerary-interests"
              />

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Submit Button: Tên nút "Tạo dữ liệu gợi ý" */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || selectedTabs.length === 0}
                  className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isVi ? 'Đang tạo dữ liệu gợi ý...' : 'Generating suggested data...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{isVi ? 'Tạo dữ liệu gợi ý' : 'Generate Suggested Data'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* STEP 2: PREVIEW WITH TAB FILTER & ĐỔI GỢI Ý KHÁC */
            <div className="space-y-4">
              
              {/* Destination Overview Banner with prominent 'Đổi gợi ý khác' button */}
              <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-800 text-sm sm:text-base truncate">
                      {previewResult.destinationTitle}
                    </h4>
                    <span className="text-xs font-medium text-teal-700">
                      {durationDays} {isVi ? 'ngày' : 'days'}
                    </span>
                  </div>

                  {/* Nút Đổi gợi ý khác trên banner */}
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-white hover:bg-teal-100/70 border border-teal-200/80 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
                    title={isVi ? 'Tạo phương án gợi ý khác' : 'Try alternative suggestion'}
                  >
                    <RotateCw className={`w-3.5 h-3.5 text-teal-600 ${loading ? 'animate-spin' : ''}`} />
                    <span>{isVi ? 'Đổi gợi ý khác' : 'Try another'}</span>
                  </button>
                </div>

                {selectedTabs.includes('itinerary') && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 pt-1.5 border-t border-teal-200/60">
                    <span>
                      {isVi ? 'Từ danh sách lưu:' : 'From saved:'}{' '}
                      <strong className="text-emerald-700">{previewResult.usedSavedCount || 0}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      {isVi ? 'Tự sinh ★ cao:' : 'Top-rated auto-added:'}{' '}
                      <strong className="text-teal-700">{previewResult.autoGeneratedCount || 0}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      {isVi ? 'Dự toán:' : 'Est. cost:'}{' '}
                      <strong className="text-slate-800">
                        {formatMoney(previewResult.totalEstimatedCost || 0, previewResult.tripCurrency || targetTrip?.currency || 'USD', lang)}
                      </strong>
                      {' / '}
                      {formatMoney(previewResult.tripBudget || parseFloat(budgetAmount) || 500, previewResult.tripCurrency || targetTrip?.currency || 'USD', lang)}
                    </span>
                  </div>
                )}
              </div>

              {/* Sub-tab navigation in Preview */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
                {selectedTabs.map((key) => {
                  const tabMeta = AVAILABLE_TABS.find((t) => t.key === key);
                  if (!tabMeta) return null;
                  const Icon = tabMeta.icon;
                  const isActive = activePreviewTab === key;

                  let countBadge = 0;
                  if (key === 'itinerary') countBadge = previewResult.days?.length || 0;
                  if (key === 'packing') countBadge = previewResult.packingItems?.length || 0;
                  if (key === 'places') countBadge = previewResult.savedPlaces?.length || 0;
                  if (key === 'vault') countBadge = previewResult.documents?.length || 0;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActivePreviewTab(key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-2xs font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{isVi ? tabMeta.labelVi : tabMeta.labelEn}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {countBadge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Content of Active Preview Tab */}
              <div className="space-y-3 min-h-[200px]">
                {/* 1. Itinerary Preview (Hiển thị giờ, tên, sao đánh giá, nguồn lưu/tự sinh và chi phí) */}
                {activePreviewTab === 'itinerary' && (
                  <div className="space-y-3">
                    {previewResult.days?.map((d: any) => {
                      const displayTitle = formatCleanDayTitle(d.title, d.dayNumber, isVi);
                      return (
                        <div key={d.dayNumber} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                          <h5 className="font-semibold text-slate-800 text-xs sm:text-[13px] mb-2.5">
                            {displayTitle}
                          </h5>
                          
                          <ul className="space-y-2.5">
                            {d.activities?.map((a: any, idx: number) => (
                              <li key={idx} className="text-xs text-slate-700 flex items-start justify-between gap-2 py-0.5">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span className="font-medium text-teal-700 shrink-0 text-[11px] bg-teal-50/80 px-2 py-0.5 rounded-md border border-teal-200/50 font-mono mt-0.5">
                                    {a.time}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-medium text-slate-800 text-xs sm:text-[13px]">
                                        {a.title}
                                      </span>
                                      {typeof a.rating === 'number' && (
                                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/70 px-1.5 py-0.2 rounded-md shrink-0">
                                          ★ {Number(a.rating).toFixed(1)}
                                        </span>
                                      )}
                                      <span
                                        className={`text-[10px] font-medium px-1.5 py-0.2 rounded-md border shrink-0 ${
                                          a.isFromSavedPlaces
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                                            : 'bg-teal-50 text-teal-700 border-teal-200/70'
                                        }`}
                                      >
                                        {a.isFromSavedPlaces
                                          ? isVi ? 'Đã lưu' : 'Saved'
                                          : isVi ? 'Tự sinh' : 'Auto-pick'}
                                      </span>
                                    </div>
                                    {a.notes && (
                                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{a.notes}</p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-700 shrink-0 mt-0.5">
                                  {a.estimatedCost > 0
                                    ? formatMoney(a.estimatedCost, previewResult.tripCurrency || targetTrip?.currency || 'USD', lang)
                                    : (isVi ? 'Miễn phí' : 'Free')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Packing List Preview (Đã fix dịch đúng category Tiếng Việt, không để lỗi Essentials) */}
                {activePreviewTab === 'packing' && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{isVi ? 'Danh mục hành lý gợi ý' : 'Suggested Packing Items'}</span>
                      <span className="text-slate-500 font-normal">{previewResult.packingItems?.length || 0} {isVi ? 'món' : 'items'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                      {previewResult.packingItems?.map((item: any, idx: number) => (
                        <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200/60 flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-normal truncate">{item.name}</span>
                          <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200/70 px-2 py-0.5 rounded-md font-normal shrink-0 ml-2">
                            {getPackingCategoryDisplay(item.category, isVi)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Saved Places Preview */}
                {activePreviewTab === 'places' && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{isVi ? 'Địa điểm check-in & ẩm thực lưu sẵn' : 'Curated Places & Highlights'}</span>
                      <span className="text-slate-500 font-normal">{previewResult.savedPlaces?.length || 0} {isVi ? 'địa điểm' : 'places'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {previewResult.savedPlaces?.map((place: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200/60 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800 truncate">{place.name}</span>
                            <span className="text-amber-600 font-medium shrink-0 text-[11px]">★ {place.rating}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{place.address}</div>
                          <div className="text-[11px] text-slate-600 line-clamp-2">{place.notes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Documents / Vault Preview */}
                {activePreviewTab === 'vault' && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{isVi ? 'Vé & Giấy tờ đặt chỗ mẫu' : 'Sample Travel Tickets & Vouchers'}</span>
                      <span className="text-slate-500 font-normal">{previewResult.documents?.length || 0} {isVi ? 'chứng từ' : 'documents'}</span>
                    </div>
                    <div className="space-y-1.5">
                      {previewResult.documents?.map((doc: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-200/60 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-medium text-slate-800">{doc.title}</div>
                            <div className="text-[11px] text-slate-500">
                              Mã code: <span className="font-mono text-slate-700">{doc.codeOrNumber}</span> • {doc.notes}
                            </div>
                          </div>
                          {doc.cost ? (
                            <div className="font-semibold text-teal-700 shrink-0 ml-3">
                              {formatMoney(doc.cost, targetTrip?.currency || 'USD', lang)}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Edit, Đổi gợi ý khác, Save */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewResult(null)}
                  className="py-2.5 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-center"
                >
                  {isVi ? '← Chỉnh sửa' : '← Edit prompt'}
                </button>

                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="py-2.5 px-3 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title={isVi ? 'Đổi gợi ý khác' : 'Try alternative suggestion'}
                >
                  <RotateCw className={`w-3.5 h-3.5 text-teal-600 ${loading ? 'animate-spin' : ''}`} />
                  <span>{isVi ? 'Đổi gợi ý khác' : 'Try another'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isVi ? 'Áp dụng vào chuyến đi' : 'Apply to Trip'}</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
