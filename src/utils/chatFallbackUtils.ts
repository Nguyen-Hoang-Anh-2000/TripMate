export interface ChatTripContext {
  destination?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
}

export function normalizeChatCacheKey(
  message: string,
  destination?: string,
  language: string = 'vi'
): string {
  const cleanMsg = String(message || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const cleanDest = String(destination || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const cleanLang = language === 'vi' ? 'vi' : 'en';
  return `chat:${cleanMsg}:${cleanDest}:${cleanLang}`;
}

export function generateSmartFallbackChatReply(
  queryText: string,
  tripContext?: ChatTripContext,
  language: string = 'vi'
): string {
  const q = String(queryText || '').toLowerCase();
  const dest = (tripContext?.destination || '').trim() || (language === 'vi' ? 'điểm đến của bạn' : 'your destination');
  const country = tripContext?.country || '';
  const isVi = language === 'vi';

  const isDalat = /đà lạt|da lat|dalat/i.test(dest);
  const isVungTau = /vũng tàu|vung tau|vungtau/i.test(dest);
  const isPhuQuoc = /phú quốc|phu quoc|phuquoc/i.test(dest);
  const isDaNang = /đà nẵng|da nang|danang|hội an|hoi an/i.test(dest);
  const isHaNoi = /hà nội|ha noi|hanoi/i.test(dest);
  const isHCM = /hồ chí minh|ho chi minh|sài gòn|sai gon|saigon|tphcm/i.test(dest);
  const isTokyo = /tokyo|kyoto|osaka|nhật bản|japan/i.test(dest);
  const isRailCity = /tokyo|osaka|kyoto|seoul|busan|bangkok|singapore|paris|london|taipei|hong kong|shanghai|beijing|berlin|new york/i.test(
    `${dest} ${country}`
  );

  // 1. Weather queries (with destination + month/seasonal details)
  if (/thời tiết|weather|nhiệt độ|mưa|lạnh|nắng|mặc gì|sương mù|climate|temp/i.test(q)) {
    const monthMatch = q.match(/(?:tháng|month)\s*(\d{1,2})/i);
    const monthNum = monthMatch ? Number(monthMatch[1]) : null;
    if (isDalat) {
      const monthNoteVi =
        monthNum && (monthNum >= 10 || monthNum <= 2)
          ? `Tháng ${monthNum} ở Đà Lạt bước vào mùa khô, trời nắng dịu ban ngày (20–23°C), se lạnh sáng sớm và tối muộn (13–16°C), sáng sớm thường có sương mù và biển mây đẹp.`
          : `Thời tiết Đà Lạt mát mẻ quanh năm (15–24°C), sáng sớm thường có sương mù và trời chuyển lạnh nhanh sau 17:00.`;
      const monthNoteEn =
        monthNum && (monthNum >= 10 || monthNum <= 2)
          ? `In month ${monthNum}, Da Lat enjoys crisp dry weather: mild daytime sunshine (20–23°C) and chilly nights/mornings (13–16°C) with scenic early mist.`
          : `Da Lat stays cool year-round (15–24°C), with misty mornings and chilly evenings after 5 PM.`;
      return isVi
        ? `Thời tiết tại Đà Lạt:\n• ${monthNoteVi}\n• Trang phục gợi ý: áo len mỏng/hoodie, áo khoác gió giữ nhiệt ban đêm và giày thể thao chống trượt.\n• Mẹo nhỏ: nhấn trực tiếp vào badge Thời tiết trên banner để xem nhiệt độ, độ ẩm và tỷ lệ mưa theo thời gian thực.`
        : `Weather guide for Da Lat:\n• ${monthNoteEn}\n• What to wear: layered sweaters, a warm windbreaker for evenings, and comfortable sneakers.\n• Tip: tap the live Weather badge on the trip banner for real-time temperature, humidity, and rain forecast.`;
    }
    if (isVungTau || isPhuQuoc || isDaNang) {
      return isVi
        ? `Thời tiết tại ${dest}: Nắng ấm gió biển (26–32°C), thích hợp tắm biển buổi sáng sớm hoặc sau 15:30 chiều. Bạn nên mang kem chống nắng SPF 50+, kính râm và kiểm tra badge Thời tiết trực tiếp trên banner trước khi ra khơi.`
        : `Weather in ${dest}: Warm coastal sunshine (26–32°C), best for beach swims early morning or after 3:30 PM. Pack SPF 50+ sunscreen, sunglasses, and tap the live Weather badge on the banner for real-time updates.`;
    }
    return isVi
      ? `Thời tiết tại ${dest}: Nên xem trực tiếp badge Thời tiết trên banner chuyến đi để cập nhật nhiệt độ, độ ẩm và khả năng mưa thực tế, từ đó chuẩn bị áo khoác mỏng hoặc ô gấp gọn phù hợp cho các hoạt động ngoài trời.`
      : `Weather in ${dest}: Check the live Weather badge on the trip banner for current temperature, humidity, and rain chances so you can pack layers or a compact umbrella for outdoor stops.`;
  }

  // 2. Food & dining queries
  if (/ăn|food|món|dish|restaurant|quán|đặc sản|nhà hàng|cà phê|cafe/i.test(q)) {
    if (isDalat) {
      return isVi
        ? `Gợi ý món ngon & quán nổi tiếng tại Đà Lạt:\n• Lẩu gà lá é Tao Ngộ (Số 5 Đường 3 Tháng 4)\n• Bánh mì xíu mại Hoàng Diệu (26 Hoàng Diệu, ăn sáng cực ấm bụng)\n• Lẩu bò Ba Toa Quán Gỗ (1/29 Hoàng Diệu)\n• Cà phê Túi Mơ To hoặc Đồi Dã Chiến ngắm thung lũng đèn\n• Bánh tráng nướng & sữa đậu nành nóng tại Chợ Đêm Đà Lạt`
        : `Must-try dishes & spots in Da Lat:\n• Chicken hotpot with lemon basil at Tao Ngo (5 3 Thang 4 St)\n• Warm meatball baguette soup at Banh Mi Xiu Mai Hoang Dieu\n• Signature beef hotpot at Ba Toa Quan Go\n• Valley-view coffee at Tui Mo To or Doi Da Chien\n• Grilled rice paper & warm soy milk at Da Lat Night Market`;
    }
    if (isVungTau) {
      return isVi
        ? `Đặc sản nổi bật tại Vũng Tàu:\n• Bánh khọt Gốc Vú Sữa (14 Nguyễn Trường Tộ)\n• Lẩu cá đuối Út Mười hoặc Hoàng Minh (Trương Công Định)\n• Hải sản tươi sống Chợ đêm Bãi Sau\n• Yaourt & trứng lòng đào đỉnh Ngọn Hải Đăng Cô Tiên`
        : `Must-try dishes in Vung Tau:\n• Crispy savory pancakes at Banh Khot Goc Vu Sua (14 Nguyen Truong To)\n• Sour stingray hotpot at Ut Muoi\n• Fresh grilled seafood at Bai Sau Night Market\n• Soft yogurt & soft-boiled eggs at Co Tien near Vung Tau Lighthouse`;
    }
    if (isPhuQuoc) {
      return isVi
        ? `Đặc sản Phú Quốc nên thử:\n• Bún quậy Kiến Xây (28 Bạch Đằng)\n• Gỏi cá trích & nhum biển nướng mỡ hành\n• Hải sản làng chài Hàm Ninh\n• Cà phê ngắm hoàng hôn khu Dinh Cậu / Grand World`
        : `Must-try in Phu Quoc:\n• Kien Xay fresh stirred noodles (Bun Quay)\n• Herring salad (Goi Ca Trich) & grilled sea urchin\n• Fresh seafood at Ham Ninh fishing village`;
    }
    if (isDaNang) {
      return isVi
        ? `Đặc sản Đà Nẵng / Hội An nên thử:\n• Mì Quảng Bà Mua hoặc Mì Quảng Ếch Bếp Trang\n• Bánh tráng cuốn thịt heo Trần\n• Hải sản tươi dọc bãi biển Mỹ Khê\n• Chè sầu Liên & Cao lầu / Bánh mì Phượng (Hội An)`
        : `Must-try in Da Nang / Hoi An:\n• Mi Quang Ba Mua turmeric noodles\n• Tran pork rice-paper rolls\n• Fresh seafood along My Khe Beach & Hoi An Cao Lau`;
    }
    if (isHaNoi) {
      return isVi
        ? `Đặc sản Hà Nội nổi tiếng:\n• Phở Thìn Bờ Hồ / Phở Bát Đàn\n• Bún chả Hàng Mành & Chả cá Lã Vọng\n• Cà phê trứng Giảng (39 Nguyễn Hữu Huân)\n• Bánh cốm Hàng Than & kem Tràng Tiền`
        : `Must-try in Hanoi:\n• Pho Thin / Pho Bat Dan\n• Hang Manh charcoal-grilled Bun Cha\n• Legendary Egg Coffee at Cafe Giang (39 Nguyen Huu Huan)`;
    }
    if (isHCM) {
      return isVi
        ? `Ẩm thực nổi bật TP. Hồ Chí Minh:\n• Bánh mì Huỳnh Hoa (26 Lê Thị Riêng)\n• Cơm tấm Ba Ghiền / Phở Hòa Pasteur\n• Phố ẩm thực Hồ Thị Kỷ & Vĩnh Khánh buổi tối\n• Cà phê chung cư 42 Nguyễn Huệ`
        : `Must-try in Ho Chi Minh City:\n• Huynh Hoa gourmet Banh Mi\n• Com Tam Ba Ghien & Pho Hoa Pasteur\n• Ho Thi Ky evening street food alley & 42 Nguyen Hue cafes`;
    }
    if (isTokyo) {
      return isVi
        ? `Ẩm thực phải thử tại Tokyo:\n• Sushi & hải sản tươi Chợ ngoài Tsukiji\n• Ramen Ichiran / Afuri Yuzu Shio\n• Thịt bò Wagyu nướng tại Shibuya / Shinjuku\n• Bánh ngọt Matcha & Dorayaki phố Asakusa`
        : `Must-try in Tokyo:\n• Fresh sushi & seafood bowls at Tsukiji Outer Market\n• Afuri Yuzu Ramen & Tonkotsu ramen\n• Yakiniku Wagyu in Shibuya / Shinjuku & Matcha sweets in Asakusa`;
    }
    return isVi
      ? `Gợi ý thưởng thức ẩm thực tại ${dest}:\n• Ưu tiên quán đông khách bản địa, kiểm tra giờ mở cửa trước khi đi\n• Hỏi giá rõ ràng tại chợ đêm hoặc quán hải sản\n• Dành 1 bữa tối khám phá phố ẩm thực đặc sản trung tâm ${dest}`
      : `Dining tips for ${dest}:\n• Look for busy local-favorite eateries and verify opening hours\n• Confirm prices beforehand at night markets and seafood stalls\n• Explore the central night food street in ${dest} for authentic specialties`;
  }

  // 3. Transit queries
  if (/giao thông|di chuyển|transit|transport|xe|pass|get around/i.test(q)) {
    if (isRailCity) {
      return isVi
        ? `Di chuyển tại ${dest}: Nên dùng thẻ tàu điện/metro không tiếp xúc (IC card hoặc thẻ ngày) kết hợp Google Maps để tiết kiệm chi phí và tránh kẹt xe giờ cao điểm.`
        : `Getting around ${dest}: Use a contactless metro/transit day pass combined with Google Maps for the fastest and most economical routes.`;
    }
    return isVi
      ? `Di chuyển thuận tiện tại ${dest}:\n• Nhóm 4–6 người: đặt GrabCar/Xanh SM hoặc thuê xe du lịch theo ngày\n• Nhóm nhỏ chủ động: thuê xe máy (~120.000–150.000₫/ngày), mang theo GPLX & kiểm tra phanh trước khi chạy đèo dốc.`
      : `Best ways to get around ${dest}:\n• Groups of 4–6: Ride-hailing cars (Grab) or a private day driver\n• Flexible solo/couple travel: Motorbike rental (check brakes and carry a valid license).`;
  }

  // 4. Safety & emergency queries
  if (/an toàn|khẩn cấp|safety|emergency/i.test(q)) {
    const isVietnam = /việt nam|vietnam|đà lạt|da lat|vũng tàu|vung tau|phú quốc|đà nẵng|hà nội|hồ chí minh/i.test(
      `${dest} ${country}`
    );
    if (isVietnam) {
      return isVi
        ? `Số khẩn cấp tại Việt Nam & Mẹo an toàn ở ${dest}:\n• Công an: 113 | Cứu hỏa: 114 | Cấp cứu: 115\n• Lưu ảnh CCCD/Hộ chiếu trong tab Vé & Ví kèm khóa PIN 4 số\n• Đi chợ đêm nhớ giữ túi đeo chéo phía trước và hỏi giá trước khi mua.`
        : `Vietnam Emergency Numbers & Safety Tips for ${dest}:\n• Police: 113 | Fire: 114 | Ambulance: 115\n• Keep a digital copy of your ID/Passport locked in Travel Vault\n• Confirm market prices in advance and keep valuables secure.`;
    }
    return isVi
      ? `Mẹo an toàn tại ${dest}:\n• Lưu sẵn địa chỉ khách sạn & số khẩn cấp địa phương (112/911)\n• Sao lưu hộ chiếu, bảo hiểm du lịch trong mục Vé & Ví có khóa PIN\n• Dùng eSIM hoặc tải sẵn bản đồ ngoại tuyến trước khi di chuyển.`
      : `Safety tips for ${dest}:\n• Save local emergency numbers (112/911) and hotel address offline\n• Keep passport & insurance backups PIN-locked in Travel Vault\n• Keep valuables in a front bag in crowded areas.`;
  }

  // 5. Sightseeing & Top Spots queries
  if (/điểm đi|tham quan|check-in|địa điểm|top spots|attractions|places to visit|gợi ý điểm|sightseeing/i.test(q)) {
    if (isDalat) {
      return isVi
        ? `Top điểm đi đẹp tại Đà Lạt:\n• Đồi chè Cầu Đất (săn mây sáng sớm)\n• Hồ Xuân Hương & Quảng trường Lâm Viên\n• Vườn hoa Cẩm Tú Cầu & Thung lũng Tình Yêu\n• Ga Đà Lạt cổ & Dinh III Bảo Đại`
        : `Top spots in Da Lat:\n• Cau Dat Tea Hill (early sunrise cloud-hunting)\n• Xuan Huong Lake & Lam Vien Square\n• Dalat Railway Station & Bao Dai Summer Palace`;
    }
    if (isVungTau) {
      return isVi
        ? `Top điểm đi tại Vũng Tàu:\n• Tượng Chúa Kitô Vua & Ngọn Hải Đăng\n• Bãi Sau / Bãi Trước ngắm hoàng hôn\n• Mũi Nghinh Phong & Đồi Con Heo`
        : `Top spots in Vung Tau:\n• Christ the King Statue & Vung Tau Lighthouse\n• Nghinh Phong Cape & Con Heo Hill\n• Back Beach / Front Beach sunset walk`;
    }
    if (isPhuQuoc) {
      return isVi
        ? `Top điểm đi tại Phú Quốc:\n• Bãi Sao & Bãi Khem\n• Cáp treo Hòn Thơm & Thị trấn Hoàng Hôn\n• Grand World & Dinh Cậu`
        : `Top spots in Phu Quoc:\n• Sao Beach & Khem Beach\n• Hon Thom Cable Car & Sunset Town\n• Grand World & Dinh Cau Night Market`;
    }
    if (isDaNang) {
      return isVi
        ? `Top điểm đi tại Đà Nẵng / Hội An:\n• Bà Nà Hills & Cầu Vàng\n• Ngũ Hành Sơn & Bán đảo Sơn Trà\n• Phố cổ Hội An & Cầu Rồng tối cuối tuần`
        : `Top spots in Da Nang / Hoi An:\n• Ba Na Hills & Golden Bridge\n• Marble Mountains & Son Tra Peninsula\n• Hoi An Ancient Town & Dragon Bridge`;
    }
    if (isHaNoi) {
      return isVi
        ? `Top điểm đi tại Hà Nội:\n• Phố cổ, Hồ Hoàn Kiếm & Đền Ngọc Sơn\n• Văn Miếu Quốc Tử Giám & Hoàng thành Thăng Long\n• Hồ Tây & Chùa Trấn Quốc`
        : `Top spots in Hanoi:\n• Old Quarter, Hoan Kiem Lake & Ngoc Son Temple\n• Temple of Literature & Thang Long Citadel\n• West Lake & Tran Quoc Pagoda`;
    }
    if (isHCM) {
      return isVi
        ? `Top điểm đi tại TP.HCM:\n• Dinh Độc Lập, Nhà thờ Đức Bà & Bưu điện Thành phố\n• Bảo tàng Chứng tích Chiến tranh & Phố đi bộ Nguyễn Huệ\n• Chợ Bến Thành & Landmark 81`
        : `Top spots in Ho Chi Minh City:\n• Independence Palace & Central Post Office\n• War Remnants Museum & Nguyen Hue Walking Street\n• Ben Thanh Market & Saigon Skydeck`;
    }
    if (isTokyo) {
      return isVi
        ? `Top điểm đi tại Tokyo:\n• Đền Senso-ji (Asakusa) & Tokyo Skytree\n• Ngã tư Shibuya & Công viên Yoyogi\n• Bảo tàng teamLab Planets & Phố Shinjuku`
        : `Top spots in Tokyo:\n• Senso-ji Temple (Asakusa) & Tokyo Skytree\n• Shibuya Crossing & Meiji Jingu Shrine\n• teamLab Planets & Shinjuku`;
    }
    return isVi
      ? `Gợi ý điểm tham quan tại ${dest}:\n• Trung tâm phố cổ / chợ địa phương vào sáng sớm hoặc chiều mát\n• Các điểm ngắm toàn cảnh hoặc công viên nổi bật trên tab Địa điểm Lưu\n• Mở tab Lịch trình AI để xếp tuyến đường tối ưu theo ngày.`
      : `Top spots to explore in ${dest}:\n• Historic center / local market early morning or late afternoon\n• Scenic viewpoints listed in your Saved Places tab\n• Open AI Itinerary to auto-route nearby highlights.`;
  }

  // 6. General travel guidance
  const dateRange = tripContext?.startDate && tripContext?.endDate ? ` (${tripContext.startDate} – ${tripContext.endDate})` : '';
  return isVi
    ? `Gợi ý cho chuyến đi ${dest}${dateRange}:\n• Kiểm tra thời tiết trực tiếp trên badge Thời tiết ở banner để chuẩn bị trang phục phù hợp\n• Dùng tab Bản đồ sắp xếp các điểm gần nhau trong cùng ngày để tiết kiệm thời gian di chuyển\n• Ghi nhận chi tiêu chung ngay trên tab Chi tiêu để tự động quyết toán minh bạch cho cả nhóm.\nBạn muốn hỏi cụ thể về quán ăn ngon, điểm đi đẹp hay cách di chuyển tại ${dest}?`
    : `Quick travel guide for ${dest}${dateRange}:\n• Check the live Weather badge on the banner before packing\n• Use Interactive Map to group nearby stops in the same day\n• Log shared bills in Expenses for automatic settlement.\nAsk me specifically about local food, top spots, or transit in ${dest}!`;
}
