import React, { useState } from 'react';
import { FileText, Plane, Hotel, ShieldCheck, Plus, Copy, Check, Trash2, ExternalLink } from 'lucide-react';
import { Trip, TravelDocument } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface TravelVaultViewProps {
  trip: Trip;
  onAddDocument: (doc: Omit<TravelDocument, 'id'>) => void;
  onDeleteDocument: (docId: string) => void;
}

export const TravelVaultView: React.FC<TravelVaultViewProps> = ({
  trip,
  onAddDocument,
  onDeleteDocument,
}) => {
  const { t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<TravelDocument['docType']>('Flight Ticket');
  const [codeOrNumber, setCodeOrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddDocument({
      title: title.trim(),
      docType,
      codeOrNumber: codeOrNumber.trim(),
      notes: notes.trim(),
      date,
    });

    setTitle('');
    setCodeOrNumber('');
    setNotes('');
    setShowAddModal(false);
  };

  const getDocIcon = (type: TravelDocument['docType']) => {
    switch (type) {
      case 'Flight Ticket': return <Plane className="w-5 h-5 text-indigo-600" />;
      case 'Hotel Voucher': return <Hotel className="w-5 h-5 text-blue-600" />;
      case 'Insurance': return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
      default: return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-slate-900 text-lg">{t('vault.title')}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{t('vault.subtitle')}</p>
        </div>

        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {t('vault.addBtn')}
        </button>
      </div>

      {/* Add Document Form */}
      {showAddModal && (
        <form onSubmit={handleFormSubmit} className="bg-white p-5 rounded-2xl border-2 border-teal-500/30 shadow-md space-y-4">
          <h4 className="font-display font-bold text-slate-900 text-sm">{t('vault.formTitle')}</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('vault.fieldTitle')}</label>
              <input
                type="text"
                required
                placeholder="e.g. ANA Flight NH007 Confirmation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('vault.fieldType')}</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value="Flight Ticket">{t('vault.typeFlight')}</option>
                <option value="Hotel Voucher">{t('vault.typeHotel')}</option>
                <option value="Insurance">{t('vault.typeInsurance')}</option>
                <option value="Passport/Visa">{t('vault.typePassport')}</option>
                <option value="Other">{t('vault.typeOther')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('vault.fieldCode')}</label>
              <input
                type="text"
                placeholder="e.g. JP-9821-X"
                value={codeOrNumber}
                onChange={(e) => setCodeOrNumber(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('vault.fieldDate')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('vault.fieldNotes')}</label>
            <input
              type="text"
              placeholder="e.g. Terminal 3 departure. Hot spring bath included in room."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t('itinerary.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              {t('vault.saveDoc')}
            </button>
          </div>
        </form>
      )}

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trip.documents.length === 0 ? (
          <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-slate-200/80">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">{t('vault.noDocs')}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('vault.noDocsSub')}</p>
          </div>
        ) : (
          trip.documents.map((doc) => (
            <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
                  {getDocIcon(doc.docType)}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">{doc.docType}</span>
                  <h4 className="text-xs font-bold text-slate-900">{doc.title}</h4>

                  {doc.codeOrNumber && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                        {doc.codeOrNumber}
                      </span>
                      <button
                        onClick={() => handleCopyCode(doc.codeOrNumber!, doc.id)}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 p-1"
                        title="Copy code"
                      >
                        {copiedId === doc.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 text-[10px]">{t('vault.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[10px]">{t('vault.copy')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {doc.notes && (
                    <p className="text-xs text-slate-600 mt-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      "{doc.notes}"
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => onDeleteDocument(doc.id)}
                className="text-slate-300 hover:text-red-600 p-1 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
