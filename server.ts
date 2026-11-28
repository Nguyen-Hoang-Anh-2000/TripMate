import express from 'express';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  mergeSavedAndGeneratedIntoDays,
  convertCurrencyApprox,
  computePraiseScore,
  rankSavedPlacesForTrip,
  areSimilarPlaceNames,
  type RankedPlaceCandidate,
} from './src/utils/itineraryPlannerUtils.ts';
import {
  normalizeChatCacheKey,
  generateSmartFallbackChatReply,
} from './src/utils/chatFallbackUtils.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Handle PayloadTooLarge and SyntaxErrors gracefully as JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      success: false,
      error: 'Dung lượng tải lên vượt quá giới hạn (tối đa 4MB). Vui lòng chọn ảnh có kích thước nhỏ hơn.',
    });
  }
  if (err instanceof SyntaxError) {
    return res.status(400).json({ success: false, error: 'Dữ liệu JSON không hợp lệ.' });
  }
  next(err);
});

// In-memory IP rate limiter to protect Gemini quota & abuse
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
app.use('/api', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 60; // 60 requests per minute

  const record = ipRequestCounts.get(ip);
  if (!record || now > record.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Quá nhiều yêu cầu từ thiết bị này. Vui lòng chờ 1 phút trước khi thử lại.',
    });
  }
  next();
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

function getAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper for timing out slow upstream requests
function withTimeout<T>(promise: Promise<T>, ms: number = 12000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Upstream request timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// --- Gemini Quota Resilience: Model Fallback Chain, 429 Cooldown & TTL Cache ---
const GEMINI_MODEL_CHAIN = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
const modelCooldownUntil = new Map<string, number>();
const geminiResponseCache = new Map<string, { expiresAt: number; data: any }>();

function isQuotaOrRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.code;
  if (status === 429) return true;
  const msg = String(err?.message || err || '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('"code":429') ||
    msg.toLowerCase().includes('quota exceeded') ||
    msg.toLowerCase().includes('rate limit')
  );
}

function parseRetryDelayMs(err: any): number {
  const msg = String(err?.message || '');
  const match = msg.match(/retryDelay["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)s/i);
  if (match) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(60 * 60 * 1000, Math.max(60 * 1000, seconds * 1000));
    }
  }
  return 15 * 60 * 1000;
}

function getCachedGeminiResponse<T>(key: string): T | null {
  const hit = geminiResponseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    geminiResponseCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCachedGeminiResponse(key: string, data: any, ttlMs: number = 10 * 60 * 1000) {
  if (geminiResponseCache.size >= 150) {
    const firstKey = geminiResponseCache.keys().next().value;
    if (firstKey !== undefined) geminiResponseCache.delete(firstKey);
  }
  geminiResponseCache.set(key, { expiresAt: Date.now() + ttlMs, data });
}

async function generateWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: Record<string, any>;
    timeoutMs?: number;
    allowThinking?: boolean;
  }
) {
  const totalBudgetMs = Math.max(1500, params.timeoutMs ?? 9000);
  const deadline = Date.now() + totalBudgetMs;
  let lastError: any = null;
  let quotaHit = false;

  for (let i = 0; i < GEMINI_MODEL_CHAIN.length; i++) {
    const model = GEMINI_MODEL_CHAIN[i];
    const now = Date.now();
    const cooldownUntil = modelCooldownUntil.get(model) ?? 0;
    if (cooldownUntil > now) {
      quotaHit = true;
      continue;
    }

    const remainingMs = deadline - now;
    if (remainingMs <= 250) {
      lastError = lastError || new Error(`Upstream deadline exceeded (${totalBudgetMs}ms)`);
      break;
    }

    const perModelBudgetMs =
      i === 0 && GEMINI_MODEL_CHAIN.length > 1
        ? Math.min(remainingMs, Math.max(3000, Math.floor(totalBudgetMs * 0.65)))
        : remainingMs;

    const baseConfig = params.config ? { ...params.config } : {};
    if (params.allowThinking) {
      baseConfig.thinkingConfig = {
        thinkingLevel: model === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
      };
    } else {
      delete baseConfig.thinkingConfig;
    }

    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: baseConfig,
        }),
        perModelBudgetMs
      );
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      if (isQuotaOrRateLimitError(err)) {
        quotaHit = true;
        const delayMs = parseRetryDelayMs(err);
        modelCooldownUntil.set(model, Date.now() + delayMs);
        console.info(`[Gemini Quota] ${model} reached rate limit; switching to fallback model for ${Math.round(delayMs / 60000)}m.`);
        continue;
      }
      // Retry transient non-quota error on secondary model within remaining total deadline
      continue;
    }
  }

  const finalError: any = new Error(quotaHit ? 'GEMINI_QUOTA_EXCEEDED' : (lastError?.message || 'GEMINI_UPSTREAM_UNAVAILABLE'));
  finalError.isQuotaExceeded = quotaHit;
  throw finalError;
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

interface DestinationHighlight {
  title: { vi: string; en: string };
  location: string;
  category: 'sightseeing' | 'food' | 'stay' | 'transport' | 'activity' | 'shopping';
  costUSD: number;
  rating: number;
  notes: { vi: string; en: string };
}

interface DestinationData {
  country: { vi: string; en: string };
  highlights: DestinationHighlight[];
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
        rating: 4.8,
        notes: { vi: 'Nhận phòng, nghỉ ngơi và ngắm mây lãng đãng tại quán cà phê trên cao.', en: 'Check-in, relax and enjoy the misty mountain view.' },
      },
      {
        title: { vi: 'Dạo quanh Hồ Xuân Hương & Quảng trường Lâm Viên', en: 'Stroll around Xuan Huong Lake & Lam Vien Square' },
        location: 'Hồ Xuân Hương, Đà Lạt',
        category: 'sightseeing',
        costUSD: 5,
        rating: 4.9,
        notes: { vi: 'Chụp ảnh với nụ hoa Atiso và hoa dã quỳ khổng lồ biểu tượng.', en: 'Iconic artichoke bud landmark and refreshing lakeside walk.' },
      },
      {
        title: { vi: 'Thưởng thức Lẩu gà lá é Tao Ngộ & Bánh tráng nướng', en: 'Famous Tao Ngo Chicken Hotpot & Vietnamese Pizza' },
        location: 'Đường 3 Tháng 4, Phường 3, Đà Lạt',
        category: 'food',
        costUSD: 15,
        rating: 4.9,
        notes: { vi: 'Món lẩu trứ danh làm ấm người giữa không khí se lạnh buổi tối.', en: 'Steaming hotpot with wild lemon basil leaves, a Dalat specialty.' },
      },
      {
        title: { vi: 'Khám phá Chợ Đêm Đà Lạt & Phố đi bộ', en: 'Explore Dalat Night Market & Walking Street' },
        location: 'Chợ Đêm Đà Lạt, Nguyễn Thị Minh Khai',
        category: 'shopping',
        costUSD: 10,
        rating: 4.7,
        notes: { vi: 'Thưởng thức sữa đậu nành nóng hổi, mua mứt dâu và áo len.', en: 'Hot soymilk, strawberry jam, and cozy local souvenirs.' },
      },
      {
        title: { vi: 'Săn mây bình minh tại Đồi Chè Cầu Đất', en: 'Sunrise Cloud Hunting at Cau Dat Tea Hill' },
        location: 'Cầu Đất, Xuân Trường, Đà Lạt',
        category: 'activity',
        costUSD: 12,
        rating: 5.0,
        notes: { vi: 'Nên xuất phát từ 05:00 sáng để bắt trọn biển mây bồng bềnh tuyệt đẹp.', en: 'Depart early around 5 AM to catch breathtaking sea of clouds.' },
      },
      {
        title: { vi: 'Tham quan Dinh 3 Bảo Đại & Rừng thông', en: 'Visit Bao Dai Summer Palace & Pine Forest' },
        location: 'Triệu Việt Vương, Phường 4, Đà Lạt',
        category: 'sightseeing',
        costUSD: 8,
        rating: 4.7,
        notes: { vi: 'Kiến trúc Pháp cổ kính cùng không gian lịch sử hoàng gia triều Nguyễn.', en: 'Historic royal French-architecture residence surrounded by pines.' },
      },
      {
        title: { vi: 'Trải nghiệm máng trượt Thác Datanla', en: 'Alpine Coaster Adventure at Datanla Waterfall' },
        location: 'Quốc lộ 20 Đèo Prenn, Đà Lạt',
        category: 'activity',
        costUSD: 20,
        rating: 4.8,
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
        rating: 4.7,
        notes: { vi: 'Bãi biển dài trong xanh, sóng êm thích hợp tắm biển buổi chiều.', en: 'Long golden sand beach ideal for swimming.' },
      },
      {
        title: { vi: 'Thưởng thức Bánh khọt Gốc Vú Sữa gia truyền', en: 'Famous Goc Vu Sua Mini Crispy Savory Pancakes' },
        location: '14 Nguyễn Trường Tộ, Phường 2, Vũng Tàu',
        category: 'food',
        costUSD: 10,
        rating: 4.9,
        notes: { vi: 'Bánh khọt tôm tươi giòn rụm cuốn rau sống và nước mắm chua ngọt.', en: 'Iconic crisp pancake with fresh shrimp and herbs.' },
      },
      {
        title: { vi: 'Chinh phục Tượng Chúa Kytô Vua & Ngắm toàn cảnh biển', en: 'Climb Christ the King Statue for Panoramic View' },
        location: 'Núi Nhỏ, Phường 2, Vũng Tàu',
        category: 'sightseeing',
        costUSD: 0,
        rating: 4.9,
        notes: { vi: 'Leo gần 1.000 bậc thang để lên tay tượng Chúa ngắm trọn vẹn vịnh biển.', en: 'Climb to the shoulders for a breathtaking 360 ocean view.' },
      },
      {
        title: { vi: 'Check-in Mũi Nghinh Phong & Cổng Trời biển', en: 'Nghinh Phong Cape & Seaside Sky Gate' },
        location: 'Đường Hạ Long, Phường 2, Vũng Tàu',
        category: 'sightseeing',
        costUSD: 0,
        rating: 4.9,
        notes: { vi: 'Điểm đón gió mát rượi với góc chụp hoàng hôn siêu đẹp.', en: 'Scenic windy cliff with dramatic sunset photography.' },
      },
      {
        title: { vi: 'Tiệc hải sản tươi sống tại Chợ đêm Vũng Tàu', en: 'Fresh Seafood Feast at Night Market' },
        location: 'Sau khách sạn Imperial, Bãi Sau, Vũng Tàu',
        category: 'food',
        costUSD: 25,
        rating: 4.8,
        notes: { vi: 'Mực trứng nướng sa tế, ốc hương rang muối ớt, cua hấp sả bia.', en: 'Grilled squid, spicy butter snails, and steamed local crab.' },
      },
      {
        title: { vi: 'Ngắm hoàng hôn tại Ngọn Hải Đăng Vũng Tàu', en: 'Sunset View from Historic Vung Tau Lighthouse' },
        location: 'Đỉnh núi Nhỏ, Vũng Tàu',
        category: 'sightseeing',
        costUSD: 5,
        rating: 4.8,
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
        rating: 4.9,
        notes: { vi: 'Bãi cát trắng mịn, nước trong veo với rặng dừa xanh mướt.', en: 'World-renowned pristine white-sand coastline.' },
      },
      {
        title: { vi: 'Khám phá Cầu Vàng & Khu du lịch Sun World Bà Nà Hills', en: 'Sun World Ba Na Hills & Iconic Golden Hands Bridge' },
        location: 'Bà Nà Hills, Hòa Ninh, Hòa Vang',
        category: 'sightseeing',
        costUSD: 45,
        rating: 4.9,
        notes: { vi: 'Check-in Cầu Vàng nâng bởi bàn tay khổng lồ và Làng Pháp.', en: 'Walk along the world-famous colossal hand-held sky bridge.' },
      },
      {
        title: { vi: 'Thưởng thức Mì Quảng Bà Mua & Bánh tráng thịt heo', en: 'Authentic Mi Quang Noodles & Pork Rice Paper Rolls' },
        location: 'Trần Bình Trọng, Hải Châu, Đà Nẵng',
        category: 'food',
        costUSD: 8,
        rating: 4.8,
        notes: { vi: 'Mì Quảng tôm thịt đậm đà ăn kèm bánh đa nướng giòn.', en: 'Signature turmeric noodles with savory broth and crispy crackers.' },
      },
      {
        title: { vi: 'Viếng chùa Linh Ứng Bán đảo Sơn Trà', en: 'Linh Ung Pagoda & Son Tra Peninsula Wildlife' },
        location: 'Bán đảo Sơn Trà, Thọ Quang, Đà Nẵng',
        category: 'sightseeing',
        costUSD: 0,
        rating: 4.9,
        notes: { vi: 'Tượng Phật Bà Quan Âm cao 67m hướng nhìn ra biển cả.', en: '67m towering Lady Buddha statue overlooking Danang Bay.' },
      },
      {
        title: { vi: 'Xem Cầu Rồng phun lửa, phun nước & Du thuyền sông Hàn', en: 'Dragon Bridge Fire Show & Han River Cruise' },
        location: 'Cầu Rồng, Phước Ninh, Hải Châu',
        category: 'sightseeing',
        costUSD: 15,
        rating: 4.8,
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
        rating: 4.9,
        notes: { vi: 'Nước biển êm ả như ngọc bích, check-in xích đu cây dừa huyền thoại.', en: 'Crystal clear calm turquoise bay with palm-tree swings.' },
      },
      {
        title: { vi: 'Đi cáp treo Hòn Thơm vượt biển dài nhất thế giới', en: 'Hon Thom Cable Car Island Hopping' },
        location: 'Ga Ánh Dương, An Thới, Phú Quốc',
        category: 'sightseeing',
        costUSD: 30,
        rating: 4.9,
        notes: { vi: 'Chiêm ngưỡng toàn cảnh quần đảo An Thới ngoạn mục từ trên cao.', en: 'Longest sea-crossing three-wire cable car with panoramic views.' },
      },
      {
        title: { vi: 'Thưởng thức gỏi cá trích & Bún quậy Kiến Xây', en: 'Signature Kien Xay Fresh Seafood Noodle & Herring Salad' },
        location: '28 Bạch Đằng, Dương Đông, Phú Quốc',
        category: 'food',
        costUSD: 8,
        rating: 4.8,
        notes: { vi: 'Tự tay pha nước chấm theo khẩu vị, sợi bún tươi làm tại chỗ.', en: 'Famous DIY dipping sauce noodles with fresh shrimp and calamari.' },
      },
      {
        title: { vi: 'Khám phá Grand World Phú Quốc & Show Tinh hoa Việt Nam', en: 'Grand World Venice Canals & Vietnamese Essence Show' },
        location: 'Grand World, Gành Dầu, Phú Quốc',
        category: 'sightseeing',
        costUSD: 25,
        rating: 4.8,
        notes: { vi: 'Dạo thuyền Gondola trên sông Venice và xem show nhạc nước rực rỡ.', en: 'Venice canals, water taxi rides, and grand cultural shows.' },
      },
      {
        title: { vi: 'Chợ đêm Phú Quốc & Thưởng thức hải sản nhum nướng mỡ hành', en: 'Phu Quoc Night Market & Grilled Sea Urchin Feast' },
        location: 'Khu 1, Dương Đông, Phú Quốc',
        category: 'shopping',
        costUSD: 20,
        rating: 4.7,
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
        rating: 4.9,
        notes: { vi: 'Ngã tư đông đúc nhất thế giới và biểu tượng lòng trung thành Hachiko.', en: 'World’s busiest pedestrian crossing with vibrant neon skyline.' },
      },
      {
        title: { vi: 'Viếng Chùa Senso-ji cổ kính & Phố Nakamise-dori', en: 'Senso-ji Ancient Buddhist Temple & Nakamise Shopping' },
        location: 'Asakusa, Taito City, Tokyo',
        category: 'sightseeing',
        costUSD: 10,
        rating: 4.9,
        notes: { vi: 'Ngôi chùa cổ nhất Tokyo với đèn lồng Kaminarimon đỏ khổng lồ.', en: 'Tokyo’s oldest temple with traditional craft and snack stalls.' },
      },
      {
        title: { vi: 'Thưởng thức Sushi & Sashimi tươi ngon tại Chợ Tsukiji', en: 'Tsukiji Outer Market Fresh Sushi Tasting' },
        location: 'Tsukiji, Chuo City, Tokyo',
        category: 'food',
        costUSD: 25,
        rating: 4.9,
        notes: { vi: 'Sushi cá hồi, nhím biển uni, bò Wagyu nướng tại chỗ thơm lừng.', en: 'Freshly sliced Otoro tuna, sweet tamagoyaki, and grilled Wagyu.' },
      },
      {
        title: { vi: 'Khám phá phố điện tử & Văn hóa Manga Akihabara', en: 'Akihabara Electric Town & Manga Culture Exploration' },
        location: 'Akihabara, Chiyoda City, Tokyo',
        category: 'shopping',
        costUSD: 20,
        rating: 4.8,
        notes: { vi: 'Thiên đường đồ công nghệ, game retro và mô hình anime.', en: 'Hub for electronics, anime figures, maid cafes, and retro arcade games.' },
      },
      {
        title: { vi: 'Ngắm toàn cảnh Tokyo từ đài quan sát Shibuya Sky', en: 'Shibuya Sky Open-Air Observation Deck Sunset' },
        location: 'Shibuya Scramble Square 47F',
        category: 'sightseeing',
        costUSD: 22,
        rating: 5.0,
        notes: { vi: 'Tầm nhìn 360 độ ngắm núi Phú Sĩ và hoàng hôn rực rỡ.', en: 'Stunning open rooftop view with Mount Fuji visible on clear days.' },
      },
    ],
  },
  hanoi: {
    country: { vi: 'Việt Nam', en: 'Vietnam' },
    highlights: [
      {
        title: { vi: 'Dạo Hồ Hoàn Kiếm & Thăm Đền Ngọc Sơn', en: 'Hoan Kiem Lake & Ngoc Son Temple Walk' },
        location: 'Phố Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',
        category: 'sightseeing',
        costUSD: 2,
        rating: 4.9,
        notes: { vi: 'Biểu tượng ngàn năm văn hiến giữa lòng Thủ đô, cực kỳ mát mẻ buổi sáng.', en: 'Iconic historic lake and red Huc Bridge in central Hanoi.' },
      },
      {
        title: { vi: 'Phở Thìn Bờ Hồ & Cà phê Giảng trứng trứ danh', en: 'Pho Thin & Legendary Giang Egg Coffee' },
        location: '39 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội',
        category: 'food',
        costUSD: 6,
        rating: 4.9,
        notes: { vi: 'Quán cà phê trứng lâu đời bậc nhất Hà Nội được thực khách quốc tế khen nức nở.', en: 'Historic birthplace of creamy Hanoi egg coffee.' },
      },
      {
        title: { vi: 'Tham quan Văn Miếu - Quốc Tử Giám', en: 'Temple of Literature (Van Mieu)' },
        location: '58 Quốc Tử Giám, Đống Đa, Hà Nội',
        category: 'sightseeing',
        costUSD: 3,
        rating: 4.8,
        notes: { vi: 'Trường đại học đầu tiên của Việt Nam với kiến trúc cổ kính tuyệt đẹp.', en: 'Vietnam’s first national university with serene ancient courtyards.' },
      },
      {
        title: { vi: 'Thưởng thức Bún Chả Hàng Mành & Phố Cổ Tạ Hiện', en: 'Hang Manh Bun Cha & Old Quarter Ta Hien Street' },
        location: 'Phố Cổ Hoàn Kiếm, Hà Nội',
        category: 'food',
        costUSD: 8,
        rating: 4.8,
        notes: { vi: 'Chả nướng than hoa thơm lừng, buổi tối phố cổ nhộn nhịp cực vui.', en: 'Charcoal-grilled pork vermicelli and vibrant Old Quarter nightlife.' },
      },
      {
        title: { vi: 'Ngắm hoàng hôn Hồ Tây & Viếng Chùa Trấn Quốc', en: 'West Lake Sunset & Tran Quoc Pagoda' },
        location: 'Đường Thanh Niên, Tây Hồ, Hà Nội',
        category: 'sightseeing',
        costUSD: 0,
        rating: 4.9,
        notes: { vi: 'Ngôi chùa cổ nhất Thăng Long với khung cảnh hoàng hôn đẹp mê hồn.', en: '1,500-year-old lakeside pagoda with breathtaking sunset views.' },
      },
    ],
  },
  hcm: {
    country: { vi: 'Việt Nam', en: 'Vietnam' },
    highlights: [
      {
        title: { vi: 'Tham quan Dinh Độc Lập & Nhà thờ Đức Bà - Bưu điện Thành phố', en: 'Independence Palace & Central Post Office' },
        location: 'Quận 1, TP. Hồ Chí Minh',
        category: 'sightseeing',
        costUSD: 3,
        rating: 4.9,
        notes: { vi: 'Cụm di tích kiến trúc đẹp nhất trung tâm Sài Gòn, chụp ảnh cực chất.', en: 'Must-visit historic landmarks and French colonial architecture.' },
      },
      {
        title: { vi: 'Phố đi bộ Nguyễn Huệ & Cà phê Chung cư 42', en: 'Nguyen Hue Walking Street & 42 Cafe Apartment' },
        location: '42 Nguyễn Huệ, Quận 1, TP. HCM',
        category: 'activity',
        costUSD: 5,
        rating: 4.8,
        notes: { vi: 'Thiên đường quán cà phê decor độc đáo nhìn thẳng xuống phố đi bộ.', en: 'Iconic boutique coffee hub overlooking vibrant walking boulevard.' },
      },
      {
        title: { vi: 'Bánh mì Huỳnh Hoa & Phố ẩm thực Hồ Thị Kỷ', en: 'Huynh Hoa Banh Mi & Ho Thi Ky Street Food' },
        location: '26 Lê Thị Riêng, Quận 1, TP. HCM',
        category: 'food',
        costUSD: 7,
        rating: 4.9,
        notes: { vi: 'Ổ bánh mì đặc sản nổi tiếng nhất Sài Gòn đầy ắp nhân thơm ngon.', en: 'Famous gourmet Saigon baguette and bustling evening food market.' },
      },
      {
        title: { vi: 'Du thuyền sông Sài Gòn ngắm Landmark 81 về đêm', en: 'Saigon River Sunset Cruise & Skyline View' },
        location: 'Bến Bạch Đằng, Quận 1, TP. HCM',
        category: 'activity',
        costUSD: 18,
        rating: 4.8,
        notes: { vi: 'Trải nghiệm Waterbus hoặc du thuyền ngắm thành phố lên đèn lung linh.', en: 'Scenic river cruise past glowing skyscrapers and bridges.' },
      },
      {
        title: { vi: 'Chợ Bến Thành & Mua sắm đặc sản quà lưu niệm', en: 'Ben Thanh Market Heritage & Souvenirs' },
        location: 'Lê Lợi, Quận 1, TP. HCM',
        category: 'shopping',
        costUSD: 15,
        rating: 4.6,
        notes: { vi: 'Khu chợ biểu tượng với đủ món chè, cà phê rang xay và đồ thủ công.', en: 'Iconic historic market for coffee, snacks, and local crafts.' },
      },
    ],
  },
};

function matchDestinationProfile(dest: string): DestinationData | null {
  const norm = dest.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  if (norm.includes('da lat') || norm.includes('dalat')) return DESTINATION_PROFILES.dalat;
  if (norm.includes('vung tau') || norm.includes('vungtau')) return DESTINATION_PROFILES.vungtau;
  if (norm.includes('da nang') || norm.includes('danang') || norm.includes('hoi an')) return DESTINATION_PROFILES.danang;
  if (norm.includes('phu quoc') || norm.includes('phuquoc')) return DESTINATION_PROFILES.phuquoc;
  if (norm.includes('tokyo') || norm.includes('japan') || norm.includes('kyoto') || norm.includes('osaka')) return DESTINATION_PROFILES.tokyo;
  if (norm.includes('ha noi') || norm.includes('hanoi')) return DESTINATION_PROFILES.hanoi;
  if (norm.includes('ho chi minh') || norm.includes('sai gon') || norm.includes('saigon') || norm.includes('tphcm') || norm.includes('hcm')) return DESTINATION_PROFILES.hcm;
  return null;
}

function buildCuratedCandidatesForFallback(
  destination: string,
  currency: string,
  language: string,
  variation: number = 0
): RankedPlaceCandidate[] {
  const isVi = language === 'vi';
  const matched = matchDestinationProfile(destination);

  if (matched) {
    const items = matched.highlights.map((h, idx) => {
      const rating = h.rating ?? (4.9 - (idx % 4) * 0.1);
      const notes = isVi ? h.notes.vi : h.notes.en;
      const costInCur = convertCurrencyApprox(h.costUSD, 'USD', currency);
      return {
        name: isVi ? h.title.vi : h.title.en,
        locationName: h.location,
        category: h.category,
        estimatedCost: costInCur,
        currency,
        rating,
        notes,
        praiseScore: computePraiseScore(notes, 'TripMate Top Rated', rating),
        isFromSavedPlaces: false,
      } satisfies RankedPlaceCandidate;
    });
    // Rotate secondary ties lightly on variation while keeping rating-desc order dominant
    if (variation > 0 && items.length > 2) {
      const shift = variation % items.length;
      return [...items.slice(shift), ...items.slice(0, shift)];
    }
    return items;
  }

  // Rich generic high-rated candidate pool covering all interest categories for any global destination
  const genericTemplates: Array<{
    nameVi: string;
    nameEn: string;
    category: RankedPlaceCandidate['category'];
    costUSD: number;
    rating: number;
    notesVi: string;
    notesEn: string;
  }> = [
    {
      nameVi: `Quán đặc sản địa phương trứ danh tại ${destination}`,
      nameEn: `Top-Rated Local Specialty Kitchen in ${destination}`,
      category: 'food',
      costUSD: 12,
      rating: 4.9,
      notesVi: `Được du khách và người dân địa phương khen nức nở với hương vị chuẩn bản xứ.`,
      notesEn: `Rave local reviews for authentic signature flavors and warm hospitality.`,
    },
    {
      nameVi: `Danh thắng biểu tượng & Điểm ngắm cảnh ${destination}`,
      nameEn: `Iconic Landmark & Scenic Overlook of ${destination}`,
      category: 'sightseeing',
      costUSD: 8,
      rating: 4.9,
      notesVi: `Điểm check-in nổi tiếng nhất hành trình, góc chụp ảnh toàn cảnh tuyệt đẹp.`,
      notesEn: `Must-visit iconic landmark praised for breathtaking panoramic views.`,
    },
    {
      nameVi: `Cà phê view đẹp ngắm hoàng hôn tại ${destination}`,
      nameEn: `Scenic Sunset Panorama Cafe in ${destination}`,
      category: 'food',
      costUSD: 5,
      rating: 4.8,
      notesVi: `Không gian thư giãn, đồ uống ngon và góc ngắm hoàng hôn đẹp mê hồn.`,
      notesEn: `Highly praised open-air terrace cafe with golden hour sunset vistas.`,
    },
    {
      nameVi: `Bảo tàng di sản & Khu phố cổ ${destination}`,
      nameEn: `Heritage Museum & Historic Quarter of ${destination}`,
      category: 'sightseeing',
      costUSD: 6,
      rating: 4.8,
      notesVi: `Lưu giữ kiến trúc văn hóa lâu đời, rất đáng để tham quan và tìm hiểu lịch sử.`,
      notesEn: `Rich cultural heritage site praised by history and architecture lovers.`,
    },
    {
      nameVi: `Cung đường thiên nhiên & Trải nghiệm ngoài trời ${destination}`,
      nameEn: `Nature Trail & Outdoor Adventure in ${destination}`,
      category: 'activity',
      costUSD: 15,
      rating: 4.8,
      notesVi: `Không khí trong lành, nhiều hoạt động trải nghiệm thú vị giữa thiên nhiên.`,
      notesEn: `Refreshing outdoor experience highly rated for scenery and crisp air.`,
    },
    {
      nameVi: `Chợ đêm ẩm thực & Phố đi bộ ${destination}`,
      nameEn: `Vibrant Night Market & Walking Street in ${destination}`,
      category: 'shopping',
      costUSD: 14,
      rating: 4.7,
      notesVi: `Thiên đường món ăn vặt và quà lưu niệm thủ công nhộn nhịp về đêm.`,
      notesEn: `Bustling evening market famous for street bites and handcrafted souvenirs.`,
    },
    {
      nameVi: `Làng nghề truyền thống & Không gian nghệ thuật ${destination}`,
      nameEn: `Artisan Craft Village & Local Gallery in ${destination}`,
      category: 'activity',
      costUSD: 10,
      rating: 4.7,
      notesVi: `Trải nghiệm tự tay làm đồ thủ công cùng nghệ nhân bản địa thân thiện.`,
      notesEn: `Hands-on cultural workshop praised by travelers seeking authentic life.`,
    },
    {
      nameVi: `Quán ăn sáng bản địa lâu đời tại ${destination}`,
      nameEn: `Historic Morning Breakfast Spot in ${destination}`,
      category: 'food',
      costUSD: 6,
      rating: 4.7,
      notesVi: `Quán ăn sáng đông khách bản địa nhất khu vực, giá cả hợp lý.`,
      notesEn: `Beloved morning eatery packed with locals, great value for budget.`,
    },
    {
      nameVi: `Công viên trung tâm & Quảng trường dạo mát ${destination}`,
      nameEn: `Central Promenade & Waterfront Park in ${destination}`,
      category: 'sightseeing',
      costUSD: 0,
      rating: 4.6,
      notesVi: `Miễn phí tham quan, không gian xanh thoáng đãng thích hợp dạo bộ thư giãn.`,
      notesEn: `Free scenic public square ideal for a relaxing afternoon stroll.`,
    },
    {
      nameVi: `Tổ hợp mua sắm đặc sản & Quà tặng ${destination}`,
      nameEn: `Regional Specialty & Souvenir Hub in ${destination}`,
      category: 'shopping',
      costUSD: 20,
      rating: 4.6,
      notesVi: `Dễ dàng chọn mua đặc sản đóng gói chất lượng mang về làm quà.`,
      notesEn: `Curated specialty store for quality local treats and travel gifts.`,
    },
  ];

  const pool = genericTemplates.map((tpl) => {
    const notes = isVi ? tpl.notesVi : tpl.notesEn;
    return {
      name: isVi ? tpl.nameVi : tpl.nameEn,
      locationName: destination,
      category: tpl.category,
      estimatedCost: convertCurrencyApprox(tpl.costUSD, 'USD', currency),
      currency,
      rating: tpl.rating,
      notes,
      praiseScore: computePraiseScore(notes, 'Top Rated', tpl.rating),
      isFromSavedPlaces: false,
    } satisfies RankedPlaceCandidate;
  });

  if (variation > 0 && pool.length > 2) {
    const shift = (variation * 2) % pool.length;
    return [...pool.slice(shift), ...pool.slice(0, shift)];
  }
  return pool;
}

function generateFallbackItinerary(
  destination: string,
  durationDays: number = 3,
  travelStyle: string = 'Cultural & Foodie',
  interests: string[] = [],
  groupType: string = 'Friends',
  budgetAmount?: number,
  language: string = 'vi',
  currency: string = 'USD',
  savedPlaces: any[] = [],
  variation: number = 0
): FallbackItinerary {
  const isVi = language === 'vi';
  const daysCount = Math.max(1, Math.min(14, Number(durationDays) || 3));
  const matched = matchDestinationProfile(destination);

  const countryName = matched
    ? isVi
      ? matched.country.vi
      : matched.country.en
    : isVi
    ? 'Quốc tế'
    : 'Global';

  const baseSummary = isVi
    ? `Hành trình ${daysCount} ngày tại ${destination} ưu tiên địa điểm đã lưu và tự động bổ sung các địa điểm đánh giá sao cao nhất phù hợp ngân sách.`
    : `A ${daysCount}-day ${destination} itinerary prioritizing saved places and auto-filling top-rated places within your budget.`;

  const effectiveBudget =
    budgetAmount && budgetAmount > 0
      ? budgetAmount
      : convertCurrencyApprox(daysCount * 80, 'USD', currency);

  const extraCandidates = buildCuratedCandidatesForFallback(destination, currency, language, variation);

  const merged = mergeSavedAndGeneratedIntoDays({
    destination,
    durationDays: daysCount,
    currency,
    budgetAmount: effectiveBudget,
    interests,
    travelStyle,
    language,
    savedPlaces,
    extraCandidates,
  });

  return {
    destinationTitle: destination,
    country: countryName,
    overallSummary: baseSummary,
    recommendedBudgetTotal: effectiveBudget,
    days: merged.days.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      summary: d.summary,
      activities: d.activities.map((a) => ({
        time: a.time,
        title: a.title,
        locationName: a.locationName,
        category: a.category as FallbackActivity['category'],
        estimatedCost: a.estimatedCost,
        notes: a.notes,
        rating: a.rating,
        isFromSavedPlaces: a.isFromSavedPlaces,
      })),
    })),
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
      { category: 'Essentials', name: isVi ? 'CCCD / Hộ chiếu & Giấy tờ' : 'Passport / ID & Documents', quantity: 1, reason: isVi ? 'Check-in khách sạn & sân bay' : 'Mandatory for check-in' },
      { category: 'Essentials', name: isVi ? 'Thẻ ngân hàng & Tiền mặt' : 'Bank Cards & Cash', quantity: 1, reason: isVi ? 'Thanh toán địa phương' : 'Local payments' },
      { category: 'Clothing', name: isVi ? `Quần áo thoải mái (${durationDays} ngày)` : `Casual outfits (${durationDays} days)`, quantity: durationDays + 1, reason: isVi ? 'Trang phục di chuyển hằng ngày' : 'Daily travel outfits' },
      { category: 'Clothing', name: isVi ? 'Áo khoác nhẹ / Chống nắng' : 'Light jacket / Windbreaker', quantity: 1, reason: isVi ? 'Giữ ấm & chống nắng' : 'Weather protection' },
      { category: 'Electronics', name: isVi ? 'Điện thoại & Sạc' : 'Phone & Charger', quantity: 1, reason: isVi ? 'Liên lạc & bản đồ' : 'Maps & communication' },
      { category: 'Electronics', name: isVi ? 'Sạc dự phòng 10.000mAh' : 'Power Bank 10,000mAh', quantity: 1, reason: isVi ? 'Sạc pin khi di chuyển' : 'All-day battery backup' },
      { category: 'Toiletries', name: isVi ? 'Kem chống nắng SPF 50+' : 'Sunscreen SPF 50+', quantity: 1, reason: isVi ? 'Bảo vệ da ngoài trời' : 'UV protection' },
      { category: 'Toiletries', name: isVi ? 'Bộ vệ sinh cá nhân du lịch' : 'Travel toiletries kit', quantity: 1, reason: isVi ? 'Bàn chải, kem đánh răng, khăn giấy' : 'Personal hygiene' },
      { category: 'Gear', name: isVi ? 'Giày đi bộ êm chân' : 'Comfortable Walking Shoes', quantity: 1, reason: isVi ? 'Di chuyển nhiều không đau chân' : 'All-day walking comfort' },
      { category: 'Gear', name: isVi ? 'Ô gấp gọn / Áo mưa' : 'Compact Umbrella / Poncho', quantity: 1, reason: isVi ? 'Dự phòng mưa nắng' : 'Sudden rain protection' },
      { category: 'Documents', name: isVi ? 'Vé điện tử & Đặt phòng' : 'Saved E-Tickets & Bookings', quantity: 1, reason: isVi ? 'Mở nhanh khi ngoại tuyến' : 'Offline check-in access' },
    ],
  };
}

function generateFallbackChatReply(message: string, tripContext?: any, language: string = 'vi') {
  return generateSmartFallbackChatReply(message, tripContext, language);
}
// --- End Inlined Resilient Fallback Generators ---

// 1. Generate AI Itinerary (Prioritizes Saved Places + Auto-generates top-rated places within budget & trip interests)
app.post('/api/gemini/generate-itinerary', async (req, res) => {
  const {
    destination,
    durationDays,
    travelStyle,
    interests,
    groupType,
    budgetAmount,
    currency = 'USD',
    savedPlaces = [],
    allowAutoGenerate = true,
    language,
    variation = 0,
  } = req.body;

  const cleanDestination = String(destination || '').slice(0, 100).replace(/[\r\n\t]/g, ' ').trim();
  if (!cleanDestination) {
    return res.status(400).json({ error: 'Destination is required' });
  }

  const cleanDuration = Math.min(14, Math.max(1, parseInt(String(durationDays), 10) || 3));
  const cleanTravelStyle = String(travelStyle || 'Balanced Explorer').slice(0, 50).replace(/[\r\n]/g, ' ').trim();
  const cleanGroupType = String(groupType || 'Friends').slice(0, 50).replace(/[\r\n]/g, ' ').trim();
  const cleanCurrency = String(currency || 'USD').slice(0, 10).toUpperCase().trim();
  const cleanInterests = Array.isArray(interests)
    ? interests.slice(0, 10).map((i) => String(i).slice(0, 50).replace(/[\r\n]/g, ' ').trim()).filter(Boolean)
    : [];
  const cleanBudget = budgetAmount ? Math.max(0, Math.min(100000000000, Number(budgetAmount) || 0)) : undefined;
  const cleanSavedPlaces = Array.isArray(savedPlaces) ? savedPlaces.slice(0, 50) : [];
  const shouldAutoGenerate = allowAutoGenerate !== false;

  const lang = language === 'vi' ? 'vi' : 'en';

  // Rank user's existing Saved Places for this destination first (highest star -> praise -> interests -> budget)
  const rankedSaved = rankSavedPlacesForTrip(cleanSavedPlaces, {
    destination: cleanDestination,
    currency: cleanCurrency,
    budgetAmount: cleanBudget,
    durationDays: cleanDuration,
    interests: cleanInterests,
    travelStyle: cleanTravelStyle,
  });

  if (!shouldAutoGenerate) {
    const matched = matchDestinationProfile(cleanDestination);
    const mergedSavedOnly = mergeSavedAndGeneratedIntoDays({
      destination: cleanDestination,
      durationDays: cleanDuration,
      currency: cleanCurrency,
      budgetAmount: cleanBudget,
      interests: cleanInterests,
      travelStyle: cleanTravelStyle,
      language: lang,
      savedPlaces: cleanSavedPlaces,
      extraCandidates: [],
    });
    return res.json({
      destinationTitle: cleanDestination,
      country: matched ? (lang === 'vi' ? matched.country.vi : matched.country.en) : (lang === 'vi' ? 'Quốc tế' : 'Global'),
      overallSummary: '',
      recommendedBudgetTotal: cleanBudget || mergedSavedOnly.totalEstimatedCost,
      days: mergedSavedOnly.days,
      usedSavedCount: mergedSavedOnly.usedSavedCount,
      autoGeneratedCount: 0,
      totalEstimatedCost: mergedSavedOnly.totalEstimatedCost,
      isAiGenerated: false,
    });
  }

  const itineraryCacheKey = `itinerary:${cleanDestination.toLowerCase()}:${cleanDuration}:${cleanTravelStyle}:${cleanGroupType}:${cleanCurrency}:${cleanBudget ?? ''}:${cleanInterests.join(',')}:${rankedSaved.map((s) => s.name).join('|')}:${lang}:${Number(variation) || 0}`;
  const cachedItinerary = getCachedGeminiResponse<any>(itineraryCacheKey);
  if (cachedItinerary) {
    return res.json(cachedItinerary);
  }

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi'
      ? 'CRITICAL: Output all titles, summaries, descriptions, and activity notes in Vietnamese language (Tiếng Việt).'
      : 'Output all response text in English.';

    const savedSummaryText =
      rankedSaved.length > 0
        ? rankedSaved
            .map(
              (p, i) =>
                `${i + 1}. "${p.name}" (Category: ${p.category}, Rating: ${p.rating}★, Est.Cost: ${p.estimatedCost} ${cleanCurrency}, Address: ${p.locationName}${p.notes ? `, Praise/Notes: ${p.notes}` : ''})`
            )
            .join('\n')
        : 'None';

    const prompt = `Create a realistic, well-paced ${cleanDuration}-day travel itinerary for "${cleanDestination}" (4 activities per day).
Traveler Profile:
- Travel Style: ${cleanTravelStyle}
- Group Type: ${cleanGroupType}
- Selected Interests / Categories: ${cleanInterests.length > 0 ? cleanInterests.join(', ') : 'Must-see landmarks, local food, culture, photo spots'}
- Total Budget Target: ${cleanBudget ? `${cleanBudget} ${cleanCurrency}` : `Moderate (${cleanCurrency})`}
- Currency for ALL estimatedCost values: ${cleanCurrency}
- Alternative Variation Seed: ${Number(variation) || 0}

User's Existing Saved Places for "${cleanDestination}" (already sorted by highest stars & praise):
${savedSummaryText}

STRICT PLANNING RULES:
1. First prioritize and schedule the User's Saved Places above into appropriate daily time slots (morning/lunch/afternoon/evening) with isFromSavedPlaces=true.
2. Whenever Saved Places are NOT enough to fill all ${cleanDuration * 4} slots, automatically generate real, authentic, non-duplicate places in "${cleanDestination}" that are NOT in the Saved Places list (isFromSavedPlaces=false).
3. CRITICAL RANKING FOR AUTO-GENERATED PLACES: Choose ONLY real places with the HIGHEST star ratings & most-praised traveler reviews, ordered/prioritized from highest rating (e.g. 5.0★ -> 4.9★ -> 4.8★ -> 4.7★) downward! Mention why travelers praise each place in "notes".
4. Match the traveler's Selected Interests (${cleanInterests.join(', ') || 'all highlights'}) and Travel Style (${cleanTravelStyle}).
5. BUDGET COMPLIANCE: Keep the sum of all estimatedCost across all days strictly within ${cleanBudget ? `${cleanBudget} ${cleanCurrency}` : 'a reasonable budget'}. Use ${cleanCurrency} numbers for estimatedCost.`;

    const { response } = await generateWithModelFallback(ai, {
      contents: prompt,
      allowThinking: false,
      timeoutMs: 8500,
      config: {
        systemInstruction: `You are an expert global travel curator and logistics planner. ${langInstruction}`,
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
                        rating: { type: Type.NUMBER },
                        isFromSavedPlaces: { type: Type.BOOLEAN },
                        notes: { type: Type.STRING },
                      },
                      required: ['time', 'title', 'locationName', 'category', 'estimatedCost', 'rating', 'notes'],
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
    });

    const resultText = response.text || '{}';
    const jsonResult = JSON.parse(resultText);

    if (jsonResult && jsonResult.days && Array.isArray(jsonResult.days) && jsonResult.days.length > 0) {
      // Extract all AI activities into RankedPlaceCandidate pool so we guarantee:
      // 1) Top-rated saved places are ALWAYS included first
      // 2) Auto-generated extras are deduplicated, strictly sorted highest-star & most-praised downward, and budget-fitted
      const aiCandidates: RankedPlaceCandidate[] = [];
      for (const day of jsonResult.days) {
        if (!Array.isArray(day.activities)) continue;
        for (const act of day.activities) {
          const rating = Math.min(5, Math.max(1, Number(act.rating) || 4.7));
          const notes = String(act.notes || '');
          aiCandidates.push({
            name: String(act.title || ''),
            locationName: String(act.locationName || cleanDestination),
            category: (['sightseeing', 'food', 'stay', 'transport', 'activity', 'shopping'].includes(act.category)
              ? act.category
              : 'sightseeing') as RankedPlaceCandidate['category'],
            estimatedCost: Math.max(0, Number(act.estimatedCost) || 0),
            currency: cleanCurrency,
            rating,
            notes,
            praiseScore: computePraiseScore(notes, 'AI Top Reviewed', rating),
            isFromSavedPlaces: rankedSaved.some((s) => areSimilarPlaceNames(s.name, String(act.title || ''))),
            ...(typeof act.lat === 'number' ? { lat: act.lat } : {}),
            ...(typeof act.lng === 'number' ? { lng: act.lng } : {}),
          });
        }
      }

      const curatedExtras = buildCuratedCandidatesForFallback(cleanDestination, cleanCurrency, lang, Number(variation) || 0);
      const merged = mergeSavedAndGeneratedIntoDays({
        destination: cleanDestination,
        durationDays: cleanDuration,
        currency: cleanCurrency,
        budgetAmount: cleanBudget,
        interests: cleanInterests,
        travelStyle: cleanTravelStyle,
        language: lang,
        savedPlaces: cleanSavedPlaces,
        extraCandidates: [...aiCandidates, ...curatedExtras],
      });

      const payload = {
        destinationTitle: jsonResult.destinationTitle || cleanDestination,
        country: jsonResult.country || (lang === 'vi' ? 'Việt Nam' : 'Global'),
        overallSummary: jsonResult.overallSummary || '',
        recommendedBudgetTotal: cleanBudget || jsonResult.recommendedBudgetTotal || merged.totalEstimatedCost,
        days: merged.days,
        usedSavedCount: merged.usedSavedCount,
        autoGeneratedCount: merged.autoGeneratedCount,
        totalEstimatedCost: merged.totalEstimatedCost,
        isAiGenerated: true,
        usedFallback: false,
      };
      setCachedGeminiResponse(itineraryCacheKey, payload);
      return res.json(payload);
    }
    throw new Error('Empty itinerary response from AI');
  } catch (error: any) {
    const isQuota = Boolean(error?.isQuotaExceeded || isQuotaOrRateLimitError(error));
    console.info(
      `[Gemini Itinerary] Serving curated fallback for "${cleanDestination}" (${isQuota ? 'quota cooldown' : 'upstream unavailable'}).`
    );
    const fallback = generateFallbackItinerary(
      cleanDestination,
      cleanDuration,
      cleanTravelStyle,
      cleanInterests,
      cleanGroupType,
      cleanBudget,
      lang,
      cleanCurrency,
      cleanSavedPlaces,
      Number(variation) || 0
    );
    return res.json({
      ...fallback,
      usedFallback: true,
      fallbackReason: isQuota ? 'quota_exceeded' : 'upstream_unavailable',
    });
  }
});

// 2. Local Recommendations & Hidden Gems
app.post('/api/gemini/recommendations', async (req, res) => {
  const { destination, category, language } = req.body;
  const lang = language === 'vi' ? 'vi' : 'en';
  const cleanDest = String(destination || 'Vietnam').slice(0, 100).trim();
  const cleanCat = String(category || 'must-try food & hidden gems').slice(0, 60).trim();
  const recsCacheKey = `recs:${cleanDest.toLowerCase()}:${cleanCat.toLowerCase()}:${lang}`;
  const cachedRecs = getCachedGeminiResponse<any>(recsCacheKey);
  if (cachedRecs) {
    return res.json(cachedRecs);
  }

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi' ? 'Provide descriptions and tips in Vietnamese (Tiếng Việt).' : 'Provide in English.';

    const prompt = `Give me 5 top-rated, most praised recommendations for ${cleanCat} in "${cleanDest}".
    Sort from highest star rating downward. Include local insider tips, approximate cost, and why it is special.`;

    const { response } = await generateWithModelFallback(ai, {
      contents: prompt,
      allowThinking: true,
      timeoutMs: 10000,
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
    });

    const result = JSON.parse(response.text || '{}');
    if (result && Array.isArray(result.recommendations) && result.recommendations.length > 0) {
      setCachedGeminiResponse(recsCacheKey, result);
      return res.json(result);
    }
    throw new Error('Empty recommendations response from AI');
  } catch (error: any) {
    const isQuota = Boolean(error?.isQuotaExceeded || isQuotaOrRateLimitError(error));
    console.info(
      `[Gemini Recommendations] Serving curated fallback for "${cleanDest}" (${isQuota ? 'quota cooldown' : 'upstream unavailable'}).`
    );
    const fallback = generateFallbackRecommendations(cleanDest, category, lang);
    return res.json({
      ...fallback,
      usedFallback: true,
      fallbackReason: isQuota ? 'quota_exceeded' : 'upstream_unavailable',
    });
  }
});

// 3. AI Packing Checklist Generator
app.post('/api/gemini/packing-list', async (req, res) => {
  const { destination, season, activities, durationDays, language } = req.body;
  const lang = language === 'vi' ? 'vi' : 'en';
  const cleanDest = String(destination || 'Vietnam').slice(0, 100).trim();
  const cleanDays = Math.min(30, Math.max(1, Number(durationDays) || 5));
  const packingCacheKey = `packing:${cleanDest.toLowerCase()}:${String(season || '')}:${String(activities || '')}:${cleanDays}:${lang}`;
  const cachedPacking = getCachedGeminiResponse<any>(packingCacheKey);
  if (cachedPacking) {
    return res.json(cachedPacking);
  }

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi' 
      ? 'Output item names in Vietnamese (Tiếng Việt) and categories as one of: Essentials, Clothing, Electronics, Toiletries, Documents, Gear.'
      : 'Output item names in English.';

    const prompt = `Generate a smart, concise packing checklist of 10-12 essential items for a ${cleanDays}-day trip to "${cleanDest}".
    Context: Season/Weather: ${season || 'general'}, Planned Activities: ${activities || 'city walking, dining, sightseeing'}.
    Categorize items into: Essentials, Clothing, Electronics, Toiletries, Documents, Gear.`;

    const { response } = await generateWithModelFallback(ai, {
      contents: prompt,
      allowThinking: false,
      timeoutMs: 8000,
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
    });

    const result = JSON.parse(response.text || '{}');
    if (result && Array.isArray(result.packingItems) && result.packingItems.length > 0) {
      setCachedGeminiResponse(packingCacheKey, result);
      return res.json(result);
    }
    throw new Error('Empty packing list response from AI');
  } catch (error: any) {
    const isQuota = Boolean(error?.isQuotaExceeded || isQuotaOrRateLimitError(error));
    console.info(
      `[Gemini Packing] Serving curated fallback for "${cleanDest}" (${isQuota ? 'quota cooldown' : 'upstream unavailable'}).`
    );
    const fallback = generateFallbackPackingList(cleanDest, season, activities, cleanDays, lang);
    return res.json({
      ...fallback,
      usedFallback: true,
      fallbackReason: isQuota ? 'quota_exceeded' : 'upstream_unavailable',
    });
  }
});

// 4. AI Travel Assistant Chat
app.post('/api/gemini/chat', async (req, res) => {
  const { message, tripContext, language } = req.body;
  const lang = language === 'vi' ? 'vi' : 'en';
  const cleanMsg = String(message || '').slice(0, 1000).trim();
  const chatCacheKey = normalizeChatCacheKey(cleanMsg, tripContext?.destination, lang);
  const cachedChat = getCachedGeminiResponse<any>(chatCacheKey);
  if (cachedChat) {
    return res.json({ ...cachedChat, cached: true });
  }

  try {
    const ai = getAiClient();
    const langInstruction = lang === 'vi'
      ? 'Always answer in natural, polite Vietnamese (Tiếng Việt).'
      : 'Answer in English.';

    const systemInstruction = `You are TripMate AI, a friendly, knowledgeable, and helpful travel companion assistant.
    Current Trip Context: Destination: ${tripContext?.destination || 'Global'}, Travel Dates: ${tripContext?.startDate || ''} to ${tripContext?.endDate || ''}.
    Answer concisely, provide actionable advice, emergency contacts if asked, local currency advice, transport tips, or language phrases. ${langInstruction}`;

    const { response } = await generateWithModelFallback(ai, {
      contents: cleanMsg,
      allowThinking: false,
      timeoutMs: 8000,
      config: {
        systemInstruction,
      },
    });

    if (response.text) {
      const payload = { reply: response.text };
      if (cleanMsg) {
        setCachedGeminiResponse(chatCacheKey, payload, 5 * 60 * 1000);
      }
      return res.json(payload);
    }
    throw new Error('Empty reply from AI');
  } catch (error: any) {
    const isQuota = Boolean(error?.isQuotaExceeded || isQuotaOrRateLimitError(error));
    console.info(
      `[Gemini Chat] Serving smart fallback reply (${isQuota ? 'quota cooldown' : 'upstream unavailable'}).`
    );
    const fallbackReply = generateFallbackChatReply(cleanMsg, tripContext, lang);
    const fallbackPayload = {
      reply: fallbackReply,
      usedFallback: true,
      fallbackReason: isQuota ? 'quota_exceeded' : 'upstream_unavailable',
    };
    if (cleanMsg) {
      setCachedGeminiResponse(chatCacheKey, fallbackPayload, 5 * 60 * 1000);
    }
    return res.json(fallbackPayload);
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
    let lat: number | null = null;
    let lng: number | null = null;
    let resolvedName = destination;
    let locationFound = false;

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
          resolvedName = geoData.results[0].name + (geoData.results[0].country ? `, ${geoData.results[0].country}` : '');
          locationFound = true;
        }
      }
    } catch (geoErr) {
      console.warn('[Weather] Geocoding error:', geoErr);
    }

    if (!locationFound || lat === null || lng === null) {
      return res.status(404).json({
        success: false,
        error: lang === 'vi'
          ? `Không tìm thấy tọa độ thời tiết cho địa điểm "${destination}". Vui lòng kiểm tra lại tên thành phố.`
          : `Weather coordinates not found for location "${destination}". Please check the city name.`,
      });
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

    const { response } = await generateWithModelFallback(ai, {
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
      allowThinking: false,
      timeoutMs: 18000,
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
    });

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
    const isQuota = Boolean(error?.isQuotaExceeded || isQuotaOrRateLimitError(error));
    console.info(`[Receipt OCR] Scan unavailable (${isQuota ? 'quota cooldown' : 'recognition error'}).`);
    if (isQuota) {
      return res.status(429).json({
        success: false,
        error: language === 'vi'
          ? 'Hệ thống AI tạm hết hạn mức lượt quét miễn phí trong ngày. Vui lòng thử lại sau hoặc nhập chi phí thủ công.'
          : 'AI free-tier scan quota has temporarily been reached. Please try again later or enter the expense manually.',
      });
    }
    return res.status(500).json({
      success: false,
      error: language === 'vi'
        ? 'Không thể nhận diện hóa đơn từ hình ảnh này. Vui lòng thử lại với ảnh chụp rõ nét hơn hoặc nhập thủ công.'
        : 'Failed to recognize receipt from this image. Please try again with a clearer photo or enter details manually.',
    });
  }
});

// Serve frontend / Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
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
