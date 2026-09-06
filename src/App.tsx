import React, { useState } from 'react';
import { SAMPLE_TRIPS } from './data/sampleTrips';
import { Trip, ActivityItem, Expense, PackingItem, TravelDocument, SavedPlace } from './types';
import { INITIAL_SAVED_PLACES } from './data/savedPlacesData';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { ItineraryView } from './components/ItineraryView';
import { InteractiveMapView } from './components/InteractiveMapView';
import { SavedPlacesView } from './components/SavedPlacesView';
import { ExpenseSplitterView } from './components/ExpenseSplitterView';
import { PackingListView } from './components/PackingListView';
import { TravelVaultView } from './components/TravelVaultView';
import { SwipeableTabBar } from './components/SwipeableTabBar';
import { AIItineraryModal } from './components/AIItineraryModal';
import { AIAssistantChat } from './components/AIAssistantChat';
import { NewTripModal } from './components/NewTripModal';
import { formatMoney } from './utils/formatCurrency';

import { 
  Calendar, MapPin, DollarSign, CloudSun, Users, Compass, 
  Map as MapIcon, BookmarkCheck, CreditCard, CheckSquare, ShieldCheck, Sparkles, Plus, Share2 
} from 'lucide-react';

type TabType = 'itinerary' | 'map' | 'places' | 'expenses' | 'packing' | 'vault';

function AppContent() {
  const { lang, t } = useLanguage();
  const [trips, setTrips] = useState<Trip[]>(SAMPLE_TRIPS);
  const [activeTripId, setActiveTripId] = useState<string>(SAMPLE_TRIPS[0].id);
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(INITIAL_SAVED_PLACES);

  // Modals & Panels
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isAiPackingLoading, setIsAiPackingLoading] = useState(false);

  // Active Trip reference
  const activeTrip = trips.find((t) => t.id === activeTripId) || trips[0];

  // Helper to update active trip
  const updateActiveTrip = (updater: (prevTrip: Trip) => Trip) => {
    setTrips((prevTrips) =>
      prevTrips.map((t) => (t.id === activeTrip.id ? updater(t) : t))
    );
  };

  // 1. Itinerary Handlers
  const handleAddActivity = (dayNumber: number, newAct: Omit<ActivityItem, 'id'>) => {
    updateActiveTrip((trip) => {
      const updatedDays = trip.days.map((day) => {
        if (day.dayNumber === dayNumber) {
          const activityItem: ActivityItem = {
            ...newAct,
            id: `act-${Date.now()}`,
          };
          return { ...day, activities: [...day.activities, activityItem] };
        }
        return day;
      });
      return { ...trip, days: updatedDays };
    });
  };

  const handleEditActivity = (
    dayNumber: number,
    activityId: string,
    updatedActivity: Partial<ActivityItem>,
    newDayNumber?: number
  ) => {
    updateActiveTrip((trip) => {
      const targetDay = newDayNumber !== undefined ? newDayNumber : dayNumber;
      if (targetDay === dayNumber) {
        // Edit within the same day
        const updatedDays = trip.days.map((day) => {
          if (day.dayNumber === dayNumber) {
            return {
              ...day,
              activities: day.activities.map((a) =>
                a.id === activityId ? { ...a, ...updatedActivity } : a
              ),
            };
          }
          return day;
        });
        return { ...trip, days: updatedDays };
      } else {
        // Move to a different day
        let activityToMove: ActivityItem | null = null;
        const daysWithoutActivity = trip.days.map((day) => {
          if (day.dayNumber === dayNumber) {
            const found = day.activities.find((a) => a.id === activityId);
            if (found) {
              activityToMove = { ...found, ...updatedActivity };
            }
            return {
              ...day,
              activities: day.activities.filter((a) => a.id !== activityId),
            };
          }
          return day;
        });

        if (!activityToMove) return trip;

        const updatedDays = daysWithoutActivity.map((day) => {
          if (day.dayNumber === targetDay) {
            return {
              ...day,
              activities: [...day.activities, activityToMove!],
            };
          }
          return day;
        });
        return { ...trip, days: updatedDays };
      }
    });
  };

  const handleToggleActivityCheck = (dayNumber: number, activityId: string) => {
    updateActiveTrip((trip) => {
      const updatedDays = trip.days.map((day) => {
        if (day.dayNumber === dayNumber) {
          const updatedActs = day.activities.map((a) =>
            a.id === activityId ? { ...a, isCompleted: !a.isCompleted } : a
          );
          return { ...day, activities: updatedActs };
        }
        return day;
      });
      return { ...trip, days: updatedDays };
    });
  };

  const handleDeleteActivity = (dayNumber: number, activityId: string) => {
    updateActiveTrip((trip) => {
      const updatedDays = trip.days.map((day) => {
        if (day.dayNumber === dayNumber) {
          return {
            ...day,
            activities: day.activities.filter((a) => a.id !== activityId),
          };
        }
        return day;
      });
      return { ...trip, days: updatedDays };
    });
  };

  // 2. Expense Handlers
  const handleAddExpense = (newExp: Omit<Expense, 'id'>) => {
    updateActiveTrip((trip) => {
      const expenseItem: Expense = {
        ...newExp,
        id: `exp-${Date.now()}`,
      };
      return { ...trip, expenses: [expenseItem, ...trip.expenses] };
    });
  };

  const handleDeleteExpense = (expenseId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      expenses: trip.expenses.filter((e) => e.id !== expenseId),
    }));
  };

  // 3. Packing List Handlers
  const handleTogglePackingItem = (itemId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: trip.packingList.map((i) =>
        i.id === itemId ? { ...i, isPacked: !i.isPacked } : i
      ),
    }));
  };

  const handleAddPackingItem = (newItem: Omit<PackingItem, 'id' | 'isPacked'>) => {
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: [
        ...trip.packingList,
        { ...newItem, id: `p-${Date.now()}`, isPacked: false },
      ],
    }));
  };

  const handleDeletePackingItem = (itemId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: trip.packingList.filter((i) => i.id !== itemId),
    }));
  };

  const handleGenerateAiPackingList = async () => {
    setIsAiPackingLoading(true);
    try {
      const res = await fetch('/api/gemini/packing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: activeTrip.destination,
          season: activeTrip.weatherForecast?.condition || 'pleasant',
          durationDays: activeTrip.days.length,
          language: lang,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate packing items.');

      const data = await res.json();
      if (data.packingItems && Array.isArray(data.packingItems)) {
        const newItems: PackingItem[] = data.packingItems.map((pi: any, idx: number) => ({
          id: `ai-p-${Date.now()}-${idx}`,
          category: pi.category || 'Essentials',
          name: pi.name,
          quantity: pi.quantity || 1,
          isPacked: false,
        }));

        updateActiveTrip((trip) => ({
          ...trip,
          packingList: [...trip.packingList, ...newItems],
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiPackingLoading(false);
    }
  };

  // 4. Travel Vault Handlers
  const handleAddDocument = (newDoc: Omit<TravelDocument, 'id'>) => {
    updateActiveTrip((trip) => ({
      ...trip,
      documents: [
        ...trip.documents,
        { ...newDoc, id: `doc-${Date.now()}` },
      ],
    }));
  };

  const handleDeleteDocument = (docId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      documents: trip.documents.filter((d) => d.id !== docId),
    }));
  };

  // 5. Apply AI Generated Itinerary
  const handleApplyGeneratedItinerary = (generatedData: any) => {
    if (!generatedData || !generatedData.days) return;

    updateActiveTrip((trip) => {
      const newDays = generatedData.days.map((d: any) => ({
        dayNumber: d.dayNumber,
        date: `Day ${d.dayNumber} - ${d.title}`,
        title: d.title,
        summary: d.summary,
        activities: d.activities.map((a: any, idx: number) => ({
          id: `ai-act-${Date.now()}-${d.dayNumber}-${idx}`,
          time: a.time || '10:00 AM',
          title: a.title,
          locationName: a.locationName || trip.destination,
          category: (a.category as any) || 'sightseeing',
          estimatedCost: a.estimatedCost || 0,
          notes: a.notes || '',
          isCompleted: false,
        })),
      }));

      return {
        ...trip,
        title: generatedData.destinationTitle || trip.title,
        days: newDays,
      };
    });
  };

  // 6. Create New Trip
  const handleCreateTrip = (newTrip: Trip) => {
    setTrips((prev) => [newTrip, ...prev]);
    setActiveTripId(newTrip.id);
  };

  // 7. Saved Places Handlers (Thêm, Sửa, Xóa, Sắp xếp vào Lịch trình)
  const handleAddSavedPlace = (place: Omit<SavedPlace, 'id' | 'createdAt'>) => {
    const newPlace: SavedPlace = {
      ...place,
      id: `place-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setSavedPlaces((prev) => [newPlace, ...prev]);
  };

  const handleEditSavedPlace = (id: string, updated: Partial<SavedPlace>) => {
    setSavedPlaces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
    );
  };

  const handleDeleteSavedPlace = (id: string) => {
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const handleScheduleSavedPlaceToTrip = (
    tripId: string,
    dayNumber: number,
    place: SavedPlace,
    time: string
  ) => {
    setTrips((prevTrips) =>
      prevTrips.map((t) => {
        if (t.id === tripId) {
          const newActivity: ActivityItem = {
            id: `act-${Date.now()}`,
            time: time || '10:00 AM',
            title: place.name,
            locationName: place.address ? `${place.name}, ${place.address}` : `${place.name}, ${place.cityName}`,
            category: place.category,
            estimatedCost: place.estimatedCost || 0,
            notes: place.notes || '',
            isCompleted: false,
          };

          const updatedDays = t.days.map((d) => {
            if (d.dayNumber === dayNumber) {
              return { ...d, activities: [...d.activities, newActivity] };
            }
            return d;
          });

          return { ...t, days: updatedDays };
        }
        return t;
      })
    );

    setActiveTripId(tripId);
    setActiveTab('itinerary');
  };

  const tabs = [
    { id: 'itinerary', label: t('tab.itinerary'), icon: <Compass className="w-4 h-4" />, badge: t('tab.daysCount', { count: activeTrip.days.length }) },
    { id: 'map', label: t('tab.map'), icon: <MapIcon className="w-4 h-4" /> },
    { id: 'places', label: t('tab.places'), icon: <BookmarkCheck className="w-4 h-4" />, badge: `${savedPlaces.length}` },
    { id: 'expenses', label: t('tab.expenses'), icon: <CreditCard className="w-4 h-4" />, badge: formatMoney(activeTrip.expenses.reduce((s, e) => s + e.amount, 0), activeTrip.currency, lang) },
    { id: 'packing', label: t('tab.packing'), icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'vault', label: t('tab.vault'), icon: <ShieldCheck className="w-4 h-4" />, badge: `${activeTrip.documents.length}` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      
      {/* Top Header Navbar */}
      <Navbar
        trips={trips}
        activeTrip={activeTrip}
        onSelectTrip={(id) => setActiveTripId(id)}
        onOpenNewTripModal={() => setIsNewTripModalOpen(true)}
        onOpenAIItineraryModal={() => setIsAIModalOpen(true)}
        onToggleAiChat={() => setIsAiChatOpen(!isAiChatOpen)}
        isAiChatOpen={isAiChatOpen}
      />

      {/* Main Container - Mobile Optimized */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 space-y-4 sm:space-y-5">
        
        {/* Simple Clean Trip Title & Details - No Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                {activeTrip.country}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {activeTrip.startDate} — {activeTrip.endDate}
              </span>
            </div>
            
            <h1 className="font-display font-extrabold text-xl sm:text-3xl text-slate-900 tracking-tight">
              {activeTrip.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 mt-1.5">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                {activeTrip.destination}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <DollarSign className="w-3.5 h-3.5 shrink-0" />
                {t('hero.targetBudget')}: {formatMoney(activeTrip.budgetTotal, activeTrip.currency, lang)}
              </span>
              {activeTrip.weatherForecast && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span>{activeTrip.weatherForecast.icon}</span>
                    <span>{activeTrip.weatherForecast.avgTempC}°C, {activeTrip.weatherForecast.condition}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Compact AI Action Icon */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-2xs group"
              title={isVi ? 'Tùy chỉnh chuyến đi với AI' : 'Customize with AI'}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600 group-hover:rotate-12 transition-transform" />
              <span className="text-[11px] font-extrabold tracking-wide uppercase text-teal-800">AI</span>
            </button>
          </div>
        </div>

        {/* Swipeable & Draggable Navigation Tab Bar */}
        <SwipeableTabBar
          tabs={tabs}
          activeTab={activeTab}
          onSelectTab={(tabId) => setActiveTab(tabId as TabType)}
        />

        {/* Tab View Contents */}
        <div className="transition-all duration-300">
          {activeTab === 'itinerary' && (
            <ItineraryView
              trip={activeTrip}
              savedPlaces={savedPlaces}
              onAddActivity={handleAddActivity}
              onEditActivity={handleEditActivity}
              onToggleActivityCheck={handleToggleActivityCheck}
              onDeleteActivity={handleDeleteActivity}
              onOpenAIModal={() => setIsAIModalOpen(true)}
            />
          )}

          {activeTab === 'map' && (
            <InteractiveMapView trip={activeTrip} />
          )}

          {activeTab === 'places' && (
            <SavedPlacesView
              savedPlaces={savedPlaces}
              activeTrip={activeTrip}
              trips={trips}
              onAddPlace={handleAddSavedPlace}
              onEditPlace={handleEditSavedPlace}
              onDeletePlace={handleDeleteSavedPlace}
              onScheduleToTrip={handleScheduleSavedPlaceToTrip}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpenseSplitterView
              trip={activeTrip}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeTab === 'packing' && (
            <PackingListView
              trip={activeTrip}
              onToggleItem={handleTogglePackingItem}
              onAddItem={handleAddPackingItem}
              onDeleteItem={handleDeletePackingItem}
              onGenerateAiPackingList={handleGenerateAiPackingList}
              isAiLoading={isAiPackingLoading}
            />
          )}

          {activeTab === 'vault' && (
            <TravelVaultView
              trip={activeTrip}
              onAddDocument={handleAddDocument}
              onDeleteDocument={handleDeleteDocument}
            />
          )}
        </div>

      </main>

      {/* AI Itinerary Generator Modal */}
      <AIItineraryModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onApplyGeneratedItinerary={handleApplyGeneratedItinerary}
      />

      {/* Floating AI Assistant Chat */}
      <AIAssistantChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        trip={activeTrip}
      />

      {/* New Trip Modal */}
      <NewTripModal
        isOpen={isNewTripModalOpen}
        onClose={() => setIsNewTripModalOpen(false)}
        onCreateTrip={handleCreateTrip}
      />

    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
