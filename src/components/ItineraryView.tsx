import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Clock, MapPin, Plus, CheckCircle2, Circle, Trash2, 
  Sparkles, Utensils, Hotel, Car, Camera, ShoppingBag, Compass, Tag, X,
  Search, Calendar, Filter, ChevronDown, ChevronUp, Eye, Edit3, ExternalLink,
  Navigation, BookmarkCheck
} from 'lucide-react';
import { Trip, ActivityItem, CategoryType, SavedPlace } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';

interface ItineraryViewProps {
  trip: Trip;
  savedPlaces?: SavedPlace[];
  onAddActivity: (dayNumber: number, activity: Omit<ActivityItem, 'id'>) => void;
  onEditActivity?: (dayNumber: number, activityId: string, updatedActivity: Partial<ActivityItem>, newDayNumber?: number) => void;
  onToggleActivityCheck: (dayNumber: number, activityId: string) => void;
  onDeleteActivity: (dayNumber: number, activityId: string) => void;
  onOpenAIModal: () => void;
}

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  sightseeing: <Camera className="w-3.5 h-3.5" />,
  food: <Utensils className="w-3.5 h-3.5" />,
  stay: <Hotel className="w-3.5 h-3.5" />,
  transport: <Car className="w-3.5 h-3.5" />,
  activity: <Compass className="w-3.5 h-3.5" />,
  shopping: <ShoppingBag className="w-3.5 h-3.5" />,
  flight: <Car className="w-3.5 h-3.5" />,
  other: <Tag className="w-3.5 h-3.5" />,
};

const CATEGORY_BADGES: Record<CategoryType, string> = {
  sightseeing: 'bg-purple-50 text-purple-700 border-purple-200',
  food: 'bg-amber-50 text-amber-700 border-amber-200',
  stay: 'bg-blue-50 text-blue-700 border-blue-200',
  transport: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  activity: 'bg-teal-50 text-teal-700 border-teal-200',
  shopping: 'bg-pink-50 text-pink-700 border-pink-200',
  flight: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const formatToDDMMYYYY = (dateStr?: string, dayNumber: number = 1, tripStartDate?: string): string => {
  if (tripStartDate) {
    const parts = tripStartDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + (dayNumber - 1));
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
  }

  if (dateStr) {
    const ddmmyyyyMatch = dateStr.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
    if (ddmmyyyyMatch) return ddmmyyyyMatch[0];

    const yyyymmddMatch = dateStr.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (yyyymmddMatch) {
      const [, y, m, d] = yyyymmddMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    const p = new Date(dateStr);
    if (!isNaN(p.getTime())) {
      const dd = String(p.getDate()).padStart(2, '0');
      const mm = String(p.getMonth() + 1).padStart(2, '0');
      const yyyy = p.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  return `Ngày ${dayNumber}`;
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  trip,
  savedPlaces = [],
  onAddActivity,
  onEditActivity,
  onToggleActivityCheck,
  onDeleteActivity,
  onOpenAIModal,
}) => {
  const { lang, t } = useLanguage();
  const [activeDayTab, setActiveDayTab] = useState<number | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  
  // Category dropdown state
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [dropdownSearchInput, setDropdownSearchInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Day dropdown state (with search-like feature)
  const [isDayDropdownOpen, setIsDayDropdownOpen] = useState(false);
  const [daySearchInput, setDaySearchInput] = useState('');
  const dayDropdownRef = useRef<HTMLDivElement>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetDayNumber, setTargetDayNumber] = useState<number>(trip.days[0]?.dayNumber || 1);

  // Detail viewing modal state
  const [viewingActivity, setViewingActivity] = useState<{ activity: ActivityItem; dayNumber: number } | null>(null);

  // Editing activity modal state
  const [editingActivity, setEditingActivity] = useState<{ activity: ActivityItem; dayNumber: number } | null>(null);
  const [editDayNumber, setEditDayNumber] = useState<number>(1);
  const [editTitle, setEditTitle] = useState('');
  const [editLocationName, setEditLocationName] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editCategory, setEditCategory] = useState<CategoryType>('sightseeing');
  const [editEstimatedCost, setEditEstimatedCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Location search droplist in Add Modal
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Close droplist popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsFilterDropdownOpen(false);
      }
      if (dayDropdownRef.current && !dayDropdownRef.current.contains(target)) {
        setIsDayDropdownOpen(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(target)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form states
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [category, setCategory] = useState<CategoryType>('sightseeing');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSavedPlaceId, setSelectedSavedPlaceId] = useState<string>('');

  const isVi = lang === 'vi';

  const categories: { label: string; value: string }[] = [
    { label: t('cat.all'), value: 'all' },
    { label: t('cat.food'), value: 'food' },
    { label: t('cat.sightseeing'), value: 'sightseeing' },
    { label: t('cat.activity'), value: 'activity' },
    { label: t('cat.transport'), value: 'transport' },
    { label: t('cat.stay'), value: 'stay' },
    { label: t('cat.shopping'), value: 'shopping' },
  ];

  // Filtered days for Day search droplist
  const filteredDaysForDropdown = useMemo(() => {
    const q = daySearchInput.trim().toLowerCase();
    if (!q) return trip.days;
    return trip.days.filter((d) => {
      const dayNumStr = `ngày ${d.dayNumber} day ${d.dayNumber}`;
      const title = d.title.toLowerCase();
      const date = d.date.toLowerCase();
      return dayNumStr.includes(q) || title.includes(q) || date.includes(q);
    });
  }, [daySearchInput, trip.days]);

  // Filtered categories for droplist
  const filteredCategories = useMemo(() => {
    const q = dropdownSearchInput.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => cat.label.toLowerCase().includes(q) || cat.value.toLowerCase().includes(q));
  }, [dropdownSearchInput, categories]);

  // Matching activities preview inside search droplist
  const matchingActivityHighlights = useMemo(() => {
    const q = dropdownSearchInput.trim().toLowerCase();
    if (!q) return [];
    const matches: { id: string; title: string; dayNumber: number; category: string }[] = [];
    trip.days.forEach((d) => {
      d.activities.forEach((act) => {
        if (act.title.toLowerCase().includes(q) || act.locationName.toLowerCase().includes(q)) {
          if (matches.length < 5) {
            matches.push({ id: act.id, title: act.title, dayNumber: d.dayNumber, category: act.category });
          }
        }
      });
    });
    return matches;
  }, [dropdownSearchInput, trip.days]);

  // Toggle single day expand/collapse
  const toggleDay = (dayNum: number) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum],
    }));
  };

  // Calculate totals
  const totalActivitiesCount = trip.days.reduce((sum, d) => sum + d.activities.length, 0);
  const completedActivitiesCount = trip.days.reduce(
    (sum, d) => sum + d.activities.filter((a) => a.isCompleted).length,
    0
  );
  const totalTripCost = trip.days.reduce(
    (sum, d) => sum + d.activities.reduce((dSum, a) => dSum + (a.estimatedCost || 0), 0),
    0
  );
  const totalSpent = trip.expenses ? trip.expenses.reduce((sum, e) => sum + e.amount, 0) : 0;

  // Matching saved places for location search droplist in Add modal
  const matchingSavedPlaces = useMemo(() => {
    if (!savedPlaces || savedPlaces.length === 0) return [];
    const q = locationName.trim().toLowerCase();
    if (!q) return savedPlaces;
    return savedPlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        p.cityName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [savedPlaces, locationName]);

  const handleOpenAddModal = (dayNum?: number) => {
    if (dayNum) {
      setTargetDayNumber(dayNum);
    } else if (typeof activeDayTab === 'number') {
      setTargetDayNumber(activeDayTab);
    } else {
      setTargetDayNumber(trip.days[0]?.dayNumber || 1);
    }
    setTitle('');
    setLocationName('');
    setTime('09:00 AM');
    setCategory('sightseeing');
    setEstimatedCost('');
    setNotes('');
    setSelectedSavedPlaceId('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (act: ActivityItem, dayNum: number) => {
    setEditingActivity({ activity: act, dayNumber: dayNum });
    setEditDayNumber(dayNum);
    setEditTitle(act.title);
    setEditLocationName(act.locationName);
    setEditTime(act.time || '09:00 AM');
    setEditCategory(act.category);
    setEditEstimatedCost(act.estimatedCost !== undefined ? String(act.estimatedCost) : '');
    setEditNotes(act.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !editTitle.trim() || !editLocationName.trim()) return;

    if (onEditActivity) {
      onEditActivity(
        editingActivity.dayNumber,
        editingActivity.activity.id,
        {
          title: editTitle.trim(),
          locationName: editLocationName.trim(),
          time: editTime.trim() || '09:00 AM',
          category: editCategory,
          estimatedCost: editEstimatedCost ? parseFloat(editEstimatedCost) : 0,
          notes: editNotes.trim(),
        },
        editDayNumber
      );
    }

    // Also update viewing activity if it's currently open
    if (viewingActivity && viewingActivity.activity.id === editingActivity.activity.id) {
      setViewingActivity({
        activity: {
          ...viewingActivity.activity,
          title: editTitle.trim(),
          locationName: editLocationName.trim(),
          time: editTime.trim() || '09:00 AM',
          category: editCategory,
          estimatedCost: editEstimatedCost ? parseFloat(editEstimatedCost) : 0,
          notes: editNotes.trim(),
        },
        dayNumber: editDayNumber,
      });
    }

    setEditingActivity(null);
  };

  const handlePickSavedPlace = (savedPlaceId: string) => {
    setSelectedSavedPlaceId(savedPlaceId);
    const found = savedPlaces.find((p) => p.id === savedPlaceId);
    if (found) {
      setTitle(found.name);
      setLocationName(found.address ? `${found.name}, ${found.address}` : `${found.name}, ${found.cityName}`);
      setCategory(found.category);
      if (found.estimatedCost !== undefined) {
        setEstimatedCost(String(found.estimatedCost));
      }
      if (found.notes) {
        setNotes(found.notes);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !locationName.trim()) return;

    onAddActivity(targetDayNumber, {
      time: time || '10:00 AM',
      title: title.trim(),
      locationName: locationName.trim(),
      category,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0,
      currency: trip.currency || 'VND',
      notes: notes.trim(),
      isCompleted: false,
    });

    // Auto expand day so user sees the newly added activity
    setExpandedDays((prev) => ({ ...prev, [targetDayNumber]: true }));
    setIsAddModalOpen(false);
  };

  // Filter days and activities based on search query, day select, and category
  const filteredDays = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    // First, filter by day selection if not 'all'
    const baseDays = activeDayTab === 'all'
      ? trip.days
      : trip.days.filter((d) => d.dayNumber === activeDayTab);

    return baseDays.map((day) => {
      const filteredActivities = day.activities.filter((act) => {
        // Category filter
        const matchCategory = selectedCategory === 'all' ? true : act.category === selectedCategory;
        if (!matchCategory) return false;

        // Search query filter (like search on title, location, category)
        if (!query) return true;

        const titleMatch = act.title.toLowerCase().includes(query);
        const locMatch = act.locationName.toLowerCase().includes(query);
        const catMatch = t(`cat.${act.category}`).toLowerCase().includes(query);

        return titleMatch || locMatch || catMatch;
      });

      return {
        ...day,
        activities: filteredActivities,
      };
    });
  }, [trip.days, activeDayTab, selectedCategory, searchQuery, t]);

  const totalFilteredCount = filteredDays.reduce((sum, d) => sum + d.activities.length, 0);

  return (
    <div className="space-y-4">
      
      {/* 1. Mobile-First Compact Droplist Filter Bar (Day Search Droplist + Category Search Droplist + Add Activity) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs relative z-20">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
          
          {/* Day Selector Search-Like Droplist */}
          <div className="relative col-span-1" ref={dayDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsDayDropdownOpen(!isDayDropdownOpen);
                setIsFilterDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-between text-xs font-semibold py-2 px-2.5 rounded-xl border transition-colors shadow-2xs cursor-pointer truncate ${
                activeDayTab !== 'all'
                  ? 'border-teal-500 bg-teal-50/70 text-teal-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="truncate flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">
                  {activeDayTab === 'all'
                    ? (isVi ? `Tất cả ngày (${totalActivitiesCount})` : `All Days (${totalActivitiesCount})`)
                    : (() => {
                        const selectedDayObj = trip.days.find((d) => d.dayNumber === activeDayTab);
                        const onlyD = selectedDayObj?.date ? selectedDayObj.date.split(' - ')[0].trim() : '';
                        return isVi
                          ? `Ngày ${activeDayTab}${onlyD ? ` (${onlyD})` : ''}`
                          : `Day ${activeDayTab}${onlyD ? ` (${onlyD})` : ''}`;
                      })()}
                </span>
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {activeDayTab !== 'all' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDayTab('all');
                      setDaySearchInput('');
                    }}
                    className="p-0.5 hover:bg-teal-200/60 rounded text-teal-700"
                    title={isVi ? 'Xóa lọc ngày' : 'Reset day filter'}
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDayDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Day Search Droplist Menu */}
            {isDayDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                {/* Search input inside day droplist */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={daySearchInput}
                    onChange={(e) => setDaySearchInput(e.target.value)}
                    placeholder={isVi ? 'Tìm ngày (VD: 1, 20/08)...' : 'Search day (e.g. 1, 20/08)...'}
                    className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                  {daySearchInput && (
                    <button
                      type="button"
                      onClick={() => setDaySearchInput('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Days list */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDayTab('all');
                      setIsDayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      activeDayTab === 'all'
                        ? 'bg-teal-50 text-teal-800 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{isVi ? `📅 Tất cả ngày (${totalActivitiesCount})` : `📅 All Days (${totalActivitiesCount})`}</span>
                    {activeDayTab === 'all' && <span className="text-teal-600 text-xs">✓</span>}
                  </button>

                  {filteredDaysForDropdown.map((d) => {
                    const onlyD = d.date ? d.date.split(' - ')[0].trim() : '';
                    const isSelected = activeDayTab === d.dayNumber;
                    return (
                      <button
                        key={d.dayNumber}
                        type="button"
                        onClick={() => {
                          setActiveDayTab(d.dayNumber);
                          setExpandedDays((prev) => ({ ...prev, [d.dayNumber]: true }));
                          setIsDayDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50 text-teal-800 font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-slate-900">
                            {isVi ? `Ngày ${d.dayNumber}` : `Day ${d.dayNumber}`}
                          </span>
                          {onlyD && <span className="text-slate-400 ml-1 font-normal">({onlyD})</span>}
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-1.5">
                          {d.activities.length} {isVi ? 'mục' : 'acts'}
                        </span>
                      </button>
                    );
                  })}

                  {filteredDaysForDropdown.length === 0 && (
                    <div className="text-center py-3 text-xs text-slate-400 italic">
                      {isVi ? 'Không tìm thấy ngày phù hợp' : 'No matching days'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search-Like Droplist (Category / Activity Searchable Filter) */}
          <div className="relative col-span-1" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsFilterDropdownOpen(!isFilterDropdownOpen);
                setIsDayDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-between text-xs font-semibold py-2 px-2.5 rounded-xl border transition-colors shadow-2xs cursor-pointer truncate ${
                selectedCategory !== 'all' || searchQuery
                  ? 'border-teal-500 bg-teal-50/70 text-teal-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="truncate flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">
                  {searchQuery
                    ? `🔍 "${searchQuery}"`
                    : selectedCategory !== 'all'
                    ? (categories.find((c) => c.value === selectedCategory)?.label || selectedCategory)
                    : (isVi ? 'Tất cả thể loại' : 'All Categories')}
                </span>
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {(selectedCategory !== 'all' || searchQuery) && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory('all');
                      setSearchQuery('');
                      setDropdownSearchInput('');
                    }}
                    className="p-0.5 hover:bg-teal-200/60 rounded text-teal-700"
                    title={isVi ? 'Xóa lọc' : 'Clear filter'}
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Droplist Menu with search input inside - anchored right on mobile to prevent overflow/layout breaking */}
            {isFilterDropdownOpen && (
              <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                {/* Search input inside droplist */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={dropdownSearchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDropdownSearchInput(val);
                      setSearchQuery(val);
                    }}
                    placeholder={isVi ? 'Gõ tìm kiếm hoạt động...' : 'Type to search activity...'}
                    className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                  {dropdownSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownSearchInput('');
                        setSearchQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Categories selection list */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                    {isVi ? 'Theo Thể loại' : 'By Category'}
                  </div>
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.value);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        selectedCategory === cat.value && !searchQuery
                          ? 'bg-teal-50 text-teal-800 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {selectedCategory === cat.value && !searchQuery && (
                        <span className="text-teal-600 text-xs">✓</span>
                      )}
                    </button>
                  ))}

                  {/* Direct matching activity items */}
                  {matchingActivityHighlights.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                        {isVi ? 'Gợi ý hoạt động khớp' : 'Matching Activities'}
                      </div>
                      {matchingActivityHighlights.map((act) => (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => {
                            setSearchQuery(act.title);
                            setDropdownSearchInput(act.title);
                            setExpandedDays((prev) => ({ ...prev, [act.dayNumber]: true }));
                            setIsFilterDropdownOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate font-medium">{act.title}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                            {isVi ? `Ngày ${act.dayNumber}` : `Day ${act.dayNumber}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Button: Add Activity */}
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <button
              onClick={() => handleOpenAddModal()}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer min-h-[36px]"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              <span>{t('itinerary.addActivity')}</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. Overview Info Bar - Showing both Total Expected and Total Spent */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {searchQuery ? (
            <span className="font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200 text-[11px]">
              {isVi ? `Tìm thấy ${totalFilteredCount} kết quả` : `Found ${totalFilteredCount} results`}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium">
              {isVi ? `Đã hoàn thành ${completedActivitiesCount}/${totalActivitiesCount} hoạt động` : `Done ${completedActivitiesCount}/${totalActivitiesCount} activities`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/90 border border-blue-200/80 text-[11px] sm:text-xs">
            <span className="text-slate-500 font-medium">{isVi ? 'Tổng dự kiến:' : 'Expected:'}</span>
            <span className="font-extrabold text-blue-700">
              {formatMoney(totalTripCost, trip.currency, lang)}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-[11px] sm:text-xs">
            <span className="text-slate-500 font-medium">{isVi ? 'Đã chi:' : 'Spent:'}</span>
            <span className="font-extrabold text-emerald-700">
              {formatMoney(totalSpent, trip.currency, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Days & Activity Cards List (Collapsed by default, toggled with ^ icon) */}
      <div className="space-y-3">
        {filteredDays.length === 0 || totalFilteredCount === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-2xs">
            <p className="text-xs text-slate-500 font-medium">
              {searchQuery 
                ? (isVi ? `Không tìm thấy hoạt động nào phù hợp với từ khóa "${searchQuery}"` : `No activities found matching "${searchQuery}"`)
                : (isVi ? 'Chưa có hoạt động nào trong mục này' : 'No activities in this section')}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDropdownSearchInput('');
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {isVi ? 'Xóa từ khóa tìm kiếm' : 'Clear search'}
              </button>
            )}
          </div>
        ) : (
          filteredDays.map((day) => {
            if (day.activities.length === 0 && searchQuery) {
              return null;
            }

            const dayCost = day.activities.reduce((sum, a) => sum + (a.estimatedCost || 0), 0);
            const formattedDate = formatToDDMMYYYY(day.date, day.dayNumber, trip.startDate);
            const cleanTitle = day.title ? day.title.replace(/^(ngày|day)\s*\d+[\s:–-]*/i, '').trim() : '';
            const isExpanded = !!expandedDays[day.dayNumber];

            return (
              <div
                key={day.dayNumber}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Day Header - Clean, orderly, structured without cluttered title/date */}
                <div
                  onClick={() => toggleDay(day.dayNumber)}
                  className={`px-3.5 py-3 cursor-pointer transition-colors select-none ${
                    isExpanded ? 'bg-slate-50/90 border-b border-slate-100' : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Left: Badge + Date + Title */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-xs shadow-2xs">
                          {isVi ? `Ngày ${day.dayNumber}` : `Day ${day.dayNumber}`}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formattedDate}
                        </span>
                      </div>

                      {cleanTitle ? (
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-800 truncate" title={cleanTitle}>
                            {cleanTitle}
                          </h3>
                        </div>
                      ) : null}
                    </div>

                    {/* Right: Activity count, Cost, Add button & Chevron */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {day.activities.length} {isVi ? 'hoạt động' : 'acts'}
                        </span>

                        {dayCost > 0 && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            {formatMoney(dayCost, trip.currency, lang)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddModal(day.dayNumber);
                          }}
                          className="p-1.5 hover:bg-slate-200/70 text-slate-600 hover:text-teal-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          title={t('itinerary.addActivityToDay', { day: day.dayNumber })}
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <div
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-transform duration-200"
                          title={isExpanded ? (isVi ? 'Thu gọn' : 'Collapse') : (isVi ? 'Xem chi tiết' : 'Expand')}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-teal-600' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clean progress bar when collapsed */}
                  {!isExpanded && day.activities.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(day.activities.filter((a) => a.isCompleted).length / day.activities.length) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {day.activities.filter((a) => a.isCompleted).length}/{day.activities.length} {isVi ? 'xong' : 'done'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Activities List: only shown when expanded (default is collapsed) */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 animate-in fade-in-50 duration-150">
                    {day.activities.length === 0 ? (
                      <div className="text-center py-5 text-slate-400 space-y-2">
                        <p className="text-xs italic">{t('itinerary.emptyHint')}</p>
                        <button
                          onClick={() => handleOpenAddModal(day.dayNumber)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t('itinerary.addActivity')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {day.activities.map((act) => (
                          <div
                            key={act.id}
                            className={`group p-3 rounded-xl border transition-all ${
                              act.isCompleted
                                ? 'bg-slate-50/60 border-slate-200/60 opacity-60'
                                : 'bg-white hover:bg-slate-50/40 border-slate-200 hover:border-teal-300 shadow-2xs'
                            }`}
                          >
                            {/* Row 1: Checkbox + Time + Title + Category */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <button
                                  onClick={() => onToggleActivityCheck(day.dayNumber, act.id)}
                                  className="mt-0.5 text-slate-400 hover:text-teal-600 transition-colors shrink-0 cursor-pointer p-0.5"
                                  title={act.isCompleted ? (isVi ? 'Đánh dấu chưa hoàn thành' : 'Mark incomplete') : (isVi ? 'Đánh dấu đã hoàn thành' : 'Mark complete')}
                                >
                                  {act.isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5 text-teal-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 hover:border-teal-500" />
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {act.time}
                                    </span>

                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                                        CATEGORY_BADGES[act.category] || CATEGORY_BADGES.other
                                      }`}
                                    >
                                      {CATEGORY_ICONS[act.category]}
                                      <span>{t(`cat.${act.category}`) || act.category}</span>
                                    </span>
                                  </div>

                                  <h4
                                    className={`text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words ${
                                      act.isCompleted ? 'line-through text-slate-400' : ''
                                    }`}
                                  >
                                    {act.title}
                                  </h4>
                                </div>
                              </div>

                              {/* Action Buttons: View Detail, Edit, Delete */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                {/* View Detail */}
                                <button
                                  type="button"
                                  onClick={() => setViewingActivity({ activity: act, dayNumber: day.dayNumber })}
                                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                  title={isVi ? 'Xem chi tiết & Bản đồ Google' : 'View Details & Google Maps'}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(act, day.dayNumber)}
                                  className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title={isVi ? 'Chỉnh sửa hoạt động' : 'Edit activity'}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => onDeleteActivity(day.dayNumber, act.id)}
                                  className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title={isVi ? 'Xóa hoạt động này' : 'Delete this activity'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Location & Google Maps Link & Price */}
                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
                              <div className="flex items-center gap-1 text-slate-500 min-w-0 truncate">
                                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span
                                  onClick={() => setViewingActivity({ activity: act, dayNumber: day.dayNumber })}
                                  className="text-[11px] truncate font-medium hover:text-teal-700 cursor-pointer"
                                >
                                  {act.locationName}
                                </span>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                    act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center w-5 h-5 text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 rounded-md transition-colors shrink-0 ml-1"
                                  title={isVi ? 'Mở trên Google Maps' : 'Open in Google Maps'}
                                >
                                  <MapPin className="w-3 h-3" />
                                </a>
                              </div>

                              {act.estimatedCost !== undefined && (
                                <div className="shrink-0 font-bold text-[11px] text-emerald-700">
                                  {act.estimatedCost > 0
                                    ? formatMoney(act.estimatedCost, act.currency || trip.currency, lang)
                                    : (isVi ? 'Miễn phí' : 'Free')}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Simple, Mobile-Friendly Add Activity Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base">
                  {t('itinerary.addNewTitle', { day: targetDayNumber })}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-3.5">
              
              {/* Day selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Chọn ngày' : 'Select Day'}
                </label>
                <select
                  value={targetDayNumber}
                  onChange={(e) => setTargetDayNumber(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                >
                  {trip.days.map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      {isVi
                        ? `Ngày ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`
                        : `Day ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location with Search-Like Droplist */}
              <div className="relative" ref={locationDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('itinerary.fieldLocation')} *
                  </label>
                  {savedPlaces && savedPlaces.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                      className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                    >
                      <BookmarkCheck className="w-3 h-3 text-teal-600" />
                      <span>{isVi ? 'Gợi ý từ địa điểm đã lưu' : 'Saved places'}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={isVi ? 'Nhập tên quán, địa chỉ hoặc chọn từ droplist...' : 'Type location or pick from dropdown...'}
                    value={locationName}
                    onChange={(e) => {
                      setLocationName(e.target.value);
                      setIsLocationDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (savedPlaces && savedPlaces.length > 0) {
                        setIsLocationDropdownOpen(true);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden pr-8"
                  />
                  {locationName && (
                    <button
                      type="button"
                      onClick={() => setLocationName('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Search-Like Droplist of Saved Places */}
                {isLocationDropdownOpen && savedPlaces && savedPlaces.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-2 max-h-52 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center justify-between">
                      <span>{isVi ? 'Gợi ý từ địa điểm đã lưu (Search Like)' : 'Saved places (Search Like)'}</span>
                      <span>{matchingSavedPlaces.length} {isVi ? 'kết quả' : 'matches'}</span>
                    </div>

                    {matchingSavedPlaces.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          handlePickSavedPlace(sp.id);
                          setIsLocationDropdownOpen(false);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-teal-50/80 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 group-hover:text-teal-900 truncate">
                            {sp.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <span className="font-semibold text-teal-700">[{sp.cityName}]</span>
                            <span>{sp.address || sp.category}</span>
                          </div>
                        </div>

                        {sp.estimatedCost !== undefined && sp.estimatedCost > 0 && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                            {formatMoney(sp.estimatedCost, sp.currency || trip.currency, lang)}
                          </span>
                        )}
                      </button>
                    ))}

                    {matchingSavedPlaces.length === 0 && (
                      <div className="text-center py-2 text-xs text-slate-400 italic">
                        {isVi ? `Không có địa điểm đã lưu khớp với "${locationName}". Bạn có thể nhập tự do!` : `No saved place matches "${locationName}". You can type freely!`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Activity title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('itinerary.fieldTitle')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={isVi ? 'Ví dụ: Cà phê Túi Mơ To, Lẩu cá đuối...' : 'e.g., Tokyo Skytree Visit'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('itinerary.fieldTime')}
                  </label>
                  <input
                    type="text"
                    placeholder="09:00 AM"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('itinerary.fieldCategory')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  >
                    <option value="food">{t('cat.food')}</option>
                    <option value="sightseeing">{t('cat.sightseeing')}</option>
                    <option value="activity">{t('cat.activity')}</option>
                    <option value="transport">{t('cat.transport')}</option>
                    <option value="stay">{t('cat.stay')}</option>
                    <option value="shopping">{t('cat.shopping')}</option>
                    <option value="other">{t('cat.other')}</option>
                  </select>
                </div>

                {/* Estimated Cost */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Chi phí dự kiến' : t('itinerary.fieldEstCost')}
                  </label>
                  <input
                    type="number"
                    placeholder={isVi ? "50000" : "0"}
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('itinerary.fieldNotes')}
                </label>
                <input
                  type="text"
                  placeholder={isVi ? 'Ví dụ: Đặt bàn trước 1 ngày, chuẩn bị áo ấm' : 'e.g., Buy tickets online in advance'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {t('itinerary.cancel')}
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
      )}

      {/* 5. Activity Detail Modal (with direct Google Maps connection) */}
      {viewingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-bold">
                  {isVi ? `Ngày ${viewingActivity.dayNumber}` : `Day ${viewingActivity.dayNumber}`}
                </span>
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  {viewingActivity.activity.time}
                </span>
              </div>
              <button
                onClick={() => setViewingActivity(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Title & Category */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${
                      CATEGORY_BADGES[viewingActivity.activity.category] || CATEGORY_BADGES.other
                    }`}
                  >
                    {CATEGORY_ICONS[viewingActivity.activity.category]}
                    <span>{t(`cat.${viewingActivity.activity.category}`) || viewingActivity.activity.category}</span>
                  </span>

                  {viewingActivity.activity.isCompleted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {isVi ? 'Đã hoàn thành' : 'Completed'}
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {viewingActivity.activity.title}
                </h3>
              </div>

              {/* Location & Google Maps Connection */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {isVi ? 'Địa điểm / Địa chỉ' : 'Location / Address'}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 mt-0.5">
                      {viewingActivity.activity.locationName}
                    </div>
                  </div>
                </div>

                {/* Google Maps Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      viewingActivity.activity.locationName
                        ? `${viewingActivity.activity.locationName}, ${trip.destination}`
                        : viewingActivity.activity.title
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{isVi ? 'Mở trên Google Maps' : 'Open in Google Maps'}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
                  </a>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      viewingActivity.activity.locationName
                        ? `${viewingActivity.activity.locationName}, ${trip.destination}`
                        : viewingActivity.activity.title
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center border border-slate-200"
                  >
                    <Navigation className="w-4 h-4 text-slate-600" />
                    <span>{isVi ? 'Chỉ Đường Google Maps' : 'Directions'}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Estimated Cost */}
              {viewingActivity.activity.estimatedCost !== undefined && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
                  <span className="text-xs font-bold text-slate-700">
                    {isVi ? 'Chi phí dự kiến:' : 'Estimated Cost:'}
                  </span>
                  <span className="text-sm font-extrabold text-emerald-700">
                    {viewingActivity.activity.estimatedCost > 0
                      ? formatMoney(viewingActivity.activity.estimatedCost, viewingActivity.activity.currency || trip.currency, lang)
                      : (isVi ? 'Miễn phí' : 'Free')}
                  </span>
                </div>
              )}

              {/* Notes */}
              {viewingActivity.activity.notes && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 space-y-1 text-xs">
                  <div className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isVi ? 'Lưu ý & Ghi chú' : 'Notes & Tips'}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{viewingActivity.activity.notes}</p>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onToggleActivityCheck(viewingActivity.dayNumber, viewingActivity.activity.id);
                    setViewingActivity({
                      ...viewingActivity,
                      activity: {
                        ...viewingActivity.activity,
                        isCompleted: !viewingActivity.activity.isCompleted,
                      },
                    });
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span>
                    {viewingActivity.activity.isCompleted
                      ? (isVi ? 'Đánh dấu chưa làm' : 'Mark incomplete')
                      : (isVi ? 'Đánh dấu đã xong' : 'Mark completed')}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const act = viewingActivity.activity;
                      const dayNum = viewingActivity.dayNumber;
                      setViewingActivity(null);
                      handleOpenEditModal(act, dayNum);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Chỉnh Sửa' : 'Edit'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingActivity(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {isVi ? 'Đóng' : 'Close'}
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 6. Activity Edit Modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-5 py-3.5 bg-blue-700 text-white flex items-center justify-between">
              <h3 className="font-display font-bold text-sm sm:text-base flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" />
                <span>{isVi ? 'Chỉnh Sửa Hoạt Động' : 'Edit Activity'}</span>
              </h3>
              <button
                onClick={() => setEditingActivity(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 space-y-3.5">
              
              {/* Day selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Ngày trong chuyến đi' : 'Day'}
                </label>
                <select
                  value={editDayNumber}
                  onChange={(e) => setEditDayNumber(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                >
                  {trip.days.map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      {isVi
                        ? `Ngày ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`
                        : `Day ${d.dayNumber} - ${formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Tên hoạt động *' : 'Activity Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Địa điểm / Địa chỉ *' : 'Location / Address *'}
                </label>
                <input
                  type="text"
                  required
                  value={editLocationName}
                  onChange={(e) => setEditLocationName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Thời gian' : 'Time'}
                  </label>
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Thể loại' : 'Category'}
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CategoryType)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="food">{t('cat.food')}</option>
                    <option value="sightseeing">{t('cat.sightseeing')}</option>
                    <option value="activity">{t('cat.activity')}</option>
                    <option value="transport">{t('cat.transport')}</option>
                    <option value="stay">{t('cat.stay')}</option>
                    <option value="shopping">{t('cat.shopping')}</option>
                    <option value="other">{t('cat.other')}</option>
                  </select>
                </div>

                {/* Estimated Cost */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isVi ? 'Chi phí dự kiến' : 'Estimated Cost'}
                  </label>
                  <input
                    type="number"
                    value={editEstimatedCost}
                    onChange={(e) => setEditEstimatedCost(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isVi ? 'Ghi chú & Lưu ý' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isVi ? 'Lưu' : 'Save'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
