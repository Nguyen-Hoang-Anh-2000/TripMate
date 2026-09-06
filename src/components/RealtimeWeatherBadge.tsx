import React, { useEffect, useState } from 'react';
import { CloudSun, ExternalLink, Droplets, Wind, Thermometer, RefreshCw, X, Radio } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface RealtimeWeatherData {
  destination: string;
  accuWeatherUrl: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windSpeedKmh: number;
  rainChancePct: number;
  tempMaxC: number;
  tempMinC: number;
  condition: string;
  icon: string;
  isDay: boolean;
  updatedAt: string;
}

interface RealtimeWeatherBadgeProps {
  destination: string;
}

export const RealtimeWeatherBadge: React.FC<RealtimeWeatherBadgeProps> = ({ destination }) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';
  const [data, setData] = useState<RealtimeWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchWeather = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/weather/live?destination=${encodeURIComponent(destination)}&lang=${lang}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('Failed to load realtime weather:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [destination, lang]);

  const accuUrl = data?.accuWeatherUrl || `https://www.accuweather.com/en/search-locations?query=${encodeURIComponent(destination)}`;

  return (
    <>
      {/* Clickable Live Weather Pill */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/80 transition-all cursor-pointer shadow-2xs group"
        title={isVi ? 'Xem dự báo thời tiết thực tế theo AccuWeather' : 'View Real-time AccuWeather Forecast'}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
        </span>
        <span className="text-sm">{data?.icon || '⛅'}</span>
        <span className="font-bold text-slate-800">
          {data ? `${data.tempC}°C` : (isVi ? 'Thời tiết' : 'Weather')}
        </span>
        {data && (
          <span className="hidden sm:inline text-slate-500 font-normal">
            • {data.condition}
          </span>
        )}
        <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-200/60 text-emerald-900 px-1.5 py-0.2 rounded text-[9px] group-hover:bg-emerald-300 transition-colors">
          AccuWeather
        </span>
      </button>

      {/* Weather Detail Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                  <CloudSun className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{isVi ? 'Thời tiết Thực tế (Realtime)' : 'Realtime Weather'}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
                      LIVE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {data?.destination || destination} • {isVi ? 'Dữ liệu chuẩn AccuWeather' : 'AccuWeather Standard'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Weather Card */}
            {data ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-amber-500/10 via-teal-500/10 to-blue-500/10 p-4 rounded-2xl border border-amber-200/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold text-slate-900">{data.tempC}°C</span>
                      <span className="text-xs font-semibold text-slate-500">
                        ({isVi ? 'Cảm giác như' : 'Feels like'} {data.feelsLikeC}°C)
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                      <span className="text-lg">{data.icon}</span>
                      <span>{data.condition}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {isVi ? 'Cao nhất' : 'High'}: <span className="font-semibold text-slate-700">{data.tempMaxC}°C</span> • {isVi ? 'Thấp nhất' : 'Low'}: <span className="font-semibold text-slate-700">{data.tempMinC}°C</span>
                    </div>
                  </div>
                  <div className="text-5xl select-none">
                    {data.icon}
                  </div>
                </div>

                {/* Weather Metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                    <Droplets className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <div className="text-[11px] text-slate-400 font-medium">{isVi ? 'Độ ẩm' : 'Humidity'}</div>
                    <div className="text-xs font-bold text-slate-800">{data.humidity}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                    <Wind className="w-4 h-4 text-teal-600 mx-auto mb-1" />
                    <div className="text-[11px] text-slate-400 font-medium">{isVi ? 'Gió' : 'Wind'}</div>
                    <div className="text-xs font-bold text-slate-800">{data.windSpeedKmh} km/h</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                    <Thermometer className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                    <div className="text-[11px] text-slate-400 font-medium">{isVi ? 'Khả năng mưa' : 'Rain'}</div>
                    <div className="text-xs font-bold text-slate-800">{data.rainChancePct}%</div>
                  </div>
                </div>

                {/* AccuWeather Official Link Action */}
                <a
                  href={accuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  <span>{isVi ? 'Xem dự báo chi tiết trên AccuWeather.com' : 'Open Detailed AccuWeather Forecast'}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Refresh and Timestamp */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>
                    {isVi ? 'Cập nhật:' : 'Updated:'} {new Date(data.updatedAt).toLocaleTimeString()}
                  </span>
                  <button
                    type="button"
                    onClick={fetchWeather}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600" />
                <p className="text-xs">{isVi ? 'Đang lấy dữ liệu thời tiết thực tế...' : 'Fetching realtime weather...'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
