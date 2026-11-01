import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Trip, ActivityItem } from '../types';
import {
  MapPin, Navigation, Calendar, ChevronDown, ChevronUp, ArrowUpDown, LocateFixed
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';
import { formatToDDMMYYYY } from './ItineraryView';

interface InteractiveMapViewProps {
  trip: Trip;
}

type MapMode = 'google-roadmap' | 'google-satellite' | 'google-terrain';
type SortMode = 'itinerary' | 'nearest';

export interface ResolvedWaypoint {
  activity: ActivityItem;
  dayNumber: number;
  dayDate?: string;
  dayTitle?: string;
  orderInDay: number;
  globalOrder: number;
  lat: number;
  lng: number;
  distanceKm?: number;
  rankNearest?: number;
}

// Haversine formula to calculate straight-line distance in km, multiplied by 1.22 road factor
const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistance = R * c;
  return Math.round(straightDistance * 1.22 * 100) / 100;
};

export const formatDistance = (km: number): string => {
  if (km < 1) {
    const meters = Math.max(10, Math.round(km * 1000));
    return `${meters} m`;
  }
  return `${km.toFixed(1)} km`;
};

export const getRankLabel = (rank: number, isVi: boolean): string => {
  if (isVi) {
    if (rank === 1) return 'Gần nhất (#1)';
    if (rank === 2) return 'Gần nhì (#2)';
    if (rank === 3) return 'Gần thứ 3 (#3)';
    return `Thứ #${rank}`;
  } else {
    if (rank === 1) return 'Nearest (#1)';
    if (rank === 2) return '2nd Nearest (#2)';
    if (rank === 3) return '3rd Nearest (#3)';
    return `#${rank}`;
  }
};

export const InteractiveMapView: React.FC<InteractiveMapViewProps> = ({ trip }) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('google-roadmap');
  const [sortMode, setSortMode] = useState<SortMode>('itinerary');
  const [selectedDayFilter, setSelectedDayFilter] = useState<'all' | number>('all');

  // Collapse/Expand state for each day in itinerary list (default expanded, toggled by chevron-up/chevron-down)
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});

  const toggleDayCollapse = (dayNumber: number) => {
    setCollapsedDays((prev) => ({
      ...prev,
      [dayNumber]: !prev[dayNumber],
    }));
  };

  // User current location state for distance calculation & sorting
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
    isSimulated?: boolean;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Day Droplist state (no search)
  const [isDayDropdownOpen, setIsDayDropdownOpen] = useState(false);
  const dayDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dayDropdownRef.current && !dayDropdownRef.current.contains(e.target as Node)) {
        setIsDayDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to get destination center coordinates
  const getDestinationCoords = (dest: string): [number, number] => {
    const d = dest.toLowerCase();
    if (d.includes('đà lạt') || d.includes('da lat') || d.includes('dalat')) return [11.9404, 108.4583];
    if (d.includes('vũng tàu') || d.includes('vung tau')) return [10.3460, 107.0843];
    if (d.includes('đà nẵng') || d.includes('da nang')) return [16.0544, 108.2022];
    if (d.includes('hà nội') || d.includes('ha noi') || d.includes('hanoi')) return [21.0285, 105.8542];
    if (d.includes('hồ chí minh') || d.includes('saigon') || d.includes('sài gòn')) return [10.8231, 106.6297];
    if (d.includes('phú quốc') || d.includes('phu quoc')) return [10.2899, 103.9840];
    if (d.includes('nha trang')) return [12.2388, 109.1967];
    if (d.includes('hội an') || d.includes('hoi an')) return [15.8801, 108.3380];
    if (d.includes('huế') || d.includes('hue')) return [16.4637, 107.5909];
    if (d.includes('sapa') || d.includes('sa pa')) return [22.3364, 103.8438];
    if (d.includes('hạ long') || d.includes('ha long')) return [20.9599, 107.0425];
    if (d.includes('quy nhơn') || d.includes('quy nhon')) return [13.7820, 109.2197];
    if (d.includes('mũi né') || d.includes('mui ne') || d.includes('phan thiết')) return [10.9333, 108.1000];
    if (d.includes('cần thơ') || d.includes('can tho')) return [10.0452, 105.7469];
    if (d.includes('tokyo') || d.includes('japan')) return [35.6762, 139.6503];
    if (d.includes('paris') || d.includes('france')) return [48.8566, 2.3522];
    if (d.includes('positano') || d.includes('amalfi') || d.includes('italy')) return [40.6281, 14.4850];
    return [11.9404, 108.4583];
  };

  const [baseLat, baseLng] = useMemo(() => getDestinationCoords(trip.destination), [trip.destination]);

  // Request user's real GPS location or fallback to destination center when sorting by Nearest -> Farthest
  const handleActivateNearestSort = () => {
    setSortMode('nearest');
    if (userLocation) return;

    setIsLocating(true);
    if (!('geolocation' in navigator)) {
      setUserLocation({
        lat: baseLat,
        lng: baseLng,
        label: isVi ? `Trung tâm ${trip.destination}` : `${trip.destination} Center`,
        isSimulated: true,
      });
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: isVi ? 'Vị trí hiện tại của tôi' : 'My Current Location',
          isSimulated: false,
        });
        setIsLocating(false);
      },
      () => {
        setUserLocation({
          lat: baseLat,
          lng: baseLng,
          label: isVi ? `Trung tâm ${trip.destination}` : `${trip.destination} Center`,
          isSimulated: true,
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  };

  // Build resolved waypoints with coordinates, day info, and distances
  const allResolvedWaypoints = useMemo<ResolvedWaypoint[]>(() => {
    const list: ResolvedWaypoint[] = [];
    const totalCount = trip.days.reduce((sum, d) => sum + d.activities.length, 0);
    let globalIdx = 0;

    // Effective reference point for distance calculation (user location if available, otherwise destination center)
    const refLat = userLocation ? userLocation.lat : baseLat;
    const refLng = userLocation ? userLocation.lng : baseLng;

    trip.days.forEach((day) => {
      day.activities.forEach((act, idxInDay) => {
        let lat = act.lat;
        let lng = act.lng;

        if (!lat || !lng) {
          const angle = (globalIdx / Math.max(totalCount, 1)) * Math.PI * 2;
          const radius = 0.011 + (globalIdx % 4) * 0.007;
          lat = baseLat + Math.sin(angle) * radius;
          lng = baseLng + Math.cos(angle) * radius;
        }

        const distanceKm = calculateDistanceKm(refLat, refLng, lat, lng);

        list.push({
          activity: act,
          dayNumber: day.dayNumber,
          dayDate: day.date,
          dayTitle: day.title,
          orderInDay: idxInDay + 1,
          globalOrder: globalIdx + 1,
          lat,
          lng,
          distanceKm,
        });

        globalIdx++;
      });
    });

    return list;
  }, [trip.days, baseLat, baseLng, userLocation]);

  // Filter waypoints by selected day ('all' or specific dayNumber) and compute nearest ranks
  const filteredWaypoints = useMemo<ResolvedWaypoint[]>(() => {
    const base =
      selectedDayFilter === 'all'
        ? allResolvedWaypoints
        : allResolvedWaypoints.filter((w) => w.dayNumber === selectedDayFilter);

    const sortedByDist = [...base].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
    const rankMap = new Map<string, number>();
    sortedByDist.forEach((item, index) => {
      rankMap.set(item.activity.id, index + 1);
    });

    const withRanks = base.map((item) => ({
      ...item,
      rankNearest: rankMap.get(item.activity.id),
    }));

    if (sortMode === 'nearest') {
      return [...withRanks].sort(
        (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
      );
    }

    return withRanks;
  }, [allResolvedWaypoints, selectedDayFilter, sortMode]);

  const getTileUrl = (mode: MapMode) => {
    switch (mode) {
      case 'google-roadmap':
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      case 'google-satellite':
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'google-terrain':
        return 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      default:
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  };

  // Change tile layer when mapMode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newLayer = L.tileLayer(getTileUrl(mapMode), {
      attribution: '&copy; Google Maps',
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [mapMode]);

  // Initialize and update markers & route lines on map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [baseLat, baseLng],
        zoom: 13,
        scrollWheelZoom: true,
      });

      const initialLayer = L.tileLayer(getTileUrl(mapMode), {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(map);

      tileLayerRef.current = initialLayer;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    map.off('click');
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (sortMode === 'nearest') {
        setUserLocation({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: isVi ? 'Vị trí đã chọn trên bản đồ' : 'Selected Map Position',
          isSimulated: true,
        });
      }
    });

    // Clear previous markers & polylines
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });
    markersMapRef.current.clear();

    const latLngBounds: L.LatLngExpression[] = [];

    // 1. If in 'nearest' sort mode and userLocation exists, show current location pin
    if (sortMode === 'nearest' && userLocation) {
      latLngBounds.push([userLocation.lat, userLocation.lng]);

      const userIcon = L.divIcon({
        className: 'custom-user-location-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 5px;
            background: #0f172a;
            color: white;
            padding: 4px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            box-shadow: 0 4px 14px rgba(15,23,42,0.45);
            border: 2px solid #38bdf8;
            white-space: nowrap;
          ">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;"></span>
            <span>${isVi ? 'Vị trí của tôi' : 'My Location'}</span>
          </div>
        `,
        iconSize: [115, 26],
        iconAnchor: [57, 13],
      });

      const uMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      uMarker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; min-width: 150px;">
          <strong style="color: #0284c7; font-size: 12px; display: block;">📍 ${userLocation.label}</strong>
          <p style="margin: 3px 0 0; color: #64748b; font-size: 11px;">
            ${isVi ? 'Chạm vào bản đồ để đổi vị trí của bạn.' : 'Tap anywhere on map to move your location.'}
          </p>
        </div>
      `);
    }

    const DAY_COLORS = ['#ea4335', '#0d9488', '#2563eb', '#7c3aed', '#d97706', '#db2777', '#059669'];

    // 2. Render waypoint pins
    filteredWaypoints.forEach((wp, idx) => {
      const { activity: act, lat, lng, dayNumber, distanceKm, rankNearest } = wp;
      latLngBounds.push([lat, lng]);

      const gmapsSearchLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
      )}`;

      const gmapsDirectFromMeLink = userLocation
        ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(
            act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
          )}`
        : gmapsSearchLink;

      const isNearest = sortMode === 'nearest' && rankNearest === 1;
      const isSecondNearest = sortMode === 'nearest' && rankNearest === 2;
      const pinColor = isNearest
        ? '#059669'
        : isSecondNearest
        ? '#0284c7'
        : DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];

      const badgePrefix =
        sortMode === 'nearest' && rankNearest
          ? `#${rankNearest}`
          : selectedDayFilter === 'all'
          ? `N${dayNumber}.${wp.orderInDay}`
          : `${idx + 1}`;

      const distSuffix =
        sortMode === 'nearest' && distanceKm !== undefined ? ` (${formatDistance(distanceKm)})` : '';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background: ${pinColor};
            color: white;
            padding: 4px 8px;
            border-radius: 14px;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 3px 10px rgba(0,0,0,0.26);
            border: 2px solid white;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span style="background: rgba(255,255,255,0.24); padding: 0.5px 4.5px; border-radius: 6px; font-weight: 800; font-size: 10px;">${badgePrefix}</span>
            <span>${act.title.length > 13 ? act.title.substring(0, 11) + '...' : act.title}${distSuffix}</span>
          </div>
        `,
        iconSize: [145, 26],
        iconAnchor: [72, 13],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      markersMapRef.current.set(act.id, marker);

      marker.on('click', () => {
        setSelectedActivity(act);
      });

      marker.bindPopup(`
        <div style="font-family: inherit; padding: 3px; min-width: 190px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
            <span style="background: #f1f5f9; color: #334155; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px;">
              ${isVi ? `Ngày ${dayNumber}` : `Day ${dayNumber}`} • ${act.time}
            </span>
            ${
              distanceKm !== undefined
                ? `<span style="background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px;">
                    📏 ${formatDistance(distanceKm)}
                  </span>`
                : ''
            }
          </div>
          <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">
            ${act.title}
          </strong>
          <p style="margin: 2px 0 6px; color: #64748b; font-size: 11px;">📍 ${act.locationName}</p>
          ${
            act.estimatedCost
              ? `<div style="margin-bottom: 8px; font-size: 11px; font-weight: 700; color: #0d9488;">
                  💰 ${formatMoney(act.estimatedCost, act.currency || trip.currency, lang)}
                </div>`
              : ''
          }
          <a
            href="${gmapsDirectFromMeLink}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 5px 10px;
              background: #1a73e8;
              color: white;
              border-radius: 8px;
              font-size: 11px;
              font-weight: bold;
              text-decoration: none;
            "
          >
            <span>${isVi ? 'Mở Google Maps ↗' : 'Open Google Maps ↗'}</span>
          </a>
        </div>
      `);
    });

    // 3. Draw route lines
    if (filteredWaypoints.length > 1) {
      const routeCoords: L.LatLngExpression[] = filteredWaypoints.map((w) => [w.lat, w.lng]);
      L.polyline(routeCoords, {
        color: '#1a73e8',
        weight: 3.5,
        dashArray: '8, 8',
        opacity: 0.85,
      }).addTo(map);
    }

    if (latLngBounds.length > 1) {
      map.fitBounds(L.latLngBounds(latLngBounds), { padding: [40, 40] });
    } else if (latLngBounds.length === 1) {
      map.setView(latLngBounds[0], 14);
    } else {
      map.setView([baseLat, baseLng], 13);
    }

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [filteredWaypoints, userLocation, sortMode, selectedDayFilter, baseLat, baseLng, isVi, lang, trip.currency, trip.destination]);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Focus a waypoint on the map when clicked in the list
  const handleSelectWaypointCard = (wp: ResolvedWaypoint) => {
    setSelectedActivity(wp.activity);
    const map = mapInstanceRef.current;
    const marker = markersMapRef.current.get(wp.activity.id);
    if (map) {
      map.setView([wp.lat, wp.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
    if (marker) {
      marker.openPopup();
    }
  };

  // Full Route URL on Google Maps (respects selected day filter)
  const fullGoogleMapsRouteUrl = useMemo(() => {
    if (filteredWaypoints.length === 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destination)}`;
    }
    const first = filteredWaypoints[0].activity;
    const last = filteredWaypoints[filteredWaypoints.length - 1].activity;

    const origin = userLocation
      ? `${userLocation.lat},${userLocation.lng}`
      : encodeURIComponent(`${first.locationName || first.title}, ${trip.destination}`);
    const destination = encodeURIComponent(`${last.locationName || last.title}, ${trip.destination}`);

    const waypointItems = userLocation ? filteredWaypoints.slice(0, -1) : filteredWaypoints.slice(1, -1);

    if (waypointItems.length === 0) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    }

    const waypoints = waypointItems
      .slice(0, 8)
      .map((w) => encodeURIComponent(`${w.activity.locationName || w.activity.title}, ${trip.destination}`))
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`;
  }, [filteredWaypoints, trip.destination, userLocation]);

  // Group filteredWaypoints by day
  const groupedByDay = useMemo(() => {
    const groups: {
      dayNumber: number;
      dateStr: string;
      dayTitle: string;
      items: ResolvedWaypoint[];
    }[] = [];

    trip.days.forEach((d) => {
      if (selectedDayFilter !== 'all' && d.dayNumber !== selectedDayFilter) return;
      const items = filteredWaypoints.filter((w) => w.dayNumber === d.dayNumber);
      const formattedDate = formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate);
      const cleanTitle = d.title ? d.title.replace(/^(ngày|day)\s*\d+[\s:–-]*/i, '').trim() : '';
      groups.push({
        dayNumber: d.dayNumber,
        dateStr: formattedDate,
        dayTitle: cleanTitle,
        items,
      });
    });

    return groups;
  }, [trip.days, trip.startDate, selectedDayFilter, filteredWaypoints]);

  return (
    <div className="space-y-3">
      {/* 1. Mobile-First Clean Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-3 relative z-30">
        {/* Left: Merged Google Maps Route Button (Icon Mũi Tên Con Diều) + Destination Title + Stop Count */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <a
            href={fullGoogleMapsRouteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={isVi ? 'Mở chỉ đường lộ trình trên Google Maps' : 'Open route directions in Google Maps'}
            className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs flex items-center justify-center shrink-0 transition-all cursor-pointer group"
          >
            <Navigation className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>

          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate leading-tight">
              {trip.destination}
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
              <span>
                {filteredWaypoints.length} {isVi ? 'địa điểm' : 'stops'}
              </span>
            </p>
          </div>
        </div>

        {/* Right: Clean Day Droplist (No Search Input) */}
        <div className="relative shrink-0" ref={dayDropdownRef}>
          <button
            type="button"
            onClick={() => setIsDayDropdownOpen(!isDayDropdownOpen)}
            className={`flex items-center justify-between gap-2 text-xs font-bold py-2 px-3 rounded-xl border transition-colors cursor-pointer min-w-[132px] sm:min-w-[155px] ${
              selectedDayFilter !== 'all'
                ? 'border-teal-500 bg-teal-50/80 text-teal-900'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="truncate">
                {selectedDayFilter === 'all'
                  ? (isVi ? 'Tất cả ngày' : 'All Days')
                  : (isVi ? `Ngày ${selectedDayFilter}` : `Day ${selectedDayFilter}`)}
              </span>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isDayDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Clean Day Droplist Menu */}
          {isDayDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 sm:w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-1.5 space-y-0.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedDayFilter('all');
                  setIsDayDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  selectedDayFilter === 'all'
                    ? 'bg-teal-50 text-teal-800 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{isVi ? 'Tất cả các ngày' : 'All Days'}</span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {allResolvedWaypoints.length}
                </span>
              </button>

              {trip.days.map((d) => {
                const shortDate = formatToDDMMYYYY(d.date, d.dayNumber, trip.startDate).slice(0, 5);
                const isSelected = selectedDayFilter === d.dayNumber;
                return (
                  <button
                    key={d.dayNumber}
                    type="button"
                    onClick={() => {
                      setSelectedDayFilter(d.dayNumber);
                      setIsDayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 text-teal-800 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-slate-900">
                        {isVi ? `Ngày ${d.dayNumber}` : `Day ${d.dayNumber}`}
                      </span>
                      {shortDate && (
                        <span className="text-slate-400 ml-1 font-normal text-[11px]">
                          ({shortDate})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {d.activities.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Map & Waypoints List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Interactive Google Map Box */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-1.5 sm:p-2 shadow-2xs relative overflow-hidden flex flex-col h-[340px] sm:h-[480px] lg:h-[560px]">
          {/* Floating Map Mode Switcher (Top Right, Compact) */}
          <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md flex items-center gap-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMapMode('google-roadmap')}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                mapMode === 'google-roadmap' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isVi ? 'Bản đồ' : 'Map'}
            </button>
            <button
              type="button"
              onClick={() => setMapMode('google-satellite')}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                mapMode === 'google-satellite' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isVi ? 'Vệ tinh' : 'Satellite'}
            </button>
            <button
              type="button"
              onClick={() => setMapMode('google-terrain')}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                mapMode === 'google-terrain' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isVi ? 'Địa hình' : 'Terrain'}
            </button>
          </div>

          <div ref={mapContainerRef} className="w-full h-full flex-1 rounded-xl"></div>
        </div>

        {/* Side Location List (Switchable between By Day and Nearest -> Farthest with km distance) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs flex flex-col justify-between overflow-hidden max-h-[460px] lg:max-h-[560px]">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* List Header + Sort Mode Switcher */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                  {sortMode === 'nearest'
                    ? (isVi ? 'Gần nhất → Xa nhất' : 'Nearest to Farthest')
                    : (isVi ? 'Điểm dừng lộ trình' : 'Route Stops')}
                </h3>
              </div>

              {/* Sort Mode Toggle: Theo ngày vs Gần → Xa (km) */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setSortMode('itinerary')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    sortMode === 'itinerary'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isVi ? 'Theo ngày' : 'By Day'}
                </button>
                <button
                  type="button"
                  onClick={handleActivateNearestSort}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    sortMode === 'nearest'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={isVi ? 'Sắp xếp từ gần vị trí hiện tại nhất đến xa nhất kèm số km' : 'Sort from nearest to farthest with km distance'}
                >
                  <LocateFixed className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isVi ? 'Gần → Xa (km)' : 'Nearest (km)'}</span>
                </button>
              </div>
            </div>

            {/* Scrollable Stops Container */}
            <div className="mt-2.5 space-y-2.5 overflow-y-auto flex-1 pr-0.5 overscroll-contain">
              {filteredWaypoints.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {isVi ? 'Chưa có địa điểm nào.' : 'No stops yet.'}
                </div>
              ) : sortMode === 'nearest' ? (
                /* MODE A: Sorted strictly from Nearest to Farthest with km distance */
                <div className="space-y-1.5">
                  {filteredWaypoints.map((wp, idx) => {
                    const act = wp.activity;
                    const rank = wp.rankNearest || idx + 1;
                    const itemMapsLink = userLocation
                      ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(
                          act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
                        )}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
                        )}`;

                    return (
                      <div
                        key={act.id}
                        onClick={() => handleSelectWaypointCard(wp)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          selectedActivity?.id === act.id
                            ? 'border-emerald-500 bg-emerald-50/70 shadow-2xs'
                            : rank === 1
                            ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60'
                            : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.5 rounded font-extrabold text-[10px] text-white shrink-0 ${
                                  rank === 1
                                    ? 'bg-emerald-600'
                                    : rank === 2
                                    ? 'bg-sky-600'
                                    : rank === 3
                                    ? 'bg-indigo-600'
                                    : 'bg-slate-600'
                                }`}
                              >
                                {getRankLabel(rank, isVi)}
                              </span>

                              {wp.distanceKm !== undefined && (
                                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200">
                                  📏 {formatDistance(wp.distanceKm)}
                                </span>
                              )}

                              <span className="text-[10px] font-semibold text-slate-400">
                                {isVi ? `Ngày ${wp.dayNumber}` : `Day ${wp.dayNumber}`} • {act.time}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 truncate mt-1">{act.title}</h4>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {act.locationName}
                            </p>
                          </div>

                          <a
                            href={itemMapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors shrink-0"
                            title={isVi ? 'Chỉ đường Google Maps' : 'Open in Google Maps'}
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* MODE B: Grouped & Ordered by Day (with km distance badge) */
                <div className="space-y-3">
                  {groupedByDay.map((group) => {
                    const isCollapsed = !!collapsedDays[group.dayNumber];

                    return (
                      <div key={group.dayNumber} className="space-y-1.5">
                        {/* Day Header with Toggle Button */}
                        <div
                          onClick={() => toggleDayCollapse(group.dayNumber)}
                          className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                          title={isCollapsed ? (isVi ? 'Hiện địa điểm' : 'Show places') : (isVi ? 'Ẩn địa điểm' : 'Hide places')}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white font-bold text-[10px] shrink-0">
                              {isVi ? `Ngày ${group.dayNumber}` : `Day ${group.dayNumber}`}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-600 truncate">
                              {group.dateStr}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-slate-500">
                              {group.items.length} {isVi ? 'điểm' : 'stops'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDayCollapse(group.dayNumber);
                              }}
                              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-colors cursor-pointer"
                              title={isCollapsed ? (isVi ? 'Hiện địa điểm' : 'Show places') : (isVi ? 'Ẩn địa điểm' : 'Hide places')}
                            >
                              {isCollapsed ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronUp className="w-3.5 h-3.5 text-teal-600" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Places of this day - hidden when collapsed */}
                        {!isCollapsed && (
                          group.items.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic px-2 py-1.5">
                              {isVi ? 'Chưa có hoạt động' : 'No activities'}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {group.items.map((wp) => {
                                const act = wp.activity;
                                const itemMapsLink = userLocation
                                  ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(
                                      act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
                                    )}`
                                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
                                    )}`;

                                return (
                                  <div
                                    key={act.id}
                                    onClick={() => handleSelectWaypointCard(wp)}
                                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                                      selectedActivity?.id === act.id
                                        ? 'border-blue-500 bg-blue-50/60 shadow-2xs'
                                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100/80'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="w-4 h-4 rounded-full bg-red-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
                                            {wp.orderInDay}
                                          </span>
                                          <span className="text-[10px] font-bold text-slate-500">
                                            {act.time}
                                          </span>
                                          {wp.distanceKm !== undefined && (
                                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                              {formatDistance(wp.distanceKm)}
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">{act.title}</h4>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                          {act.locationName}
                                        </p>
                                      </div>

                                      <a
                                        href={itemMapsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors shrink-0"
                                        title={isVi ? 'Mở trên Google Maps' : 'Open in Google Maps'}
                                      >
                                        <Navigation className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
