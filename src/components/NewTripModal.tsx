import React, { useState } from 'react';
import { X, Upload, Camera, Sparkles, Loader2, Compass, Calendar, MapPin, ArrowLeft, AlertCircle } from 'lucide-react';
import { Trip, DayPlan, ActivityItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getLocalDateString } from '../utils/dateUtils';
import { compressImage } from '../utils/imageUtils';
import { buildDefaultAvatar } from '../utils/avatarSyncUtils';

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTrip: (newTrip: Trip, openAiArchitect?: boolean) => void;
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
  const { userProfile } = useAuth();
  const isVi = lang === 'vi';

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetTotal, setBudgetTotal] = useState('500');
  const [currency, setCurrency] = useState('USD');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0].url);
  const [uploadError, setUploadError] = useState('');

  // Prompt step state: asking user whether they want a suggested itinerary
  const [isPromptingItinerary, setIsPromptingItinerary] = useState(false);

  // Helper to reset all form inputs to pristine state
  const resetForm = () => {
    setTitle('');
    setDestination('');
    setCountry('');
    setStartDate('');
    setEndDate('');
    setBudgetTotal('500');
    setCurrency('USD');
    setCoverImage(COVER_PRESETS[0].url);
    setUploadError('');
    setIsPromptingItinerary(false);
  };

  // Reset form whenever modal opens or closes
  React.useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Calculate day count between start and end date
  const getDaysCount = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 3;
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = e.getTime() - s.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const effectiveStartDate = startDate || getLocalDateString();
  const effectiveEndDate = endDate || getLocalDateString(Date.now() + 86400000 * 2);
  const calculatedDaysCount = getDaysCount(effectiveStartDate, effectiveEndDate);

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

  // Generate completely empty days without any prefilled activities
  const generateEmptyDays = (startStr: string, endStr: string): DayPlan[] => {
    const daysCount = getDaysCount(startStr, endStr);
    const s = new Date(startStr);

    return Array.from({ length: daysCount }, (_, idx) => {
      const dayNum = idx + 1;
      const dateObj = new Date(s);
      dateObj.setDate(s.getDate() + idx);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      const formattedDate = `${dd}/${mm}/${yyyy}`;

      return {
        dayNumber: dayNum,
        date: isVi ? `Ngày ${dayNum} - ${formattedDate}` : `Day ${dayNum} - ${formattedDate}`,
        title: isVi ? `Ngày ${dayNum}` : `Day ${dayNum}`,
        summary: '',
        activities: [],
      };
    });
  };

  // Step 1: Form submit -> Do not create yet, ask user if they want a suggested itinerary
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim()) return;
    setIsPromptingItinerary(true);
  };

  // Step 2: User responds to the itinerary prompt
  const handleConfirmCreate = (wantSuggestedItinerary: boolean) => {
    const finalDays = generateEmptyDays(effectiveStartDate, effectiveEndDate);

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      title: title.trim(),
      destination: destination.trim(),
      country: country.trim() || destination.trim(),
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      coverImage: coverImage || COVER_PRESETS[0].url,
      budgetTotal: (() => {
        if (!budgetTotal) return 500;
        const parsed = parseFloat(budgetTotal);
        if (isNaN(parsed) || parsed < 0) return 500;
        return Math.min(parsed, 100000000000);
      })(),
      currency,
      ...(userProfile?.id ? { creatorId: userProfile.id } : {}),
      ...(userProfile?.displayName ? { creatorName: userProfile.displayName } : {}),
      members: wantSuggestedItinerary
        ? [
            {
              id: 'm1',
              ...(userProfile?.id ? { uid: userProfile.id } : {}),
              name: userProfile?.displayName || (isVi ? 'Bạn (Trưởng nhóm)' : 'Alex Rivera (You)'),
              ...(userProfile?.email ? { email: userProfile.email } : {}),
              ...(userProfile?.phone ? { phone: userProfile.phone } : {}),
              avatar: userProfile?.avatar || buildDefaultAvatar(userProfile?.displayName || 'TripMate'),
              ...(userProfile?.id ? { isRegistered: true } : {}),
            },
          ]
        : [],
      ...(wantSuggestedItinerary ? { fundHolderId: 'm1' } : {}),
      days: finalDays,
      expenses: [],
      packingList: [],
      documents: [],
    };

    // If user clicks "Đồng ý", pass openAiArchitect: true so the AI Itinerary Architect modal opens
    onCreateTrip(newTrip, wantSuggestedItinerary);
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <h3 className="font-display font-bold text-sm sm:text-base">
            {isPromptingItinerary
              ? (isVi ? 'Gợi ý lịch trình' : 'Suggested Itinerary')
              : t('newTrip.modalTitle')}
          </h3>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        {isPromptingItinerary ? (
          /* Step 2: Prompt asking whether user wants a suggested itinerary */
          <div className="p-5 sm:p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-600 flex items-center justify-center mx-auto shadow-2xs">
              <Sparkles className="w-6 h-6 text-teal-600" />
            </div>

            <div className="space-y-1">
              <h4 className="font-display font-bold text-slate-900 text-base">
                {isVi ? 'Tạo lịch trình gợi ý?' : 'Generate suggested itinerary?'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isVi
                  ? `Bạn có muốn mở Lịch trình AI để tạo lịch trình cho ${destination} (${calculatedDaysCount} ngày) không?`
                  : `Open AI Itinerary to create a custom plan for ${destination} (${calculatedDaysCount} days)?`}
              </p>
            </div>

            {/* Compact 2-button choice */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmCreate(false)}
                className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer min-h-[38px]"
              >
                {isVi ? 'Không' : 'No'}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmCreate(true)}
                className="flex-1 py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>{isVi ? 'Đồng ý' : 'Yes'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Standard Trip Details Form */
          <form onSubmit={handleFormSubmit} className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-3.5">
            {uploadError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

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
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    if (endDate && newStart && endDate < newStart) {
                      setEndDate(newStart);
                    }
                  }}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldEnd')}</label>
                <input
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    if (startDate && newEnd && newEnd < startDate) {
                      setEndDate(startDate);
                    } else {
                      setEndDate(newEnd);
                    }
                  }}
                  className="w-full text-xs p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newTrip.fieldBudget')}</label>
                <input
                  type="number"
                  min="0"
                  max="100000000000"
                  step="any"
                  placeholder={t('newTrip.budgetPlaceholder')}
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
                <label className="block text-xs font-semibold text-slate-700">{isVi ? 'Ảnh bìa chuyến đi' : 'Cover Photo'}</label>
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

            {/* Action Buttons: Next to prompt */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{isVi ? 'Tạo chuyến đi' : 'Create Trip'}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
