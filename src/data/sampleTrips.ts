import { Trip } from '../types';

export const SAMPLE_TRIPS: Trip[] = [
  {
    id: 'trip-dalat',
    title: 'Đà Lạt 12/2026 - Sương Mù & Đồi Thông',
    destination: 'Đà Lạt',
    country: 'Việt Nam',
    startDate: '2026-12-15',
    endDate: '2026-12-18',
    coverImage: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1200&q=80',
    budgetTotal: 6000000,
    currency: 'VND',
    fundHolderId: 'm1',
    members: [
      { id: 'm1', name: 'Minh Tuấn', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', contributedAmount: 2000000 },
      { id: 'm2', name: 'Thùy Trang', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80', contributedAmount: 2000000 },
      { id: 'm3', name: 'Bảo Anh', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', contributedAmount: 2000000 }
    ],
    weatherForecast: {
      avgTempC: 16,
      condition: 'Se lạnh & Sương mù nhẹ',
      icon: '🌲'
    },
    days: [
      {
        dayNumber: 1,
        date: '15/12/2026',
        title: 'Bánh mì xíu mại, Hồ Xuân Hương & Lẩu gà lá é',
        summary: 'Xe limousine đưa đoàn đến Đà Lạt rạng sáng, thưởng thức bánh mì xíu mại Hoàng Diệu nóng hổi, ngắm cảnh Hồ Xuân Hương và dạo chợ đêm.',
        activities: [
          {
            id: 'act-dl-101',
            time: '07:30 AM',
            title: 'Ăn sáng Bánh mì xíu mại Hoàng Diệu',
            locationName: '26 Hoàng Diệu, Phường 5, Đà Lạt',
            lat: 11.9421,
            lng: 108.4312,
            category: 'food',
            estimatedCost: 45000,
            currency: 'VND',
            notes: 'Xíu mại cay nồng ăn kèm bánh mì giòn rụm và sữa đậu nành nóng.'
          },
          {
            id: 'act-dl-102',
            time: '10:00 AM',
            title: 'Dạo quanh Hồ Xuân Hương & Quảng trường Lâm Viên',
            locationName: 'Quảng trường Lâm Viên, Đà Lạt',
            lat: 11.9381,
            lng: 108.4450,
            category: 'sightseeing',
            estimatedCost: 0,
            currency: 'VND',
            notes: 'Check-in chụp ảnh với nụ hoa dã quỳ và khối hoa dại khổng lồ bằng kính.'
          },
          {
            id: 'act-dl-103',
            time: '03:00 PM',
            title: 'Cà phê chiều ngắm thung lũng tại Túi Mơ To',
            locationName: 'Hẻm 31 Sào Nam, Phường 11, Đà Lạt',
            lat: 11.9510,
            lng: 108.4721,
            category: 'food',
            estimatedCost: 85000,
            currency: 'VND',
            notes: 'Quán cà phê nhà lồng kiếng rực rỡ hoa cúc họa mi và không gian mở thoáng đãng.'
          },
          {
            id: 'act-dl-104',
            time: '07:00 PM',
            title: 'Thưởng thức Lẩu gà lá é Tao Ngộ',
            locationName: '5 Đường 3/4, Phường 3, Đà Lạt',
            lat: 11.9298,
            lng: 108.4412,
            category: 'food',
            estimatedCost: 350000,
            currency: 'VND',
            notes: 'Nước dùng ngọt thanh đậm đà lá é tươi, ăn kèm măng chua và nấm búp.'
          }
        ]
      },
      {
        dayNumber: 2,
        date: '16/12/2026',
        title: 'Bình minh đồi thông & Trải nghiệm cảm giác mạnh',
        summary: 'Dậy sớm săn biển mây bồng bềnh tại đồi Đa Phú, vui chơi hết mình với đường trượt xe Alpine Coaster xuyên rừng thông Datanla.',
        activities: [
          {
            id: 'act-dl-201',
            time: '05:00 AM',
            title: 'Săn mây & đón bình minh Đồi Đa Phú',
            locationName: 'Đồi Đa Phú, Phường 7, Đà Lạt',
            lat: 11.9721,
            lng: 108.4051,
            category: 'sightseeing',
            estimatedCost: 0,
            currency: 'VND',
            notes: 'Mang theo áo khoác ấm và máy ảnh. Khung cảnh sương mù bao phủ đồi thông đẹp rực rỡ.'
          },
          {
            id: 'act-dl-202',
            time: '11:00 AM',
            title: 'Thưởng thức Bánh ướt lòng gà Trang',
            locationName: '15F Tăng Bạt Hổ, Đà Lạt',
            lat: 11.9405,
            lng: 108.4362,
            category: 'food',
            estimatedCost: 65000,
            currency: 'VND',
            notes: 'Bánh ướt dẻo quánh ăn kèm lòng gà xé phay giòn ngon chuẩn vị.'
          },
          {
            id: 'act-dl-203',
            time: '02:00 PM',
            title: 'Trải nghiệm Xe trượt Alpine Coaster Thác Datanla',
            locationName: 'Khu du lịch Thác Datanla, Quốc Lộ 20',
            lat: 11.9023,
            lng: 108.4485,
            category: 'activity',
            estimatedCost: 250000,
            currency: 'VND',
            notes: 'Tuyến xe trượt dài nhất Đông Nam Á băng qua đại ngàn xanh mát.'
          }
        ]
      },
      {
        dayNumber: 3,
        date: '17/12/2026',
        title: 'Thành phố tâm linh & Bánh căn dốc Nhà Làng',
        summary: 'Đón cáp treo ngắm nhìn toàn cảnh rừng thông, ghé thăm Thiền Viện Trúc Lâm thanh tịnh và thưởng thức lẩu bò nghi ngút khói.',
        activities: [
          {
            id: 'act-dl-301',
            time: '08:30 AM',
            title: 'Cáp treo Đồi Robin sang Thiền Viện Trúc Lâm',
            locationName: 'Đồi Robin, Phường 3, Đà Lạt',
            lat: 11.9221,
            lng: 108.4431,
            category: 'transport',
            estimatedCost: 120000,
            currency: 'VND',
            notes: 'Tầm nhìn 360 độ bao quát Hồ Tuyền Lâm và thung lũng sương mù.'
          },
          {
            id: 'act-dl-302',
            time: '06:00 PM',
            title: 'Bữa tối Lẩu bò Ba Toa quán Cỗ',
            locationName: '1/29 Hoàng Diệu, Đà Lạt',
            lat: 11.9412,
            lng: 108.4298,
            category: 'food',
            estimatedCost: 380000,
            currency: 'VND',
            notes: 'Thịt bò tươi mềm, nước dùng thơm ngậy thảo mộc trong tiết trời se lạnh.'
          }
        ]
      }
    ],
    expenses: [
      { id: 'exp-dl-1', title: 'Lẩu gà lá é Tao Ngộ (Nhóm)', amount: 450000, currency: 'VND', category: 'food', paidBy: 'm1', splitWith: ['m1', 'm2', 'm3'], date: '2026-12-15' },
      { id: 'exp-dl-2', title: 'Thuê xe máy tay ga 3 ngày', amount: 360000, currency: 'VND', category: 'transport', paidBy: 'm2', splitWith: ['m1', 'm2', 'm3'], date: '2026-12-15' },
      { id: 'exp-dl-3', title: 'Vé xe trượt Datanla (3 người)', amount: 750000, currency: 'VND', category: 'activity', paidBy: 'm3', splitWith: ['m1', 'm2', 'm3'], date: '2026-12-16' }
    ],
    packingList: [
      { id: 'p-dl-1', category: 'Clothing', name: 'Áo khoác dầy & Khăn quàng cổ', quantity: 2, isPacked: true },
      { id: 'p-dl-2', category: 'Clothing', name: 'Giày thể thao êm chân đi bộ đồi', quantity: 1, isPacked: true },
      { id: 'p-dl-3', category: 'Toiletries', name: 'Kem dưỡng ẩm & Son dưỡng môi', quantity: 1, isPacked: true },
      { id: 'p-dl-4', category: 'Electronics', name: 'Sạc dự phòng 20,000mAh', quantity: 1, isPacked: false }
    ],
    documents: [
      { id: 'doc-dl-1', title: 'Vé xe Limousine Thành Bưởi', docType: 'Flight Ticket', codeOrNumber: 'TB-992108', notes: 'Xuất phát 23:30 tại bến Bến Xe Mền Đông. Ghế VIP nằm.', date: '2026-12-14' },
      { id: 'doc-dl-2', title: 'Đặt phòng Homestay Dốc Mơ', docType: 'Hotel Voucher', codeOrNumber: 'HOMESTAY-DM-882', notes: 'Check-in 12:00 PM. Hỗ trợ gửi đồ sớm.', date: '2026-12-15' }
    ]
  },
  {
    id: 'trip-vungtau',
    title: 'Vũng Tàu 08/2026 - Biển Xanh & Hải Sản',
    destination: 'Vũng Tàu',
    country: 'Việt Nam',
    startDate: '2026-08-20',
    endDate: '2026-08-22',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    budgetTotal: 4500000,
    currency: 'VND',
    members: [
      { id: 'm1', name: 'Minh Tuấn', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
      { id: 'm4', name: 'Ngọc Mai', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' }
    ],
    weatherForecast: {
      avgTempC: 30,
      condition: 'Nắng ấm dạt dào gió biển',
      icon: '🌊'
    },
    days: [
      {
        dayNumber: 1,
        date: '20/08/2026',
        title: 'Check-in Ngọn Hải Đăng & Bữa tối hải sản',
        summary: 'Đến Vũng Tàu bằng xe limousine, thưởng thức Yaourt Cô Tiên trên đỉnh Hải Đăng ngắm toàn cảnh thành phố biển.',
        activities: [
          {
            id: 'act-vt-101',
            time: '02:00 PM',
            title: 'Check-in Khách sạn Imperial Vũng Tàu',
            locationName: '159 Thùy Vân, Bãi Sau, Vũng Tàu',
            lat: 10.3341,
            lng: 107.0982,
            category: 'stay',
            estimatedCost: 1800000,
            currency: 'VND',
            notes: 'Khách sạn phong cách hoàng gia view hướng thẳng Bãi Sau.'
          },
          {
            id: 'act-vt-102',
            time: '04:30 PM',
            title: 'Tham quan Ngọn Hải Đăng & Thưởng thức Yaourt Cô Tiên',
            locationName: 'Đỉnh núi Nhỏ, Phường 2, Vũng Tàu',
            lat: 10.3285,
            lng: 107.0851,
            category: 'sightseeing',
            estimatedCost: 50000,
            currency: 'VND',
            notes: 'Thưởng thức yaourt phô mai dẻo mịn và trứng lòng đào trứ danh.'
          },
          {
            id: 'act-vt-103',
            time: '07:00 PM',
            title: 'Ăn tối Lẩu cá đuối Trương Công Định',
            locationName: '40 Trương Công Định, Phường 3, Vũng Tàu',
            lat: 10.3421,
            lng: 107.0782,
            category: 'food',
            estimatedCost: 320000,
            currency: 'VND',
            notes: 'Nước lẩu chua ngọt đậm đà, thịt cá đuối tươi ngọt ngắt.'
          }
        ]
      },
      {
        dayNumber: 2,
        date: '21/08/2026',
        title: 'Tắm biển Bãi Sau & Bữa tối Gành Hào',
        summary: 'Nạp năng lượng với món bánh khọt nóng hổi giòn rụm, chinh phục Tượng Chúa Kito Vua và thư giãn tắm biển Bãi Sau.',
        activities: [
          {
            id: 'act-vt-201',
            time: '07:30 AM',
            title: 'Ăn sáng Bánh khọt Gốc Vú Sữa',
            locationName: '14 Nguyễn Trường Tộ, Vũng Tàu',
            lat: 10.3371,
            lng: 107.0812,
            category: 'food',
            estimatedCost: 70000,
            currency: 'VND',
            notes: 'Bánh khọt tôm tươi đổ chảo dầu thơm lừng ăn kèm đu đủ bào sợi.'
          },
          {
            id: 'act-vt-202',
            time: '09:00 AM',
            title: 'Chinh phục 847 bậc thang Tượng Chúa Kito Vua',
            locationName: 'Thùy Vân, Phường 2, Vũng Tàu',
            lat: 10.3241,
            lng: 107.0845,
            category: 'sightseeing',
            estimatedCost: 0,
            currency: 'VND',
            notes: 'Lên hai đôi tay Tượng Chúa ngắm trọn vẹn bờ biển Mũi Nghinh Phong.'
          },
          {
            id: 'act-vt-203',
            time: '06:30 PM',
            title: 'Thưởng thức hải sản ngắm hoàng hôn tại Gành Hào',
            locationName: '03 Trần Phú, Phường 5, Vũng Tàu',
            lat: 10.3621,
            lng: 107.0652,
            category: 'food',
            estimatedCost: 950000,
            currency: 'VND',
            notes: 'Nhà hàng sát bờ biển. Thưởng thức hàu nướng mỡ hành, tôm hùm xóc bơ tỏi.'
          }
        ]
      }
    ],
    expenses: [
      { id: 'exp-vt-1', title: 'Thịt nướng & Hải sản Gành Hào', amount: 950000, currency: 'VND', category: 'food', paidBy: 'm1', splitWith: ['m1', 'm4'], date: '2026-08-21' },
      { id: 'exp-vt-2', title: 'Xe Limousine Hoa Mai khứ hồi', amount: 400000, currency: 'VND', category: 'transport', paidBy: 'm4', splitWith: ['m1', 'm4'], date: '2026-08-20' }
    ],
    packingList: [
      { id: 'p-vt-1', category: 'Clothing', name: 'Đồ bơi & Quần áo dạo biển', quantity: 3, isPacked: true },
      { id: 'p-vt-2', category: 'Essentials', name: 'Kem chống nắng SPF 50+ & Kính mát', quantity: 1, isPacked: true },
      { id: 'p-vt-3', category: 'Gear', name: 'Túi chống nước điện thoại', quantity: 1, isPacked: false }
    ],
    documents: [
      { id: 'doc-vt-1', title: 'Mã vé Xe Limousine Hoa Mai', docType: 'Flight Ticket', codeOrNumber: 'HM-VT-8821', notes: 'Khởi hành 07:00 AM tại Trạm Nguyễn Thái Bình Q1.', date: '2026-08-20' }
    ]
  },
  {
    id: 'trip-phuquoc',
    title: 'Phú Quốc 10/2026 - Thiên Đường Biển Đảo',
    destination: 'Phú Quốc',
    country: 'Việt Nam',
    startDate: '2026-10-15',
    endDate: '2026-10-19',
    coverImage: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    budgetTotal: 9500000,
    currency: 'VND',
    members: [
      { id: 'm1', name: 'Minh Tuấn', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
      { id: 'm2', name: 'Thùy Trang', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80' },
      { id: 'm3', name: 'Bảo Anh', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' }
    ],
    weatherForecast: {
      avgTempC: 28,
      condition: 'Nắng vàng trong xanh lý tưởng',
      icon: '🌴'
    },
    days: [
      {
        dayNumber: 1,
        date: '15/10/2026',
        title: 'Bún Quậy Kiến Xây & Dạo phố biển ngọc',
        summary: 'Khởi hành bay đến đảo Ngọc Phú Quốc, check-in resort, thưởng thức món Bún Quậy đặc sản nổi tiếng.',
        activities: [
          {
            id: 'act-pq-101',
            time: '02:00 PM',
            title: 'Check-in Vinpearl Discovery Phú Quốc',
            locationName: 'Gành Dầu, Phú Quốc',
            lat: 10.3301,
            lng: 103.8550,
            category: 'stay',
            estimatedCost: 2500000,
            currency: 'VND',
            notes: 'Khu biệt thự nghỉ dưỡng bãi biển thơ mộng.'
          },
          {
            id: 'act-pq-102',
            time: '05:00 PM',
            title: 'Check-in Sunset Sanato Beach Club',
            locationName: 'Bãi Trường, Dương Tơ, Phú Quốc',
            lat: 10.1850,
            lng: 103.9610,
            category: 'sightseeing',
            estimatedCost: 100000,
            currency: 'VND',
            notes: 'Nơi đón hoàng hôn đẹp nhất Phú Quốc với các tượng nghệ thuật trên biển.'
          },
          {
            id: 'act-pq-103',
            time: '07:30 PM',
            title: 'Trải nghiệm Bún Quậy Kiến Xây',
            locationName: '28 Bạch Đằng, Dương Đông, Phú Quốc',
            lat: 10.2185,
            lng: 103.9582,
            category: 'food',
            estimatedCost: 75000,
            currency: 'VND',
            notes: 'Tự quậy nước chấm tắc ớt độc đáo ăn kèm chả tôm mực tươi quết tại chỗ.'
          }
        ]
      },
      {
        dayNumber: 2,
        date: '16/10/2026',
        title: 'Cáp treo 3 dây dài nhất thế giới & Tour 4 Đảo',
        summary: 'Trải nghiệm cáp treo vượt biển kỷ lục thế giới đến Hòn Thơm, tham gia tour cano lặn biển ngắm san hô bãi Mây Rút.',
        activities: [
          {
            id: 'act-pq-201',
            time: '08:30 AM',
            title: 'Đi Cáp treo Hòn Thơm Sun World',
            locationName: 'Thị trấn Địa Trung Hải, An Thới',
            lat: 10.0285,
            lng: 104.0120,
            category: 'sightseeing',
            estimatedCost: 650000,
            currency: 'VND',
            notes: 'Tuyến cáp treo 3 dây vượt biển dài 7,899m ngoạn mục.'
          },
          {
            id: 'act-pq-202',
            time: '01:00 PM',
            title: 'Tour Cano lặn ngắm san hô Hòn Mây Rút & Hòn Móng Tay',
            locationName: 'Quần đảo An Thới, Phú Quốc',
            lat: 10.0120,
            lng: 104.0250,
            category: 'activity',
            estimatedCost: 850000,
            currency: 'VND',
            notes: 'Lặn ngắm rạn san hô tự nhiên sắc màu và chụp ảnh flycam miễn phí.'
          }
        ]
      }
    ],
    expenses: [
      { id: 'exp-pq-1', title: 'Vé Cáp treo Hòn Thơm (3 người)', amount: 1950000, currency: 'VND', category: 'sightseeing', paidBy: 'm1', splitWith: ['m1', 'm2', 'm3'], date: '2026-10-16' },
      { id: 'exp-pq-2', title: 'Tour Cano 4 đảo lặn san hô', amount: 2550000, currency: 'VND', category: 'activity', paidBy: 'm2', splitWith: ['m1', 'm2', 'm3'], date: '2026-10-16' }
    ],
    packingList: [
      { id: 'p-pq-1', category: 'Clothing', name: 'Đồ bơi & Khăn tắm biển', quantity: 3, isPacked: true },
      { id: 'p-pq-2', category: 'Gear', name: 'Túi chống nước cho máy ảnh/điện thoại', quantity: 1, isPacked: true },
      { id: 'p-pq-3', category: 'Essentials', name: 'Hộ chiếu & Căn cước công dân', quantity: 1, isPacked: true }
    ],
    documents: [
      { id: 'doc-pq-1', title: 'Vé máy bay Vietnam Airlines', docType: 'Flight Ticket', codeOrNumber: 'VN-PQ-8812', notes: 'Khởi hành 09:30 AM từ Sân bay Tân Sơn Nhất.', date: '2026-10-15' }
    ]
  },
  {
    id: 'trip-japan',
    title: 'Nhật Bản 04/2027 - Mùa Hoa Anh Đào',
    destination: 'Tokyo & Kyoto',
    country: 'Nhật Bản',
    startDate: '2027-04-05',
    endDate: '2027-04-11',
    coverImage: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    budgetTotal: 2200,
    currency: 'USD',
    members: [
      { id: 'm1', name: 'Minh Tuấn', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
      { id: 'm2', name: 'Thùy Trang', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80' }
    ],
    weatherForecast: {
      avgTempC: 18,
      condition: 'Nắng ấm hoa anh đào nở rộ',
      icon: '🌸'
    },
    days: [
      {
        dayNumber: 1,
        date: '05/04/2027',
        title: 'Shibuya Crossing & Thưởng thức Ramen Ichiran',
        summary: 'Đáp chuyến bay Haneda, check-in khách sạn, ngắm những rặng hoa anh đào nở hồng rực rỡ tại Shinjuku Gyoen.',
        activities: [
          {
            id: 'act-jp-101',
            time: '02:00 PM',
            title: 'Ngắm hoa hoa sakura tại Shinjuku Gyoen',
            locationName: 'Shinjuku, Tokyo',
            lat: 35.6852,
            lng: 139.7101,
            category: 'sightseeing',
            estimatedCost: 4,
            notes: 'Hơn 1,000 cây hoa anh đào thuộc nhiều chủng loại nở rộ rực rỡ.'
          },
          {
            id: 'act-jp-102',
            time: '06:00 PM',
            title: 'Trải nghiệm Shibuya Sky Observation Deck',
            locationName: 'Shibuya Scramble Square',
            lat: 35.6586,
            lng: 139.7012,
            category: 'sightseeing',
            estimatedCost: 18,
            notes: 'Ngắm toàn cảnh tháp Tokyo & núi Phú Sĩ tuyệt đẹp từ độ cao 229m.'
          }
        ]
      }
    ],
    expenses: [],
    packingList: [],
    documents: []
  }
];
