import React, { useState } from 'react';
import { DollarSign, Plus, Users, PieChart, CreditCard, ArrowRight, Trash2, CheckCircle, Receipt, ArrowUpRight } from 'lucide-react';
import { Trip, Expense, CategoryType } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatMoney } from '../utils/formatCurrency';

interface ExpenseSplitterViewProps {
  trip: Trip;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (expenseId: string) => void;
}

export const ExpenseSplitterView: React.FC<ExpenseSplitterViewProps> = ({
  trip,
  onAddExpense,
  onDeleteExpense,
}) => {
  const { t, language } = useLanguage();
  const [showForm, setShowForm] = useState(false);

  // New expense form
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CategoryType>('food');
  const [paidBy, setPaidBy] = useState(trip.members[0]?.id || 'm1');
  const [splitWith, setSplitWith] = useState<string[]>(trip.members.map((m) => m.id));

  const totalSpent = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const budgetPercentage = Math.min(Math.round((totalSpent / (trip.budgetTotal || 1)) * 100), 100);

  // Calculate settlement balances
  // Member balances: positive = is owed money, negative = owes money
  const balances: Record<string, number> = {};
  trip.members.forEach((m) => (balances[m.id] = 0));

  trip.expenses.forEach((exp) => {
    const payer = exp.paidBy;
    const beneficiaries = exp.splitWith.length > 0 ? exp.splitWith : trip.members.map((m) => m.id);
    const splitAmount = exp.amount / beneficiaries.length;

    // Payer gains total expense amount
    balances[payer] = (balances[payer] || 0) + exp.amount;

    // Beneficiaries lose their share
    beneficiaries.forEach((bId) => {
      balances[bId] = (balances[bId] || 0) - splitAmount;
    });
  });

  // Calculate Who Owes Whom pairs
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  Object.entries(balances).forEach(([mId, bal]) => {
    if (bal > 0.01) creditors.push({ id: mId, amount: bal });
    if (bal < -0.01) debtors.push({ id: mId, amount: -bal });
  });

  const settlements: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;

  const credList = [...creditors];
  const debtList = [...debtors];

  while (i < debtList.length && j < credList.length) {
    const minAmt = Math.min(debtList[i].amount, credList[j].amount);
    if (minAmt > 0.01) {
      settlements.push({
        from: debtList[i].id,
        to: credList[j].id,
        amount: Math.round(minAmt * 100) / 100,
      });
    }

    debtList[i].amount -= minAmt;
    credList[j].amount -= minAmt;

    if (debtList[i].amount < 0.01) i++;
    if (credList[j].amount < 0.01) j++;
  }

  const handleToggleMemberSplit = (memberId: string) => {
    if (splitWith.includes(memberId)) {
      if (splitWith.length === 1) return; // Must split with at least 1
      setSplitWith(splitWith.filter((id) => id !== memberId));
    } else {
      setSplitWith([...splitWith, memberId]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || parseFloat(amount) <= 0) return;

    onAddExpense({
      title: title.trim(),
      amount: parseFloat(amount),
      currency: trip.currency || 'USD',
      category,
      paidBy,
      splitWith,
      date: new Date().toISOString().split('T')[0],
    });

    setTitle('');
    setAmount('');
    setShowForm(false);
  };

  const getMemberName = (id: string) => trip.members.find((m) => m.id === id)?.name || 'Trip Member';

  return (
    <div className="space-y-6">
      
      {/* Top Overview Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total Budget Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('expenses.totalSpent')}</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900">{formatMoney(totalSpent, trip.currency, language)}</span>
            <span className="text-xs text-slate-500">/ {formatMoney(trip.budgetTotal, trip.currency, language)}</span>
          </div>

          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  budgetPercentage > 90 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${budgetPercentage}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{t('expenses.budgetUtilized', { pct: budgetPercentage })}</p>
          </div>
        </div>

        {/* Group Members Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('expenses.splitters')}</span>
            <Users className="w-5 h-5 text-teal-600" />
          </div>
          <div className="mt-3 flex items-center -space-x-2">
            {trip.members.map((m) => (
              <img
                key={m.id}
                src={m.avatar}
                alt={m.name}
                className="w-9 h-9 rounded-full border-2 border-white object-cover shadow-2xs"
                title={m.name}
              />
            ))}
            <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 font-bold text-xs flex items-center justify-center border-2 border-white shadow-2xs">
              {trip.members.length}
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2">{t('expenses.equalSharing')}</p>
        </div>

        {/* Add Expense Action Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-base">{t('expenses.newExpenseTitle')}</h3>
            <p className="text-xs text-slate-300 mt-0.5">{t('expenses.newExpenseDesc')}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="mt-3 w-full py-2 px-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            {showForm ? t('expenses.cancelForm') : t('expenses.addExpenseBtn')}
          </button>
        </div>

      </div>

      {/* Expense Form Modal / Collapsible */}
      {showForm && (
        <form onSubmit={handleFormSubmit} className="bg-white p-5 rounded-2xl border-2 border-teal-500/30 shadow-md space-y-4">
          <h3 className="font-display font-bold text-slate-900 text-base">{t('expenses.logTitle')}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('expenses.fieldDesc')}</label>
              <input
                type="text"
                required
                placeholder="e.g., Gion Izakaya Dinner"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('expenses.fieldAmount', { currency: trip.currency })}</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="120.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('itinerary.fieldCategory')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value="food">{t('cat.food')}</option>
                <option value="stay">{t('cat.stay')}</option>
                <option value="transport">{t('cat.transport')}</option>
                <option value="sightseeing">{t('cat.sightseeing')}</option>
                <option value="shopping">{t('cat.shopping')}</option>
                <option value="other">{t('cat.other')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('expenses.fieldPaidBy')}</label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {trip.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('expenses.fieldSplitWith')}</label>
              <div className="flex flex-wrap gap-2">
                {trip.members.map((m) => {
                  const isSelected = splitWith.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleMemberSplit(m.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-teal-50 text-teal-800 border-teal-300'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {m.name} {isSelected ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t('itinerary.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              {t('expenses.saveExpense')}
            </button>
          </div>
        </form>
      )}

      {/* Settlements & Expense History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settlements Calculation ("Who Owes Whom") */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900 text-base">{t('expenses.settlementSummary')}</h3>
            <span className="text-xs text-slate-400">{t('expenses.minimizationMatrix')}</span>
          </div>

          <div className="mt-4 space-y-3">
            {settlements.length === 0 ? (
              <div className="p-4 text-center bg-emerald-50/60 rounded-xl border border-emerald-100">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-xs font-bold text-emerald-900">{t('expenses.allSettled')}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">{t('expenses.noPendingDebts')}</p>
              </div>
            ) : (
              settlements.map((s, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      <span className="text-slate-900 font-bold">{getMemberName(s.from)}</span> {t('expenses.owes')}{' '}
                      <span className="text-teal-700 font-bold">{getMemberName(s.to)}</span>
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                    {formatMoney(s.amount, trip.currency, language)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Individual Balances */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('expenses.memberBalances')}</h4>
            <div className="space-y-2">
              {trip.members.map((m) => {
                const bal = balances[m.id] || 0;
                return (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                      <span className="font-medium text-slate-800">{m.name}</span>
                    </div>
                    <span
                      className={`font-bold ${
                        bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}
                    >
                      {bal > 0
                        ? `+${formatMoney(bal, trip.currency, language)}`
                        : bal < 0
                        ? `-${formatMoney(Math.abs(bal), trip.currency, language)}`
                        : formatMoney(0, trip.currency, language)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Expenses Log */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900 text-base">{t('expenses.historyTitle')}</h3>
            <span className="text-xs text-slate-500">{t('expenses.recordsCount', { count: trip.expenses.length })}</span>
          </div>

          <div className="mt-4 space-y-3">
            {trip.expenses.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">{t('expenses.noExpenses')}</p>
            ) : (
              trip.expenses.map((exp) => (
                <div key={exp.id} className="p-3.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/70 transition-all flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200/60 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{exp.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('expenses.paidBy')} <span className="font-semibold text-slate-700">{getMemberName(exp.paidBy)}</span> • {t('expenses.splitAmong', { count: exp.splitWith.length })}
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                        {exp.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      {formatMoney(exp.amount, exp.currency || trip.currency, language)}
                    </span>
                    <button
                      onClick={() => onDeleteExpense(exp.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
