# TripMate - Nền Tảng Quản Lý Chuyến Đi & Chia Tiền Nhóm Thông Minh

TripMate là ứng dụng du lịch toàn diện (All-in-one AI Travel Companion) kết hợp lập kế hoạch lịch trình thông minh, chia tiền nhóm minh bạch, két lưu trữ vé/hộ chiếu bảo mật và bản đồ số tương tác.

---

## 🌟 Tính Năng Nổi Bật

1. **Lịch Trình Tương Tác & AI Architect:**
   - Tạo và sắp xếp hoạt động theo ngày, tự động gắn thẻ danh mục (tham quan, ăn uống, lưu trú, di chuyển, mua sắm).
   - Tích hợp Gemini 2.5 Flash gợi ý điểm đến, ẩm thực bản địa và lịch trình tùy chỉnh.

2. **Sổ Quỹ Nhóm & Quyết Toán Chi Tiêu (Expense Splitter):**
   - Quản lý quỹ chung, ghi nhận chi phí theo thành viên ứng trước.
   - Chia tiền linh hoạt: chia đều hoặc tùy chỉnh từng người.
   - Thuật toán tối ưu hóa công nợ (Min-Cash-Flow Debt Settlement) giúp giảm thiểu số giao dịch cần chuyển khoản.
   - Xuất hóa đơn quyết toán A4, bảng tính Excel (.xlsx) và file CSV.

3. **Quét Hóa Đơn Bằng AI (Receipt OCR):**
   - Chụp ảnh hóa đơn từ máy ảnh hoặc tải lên biên lai thanh toán.
   - Tự động nén ảnh tại client (< 100KB) chống tràn bộ nhớ Firestore và tránh lỗi 413 Payload Too Large.
   - Trích xuất tự động: Tên cửa hàng, tổng tiền, ngày giờ và danh sách món.

4. **Két Giấy Tờ & Vé An Toàn (Travel Vault):**
   - Lưu trữ vé máy bay, voucher phòng khách sạn, vé xe và số hộ chiếu.
   - Khóa bảo vệ bằng mã PIN 4 số mã hóa SHA-256 (không lưu plaintext).
   - Cơ chế chống tấn công Brute-force: Tạm khóa 30 giây sau 5 lần nhập sai liên tiếp.

5. **Lời Mời Nhóm Thời Gian Thực:**
   - Trưởng đoàn thêm thành viên bằng Email hoặc Số điện thoại.
   - Hệ thống gửi thông báo lời mời tức thì tới ứng dụng của thành viên.
   - Đồng bộ trạng thái chấp thuận hai chiều qua Google Cloud Firestore.

6. **Thời Tiết Thời Gian Thực & Bản Đồ Số:**
   - Dự báo nhiệt độ, độ ẩm và khả năng mưa trực tiếp qua API Open-Meteo & AccuWeather.
   - Bản đồ Leaflet tương tác hiển thị lộ trình, địa điểm đã lưu và liên kết chỉ đường Google Maps.

---

## 🛠️ Ngăn Xếp Công Nghệ (Tech Stack)

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Icons & Typography:** Lucide React, Google Fonts `Be Vietnam Pro`
- **Backend Proxy & API:** Express.js, `@google/genai` (SDK chính thức của Google)
- **Cơ sở dữ liệu & Xác thực:** Firebase Firestore, Firebase Authentication
- **Bản đồ:** Leaflet, OpenStreetMap

---

## 🔒 Kiểm Soát An Ninh & Độ Tin Cậy

- **Firestore Rules:** Ràng buộc schema chặt chẽ, kiểm tra độ dài chuỗi, bảo vệ tính bất biến của `creatorId` và cô lập quyền cập nhật lời mời chỉ trong trường `status` và `respondedAt`.
- **Chống XSS:** Escape các ký tự đặc biệt HTML trong các mẫu in cẩm nang và hóa đơn quyết toán.
- **Bảo vệ API Gemini:** Middleware giới hạn tốc độ (Rate Limiting) theo IP và bộ lọc kiểm duyệt chuỗi đầu vào (Input Sanitization).
- **Múi giờ:** Chuẩn hóa theo giờ người dùng địa phương thông qua `getLocalDateString()` tránh lỗi sai lệch ngày giờ UTC.

---

## 🚀 Hướng Dẫn Phát Triển

```bash
# Cài đặt gói phụ thuộc
npm install

# Chạy môi trường phát triển (Dev Server)
npm run dev

# Kiểm tra mã nguồn và biên dịch ứng dụng
npm run build
```