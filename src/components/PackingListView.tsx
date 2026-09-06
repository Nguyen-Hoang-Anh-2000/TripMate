import React, { useState } from 'react';
import { CheckSquare, Square, Plus, Sparkles, Package, Trash2, CheckCircle2 } from 'lucide-react';
import { Trip, PackingItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PackingListViewProps {
  trip: Trip;
  onToggleItem: (itemId: string) => void;
  onAddItem: (item: Omit<PackingItem, 'id' | 'isPacked'>) => void;
  onDeleteItem: (itemId: string) => void;
  onGenerateAiPackingList: () => void;
  isAiLoading: boolean;
}

const CATEGORIES = ['Essentials', 'Clothing', 'Electronics', 'Toiletries', 'Documents', 'Gear'] as const;

export const PackingListView: React.FC<PackingListViewProps> = ({
  trip,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  onGenerateAiPackingList,
  isAiLoading,
}) => {
  const { t } = useLanguage();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<typeof CATEGORIES[number]>('Essentials');
  const [newItemQty, setNewItemQty] = useState(1);

  const packedCount = trip.packingList.filter((i) => i.isPacked).length;
  const totalCount = trip.packingList.length;
  const packedPercentage = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    onAddItem({
      category: newItemCategory,
      name: newItemName.trim(),
      quantity: newItemQty || 1,
    });

    setNewItemName('');
    setNewItemQty(1);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Progress */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-slate-900 text-lg">{t('packing.title')}</h3>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              {t('packing.progress', { packed: packedCount, total: totalCount })}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{t('packing.subtitle', { dest: trip.destination })}</p>
          
          <div className="mt-3 w-64 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${packedPercentage}%` }}
            ></div>
          </div>
        </div>

        <button
          onClick={onGenerateAiPackingList}
          disabled={isAiLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : ''}`} />
          <span>{isAiLoading ? t('packing.aiGenerating') : t('packing.aiGenerate')}</span>
        </button>
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleFormSubmit} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-end gap-3">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('packing.itemName')}</label>
          <input
            type="text"
            required
            placeholder="e.g., Universal Power Adapter or Passport"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          />
        </div>

        <div className="w-full sm:w-40">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('packing.category')}</label>
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as any)}
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-24">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('packing.qty')}</label>
          <input
            type="number"
            min="1"
            value={newItemQty}
            onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          />
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1 shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('packing.addItem')}
        </button>
      </form>

      {/* Categorized Checklist View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const itemsInCat = trip.packingList.filter((i) => i.category === cat);
          if (itemsInCat.length === 0 && selectedCategoryFilter !== 'All') return null;

          return (
            <div key={cat} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" />
                  {cat}
                </h4>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {itemsInCat.filter((i) => i.isPacked).length}/{itemsInCat.length}
                </span>
              </div>

              {itemsInCat.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">{t('packing.noItemsCat', { cat })}</p>
              ) : (
                <div className="space-y-2">
                  {itemsInCat.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        item.isPacked
                          ? 'bg-slate-50/60 border-slate-200/60 opacity-60'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <button
                        onClick={() => onToggleItem(item.id)}
                        className="flex items-center gap-2.5 text-left flex-1"
                      >
                        {item.isPacked ? (
                          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className={`text-xs font-semibold text-slate-800 ${item.isPacked ? 'line-through text-slate-400' : ''}`}>
                          {item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}
                        </span>
                      </button>

                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-slate-300 hover:text-red-600 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
