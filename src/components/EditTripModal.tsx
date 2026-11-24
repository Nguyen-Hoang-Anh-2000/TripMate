import React, { useState, useEffect } from 'react';
import { X, Upload, Camera, AlertCircle } from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { compressImage } from '../utils/imageUtils';

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onUpdateTrip: (tripId: string, updatedFields: Partial<Trip> & { rearrangeAllDays?: boolean }) => void;
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
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const [title, setTitle] = useState(trip?.title || '');
  const [destination, setDestination] = useState(trip?.destination || '');
  const [country, setCountry] = useState(trip?.country || '');
  const [startDate, setStartDate] = useState(trip?.startDate || '');
  const [endDate, setEndDate] = useState(trip?.endDate || '');
  const [budgetTotal, setBudgetTotal] = useState(String(trip?.budgetTotal || 500));
  const [currency, setCurrency] = useState(trip?.currency || 'VND');
  const [coverImage, setCoverImage] = useState(trip?.coverImage || COVER_PRESETS[0].url);
  const [rearrangeAllDays, setRearrangeAllDays] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Always reset fields when trip or modal open state changes
  useEffect(() => {
    if (trip && isOpen) {
      setTitle(trip.title || '');
      setDestination(trip.destination || '');
      setCountry(trip.country || '');
      setStartDate(trip.startDate || '');
      setEndDate(trip.endDate || '');
      setBudgetTotal(String(trip.budgetTotal !== undefined ? trip.budgetTotal : 500));
      setCurrency(trip.currency || 'VND');
      setCoverImage(trip.coverImage || COVER_PRESETS[0].url);
      setRearrangeAllDays(false);
      setUploadError('');
      setFormError(null);
    }
  }, [trip, isOpen]);

  if (!isOpen || !trip) return null;

  // Handle local image file upload from mobile or desktop
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(isVi ? 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).' : 'Please select an image file.');
      return;
    }
    setUploadError('');

    try {
      const compressedDataUrl = await compressImage(file, 1400, 0.75);
      setCoverImage(compressedDataUrl);
    } catch (err) {
      console.warn('Cover compression error, falling back:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setCoverImage(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const calcDaysCount = (sDate: string, eDate: string) => {
    if (!sDate || !eDate) return 1;
    const s = new Date(sDate);
    const e = new Date(eDate);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const oldDaysCount = trip.days?.length || calcDaysCount(trip.startDate, trip.endDate);
  const newDaysCount = calcDaysCount(startDate || trip.startDate, endDate || trip.endDate);
  const isDurationIncreased = newDaysCount > oldDaysCount;
  const isDurationShortened = newDaysCount < oldDaysCount;
  const truncatedDays = (trip.days || []).filter((d) => d.dayNumber > newDaysCount);
  const affectedActivitiesCount = truncatedDays.reduce((acc, d) => acc + (d.activities?.length || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError(isVi ? 'Vui lòng nhập tên chuyến đi.' : 'Please enter a trip title.');
      return;
    }
    if (!destination.trim()) {
      setFormError(isVi ? 'Vui lòng nhập thành phố / điểm đến.' : 'Please enter a city / destination.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setFormError(isVi ? 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' : 'End date must be on or after start date.');
      return;
    }

    const safeBudget = (() => {
      if (!budgetTotal) return trip.budgetTotal;
      const num = parseFloat(budgetTotal);
      if (isNaN(num) || num < 0) return trip.budgetTotal;
      return Math.min(num, 100000000000);
    })();

    onUpdateTrip(trip.id, {
      title: title.trim(),
      destination: destination.trim(),
      country: country.trim() || destination.trim(),
      startDate: startDate || trip.startDate,
      endDate: endDate || trip.endDate,
      budgetTotal: safeBudget,
      currency,
      coverImage: coverImage || trip.coverImage,
      rearrangeAllDays: isDurationIncreased ? rearrangeAllDays : false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base">
              {isVi ? 'Sửa chuyến đi' : 'Edit Trip'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {trip.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form noValidate onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-3.5">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          
          {/* Trip Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isVi ? 'Tên chuyến đi *' : 'Trip Title *'}
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
                {isVi ? 'Ngày bắt đầu' : 'Start Date'}
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
                {isVi ? 'Ngày kết thúc' : 'End Date'}
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
                min="0"
                max="100000000000"
                step="any"
                placeholder={isVi ? 'Ví dụ: 500' : 'e.g. 500'}
                value={budgetTotal}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setBudgetTotal('');
                    return;
                  }
                  const num = parseFloat(val);
                  if (!isNaN(num) && num >= 0 && num <= 100000000000) {
                    setBudgetTotal(val);
                  }
                }}
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
                <option value="VND">VND (₫)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          {/* If duration shortened and has activities: show clear warning */}
          {isDurationShortened && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-rose-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {isVi
                    ? `Cảnh báo: Rút ngắn chuyến đi từ ${oldDaysCount} ngày còn ${newDaysCount} ngày`
                    : `Warning: Trip shortened from ${oldDaysCount} to ${newDaysCount} days`}
                </span>
              </p>
              <p className="text-[11px] text-rose-700 leading-relaxed pl-5">
                {affectedActivitiesCount > 0
                  ? (isVi
                      ? `Có ${affectedActivitiesCount} hoạt động ở các ngày vượt quá sẽ được tự động chuyển về ngày cuối cùng (Ngày ${newDaysCount}) để đảm bảo bạn không bị mất lịch trình hay chi phí đã lên.`
                      : `${affectedActivitiesCount} activities from truncated days will be automatically consolidated into the last day (Day ${newDaysCount}) so no plans or expenses are lost.`)
                  : (isVi
                      ? 'Lịch trình chuyến đi sẽ được điều chỉnh về số ngày mới.'
                      : 'Trip schedule will be adjusted to the new duration.')}
              </p>
            </div>
          )}

          {/* If duration increased: interactive in-modal option instead of browser confirm */}
          {isDurationIncreased && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isVi
                    ? `Thời gian chuyến đi tăng từ ${oldDaysCount} ngày lên ${newDaysCount} ngày`
                    : `Duration increased from ${oldDaysCount} to ${newDaysCount} days`}
                </span>
              </p>
              <div className="space-y-1.5 pl-5">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="rearrangeSchedule"
                    checked={!rearrangeAllDays}
                    onChange={() => setRearrangeAllDays(false)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    {isVi
                      ? 'Giữ nguyên lịch trình các ngày cũ và thêm ngày mới (Khuyên dùng)'
                      : 'Keep existing days unchanged and add new days (Recommended)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="rearrangeSchedule"
                    checked={rearrangeAllDays}
                    onChange={() => setRearrangeAllDays(true)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    {isVi
                      ? 'Tự động phân bổ lại toàn bộ hoạt động cho tất cả các ngày'
                      : 'Redistribute all activities across all days'}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Cover Image Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                {isVi ? 'Ảnh bìa' : 'Cover Photo'}
              </label>
              <label
                htmlFor="edit-trip-cover-upload"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span>{isVi ? 'Tải ảnh từ máy' : 'Upload photo'}</span>
              </label>
              <input
                id="edit-trip-cover-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {uploadError && (
              <p className="text-xs text-red-600 font-semibold">{uploadError}</p>
            )}

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
                    <span>{isVi ? 'Đổi ảnh khác' : 'Change photo'}</span>
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
