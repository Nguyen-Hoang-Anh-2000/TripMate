import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SAMPLE_TRIPS } from './data/sampleTrips';
import { Trip, ActivityItem, Expense, PackingItem, TravelDocument, SavedPlace, TripMember, CategoryType } from './types';
import { INITIAL_SAVED_PLACES } from './data/savedPlacesData';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { TravelHandbookModal } from './components/TravelHandbookModal';
import { AuthModal } from './components/AuthModal';
import { NotificationsModal } from './components/NotificationsModal';
import { AuthScreen } from './components/AuthScreen';
import { formatMoney } from './utils/formatCurrency';
import { getLocalDateString } from './utils/dateUtils';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, stripUndefinedDeep, handleFirestoreError, OperationType } from './firebase';
import { computeTripDeletionSummary, buildTripDeletionNotifications } from './utils/tripSettlementUtils';
import { buildDefaultAvatar, syncUserAvatarIntoTrips } from './utils/avatarSyncUtils';
import { filterTripsForUser, getUserTripsCacheKey } from './utils/tripAccessUtils';
import { sanitizeTripLegacyTypos } from './utils/packingSanitizerUtils';

import { 
  Calendar, MapPin, DollarSign, CloudSun, Users, Compass, 
  Map as MapIcon, BookmarkCheck, CreditCard, CheckSquare, ShieldCheck, Sparkles, Plus, Share2,
  Edit3, Trash2, Camera, Printer, Wifi, WifiOff, MoreHorizontal, ChevronRight, X,
  Wallet, Receipt
} from 'lucide-react';
import { RealtimeWeatherBadge } from './components/RealtimeWeatherBadge';

type TabType = 'itinerary' | 'expenses' | 'map' | 'places' | 'vault' | 'packing';

function AppContent() {
  const { lang, t, isVi } = useLanguage();
  const { 
    currentUser,
    userProfile, 
    isLoading,
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    isNotificationsModalOpen, 
    setIsNotificationsModalOpen 
  } = useAuth();

  const getDeletedTripIdsSet = (): Set<string> => {
    try {
      const raw = localStorage.getItem('tripmate_deleted_trip_ids');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
    } catch {
      return new Set<string>();
    }
  };

  const deletedTripIdsRef = React.useRef<Set<string>>(getDeletedTripIdsSet());

  const loadCachedTripsForUser = (
    targetUser: typeof userProfile,
    deletedIds: Set<string> = deletedTripIdsRef.current
  ): Trip[] => {
    const cacheKey = getUserTripsCacheKey(targetUser?.id);
    if (!targetUser || !cacheKey) return [];
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          let cacheChanged = false;
          const sanitizedList = parsed
            .filter((t: Trip) => t && t.id && !deletedIds.has(t.id))
            .map((t: Trip) => {
              const res = sanitizeTripLegacyTypos(t);
              if (res.changed) cacheChanged = true;
              return res.trip;
            });
          if (cacheChanged) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(sanitizedList));
            } catch {}
          }
          return filterTripsForUser(sanitizedList, targetUser);
        }
      }
    } catch (e) {
      console.warn('Failed parsing cached user trips:', e);
    }
    return [];
  };

  const saveCachedTripsForUser = (userId: string | undefined | null, nextTrips: Trip[]) => {
    const cacheKey = getUserTripsCacheKey(userId);
    if (!cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(nextTrips));
    } catch (e) {
      console.warn('Error saving trips to localStorage:', e);
    }
  };

  const [trips, setTrips] = useState<Trip[]>(() => loadCachedTripsForUser(userProfile));
  const [activeTripId, setActiveTripId] = useState<string>(() => {
    const initial = loadCachedTripsForUser(userProfile);
    return initial[0]?.id || '';
  });
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(INITIAL_SAVED_PLACES);

  // Modals & Panels
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiTargetTrip, setAiTargetTrip] = useState<Trip | null>(null);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isAiPackingLoading, setIsAiPackingLoading] = useState(false);
  const [isHandbookModalOpen, setIsHandbookModalOpen] = useState(false);
  const [isTripActionMenuOpen, setIsTripActionMenuOpen] = useState(false);
  const [isDesktopTripMenuOpen, setIsDesktopTripMenuOpen] = useState(false);
  const desktopTripMenuRef = React.useRef<HTMLDivElement>(null);
  const [isDeleteTripConfirmOpen, setIsDeleteTripConfirmOpen] = useState(false);
  const [tripPendingDelete, setTripPendingDelete] = useState<Trip | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);
  const [confirmExpenseSettlementAck, setConfirmExpenseSettlementAck] = useState(false);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showOnlineToast, setShowOnlineToast] = useState<boolean>(false);

  useEffect(() => {
    const handleOutsideMenu = (e: MouseEvent) => {
      if (desktopTripMenuRef.current && !desktopTripMenuRef.current.contains(e.target as Node)) {
        setIsDesktopTripMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideMenu);
    return () => document.removeEventListener('mousedown', handleOutsideMenu);
  }, []);
  const [invitationToast, setInvitationToast] = useState<string | null>(null);
  const [isQuickAddFabOpen, setIsQuickAddFabOpen] = useState(false);
  const [quickAddActivitySeq, setQuickAddActivitySeq] = useState(0);
  const [expenseQuickAction, setExpenseQuickAction] = useState<{ type: 'add-expense' | 'scan-receipt'; seq: number } | null>(null);

  const showAppNotice = (msg: string) => {
    setAppNotice(msg);
    setTimeout(() => setAppNotice(null), 4000);
  };

  // Clear & re-hydrate per-user trips immediately when authenticated user switches accounts
  useEffect(() => {
    try {
      localStorage.removeItem('tripmate_trips');
    } catch {}
    if (!userProfile?.id) {
      setTrips([]);
      setActiveTripId('');
      return;
    }
    const cachedForUser = loadCachedTripsForUser(userProfile, deletedTripIdsRef.current);
    setTrips(cachedForUser);
    setActiveTripId((prev) =>
      cachedForUser.some((t) => t.id === prev) ? prev : (cachedForUser[0]?.id || '')
    );
  }, [userProfile?.id]);

  // 1. Real-time synchronization of trips with Firestore (strictly filtered to current user's accessible trips)
  useEffect(() => {
    if (!userProfile) return;
    let isCancelled = false;
    try {
      const tripsCol = collection(db, 'trips');
      const unsub = onSnapshot(
        tripsCol,
        async (snapshot) => {
          if (isCancelled) return;
          if (snapshot.empty) {
            const alreadySeeded = localStorage.getItem('tripmate_firestore_seeded') === '1';
            if (!alreadySeeded && deletedTripIdsRef.current.size === 0) {
              localStorage.setItem('tripmate_firestore_seeded', '1');
              // Seed initial sample trips into Firestore once so they are shared and persistent
              for (const st of SAMPLE_TRIPS) {
                try {
                  const seedTrip = stripUndefinedDeep({ ...st, creatorId: st.creatorId || 'm1' });
                  await setDoc(doc(db, 'trips', st.id), seedTrip, { merge: true });
                } catch (seedErr) {
                  handleFirestoreError(seedErr, OperationType.WRITE, `trips/${st.id}`);
                }
              }
            }
            setTrips([]);
            saveCachedTripsForUser(userProfile.id, []);
          } else {
            try {
              localStorage.setItem('tripmate_firestore_seeded', '1');
            } catch {}

            const seenIds = new Set<string>();
            const remoteTrips: Trip[] = [];
            const tripsNeedingTypoCleanup: Trip[] = [];
            snapshot.forEach((d) => {
              // Never resurrect trips deleted by the user in this session / cached tombstones
              if (!deletedTripIdsRef.current.has(d.id) && !seenIds.has(d.id)) {
                seenIds.add(d.id);
                const rawRemote: Trip = { id: d.id, ...(d.data() as Omit<Trip, 'id'>) };
                const { trip: sanitizedRemote, changed } = sanitizeTripLegacyTypos(rawRemote);
                remoteTrips.push(sanitizedRemote);
                if (changed) {
                  tripsNeedingTypoCleanup.push(sanitizedRemote);
                }
              }
            });

            if (tripsNeedingTypoCleanup.length > 0) {
              tripsNeedingTypoCleanup.forEach((cleanTrip) => {
                setDoc(doc(db, 'trips', cleanTrip.id), stripUndefinedDeep(cleanTrip), { merge: true }).catch(() => {});
              });
            }

            const accessibleRemoteTrips = filterTripsForUser(remoteTrips, userProfile);

            setTrips((prevTrips) => {
              // Keep any brand-new local trips owned/joined by current user that haven't synced to snapshot yet
              const remoteIds = new Set(remoteTrips.map((r) => r.id));
              const pendingLocalTrips = filterTripsForUser(
                prevTrips.filter(
                  (lt) =>
                    !remoteIds.has(lt.id) &&
                    !deletedTripIdsRef.current.has(lt.id) &&
                    lt.id.startsWith('trip-') &&
                    !SAMPLE_TRIPS.some((s) => s.id === lt.id)
                ),
                userProfile
              );
              const mergedRaw = [...pendingLocalTrips, ...accessibleRemoteTrips];
              const mergedTrips = userProfile.avatar
                ? syncUserAvatarIntoTrips(mergedRaw, userProfile).nextTrips
                : mergedRaw;
              saveCachedTripsForUser(userProfile.id, mergedTrips);
              return mergedTrips;
            });
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'trips');
        }
      );
      return () => {
        isCancelled = true;
        unsub();
      };
    } catch (err) {
      console.warn('Trips collection listener setup error:', err);
    }
  }, [userProfile?.id, userProfile?.email, userProfile?.phone, currentUser?.uid]);

  // Listen to in-app invitation acceptance
  useEffect(() => {
    const handleInvitationResponded = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { tripId, accept, userProfile: responderProfile, invitationId, updatedTrip: remoteAcceptedTrip } = detail;

      if (accept && responderProfile) {
        setTrips((prevTrips) => {
          const existsInPrev = prevTrips.some((t) => t.id === tripId);
          let nextTrips: Trip[];
          if (existsInPrev) {
            nextTrips = prevTrips.map((t) => {
              if (t.id === tripId) {
                const existingIdx = t.members.findIndex(
                  (m) =>
                    (invitationId && m.invitationId === invitationId) ||
                    (m.uid && m.uid === responderProfile.id) ||
                    (m.email && m.email.toLowerCase() === responderProfile.email.toLowerCase()) ||
                    (responderProfile.phone && m.phone === responderProfile.phone)
                );

                let updatedMembers = [...t.members];
                if (existingIdx >= 0) {
                  updatedMembers[existingIdx] = {
                    ...updatedMembers[existingIdx],
                    uid: responderProfile.id,
                    name: responderProfile.displayName,
                    avatar: responderProfile.avatar || updatedMembers[existingIdx].avatar,
                    email: responderProfile.email,
                    phone: responderProfile.phone,
                    isRegistered: true,
                    invitationStatus: 'accepted',
                  };
                } else {
                  updatedMembers.push({
                    id: `m-${responderProfile.id}`,
                    name: responderProfile.displayName,
                    avatar: responderProfile.avatar,
                    email: responderProfile.email,
                    phone: responderProfile.phone,
                    uid: responderProfile.id,
                    isRegistered: true,
                    invitationStatus: 'accepted',
                    contributedAmount: 0,
                  });
                }

                const memberUids = Array.from(new Set([...(t.memberUids || []), responderProfile.id]));
                const updatedTrip = {
                  ...t,
                  members: updatedMembers,
                  memberUids,
                };

                // Persist to Firestore
                setDoc(doc(db, 'trips', updatedTrip.id), stripUndefinedDeep(updatedTrip), { merge: true }).catch((err) =>
                  handleFirestoreError(err, OperationType.WRITE, `trips/${updatedTrip.id}`)
                );

                return updatedTrip;
              }
              return t;
            });
          } else if (remoteAcceptedTrip && remoteAcceptedTrip.id === tripId) {
            nextTrips = [remoteAcceptedTrip as Trip, ...prevTrips];
          } else {
            nextTrips = prevTrips;
          }

          saveCachedTripsForUser(responderProfile.id, nextTrips);
          return nextTrips;
        });

        // Switch to the accepted trip so the user can immediately explore all information
        setActiveTripId(tripId);
        setInvitationToast(
          isVi
            ? `🎉 Bạn đã chính thức tham gia chuyến đi! Đã mở toàn bộ lịch trình, chi tiêu và bản đồ.`
            : `🎉 You have officially joined the trip! Full itinerary, expenses and map unlocked.`
        );
        setTimeout(() => setInvitationToast(null), 5000);
      }
    };

    window.addEventListener('tripmate_invitation_responded', handleInvitationResponded);
    return () => {
      window.removeEventListener('tripmate_invitation_responded', handleInvitationResponded);
    };
  }, [isVi]);

  // Synchronize current user's avatar across matching trip members & persist to Firestore
  useEffect(() => {
    const syncTripsWithUser = (profileSnapshot?: typeof userProfile) => {
      const targetUser = profileSnapshot || userProfile;
      if (!targetUser || !targetUser.avatar) return;
      setTrips((prevTrips) => {
        const { nextTrips, changedTripIds } = syncUserAvatarIntoTrips(prevTrips, targetUser);
        if (changedTripIds.length === 0) return prevTrips;
        saveCachedTripsForUser(targetUser.id, nextTrips);
        changedTripIds.forEach((cid) => {
          const updatedTrip = nextTrips.find((t) => t.id === cid);
          if (updatedTrip) {
            persistTripToFirestore(updatedTrip);
          }
        });
        return nextTrips;
      });
    };

    syncTripsWithUser(userProfile);

    const handleAvatarUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.userProfile) {
        syncTripsWithUser(detail.userProfile);
      } else if (userProfile && detail?.avatar) {
        syncTripsWithUser({ ...userProfile, avatar: detail.avatar });
      }
    };

    window.addEventListener('tripmate_user_avatar_updated', handleAvatarUpdated);
    return () => {
      window.removeEventListener('tripmate_user_avatar_updated', handleAvatarUpdated);
    };
  }, [userProfile?.id, userProfile?.avatar]);

  useEffect(() => {
    let isCancelled = false;

    const probeServerConnectivity = async (): Promise<boolean> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Active server check on mount fixes false-offline navigator.onLine in iframes/webviews
    probeServerConnectivity().then((reachable) => {
      if (!isCancelled) {
        setIsOnline(reachable || navigator.onLine);
      }
    });

    const handleOnline = async () => {
      const reachable = await probeServerConnectivity();
      if (!isCancelled && (reachable || navigator.onLine)) {
        setIsOnline(true);
        setShowOnlineToast(true);
        setTimeout(() => setShowOnlineToast(false), 3500);
      }
    };

    const handleOffline = async () => {
      // Double-check against server before showing offline banner (avoids false positives)
      const reachable = await probeServerConnectivity();
      if (!isCancelled) {
        setIsOnline(reachable);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isCancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keep activeTripId valid whenever trips list updates (e.g., after delete or remote sync)
  useEffect(() => {
    if (trips.length === 0) {
      if (activeTripId !== '') {
        setActiveTripId('');
      }
      return;
    }
    if (!trips.some((t) => t.id === activeTripId)) {
      setActiveTripId(trips[0].id);
    }
  }, [trips, activeTripId]);

  // Active Trip reference
  const activeTrip: Trip | undefined = trips.find((t) => t.id === activeTripId) || trips[0];

  // Safe Firestore trip persistence helper (never resurrect deleted trips)
  const persistTripToFirestore = (tripData: Trip) => {
    if (!tripData?.id || deletedTripIdsRef.current.has(tripData.id)) {
      return;
    }
    try {
      const normalizedTrip = {
        ...tripData,
        creatorId: tripData.creatorId || userProfile?.id || 'm1',
      };
      const sanitized = stripUndefinedDeep(normalizedTrip);
      setDoc(doc(db, 'trips', sanitized.id), sanitized, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `trips/${sanitized.id}`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `trips/${tripData.id}`);
    }
  };

  // Helper to update active trip & persist to Firestore
  const updateActiveTrip = (updater: (prevTrip: Trip) => Trip) => {
    if (!activeTrip) return;
    const targetTripId = activeTrip.id;
    setTrips((prevTrips) => {
      const nextTrips = prevTrips.map((t) => {
        if (t.id === targetTripId) {
          const updated = updater(t);
          // Persist to Firestore asynchronously (stripped of undefined)
          persistTripToFirestore(updated);
          return updated;
        }
        return t;
      });
      saveCachedTripsForUser(userProfile?.id, nextTrips);
      return nextTrips;
    });
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
      receiptImageUrl?: string;
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
                  receiptImageUrl: 'receiptImageUrl' in data ? data.receiptImageUrl : a.receiptImageUrl,
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
          date: getLocalDateString(),
          receiptNote: `${lang === 'vi' ? 'Chi tiêu tự động từ hoạt động:' : 'Auto-recorded from activity:'} ${targetActivity.title} (${lang === 'vi' ? `Ngày ${targetDayNum}` : `Day ${targetDayNum}`})`,
          receiptImageUrl: 'receiptImageUrl' in data ? data.receiptImageUrl : targetActivity.receiptImageUrl,
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
    receiptImageUrl?: string;
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
        date: item.date || getLocalDateString(),
        receiptNote: item.note,
        receiptImageUrl: item.receiptImageUrl,
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
      const defaultAvatar = buildDefaultAvatar(newMember.name || memberId);
      const member: TripMember = {
        ...newMember,
        id: memberId,
        avatar: newMember.avatar || defaultAvatar,
        contributedAmount: Number(newMember.contributedAmount) || 0,
      };
      const shouldAddUid =
        Boolean(newMember.uid) &&
        newMember.invitationStatus !== 'pending' &&
        newMember.invitationStatus !== 'declined';
      const nextMemberUids = shouldAddUid && newMember.uid
        ? Array.from(new Set([...(trip.memberUids || []), newMember.uid]))
        : trip.memberUids;
      return {
        ...trip,
        members: [...trip.members, member],
        ...(nextMemberUids ? { memberUids: nextMemberUids } : {}),
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
      const deletedMember = trip.members.find((m) => m.id === memberId);
      const hasPaidExpense = trip.expenses.some((e) => e.paidBy === memberId);
      const hasPaidActivity = trip.days.some((d) =>
        d.activities.some((a) => a.isCompleted && a.paidBy === memberId)
      );
      const hasContribution = (deletedMember?.contributedAmount || 0) > 0;
      if (hasPaidExpense || hasPaidActivity || hasContribution) {
        return trip;
      }
      const updatedMembers = trip.members.filter((m) => m.id !== memberId);
      const fallbackMemberId = updatedMembers[0].id;
      const nextMemberUids = Array.isArray(trip.memberUids)
        ? trip.memberUids.filter((uid) => !deletedMember?.uid || uid !== deletedMember.uid)
        : trip.memberUids;
      const updatedExpenses = trip.expenses.map((exp) => {
        const nextPaidBy = exp.paidBy === memberId ? fallbackMemberId : exp.paidBy;
        let nextSplitWith = exp.splitWith.filter((id) => id !== memberId);
        if (nextSplitWith.length === 0) nextSplitWith = [fallbackMemberId];

        // Recalculate member splits evenly across the remaining split participants to preserve total
        let nextMemberSplits = exp.memberSplits;
        if (exp.memberSplits && exp.memberSplits.length > 0) {
          const equalAmount = Math.round((exp.amount / nextSplitWith.length) * 100) / 100;
          nextMemberSplits = nextSplitWith.map((id) => ({
            memberId: id,
            amount: equalAmount,
          }));
        }

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
        ...(nextMemberUids ? { memberUids: nextMemberUids } : {}),
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

  const handleEditPackingItem = (itemId: string, updated: Partial<PackingItem>) => {
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: trip.packingList.map((i) =>
        i.id === itemId ? { ...i, ...updated } : i
      ),
    }));
  };

  const handleDeletePackingItem = (itemId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: trip.packingList.filter((i) => i.id !== itemId),
    }));
  };

  const handleGenerateAiPackingList = async () => {
    if (!activeTrip) return;
    setIsAiPackingLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('/api/gemini/packing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          destination: activeTrip.destination,
          season: activeTrip.weatherForecast?.condition || 'pleasant',
          durationDays: activeTrip.days.length,
          language: lang,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate packing items.');

      const data = await res.json();
      if (data.packingItems && Array.isArray(data.packingItems) && data.packingItems.length > 0) {
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
        return;
      }
      throw new Error('Empty packing list response.');
    } catch (err) {
      console.warn('Packing list AI timeout/fallback activated:', err);
      const dest = activeTrip.destination || '';
      const isCold = /đà lạt|da lat|sapa|sa pa|hà giang|ha giang|tam đảo|snow|japan|tokyo|korea|seoul|europe|iceland/i.test(dest);
      const isBeach = /vũng tàu|vung tau|phú quốc|phu quoc|nha trang|đà nẵng|da nang|quy nhơn|phan thiết|phuket|bali|beach/i.test(dest);
      const now = Date.now();

      const fallbackItems: PackingItem[] = [
        { id: `ai-p-${now}-1`, category: 'Essentials', name: isVi ? 'Căn cước công dân / Hộ chiếu' : 'ID / Passport', quantity: 1, isPacked: false },
        { id: `ai-p-${now}-2`, category: 'Electronics', name: isVi ? 'Sạc dự phòng 20.000mAh & cáp sạc nhanh' : 'Power bank 20,000mAh & fast charger', quantity: 1, isPacked: false },
        { id: `ai-p-${now}-3`, category: 'Toiletries', name: isVi ? 'Bộ vệ sinh cá nhân du lịch' : 'Travel toiletries kit', quantity: 1, isPacked: false },
        { id: `ai-p-${now}-4`, category: 'Essentials', name: isVi ? 'Thuốc cá nhân (cảm sốt, tiêu hóa, băng dán)' : 'Personal first-aid & motion medicine', quantity: 1, isPacked: false },
        ...(isCold
          ? [
              { id: `ai-p-${now}-5`, category: 'Clothing', name: isVi ? 'Áo len / Hoodie ấm giữ nhiệt' : 'Warm knit sweater / Hoodie', quantity: 2, isPacked: false },
              { id: `ai-p-${now}-6`, category: 'Clothing', name: isVi ? 'Áo khoác gió chống sương đêm' : 'Windbreaker jacket for cool nights', quantity: 1, isPacked: false },
              { id: `ai-p-${now}-7`, category: 'Gear', name: isVi ? 'Khăn choàng cổ & tất ấm' : 'Warm scarf & socks', quantity: 1, isPacked: false },
              { id: `ai-p-${now}-8`, category: 'Toiletries', name: isVi ? 'Son dưỡng môi & kem dưỡng ẩm' : 'Lip balm & moisturizer', quantity: 1, isPacked: false },
            ]
          : isBeach
          ? [
              { id: `ai-p-${now}-5`, category: 'Clothing', name: isVi ? 'Đồ bơi & áo choàng đi biển' : 'Swimwear & beach cover-up', quantity: 2, isPacked: false },
              { id: `ai-p-${now}-6`, category: 'Toiletries', name: isVi ? 'Kem chống nắng SPF 50+ & kính râm' : 'SPF 50+ sunscreen & sunglasses', quantity: 1, isPacked: false },
              { id: `ai-p-${now}-7`, category: 'Gear', name: isVi ? 'Sandal đi biển & túi chống nước điện thoại' : 'Beach sandals & waterproof phone pouch', quantity: 1, isPacked: false },
            ]
          : [
              { id: `ai-p-${now}-5`, category: 'Clothing', name: isVi ? 'Áo khoác mỏng chống nắng gió' : 'Light versatile jacket', quantity: 1, isPacked: false },
              { id: `ai-p-${now}-6`, category: 'Gear', name: isVi ? 'Ô / Dù gấp gọn che mưa nắng' : 'Compact travel umbrella', quantity: 1, isPacked: false },
            ]),
      ];
      updateActiveTrip((trip) => ({
        ...trip,
        packingList: [...trip.packingList, ...fallbackItems],
      }));
    } finally {
      clearTimeout(timeoutId);
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
          date: newDoc.date || getLocalDateString(),
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
          date: mergedDoc.date || getLocalDateString(),
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

  // 5. Apply AI Generated Itinerary & Selected Tabs Data
  const handleApplyGeneratedItinerary = (generatedData: any) => {
    if (!generatedData) return;

    const targetId = generatedData.targetTripId || activeTrip?.id;
    if (!targetId) return;
    const selectedTabs: string[] = generatedData.selectedTabs || ['itinerary'];

    setTrips((prevTrips) => {
      const nextTrips = prevTrips.map((trip) => {
        if (trip.id !== targetId) return trip;

        let updatedTrip = { ...trip };

        // 1. Apply Itinerary Days
        if (selectedTabs.includes('itinerary') && generatedData.days && Array.isArray(generatedData.days)) {
          const s = trip.startDate ? new Date(trip.startDate) : new Date();
          const newDays = generatedData.days.map((d: any, idx: number) => {
            const dayNum = d.dayNumber || idx + 1;
            const dateObj = new Date(s);
            dateObj.setDate(s.getDate() + idx);
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            const formattedDate = `${dd}/${mm}/${yyyy}`;

            const rawTitle = (d.title || '').trim();
            const strippedTitle = rawTitle.replace(/^(ngày|day)\s*\d+[\s:–-]*/i, '').trim();
            const dayPrefix = isVi ? `Ngày ${dayNum}` : `Day ${dayNum}`;
            const finalTitle = strippedTitle && strippedTitle.toLowerCase() !== dayPrefix.toLowerCase()
              ? `${dayPrefix}: ${strippedTitle}`
              : dayPrefix;

            return {
              dayNumber: dayNum,
              date: isVi ? `Ngày ${dayNum} - ${formattedDate}` : `Day ${dayNum} - ${formattedDate}`,
              title: finalTitle,
              summary: '',
              activities: (d.activities || []).map((a: any, actIdx: number) => ({
                id: `ai-act-${Date.now()}-${dayNum}-${actIdx}`,
                time: a.time || '10:00 AM',
                title: a.title,
                locationName: a.locationName || trip.destination,
                category: (a.category as any) || 'sightseeing',
                estimatedCost: a.estimatedCost || 0,
                currency: a.currency || trip.currency,
                notes: a.notes || '',
                isCompleted: false,
                ...(typeof a.rating === 'number' ? { rating: a.rating } : {}),
                ...(typeof a.isFromSavedPlaces === 'boolean' ? { isFromSavedPlaces: a.isFromSavedPlaces } : {}),
                ...(typeof a.lat === 'number' ? { lat: a.lat } : {}),
                ...(typeof a.lng === 'number' ? { lng: a.lng } : {}),
              })),
            };
          });

          updatedTrip.days = newDays;
        }

        // 2. Apply Packing List
        if (selectedTabs.includes('packing') && generatedData.packingItems && Array.isArray(generatedData.packingItems)) {
          const newItems: PackingItem[] = generatedData.packingItems.map((item: any, idx: number) => ({
            id: `p-gen-${Date.now()}-${idx}`,
            category: item.category || 'Essentials',
            name: item.name,
            quantity: item.quantity || 1,
            isPacked: false,
          }));
          const existingNames = new Set(updatedTrip.packingList.map((i) => i.name.toLowerCase()));
          const filteredNew = newItems.filter((i) => !existingNames.has(i.name.toLowerCase()));
          updatedTrip.packingList = [...updatedTrip.packingList, ...filteredNew];
        }

        // 3. Apply Sample Expenses
        if (selectedTabs.includes('expenses') && generatedData.expenses && Array.isArray(generatedData.expenses)) {
          let members = [...updatedTrip.members];
          if (members.length === 0) {
            members = [
              {
                id: 'm1',
                ...(userProfile?.id ? { uid: userProfile.id } : {}),
                name: userProfile?.displayName || (isVi ? 'Bạn (Trưởng nhóm)' : 'Alex Rivera (You)'),
                ...(userProfile?.email ? { email: userProfile.email } : {}),
                ...(userProfile?.phone ? { phone: userProfile.phone } : {}),
                avatar: userProfile?.avatar || buildDefaultAvatar(userProfile?.displayName || 'TripMate'),
                ...(userProfile?.id ? { isRegistered: true } : {}),
              },
            ];
            updatedTrip.members = members;
            updatedTrip.fundHolderId = 'm1';
          }

          const defaultPayer = members[0].id;
          const allMemberIds = members.map((m) => m.id);

          const newExpenses: Expense[] = generatedData.expenses.map((exp: any, idx: number) => ({
            id: `exp-gen-${Date.now()}-${idx}`,
            title: exp.title,
            amount: exp.amount,
            currency: exp.currency || updatedTrip.currency || 'USD',
            category: exp.category || 'other',
            paidBy: exp.paidBy || defaultPayer,
            splitWith: exp.splitWith && exp.splitWith.length > 0 ? exp.splitWith : allMemberIds,
            date: exp.date || updatedTrip.startDate || getLocalDateString(),
            receiptNote: exp.receiptNote || (isVi ? 'Dự toán chi tiêu gợi ý từ AI' : 'Suggested expense estimate from AI'),
          }));

          updatedTrip.expenses = [...newExpenses, ...updatedTrip.expenses];
        }

        // 4. Apply Travel Documents
        if (selectedTabs.includes('vault') && generatedData.documents && Array.isArray(generatedData.documents)) {
          const newDocs: TravelDocument[] = generatedData.documents.map((doc: any, idx: number) => ({
            id: `doc-gen-${Date.now()}-${idx}`,
            title: doc.title,
            docType: doc.docType || 'Other',
            codeOrNumber: doc.codeOrNumber || '',
            date: doc.date || updatedTrip.startDate,
            cost: doc.cost,
            notes: doc.notes || '',
            urlOrFilename: doc.urlOrFilename,
          }));

          updatedTrip.documents = [...newDocs, ...updatedTrip.documents];
        }

        if (generatedData.destinationTitle && (!updatedTrip.title || updatedTrip.title.startsWith('Chuyến đi'))) {
          updatedTrip.title = generatedData.destinationTitle;
        }

        const sanitizedUpdated = stripUndefinedDeep(updatedTrip);
        persistTripToFirestore(sanitizedUpdated);
        return sanitizedUpdated;
      });
      saveCachedTripsForUser(userProfile?.id, nextTrips);
      return nextTrips;
    });

    // 5. Apply Saved Places (Global state, sorted highest rating first)
    if (selectedTabs.includes('places') && generatedData.savedPlaces && Array.isArray(generatedData.savedPlaces)) {
      setSavedPlaces((prevPlaces) => {
        const existingKeys = new Set(prevPlaces.map((p) => `${p.name.toLowerCase().trim()}_${p.cityName.toLowerCase().trim()}`));
        const newPlaces: SavedPlace[] = generatedData.savedPlaces
          .filter((p: any) => !existingKeys.has(`${(p.name || '').toLowerCase().trim()}_${(p.cityName || activeTrip?.destination || '').toLowerCase().trim()}`))
          .map((p: any, idx: number) => ({
            id: `place-gen-${Date.now()}-${idx}`,
            cityName: p.cityName || activeTrip?.destination || '',
            name: p.name,
            category: p.category || 'sightseeing',
            address: p.address || '',
            estimatedCost: p.estimatedCost,
            currency: p.currency || activeTrip?.currency || 'USD',
            rating: p.rating || 4.8,
            notes: p.notes || '',
            source: p.source || (isVi ? 'AI gợi ý sao cao' : 'AI Top Rated'),
            openTime: p.openTime,
            closeTime: p.closeTime,
            createdAt: new Date().toISOString(),
          }))
          .sort((a: SavedPlace, b: SavedPlace) => (b.rating || 0) - (a.rating || 0));
        return [...newPlaces, ...prevPlaces];
      });
    }
  };

  // 6. Create New Trip
  const handleCreateTrip = (newTrip: Trip, openAiArchitect: boolean = false) => {
    const tripToSave: Trip = stripUndefinedDeep({
      ...newTrip,
      creatorId: userProfile?.id || newTrip.creatorId || 'guest',
      ...(userProfile?.displayName || newTrip.creatorName
        ? { creatorName: userProfile?.displayName || newTrip.creatorName }
        : {}),
      memberUids: Array.from(new Set([...(newTrip.memberUids || []), ...(userProfile?.id ? [userProfile.id] : [])])),
    });

    setTrips((prev) => {
      const next = [tripToSave, ...prev];
      saveCachedTripsForUser(userProfile?.id, next);
      return next;
    });

    // Save to Firestore safely (stripped of undefined)
    persistTripToFirestore(tripToSave);

    // Send Firestore invitations for any registered members selected in NewTripModal
    const pendingInviteMembers = (tripToSave.members || []).filter(
      (m) => m.invitationStatus === 'pending' && m.invitationId && (m.uid || m.email || m.phone)
    );
    if (pendingInviteMembers.length > 0) {
      pendingInviteMembers.forEach((member) => {
        const invId = member.invitationId!;
        const invPayload = stripUndefinedDeep({
          tripId: tripToSave.id,
          tripTitle: tripToSave.title,
          tripDestination: tripToSave.destination,
          tripDates: `${tripToSave.startDate} - ${tripToSave.endDate}`,
          inviterId: tripToSave.creatorId || userProfile?.id || 'creator',
          inviterName:
            tripToSave.creatorName ||
            userProfile?.displayName ||
            (isVi ? 'Trưởng đoàn' : 'Trip Leader'),
          inviteeEmail: member.email,
          inviteePhone: member.phone || '',
          inviteeUid: member.uid,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        setDoc(doc(db, 'invitations', invId), invPayload).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `invitations/${invId}`)
        );
      });

      const invitedNames = pendingInviteMembers.map((m) => m.name).join(', ');
      setAppNotice(
        isVi
          ? `✉️ Đã tạo chuyến đi và gửi lời mời tham gia qua app tới: ${invitedNames}.`
          : `✉️ Created trip and sent in-app invitations to: ${invitedNames}.`
      );
      setTimeout(() => setAppNotice(null), 5000);
    }

    setActiveTripId(tripToSave.id);
    setActiveTab('itinerary');
    if (openAiArchitect) {
      setAiTargetTrip(tripToSave);
      setIsAIModalOpen(true);
    }
  };

  // 6b. Check if active trip has any completed activities
  const hasCompletedActivities = React.useMemo(() => {
    if (!activeTrip) return false;
    return activeTrip.days.some((d) => d.activities.some((a) => a.isCompleted));
  }, [activeTrip]);

  // 6c. Update Trip Details (Title, dates, destination, budget, cover...)
  const handleUpdateTrip = (tripId: string, updatedFields: Partial<Trip> & { rearrangeAllDays?: boolean }) => {
    setTrips((prevTrips) => {
      const nextTrips = prevTrips.map((t) => {
        if (t.id !== tripId) return t;

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
                const dateStr = getLocalDateString(dateObj);

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
                const dateStr = getLocalDateString(dateObj);

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
          } else if (newDaysCount < oldDaysCount) {
            // Shortening trip: keep days 1 to newDaysCount, and merge any activities from days > newDaysCount
            // into the last day (newDaysCount) so NO activities or linked expenses are silently lost!
            const truncatedDays = t.days.slice(newDaysCount);
            const extraActivities = truncatedDays.flatMap((d) => d.activities);

            newDays = t.days.slice(0, newDaysCount).map((day, idx) => {
              const dayNum = idx + 1;
              const dateObj = new Date(s);
              dateObj.setDate(s.getDate() + idx);
              const dateStr = getLocalDateString(dateObj);

              if (dayNum === newDaysCount && extraActivities.length > 0) {
                return {
                  ...day,
                  date: dateStr,
                  activities: [...day.activities, ...extraActivities],
                };
              }
              return {
                ...day,
                date: dateStr,
              };
            });
          }
        }

        const { rearrangeAllDays, ...fieldsToUpdate } = updatedFields;
        const updatedTrip: Trip = {
          ...t,
          ...fieldsToUpdate,
          days: newDays,
        };

        // Persist to Firestore safely
        persistTripToFirestore(updatedTrip);

        return updatedTrip;
      });

        saveCachedTripsForUser(userProfile?.id, nextTrips);
        return nextTrips;
      });
    };

  // 6d. Delete Active Trip (Only allowed if no activities are completed, with in-app confirm modal)
  const handleDeleteTrip = () => {
    if (!activeTrip) return;
    if (hasCompletedActivities) {
      showAppNotice(
        isVi
          ? 'Không thể xóa chuyến đi vì đã có hoạt động được đánh dấu hoàn thành!'
          : 'Cannot delete trip because it has completed activities!'
      );
      return;
    }

    setTripPendingDelete(activeTrip);
    setConfirmExpenseSettlementAck(false);
    setIsDeleteTripConfirmOpen(true);
  };

  const deleteTripSummary = React.useMemo(() => {
    const target = tripPendingDelete || activeTrip;
    if (!target) return null;
    return computeTripDeletionSummary(target, userProfile);
  }, [tripPendingDelete, activeTrip, userProfile]);

  const confirmDeleteActiveTrip = async () => {
    const targetTrip = tripPendingDelete || activeTrip;
    if (!targetTrip || isDeletingTrip) return;

    const summary = computeTripDeletionSummary(targetTrip, userProfile);
    if (summary.hasRecordedExpenses && !confirmExpenseSettlementAck) {
      return;
    }

    const targetId = targetTrip.id;
    setIsDeletingTrip(true);

    // Mark tombstone immediately so concurrent onSnapshot / persistTripToFirestore never resurrects it
    deletedTripIdsRef.current.add(targetId);
    try {
      localStorage.setItem(
        'tripmate_deleted_trip_ids',
        JSON.stringify(Array.from(deletedTripIdsRef.current))
      );
    } catch (e) {
      console.warn('Error saving deleted trip tombstone:', e);
    }

    try {
      // 1. Persist cross-user notifications to participating members & both sides of every debt pair BEFORE removing trip
      const notificationsToSend = buildTripDeletionNotifications({
        trip: targetTrip,
        actor: userProfile,
        summary,
        language: isVi ? 'vi' : 'en',
      });

      if (notificationsToSend.length > 0) {
        await Promise.all(
          notificationsToSend.map((n) =>
            setDoc(doc(db, 'user_notifications', n.id), stripUndefinedDeep(n))
          )
        );
      }

      // 2. Wait for Firestore deletion confirmation BEFORE reporting success
      await deleteDoc(doc(db, 'trips', targetId));

      const remainingSync = trips.filter((t) => t.id !== targetId);
      const fallbackActiveId = remainingSync[0]?.id || '';

      setTrips((prevTrips) => {
        const remaining = prevTrips.filter((t) => t.id !== targetId);
        saveCachedTripsForUser(userProfile?.id, remaining);
        return remaining;
      });

      setActiveTripId((prevActive) => (prevActive === targetId ? fallbackActiveId : prevActive));

      setIsDeleteTripConfirmOpen(false);
      setTripPendingDelete(null);
      setConfirmExpenseSettlementAck(false);

      const notifySummaryText =
        notificationsToSend.length > 0
          ? isVi
            ? summary.settlements.length > 0
              ? ` Đã gửi thông báo xóa chuyến đi & giải quyết ${summary.settlements.length} khoản tiền tới các thành viên.`
              : ` Đã gửi thông báo hủy chuyến đi tới ${summary.otherMembers.length} thành viên tham gia.`
            : summary.settlements.length > 0
            ? ` Sent deletion & ${summary.settlements.length} debt settlement notification(s) to members.`
            : ` Notified ${summary.otherMembers.length} participating member(s).`
          : '';

      showAppNotice(
        (isVi
          ? `Đã xóa chuyến đi "${targetTrip.title}".`
          : `Deleted trip "${targetTrip.title}".`) + notifySummaryText
      );
    } catch (err) {
      // Roll back tombstone so UI stays consistent with server state if delete was rejected
      deletedTripIdsRef.current.delete(targetId);
      try {
        localStorage.setItem(
          'tripmate_deleted_trip_ids',
          JSON.stringify(Array.from(deletedTripIdsRef.current))
        );
      } catch {}
      handleFirestoreError(err, OperationType.DELETE, `trips/${targetId}`);
      setIsDeleteTripConfirmOpen(false);
      setTripPendingDelete(null);
      showAppNotice(
        isVi
          ? `Không thể xóa chuyến đi "${targetTrip.title}" trên máy chủ. Vui lòng kiểm tra kết nối hoặc quyền truy cập và thử lại.`
          : `Failed to delete trip "${targetTrip.title}" from server. Please check connection or permissions and try again.`
      );
    } finally {
      setIsDeletingTrip(false);
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
    setTrips((prevTrips) => {
      const nextTrips = prevTrips.map((t) => {
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

          const updatedTrip = { ...t, days: updatedDays };
          persistTripToFirestore(updatedTrip);
          return updatedTrip;
        }
        return t;
      });
      saveCachedTripsForUser(userProfile?.id, nextTrips);
      return nextTrips;
    });

    setActiveTripId(tripId);
    setActiveTab('itinerary');
  };

  // 1. Loading splash screen while verifying auth session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-xl shadow-teal-500/20 flex items-center justify-center animate-pulse">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-teal-400">
            <Compass className="w-6 h-6 animate-spin" />
          </div>
        </div>
        <div className="mt-4 text-xs font-semibold text-slate-400 tracking-wider">
          TripMate
        </div>
      </div>
    );
  }

  // 2. USER REQUIREMENT:
  // "lúc tk chưa login sẽ không hiển thị thông tin gì 
  // chỉ hiển thị màn hình login có thêm nút đăng ký dành cho người chưa đăng ký 
  // backgound màn hình login này phải đẹp chuyên nghiệp đơn giản và sang trọng"
  if (!userProfile) {
    return <AuthScreen />;
  }

  const tabs = [
    { id: 'itinerary', label: t('tab.itinerary'), icon: <Compass className="w-4 h-4" /> },
    { id: 'expenses', label: t('tab.expenses'), icon: <CreditCard className="w-4 h-4" /> },
    { id: 'map', label: t('tab.map'), icon: <MapIcon className="w-4 h-4" /> },
    { id: 'places', label: t('tab.places'), mobileLabel: isVi ? 'Địa điểm' : 'Places', icon: <BookmarkCheck className="w-4 h-4" /> },
    { id: 'vault', label: t('tab.vault'), mobileLabel: isVi ? 'Vé' : 'Vault', icon: <ShieldCheck className="w-4 h-4" /> },
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

      {/* Offline Mode Indicator Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 font-medium shadow-2xs select-none sticky top-0 z-40">
          <WifiOff className="w-3.5 h-3.5" />
          <span>{isVi ? 'Chế độ ngoại tuyến • Lịch trình & dữ liệu của bạn đã được lưu cục bộ an toàn' : 'Offline Mode • Your itinerary and data are safely cached offline'}</span>
        </div>
      )}

      {/* Online Toast Notification */}
      {showOnlineToast && (
        <div className="fixed bottom-24 sm:bottom-5 right-5 z-50 bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Wifi className="w-4 h-4 text-emerald-200" />
          <span className="font-semibold">{isVi ? 'Đã kết nối lại Internet' : 'Internet connection restored'}</span>
        </div>
      )}

      {/* Main Container - Mobile Optimized */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-24 sm:pb-8 space-y-4 sm:space-y-5">
        {!activeTrip ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 sm:p-12 text-center max-w-xl mx-auto my-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center mx-auto shadow-2xs">
              <Compass className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-900">
                {isVi ? 'Chưa có chuyến đi nào' : 'No trips yet'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {isVi
                  ? 'Tạo chuyến đi đầu tiên hoặc kiểm tra lời mời của bạn.'
                  : 'Create your first trip or check pending invites.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsNewTripModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isVi ? 'Tạo chuyến đi mới' : 'Create New Trip'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNotificationsModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <span>{isVi ? 'Kiểm tra lời mời / Thông báo' : 'Check Invitations & Notices'}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* Trip Header Banner with Compact Luxe Style (overflow kept on inner backdrop so ⋯ popover never clips) */}
        <div className="relative z-30 w-full rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm group min-h-[105px] sm:min-h-[145px] flex flex-col justify-between p-3 sm:p-5 bg-slate-900 transition-all">
          <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none">
            {/* Background Image */}
            {activeTrip.coverImage ? (
              <img
                src={activeTrip.coverImage}
                alt={activeTrip.title}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950" />
            )}

            {/* High-legibility scrim gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-slate-950/30" />
          </div>

          {/* Top Bar inside Banner: Badges on left, Action buttons on right */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
            {/* Country & Date Badge */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {activeTrip.country && activeTrip.country.trim().toLowerCase() !== activeTrip.destination.trim().toLowerCase() && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/80 text-white border border-white/20 shrink-0 backdrop-blur-md">
                  {activeTrip.country}
                </span>
              )}
              <span className="text-[11px] sm:text-xs text-slate-200 font-medium shrink-0 drop-shadow-xs">
                {activeTrip.startDate} — {activeTrip.endDate}
              </span>
            </div>

            {/* Banner Actions (1 Primary CTA: AI Itinerary + 1 Overflow Menu: Handbook / Edit / Delete) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Primary CTA: AI Itinerary */}
              <button
                type="button"
                onClick={() => {
                  setAiTargetTrip(activeTrip);
                  setIsAIModalOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white border border-teal-400/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm min-h-[36px]"
                title={isVi ? 'Lịch trình AI' : 'AI Itinerary'}
                aria-label={isVi ? 'Lịch trình AI' : 'AI Itinerary'}
              >
                <Sparkles className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="text-[11px] font-bold tracking-wide text-white whitespace-nowrap">
                  AI
                </span>
              </button>

              {/* Mobile Overflow Button (⋯ opens bottom sheet) */}
              <button
                type="button"
                onClick={() => setIsTripActionMenuOpen(true)}
                aria-label={isVi ? 'Tùy chọn chuyến đi' : 'Trip options'}
                className="sm:hidden w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white backdrop-blur-md border border-white/25 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                title={isVi ? 'Tùy chọn chuyến đi' : 'Trip options'}
              >
                <MoreHorizontal className="w-4 h-4 text-white" />
              </button>

              {/* Desktop Overflow Button (⋯ opens popover menu with Handbook / Edit / Delete) */}
              <div ref={desktopTripMenuRef} className="hidden sm:block relative">
                <button
                  type="button"
                  onClick={() => setIsDesktopTripMenuOpen((prev) => !prev)}
                  aria-label={isVi ? 'Tùy chọn chuyến đi' : 'Trip options'}
                  aria-expanded={isDesktopTripMenuOpen}
                  className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/25 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                  title={isVi ? 'Tùy chọn chuyến đi' : 'Trip options'}
                >
                  <MoreHorizontal className="w-4 h-4 text-white" />
                </button>

                {isDesktopTripMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDesktopTripMenuOpen(false);
                        setIsHandbookModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isVi ? 'Cẩm nang' : 'Handbook'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDesktopTripMenuOpen(false);
                        setIsEditTripModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isVi ? 'Sửa' : 'Edit'}</span>
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsDesktopTripMenuOpen(false);
                        handleDeleteTrip();
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 ${
                        hasCompletedActivities
                          ? 'text-slate-400 cursor-not-allowed opacity-60'
                          : 'text-rose-600 hover:bg-rose-50 cursor-pointer'
                      }`}
                      title={
                        hasCompletedActivities
                          ? (isVi ? 'Chỉ được xóa chuyến đi nếu chưa có hoạt động nào hoàn thành' : 'Cannot delete: has completed activities')
                          : (isVi ? 'Xóa chuyến đi' : 'Delete Trip')
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Xóa' : 'Delete'}</span>
                    </button>
                  </div>
                )}
              </div>
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
              <span className="flex items-center gap-1 font-bold text-emerald-300">
                <Wallet className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span>{formatMoney(activeTrip.budgetTotal, activeTrip.currency, lang)}</span>
              </span>
              <span className="text-white/40">•</span>
              <RealtimeWeatherBadge destination={activeTrip.destination} />
            </div>
          </div>
        </div>

        {/* Swipeable & Draggable Navigation Tab Bar */}
        <SwipeableTabBar
          tabs={tabs}
          activeTab={activeTab}
          onSelectTab={(tabId) => setActiveTab(tabId as TabType)}
          mobileMoreTabIds={['vault', 'packing']}
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
              onOpenAIModal={() => {
                setAiTargetTrip(activeTrip);
                setIsAIModalOpen(true);
              }}
              onAddExpense={handleAddExpense}
              onSaveActivityExpense={handleSaveActivityExpense}
              onDeleteExpense={handleDeleteExpense}
              onNavigateToExpenses={() => setActiveTab('expenses')}
              externalQuickAddTrigger={quickAddActivitySeq}
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
              externalQuickAction={expenseQuickAction}
              onConsumeQuickAction={() => setExpenseQuickAction(null)}
            />
          )}

          {activeTab === 'packing' && (
            <PackingListView
              trip={activeTrip}
              onToggleItem={handleTogglePackingItem}
              onAddItem={handleAddPackingItem}
              onEditItem={handleEditPackingItem}
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
              onUpdateTrip={handleUpdateTrip}
            />
          )}
        </div>
          </>
        )}
      </main>

      {/* Mobile Floating '+' Quick-Add FAB */}
      {activeTrip && (
        <div className="sm:hidden fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
          {isQuickAddFabOpen && (
            <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={() => {
                  setIsQuickAddFabOpen(false);
                  setActiveTab('expenses');
                  setExpenseQuickAction({ type: 'scan-receipt', seq: Date.now() });
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-violet-600 text-white text-xs font-bold shadow-lg border border-violet-400/40 cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>{isVi ? '+ Quét hóa đơn AI' : '+ Scan Receipt AI'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsQuickAddFabOpen(false);
                  setActiveTab('expenses');
                  setExpenseQuickAction({ type: 'add-expense', seq: Date.now() });
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-lg border border-slate-700 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>{isVi ? '+ Thêm chi tiêu' : '+ Add Expense'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsQuickAddFabOpen(false);
                  setActiveTab('itinerary');
                  setQuickAddActivitySeq((s) => s + 1);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-teal-600 text-white text-xs font-bold shadow-lg border border-teal-400/40 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>{isVi ? '+ Thêm hoạt động' : '+ Add Activity'}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsQuickAddFabOpen((prev) => !prev)}
            aria-label={isVi ? 'Thao tác nhanh' : 'Quick Add'}
            className={`w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xl border border-white/25 flex items-center justify-center transition-transform cursor-pointer ${
              isQuickAddFabOpen ? 'rotate-45' : 'active:scale-95'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* AI Itinerary Generator Modal */}
      {activeTrip && (
        <AIItineraryModal
          key={aiTargetTrip?.id || activeTrip.id}
          isOpen={isAIModalOpen}
          onClose={() => {
            setIsAIModalOpen(false);
            setAiTargetTrip(null);
          }}
          onApplyGeneratedItinerary={handleApplyGeneratedItinerary}
          targetTrip={aiTargetTrip || activeTrip}
          savedPlaces={savedPlaces}
          initialDestination={aiTargetTrip ? aiTargetTrip.destination : activeTrip.destination}
          initialDurationDays={aiTargetTrip ? aiTargetTrip.days.length : (activeTrip.days?.length || 3)}
          initialBudget={aiTargetTrip ? aiTargetTrip.budgetTotal : activeTrip.budgetTotal}
        />
      )}

      {/* Floating AI Assistant Chat */}
      {activeTrip && (
        <AIAssistantChat
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          trip={activeTrip}
        />
      )}

      {/* New Trip Modal */}
      <NewTripModal
        isOpen={isNewTripModalOpen}
        onClose={() => setIsNewTripModalOpen(false)}
        onCreateTrip={handleCreateTrip}
      />

      {/* Edit Trip Modal */}
      {isEditTripModalOpen && activeTrip && (
        <EditTripModal
          key={activeTrip.id}
          isOpen={isEditTripModalOpen}
          onClose={() => setIsEditTripModalOpen(false)}
          trip={activeTrip}
          onUpdateTrip={handleUpdateTrip}
        />
      )}

      {/* Travel Handbook / Print PDF Modal */}
      {isHandbookModalOpen && activeTrip && (
        <TravelHandbookModal
          trip={activeTrip}
          isOpen={isHandbookModalOpen}
          onClose={() => setIsHandbookModalOpen(false)}
        />
      )}

      {/* Auth / Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* In-app Notifications / Trip Invitations Modal */}
      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        activeTrip={activeTrip}
        trips={trips}
        onUpdateTrip={handleUpdateTrip}
        onSelectTrip={(tripId) => {
          setActiveTripId(tripId);
          setActiveTab('expenses');
        }}
      />

      {/* Mobile Trip Action Bottom Sheet (Option A - Spacious & Luxe) */}
      {isTripActionMenuOpen && activeTrip && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end sm:hidden animate-in fade-in duration-150"
          onClick={() => setIsTripActionMenuOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl border-t border-slate-200/90 shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-200 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto -mt-1" />

            {/* Trip summary header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 pt-1">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                  {activeTrip.country}
                </span>
                <h4 className="font-display font-extrabold text-base text-slate-900 truncate mt-1">
                  {activeTrip.title}
                </h4>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{activeTrip.destination}</span>
                  <span>•</span>
                  <span>{activeTrip.startDate} — {activeTrip.endDate}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTripActionMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions list - secondary trip actions tucked inside ⋯ menu (AI Itinerary is primary on Banner) */}
            <div className="space-y-2">
              {/* Export Travel Handbook PDF */}
              <button
                type="button"
                onClick={() => {
                  setIsHandbookModalOpen(true);
                  setIsTripActionMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.99] border border-slate-200/80 transition-all text-left cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {isVi ? 'Cẩm nang PDF' : 'Travel Handbook PDF'}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>

              {/* Edit Trip */}
              <button
                type="button"
                onClick={() => {
                  setIsEditTripModalOpen(true);
                  setIsTripActionMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.99] border border-slate-200/80 transition-all text-left cursor-pointer min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {isVi ? 'Sửa chuyến đi' : 'Edit Trip'}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>

              {/* Delete Trip */}
              <button
                type="button"
                onClick={() => {
                  setIsTripActionMenuOpen(false);
                  handleDeleteTrip();
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left min-h-[48px] ${
                  hasCompletedActivities
                    ? 'bg-slate-50/60 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-rose-50/60 hover:bg-rose-100/70 border-rose-200 text-rose-700 active:scale-[0.99] cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    hasCompletedActivities ? 'bg-slate-200 text-slate-400' : 'bg-rose-100 text-rose-600'
                  }`}>
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">
                      {isVi ? 'Xóa chuyến đi' : 'Delete Trip'}
                    </div>
                    {hasCompletedActivities && (
                      <div className="text-xs text-slate-500">
                        {isVi ? 'Đã có hoạt động hoàn thành' : 'Contains completed items'}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsTripActionMenuOpen(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              {isVi ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* In-app Delete Trip Confirmation Modal */}
      {isDeleteTripConfirmOpen && (tripPendingDelete || activeTrip) && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (isDeletingTrip) return;
            setIsDeleteTripConfirmOpen(false);
            setTripPendingDelete(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base">
                  {isVi ? 'Xóa chuyến đi?' : 'Delete Trip?'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isVi
                    ? `Bạn có chắc chắn muốn xóa chuyến đi "${(tripPendingDelete || activeTrip)!.title}" không? Hành động này không thể hoàn tác.`
                    : `Are you sure you want to delete "${(tripPendingDelete || activeTrip)!.title}"? This action cannot be undone.`}
                </p>
              </div>
            </div>

            {deleteTripSummary && deleteTripSummary.hasOtherMembers && (
              <div className="p-3 rounded-xl bg-teal-50/80 border border-teal-200 text-xs text-teal-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span>
                    {isVi
                      ? `Chuyến đi có ${deleteTripSummary.otherMembers.length} thành viên khác tham gia`
                      : `${deleteTripSummary.otherMembers.length} other participating member(s)`}
                  </span>
                </div>
                <p className="text-[11px] text-teal-800 leading-relaxed">
                  {isVi
                    ? `Sau khi xóa, hệ thống sẽ tự động gửi thông báo tới: ${deleteTripSummary.otherMembers.map((m) => m.name).join(', ')}.`
                    : `Upon deletion, notifications will be sent to: ${deleteTripSummary.otherMembers.map((m) => m.name).join(', ')}.`}
                </p>
              </div>
            )}

            {deleteTripSummary && deleteTripSummary.hasRecordedExpenses && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5 text-xs">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {isVi
                      ? `Chuyến đi đã ghi nhận ${deleteTripSummary.recordedExpensesCount} khoản chi tiêu (${formatMoney(deleteTripSummary.totalSpent, deleteTripSummary.currency, lang)})`
                      : `${deleteTripSummary.recordedExpensesCount} recorded expense(s) (${formatMoney(deleteTripSummary.totalSpent, deleteTripSummary.currency, lang)})`}
                  </span>
                </div>

                {deleteTripSummary.settlements.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-amber-900">
                      {isVi
                        ? 'Công nợ cần gửi thông báo giải quyết cho cả 2 bên:'
                        : 'Unsettled balances (notifications sent to both sides):'}
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {deleteTripSummary.settlements.map((s, idx) => (
                        <div
                          key={`${s.fromId}-${s.toId}-${idx}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-[11px]"
                        >
                          <span className="font-semibold text-slate-800">
                            {s.fromName} {isVi ? 'thiếu' : 'owes'} {s.toName}
                          </span>
                          <span className="font-extrabold text-rose-600">
                            {formatMoney(s.amount, s.currency, lang)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-800">
                    {isVi
                      ? 'Các khoản chi tiêu đã cân bằng công nợ; hệ thống vẫn sẽ thông báo cho thành viên biết chuyến đi đã bị xóa.'
                      : 'Expenses are currently balanced; members will still be notified that the trip was deleted.'}
                  </p>
                )}

                <label className="flex items-start gap-2 pt-1.5 border-t border-amber-200/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmExpenseSettlementAck}
                    onChange={(e) => setConfirmExpenseSettlementAck(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-slate-800 leading-snug">
                    {isVi
                      ? 'Xác nhận xóa và gửi thông báo công nợ cho nhóm.'
                      : 'Confirm deletion and notify group of balances.'}
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingTrip}
                onClick={() => {
                  setIsDeleteTripConfirmOpen(false);
                  setTripPendingDelete(null);
                  setConfirmExpenseSettlementAck(false);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 rounded-xl cursor-pointer transition-colors"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={
                  isDeletingTrip ||
                  Boolean(deleteTripSummary?.hasRecordedExpenses && !confirmExpenseSettlementAck)
                }
                onClick={confirmDeleteActiveTrip}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                {isDeletingTrip
                  ? (isVi ? 'Đang xóa & gửi thông báo...' : 'Deleting & notifying...')
                  : deleteTripSummary && (deleteTripSummary.hasOtherMembers || deleteTripSummary.hasRecordedExpenses)
                  ? (isVi ? 'Xác nhận xóa & gửi thông báo' : 'Confirm Delete & Notify')
                  : (isVi ? 'Xác nhận xóa' : 'Confirm Delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* In-app Warning / Notice Toast */}
      {appNotice && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-50 max-w-md w-[calc(100%-2rem)] sm:w-auto bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold leading-relaxed flex-1">
            {appNotice}
          </p>
          <button
            type="button"
            onClick={() => setAppNotice(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Invitation Acceptance Toast */}
      {invitationToast && (
        <div className="fixed bottom-24 sm:bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-teal-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold leading-relaxed flex-1">
            {invitationToast}
          </p>
          <button
            onClick={() => setInvitationToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
