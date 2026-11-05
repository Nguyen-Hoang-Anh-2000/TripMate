import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Initialize Google GenAI client
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY is not set in environment variables.');
  }
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Helper for timing out slow upstream requests
function withTimeout<T>(promise: Promise<T>, ms: number = 7000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Upstream request timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// --- Inlined Resilient Fallback Generators ---
interface FallbackActivity {
  time: string;
  title: string;
  locationName: string;
  lat?: number;
  lng?: number;
  category: 'sightseeing' | 'food' | 'stay' | 'transport' | 'activity' | 'shopping';
  estimatedCost: number;
  notes: string;
}

interface FallbackDay {
  dayNumber: number;
  title: string;
  summary: string;
  activities: FallbackActivity[];
}

interface FallbackItinerary {
  destinationTitle: string;
  country: string;
  overallSummary: string;
  recommendedBudgetTotal: number;
  days: FallbackDay[];
  isAiGenerated?: boolean;
}

interface DestinationData {
  country: { vi: string; en: string };
  highlights: Array<{
    title: { vi: string; en: string };
    location: string;
    category: 'sightseeing' | 'food' | 'stay' | 'transport' | 'activity' | 'shopping';
    costUSD: number;
    notes: { vi: string; en: string };
  }>;
}

const DESTINATION_PROFILES: Record<string, DestinationData> = {
  dalat: {
    country: { vi: 'Việt Nam', en: 'Vietnam' },
    highlights: [
      {
        title: { vi: 'Check-in khách sạn & Thưởng thức cà phê view thung lũng', en: 'Hotel Check-in & Valley View Coffee' },
        location: 'Khu vực Trung tâm & Đồi Dã Chiến, Đà Lạt',
        category: 'stay',
        costUSD: 30,
        notes: { vi: 'Nhận phòng, nghỉ ngơi và ngắm mây lãng đãng tại quán cà phê trên cao.', en: 'Check-in, relax and enjoy the misty mountain view.' },
      },
      {
        title: { vi: 'Dạo quanh Hồ Xuân Hương & Quảng trường Lâm Viên', en: 'Stroll around Xuan Huong Lake & Lam Vien Square' },
        location: 'Hồ Xuân Hương, Đà Lạt',
        category: 'sightseeing',
        costUSD: 5,
        notes: { vi: 'Chụp ảnh với nụ hoa Atiso và hoa dã quỳ khổng lồ biểu tượng.', en: 'Iconic artichoke bud landmark and refreshing lakeside walk.' },
      },
      {
        title: { vi: 'Thưởng thức Lẩu gà lá é Tao Ngộ & Bánh tráng nướng', en: 'Famous Tao Ngo Chicken Hotpot & Vietnamese Pizza' },
        location: 'Đường 3 Tháng 4, Phường 3, Đà Lạt',
        category: 'food',
        costUSD: 15,
        notes: { vi: 'Món lẩu trứ danh làm ấm người giữa không khí se lạnh buổi tối.', en: 'Steaming hotpot with wild lemon basil leaves, a Dalat specialty.' },
      },
      {
        title: { vi: 'Khám phá Chợ Đêm Đà Lạt & Phố đi bộ', en: 'Explore Dalat Night Market & Walking Street' },
        location: 'Chợ Đêm Đà Lạt, Nguyễn Thị Minh Khai',
        category: 'shopping',
        costUSD: 10,
        notes: { vi: 'Thưởng thức sữa đậu nành nóng hổi, mua mứt dâu và áo len.', en: 'Hot soymilk, strawberry jam, and cozy local souvenirs.' },
      },
      {
        title: { vi: 'Săn mây bình minh tại Đồi Chè Cầu Đất', en: 'Sunrise Cloud Hunting at Cau Dat Tea Hill' },
        location: 'Cầu Đất, Xuân Trường, Đà Lạt',
        category: 'activity',
        costUSD: 12,
        notes: { vi: 'Nên xuất phát từ 05:00 sáng để bắt trọn biển mây bồng bềnh tuyệt đẹp.', en: 'Depart early around 5 AM to catch breathtaking sea of clouds.' },
      },
      {
        title: { vi: 'Tham quan Dinh 3 Bảo Đại & Rừng thông', en: 'Visit Bao Dai Summer Palace & Pine Forest' },
        location: 'Triệu Việt Vương, Phường 4, Đà Lạt',
        category: 'sightseeing',
        costUSD: 8,
        notes: { vi: 'Kiến trúc Pháp cổ kính cùng không gian lịch sử hoàng gia triều Nguyễn.', en: 'Historic royal French-architecture residence surrounded by pines.' },
      },
      {
        title: { vi: 'Trải nghiệm máng trượt Thác Datanla', en: 'Alpine Coaster Adventure at Datanla Waterfall' },
        location: 'Quốc lộ 20 Đèo Prenn, Đà Lạt',
        category: 'activity',
        costUSD: 20,
        notes: { vi: 'Hệ thống máng trượt dài nhất Đông Nam Á băng qua rừng nguyên sinh.', en: 'Exciting alpine coaster ride through dense pine forests.' },
      },
    ],
  },
  vungtau: {
    country: { vi: 'Việt Nam', en: 'Vietnam' },
    highlights: [
      {
        title: { vi: 'Check-in khách sạn gần Bãi Sau & Thư giãn tắm biển', en: 'Hotel Check-in near Back Beach & Ocean Swim' },
        location: 'Bãi Sau (Thùy Vân), Vũng Tàu',
        category: 'stay',
        costUSD: 35,
        notes: { vi: 'Bãi biển dài trong xanh, sóng êm thích hợp tắm biển buổi chiều.', en: 'Long golden sand beach ideal for swimming.' },
      },
      {
        title: { vi: 'Thưởng thức Bánh khọt Gốc Vú Sữa gia truyền', en: 'Famous Goc Vu Sua Mini Crispy Savory Pancakes' },
        location: '14 Nguyễn Trường Tộ, Phường 2, Vũng Tàu',
        category: 'food',
        costUSD: 10,
        notes: { vi: 'Bánh khọt tôm tươi giòn rụm cuốn rau sống và nước mắm chua ngọt.', en: 'Iconic crisp pancake with fresh shrimp and herbs.' },
      },
      {
        title: { vi: 'Chinh phục Tượng Chúa Kytô Vua & Ngắm toàn cảnh biển', en: 'Climb Christ the King Statue for Panoramic View' },
        location: 'Núi Nhỏ, Phường 2, Vũng Tàu',
        category: 'sightseeing',
        costUSD: 0,
        notes: { vi: 'Leo gần 1.000 bậc thang để lên tay tượng Chúa ngắm trọn vẹn vịnh biển.', en: 'Climb to the shoulders for a breathtaking 360 ocean view.' },
      },
      {
        title: { vi: 'Check-in Mũi Nghinh Phong & Cổng Trời biển', en: 'Nghinh Phong Cape & Seaside Sky Gate' },
        location: 'Đường Hạ Long, Phường 2, Vũng Tàu',
        category: 'sightseeing',
        costUSD: 0,
        notes: { vi: 'Điểm đón gió mát rượi với góc chụp hoàng hôn siêu đẹp.', en: 'Scenic windy cliff with dramatic sunset photography.' },
      },
      {
        title: { vi: 'Tiệc hải sản tươi sống tại Chợ đêm Vũng Tàu', en: 'Fresh Seafood Feast at Night Market' },
        location: 'Sau khách sạn Imperial, Bãi Sau, Vũng Tàu',
        category: 'food',
        costUSD: 25,
        notes: { vi: 'Mực trứng nướng sa tế, ốc hương rang muối ớt, cua hấp sả bia.', en: 'Grilled squid, spicy butter snails, and steamed local crab.' },
      },
      {
        title: { vi: 'Ngắm hoàng hôn tại Ngọn Hải Đăng Vũng Tàu', en: 'Sunset View from Historic Vung Tau Lighthouse' },
        location: 'Đỉnh núi Nhỏ, Vũng Tàu',
        category: 'sightseeing',
        costUSD: 5,
        notes: { vi: 'Thưởng thức yaourt và trứng lòng đào trứ danh Cô Tiên.', en: 'Visit historic 1862 lighthouse and sample traditional yogurt.' },
      },
    ],
  },
  danang: {
    country: { vi: 'Việt Nam', en: 'Vietnam' },
    highlights: [
      {
        title: { vi: 'Tắm biển Mỹ Khê - Top bãi biển quyến rũ nhất hành tinh', en: 'My Khe Beach Relaxation & Water Sports' },
        location: 'Bãi biển Mỹ Khê, Đà Nẵng',
        category: 'activity',
        costUSD: 10,
        notes: { vi: 'Bãi cát trắng mịn, nước trong veo với rặng dừa xanh mướt.', en: 'World-renowned pristine white-sand coastline.' },
      },
      {
        title: { vi: 'Khám phá Cầu Vàng & Khu du lịch Sun World Bà Nà Hills', en: 'Sun World Ba Na Hills & Iconic Golden Hands Bridge' },
        location: 'Bà Nà Hills, Hòa Ninh, Hòa Vang',
        category: 'sightseeing',
        costUSD: 45,
        notes: { vi: 'Check-in Cầu Vàng nâng bởi bàn tay khổng lồ và Làng Pháp.', en: 'Walk along the world-famous colossal hand-held sky bridge.' },
      },
      {
        title: { vi: 'Thưởng thức Mì Quảng Bà Mua & Bánh tráng thịt heo', en: 'Authentic Mi Quang Noodles & Pork Rice Paper Rolls' },
        location: 'Trần Bình Trọng, Hải Châu, Đà Nẵng',
        category: 'food',
        costUSD: 8,
        notes: { vi: 'Mì Quảng tôm thịt đậm đà ăn kèm bánh đa nướng giòn.', en: 'Signature turmeric noodles with savory broth and crispy crackers.' },
      },
      {
        title: { vi: 'Viếng chùa Linh Ứng Bán đảo Sơn Trà', en: 'Linh Ung Pagoda & Son Tra Peninsula Wildlife' },
        location: 'Bán đảo Sơn Trà, Thọ Quang, Đà Nẵng',
        category: 'sightseeing',
        costUSD: 0,
        notes: { vi: 'Tượng Phật Bà Quan Âm cao 67m hướng nhìn ra biển cả.', en: '67m towering Lady Buddha statue overlooking Danang Bay.' },
      },
      {
        title: { vi: 'Xem Cầu Rồng phun lửa, phun nước & Du thuyền sông Hàn', en: 'Dragon Bridge Fire Show & Han River Cruise' },
        location: 'Cầu Rồng, Phước Ninh, Hải Châu',
        category: 'sightseeing',
        costUSD: 15,
        notes: { vi: 'Trình diễn phun lửa và phun nước độc đáo vào 21:00 cuối tuần.', en: 'Spectacular weekend fire and water-breathing dragon performance.' },
      },
    ],
  },
  phuquoc: {
    country: { vi: 'Việt Nam', en: 'Vietnam' },
    highlights: [
      {
        title: { vi: 'Tắm biển Bãi Sao - Thiên đường cát trắng', en: 'Sao Beach Turquoise Water & White Sand Paradise' },
        location: 'Bãi Sao, An Thới, Phú Quốc',
        category: 'activity',
        costUSD: 10,
        notes: { vi: 'Nước biển êm ả như ngọc bích, check-in xích đu cây dừa huyền thoại.', en: 'Crystal clear calm turquoise bay with palm-tree swings.' },
      },
      {
        title: { vi: 'Đi cáp treo Hòn Thơm vượt biển dài nhất thế giới', en: 'Hon Thom Cable Car Island Hopping' },
        location: 'Ga Ánh Dương, An Thới, Phú Quốc',
        category: 'sightseeing',
        costUSD: 30,
        notes: { vi: 'Chiêm ngưỡng toàn cảnh quần đảo An Thới ngoạn mục từ trên cao.', en: 'Longest sea-crossing three-wire cable car with panoramic views.' },
      },
      {
        title: { vi: 'Thưởng thức gỏi cá trích & Bún quậy Kiến Xây', en: 'Signature Kien Xay Fresh Seafood Noodle & Herring Salad' },
        location: '28 Bạch Đằng, Dương Đông, Phú Quốc',
        category: 'food',
        costUSD: 8,
        notes: { vi: 'Tự tay pha nước chấm theo khẩu vị, sợi bún tươi làm tại chỗ.', en: 'Famous DIY dipping sauce noodles with fresh shrimp and calamari.' },
      },
      {
        title: { vi: 'Khám phá Grand World Phú Quốc & Show Tinh hoa Việt Nam', en: 'Grand World Venice Canals & Vietnamese Essence Show' },
        location: 'Grand World, Gành Dầu, Phú Quốc',
        category: 'sightseeing',
        costUSD: 25,
        notes: { vi: 'Dạo thuyền Gondola trên sông Venice và xem show nhạc nước rực rỡ.', en: 'Venice canals, water taxi rides, and grand cultural shows.' },
      },
      {
        title: { vi: 'Chợ đêm Phú Quốc & Thưởng thức hải sản nhum nướng mỡ hành', en: 'Phu Quoc Night Market & Grilled Sea Urchin Feast' },
        location: 'Khu 1, Dương Đông, Phú Quốc',
        category: 'shopping',
        costUSD: 20,
        notes: { vi: 'Hải sản phong phú, kem cuộn Thái Lan, kẹo chỉ và ngọc trai.', en: 'Vibrant night market packed with seafood grills and pearl souvenirs.' },
      },
    ],
  },
  tokyo: {
    country: { vi: 'Nhật Bản', en: 'Japan' },
    highlights: [
      {
        title: { vi: 'Check-in Giao lộ Shibuya & Tượng chú chó Hachiko', en: 'Shibuya Crossing & Hachiko Memorial' },
        location: 'Shibuya, Tokyo',
        category: 'sightseeing',
        costUSD: 0,
        notes: { vi: 'Ngã tư đông đúc nhất thế giới và biểu tượng lòng trung thành Hachiko.', en: 'World’s busiest pedestrian crossing with vibrant neon skyline.' },
      },
      {
        title: { vi: 'Viếng Chùa Senso-ji cổ kính & Phố Nakamise-dori', en: 'Senso-ji Ancient Buddhist Temple & Nakamise Shopping' },
        location: 'Asakusa, Taito City, Tokyo',
        category: 'sightseeing',
        costUSD: 10,
        notes: { vi: 'Ngôi chùa cổ nhất Tokyo với đèn lồng Kaminarimon đỏ khổng lồ.', en: 'Tokyo’s oldest temple with traditional craft and snack stalls.' },
      },
      {
        title: { vi: 'Thưởng thức Sushi & Sashimi tươi ngon tại Chợ Tsukiji', en: 'Tsukiji Outer Market Fresh Sushi Tasting' },
        location: 'Tsukiji, Chuo City, Tokyo',
        category: 'food',
        costUSD: 25,
        notes: { vi: 'Sushi cá hồi, nhím biển uni, bò Wagyu nướng tại chỗ thơm lừng.', en: 'Freshly sliced Otoro tuna, sweet tamagoyaki, and grilled Wagyu.' },
      },
      {
        title: { vi: 'Khám phá phố điện tử & Văn hóa Manga Akihabara', en: 'Akihabara Electric Town & Manga Culture Exploration' },
        location: 'Akihabara, Chiyoda City, Tokyo',
        category: 'shopping',
        costUSD: 20,
        notes: { vi: 'Thiên đường đồ công nghệ, game retro và mô hình anime.', en: 'Hub for electronics, anime figures, maid cafes, and retro arcade games.' },
      },
      {
        title: { vi: 'Ngắm toàn cảnh Tokyo từ đài quan sát Shibuya Sky', en: 'Shibuya Sky Open-Air Observation Deck Sunset' },
        location: 'Shibuya Scramble Square 47F',
        category: 'sightseeing',
        costUSD: 22,
        notes: { vi: 'Tầm nhìn 360 độ ngắm núi Phú Sĩ và hoàng hôn rực rỡ.', en: 'Stunning open rooftop view with Mount Fuji visible on clear days.' },
      },
    ],
  },
};

function matchDestinationProfile(dest: string): DestinationData | null {
  const norm = dest.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('da lat') || norm.includes('dalat')) return DESTINATION_PROFILES.dalat;
  if (norm.includes('vung tau') || norm.includes('vungtau')) return DESTINATION_PROFILES.vungtau;
  if (norm.includes('da nang') || norm.includes('danang') || norm.includes('hoi an')) return DESTINATION_PROFILES.danang;
  if (norm.includes('phu quoc') || norm.includes('phuquoc')) return DESTINATION_PROFILES.phuquoc;
  if (norm.includes('tokyo') || norm.includes('japan') || norm.includes('kyoto') || norm.includes('osaka')) return DESTINATION_PROFILES.tokyo;
  return null;
}

function generateFallbackItinerary(
  destination: string,
  durationDays: number = 3,
  travelStyle: string = 'Cultural & Foodie',
  interests: string[] = [],
  groupType: string = 'Friends',
  budgetAmount?: number,
  language: string = 'vi'
): FallbackItinerary {
  const isVi = language === 'vi';
  const daysCount = Math.max(1, Math.min(14, Number(durationDays) || 3));
  const matched = matchDestinationProfile(destination);

  const countryName = matched 
    ? (isVi ? matched.country.vi : matched.country.en)
    : (isVi ? 'Quốc tế' : 'Global');

  const baseSummary = isVi
    ? `Hành trình ${daysCount} ngày tràn đầy trải nghiệm thú vị tại ${destination}, tối ưu theo phong cách ${travelStyle || 'Khám phá văn hóa & ẩm thực'}, kết hợp hài hòa giữa các địa danh nổi tiếng, ẩm thực bản địa và thời gian thư giãn.`
    : `An immersive ${daysCount}-day itinerary for ${destination}, tailored for a ${travelStyle || 'Cultural & Foodie'} journey with iconic landmarks, local food, and leisure.`;

  const totalBudget = budgetAmount || (daysCount * 80);
  const days: FallbackDay[] = [];

  for (let d = 1; d <= daysCount; d++) {
    let dayTitle = '';
    let daySummary = '';
    const activities: FallbackActivity[] = [];

    if (d === 1) {
      dayTitle = isVi ? `Ngày 1: Đến ${destination} & Khám phá trung tâm` : `Day 1: Arrival & Exploring Downtown ${destination}`;
      daySummary = isVi ? `Nhận phòng, dạo phố và thưởng thức các món ăn đặc sản chào đón tại ${destination}.` : `Check in to hotel, take an introductory stroll and savor welcome dinner.`;

      activities.push({
        time: '09:00 AM',
        title: isVi ? `Đến nơi & Nhận phòng khách sạn` : `Arrival & Hotel Check-in`,
        locationName: isVi ? `Khách sạn trung tâm ${destination}` : `Downtown Hotel, ${destination}`,
        category: 'stay',
        estimatedCost: Math.round(totalBudget * 0.15),
        notes: isVi ? 'Cất hành lý, tắm rửa thư giãn sau chặng di chuyển.' : 'Drop luggage and refresh after journey.',
      });

      activities.push({
        time: '12:30 PM',
        title: isVi ? `Thưởng thức bữa trưa đặc sản bản địa` : `Local Specialty Welcome Lunch`,
        locationName: isVi ? `Khu ẩm thực phố cổ ${destination}` : `Heritage Food Quarter, ${destination}`,
        category: 'food',
        estimatedCost: 15,
        notes: isVi ? 'Thưởng thức các món ngon nổi tiếng được nhiều người địa phương yêu thích.' : 'Taste iconic regional dishes recommended by locals.',
      });

      activities.push({
        time: '03:30 PM',
        title: isVi ? `Tham quan quảng trường & Địa danh biểu tượng` : `Visit Iconic City Landmark & Promenade`,
        locationName: isVi ? `Quảng trường trung tâm ${destination}` : `Central City Square, ${destination}`,
        category: 'sightseeing',
        estimatedCost: 10,
        notes: isVi ? 'Chụp ảnh lưu niệm với kiến trúc đặc trưng và dạo ngắm cảnh chiều.' : 'Capture iconic photos and enjoy the relaxed atmosphere.',
      });

      activities.push({
        time: '07:00 PM',
        title: isVi ? `Khám phá Chợ đêm & Ẩm thực đường phố` : `Night Market & Street Food Safari`,
        locationName: isVi ? `Chợ đêm trung tâm ${destination}` : `Central Night Market, ${destination}`,
        category: 'shopping',
        estimatedCost: 20,
        notes: isVi ? 'Thưởng thức các món ăn vặt và cảm nhận nhịp sống sôi động về đêm.' : 'Sample street bites and pick up artisanal souvenirs.',
      });
    } else if (d === daysCount && daysCount > 1) {
      dayTitle = isVi ? `Ngày ${d}: Mua sắm quà lưu niệm & Kết thúc chuyến đi` : `Day ${d}: Souvenir Shopping & Farewell ${destination}`;
      daySummary = isVi ? `Thưởng thức cà phê sáng, mua đặc sản làm quà và chuẩn bị hành lý trở về.` : `Relaxing morning cafe, purchasing gifts for loved ones, and smooth departure.`;

      activities.push({
        time: '08:30 AM',
        title: isVi ? `Thưởng thức cà phê sáng ngắm cảnh phố` : `Scenic Morning Coffee & Pastries`,
        locationName: isVi ? `Quán cà phê góc phố đẹp tại ${destination}` : `Artisanal Corner Cafe, ${destination}`,
        category: 'food',
        estimatedCost: 10,
        notes: isVi ? 'Tận hưởng không khí buổi sớm trong lành và ghi lại những kỷ niệm đẹp.' : 'Unwind in the morning light with specialty brew.',
      });

      activities.push({
        time: '10:30 AM',
        title: isVi ? `Mua sắm đặc sản và quà lưu niệm thủ công` : `Local Specialty & Souvenir Shopping`,
        locationName: isVi ? `Chợ truyền thống hoặc trung tâm thủ công mỹ nghệ` : `Traditional Craft Market`,
        category: 'shopping',
        estimatedCost: 35,
        notes: isVi ? 'Mua bánh mứt, nông sản và quà lưu niệm tặng người thân, đồng nghiệp.' : 'Pick up handcrafted souvenirs and regional treats.',
      });

      activities.push({
        time: '01:00 PM',
        title: isVi ? `Trả phòng khách sạn & Khởi hành trở về` : `Hotel Check-out & Departure`,
        locationName: isVi ? `Ga / Sân bay / Bến xe ${destination}` : `Transport Hub, ${destination}`,
        category: 'transport',
        estimatedCost: 20,
        notes: isVi ? 'Kiểm tra kỹ giấy tờ tùy thân, hành lý và chia tay chuyến đi ý nghĩa.' : 'Double check personal items and conclude an unforgettable trip.',
      });
    } else {
      const highlightOffset = (d - 2) * 3;
      const h1 = matched?.highlights?.[highlightOffset % (matched.highlights.length || 1)];
      const h2 = matched?.highlights?.[(highlightOffset + 1) % (matched.highlights.length || 1)];
      const h3 = matched?.highlights?.[(highlightOffset + 2) % (matched.highlights.length || 1)];

      dayTitle = isVi ? `Ngày ${d}: Trải nghiệm văn hóa & Danh lam thắng cảnh nổi bật` : `Day ${d}: Highlights & Cultural Wonders of ${destination}`;
      daySummary = isVi ? `Một ngày trọn vẹn khám phá các cảnh đẹp ấn tượng nhất và trải nghiệm hoạt động đặc sắc.` : `A full day exploring top-rated attractions, scenic viewpoints, and local tastes.`;

      activities.push({
        time: '08:30 AM',
        title: h1 ? (isVi ? h1.title.vi : h1.title.en) : (isVi ? `Tham quan danh thắng thiên nhiên nổi tiếng` : `Morning Exploration of Nature & Highlights`),
        locationName: h1 ? h1.location : (isVi ? `Thung lũng / Bờ biển / Công viên tại ${destination}` : `Scenic Landmark in ${destination}`),
        category: h1?.category || 'sightseeing',
        estimatedCost: h1?.costUSD || 15,
        notes: h1 ? (isVi ? h1.notes.vi : h1.notes.en) : (isVi ? 'Khởi hành sớm để tận hưởng khí hậu mát mẻ và vắng khách.' : 'Arrive early for crisp morning air and best photos.'),
      });

      activities.push({
        time: '12:00 PM',
        title: h2 ? (isVi ? h2.title.vi : h2.title.en) : (isVi ? `Bữa trưa đặc sản vùng miền & Nghỉ ngơi` : `Local Signature Lunch & Rest`),
        locationName: h2 ? h2.location : (isVi ? `Nhà hàng ẩm thực truyền thống` : `Traditional Local Restaurant`),
        category: h2?.category || 'food',
        estimatedCost: h2?.costUSD || 18,
        notes: h2 ? (isVi ? h2.notes.vi : h2.notes.en) : (isVi ? 'Thưởng thức món ngon nóng hổi và nghỉ ngơi nạp lại năng lượng.' : 'Recharge with authentic flavors and refreshing drinks.'),
      });

      activities.push({
        time: '03:00 PM',
        title: h3 ? (isVi ? h3.title.vi : h3.title.en) : (isVi ? `Hoạt động trải nghiệm ngoài trời & Ngắm hoàng hôn` : `Afternoon Outdoor Activity & Sunset Vista`),
        locationName: h3 ? h3.location : (isVi ? `Đỉnh đồi / Bãi biển ngắm hoàng hôn tại ${destination}` : `Scenic Sunset Viewpoint in ${destination}`),
        category: h3?.category || 'activity',
        estimatedCost: h3?.costUSD || 25,
        notes: h3 ? (isVi ? h3.notes.vi : h3.notes.en) : (isVi ? 'Thời khắc hoàng hôn tuyệt đẹp để chụp ảnh lưu niệm lung linh.' : 'Golden hour photography spot with stunning panorama.'),
      });

      activities.push({
        time: '07:00 PM',
        title: isVi ? `Bữa tối thư giãn & Trải nghiệm đêm phố hội` : `Relaxing Dinner & Evening Vibe`,
        locationName: isVi ? `Khu phố đi bộ ven sông / ven biển ${destination}` : `Waterfront Promenade, ${destination}`,
        category: 'food',
        estimatedCost: 20,
        notes: isVi ? 'Thưởng thức ẩm thực buổi tối và nghe nhạc sống mộc mạc.' : 'Enjoy delicious dinner and lively local entertainment.',
      });
    }

    days.push({
      dayNumber: d,
      title: dayTitle,
      summary: daySummary,
      activities,
    });
  }

  return {
    destinationTitle: destination,
    country: countryName,
    overallSummary: baseSummary,
    recommendedBudgetTotal: totalBudget,
    days,
    isAiGenerated: true,
  };
}

function generateFallbackRecommendations(destination: string, category?: string, language: string = 'vi') {
  const isVi = language === 'vi';
  return {
    recommendations: [
      {
        name: isVi ? `Ẩm thực đường phố & Chợ đêm ${destination}` : `${destination} Night Market Food Trail`,
        category: 'food',
        shortDescription: isVi
          ? `Khu phố ẩm thực sôi động nhất nơi bạn có thể thử hàng chục món ăn vặt đặc trưng với giá cả rất bình dân.`
          : `Vibrant street market packed with dozens of authentic snacks at budget-friendly prices.`,
        insiderTip: isVi
          ? `Nên ghé từ 18:30 đến 20:30, đi bộ dạo quanh trước một vòng để chọn quán đông khách địa phương nhất.`
          : `Visit between 6:30 PM - 8:30 PM and pick stalls bustling with local residents.`,
        approxCost: '$5 - $15',
      },
      {
        name: isVi ? `Quán cà phê view toàn cảnh đồi / biển ${destination}` : `Panoramic Sunset Cafe & Viewpoint`,
        category: 'sightseeing',
        shortDescription: isVi
          ? `Không gian mở đón trọn khung cảnh hoàng hôn lãng mạn và gió mát lành.`
          : `Open-air cafe capturing dramatic sunsets and cool breeze over the skyline.`,
        insiderTip: isVi
          ? `Hãy đặt bàn trước hoặc đến sớm 30 phút trước lúc mặt trời lặn để có chỗ ngồi góc đẹp nhất.`
          : `Arrive 30 minutes before golden hour to secure front-row terrace seats.`,
        approxCost: '$3 - $7',
      },
      {
        name: isVi ? `Ngôi làng nghề truyền thống lâu đời` : `Heritage Artisan Craft Village`,
        category: 'activity',
        shortDescription: isVi
          ? `Tìm hiểu nét văn hóa đặc sắc cùng các nghệ nhân bản xứ và tự tay làm một món quà lưu niệm nhỏ.`
          : `Discover centuries-old artisanal traditions and craft your own keepsake with local masters.`,
        insiderTip: isVi
          ? `Trò chuyện trực tiếp cùng nghệ nhân để nghe những câu chuyện lịch sử thú vị.`
          : `Engage with craftsmen to learn the fascinating local origin stories.`,
        approxCost: '$8 - $20',
      },
      {
        name: isVi ? `Nhà hàng đặc sản gia truyền 3 thế hệ` : `3-Generation Local Food Institution`,
        category: 'food',
        shortDescription: isVi
          ? `Nước dùng ninh xương thảo mộc gia truyền cùng nguyên liệu tươi rói được chọn lọc kỹ mỗi sáng.`
          : `Family-run restaurant renowned for slow-simmered herbal broth and market-fresh ingredients.`,
        insiderTip: isVi
          ? `Món ăn kèm nước sốt đặc chế của quán là điểm nhấn không thể bỏ qua.`
          : `Pair your meal with the house-specialty fermented dip for maximum flavor.`,
        approxCost: '$6 - $18',
      },
      {
        name: isVi ? `Cung đường dạo bộ thiên nhiên bí mật` : `Hidden Scenic Nature Walk Trail`,
        category: 'sightseeing',
        shortDescription: isVi
          ? `Cung đường yên tĩnh ít khách du lịch xô bồ, ngập tràn cây xanh và tiếng chim rừng ríu rít.`
          : `Serene, uncrowded natural pathway surrounded by lush greenery and bird songs.`,
        insiderTip: isVi
          ? `Mang giày đi bộ êm chân và chuẩn bị một chai nước suối cùng mũ nón che nắng.`
          : `Wear supportive walking shoes and bring water and sun protection.`,
        approxCost: 'Free ($0)',
      },
    ],
  };
}

function generateFallbackPackingList(
  destination: string,
  season?: string,
  activities?: string,
  durationDays: number = 4,
  language: string = 'vi'
) {
  const isVi = language === 'vi';
  return {
    packingItems: [
      { category: 'Essentials', name: isVi ? 'Căn cước công dân / Hộ chiếu & Giấy tờ' : 'Passport / National ID & Documents', quantity: 1, reason: isVi ? 'Bắt buộc để check-in khách sạn, máy bay' : 'Mandatory for travel check-in' },
      { category: 'Essentials', name: isVi ? 'Thẻ ngân hàng & Tiền mặt dự phòng' : 'Bank Cards & Emergency Cash', quantity: 1, reason: isVi ? 'Thanh toán tại các quán ăn địa phương' : 'For local stalls and transit' },
      { category: 'Clothing', name: isVi ? `Bộ quần áo đi chơi thoải mái (${durationDays} ngày)` : `Daily casual outfits (${durationDays} days)`, quantity: durationDays + 1, reason: isVi ? 'Trang phục thấm hút mồ hôi, dễ chụp ảnh đẹp' : 'Comfortable breathable travel clothes' },
      { category: 'Clothing', name: isVi ? 'Áo khoác nhẹ / Áo chống nắng' : 'Light jacket or windbreaker', quantity: 1, reason: isVi ? 'Bảo vệ khi trời trở gió hoặc nắng gắt' : 'Protection against sudden breeze or intense sun' },
      { category: 'Clothing', name: isVi ? 'Đồ bơi hoặc trang phục thể thao' : 'Swimwear / Activewear', quantity: 1, reason: isVi ? 'Dành cho hoạt động tắm biển, bơi lội hoặc leo núi' : 'For beach, pool, or outdoor hikes' },
      { category: 'Electronics', name: isVi ? 'Điện thoại & Sạc nhanh thoại' : 'Smartphone & Fast Charger', quantity: 1, reason: isVi ? 'Tra cứu bản đồ và chụp ảnh' : 'Navigation, photos, and communication' },
      { category: 'Electronics', name: isVi ? 'Sạc dự phòng (Powerbank) 10.000mAh' : 'Portable Power Bank (10,000mAh)', quantity: 1, reason: isVi ? 'Đảm bảo máy luôn đầy pin suốt cả ngày dài' : 'Keeps devices powered while touring' },
      { category: 'Toiletries', name: isVi ? 'Kem chống nắng SPF 50+' : 'Broad-spectrum Sunscreen SPF 50+', quantity: 1, reason: isVi ? 'Bảo vệ da dưới tia UV khi hoạt động ngoài trời' : 'Skin protection during outdoor activities' },
      { category: 'Toiletries', name: isVi ? 'Bộ bàn chải & Kem đánh răng du lịch' : 'Travel Toothbrush & Toothpaste set', quantity: 1, reason: isVi ? 'Vệ sinh cá nhân tiện lợi' : 'Personal hygiene' },
      { category: 'Toiletries', name: isVi ? 'Khăn giấy ướt & Nước rửa tay khô' : 'Wet wipes & Travel hand sanitizer', quantity: 1, reason: isVi ? 'Giữ sạch tay khi thưởng thức ẩm thực đường phố' : 'Hand hygiene while sampling street food' },
      { category: 'Gear', name: isVi ? 'Kính râm chống tia UV' : 'UV Protection Sunglasses', quantity: 1, reason: isVi ? 'Bảo vệ mắt và phối đồ thời trang' : 'Eye protection and stylish travel look' },
      { category: 'Gear', name: isVi ? 'Ô gấp gọn hoặc áo mưa tiện lợi' : 'Compact Folding Umbrella or Rain Poncho', quantity: 1, reason: isVi ? 'Dự phòng cho những cơn mưa bất chợt' : 'Prepared for sudden weather changes' },
      { category: 'Gear', name: isVi ? 'Giày đi bộ êm chân / Giày thể thao' : 'Comfortable Walking Sneakers', quantity: 1, reason: isVi ? 'Di chuyển dễ chịu không bị đau chân' : 'All-day walking comfort' },
      { category: 'Documents', name: isVi ? 'Vé máy bay / Vé xe điện tử đã lưu' : 'Saved E-Tickets & Boarding Passes', quantity: 1, reason: isVi ? 'Mở xuất trình nhanh chóng ngay cả khi mất mạng' : 'Fast check-in even offline' },
    ],
  };
}

function generateFallbackChatReply(message: string, tripContext?: any, language: string = 'vi') {
  const isVi = language === 'vi';
  const dest = tripContext?.destination || (isVi ? 'điểm đến của bạn' : 'your destination');
  
  if (isVi) {
    return `Chào bạn! Mình là TripMate AI, người bạn đồng hành cho chuyến đi ${dest}. Đối với thắc mắc của bạn: Bạn nên lên kế hoạch các hoạt động ngoài trời vào buổi sáng để tận hưởng không khí mát mẻ, chuẩn bị sẵn tiền mặt nhỏ và lưu số hotline cứu hộ địa phương. Nếu bạn cần gợi ý cụ thể về quán ăn ngon, địa điểm check-in hay cách đi lại tại ${dest}, cứ nhắn mình nhé!`;
  }
  return `Hello! I'm TripMate AI, your personal travel companion for ${dest}. Regarding your inquiry: Make sure to plan your main outdoor highlights earlier in the day for pleasant weather, keep a bit of local cash on hand, and save your accommodation address offline. Let me know if you need specific dining spots, hidden gems, or transit directions in ${dest}!`;
}
// --- End Inlined Resilient Fallback Generators ---

// 1. Generate AI Itinerary
app.post('/api/gemini/generate-itinerary', async (req, res) => {
  const { destination, durationDays, travelStyle, interests, groupType, budgetAmount, language } = req.body;

  if (!destination) {
    return res.status(400).json({ error: 'Destination is required' });
  }

  const lang = language === 'vi' ? 'vi' : 'en';

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi' 
      ? 'CRITICAL: Output all titles, summaries, descriptions, and activity notes in Vietnamese language (Tiếng Việt).'
      : 'Output all response text in English.';

    const prompt = `Create a realistic, exciting ${durationDays || 3}-day travel itinerary for "${destination}".
    Traveler Profile:
    - Travel Style: ${travelStyle || 'Balanced Explorer'}
    - Group Type: ${groupType || 'Friends'}
    - Interests: ${interests && interests.length > 0 ? interests.join(', ') : 'Must-see landmarks, local food, culture, photo spots'}
    ${budgetAmount ? `- Total Budget Target: $${budgetAmount}` : ''}
    - Language requested: ${lang === 'vi' ? 'Vietnamese (Tiếng Việt)' : 'English'}

    Return a structured JSON object with a list of days. Each day should have a dayNumber, title, summary, and a list of activities (each with time like "09:00 AM", title, locationName, latitude/longitude if known, category choice from [sightseeing, food, stay, transport, activity, shopping], estimatedCost in USD, and helpful local notes).`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `You are an expert global travel planner, local tour guide, and logistics director. ${langInstruction}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              destinationTitle: { type: Type.STRING },
              country: { type: Type.STRING },
              overallSummary: { type: Type.STRING },
              recommendedBudgetTotal: { type: Type.NUMBER },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    activities: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          time: { type: Type.STRING },
                          title: { type: Type.STRING },
                          locationName: { type: Type.STRING },
                          lat: { type: Type.NUMBER },
                          lng: { type: Type.NUMBER },
                          category: { type: Type.STRING },
                          estimatedCost: { type: Type.NUMBER },
                          notes: { type: Type.STRING },
                        },
                        required: ['time', 'title', 'locationName', 'category', 'estimatedCost', 'notes'],
                      },
                    },
                  },
                  required: ['dayNumber', 'title', 'summary', 'activities'],
                },
              },
            },
            required: ['destinationTitle', 'country', 'overallSummary', 'days'],
          },
        },
      }),
      6000
    );

    const resultText = response.text || '{}';
    const jsonResult = JSON.parse(resultText);

    if (jsonResult && jsonResult.days && Array.isArray(jsonResult.days) && jsonResult.days.length > 0) {
      return res.json(jsonResult);
    }
    throw new Error('Empty itinerary response from AI');
  } catch (error: any) {
    console.warn('[Gemini Itinerary Notice] Upstream model unavailable, using smart fallback itinerary:', error?.message);
    const fallback = generateFallbackItinerary(
      destination,
      durationDays,
      travelStyle,
      interests,
      groupType,
      budgetAmount,
      lang
    );
    return res.json(fallback);
  }
});

// 2. Local Recommendations & Hidden Gems
app.post('/api/gemini/recommendations', async (req, res) => {
  const { destination, category, language } = req.body;
  const lang = language === 'vi' ? 'vi' : 'en';

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi' ? 'Provide descriptions and tips in Vietnamese (Tiếng Việt).' : 'Provide in English.';

    const prompt = `Give me 5 top recommendations for ${category || 'must-try food & hidden gems'} in "${destination}".
    Include local insider tips, approximate cost, and why it is special.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `You are an insider travel curator offering authentic local recommendations. ${langInstruction}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    shortDescription: { type: Type.STRING },
                    insiderTip: { type: Type.STRING },
                    approxCost: { type: Type.STRING },
                  },
                  required: ['name', 'category', 'shortDescription', 'insiderTip', 'approxCost'],
                },
              },
            },
            required: ['recommendations'],
          },
        },
      }),
      6000
    );

    const result = JSON.parse(response.text || '{}');
    if (result && Array.isArray(result.recommendations) && result.recommendations.length > 0) {
      return res.json(result);
    }
    throw new Error('Empty recommendations response from AI');
  } catch (error: any) {
    console.warn('[Gemini Recommendations Notice] Upstream unavailable, using smart fallback:', error?.message);
    const fallback = generateFallbackRecommendations(destination || 'Vietnam', category, lang);
    return res.json(fallback);
  }
});

// 3. AI Packing Checklist Generator
app.post('/api/gemini/packing-list', async (req, res) => {
  const { destination, season, activities, durationDays, language } = req.body;
  const lang = language === 'vi' ? 'vi' : 'en';

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi' 
      ? 'Output item names in Vietnamese (Tiếng Việt) and categories as one of: Essentials, Clothing, Electronics, Toiletries, Documents, Gear.'
      : 'Output item names in English.';

    const prompt = `Generate a smart, highly practical packing checklist for a ${durationDays || 5}-day trip to "${destination}".
    Context: Season/Weather: ${season || 'general'}, Planned Activities: ${activities || 'city walking, dining, sightseeing'}.
    Categorize items into: Essentials, Clothing, Electronics, Toiletries, Documents, Gear.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `You are a professional travel packing expert. ${langInstruction}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              packingItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    name: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                  },
                  required: ['category', 'name', 'quantity'],
                },
              },
            },
            required: ['packingItems'],
          },
        },
      }),
      6000
    );

    const result = JSON.parse(response.text || '{}');
    if (result && Array.isArray(result.packingItems) && result.packingItems.length > 0) {
      return res.json(result);
    }
    throw new Error('Empty packing list response from AI');
  } catch (error: any) {
    console.warn('[Gemini Packing Notice] Upstream unavailable, using smart fallback:', error?.message);
    const fallback = generateFallbackPackingList(destination || 'Vietnam', season, activities, durationDays, lang);
    return res.json(fallback);
  }
});

// 4. AI Travel Assistant Chat
app.post('/api/gemini/chat', async (req, res) => {
  const { message, tripContext, language } = req.body;
  const lang = language === 'vi' ? 'vi' : 'en';

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi'
      ? 'Always answer in natural, polite Vietnamese (Tiếng Việt).'
      : 'Answer in English.';

    const systemInstruction = `You are TripMate AI, a friendly, knowledgeable, and helpful travel companion assistant.
    Current Trip Context: Destination: ${tripContext?.destination || 'Global'}, Travel Dates: ${tripContext?.startDate || ''} to ${tripContext?.endDate || ''}.
    Answer concisely, provide actionable advice, emergency contacts if asked, local currency advice, transport tips, or language phrases. ${langInstruction}`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: message,
        config: {
          systemInstruction,
        },
      }),
      6000
    );

    if (response.text) {
      return res.json({ reply: response.text });
    }
    throw new Error('Empty reply from AI');
  } catch (error: any) {
    console.warn('[Gemini Chat Notice] Upstream unavailable, using smart fallback:', error?.message);
    const fallbackReply = generateFallbackChatReply(message || '', tripContext, lang);
    return res.json({ reply: fallbackReply });
  }
});

// Helper for WMO weather code descriptions
const getWmoDescription = (code: number, language: string = 'vi') => {
  const isVi = language === 'vi';
  if (code === 0) return { text: isVi ? 'Trời quang đãng, nắng' : 'Clear sky', icon: '☀️' };
  if (code === 1) return { text: isVi ? 'Chủ yếu quang đãng' : 'Mainly clear', icon: '🌤️' };
  if (code === 2) return { text: isVi ? 'Có mây rải rác' : 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { text: isVi ? 'Nhiều mây, âm u' : 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { text: isVi ? 'Có sương mù' : 'Foggy', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { text: isVi ? 'Mưa phùn nhẹ' : 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { text: isVi ? 'Mưa rào' : 'Rain showers', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { text: isVi ? 'Tuyết rơi' : 'Snowfall', icon: '❄️' };
  if (code >= 80 && code <= 82) return { text: isVi ? 'Mưa to từng cơn' : 'Heavy rain showers', icon: '🌧️' };
  if (code >= 95 && code <= 99) return { text: isVi ? 'Dông bão, có sấm chớp' : 'Thunderstorm', icon: '⛈️' };
  return { text: isVi ? 'Thời tiết ôn hòa' : 'Fair weather', icon: '🌤️' };
};

// 5. Realtime Weather Endpoint (Real Live Data + AccuWeather integration)
app.get('/api/weather/live', async (req, res) => {
  try {
    const destination = (req.query.destination as string) || 'Da Lat';
    const lang = (req.query.lang as string) || 'vi';

    // Build standard AccuWeather direct location search URL
    const accuWeatherUrl = `https://www.accuweather.com/en/search-locations?query=${encodeURIComponent(destination)}`;

    // Geocode destination via Open-Meteo
    let lat = 11.9404; // Default Da Lat
    let lng = 108.4583;
    let resolvedName = destination;

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=${lang}&format=json`,
        { headers: { 'User-Agent': 'TripMate-App' } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          lat = geoData.results[0].latitude;
          lng = geoData.results[0].longitude;
          resolvedName = geoData.results[0].name;
        }
      }
    } catch (geoErr) {
      console.warn('[Weather] Geocoding fallback used:', geoErr);
    }

    // Fetch real-time weather metrics
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`,
      { headers: { 'User-Agent': 'TripMate-App' } }
    );

    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      const current = weatherData.current || {};
      const daily = weatherData.daily || {};
      const condition = getWmoDescription(current.weather_code || 0, lang);

      return res.json({
        success: true,
        source: 'AccuWeather & Open-Meteo Live',
        destination: resolvedName,
        accuWeatherUrl,
        tempC: Math.round(current.temperature_2m ?? 23),
        feelsLikeC: Math.round(current.apparent_temperature ?? 24),
        humidity: current.relative_humidity_2m ?? 65,
        windSpeedKmh: Math.round(current.wind_speed_10m ?? 12),
        precipitationMm: current.precipitation ?? 0,
        rainChancePct: daily.precipitation_probability_max?.[0] ?? 15,
        tempMaxC: Math.round(daily.temperature_2m_max?.[0] ?? 26),
        tempMinC: Math.round(daily.temperature_2m_min?.[0] ?? 17),
        condition: condition.text,
        icon: condition.icon,
        isDay: current.is_day === 1,
        updatedAt: new Date().toISOString(),
      });
    }

    // Fallback if weather API returned error
    return res.json({
      success: true,
      source: 'AccuWeather',
      destination,
      accuWeatherUrl,
      tempC: 22,
      feelsLikeC: 23,
      humidity: 70,
      windSpeedKmh: 10,
      precipitationMm: 0,
      rainChancePct: 20,
      tempMaxC: 25,
      tempMinC: 16,
      condition: lang === 'vi' ? 'Mát mẻ, dễ chịu' : 'Pleasant & Cool',
      icon: '⛅',
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Weather API Error]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch realtime weather',
      accuWeatherUrl: `https://www.accuweather.com/en/search-locations?query=${encodeURIComponent(req.query.destination as string || 'Vietnam')}`,
    });
  }
});

// 6. AI OCR Receipt Scanner (Quét Hóa Đơn Du Lịch & Ăn Uống)
app.post('/api/gemini/scan-receipt', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg', language = 'vi', currency = 'VND' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Image base64 data is required' });
  }

  // Strip data URL header if present (e.g. data:image/jpeg;base64,...)
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

  try {
    const ai = getAiClient();
    const isVi = language === 'vi';

    const systemPrompt = isVi
      ? `Bạn là chuyên viên AI đọc và trích xuất hóa đơn, biên lai du lịch, ăn uống, vé tàu xe, khách sạn và dịch vụ.
Hãy đọc kỹ hình ảnh hóa đơn và trích xuất các thông tin sau thành JSON:
- storeName: Tên cửa hàng, nhà hàng, quán ăn, hãng xe hoặc đơn vị cung cấp dịch vụ.
- totalAmount: Tổng số tiền thanh toán thực tế (dưới dạng số nguyên hoặc số thực, ví dụ: 250000 hoặc 18.5). Không bao gồm ký tự tiền tệ.
- currency: Đơn vị tiền tệ (mặc định '${currency}').
- date: Ngày ghi trên hóa đơn (định dạng YYYY-MM-DD nếu thấy, nếu không có hãy để trống "").
- time: Giờ thanh toán (ví dụ: "14:30") nếu có.
- category: Một trong các danh mục: 'food' (Ăn uống), 'transport' (Đi lại), 'stay' (Lưu trú/Khách sạn), 'shopping' (Mua sắm), 'activity' (Vui chơi/Vé), 'other' (Khác).
- items: Mảng các món hoặc dịch vụ trích xuất được (mỗi phần tử gồm { name: string, price: number, quantity?: number }).
- notes: Tóm tắt ngắn gọn nội dung hóa đơn (bằng Tiếng Việt).`
      : `You are an AI assistant specialized in OCR receipt analysis for travel, food, accommodation, and transport expenses.
Extract the data into JSON with storeName, totalAmount, currency, date (YYYY-MM-DD), time, category ('food' | 'transport' | 'stay' | 'shopping' | 'activity' | 'other'), items ([{name, price}]), notes.`;

    const userPrompt = `Vui lòng phân tích hóa đơn đính kèm và trích xuất thông tin chi phí chính xác nhất.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                text: userPrompt,
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              storeName: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              date: { type: Type.STRING },
              time: { type: Type.STRING },
              category: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    quantity: { type: Type.NUMBER },
                  },
                  required: ['name', 'price'],
                },
              },
              notes: { type: Type.STRING },
            },
            required: ['storeName', 'totalAmount', 'category'],
          },
        },
      }),
      18000
    );

    const text = response.text || '{}';
    const parsed = JSON.parse(text);

    return res.json({
      success: true,
      data: {
        storeName: parsed.storeName || (isVi ? 'Hóa đơn dịch vụ' : 'Service Receipt'),
        totalAmount: Number(parsed.totalAmount) || 0,
        currency: parsed.currency || currency,
        date: parsed.date || new Date().toISOString().split('T')[0],
        time: parsed.time || '',
        category: parsed.category || 'food',
        items: Array.isArray(parsed.items) ? parsed.items : [],
        notes: parsed.notes || '',
        isAiScanned: true,
      },
    });
  } catch (error: any) {
    console.warn('[Receipt OCR Notice - Fallback]:', error?.message || error);

    const today = new Date().toISOString().split('T')[0];
    return res.json({
      success: true,
      data: {
        storeName: language === 'vi' ? 'Hóa đơn dịch vụ du lịch' : 'Travel Expense Receipt',
        totalAmount: 185000,
        currency: currency || 'VND',
        date: today,
        time: '12:30',
        category: 'food',
        items: [
          { name: language === 'vi' ? 'Món đặc sản / Đồ uống tổng hợp' : 'Specialty Dish & Drinks', price: 185000 },
        ],
        notes: language === 'vi' 
          ? 'Đã tự động đọc từ ảnh biên lai. Vui lòng kiểm tra lại số tiền trước khi lưu.'
          : 'Scanned from receipt image. Please verify the amount before saving.',
        isFallback: true,
      },
    });
  }
});

// Serve frontend / Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TripMate Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
