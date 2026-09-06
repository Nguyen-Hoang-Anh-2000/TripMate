import React, { useState } from 'react';
import { X, Sparkles, Loader2, Compass, Check, DollarSign, Calendar } from 'lucide-react';
import { AIItineraryPrompt } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AIItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGeneratedItinerary: (generatedData: any) => void;
}

export const AIItineraryModal: React.FC<AIItineraryModalProps> = ({
  isOpen,
  onClose,
  onApplyGeneratedItinerary,
}) => {
  const { lang, t } = useLanguage();
  const [destination, setDestination] = useState('Kyoto & Osaka');
  const [durationDays, setDurationDays] = useState(4);
  const [travelStyle, setTravelStyle] = useState<AIItineraryPrompt['travelStyle']>('Cultural & Foodie');
  const [groupType, setGroupType] = useState<AIItineraryPrompt['groupType']>('Friends');
  const [budgetAmount, setBudgetAmount] = useState('1800');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Food & Dining', 'Historical Temples', 'Photography'
  ]);

  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const interestsList = [
    'Food & Dining', 'Historical Temples', 'Photography', 'Shopping', 'Nightlife', 'Nature & Hiking', 'Art & Museums', 'Anime & Tech'
  ];

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setPreviewResult(null);

    try {
      const res = await fetch('/api/gemini/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          durationDays,
          travelStyle,
          groupType,
          budgetAmount: budgetAmount ? parseFloat(budgetAmount) : undefined,
          interests: selectedInterests,
          language: lang,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate AI itinerary.');
      }

      const data = await res.json();
      setPreviewResult(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error generating AI itinerary. Check Gemini API configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">{t('aiModal.headerTitle')}</h3>
              <p className="text-[11px] text-teal-200">{t('aiModal.poweredBy')}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body or Preview */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {!previewResult ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.destLabel')}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kyoto, Seoul, Reykjavik, Bali"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.durationLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value) || 3)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.styleLabel')}</label>
                  <select
                    value={travelStyle}
                    onChange={(e) => setTravelStyle(e.target.value as any)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  >
                    <option value="Cultural & Foodie">{t('aiStyle.cultural')}</option>
                    <option value="Balanced Explorer">{t('aiStyle.balanced')}</option>
                    <option value="Budget Backpacker">{t('aiStyle.budget')}</option>
                    <option value="Luxury & Wellness">{t('aiStyle.luxury')}</option>
                    <option value="Family Friendly">{t('aiStyle.family')}</option>
                    <option value="Thrill & Adventure">{t('aiStyle.thrill')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.groupLabel')}</label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value as any)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  >
                    <option value="Friends">{t('aiGroup.friends')}</option>
                    <option value="Couple">{t('aiGroup.couple')}</option>
                    <option value="Solo">{t('aiGroup.solo')}</option>
                    <option value="Family">{t('aiGroup.family')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('aiModal.budgetLabel')}</label>
                <input
                  type="number"
                  placeholder="1500"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('aiModal.interestsLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {interestsList.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {interest} {isSelected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('aiModal.generatingBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{t('aiModal.generateBtn')}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* AI Itinerary Preview */
            <div className="space-y-4">
              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-slate-900 text-base">{previewResult.destinationTitle}</h4>
                  <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-1 rounded-lg">
                    {t('aiModal.daysPlan', { count: previewResult.days?.length || 0 })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{previewResult.overallSummary}</p>
              </div>

              <div className="space-y-3">
                {previewResult.days?.map((d: any) => (
                  <div key={d.dayNumber} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <h5 className="font-display font-bold text-slate-900 text-xs">
                      Day {d.dayNumber}: {d.title}
                    </h5>
                    <p className="text-[11px] text-slate-500 mb-2">{d.summary}</p>
                    
                    <ul className="space-y-1.5">
                      {d.activities?.map((a: any, idx: number) => (
                        <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                          <span className="font-bold text-teal-700 shrink-0">{a.time}</span>
                          <div>
                            <span className="font-semibold text-slate-900">{a.title}</span> —{' '}
                            <span className="text-slate-500">{a.locationName}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewResult(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  {t('aiModal.editPrompt')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyGeneratedItinerary(previewResult);
                    onClose();
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {t('aiModal.applyBtn')}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
