import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, X, Check, AlertCircle, RefreshCw, Receipt, FileText, ChevronRight } from 'lucide-react';
import { CategoryType } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';

export interface ScannedReceiptData {
  storeName: string;
  totalAmount: number;
  currency: string;
  date: string;
  time?: string;
  category: CategoryType;
  items: Array<{ name: string; price: number; quantity?: number }>;
  notes: string;
  receiptImageBase64?: string;
}

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  onApplyReceipt: (data: ScannedReceiptData) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  currency,
  onApplyReceipt,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<ScannedReceiptData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessImage = async (base64: string, detectedMime: string) => {
    setImagePreview(base64);
    setMimeType(detectedMime);
    setScannedResult(null);
    setErrorMessage(null);
    setIsScanning(true);

    try {
      const response = await fetch('/api/gemini/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: detectedMime,
          language: isVi ? 'vi' : 'en',
          currency,
        }),
      });

      const json = await response.json();
      if (json.success && json.data) {
        setScannedResult({
          storeName: json.data.storeName || (isVi ? 'Hóa đơn chi tiêu' : 'Expense Receipt'),
          totalAmount: Number(json.data.totalAmount) || 0,
          currency: json.data.currency || currency,
          date: json.data.date || new Date().toISOString().split('T')[0],
          time: json.data.time || '',
          category: json.data.category || 'food',
          items: Array.isArray(json.data.items) ? json.data.items : [],
          notes: json.data.notes || '',
          receiptImageBase64: base64,
        });
      } else {
        throw new Error(json.error || 'Failed to scan receipt');
      }
    } catch (err: any) {
      console.error('[Receipt Scanner Error]:', err);
      setErrorMessage(
        isVi
          ? 'Không thể phân tích ảnh tự động. Bạn vẫn có thể nhập thông tin thủ công.'
          : 'Could not auto-scan receipt. You can still input manually.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage(isVi ? 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).' : 'Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      handleProcessImage(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!scannedResult) return;
    onApplyReceipt(scannedResult);
    onClose();
  };

  const handleReset = () => {
    setImagePreview(null);
    setScannedResult(null);
    setErrorMessage(null);
    setIsScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] my-auto overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">
                {isVi ? 'Quét Hóa Đơn AI (OCR)' : 'AI Receipt Scanner (OCR)'}
              </h3>
              <p className="text-[11px] text-slate-500 font-normal">
                {isVi ? 'Trích xuất tự động tên quán, số tiền, ngày và danh mục' : 'Auto-extract merchant, total, date & category'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain">
          {!imagePreview ? (
            /* Upload & Capture Options */
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-violet-200 hover:border-violet-400 bg-violet-50/40 hover:bg-violet-50/70 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-2xs text-violet-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">
                  {isVi ? 'Tải ảnh hóa đơn / biên lai từ thư viện' : 'Upload receipt from device'}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {isVi ? 'Hỗ trợ ảnh chụp hóa đơn ăn uống, vé tàu xe, phòng khách sạn (PNG, JPG)' : 'Supports dining bills, transport tickets, hotel vouchers'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-slate-700 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:border-slate-300"
                >
                  <Camera className="w-4 h-4 text-violet-600" />
                  <span>{isVi ? 'Chụp ảnh trực tiếp' : 'Take a Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-slate-700 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:border-slate-300"
                >
                  <Receipt className="w-4 h-4 text-teal-600" />
                  <span>{isVi ? 'Chọn từ thư viện' : 'Photo Library'}</span>
                </button>
              </div>

              {/* Sample Guidance */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  {isVi ? 'Mẹo chụp hóa đơn rõ nét:' : 'Tips for clear receipt scanning:'}
                </p>
                <p>• {isVi ? 'Đặt hóa đơn trên mặt phẳng có độ tương phản cao và đủ ánh sáng.' : 'Place receipt on a flat, well-lit surface.'}</p>
                <p>• {isVi ? 'Đảm bảo tên quán và dòng tổng tiền không bị che khuất.' : 'Ensure store name and total amount are clearly visible.'}</p>
              </div>
            </div>
          ) : (
            /* Scanning or Scanned Result Display */
            <div className="space-y-4">
              {/* Image Preview with Laser Scanning Animation if active */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-56">
                <img
                  src={imagePreview}
                  alt="Scanned Receipt"
                  className="w-full h-auto max-h-56 object-contain"
                />

                {isScanning && (
                  <div className="absolute inset-0 bg-violet-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center">
                    {/* Laser line moving vertically */}
                    <div className="absolute left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse top-1/2 transform -translate-y-1/2" />
                    <div className="bg-white/90 text-slate-900 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-600" />
                      <span>{isVi ? 'AI đang phân tích hóa đơn...' : 'AI analyzing receipt...'}</span>
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Scanned Extracted Data Card */}
              {scannedResult && (
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {isVi ? 'Đã nhận diện thành công' : 'Successfully Scanned'}
                    </span>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{isVi ? 'Quét ảnh khác' : 'Scan another'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                        {isVi ? 'Tên địa điểm / Hóa đơn' : 'Store / Merchant'}
                      </span>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        {scannedResult.storeName}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                        {isVi ? 'Tổng số tiền' : 'Total Amount'}
                      </span>
                      <p className="text-base font-bold text-teal-700 mt-0.5">
                        {formatMoney(scannedResult.totalAmount, scannedResult.currency || currency, lang)}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                        {isVi ? 'Ngày hóa đơn' : 'Date'}
                      </span>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">
                        {scannedResult.date || 'Hôm nay'} {scannedResult.time ? `(${scannedResult.time})` : ''}
                      </p>
                    </div>
                  </div>

                  {scannedResult.items && scannedResult.items.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                        {isVi ? 'Các món / dịch vụ trích xuất:' : 'Detected Items:'}
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {scannedResult.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/50">
                            <span className="truncate pr-2">• {it.name}</span>
                            <span className="font-semibold shrink-0 text-slate-900">
                              {formatMoney(it.price, scannedResult.currency || currency, lang)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {scannedResult.notes && (
                    <p className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/40 italic">
                      "{scannedResult.notes}"
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>

          {scannedResult && (
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isVi ? 'Áp dụng vào Form chi tiêu' : 'Apply to Expense Form'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
