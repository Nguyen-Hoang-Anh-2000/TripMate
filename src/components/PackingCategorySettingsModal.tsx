import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, RotateCcw, Tag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface PackingCategoryConfig {
  id: string;
  nameVi: string;
  nameEn: string;
  icon: string;
}

export const DEFAULT_PACKING_CATEGORIES: PackingCategoryConfig[] = [
  { id: 'Essentials', nameVi: 'Thiết yếu', nameEn: 'Essentials', icon: '🛡️' },
  { id: 'Clothing', nameVi: 'Quần áo', nameEn: 'Clothing', icon: '👕' },
  { id: 'Electronics', nameVi: 'Đồ điện tử', nameEn: 'Electronics', icon: '📱' },
  { id: 'Toiletries', nameVi: 'Vệ sinh cá nhân', nameEn: 'Toiletries', icon: '🧴' },
  { id: 'Documents', nameVi: 'Giấy tờ', nameEn: 'Documents', icon: '📄' },
  { id: 'Gear', nameVi: 'Dụng cụ du lịch', nameEn: 'Gear', icon: '🎒' },
];

export const PACKING_STORAGE_KEY = 'tripmate_packing_categories';

export const getSavedPackingCategories = (): PackingCategoryConfig[] => {
  try {
    const raw = localStorage.getItem(PACKING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load packing categories', e);
  }
  return DEFAULT_PACKING_CATEGORIES;
};

interface PackingCategorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: PackingCategoryConfig[];
  onUpdateCategories: (newCats: PackingCategoryConfig[]) => void;
}

const QUICK_ICONS = ['🛡️', '👕', '📱', '🧴', '📄', '🎒', '💊', '🏖️', '📸', '👟', '🕶️', '☔', '🔋', '🎧'];

export const PackingCategorySettingsModal: React.FC<PackingCategorySettingsModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdateCategories,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  // Add Form state
  const [isAdding, setIsAdding] = useState(false);
  const [newNameVi, setNewNameVi] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newIcon, setNewIcon] = useState('🏷️');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameVi, setEditNameVi] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // Delete & Reset inline confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewNameVi('');
    setNewNameEn('');
    setNewIcon('🏷️');
    setErrorMessage('');
  };

  const handleSaveNew = () => {
    if (!newNameVi.trim()) {
      setErrorMessage(isVi ? 'Vui lòng nhập tên phân loại.' : 'Please enter category name.');
      return;
    }
    const newId = `cat_pkg_${Date.now()}`;
    const newCat: PackingCategoryConfig = {
      id: newId,
      nameVi: newNameVi.trim(),
      nameEn: newNameEn.trim() || newNameVi.trim(),
      icon: newIcon.trim() || '🏷️',
    };
    const updated = [...categories, newCat];
    localStorage.setItem(PACKING_STORAGE_KEY, JSON.stringify(updated));
    onUpdateCategories(updated);
    setIsAdding(false);
    setNewNameVi('');
    setNewNameEn('');
    setErrorMessage('');
  };

  const handleStartEdit = (cat: PackingCategoryConfig) => {
    setEditingId(cat.id);
    setEditNameVi(cat.nameVi);
    setEditNameEn(cat.nameEn);
    setEditIcon(cat.icon || '🏷️');
    setErrorMessage('');
  };

  const handleSaveEdit = (catId: string) => {
    if (!editNameVi.trim()) return;
    const updated = categories.map((c) => {
      if (c.id === catId) {
        return {
          ...c,
          nameVi: editNameVi.trim(),
          nameEn: editNameEn.trim() || editNameVi.trim(),
          icon: editIcon.trim() || c.icon || '🏷️',
        };
      }
      return c;
    });
    localStorage.setItem(PACKING_STORAGE_KEY, JSON.stringify(updated));
    onUpdateCategories(updated);
    setEditingId(null);
  };

  const handleConfirmDelete = (catId: string) => {
    if (categories.length <= 1) {
      setErrorMessage(isVi ? 'Phải giữ lại ít nhất một phân loại!' : 'Must keep at least one category!');
      setDeleteConfirmId(null);
      return;
    }
    const updated = categories.filter((c) => c.id !== catId);
    localStorage.setItem(PACKING_STORAGE_KEY, JSON.stringify(updated));
    onUpdateCategories(updated);
    setDeleteConfirmId(null);
  };

  const handleConfirmReset = () => {
    localStorage.setItem(PACKING_STORAGE_KEY, JSON.stringify(DEFAULT_PACKING_CATEGORIES));
    onUpdateCategories(DEFAULT_PACKING_CATEGORIES);
    setEditingId(null);
    setIsAdding(false);
    setShowResetConfirm(false);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-teal-400" />
            <h3 className="font-display font-bold text-sm sm:text-base">
              {isVi ? 'Cấu hình Phân loại Đồ đạc' : 'Packing Categories'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
          {/* Top Reset Button & Alert */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              {isVi ? `${categories.length} phân loại hiện có` : `${categories.length} categories`}
            </span>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
              title={isVi ? 'Khôi phục mặc định' : 'Reset to default'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isVi ? 'Khôi phục mặc định' : 'Reset'}</span>
            </button>
          </div>

          {/* Reset Confirmation Banner */}
          {showResetConfirm && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
              <span>{isVi ? 'Khôi phục lại 6 phân loại mặc định ban đầu?' : 'Reset to the 6 default categories?'}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2 py-1 text-slate-600 bg-white rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-2.5 py-1 text-white bg-amber-600 hover:bg-amber-700 rounded-md font-bold cursor-pointer"
                >
                  {isVi ? 'Đồng ý' : 'Yes'}
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
              {errorMessage}
            </p>
          )}

          {/* Add New Category Card */}
          {isAdding ? (
            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-3">
              <div className="font-bold text-xs text-teal-900 flex items-center justify-between">
                <span>{isVi ? 'Thêm Phân loại Mới' : 'Add New Category'}</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    {isVi ? 'Tên tiếng Việt *' : 'Vietnamese Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isVi ? 'Ví dụ: Đồ bơi, Mỹ phẩm...' : 'e.g. Swimwear, Cosmetics...'}
                    value={newNameVi}
                    onChange={(e) => setNewNameVi(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    {isVi ? 'Tên tiếng Anh' : 'English Name'}
                  </label>
                  <input
                    type="text"
                    placeholder={isVi ? 'Ví dụ: Swimwear' : 'e.g. Swimwear'}
                    value={newNameEn}
                    onChange={(e) => setNewNameEn(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {isVi ? 'Biểu tượng (Icon / Emoji)' : 'Icon / Emoji'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-14 text-center text-sm p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <div className="flex flex-wrap gap-1">
                    {QUICK_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setNewIcon(ic)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-white text-xs cursor-pointer"
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-lg cursor-pointer"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveNew}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Lưu' : 'Save'}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartAdd}
              className="w-full py-2.5 px-3 border border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 text-teal-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isVi ? 'Thêm Phân loại Mới' : 'Add New Category'}</span>
            </button>
          )}

          {/* List of categories */}
          <div className="space-y-1.5">
            {categories.map((cat) => {
              const isEditing = editingId === cat.id;
              const isDeletingThis = deleteConfirmId === cat.id;

              if (isEditing) {
                return (
                  <div key={cat.id} className="p-3 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          {isVi ? 'Tên tiếng Việt' : 'Vietnamese Name'}
                        </label>
                        <input
                          type="text"
                          value={editNameVi}
                          onChange={(e) => setEditNameVi(e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          {isVi ? 'Tên tiếng Anh' : 'English Name'}
                        </label>
                        <input
                          type="text"
                          value={editNameEn}
                          onChange={(e) => setEditNameEn(e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Icon:</span>
                        <input
                          type="text"
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          className="w-10 text-center text-xs p-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                        >
                          {isVi ? 'Hủy' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat.id)}
                          className="px-3 py-1 bg-teal-600 text-white font-bold text-xs rounded shadow-xs hover:bg-teal-700 cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>{isVi ? 'Lưu' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded-lg text-sm shrink-0">
                      {cat.icon || '🏷️'}
                    </span>
                    <div className="min-w-0 truncate">
                      <div className="font-bold text-xs text-slate-800 truncate">
                        {isVi ? cat.nameVi : cat.nameEn}
                      </div>
                    </div>
                  </div>

                  {isDeletingThis ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-rose-600 font-semibold">{isVi ? 'Xóa?' : 'Delete?'}</span>
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(cat.id)}
                        className="px-2 py-0.5 bg-rose-600 text-white text-xs font-bold rounded cursor-pointer"
                      >
                        {isVi ? 'Có' : 'Yes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded cursor-pointer"
                      >
                        {isVi ? 'Không' : 'No'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title={isVi ? 'Chỉnh sửa' : 'Edit'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(cat.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title={isVi ? 'Xóa' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
