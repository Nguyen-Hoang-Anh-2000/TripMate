import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search, Sparkles, X } from 'lucide-react';
import { TRIP_INTEREST_OPTIONS, TripInterestOption } from '../data/interestOptions';
import { normalizeText } from '../utils/itineraryPlannerUtils';

interface InterestsComboSelectProps {
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  isVi: boolean;
  options?: TripInterestOption[];
  placeholder?: string;
  label?: string;
  dropdownId?: string;
}

export const InterestsComboSelect: React.FC<InterestsComboSelectProps> = ({
  selectedIds,
  onChange,
  isVi,
  options = TRIP_INTEREST_OPTIONS,
  placeholder,
  label,
  dropdownId = 'trip-interests-combobox',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(searchTerm);
    if (!q) return options;
    return options.filter((opt) => {
      const labelStr = normalizeText(isVi ? opt.labelVi : opt.labelEn);
      const altStr = normalizeText(isVi ? opt.labelEn : opt.labelVi);
      return labelStr.includes(q) || altStr.includes(q) || opt.id.includes(q);
    });
  }, [options, searchTerm, isVi]);

  const selectedOptions = useMemo(
    () => options.filter((opt) => selectedIds.includes(opt.id)),
    [options, selectedIds]
  );

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const summaryText = useMemo(() => {
    if (selectedOptions.length === 0) {
      return placeholder || (isVi ? 'Chọn sở thích cho chuyến đi...' : 'Select trip interests...');
    }
    if (selectedOptions.length <= 2) {
      return selectedOptions.map((o) => (isVi ? o.labelVi : o.labelEn)).join(', ');
    }
    const firstTwo = selectedOptions
      .slice(0, 2)
      .map((o) => (isVi ? o.labelVi : o.labelEn))
      .join(', ');
    return isVi
      ? `${firstTwo} (+${selectedOptions.length - 2})`
      : `${firstTwo} (+${selectedOptions.length - 2})`;
  }, [selectedOptions, isVi, placeholder]);

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`${dropdownId}-trigger`}
            className="block text-xs font-semibold text-slate-700"
          >
            {label}
          </label>
          {selectedOptions.length > 0 && (
            <span className="text-[11px] font-semibold text-teal-700">
              {isVi ? `Đã chọn ${selectedOptions.length}` : `${selectedOptions.length} selected`}
            </span>
          )}
        </div>
      )}

      {/* Combo Selectbox Trigger */}
      <button
        id={`${dropdownId}-trigger`}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`${dropdownId}-listbox`}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 text-left text-xs px-3 py-2.5 sm:py-3 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-white border-teal-500 ring-2 ring-teal-500/20'
            : 'bg-slate-50/40 border-slate-200 hover:bg-white hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span
            className={`truncate ${
              selectedOptions.length > 0 ? 'text-slate-800 font-medium' : 'text-slate-400'
            }`}
          >
            {summaryText}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-teal-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          id={`${dropdownId}-listbox`}
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Search Bar inside Combo Selectbox */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isVi ? 'Tìm sở thích (vd: ẩm thực, thiên nhiên...)' : 'Search interests...'}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Option Rows */}
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100/80">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                {isVi ? 'Không tìm thấy sở thích phù hợp.' : 'No matching interests found.'}
              </div>
            ) : (
              filteredOptions.map((interest) => {
                const isSelected = selectedIds.includes(interest.id);
                return (
                  <button
                    key={interest.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(interest.id)}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/80 text-teal-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{isVi ? interest.labelVi : interest.labelEn}</span>
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Quick Controls */}
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onChange(selectedIds.length === options.length ? [] : options.map((o) => o.id))}
              className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              {selectedIds.length === options.length
                ? isVi
                  ? 'Bỏ chọn tất cả'
                  : 'Clear all'
                : isVi
                ? 'Chọn tất cả'
                : 'Select all'}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 text-[11px] font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              {isVi ? 'Xong' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
