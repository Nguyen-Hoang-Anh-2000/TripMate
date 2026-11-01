import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SavedPlace, CategoryType, Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  MapPin, Plus, Search, Edit3, Trash2, CalendarPlus, ExternalLink,
  Star, Tag, Building2, Coffee, Camera, Utensils, Hotel, Car, ShoppingBag,
  Sparkles, Filter, X, Check, ChevronDown, Clock
} from 'lucide-react';
import { formatMoney } from '../utils/formatCurrency';

interface SavedPlacesViewProps {
  savedPlaces: SavedPlace[];
  activeTrip: Trip;
  trips: Trip[];
  onAddPlace: (place: Omit<SavedPlace, 'id' | 'createdAt'>) => void;
  onEditPlace: (id: string, place: Partial<SavedPlace>) => void;
  onDeletePlace: (id: string) => void;
  onScheduleToTrip: (tripId: string, dayNumber: number, place: SavedPlace, time: string) => void;
}

export const SavedPlacesView: React.FC<SavedPlacesViewProps> = ({
  savedPlaces,
  activeTrip,
  trips,
  onAddPlace,
  onEditPlace,
  onDeletePlace,
  onScheduleToTrip,
}) => {
  const { lang, t } = useLanguage();
  const isVi = lang === 'vi';

  // Filters
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<number | 'all'>('all');

  // City Searchable Droplist state
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [citySearchInput, setCitySearchInput] = useState('');
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Close city dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [schedulingPlace, setSchedulingPlace] = useState<SavedPlace | null>(null);

  // Form state for Add/Edit
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formNewCity, setFormNewCity] = useState('');
  const [formCategory, setFormCategory] = useState<CategoryType>('sightseeing');
  const [formAddress, setFormAddress] = useState('');
  const [formCost, setFormCost] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState('VND');
  const [formRating, setFormRating] = useState<number>(5);
  const [formOpenTime, setFormOpenTime] = useState<string>('08:00');
  const [formCloseTime, setFormCloseTime] = useState<string>('22:00');
  const [formNotes, setFormNotes] = useState('');
  const [formSource, setFormSource] = useState('');

  // Form state for Scheduling to trip
  const [scheduleTripId, setScheduleTripId] = useState(activeTrip.id);
  const [scheduleDayNumber, setScheduleDayNumber] = useState(1);
  const [scheduleTime, setScheduleTime] = useState('09:00 AM');
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState('');

  // Extract unique cities list
  const cityList = useMemo(() => {
    const set = new Set<string>();
    savedPlaces.forEach((p) => {
      if (p.cityName) set.add(p.cityName);
    });
    // Add active trip destination if not present
    if (activeTrip.destination) {
      set.add(activeTrip.destination);
    }
    return Array.from(set);
  }, [savedPlaces, activeTrip.destination]);

  // Filtered cities list for search-like droplist
  const filteredCitiesForDropdown = useMemo(() => {
    const q = citySearchInput.trim().toLowerCase();
    if (!q) return cityList;
    return cityList.filter((c) => c.toLowerCase().includes(q));
  }, [citySearchInput, cityList]);

  // Filtered places
  const filteredPlaces = useMemo(() => {
    return savedPlaces.filter((p) => {
      const matchCity = selectedCity === 'all' || p.cityName.toLowerCase() === selectedCity.toLowerCase();
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchRating = selectedRating === 'all' || (p.rating || 5) === selectedRating;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.cityName && p.cityName.toLowerCase().includes(q));
      return matchCity && matchCat && matchRating && matchSearch;
    });
  }, [savedPlaces, selectedCity, selectedCategory, selectedRating, searchQuery]);

  const categories: { label: string; value: CategoryType | 'all' }[] = [
    { label: t('cat.all'), value: 'all' },
    { label: t('cat.sightseeing'), value: 'sightseeing' },
    { label: t('cat.food'), value: 'food' },
    { label: t('cat.stay'), value: 'stay' },
    { label: t('cat.activity'), value: 'activity' },
    { label: t('cat.shopping'), value: 'shopping' },
    { label: t('cat.transport'), value: 'transport' },
  ];

  const getCategoryIcon = (cat: CategoryType) => {
    switch (cat) {
      case 'food': return <Utensils className="w-3.5 h-3.5" />;
      case 'sightseeing': return <Camera className="w-3.5 h-3.5" />;
      case 'stay': return <Hotel className="w-3.5 h-3.5" />;
      case 'transport': return <Car className="w-3.5 h-3.5" />;
      case 'shopping': return <ShoppingBag className="w-3.5 h-3.5" />;
      default: return <Tag className="w-3.5 h-3.5" />;
    }
  };

  // Open add modal
  const handleOpenAdd = () => {
    setEditingPlace(null);
    setFormName('');
    setFormCity(selectedCity !== 'all' ? selectedCity : (activeTrip.destination || 'Đà Lạt'));
    setFormNewCity('');
    setFormCategory('sightseeing');
    setFormAddress('');
    setFormCost('');
    setFormCurrency('VND');
    setFormRating(5);
    setFormOpenTime('08:00');
    setFormCloseTime('22:00');
    setFormNotes('');
    setFormSource(isVi ? 'Bạn bè mách' : 'Friend recommendation');
    setIsAddModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (place: SavedPlace) => {
    setEditingPlace(place);
    setFormName(place.name);
    setFormCity(place.cityName);
    setFormNewCity('');
    setFormCategory(place.category);
    setFormAddress(place.address || '');
    setFormCost(place.estimatedCost !== undefined ? String(place.estimatedCost) : '');
    setFormCurrency(place.currency || 'VND');
    setFormRating(place.rating !== undefined ? place.rating : 5);
    setFormOpenTime(place.openTime || '08:00');
    setFormCloseTime(place.closeTime || '22:00');
    setFormNotes(place.notes || '');
    setFormSource(place.source || '');
    setIsAddModalOpen(true);
  };

  // Save place (Create or Update)
  const handleSavePlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const finalCity = formNewCity.trim() ? formNewCity.trim() : formCity.trim();

    if (editingPlace) {
      onEditPlace(editingPlace.id, {
        name: formName.trim(),
        cityName: finalCity,
        category: formCategory,
        address: formAddress.trim() || undefined,
        estimatedCost: formCost ? parseFloat(formCost) : undefined,
        currency: formCurrency,
        rating: formRating,
        openTime: formOpenTime || undefined,
        closeTime: formCloseTime || undefined,
        notes: formNotes.trim() || undefined,
        source: formSource.trim() || undefined,
      });
    } else {
      onAddPlace({
        name: formName.trim(),
        cityName: finalCity,
        category: formCategory,
        address: formAddress.trim() || undefined,
        estimatedCost: formCost ? parseFloat(formCost) : undefined,
        currency: formCurrency,
        rating: formRating,
        openTime: formOpenTime || undefined,
        closeTime: formCloseTime || undefined,
        notes: formNotes.trim() || undefined,
        source: formSource.trim() || undefined,
      });
    }

    setIsAddModalOpen(false);
  };

  // Open schedule modal
  const handleOpenSchedule = (place: SavedPlace) => {
    setSchedulingPlace(place);
    setScheduleTripId(activeTrip.id);
    setScheduleDayNumber(1);
    setScheduleTime('09:00 AM');
    setScheduleSuccessMsg('');
  };

  // Confirm schedule to trip
  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingPlace) return;

    onScheduleToTrip(scheduleTripId, scheduleDayNumber, schedulingPlace, scheduleTime);
    setScheduleSuccessMsg(
      isVi
        ? `Đã thêm "${schedulingPlace.name}" vào Ngày ${scheduleDayNumber}!`
        : `Added "${schedulingPlace.name}" to Day ${scheduleDayNumber}!`
    );
    setTimeout(() => {
      setSchedulingPlace(null);
      setScheduleSuccessMsg('');
    }, 1200);
  };

  const targetTripObj = trips.find((t) => t.id === scheduleTripId) || activeTrip;

  return (
    <div className="space-y-4">
      {/* Top Header & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            {filteredPlaces.length} {isVi ? 'địa điểm' : 'places'}
          </span>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isVi ? 'Thêm địa điểm' : 'Add Place'}</span>
          </button>
        </div>

        {/* Search, City Droplist & Category Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
            
            {/* 1. City Searchable Droplist (Search-Like) */}
            <div className="sm:col-span-3 relative" ref={cityDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                className={`w-full flex items-center justify-between text-xs font-semibold py-2 px-2.5 rounded-xl border transition-colors shadow-2xs cursor-pointer truncate ${
                  selectedCity !== 'all'
                    ? 'border-teal-500 bg-teal-50/70 text-teal-900 font-bold'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="truncate">
                    {selectedCity === 'all'
                      ? (isVi ? `Tất cả thành phố (${savedPlaces.length})` : `All Cities (${savedPlaces.length})`)
                      : `${selectedCity} (${savedPlaces.filter((p) => p.cityName.toLowerCase() === selectedCity.toLowerCase()).length})`}
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {selectedCity !== 'all' && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCity('all');
                        setCitySearchInput('');
                      }}
                      className="p-0.5 hover:bg-teal-200/60 rounded text-teal-700"
                      title={isVi ? 'Hiện tất cả thành phố' : 'Show all cities'}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* City Search Droplist Popover Menu */}
              {isCityDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  {/* Search input inside city droplist */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={citySearchInput}
                      onChange={(e) => setCitySearchInput(e.target.value)}
                      placeholder={isVi ? 'Tìm thành phố (Đà Lạt, Tokyo...)...' : 'Search city (Da Lat, Tokyo...)...'}
                      className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                    />
                    {citySearchInput && (
                      <button
                        type="button"
                        onClick={() => setCitySearchInput('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Cities list */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCity('all');
                        setIsCityDropdownOpen(false);
                        setCitySearchInput('');
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        selectedCity === 'all'
                          ? 'bg-teal-50 text-teal-800 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{isVi ? `📍 Tất cả thành phố (${savedPlaces.length})` : `📍 All Cities (${savedPlaces.length})`}</span>
                      {selectedCity === 'all' && <span className="text-teal-600 text-xs">✓</span>}
                    </button>

                    {filteredCitiesForDropdown.map((city) => {
                      const count = savedPlaces.filter((p) => p.cityName.toLowerCase() === city.toLowerCase()).length;
                      const isSelected = selectedCity.toLowerCase() === city.toLowerCase();
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setSelectedCity(city);
                            setIsCityDropdownOpen(false);
                            setCitySearchInput('');
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 text-teal-800 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{city}</span>
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 ml-1 shrink-0">
                            {count} {isVi ? 'địa điểm' : 'places'}
                          </span>
                        </button>
                      );
                    })}

                    {filteredCitiesForDropdown.length === 0 && (
                      <div className="text-center py-3 text-xs text-slate-400 italic">
                        {isVi ? 'Không tìm thấy thành phố' : 'No matching cities'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Text Search Input */}
            <div className="sm:col-span-4 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isVi ? 'Tìm theo tên quán, địa chỉ, ai mách...' : 'Search place name, address, notes...'}
                className="w-full text-xs pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 3. Category Select */}
            <div className="sm:col-span-3 relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs font-semibold py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Rating Filter */}
            <div className="sm:col-span-2 relative">
              <select
                value={String(selectedRating)}
                onChange={(e) => setSelectedRating(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                className={`w-full text-xs font-semibold py-2 px-2.5 rounded-xl border cursor-pointer transition-colors ${
                  selectedRating !== 'all'
                    ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                    : 'border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500'
                }`}
              >
                <option value="all">{isVi ? '⭐ Tất cả sao' : '⭐ All stars'}</option>
                <option value="5">⭐⭐⭐⭐⭐ 5 sao</option>
                <option value="4">⭐⭐⭐⭐ 4 sao</option>
                <option value="3">⭐⭐⭐ 3 sao</option>
                <option value="2">⭐⭐ 2 sao</option>
                <option value="1">⭐ 1 sao</option>
              </select>
            </div>

          </div>
        </div>

      {/* Places Grid (Đã lưu) */}
      {filteredPlaces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPlaces.map((place) => {
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                place.address ? `${place.name} ${place.address}` : `${place.name} ${place.cityName}`
              )}`;

              return (
                <div
                  key={place.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all p-4 flex flex-col justify-between space-y-3 group"
                >
                  {/* Header info */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                          {place.cityName}
                        </span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                          {getCategoryIcon(place.category)}
                          <span>{t(`cat.${place.category}`)}</span>
                        </span>
                      </div>

                      {/* Star Rating */}
                      {place.rating ? (
                        <div className="flex items-center gap-0.5 text-amber-500 text-xs shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-bold text-slate-700 text-[11px]">{place.rating}</span>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                        {place.name}
                      </h3>

                      {place.address && (
                        <p className="text-xs text-slate-500 flex items-start gap-1 mt-1 line-clamp-2">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span>{place.address}</span>
                        </p>
                      )}
                    </div>

                    {/* Notes / Tips (Ai mách) */}
                    {place.notes && (
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 text-xs text-amber-900">
                        <div className="font-semibold text-[11px] flex items-center gap-1 text-amber-800 mb-0.5">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>{place.source || (isVi ? 'Ghi chú / Mách nước' : 'Tips & Notes')}</span>
                        </div>
                        <p className="text-slate-700 line-clamp-3 italic">{place.notes}</p>
                      </div>
                    )}

                    {/* Estimated Cost & Hours */}
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      {place.estimatedCost !== undefined && place.estimatedCost > 0 ? (
                        <div className="font-bold text-emerald-700">
                          {isVi ? 'Giá: ' : 'Est: '}
                          {formatMoney(place.estimatedCost, place.currency || 'VND', lang)}
                        </div>
                      ) : <div />}

                      {(place.openTime || place.closeTime) && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{place.openTime || '08:00'} - {place.closeTime || '22:00'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    {/* Google Maps link button */}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title={isVi ? 'Xem trên Google Maps' : 'View on Google Maps'}
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">Google Maps</span>
                      <ExternalLink className="w-3 h-3 text-blue-500" />
                    </a>

                    <div className="flex items-center gap-1">
                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(place)}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title={isVi ? 'Chỉnh sửa' : 'Edit place'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(isVi ? `Xóa địa điểm "${place.name}" khỏi danh sách lưu?` : `Delete "${place.name}"?`)) {
                            onDeletePlace(place.id);
                          }
                        }}
                        className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title={isVi ? 'Xóa địa điểm' : 'Delete place'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Schedule to Itinerary */}
                      <button
                        type="button"
                        onClick={() => handleOpenSchedule(place)}
                        className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        title={isVi ? 'Xếp vào lịch trình' : 'Schedule to trip'}
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>{isVi ? '+ Vào lịch trình' : '+ Add to Trip'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto text-xl">
              📍
            </div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              {isVi ? 'Chưa có địa điểm nào phù hợp' : 'No places found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {isVi
                ? 'Hãy bấm "Thêm Địa Điểm Mới" để lưu lại những quán xá, cảnh đẹp ai đó vừa khen nhé!'
                : 'Click "Add New Place" to bookmark recommendations you want to visit later!'}
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isVi ? 'Thêm địa điểm' : 'Add Place'}
            </button>
          </div>
        )}

      {/* 1. Modal Add / Edit Place - Responsive Mobile & Desktop */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] my-auto overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-white">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>📍</span>
                <span>{editingPlace ? (isVi ? 'Sửa Địa Điểm' : 'Edit Place') : (isVi ? 'Thêm Địa Điểm' : 'Add Place')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSavePlace} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 overscroll-contain">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Tên địa điểm *' : 'Place Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={isVi ? 'VD: Cà phê Hoàng Hôn Chiều, Bánh khọt...' : 'e.g. Sunset Cafe, Shibuya Sky...'}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>

                {/* City Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isVi ? 'Thành phố' : 'City'}
                    </label>
                    <select
                      value={formCity}
                      onChange={(e) => {
                        setFormCity(e.target.value);
                        if (e.target.value !== '__new__') setFormNewCity('');
                      }}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      {cityList.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__new__">{isVi ? '+ Nhập thành phố khác...' : '+ Other city...'}</option>
                    </select>
                  </div>

                  {formCity === '__new__' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isVi ? 'Tên thành phố mới *' : 'New City Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={formNewCity}
                        onChange={(e) => setFormNewCity(e.target.value)}
                        placeholder={isVi ? 'VD: Nha Trang, Phú Quốc...' : 'e.g. Kyoto, London...'}
                        className="w-full text-xs p-2.5 rounded-xl border border-teal-400 bg-teal-50/30 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isVi ? 'Thể loại' : 'Category'}
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as CategoryType)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value="sightseeing">{t('cat.sightseeing')}</option>
                        <option value="food">{t('cat.food')}</option>
                        <option value="activity">{t('cat.activity')}</option>
                        <option value="stay">{t('cat.stay')}</option>
                        <option value="shopping">{t('cat.shopping')}</option>
                        <option value="transport">{t('cat.transport')}</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Địa chỉ' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder={isVi ? 'VD: Dốc số 9, Trại Mát, Đà Lạt...' : 'Street address, district...'}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>

                {/* Cost, Rating & Opening Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isVi ? 'Chi phí' : 'Cost'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formCost}
                      onChange={(e) => setFormCost(e.target.value)}
                      placeholder="VD: 50000"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isVi ? 'Đánh giá' : 'Rating'}
                    </label>
                    <select
                      value={formRating}
                      onChange={(e) => setFormRating(parseInt(e.target.value, 10))}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      <option value="5">⭐⭐⭐⭐⭐ 5 sao</option>
                      <option value="4">⭐⭐⭐⭐ 4 sao</option>
                      <option value="3">⭐⭐⭐ 3 sao</option>
                      <option value="2">⭐⭐ 2 sao</option>
                      <option value="1">⭐ 1 sao</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isVi ? 'Giờ mở cửa' : 'Hours'}
                    </label>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="time"
                        value={formOpenTime}
                        onChange={(e) => setFormOpenTime(e.target.value)}
                        className="w-full min-w-0 text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                      />
                      <span className="text-xs text-slate-400 shrink-0">-</span>
                      <input
                        type="time"
                        value={formCloseTime}
                        onChange={(e) => setFormCloseTime(e.target.value)}
                        className="w-full min-w-0 text-xs p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Source (Ai mách) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Nguồn giới thiệu' : 'Source'}
                  </label>
                  <input
                    type="text"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    placeholder={isVi ? 'VD: Bạn bè mách, TikTok, Bác A...' : 'e.g. Friend, TikTok, Local guide...'}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Ghi chú' : 'Notes'}
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder={isVi ? 'VD: Đi lúc 16h30 ngắm hoàng hôn, nhớ thử bánh tráng...' : 'e.g. Best sunset view at 4:30 PM...'}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 shrink-0 bg-slate-50/80">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {t('itinerary.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  {editingPlace ? (isVi ? 'Cập Nhật' : 'Update') : (isVi ? 'Lưu' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Schedule to Trip */}
      {schedulingPlace && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-4 sm:p-6 space-y-4 my-auto max-h-[92dvh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-teal-600" />
                <span>{isVi ? 'Sắp Xếp Vào Lịch Trình' : 'Schedule into Trip'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSchedulingPlace(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scheduleSuccessMsg ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-emerald-800">{scheduleSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmSchedule} className="space-y-3.5">
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 text-xs text-teal-900 space-y-1">
                  <div className="font-bold text-sm text-slate-900">{schedulingPlace.name}</div>
                  <div className="text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600" />
                    <span>{schedulingPlace.cityName} {schedulingPlace.address ? `• ${schedulingPlace.address}` : ''}</span>
                  </div>
                </div>

                {/* Trip selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Chọn chuyến đi' : 'Select Trip'}
                  </label>
                  <select
                    value={scheduleTripId}
                    onChange={(e) => {
                      setScheduleTripId(e.target.value);
                      setScheduleDayNumber(1);
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    {trips.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.title} ({tr.destination})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Day selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Chọn ngày trong chuyến đi' : 'Select Day'}
                  </label>
                  <select
                    value={scheduleDayNumber}
                    onChange={(e) => setScheduleDayNumber(parseInt(e.target.value, 10))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    {targetTripObj.days.map((d) => (
                      <option key={d.dayNumber} value={d.dayNumber}>
                        {isVi ? `Ngày ${d.dayNumber} (${d.title})` : `Day ${d.dayNumber} (${d.title})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isVi ? 'Thời gian dự kiến' : 'Scheduled Time'}
                  </label>
                  <input
                    type="text"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    placeholder="VD: 09:00 AM, 16:30 PM..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Submit */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSchedulingPlace(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {t('itinerary.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Xác Nhận Thêm' : 'Confirm Schedule'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
