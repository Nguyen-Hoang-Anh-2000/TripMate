import React, { useState } from 'react';
import { X } from 'lucide-react';
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
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetTotal, setBudgetTotal] = useState('500');
  const [currency, setCurrency] = useState('USD');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0].url);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim()) return;

    const isVi = lang === 'vi';
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-base">{t('newTrip.modalTitle')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{lang === 'vi' ? 'Điền thông tin để bắt đầu lên kế hoạch' : 'Fill details to start planning your trip'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldTitle')}</label>
            <input
              type="text"
              required
              placeholder={t('newTrip.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldDest')}</label>
              <input
                type="text"
                required
                placeholder={t('newTrip.destPlaceholder')}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldCountry')}</label>
              <input
                type="text"
                placeholder={t('newTrip.countryPlaceholder')}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldStart')}</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldEnd')}</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldBudget')}</label>
              <input
                type="number"
                placeholder={t('newTrip.budgetPlaceholder')}
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldCurrency')}</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('newTrip.fieldCover')}</label>
            <div className="grid grid-cols-3 gap-2">
              {COVER_PRESETS.map((preset, idx) => {
                const label = t(preset.key) || preset.defaultLabel;
                return (
                  <div
                    key={idx}
                    onClick={() => setCoverImage(preset.url)}
                    className={`relative rounded-xl overflow-hidden h-16 cursor-pointer border-2 transition-all group ${
                      coverImage === preset.url ? 'border-teal-500 ring-2 ring-teal-500/30 shadow-xs' : 'border-slate-200 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={preset.url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-xs">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {t('newTrip.cancelBtn')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
            >
              {t('newTrip.createBtn')}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

