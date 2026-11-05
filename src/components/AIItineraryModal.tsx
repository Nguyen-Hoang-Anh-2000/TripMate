import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { AIItineraryPrompt, Trip, PackingItem, SavedPlace, TravelDocument } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';

interface AIItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGeneratedItinerary: (generatedData: any) => void;
  initialDestination?: string;
  initialDurationDays?: number;
  initialBudget?: number;
  targetTrip?: Trip | null;
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

interface InterestOption {
  id: string;
  labelVi: string;
  labelEn: string;
}

const INTEREST_OPTIONS: InterestOption[] = [
  { id: 'food', labelVi: 'Ẩm thực & Quán ngon', labelEn: 'Food & Dining' },
  { id: 'temple', labelVi: 'Di tích & Chùa chiền', labelEn: 'Historical Temples' },
  { id: 'photo', labelVi: 'Chụp ảnh & Check-in', labelEn: 'Photography & Check-in' },
  { id: 'shopping', labelVi: 'Mua sắm & Chợ đêm', labelEn: 'Shopping & Night Markets' },
  { id: 'nightlife', labelVi: 'Hoạt động về đêm & Bar chill', labelEn: 'Nightlife & Chill' },
  { id: 'nature', labelVi: 'Thiên nhiên & Leo núi', labelEn: 'Nature & Hiking' },
  { id: 'art', labelVi: 'Nghệ thuật & Bảo tàng', labelEn: 'Art & Museums' },
  { id: 'culture', labelVi: 'Văn hóa & Trải nghiệm', labelEn: 'Culture & Local Life' },
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
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([
    'food', 'temple', 'photo'
  ]);

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

  // Sync initial values whenever modal opens or targetTrip changes
  useEffect(() => {
    if (isOpen) {
      const dest = targetTrip?.destination || initialDestination || 'Đà Lạt';
      const days = targetTrip?.days?.length || (initialDurationDays && initialDurationDays > 0 ? initialDurationDays : 3);
      const budget = targetTrip?.budgetTotal || (initialBudget && initialBudget > 0 ? initialBudget : 500);

      setDestination(dest);
      setDurationDays(days);
      setBudgetAmount(String(budget));
      setSelectedTabs(['itinerary', 'packing', 'places', 'vault']);
      setSelectedInterestIds(['food', 'temple', 'photo']);
      setPreviewResult(null);
      setErrorMsg('');
      setLoading(false);
      setVariationIndex(0);
      setActivePreviewTab('itinerary');
    }
  }, [isOpen, initialDestination, initialDurationDays, initialBudget, targetTrip]);

  if (!isOpen) return null;

  const toggleInterest = (id: string) => {
    if (selectedInterestIds.includes(id)) {
      setSelectedInterestIds(selectedInterestIds.filter((item) => item !== id));
    } else {
      setSelectedInterestIds([...selectedInterestIds, id]);
    }
  };

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

    return placesList.map((p, idx) => ({
      id: `p-saved-${variation}-${idx + 1}`,
      cityName: dest,
      name: p.name,
      category: p.category,
      address: p.address,
      estimatedCost: p.estimatedCost,
      currency: cur,
      rating: p.rating,
      notes: p.notes,
      source: isVi ? 'Gợi ý từ AI' : 'AI Recommendation',
      openTime: p.openTime,
      closeTime: p.closeTime,
      createdAt: new Date().toISOString(),
    }));
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
        date: targetTrip?.startDate || new Date().toISOString().split('T')[0],
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
        date: targetTrip?.startDate || new Date().toISOString().split('T')[0],
        cost: isVND ? 1200000 : 80,
        notes: isVi
          ? 'Check-in: 14:00, Check-out: 12:00. Đã bao gồm buffet bữa sáng.'
          : 'Check-in: 14:00, Check-out: 12:00. Includes complimentary breakfast.',
      },
    ];
  };

  // Main generation handler with variation support
  const executeGeneration = async (currentVariation: number) => {
    if (!destination.trim()) return;
    if (selectedTabs.length === 0) {
      setErrorMsg(isVi ? 'Vui lòng chọn ít nhất 1 mục để tạo dữ liệu.' : 'Please select at least 1 item to generate data.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const tripCur = targetTrip?.currency || 'USD';
    const numBudget = budgetAmount ? parseFloat(budgetAmount) : (targetTrip?.budgetTotal || 500);

    const interestsPayload = selectedInterestIds.map((id) => {
      const opt = INTEREST_OPTIONS.find((o) => o.id === id);
      return opt ? (isVi ? opt.labelVi : opt.labelEn) : id;
    });

    try {
      let generatedDays: any[] = [];
      let destinationTitle = destination.trim();
      let country = targetTrip?.country || 'Việt Nam';

      // 1. Generate Itinerary if selected
      if (selectedTabs.includes('itinerary')) {
        try {
          const res = await fetch('/api/gemini/generate-itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              destination: destination.trim(),
              durationDays,
              travelStyle,
              groupType,
              budgetAmount: numBudget,
              interests: interestsPayload,
              language: lang,
              variation: currentVariation,
              seed: Date.now() + currentVariation * 1000,
            }),
          });

          const data = await res.json().catch(() => null);
          if (res.ok && data && data.days && Array.isArray(data.days) && data.days.length > 0) {
            generatedDays = data.days;
            destinationTitle = data.destinationTitle || destinationTitle;
            country = data.country || country;
          }
        } catch (apiErr) {
          console.warn('Backend itinerary call fallback:', apiErr);
        }

        // Varied fallback days without generic boilerplate introductions
        if (generatedDays.length === 0) {
          const activityThemes = [
            // Theme 0: Điểm đến biểu tượng & Ẩm thực nổi tiếng
            [
              { time: '08:30 AM', title: isVi ? `Thưởng thức điểm tâm & cà phê sáng tại ${destination}` : `Breakfast & coffee in ${destination}`, cat: 'food' },
              { time: '10:00 AM', title: isVi ? `Check-in danh thắng nổi tiếng tại ${destination}` : `Visit iconic landmark in ${destination}`, cat: 'sightseeing' },
              { time: '02:30 PM', title: isVi ? `Trải nghiệm văn hóa & dạo cảnh` : `Cultural walk & local highlights`, cat: 'activity' },
              { time: '06:30 PM', title: isVi ? `Tiệc tối & dạo chơi phố đêm tại ${destination}` : `Dinner & night market stroll`, cat: 'food' },
            ],
            // Theme 1: Thiên nhiên, Săn cảnh đẹp & Bar chill
            [
              { time: '05:30 AM', title: isVi ? `Săn mây bình minh & ngắm cảnh núi non` : `Sunrise cloud hunting & scenic mountain view`, cat: 'activity' },
              { time: '09:00 AM', title: isVi ? `Thưởng thức món ngon đặc sản địa phương` : `Authentic local specialty tasting`, cat: 'food' },
              { time: '02:00 PM', title: isVi ? `Khám phá thung lũng & làng nghề truyền thống` : `Explore valleys & craft village`, cat: 'sightseeing' },
              { time: '07:30 PM', title: isVi ? `Thưởng thức nhạc sống Acoustic & nhâm nhi đồ uống` : `Live acoustic music & chill lounge`, cat: 'activity' },
            ],
            // Theme 2: Khám phá thư thái, check-in quán đẹp & mua sắm
            [
              { time: '09:00 AM', title: isVi ? `Cà phê view đồi & check-in không gian mở` : `Scenic hilltop cafe & photo spots`, cat: 'food' },
              { time: '11:00 AM', title: isVi ? `Tham quan bảo tàng di tích cổ kính` : `Historic museum & heritage monument`, cat: 'sightseeing' },
              { time: '03:30 PM', title: isVi ? `Trải nghiệm máng trượt / chèo thuyền dạo hồ` : `Outdoor coaster adventure / lakeside rowing`, cat: 'activity' },
              { time: '06:30 PM', title: isVi ? `Tiệc nướng BBQ ngoài trời cùng nhóm` : `Outdoor BBQ dinner gathering`, cat: 'food' },
            ],
          ];

          generatedDays = Array.from({ length: durationDays }, (_, idx) => {
            const dayNum = idx + 1;
            const themeIdx = (currentVariation + idx) % activityThemes.length;
            const themeActs = activityThemes[themeIdx];

            return {
              dayNumber: dayNum,
              title: isVi
                ? (dayNum === 1 ? `Khám phá trung tâm ${destination}` : dayNum === durationDays ? `Mua sắm & Trải nghiệm ẩm thực` : `Danh thắng & Trải nghiệm ngày ${dayNum}`)
                : (dayNum === 1 ? `Downtown ${destination}` : `Highlights & Culture Day ${dayNum}`),
              summary: '',
              activities: themeActs.map((act) => ({
                time: act.time,
                title: act.title,
                locationName: `${destination}`,
                category: act.cat,
                estimatedCost: tripCur === 'VND' ? 80000 : 5,
                notes: '',
              })),
            };
          });
        }
      }

      // 2. Generate Packing if selected
      let generatedPacking: PackingItem[] = [];
      if (selectedTabs.includes('packing')) {
        generatedPacking = generateTailoredPacking(destination.trim(), durationDays, currentVariation);
      }

      // 3. Generate Saved Places if selected
      let generatedPlaces: SavedPlace[] = [];
      if (selectedTabs.includes('places')) {
        generatedPlaces = generateTailoredSavedPlaces(destination.trim(), tripCur, currentVariation);
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
        overallSummary: '', // Bỏ hoàn toàn phần giới thiệu hành trình ... thư giãn
        days: generatedDays,
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
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeGeneration(0);
  };

  // Handler for "Đổi gợi ý khác"
  const handleRegenerate = async () => {
    const nextVariation = variationIndex + 1;
    setVariationIndex(nextVariation);
    await executeGeneration(nextVariation);
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
                {isVi ? 'Kiến trúc sư Lịch trình AI' : 'AI Itinerary Architect'}
              </h3>
              <p className="text-[11px] text-teal-200/90 font-medium">
                {isVi ? 'Chuyến đi gợi ý' : 'Suggested Trip'}
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

        {/* Form Body or Preview Mode */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {!previewResult ? (
            /* STEP 1: FORM WITH ITEM CHOOSER */
            <form onSubmit={handleGenerate} className="space-y-4 sm:space-y-5">
              
              {/* Trip Target Info Card (Destination & Budget already selected) */}
              <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-teal-900 font-semibold truncate">
                  <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="truncate">{destination}</span>
                  <span className="text-teal-400">•</span>
                  <span>{durationDays} {isVi ? 'ngày' : 'days'}</span>
                </div>
                <div className="font-bold text-teal-800 shrink-0 bg-white px-2.5 py-1 rounded-xl border border-teal-200/80 shadow-2xs">
                  {formatMoney(parseFloat(budgetAmount) || 500, targetTrip?.currency || 'USD', lang)}
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

              {/* Preferences Config (Đã bỏ giới hạn max="14" ngày) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
                <div>
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

              {/* SỞ THÍCH (Đổi tiêu đề thành 'Sở thích' theo yêu cầu) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {isVi ? 'Sở thích' : 'Interests'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((interest) => {
                    const isSelected = selectedInterestIds.includes(interest.id);
                    return (
                      <button
                        key={interest.id}
                        type="button"
                        onClick={() => toggleInterest(interest.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isVi ? interest.labelVi : interest.labelEn} {isSelected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

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
              <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl flex items-center justify-between gap-2">
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
                {/* 1. Itinerary Preview (Chỉ mốc thời gian + Tiêu đề, chữ thanh thoát, không in đậm dồn dập) */}
                {activePreviewTab === 'itinerary' && (
                  <div className="space-y-3">
                    {previewResult.days?.map((d: any) => {
                      const displayTitle = formatCleanDayTitle(d.title, d.dayNumber, isVi);
                      return (
                        <div key={d.dayNumber} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                          <h5 className="font-semibold text-slate-800 text-xs sm:text-[13px] mb-2.5">
                            {displayTitle}
                          </h5>
                          
                          {/* Danh sách mốc thời gian: Nhẹ nhàng, dễ đọc, không lạm dụng in đậm */}
                          <ul className="space-y-2">
                            {d.activities?.map((a: any, idx: number) => (
                              <li key={idx} className="text-xs text-slate-700 flex items-center gap-2.5 py-0.5">
                                <span className="font-medium text-teal-700 shrink-0 text-[11px] bg-teal-50/80 px-2 py-0.5 rounded-md border border-teal-200/50 font-mono">
                                  {a.time}
                                </span>
                                <span className="font-normal text-slate-700 truncate text-xs sm:text-[13px]">
                                  {a.title}
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
                  <span>{isVi ? 'Tạo dữ liệu gợi ý' : 'Save Suggested Data'}</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
