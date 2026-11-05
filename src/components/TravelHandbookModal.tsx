import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  Calendar,
  MapPin,
  Clock,
  Users,
  CheckCircle2,
  ShieldCheck,
  Luggage,
  DollarSign,
  Compass,
  FileText
} from 'lucide-react';
import { Trip } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';

interface TravelHandbookModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
}

export const TravelHandbookModal: React.FC<TravelHandbookModalProps> = ({
  trip,
  isOpen,
  onClose,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const [includeVault, setIncludeVault] = useState(true);
  const [includePacking, setIncludePacking] = useState(true);
  const [includeBudget, setIncludeBudget] = useState(true);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  // Generate self-contained printable HTML document
  const generatePrintableHtml = () => {
    const printableElement = document.querySelector('.travel-handbook-printable');
    const content = printableElement ? printableElement.innerHTML : '';

    return `<!DOCTYPE html>
<html lang="${isVi ? 'vi' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trip.title} - ${isVi ? 'Cẩm nang du lịch' : 'Travel Handbook'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; font-family: 'Be Vietnam Pro', -apple-system, sans-serif; }
    body { margin: 0; padding: 24px; color: #0f172a; background: #fff; font-size: 13px; line-height: 1.5; }
    @page { size: A4 portrait; margin: 1.2cm; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
    }
    .no-print-bar { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 10px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-weight: 500; font-size: 13px; color: #166534; }
    .print-btn { background: #0d9488; color: white; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .print-btn:hover { background: #0f766e; }
  </style>
  <script>
    window.onload = function() {
      setTimeout(function() {
        try { window.print(); } catch (e) {}
      }, 300);
    };
  </script>
</head>
<body>
  <div class="no-print no-print-bar">
    <span>💡 <strong>${isVi ? 'Mẹo xuất file:' : 'Tip:'}</strong> ${isVi ? 'Chọn "Lưu dưới dạng PDF" (Save as PDF) tại mục Đích in để lưu cẩm nang vào máy.' : 'Select "Save as PDF" as printer destination to save file.'}</span>
    <button class="print-btn" onclick="window.print()">🖨️ ${isVi ? 'In / Lưu PDF ngay' : 'Print / Save PDF'}</button>
  </div>
  ${content}
</body>
</html>`;
  };

  const handleDownloadHandbook = () => {
    const html = generatePrintableHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (trip.destination || trip.title || 'Trip').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    a.download = `Cam_Nang_Du_Lich_${safeTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('window.print() not available in iframe sandbox, downloading:', e);
      handleDownloadHandbook();
    }
  };

  // Calculate totals
  const totalActivities = trip.days.reduce((acc, d) => acc + d.activities.length, 0);
  const completedActivities = trip.days.reduce(
    (acc, d) => acc + d.activities.filter((a) => a.isCompleted).length,
    0
  );
  const totalSpent = trip.expenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto border border-slate-200">
        
        {/* Top Control Header - Hidden when printing */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base sm:text-lg">
                {isVi ? 'Cẩm nang du lịch & Xuất bản in' : 'Travel Handbook & Printable Guide'}
              </h3>
              <p className="text-xs text-slate-500">
                {isVi ? 'Xuất tài liệu du lịch A4 chuẩn quốc tế để in hoặc lưu PDF' : 'Standard A4 travel handbook ready for print or PDF export'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Direct Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title={isVi ? 'Mở cửa sổ in của trình duyệt' : 'Open browser print window'}
            >
              <Printer className="w-4 h-4" />
              <span>{isVi ? 'In trực tiếp' : 'Print'}</span>
            </button>

            {/* Guaranteed Download PDF/HTML Button */}
            <button
              type="button"
              onClick={handleDownloadHandbook}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title={isVi ? 'Tải file A4 có sẵn lệnh in tự động, không lo bị chặn' : 'Download standalone A4 file ready to print'}
            >
              <Download className="w-4 h-4 text-teal-400" />
              <span>{downloadSuccess ? (isVi ? 'Đã tải xong!' : 'Downloaded!') : (isVi ? 'Tải file in PDF' : 'Download PDF')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              title={isVi ? 'Đóng' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Configuration Controls - Hidden when printing */}
        <div className="px-4 sm:px-6 py-2.5 bg-teal-50/50 border-b border-teal-100 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 shrink-0 print:hidden">
          <span className="text-teal-900 font-semibold">{isVi ? 'Tùy chọn in:' : 'Print options:'}</span>
          
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeBudget}
              onChange={(e) => setIncludeBudget(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>{isVi ? 'Tài chính & Chi tiêu' : 'Financials & Budget'}</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeVault}
              onChange={(e) => setIncludeVault(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>{isVi ? 'Vé & Giấy tờ đặt chỗ' : 'Booking Codes & Tickets'}</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePacking}
              onChange={(e) => setIncludePacking(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>{isVi ? 'Danh mục hành lý' : 'Packing Checklist'}</span>
          </label>
        </div>

        {/* Printable Handbook Document Content */}
        <div className="overflow-y-auto p-4 sm:p-8 space-y-6 travel-handbook-printable bg-white text-slate-800">
          
          {/* Header Cover Banner */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-teal-700 tracking-wider uppercase bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {isVi ? 'CẨM NANG HÀNH TRÌNH CHÍNH THỨC' : 'OFFICIAL TRAVEL ITINERARY HANDBOOK'}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                  {trip.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                  <span className="flex items-center gap-1 font-semibold text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    {trip.destination}{trip.country ? `, ${trip.country}` : ''}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {trip.startDate} - {trip.endDate} ({trip.days.length} {isVi ? 'ngày' : 'days'})
                  </span>
                </div>
              </div>

              {/* Members */}
              <div className="text-left sm:text-right shrink-0">
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  {isVi ? 'Thành viên tham gia' : 'Trip Members'} ({trip.members.length}):
                </div>
                <div className="text-xs font-medium text-slate-800 flex flex-wrap sm:justify-end gap-1.5">
                  {trip.members.map((m) => (
                    <span key={m.id} className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Summary */}
          {includeBudget && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <div className="text-slate-500 text-[11px] font-medium">{isVi ? 'Tổng số ngày:' : 'Duration:'}</div>
                <div className="text-sm font-semibold text-slate-800 mt-0.5">{trip.days.length} {isVi ? 'ngày' : 'days'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[11px] font-medium">{isVi ? 'Số hoạt động:' : 'Activities:'}</div>
                <div className="text-sm font-semibold text-slate-800 mt-0.5">
                  {totalActivities} ({completedActivities} {isVi ? 'xong' : 'done'})
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[11px] font-medium">{isVi ? 'Ngân sách dự kiến:' : 'Budget Plan:'}</div>
                <div className="text-sm font-semibold text-blue-700 mt-0.5">
                  {formatMoney(trip.budgetTotal, trip.currency, lang)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[11px] font-medium">{isVi ? 'Thực tế đã chi:' : 'Total Spent:'}</div>
                <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                  {formatMoney(totalSpent, trip.currency, lang)}
                </div>
              </div>
            </div>
          )}

          {/* Day-by-Day Itinerary Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>{isVi ? 'Chi tiết lịch trình từng ngày' : 'Daily Itinerary Breakdown'}</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {trip.days.length} {isVi ? 'ngày hành trình' : 'itinerary days'}
              </span>
            </div>

            <div className="space-y-4">
              {trip.days.map((day) => (
                <div
                  key={day.dayNumber}
                  className="border border-slate-200 rounded-xl p-3.5 bg-white break-inside-avoid shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-teal-600 text-white rounded text-xs font-semibold">
                        {isVi ? `Ngày ${day.dayNumber}` : `Day ${day.dayNumber}`}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        {day.title || (isVi ? 'Lịch trình trong ngày' : 'Daily Schedule')}
                      </span>
                    </div>
                    {day.date && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        {day.date}
                      </span>
                    )}
                  </div>

                  {day.activities.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      {isVi ? 'Chưa có hoạt động được lên lịch cho ngày này.' : 'No scheduled activities for this day.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {day.activities.map((act, idx) => (
                        <div
                          key={act.id || idx}
                          className="flex items-start gap-2.5 text-xs text-slate-700 py-1 border-b border-slate-50 last:border-b-0"
                        >
                          <span className="font-mono text-[11px] font-medium text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60 shrink-0">
                            {act.time}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`font-semibold text-slate-800 ${act.isCompleted ? 'line-through text-slate-400' : ''}`}>
                                {act.title}
                              </span>
                              {act.locationName && (
                                <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {act.locationName}
                                </span>
                              )}
                            </div>
                            {act.notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{act.notes}</p>
                            )}
                          </div>

                          {act.estimatedCost !== undefined && act.estimatedCost > 0 && (
                            <span className="font-medium text-emerald-700 shrink-0 text-[11px]">
                              {formatMoney(act.estimatedCost, act.currency || trip.currency, lang)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Travel Vault / Important Documents & Tickets */}
          {includeVault && trip.documents && trip.documents.length > 0 && (
            <div className="space-y-3 pt-2 break-inside-avoid">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>{isVi ? 'Mã đặt chỗ, Vé máy bay & Khách sạn' : 'Booking Codes & Tickets'}</span>
                </h2>
                <span className="text-xs text-slate-500 font-medium">
                  {trip.documents.length} {isVi ? 'chứng từ' : 'records'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {trip.documents.map((doc) => (
                  <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{doc.title}</span>
                      <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                        {doc.docType}
                      </span>
                    </div>
                    {doc.codeOrNumber && (
                      <div className="text-[11px] text-slate-600">
                        {isVi ? 'Mã code:' : 'Code/Ref:'}{' '}
                        <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 select-all">
                          {doc.codeOrNumber}
                        </span>
                      </div>
                    )}
                    {doc.notes && (
                      <p className="text-[11px] text-slate-500">{doc.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Packing Checklist Summary */}
          {includePacking && trip.packingList && trip.packingList.length > 0 && (
            <div className="space-y-3 pt-2 break-inside-avoid">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Luggage className="w-4 h-4 text-teal-600" />
                  <span>{isVi ? 'Danh mục hành lý chuẩn bị' : 'Packing List Checklist'}</span>
                </h2>
                <span className="text-xs text-slate-500 font-medium">
                  {trip.packingList.filter((p) => p.isPacked).length}/{trip.packingList.length} {isVi ? 'đã chuẩn bị' : 'packed'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {trip.packingList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2"
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] shrink-0 ${
                      item.isPacked ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {item.isPacked ? '✓' : ''}
                    </div>
                    <span className={`truncate font-normal ${item.isPacked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
