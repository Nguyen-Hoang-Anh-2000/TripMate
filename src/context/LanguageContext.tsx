import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'vi';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isVi: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navbar
    'app.title': 'TripMate',
    'app.badge': 'AI Companion',
    'app.subtitle': 'Smart Travel & Group Expense Planner',
    'nav.switchTrip': 'Switch Trip',
    'nav.createNewTrip': 'Create New Trip',
    'nav.generateAI': 'Generate AI Itinerary',
    'nav.aiPlanShort': 'AI Plan',
    'nav.assistant': 'Assistant',
    'nav.addTrip': 'Add Trip',

    // Hero Banner
    'hero.targetBudget': 'Target Budget',
    'hero.aiCustomize': 'AI Customize',

    // Tabs
    'tab.itinerary': 'Itinerary',
    'tab.map': 'Map',
    'tab.places': 'Saved Places',
    'tab.expenses': 'Expense Splitter',
    'tab.packing': 'Packing Checklist',
    'tab.vault': 'Travel Vault',
    'tab.daysCount': '{count} Days',

    // Categories
    'cat.all': 'All Activities',
    'cat.sightseeing': 'Sightseeing',
    'cat.food': 'Food & Dining',
    'cat.activity': 'Activities',
    'cat.transport': 'Transport',
    'cat.stay': 'Stay / Hotel',
    'cat.shopping': 'Shopping',
    'cat.other': 'Other',

    // Itinerary View
    'itinerary.aiCta': 'Regenerate or Add Days with AI',
    'itinerary.day': 'Day',
    'itinerary.estCost': 'Est. Cost',
    'itinerary.allDays': 'All Days',
    'itinerary.dayNum': 'Day {day}',
    'itinerary.dayCount': '{count} Days',
    'itinerary.activitiesCount': '{count} Activities',
    'itinerary.addActivity': 'Add Activity',
    'itinerary.completed': 'Completed',
    'itinerary.noActivities': 'No activities match the selected filter for this day.',
    'itinerary.emptyHint': 'No activities scheduled for this day yet. Click "Add Activity" to start!',
    'itinerary.addActivityToDay': 'Add Activity to Day {day}',
    'itinerary.addNewTitle': 'Add Activity',
    'itinerary.fieldTitle': 'Activity Title',
    'itinerary.fieldLocation': 'Location',
    'itinerary.fieldTime': 'Time',
    'itinerary.fieldCategory': 'Category',
    'itinerary.fieldEstCost': 'Cost',
    'itinerary.fieldNotes': 'Notes / Tips',
    'itinerary.saveActivity': 'Save Activity',
    'itinerary.cancel': 'Cancel',
    'itinerary.quickStats': 'Quick Overview',
    'itinerary.totalEst': 'Total Estimated',

    // Interactive Map
    'map.routeTitle': '{dest} Map',
    'map.waypoints': 'Trip Waypoints',
    'map.stops': 'Stops',
    'map.stopsCount': '{count} Stops',
    'map.clickTip': 'Click pins or items above to highlight details on map.',

    // Expense Splitter
    'expenses.totalSpent': 'Total Spent',
    'expenses.tripSplitters': 'Trip Splitters',
    'expenses.splitters': 'Trip Splitters',
    'expenses.equalSharing': 'Equal and custom splitting supported',
    'expenses.budgetUtilized': '{pct}% of target budget used',
    'expenses.newExpense': 'New Group Expense',
    'expenses.newExpenseTitle': 'New Group Expense',
    'expenses.newDesc': 'Track restaurant bills, hotel stays, or transport tickets.',
    'expenses.newExpenseDesc': 'Track restaurant bills, hotel stays, or transport tickets.',
    'expenses.addBtn': 'Add Expense',
    'expenses.addExpenseBtn': 'Add Expense',
    'expenses.cancelForm': 'Cancel Form',
    'expenses.logTitle': 'Log New Expense',
    'expenses.description': 'Expense Description',
    'expenses.fieldDesc': 'Description / Item',
    'expenses.amount': 'Amount',
    'expenses.fieldAmount': 'Amount ({currency})',
    'expenses.category': 'Category',
    'expenses.paidBy': 'Paid By',
    'expenses.fieldPaidBy': 'Paid By',
    'expenses.splitWith': 'Split With',
    'expenses.fieldSplitWith': 'Split With',
    'expenses.saveBtn': 'Save Expense',
    'expenses.saveExpense': 'Save Expense',
    'expenses.settlementSummary': 'Settlement Summary',
    'expenses.minimizationMatrix': 'Minimization Matrix',
    'expenses.allSettled': 'All Expenses Settled!',
    'expenses.noPendingDebts': 'No pending debts between trip members.',
    'expenses.memberBalances': 'Member Balances',
    'expenses.history': 'Expense History',
    'expenses.historyTitle': 'Expense History',
    'expenses.recordsCount': '{count} records',
    'expenses.noExpenses': 'No expenses logged yet. Click "Add Expense" above.',
    'expenses.owes': 'owes',
    'expenses.paidByText': 'Paid by',
    'expenses.splitAmong': 'Split among {count} member(s)',

    // Packing List
    'packing.title': 'Smart Packing Checklist',
    'packing.progress': '{packed} of {total} Packed',
    'packing.subtitle': 'Stay organized and ready for your flight to {dest}.',
    'packing.aiAutoGenerate': 'AI Auto-Generate Packing List',
    'packing.aiGenerating': 'AI Generating Packing List...',
    'packing.itemName': 'Item Name',
    'packing.category': 'Category',
    'packing.qty': 'Qty',
    'packing.addItem': 'Add Item',
    'packing.noItemsInCat': 'No items added in {cat}.',
    'packing.catEssentials': 'Essentials',
    'packing.catClothing': 'Clothing',
    'packing.catElectronics': 'Electronics',
    'packing.catToiletries': 'Toiletries',
    'packing.catDocuments': 'Documents',
    'packing.catGear': 'Gear',

    // Travel Vault
    'vault.title': 'Travel Documents & Reservations Vault',
    'vault.subtitle': 'Secure offline access to confirmation numbers, ticket codes, and emergency notes.',
    'vault.addBtn': 'Add Document / Ticket',
    'vault.modalTitle': 'Save New Travel Voucher or Document',
    'vault.formTitle': 'Save New Travel Voucher or Document',
    'vault.docTitle': 'Document Title',
    'vault.fieldTitle': 'Document Title',
    'vault.docType': 'Document Type',
    'vault.fieldType': 'Document Type',
    'vault.codeNumber': 'Confirmation Code / Number',
    'vault.fieldCode': 'Confirmation Code / Number',
    'vault.date': 'Date',
    'vault.fieldDate': 'Date',
    'vault.notesDetails': 'Notes & Key Details',
    'vault.fieldNotes': 'Notes & Key Details',
    'vault.saveBtn': 'Save Document',
    'vault.saveDoc': 'Save',
    'vault.noDocs': 'No travel documents saved yet.',
    'vault.noDocsTip': 'Click "Add Document / Ticket" to keep flight or hotel codes handy.',
    'vault.noDocsSub': 'Click "Add Document / Ticket" to keep flight or hotel codes handy.',
    'vault.copied': 'Copied',
    'vault.copy': 'Copy',
    'vault.typeFlight': 'Flight Ticket',
    'vault.typeHotel': 'Hotel Voucher',
    'vault.typeInsurance': 'Insurance Policy',
    'vault.typePassport': 'Passport / Visa',
    'vault.typeOther': 'Other Note',

    // AI Itinerary Modal
    'aiModal.headerTitle': 'AI Travel Itinerary Architect',
    'aiModal.poweredBy': 'Powered by Gemini 3.6 Flash',
    'aiModal.destLabel': 'Destination City or Country',
    'aiModal.durationLabel': 'Duration (Days)',
    'aiModal.styleLabel': 'Travel Vibe & Style',
    'aiModal.groupLabel': 'Group Type',
    'aiModal.budgetLabel': 'Target Budget (USD)',
    'aiModal.interestsLabel': 'Interests & Priorities',
    'aiModal.generateBtn': 'Generate Day-by-Day Plan with AI',
    'aiModal.generatingBtn': 'Architecting Custom AI Itinerary...',
    'aiModal.daysPlan': '{count} Days Plan',
    'aiModal.editPrompt': 'Edit Prompt',
    'aiModal.applyBtn': 'Apply To Active Trip',

    // AI Itinerary Form Options
    'aiStyle.cultural': 'Cultural & Foodie',
    'aiStyle.balanced': 'Balanced Explorer',
    'aiStyle.budget': 'Budget Backpacker',
    'aiStyle.luxury': 'Luxury & Wellness',
    'aiStyle.family': 'Family Friendly',
    'aiStyle.thrill': 'Thrill & Adventure',

    'aiGroup.friends': 'Friends Group',
    'aiGroup.couple': 'Couple / Romantic',
    'aiGroup.solo': 'Solo Traveler',
    'aiGroup.family': 'Family with Kids',

    'interest.food': 'Food & Dining',
    'interest.temples': 'Historical Temples',
    'interest.photo': 'Photography',
    'interest.shopping': 'Shopping',
    'interest.nightlife': 'Nightlife',
    'interest.nature': 'Nature & Hiking',
    'interest.art': 'Art & Museums',
    'interest.tech': 'Anime & Tech',

    // AI Assistant Chat
    'chat.title': 'TripMate AI Assistant',
    'chat.context': 'Context: {dest}',
    'chat.greeting': "Hello! I'm your TripMate AI travel guide for {dest}. How can I assist you today?",
    'chat.prompt1': 'Must-try dishes in {dest}? 🍜',
    'chat.prompt2': 'Tipping & cultural etiquette in {country}? 💡',
    'chat.prompt3': 'Best public transit pass to buy? 🚆',
    'chat.prompt4': 'Safety tips & emergency numbers? 🛡️',
    'chat.thinking': 'TripMate AI is thinking...',
    'chat.askPlaceholder': 'Ask anything about {dest}...',

    // New Trip Modal
    'newTrip.modalTitle': 'Create Trip',
    'newTrip.headerTitle': 'Create Trip',
    'newTrip.fieldTitle': 'Trip Title',
    'newTrip.titleLabel': 'Trip Title',
    'newTrip.titlePlaceholder': 'e.g. Vacation in Da Lat 12/2026',
    'newTrip.fieldDest': 'City',
    'newTrip.destLabel': 'City',
    'newTrip.destPlaceholder': 'e.g. Da Lat, Vung Tau, Tokyo...',
    'newTrip.fieldCountry': 'Country',
    'newTrip.countryLabel': 'Country',
    'newTrip.countryPlaceholder': 'e.g. Vietnam, Japan, France...',
    'newTrip.fieldStart': 'Start Date',
    'newTrip.startLabel': 'Start Date',
    'newTrip.fieldEnd': 'End Date',
    'newTrip.endLabel': 'End Date',
    'newTrip.fieldBudget': 'Budget',
    'newTrip.budgetLabel': 'Budget',
    'newTrip.budgetPlaceholder': 'e.g. 500',
    'newTrip.fieldCurrency': 'Currency',
    'newTrip.currencyLabel': 'Currency',
    'newTrip.fieldCover': 'Photo',
    'newTrip.coverLabel': 'Photo',
    'newTrip.createBtn': 'Create Trip',
    'newTrip.cancelBtn': 'Cancel',
    'preset.japan': 'Japan / Tokyo',
    'preset.amalfi': 'Italy / Amalfi',
    'preset.dalat': 'Vietnam / Da Lat',
    'preset.vungtau': 'Vietnam / Vung Tau',
    'preset.paris': 'France / Paris',
    'preset.phuquoc': 'Vietnam / Phu Quoc',
  },
  vi: {
    // Navbar
    'app.title': 'TripMate',
    'app.badge': 'Trợ lý AI',
    'app.subtitle': 'Lên Lịch trình Du lịch & Quản lý Chi tiêu Nhóm',
    'nav.switchTrip': 'Đổi Chuyến đi',
    'nav.createNewTrip': 'Tạo Chuyến đi Mới',
    'nav.generateAI': 'Tạo Lịch trình bằng AI',
    'nav.aiPlanShort': 'Kế hoạch AI',
    'nav.assistant': 'Trợ lý AI',
    'nav.addTrip': 'Thêm Chuyến đi',

    // Hero Banner
    'hero.targetBudget': 'Ngân sách Mục tiêu',
    'hero.aiCustomize': 'Tùy chỉnh AI',

    // Tabs
    'tab.itinerary': 'Lịch trình',
    'tab.map': 'Bản đồ',
    'tab.places': 'Địa điểm',
    'tab.expenses': 'Chi tiêu',
    'tab.packing': 'Đồ đạc',
    'tab.vault': 'Vé & Giấy tờ',
    'tab.daysCount': '{count} Ngày',

    // Categories
    'cat.all': 'Tất cả Hoạt động',
    'cat.sightseeing': 'Tham quan',
    'cat.food': 'Ăn uống & Bữa ăn',
    'cat.activity': 'Trải nghiệm',
    'cat.transport': 'Phương tiện',
    'cat.stay': 'Khách sạn / Chỗ ở',
    'cat.shopping': 'Mua sắm',
    'cat.other': 'Khác',

    // Itinerary View
    'itinerary.aiCta': 'Tạo lại hoặc Thêm ngày bằng AI',
    'itinerary.day': 'Ngày',
    'itinerary.estCost': 'Chi phí',
    'itinerary.allDays': 'Tất cả các ngày',
    'itinerary.dayNum': 'Ngày {day}',
    'itinerary.dayCount': '{count} Ngày',
    'itinerary.activitiesCount': '{count} Hoạt động',
    'itinerary.addActivity': 'Thêm Hoạt động',
    'itinerary.completed': 'Đã hoàn thành',
    'itinerary.noActivities': 'Không có hoạt động nào phù hợp với bộ lọc cho ngày này.',
    'itinerary.emptyHint': 'Chưa có hoạt động nào trong ngày này. Hãy bấm "Thêm Hoạt động" để bắt đầu!',
    'itinerary.addActivityToDay': 'Thêm Hoạt động vào Ngày {day}',
    'itinerary.addNewTitle': 'Thêm Hoạt động',
    'itinerary.fieldTitle': 'Tên Hoạt động',
    'itinerary.fieldLocation': 'Địa điểm',
    'itinerary.fieldTime': 'Thời gian',
    'itinerary.fieldCategory': 'Thể loại',
    'itinerary.fieldEstCost': 'Chi phí',
    'itinerary.fieldNotes': 'Lưu ý',
    'itinerary.saveActivity': 'Lưu Hoạt động',
    'itinerary.cancel': 'Hủy',
    'itinerary.quickStats': 'Tổng quan Lịch trình',
    'itinerary.totalEst': 'Tổng Dự kiến',

    // Interactive Map
    'map.routeTitle': 'Bản đồ {dest}',
    'map.waypoints': 'Các Điểm dừng trong Chuyến đi',
    'map.stops': 'Điểm dừng',
    'map.stopsCount': '{count} Điểm dừng',
    'map.clickTip': 'Nhấp vào ghim hoặc danh sách bên trên để xem chi tiết trên bản đồ.',

    // Expense Splitter
    'expenses.totalSpent': 'Tổng Chi tiêu',
    'expenses.tripSplitters': 'Thành viên Nhóm',
    'expenses.splitters': 'Thành viên Nhóm',
    'expenses.equalSharing': 'Hỗ trợ chia đều hoặc chọn người chịu chi',
    'expenses.budgetUtilized': 'Đã sử dụng {pct}% ngân sách mục tiêu',
    'expenses.newExpense': 'Chi tiêu Nhóm Mới',
    'expenses.newExpenseTitle': 'Chi tiêu Nhóm Mới',
    'expenses.newDesc': 'Ghi lại hóa đơn nhà hàng, khách sạn hoặc vé xe.',
    'expenses.newExpenseDesc': 'Ghi lại hóa đơn nhà hàng, khách sạn hoặc vé xe.',
    'expenses.addBtn': 'Thêm Chi tiêu',
    'expenses.addExpenseBtn': 'Thêm Chi tiêu',
    'expenses.cancelForm': 'Hủy biểu mẫu',
    'expenses.logTitle': 'Ghi nhận Chi tiêu Mới',
    'expenses.description': 'Mô tả Chi tiêu',
    'expenses.fieldDesc': 'Mô tả / Khoản chi',
    'expenses.amount': 'Số tiền',
    'expenses.fieldAmount': 'Số tiền ({currency})',
    'expenses.category': 'Danh mục',
    'expenses.paidBy': 'Người Trả tiền',
    'expenses.fieldPaidBy': 'Người Trả tiền',
    'expenses.splitWith': 'Chia cho Ai',
    'expenses.fieldSplitWith': 'Chia cho Ai',
    'expenses.saveBtn': 'Lưu Chi tiêu',
    'expenses.saveExpense': 'Lưu Chi tiêu',
    'expenses.settlementSummary': 'Tóm tắt Thanh toán',
    'expenses.minimizationMatrix': 'Tính toán Nợ tối ưu',
    'expenses.allSettled': 'Đã Thanh toán Hết!',
    'expenses.noPendingDebts': 'Không có khoản nợ nào giữa các thành viên.',
    'expenses.memberBalances': 'Số dư Thành viên',
    'expenses.history': 'Lịch sử Chi tiêu',
    'expenses.historyTitle': 'Lịch sử Chi tiêu',
    'expenses.recordsCount': '{count} khoản chi',
    'expenses.noExpenses': 'Chưa có khoản chi tiêu nào. Nhấp "Thêm Chi tiêu" ở trên.',
    'expenses.owes': 'nợ',
    'expenses.paidByText': 'Người trả:',
    'expenses.splitAmong': 'Chia cho {count} người',

    // Packing List
    'packing.title': 'Danh sách Đồ đạc Thông minh',
    'packing.progress': 'Đã chuẩn bị {packed} / {total} món',
    'packing.subtitle': 'Sẵn sàng và đầy đủ đồ đạc cho chuyến đi đến {dest}.',
    'packing.aiAutoGenerate': 'Tự động Tạo Danh sách Đồ đạc bằng AI',
    'packing.aiGenerating': 'AI đang gợi ý danh sách đồ đạc...',
    'packing.itemName': 'Tên Đồ đạc',
    'packing.category': 'Danh mục',
    'packing.qty': 'Số lượng',
    'packing.addItem': 'Thêm Đồ đạc',
    'packing.noItemsInCat': 'Chưa có đồ đạc trong mục {cat}.',
    'packing.catEssentials': 'Thiết yếu',
    'packing.catClothing': 'Quần áo',
    'packing.catElectronics': 'Đồ điện tử',
    'packing.catToiletries': 'Đồ vệ sinh cá nhân',
    'packing.catDocuments': 'Giấy tờ',
    'packing.catGear': 'Dụng cụ du lịch',

    // Travel Vault
    'vault.title': 'Kho Lưu trữ Vé & Giấy tờ Du lịch',
    'vault.subtitle': 'Lưu trữ ngoại tuyến an toàn mã xác nhận, vé máy bay và ghi chú quan trọng.',
    'vault.addBtn': 'Thêm Giấy tờ / Vé',
    'vault.modalTitle': 'Lưu Mã xác nhận hoặc Giấy tờ Mới',
    'vault.formTitle': 'Lưu Mã xác nhận hoặc Giấy tờ Mới',
    'vault.docTitle': 'Tên Giấy tờ / Vé',
    'vault.fieldTitle': 'Tên Giấy tờ / Vé',
    'vault.docType': 'Loại Giấy tờ',
    'vault.fieldType': 'Loại Giấy tờ',
    'vault.codeNumber': 'Mã xác nhận / Số hiệu',
    'vault.fieldCode': 'Mã xác nhận / Số hiệu',
    'vault.date': 'Ngày',
    'vault.fieldDate': 'Ngày',
    'vault.notesDetails': 'Ghi chú & Thông tin quan trọng',
    'vault.fieldNotes': 'Ghi chú & Thông tin quan trọng',
    'vault.saveBtn': 'Lưu Giấy tờ',
    'vault.saveDoc': 'Lưu',
    'vault.noDocs': 'Chưa có giấy tờ nào được lưu.',
    'vault.noDocsTip': 'Nhấp "Thêm Giấy tờ / Vé" để lưu sẵn mã vé máy bay hoặc khách sạn.',
    'vault.noDocsSub': 'Nhấp "Thêm Giấy tờ / Vé" để lưu sẵn mã vé máy bay hoặc khách sạn.',
    'vault.copied': 'Đã sao chép',
    'vault.copy': 'Sao chép',
    'vault.typeFlight': 'Vé máy bay',
    'vault.typeHotel': 'Xác nhận Khách sạn',
    'vault.typeInsurance': 'Bảo hiểm Du lịch',
    'vault.typePassport': 'Hộ chiếu / Visa',
    'vault.typeOther': 'Ghi chú khác',

    // AI Itinerary Modal
    'aiModal.headerTitle': 'Kiến trúc sư Lịch trình AI',
    'aiModal.poweredBy': 'Cung cấp bởi Gemini 3.6 Flash',
    'aiModal.destLabel': 'Thành phố hoặc Quốc gia Điểm đến',
    'aiModal.durationLabel': 'Thời gian (Số ngày)',
    'aiModal.styleLabel': 'Phong cách & Gu Du lịch',
    'aiModal.groupLabel': 'Loại hình Nhóm',
    'aiModal.budgetLabel': 'Ngân sách Dự kiến (USD)',
    'aiModal.interestsLabel': 'Sở thích & Ưu tiên',
    'aiModal.generateBtn': 'Tạo Lịch trình Chi tiết bằng AI',
    'aiModal.generatingBtn': 'Đang thiết kế lịch trình AI riêng cho bạn...',
    'aiModal.daysPlan': 'Lịch trình {count} Ngày',
    'aiModal.editPrompt': 'Chỉnh sửa Yêu cầu',
    'aiModal.applyBtn': 'Áp dụng vào Chuyến đi Hiện tại',

    // AI Itinerary Form Options
    'aiStyle.cultural': 'Văn hóa & Ẩm thực',
    'aiStyle.balanced': 'Khám phá Cân bằng',
    'aiStyle.budget': 'Bụi & Tiết kiệm',
    'aiStyle.luxury': 'Nghỉ dưỡng & Sang trọng',
    'aiStyle.family': 'Thích hợp Gia đình',
    'aiStyle.thrill': 'Mạo hiểm & Trải nghiệm',

    'aiGroup.friends': 'Nhóm Bạn bè',
    'aiGroup.couple': 'Cặp đôi / Lãng mạn',
    'aiGroup.solo': 'Đi một mình (Solo)',
    'aiGroup.family': 'Gia đình có trẻ em',

    'interest.food': 'Ăn uống & Món ngon',
    'interest.temples': 'Đền chùa & Di tích',
    'interest.photo': 'Chụp ảnh Check-in',
    'interest.shopping': 'Mua sắm',
    'interest.nightlife': 'Đời sống về đêm',
    'interest.nature': 'Thiên nhiên & Leo núi',
    'interest.art': 'Nghệ thuật & Bảo tàng',
    'interest.tech': 'Công nghệ & Manga',

    // AI Assistant Chat
    'chat.title': 'Trợ lý Du lịch TripMate AI',
    'chat.context': 'Ngữ cảnh: {dest}',
    'chat.greeting': 'Xin chào! Tôi là trợ lý du lịch AI TripMate của bạn tại {dest}. Tôi có thể giúp gì cho chuyến đi của bạn?',
    'chat.prompt1': 'Món ăn nhất định phải thử tại {dest}? 🍜',
    'chat.prompt2': 'Văn hóa ứng xử & tiền tip tại {country}? 💡',
    'chat.prompt3': 'Vé giao thông công cộng tốt nhất nên mua? 🚆',
    'chat.prompt4': 'Mẹo an toàn & số điện thoại khẩn cấp? 🛡️',
    'chat.thinking': 'TripMate AI đang suy nghĩ...',
    'chat.askPlaceholder': 'Hỏi bất kỳ điều gì về {dest}...',

    // New Trip Modal
    'newTrip.modalTitle': 'Tạo Chuyến Đi',
    'newTrip.headerTitle': 'Tạo Chuyến Đi',
    'newTrip.fieldTitle': 'Tên Chuyến Đi',
    'newTrip.titleLabel': 'Tên Chuyến Đi',
    'newTrip.titlePlaceholder': 'Ví dụ: Nghỉ dưỡng Đà Lạt 12/2026',
    'newTrip.fieldDest': 'Thành phố',
    'newTrip.destLabel': 'Thành phố',
    'newTrip.destPlaceholder': 'Ví dụ: Đà Lạt, Vũng Tàu, Phú Quốc...',
    'newTrip.fieldCountry': 'Quốc gia',
    'newTrip.countryLabel': 'Quốc gia',
    'newTrip.countryPlaceholder': 'Ví dụ: Việt Nam, Nhật Bản, Pháp...',
    'newTrip.fieldStart': 'Ngày Bắt đầu',
    'newTrip.startLabel': 'Ngày Bắt đầu',
    'newTrip.fieldEnd': 'Ngày Kết thúc',
    'newTrip.endLabel': 'Ngày Kết thúc',
    'newTrip.fieldBudget': 'Ngân sách',
    'newTrip.budgetLabel': 'Ngân sách',
    'newTrip.budgetPlaceholder': 'Ví dụ: 500',
    'newTrip.fieldCurrency': 'Tiền tệ',
    'newTrip.currencyLabel': 'Tiền tệ',
    'newTrip.fieldCover': 'Ảnh',
    'newTrip.coverLabel': 'Ảnh',
    'newTrip.createBtn': 'Lưu',
    'newTrip.cancelBtn': 'Hủy',
    'preset.japan': 'Nhật Bản / Tokyo',
    'preset.amalfi': 'Ý / Amalfi',
    'preset.dalat': 'Việt Nam / Đà Lạt',
    'preset.vungtau': 'Việt Nam / Vũng Tàu',
    'preset.paris': 'Pháp / Paris',
    'preset.phuquoc': 'Việt Nam / Phú Quốc',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('tripmate_lang');
    return (saved === 'vi' || saved === 'en') ? saved : 'vi';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('tripmate_lang', newLang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    let str = translations[lang]?.[key] || translations['en']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([pKey, pVal]) => {
        str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      });
    }
    return str;
  };

  const isVi = lang === 'vi';

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isVi }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
