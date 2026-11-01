import React, { useState } from 'react';
import { X, Upload, Camera } from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTrip: (newTrip: Trip) => void;
}

const COVER_PRESETS = [
  { key: 'preset.dalat', defaultLabel: 'Việt Nam / Đà Lạt', url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.vungtau', defaultLabel: 'Việt Nam / Vũng Tàu', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.phuquoc', defaultLabel: 'Việt Nam / Phú Quốc', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.japan', defaultLabel: 'Nhật Bản / Tokyo', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.amalfi', defaultLabel: 'Ý / Amalfi', url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80' },
  { key: 'preset.paris', defaultLabel: 'Pháp / Paris', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80' },
];

export const NewTripModal: React.FC<NewTripModalProps> = ({
  isOpen,
  onClose,
  onCreateTrip,
}) => {
  const { lang, t } = useLanguage();
  const isVi = lang === 'vi';

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetTotal, setBudgetTotal] = useState('500');
  const [currency, setCurrency] = useState('USD');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0].url);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim()) return;

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      title: title.trim(),
      destination: destination.trim(),
      country: country.trim() || destination.trim(),
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      coverImage: coverImage || COVER_PRESETS[0].url,
      budgetTotal: budgetTotal ? parseFloat(budgetTotal) : 500,
      currency,
      members: [
        {
          id: 'm1',
          name: isVi ? 'Bạn (Trưởng nhóm)' : 'Alex Rivera (You)',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
      ],
      days: [
        {
          dayNumber: 1,
          date: isVi ? 'Ngày 1 - Đến nơi & Bắt đầu chuyến đi' : 'Day 1 - Arrival & Orientation',
          title: isVi ? 'Nhận phòng & Khám phá địa phương' : 'Arrival & Hotel Check-in',
          summary: isVi
            ? `Khởi hành đến ${destination}, nhận phòng khách sạn, nghỉ ngơi và thưởng thức bữa tối đặc sản.`
            : `Arrive at ${destination}, hotel check-in, and explore local neighborhood.`,
          activities: [
            {
              id: `act-${Date.now()}-1`,
              time: '02:00 PM',
              title: isVi ? 'Nhận phòng khách sạn & Cất hành lý' : 'Hotel Check-in',
              locationName: `${destination}`,
              category: 'stay',
              estimatedCost: 50,
              notes: isVi ? 'Nhận phòng, cất hành lý và rửa mặt thư giãn.' : 'Check-in and refresh.',
              isCompleted: false,
            },
            {
              id: `act-${Date.now()}-2`,
              time: '06:30 PM',
              title: isVi ? 'Thưởng thức ẩm thực địa phương & Dạo phố' : 'Welcome Dinner & Walk',
              locationName: `${destination}`,
              category: 'food',
              estimatedCost: 20,
              notes: isVi ? 'Dạo bộ buổi tối và thưởng thức món ăn đặc sản địa phương.' : 'Try local specialties!',
              isCompleted: false,
            },
          ],
        },
      ],
      expenses: [],
      packingList: [
        { id: `p-${Date.now()}-1`, category: 'Essentials', name: isVi ? 'Căn cước công dân / Hộ chiếu' : 'Passport & Identification', quantity: 1, isPacked: true },
        { id: `p-${Date.now()}-2`, category: 'Electronics', name: isVi ? 'Sạc dự phòng & Dây sạc điện thoại' : 'Phone Charger & Adapter', quantity: 1, isPacked: false },
        { id: `p-${Date.now()}-3`, category: 'Clothing', name: isVi ? 'Quần áo & Đồ dùng vệ sinh cá nhân' : 'Clothing & Toiletries', quantity: 2, isPacked: false },
      ],
      documents: [],
    };

    onCreateTrip(newTrip);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <h3 className="font-display font-bold text-sm sm:text-base">{t('newTrip.modalTitle')}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldTitle')} *</label>
            <input
              type="text"
              required
              placeholder={t('newTrip.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldDest')} *</label>
              <input
                type="text"
                required
                placeholder={t('newTrip.destPlaceholder')}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldCountry')}</label>
              <input
                type="text"
                placeholder={t('newTrip.countryPlaceholder')}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldStart')}</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldEnd')}</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldBudget')}</label>
              <input
                type="number"
                placeholder={t('newTrip.budgetPlaceholder')}
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(e.target.value)}
                className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldCurrency')}</label>
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

          {/* Photo Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">{isVi ? 'Ảnh' : 'Photo'}</label>
              <label
                htmlFor="new-trip-cover-upload"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span>{isVi ? 'Tải ảnh' : 'Upload photo'}</span>
              </label>
              <input
                id="new-trip-cover-upload"
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
                    htmlFor="new-trip-cover-upload"
                    className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-xl text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Đổi ảnh' : 'Change photo'}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons: Strictly "Lưu" and "Hủy" */}
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
