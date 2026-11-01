import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon, Camera } from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onUpdateTrip: (updatedFields: Partial<Trip>) => void;
}

const COVER_PRESETS = [
  { key: 'preset.dalat', defaultLabel: 'Việt Nam / Đà Lạt', url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.vungtau', defaultLabel: 'Việt Nam / Vũng Tàu', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.phuquoc', defaultLabel: 'Việt Nam / Phú Quốc', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.japan', defaultLabel: 'Nhật Bản / Tokyo', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.amalfi', defaultLabel: 'Ý / Amalfi', url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.paris', defaultLabel: 'Pháp / Paris', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80' },
];

export const EditTripModal: React.FC<EditTripModalProps> = ({
  isOpen,
  onClose,
  trip,
  onUpdateTrip,
}) => {
  const { lang, t } = useLanguage();
  const isVi = lang === 'vi';

  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  const [country, setCountry] = useState(trip.country || '');
  const [startDate, setStartDate] = useState(trip.startDate || '');
  const [endDate, setEndDate] = useState(trip.endDate || '');
  const [budgetTotal, setBudgetTotal] = useState(String(trip.budgetTotal || 500));
  const [currency, setCurrency] = useState(trip.currency || 'USD');
  const [coverImage, setCoverImage] = useState(trip.coverImage || COVER_PRESETS[0].url);

  if (!isOpen) return null;

  // Handle local image file upload from mobile or desktop
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(isVi ? 'Kích thước ảnh tối đa là 5MB.' : 'Image size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCoverImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const calcDaysCount = (sDate: string, eDate: string) => {
    if (!sDate || !eDate) return 1;
    const s = new Date(sDate);
    const e = new Date(eDate);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim()) return;

    const oldDaysCount = trip.days?.length || calcDaysCount(trip.startDate, trip.endDate);
    const newDaysCount = calcDaysCount(startDate || trip.startDate, endDate || trip.endDate);

    let rearrangeAllDays = false;
    if (newDaysCount > oldDaysCount) {
      const userWantsRearrange = window.confirm(
        isVi
          ? `Số ngày chuyến đi tăng từ ${oldDaysCount} lên ${newDaysCount} ngày.\nBạn có muốn thay đổi và sắp xếp lại tất cả lịch trình cho các ngày không?\n\n- Nhấn "OK" (Có) để sắp xếp lại toàn bộ lịch trình tất cả các ngày.\n- Nhấn "Hủy" (Không) để giữ nguyên lịch trình các ngày cũ và thêm sắp xếp lịch trình các ngày mới thêm.`
          : `Trip duration increased from ${oldDaysCount} to ${newDaysCount} days.\nDo you want to rearrange the entire itinerary across all days?\n\n- Click OK to rearrange all days.\n- Click Cancel to keep existing days and add new days.`
      );
      rearrangeAllDays = userWantsRearrange;
    }

    onUpdateTrip({
      title: title.trim(),
      destination: destination.trim(),
      country: country.trim() || destination.trim(),
      startDate: startDate || trip.startDate,
      endDate: endDate || trip.endDate,
      budgetTotal: budgetTotal ? parseFloat(budgetTotal) : trip.budgetTotal,
      currency,
      coverImage: coverImage || trip.coverImage,
      rearrangeAllDays,
    } as any);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <h3 className="font-display font-bold text-sm sm:text-base">
            {isVi ? 'Sửa Chuyến Đi' : 'Edit Trip'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-3.5">
          
          {/* Trip Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isVi ? 'Tên Chuyến Đi *' : 'Trip Title *'}
            </label>
            <input
              type="text"
              required
              placeholder={isVi ? 'Ví dụ: Nghỉ dưỡng Đà Lạt 12/2026' : 'e.g., Summer in Tokyo 2026'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Destination */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isVi ? 'Thành phố *' : 'City *'}
              </label>
              <input
                type="text"
                required
                placeholder={isVi ? 'Ví dụ: Đà Lạt, Vũng Tàu...' : 'e.g., Da Lat, Paris...'}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isVi ? 'Quốc gia' : 'Country'}
              </label>
              <input
                type="text"
                placeholder={isVi ? 'Ví dụ: Việt Nam, Nhật Bản...' : 'e.g., Vietnam, Japan...'}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isVi ? 'Ngày Bắt đầu' : 'Start Date'}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isVi ? 'Ngày Kết thúc' : 'End Date'}
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            {/* Budget */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isVi ? 'Ngân sách' : 'Budget'}
              </label>
              <input
                type="number"
                placeholder={isVi ? 'Ví dụ: 500' : 'e.g. 500'}
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isVi ? 'Tiền tệ' : 'Currency'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all cursor-pointer"
              >
                <option value="USD">USD ($)</option>
                <option value="VND">VND (₫)</option>
                <option value="EUR">EUR (€)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          {/* Cover Image Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                {isVi ? 'Ảnh' : 'Photo'}
              </label>
              <label
                htmlFor="edit-trip-cover-upload"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span>{isVi ? 'Tải ảnh' : 'Upload photo'}</span>
              </label>
              <input
                id="edit-trip-cover-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Current Cover Preview */}
            {coverImage && (
              <div className="relative rounded-2xl overflow-hidden h-32 sm:h-40 border border-slate-200 group">
                <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <label
                    htmlFor="edit-trip-cover-upload"
                    className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-xl text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Đổi ảnh' : 'Change photo'}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
            >
              {isVi ? 'Lưu' : 'Save'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
