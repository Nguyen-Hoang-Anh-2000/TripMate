import React, { useState } from 'react';
import { SAMPLE_TRIPS } from './data/sampleTrips';
import { Trip, ActivityItem, Expense, PackingItem, TravelDocument, SavedPlace, TripMember } from './types';
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
import { EditTripModal } from './components/EditTripModal';
import { formatMoney } from './utils/formatCurrency';

import { 
  Calendar, MapPin, DollarSign, CloudSun, Users, Compass, 
  Map as MapIcon, BookmarkCheck, CreditCard, CheckSquare, ShieldCheck, Sparkles, Plus, Share2,
  Edit3, Trash2, Camera
} from 'lucide-react';

type TabType = 'itinerary' | 'expenses' | 'map' | 'places' | 'vault' | 'packing';

function AppContent() {
  const { lang, t, isVi } = useLanguage();
  const [trips, setTrips] = useState<Trip[]>(SAMPLE_TRIPS);
  const [activeTripId, setActiveTripId] = useState<string>(SAMPLE_TRIPS[0].id);
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(INITIAL_SAVED_PLACES);

  // Modals & Panels
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
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
      let updatedDays = trip.days;
      if (targetDay === dayNumber) {
        // Edit within the same day
        updatedDays = trip.days.map((day) => {
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

        updatedDays = daysWithoutActivity.map((day) => {
          if (day.dayNumber === targetDay) {
            return {
              ...day,
              activities: [...day.activities, activityToMove!],
            };
          }
          return day;
        });
      }

      // Also update linked expense in trip.expenses if one exists (DO NOT create new)
      let updatedExpenses = trip.expenses;
      const linkedExpenseIndex = trip.expenses.findIndex(
        (e) =>
          e.activityId === activityId ||
          (updatedActivity.expenseId && e.id === updatedActivity.expenseId) ||
          (updatedActivity.title && e.title.trim().toLowerCase() === updatedActivity.title.trim().toLowerCase() && e.receiptNote && e.receiptNote.includes(`Ngày ${dayNumber}`))
      );

      if (linkedExpenseIndex >= 0) {
        const oldExp = trip.expenses[linkedExpenseIndex];
        const newCost =
          updatedActivity.actualCost !== undefined
            ? updatedActivity.actualCost
            : updatedActivity.estimatedCost !== undefined
            ? updatedActivity.estimatedCost
            : oldExp.amount;

        updatedExpenses = trip.expenses.map((e, idx) => {
          if (idx === linkedExpenseIndex) {
            return {
              ...e,
              activityId: activityId,
              title: updatedActivity.title || e.title,
              amount: newCost,
              category: updatedActivity.category || e.category,
              paidBy: updatedActivity.paidBy || e.paidBy,
              splitWith: updatedActivity.splitWith || e.splitWith,
              memberSplits: updatedActivity.memberSplits || e.memberSplits,
            };
          }
          return e;
        });
      }

      return { ...trip, days: updatedDays, expenses: updatedExpenses };
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
      // Also delete linked expense if activity is deleted
      const updatedExpenses = trip.expenses.filter((e) => e.activityId !== activityId);
      return { ...trip, days: updatedDays, expenses: updatedExpenses };
    });
  };

  // 1.5 Handle Saving/Updating Activity Expense (Updates existing expense in-place, never duplicates!)
  const handleSaveActivityExpense = (
    dayNumber: number,
    activityId: string,
    data: {
      amount: number;
      paidBy: string;
      splitWith: string[];
      recordExpense: boolean;
      unitPrice?: number;
      expenseId?: string;
      memberSplits?: { memberId: string; amount: number }[];
    }
  ) => {
    updateActiveTrip((trip) => {
      let targetActivity: ActivityItem | null = null;
      let targetDayNum = dayNumber;

      for (const d of trip.days) {
        const found = d.activities.find((a) => a.id === activityId);
        if (found) {
          targetActivity = found;
          targetDayNum = d.dayNumber;
          break;
        }
      }

      if (!targetActivity) return trip;

      // Check if this activity already has an expense in trip.expenses
      const existingExpenseIndex = trip.expenses.findIndex(
        (e) =>
          e.activityId === activityId ||
          (data.expenseId && e.id === data.expenseId) ||
          (targetActivity?.expenseId && e.id === targetActivity.expenseId) ||
          (e.title.trim().toLowerCase() === targetActivity?.title.trim().toLowerCase() &&
            e.receiptNote &&
            e.receiptNote.includes(`Ngày ${targetDayNum}`))
      );

      const determinedExpenseId =
        existingExpenseIndex >= 0
          ? trip.expenses[existingExpenseIndex].id
          : data.expenseId || targetActivity.expenseId || `exp-act-${activityId}`;

      // 1. Update activity in days
      const updatedDays = trip.days.map((day) => {
        if (day.dayNumber === targetDayNum) {
          return {
            ...day,
            activities: day.activities.map((a) => {
              if (a.id === activityId) {
                return {
                  ...a,
                  isCompleted: true,
                  actualCost: data.amount,
                  estimatedCost: data.amount,
                  paidBy: data.paidBy,
                  splitWith: data.splitWith,
                  memberSplits: data.memberSplits,
                  expenseId: data.recordExpense ? determinedExpenseId : undefined,
                };
              }
              return a;
            }),
          };
        }
        return day;
      });

      // 2. Update or add expense in expenses list
      let updatedExpenses = [...trip.expenses];

      if (data.recordExpense) {
        const expensePayload: Expense = {
          id: determinedExpenseId,
          activityId: activityId,
          title: targetActivity.title,
          amount: data.amount,
          currency: targetActivity.currency || trip.currency || 'VND',
          category: targetActivity.category || 'activity',
          paidBy: data.paidBy,
          splitWith: data.splitWith.length > 0 ? data.splitWith : trip.members.map((m) => m.id),
          memberSplits: data.memberSplits,
          date: new Date().toISOString().split('T')[0],
          receiptNote: `${lang === 'vi' ? 'Chi tiêu tự động từ hoạt động:' : 'Auto-recorded from activity:'} ${targetActivity.title} (${lang === 'vi' ? `Ngày ${targetDayNum}` : `Day ${targetDayNum}`})`,
        };

        if (existingExpenseIndex >= 0) {
          // UPDATE existing expense in-place! Do NOT add new!
          updatedExpenses[existingExpenseIndex] = {
            ...updatedExpenses[existingExpenseIndex],
            ...expensePayload,
          };
        } else {
          // First time recording
          updatedExpenses = [expensePayload, ...updatedExpenses];
        }
      } else {
        // If user unchecked recordExpense, remove it if existed
        if (existingExpenseIndex >= 0) {
          updatedExpenses = updatedExpenses.filter((_, idx) => idx !== existingExpenseIndex);
        }
      }

      return {
        ...trip,
        days: updatedDays,
        expenses: updatedExpenses,
      };
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

  const handleDeleteExpense = (expenseId?: string, activityId?: string) => {
    updateActiveTrip((trip) => {
      let updatedExpenses = trip.expenses.filter((e) => {
        if (expenseId && e.id === expenseId) return false;
        if (activityId && e.activityId === activityId) return false;
        return true;
      });

      let updatedDays = trip.days;
      if (activityId) {
        updatedDays = trip.days.map((day) => ({
          ...day,
          activities: day.activities.map((act) => {
            if (act.id === activityId) {
              return {
                ...act,
                actualCost: undefined,
                expenseId: undefined,
              };
            }
            return act;
          }),
        }));
      }

      return {
        ...trip,
        expenses: updatedExpenses,
        days: updatedDays,
      };
    });
  };

  const handleUpdateExpense = (item: {
    id: string;
    sourceType: 'completed_activity' | 'manual_expense';
    activityId?: string;
    expenseId?: string;
    title: string;
    amount: number;
    currency?: string;
    category: CategoryType;
    paidBy: string;
    splitWith: string[];
    memberSplits?: { memberId: string; amount: number }[];
    date?: string;
    dayNumber?: number;
    note?: string;
  }) => {
    updateActiveTrip((trip) => {
      let updatedDays = [...trip.days];
      let updatedExpenses = [...trip.expenses];

      // 1. Đồng bộ sang hoạt động nếu chi tiêu thuộc hoạt động đã hoàn thành trong lịch trình
      if (item.activityId) {
        updatedDays = trip.days.map((day) => ({
          ...day,
          activities: day.activities.map((act) => {
            if (act.id === item.activityId) {
              return {
                ...act,
                title: item.title,
                actualCost: item.amount,
                estimatedCost: item.amount,
                paidBy: item.paidBy,
                splitWith: item.splitWith,
                memberSplits: item.memberSplits,
                category: item.category,
                notes: item.note ?? act.notes,
              };
            }
            return act;
          }),
        }));
      }

      // 2. Tìm và đồng bộ hoặc cập nhật trong trip.expenses
      const existingExpenseIndex = trip.expenses.findIndex(
        (e) =>
          (item.expenseId && e.id === item.expenseId) ||
          (item.activityId && e.activityId === item.activityId) ||
          e.id === item.id
      );

      const determinedId =
        existingExpenseIndex >= 0
          ? trip.expenses[existingExpenseIndex].id
          : item.expenseId ||
            (item.activityId ? `exp-act-${item.activityId}` : item.id);

      const expensePayload: Expense = {
        id: determinedId,
        activityId: item.activityId,
        title: item.title,
        amount: item.amount,
        currency: item.currency || trip.currency || 'VND',
        category: item.category,
        paidBy: item.paidBy,
        splitWith: item.splitWith && item.splitWith.length > 0 ? item.splitWith : trip.members.map((m) => m.id),
        memberSplits: item.memberSplits,
        date: item.date || new Date().toISOString().split('T')[0],
        receiptNote: item.note,
      };

      if (existingExpenseIndex >= 0) {
        updatedExpenses[existingExpenseIndex] = {
          ...updatedExpenses[existingExpenseIndex],
          ...expensePayload,
        };
      } else {
        updatedExpenses = [expensePayload, ...updatedExpenses];
      }

      return {
        ...trip,
        days: updatedDays,
        expenses: updatedExpenses,
      };
    });
  };

  // 2b. Member & Fund Handlers
  const handleAddMember = (newMember: Omit<TripMember, 'id'>) => {
    updateActiveTrip((trip) => {
      const memberId = `m-${Date.now()}`;
      const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newMember.name || memberId)}`;
      const member: TripMember = {
        ...newMember,
        id: memberId,
        avatar: newMember.avatar || defaultAvatar,
        contributedAmount: Number(newMember.contributedAmount) || 0,
      };
      return {
        ...trip,
        members: [...trip.members, member],
        fundHolderId: trip.fundHolderId || memberId,
      };
    });
  };

  const handleUpdateMember = (memberId: string, data: Partial<TripMember>) => {
    updateActiveTrip((trip) => ({
      ...trip,
      members: trip.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              ...data,
              contributedAmount:
                data.contributedAmount !== undefined
                  ? Number(data.contributedAmount)
                  : m.contributedAmount,
            }
          : m
      ),
    }));
  };

  const handleDeleteMember = (memberId: string) => {
    updateActiveTrip((trip) => {
      if (trip.members.length <= 1) return trip;
      const updatedMembers = trip.members.filter((m) => m.id !== memberId);
      const fallbackMemberId = updatedMembers[0].id;
      const updatedExpenses = trip.expenses.map((exp) => {
        const nextPaidBy = exp.paidBy === memberId ? fallbackMemberId : exp.paidBy;
        let nextSplitWith = exp.splitWith.filter((id) => id !== memberId);
        if (nextSplitWith.length === 0) nextSplitWith = [fallbackMemberId];
        const nextMemberSplits = exp.memberSplits?.filter((ms) => ms.memberId !== memberId);
        return {
          ...exp,
          paidBy: nextPaidBy,
          splitWith: nextSplitWith,
          memberSplits: nextMemberSplits,
        };
      });
      return {
        ...trip,
        members: updatedMembers,
        expenses: updatedExpenses,
        fundHolderId: trip.fundHolderId === memberId ? fallbackMemberId : trip.fundHolderId,
      };
    });
  };

  const handleSetFundHolder = (memberId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      fundHolderId: memberId,
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
    updateActiveTrip((trip) => {
      const docId = `doc-${Date.now()}`;
      let updatedExpenses = trip.expenses;
      let finalExpenseId = newDoc.expenseId;

      if (newDoc.cost && newDoc.cost > 0) {
        finalExpenseId = finalExpenseId || `exp-doc-${Date.now()}`;
        const expCategory: CategoryType =
          newDoc.docType === 'Flight Ticket' || newDoc.docType === 'Bus Ticket'
            ? 'transport'
            : newDoc.docType === 'Hotel Voucher'
            ? 'stay'
            : 'other';

        const expenseItem: Expense = {
          id: finalExpenseId,
          title: newDoc.title,
          amount: newDoc.cost,
          currency: trip.currency || 'VND',
          category: expCategory,
          paidBy: newDoc.paidBy || trip.fundHolderId || trip.members[0]?.id || 'fund',
          splitWith:
            newDoc.splitWith && newDoc.splitWith.length > 0
              ? newDoc.splitWith
              : trip.members.map((m) => m.id),
          date: newDoc.date || new Date().toISOString().split('T')[0],
          receiptNote: `${newDoc.docType} (${newDoc.codeOrNumber || ''})`.trim(),
        };

        updatedExpenses = [expenseItem, ...trip.expenses];
      }

      return {
        ...trip,
        documents: [
          ...trip.documents,
          { ...newDoc, id: docId, expenseId: finalExpenseId },
        ],
        expenses: updatedExpenses,
      };
    });
  };

  const handleEditDocument = (docId: string, updatedFields: Partial<TravelDocument>) => {
    updateActiveTrip((trip) => {
      const existingDoc = trip.documents.find((d) => d.id === docId);
      if (!existingDoc) return trip;

      const mergedDoc: TravelDocument = {
        ...existingDoc,
        ...updatedFields,
      };

      let updatedExpenses = [...trip.expenses];
      const targetExpenseId = mergedDoc.expenseId || existingDoc.expenseId || `exp-doc-${docId}`;

      if (mergedDoc.cost && mergedDoc.cost > 0) {
        const expCategory: CategoryType =
          mergedDoc.docType === 'Flight Ticket' || mergedDoc.docType === 'Bus Ticket'
            ? 'transport'
            : mergedDoc.docType === 'Hotel Voucher'
            ? 'stay'
            : 'other';

        const expPayload: Expense = {
          id: targetExpenseId,
          title: mergedDoc.title,
          amount: mergedDoc.cost,
          currency: trip.currency || 'VND',
          category: expCategory,
          paidBy: mergedDoc.paidBy || trip.fundHolderId || trip.members[0]?.id || 'fund',
          splitWith:
            mergedDoc.splitWith && mergedDoc.splitWith.length > 0
              ? mergedDoc.splitWith
              : trip.members.map((m) => m.id),
          date: mergedDoc.date || new Date().toISOString().split('T')[0],
          receiptNote: `${mergedDoc.docType} (${mergedDoc.codeOrNumber || ''})`.trim(),
        };

        const existingExpIdx = updatedExpenses.findIndex((e) => e.id === targetExpenseId);
        if (existingExpIdx >= 0) {
          updatedExpenses[existingExpIdx] = expPayload;
        } else {
          updatedExpenses = [expPayload, ...updatedExpenses];
        }
        mergedDoc.expenseId = targetExpenseId;
      } else if (existingDoc.expenseId) {
        updatedExpenses = updatedExpenses.filter((e) => e.id !== existingDoc.expenseId);
        mergedDoc.expenseId = undefined;
      }

      return {
        ...trip,
        documents: trip.documents.map((d) => (d.id === docId ? mergedDoc : d)),
        expenses: updatedExpenses,
      };
    });
  };

  const handleDeleteDocument = (docId: string) => {
    updateActiveTrip((trip) => {
      const doc = trip.documents.find((d) => d.id === docId);
      const expenseId = doc?.expenseId;
      return {
        ...trip,
        documents: trip.documents.filter((d) => d.id !== docId),
        expenses: expenseId ? trip.expenses.filter((e) => e.id !== expenseId) : trip.expenses,
      };
    });
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

  // 6b. Check if active trip has any completed activities
  const hasCompletedActivities = React.useMemo(() => {
    return activeTrip.days.some((d) => d.activities.some((a) => a.isCompleted));
  }, [activeTrip]);

  // 6c. Update Active Trip Details (Title, dates, destination, budget, cover...)
  const handleUpdateTrip = (updatedFields: Partial<Trip> & { rearrangeAllDays?: boolean }) => {
    updateActiveTrip((t) => {
      const start = updatedFields.startDate || t.startDate;
      const end = updatedFields.endDate || t.endDate;

      let newDays = t.days;
      if (start && end) {
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = e.getTime() - s.getTime();
        const newDaysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
        const oldDaysCount = t.days.length;

        if (newDaysCount > oldDaysCount) {
          if (updatedFields.rearrangeAllDays) {
            // Collect all existing activities from all previous days
            const allActivities = t.days.flatMap((d) => d.activities);
            const actsPerDay = Math.ceil(allActivities.length / newDaysCount);

            newDays = Array.from({ length: newDaysCount }, (_, idx) => {
              const dayNum = idx + 1;
              const dateObj = new Date(s);
              dateObj.setDate(s.getDate() + idx);
              const dateStr = dateObj.toISOString().split('T')[0];

              const dayActs = actsPerDay > 0
                ? allActivities.slice(idx * actsPerDay, (idx + 1) * actsPerDay)
                : [];

              return {
                dayNumber: dayNum,
                date: dateStr,
                title: isVi ? `Ngày ${dayNum}` : `Day ${dayNum}`,
                summary: '',
                activities: dayActs,
              };
            });
          } else {
            // Keep days 1 to oldDaysCount as they are, append new days (oldDaysCount + 1 to newDaysCount)
            const addedDays = Array.from({ length: newDaysCount - oldDaysCount }, (_, idx) => {
              const dayNum = oldDaysCount + idx + 1;
              const dateObj = new Date(s);
              dateObj.setDate(s.getDate() + oldDaysCount + idx);
              const dateStr = dateObj.toISOString().split('T')[0];

              return {
                dayNumber: dayNum,
                date: dateStr,
                title: isVi ? `Ngày ${dayNum}` : `Day ${dayNum}`,
                summary: '',
                activities: [],
              };
            });
            newDays = [...t.days, ...addedDays];
          }
        }
      }

      const { rearrangeAllDays, ...fieldsToUpdate } = updatedFields;
      return {
        ...t,
        ...fieldsToUpdate,
        days: newDays,
      };
    });
  };

  // 6d. Delete Active Trip (Only allowed if no activities are completed, with confirm)
  const handleDeleteTrip = () => {
    if (hasCompletedActivities) {
      alert(
        isVi
          ? 'Không thể xóa chuyến đi vì đã có hoạt động được đánh dấu hoàn thành!'
          : 'Cannot delete trip because it has completed activities!'
      );
      return;
    }

    if (trips.length <= 1) {
      alert(
        isVi
          ? 'Không thể xóa chuyến đi duy nhất.'
          : 'Cannot delete the only remaining trip.'
      );
      return;
    }

    const confirmed = window.confirm(
      isVi
        ? `Bạn có chắc chắn muốn xóa chuyến đi "${activeTrip.title}" không? Hành động này không thể hoàn tác.`
        : `Are you sure you want to delete trip "${activeTrip.title}"? This action cannot be undone.`
    );

    if (confirmed) {
      const remaining = trips.filter((t) => t.id !== activeTrip.id);
      setTrips(remaining);
      setActiveTripId(remaining[0].id);
    }
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
    { id: 'itinerary', label: t('tab.itinerary'), icon: <Compass className="w-4 h-4" /> },
    { id: 'expenses', label: t('tab.expenses'), icon: <CreditCard className="w-4 h-4" /> },
    { id: 'map', label: t('tab.map'), icon: <MapIcon className="w-4 h-4" /> },
    { id: 'places', label: t('tab.places'), icon: <BookmarkCheck className="w-4 h-4" /> },
    { id: 'vault', label: t('tab.vault'), icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'packing', label: t('tab.packing'), icon: <CheckSquare className="w-4 h-4" /> },
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
        
        {/* Trip Header Banner with Cover Image as Background */}
        <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm group min-h-[160px] sm:min-h-[190px] flex flex-col justify-between p-3.5 sm:p-6 bg-slate-900">
          {/* Background Image */}
          {activeTrip.coverImage ? (
            <img
              src={activeTrip.coverImage}
              alt={activeTrip.title}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950" />
          )}

          {/* High-legibility scrim gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-slate-950/40" />

          {/* Top Bar inside Banner: Badges on left, Action buttons on right - Clean non-overlapping flex layout */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-2 sm:mb-3">
            {/* Country & Date Badge */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-teal-500/90 text-white border border-teal-400/40 shrink-0 backdrop-blur-xs">
                {activeTrip.country}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-200 font-medium shrink-0 drop-shadow-xs">
                {activeTrip.startDate} — {activeTrip.endDate}
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Change Photo Button */}
              <button
                onClick={() => setIsEditTripModalOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-black/40 hover:bg-black/60 text-white rounded-lg sm:rounded-xl text-xs font-semibold backdrop-blur-md border border-white/10 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                title={isVi ? 'Đổi ảnh' : 'Change photo'}
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{isVi ? 'Đổi ảnh' : 'Photo'}</span>
              </button>

              {/* Edit Trip Button */}
              <button
                onClick={() => setIsEditTripModalOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg sm:rounded-xl text-xs font-semibold backdrop-blur-md border border-white/20 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                title={isVi ? 'Sửa chuyến đi' : 'Edit Trip'}
              >
                <Edit3 className="w-3.5 h-3.5 text-white" />
                <span className="hidden md:inline">{isVi ? 'Sửa' : 'Edit'}</span>
              </button>

              {/* Delete Trip Button */}
              <button
                onClick={handleDeleteTrip}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl transition-all flex items-center gap-1 text-xs font-semibold backdrop-blur-md cursor-pointer shadow-sm ${
                  hasCompletedActivities
                    ? 'bg-black/30 text-white/40 border border-white/10 cursor-not-allowed opacity-60'
                    : 'bg-rose-500/80 hover:bg-rose-600 text-white border border-rose-400/30'
                }`}
                title={
                  hasCompletedActivities
                    ? (isVi ? 'Chỉ được xóa chuyến đi nếu chưa có hoạt động nào hoàn thành' : 'Cannot delete: has completed activities')
                    : (isVi ? 'Xóa chuyến đi' : 'Delete Trip')
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{isVi ? 'Xóa' : 'Delete'}</span>
              </button>

              {/* AI Action Icon */}
              <button
                onClick={() => setIsAIModalOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-teal-500 hover:bg-teal-600 text-white border border-teal-400/40 rounded-lg sm:rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm group/ai"
                title={isVi ? 'Tùy chỉnh với AI' : 'Customize with AI'}
              >
                <Sparkles className="w-3.5 h-3.5 text-white group-hover/ai:rotate-12 transition-transform" />
                <span className="text-[11px] font-extrabold tracking-wide uppercase text-white hidden xs:inline">AI</span>
              </button>
            </div>
          </div>

          {/* Bottom section of Banner: Trip title & details */}
          <div className="relative z-10 min-w-0 max-w-full">
            {/* Trip title - 1 line with ellipsis when too long */}
            <h1
              className="font-display font-extrabold text-lg sm:text-2xl lg:text-3xl text-white tracking-tight truncate max-w-full drop-shadow-md"
              title={activeTrip.title}
            >
              {activeTrip.title}
            </h1>

            {/* Sub-details: Destination, Budget, Weather */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs text-slate-200 mt-1.5 drop-shadow-xs font-medium">
              <span className="flex items-center gap-1 text-white font-semibold">
                <MapPin className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                {activeTrip.destination}
              </span>
              <span className="text-white/40">•</span>
              <span className="flex items-center gap-0.5 font-bold text-emerald-300">
                <span className="text-xs">$</span>
                <span>{formatMoney(activeTrip.budgetTotal, activeTrip.currency, lang)}</span>
              </span>
              {activeTrip.weatherForecast && (
                <>
                  <span className="text-white/40">•</span>
                  <span className="flex items-center gap-1 text-slate-100">
                    <span>{activeTrip.weatherForecast.icon}</span>
                    <span>{activeTrip.weatherForecast.avgTempC}°C, {activeTrip.weatherForecast.condition}</span>
                  </span>
                </>
              )}
            </div>
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
              onAddExpense={handleAddExpense}
              onSaveActivityExpense={handleSaveActivityExpense}
              onNavigateToExpenses={() => setActiveTab('expenses')}
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
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onSetFundHolder={handleSetFundHolder}
              onUpdateExpense={handleUpdateExpense}
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
              onEditDocument={handleEditDocument}
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

      {/* Edit Trip Modal */}
      <EditTripModal
        isOpen={isEditTripModalOpen}
        onClose={() => setIsEditTripModalOpen(false)}
        trip={activeTrip}
        onUpdateTrip={handleUpdateTrip}
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
