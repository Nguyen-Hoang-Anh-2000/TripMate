import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Trip, ActivityItem } from '../types';
import { MapPin, Navigation, Compass, ExternalLink, Layers, Route } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';

interface InteractiveMapViewProps {
  trip: Trip;
}

type MapMode = 'google-roadmap' | 'google-satellite' | 'google-terrain';

export const InteractiveMapView: React.FC<InteractiveMapViewProps> = ({ trip }) => {
  const { lang, t } = useLanguage();
  const isVi = lang === 'vi';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('google-roadmap');

  // Collect all activities
  const allActivities = trip.days.flatMap((d) => d.activities);

  // Helper to get destination coordinates
  const getDestinationCoords = (dest: string): [number, number] => {
    const d = dest.toLowerCase();
    if (d.includes('đà lạt') || d.includes('da lat') || d.includes('dalat')) return [11.9404, 108.4583];
    if (d.includes('vũng tàu') || d.includes('vung tau')) return [10.3460, 107.0843];
    if (d.includes('đà nẵng') || d.includes('da nang')) return [16.0544, 108.2022];
    if (d.includes('hà nội') || d.includes('ha noi') || d.includes('hanoi')) return [21.0285, 105.8542];
    if (d.includes('hồ chí minh') || d.includes('saigon') || d.includes('sài gòn')) return [10.8231, 106.6297];
    if (d.includes('phú quốc') || d.includes('phu quoc')) return [10.2899, 103.9840];
    if (d.includes('nha trang')) return [12.2388, 109.1967];
    if (d.includes('tokyo') || d.includes('japan')) return [35.6762, 139.6503];
    if (d.includes('paris') || d.includes('france')) return [48.8566, 2.3522];
    if (d.includes('positano') || d.includes('amalfi') || d.includes('italy')) return [40.6281, 14.4850];
    return [11.9404, 108.4583];
  };

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

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const [baseLat, baseLng] = getDestinationCoords(trip.destination);

    // Initialize Map
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

    // Clear previous markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const latLngBounds: L.LatLngExpression[] = [];

    // Create custom pins
    allActivities.forEach((act, idx) => {
      let lat = act.lat;
      let lng = act.lng;

      if (!lat || !lng) {
        // Deterministic spread around destination center
        const angle = (idx / Math.max(allActivities.length, 1)) * Math.PI * 2;
        const radius = 0.012 + (idx % 3) * 0.008;
        lat = baseLat + Math.sin(angle) * radius;
        lng = baseLng + Math.cos(angle) * radius;
      }

      latLngBounds.push([lat, lng]);

      const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
      )}`;

      // Google Maps style pin icon
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background: #ea4335;
            color: white;
            padding: 5px 9px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 4px 12px rgba(234,67,53,0.45);
            border: 2px solid white;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span style="font-size: 13px;">📍</span>
            <span>${idx + 1}. ${act.title.length > 16 ? act.title.substring(0, 14) + '...' : act.title}</span>
          </div>
        `,
        iconSize: [120, 28],
        iconAnchor: [60, 14],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        setSelectedActivity(act);
      });

      marker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; min-width: 180px;">
          <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">
            ${idx + 1}. ${act.title}
          </strong>
          <p style="margin: 2px 0 6px; color: #64748b; font-size: 11px;">📍 ${act.locationName}</p>
          <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: #0d9488;">
            ⏰ ${act.time} ${act.estimatedCost ? '• ' + formatMoney(act.estimatedCost, act.currency || trip.currency, lang) : ''}
          </div>
          <a
            href="${gmapsLink}"
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
            <span>Mở trên Google Maps ↗</span>
          </a>
        </div>
      `);
    });

    // Draw route line connecting activities
    if (latLngBounds.length > 1) {
      L.polyline(latLngBounds, {
        color: '#1a73e8',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.85,
      }).addTo(map);

      map.fitBounds(L.latLngBounds(latLngBounds), { padding: [50, 50] });
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
  }, [trip, lang]);

  // Full Route URL on Google Maps
  const fullGoogleMapsRouteUrl = React.useMemo(() => {
    if (allActivities.length === 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destination)}`;
    }
    const origin = encodeURIComponent(`${allActivities[0].locationName || allActivities[0].title}, ${trip.destination}`);
    const destination = encodeURIComponent(
      `${allActivities[allActivities.length - 1].locationName || allActivities[allActivities.length - 1].title}, ${trip.destination}`
    );

    if (allActivities.length <= 2) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    }

    const waypoints = allActivities
      .slice(1, -1)
      .slice(0, 8)
      .map((a) => encodeURIComponent(`${a.locationName || a.title}, ${trip.destination}`))
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`;
  }, [allActivities, trip.destination]);

  return (
    <div className="space-y-3">
      {/* Top Banner: Google Maps connection indicator & action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-slate-900 text-sm sm:text-base">
                {isVi ? `Bản Đồ Google Maps: ${trip.destination}` : `Google Maps Route: ${trip.destination}`}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                Google Map Live
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isVi
                ? `Đang kết nối dữ liệu địa điểm thực tế của ${trip.destination} với Google Maps`
                : `Connected with live Google Maps platform data for ${trip.destination}`}
            </p>
          </div>
        </div>

        {/* Action: Open Full Route in Google Maps */}
        <a
          href={fullGoogleMapsRouteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Route className="w-4 h-4" />
          <span>{isVi ? 'Mở Chỉ Đường trên Google Maps' : 'Open Route in Google Maps'}</span>
          <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[580px]">
        {/* Interactive Google Map Box */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs relative overflow-hidden flex flex-col">
          
          {/* Top Floating Map Controls */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span className="text-red-500 text-sm">📍</span>
              <span>{allActivities.length} {isVi ? 'điểm dừng' : 'stops'}</span>
            </div>

            {/* Layer Switcher */}
            <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setMapMode('google-roadmap')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  mapMode === 'google-roadmap' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {isVi ? 'Bản đồ' : 'Roadmap'}
              </button>
              <button
                type="button"
                onClick={() => setMapMode('google-satellite')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  mapMode === 'google-satellite' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {isVi ? 'Vệ tinh' : 'Satellite'}
              </button>
              <button
                type="button"
                onClick={() => setMapMode('google-terrain')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  mapMode === 'google-terrain' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {isVi ? 'Địa hình' : 'Terrain'}
              </button>
            </div>
          </div>

          <div ref={mapContainerRef} className="w-full h-full rounded-xl min-h-[400px]"></div>
        </div>

        {/* Side Location List & Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                {isVi ? 'Các Điểm Dừng Trên Lộ Trình' : 'Waypoints & Stops'}
              </h3>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {allActivities.length} {isVi ? 'điểm' : 'stops'}
              </span>
            </div>

            <div className="mt-3 space-y-2 overflow-y-auto max-h-[420px] pr-1">
              {allActivities.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {isVi ? 'Chưa có điểm dừng nào trong chuyến đi này.' : 'No stops in this trip yet.'}
                </div>
              ) : (
                allActivities.map((act, idx) => {
                  const itemMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    act.locationName ? `${act.locationName}, ${trip.destination}` : act.title
                  )}`;

                  return (
                    <div
                      key={act.id}
                      onClick={() => setSelectedActivity(act)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedActivity?.id === act.id
                          ? 'border-blue-500 bg-blue-50/60 shadow-2xs'
                          : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-red-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{act.time}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mt-0.5">{act.title}</h4>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{act.locationName}</span>
                          </p>
                        </div>

                        {/* Direct Google Maps link for each item */}
                        <a
                          href={itemMapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors shrink-0"
                          title={isVi ? 'Mở địa chỉ này trên Google Maps' : 'Open in Google Maps'}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 italic">
              {isVi ? 'Nhấp vào điểm dừng để xem vị trí và mở trên Google Maps.' : 'Click any stop to highlight on map and view details.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
