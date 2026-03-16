'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProviderEarnings, Transaction } from '@/types';

export default function ProviderEarningsPage() {
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [e, t] = await Promise.all([
          api.get<ProviderEarnings>('/providers/earnings'),
          api.get<Transaction[]>('/payments/transactions').catch(() => [] as Transaction[]),
        ]);
        setEarnings(e);
        setTransactions(t);
      } catch (err) {
        if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
          setError('Cannot reach the server. Make sure the backend is running.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load earnings.');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-600">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(''); }}
          className="text-sm text-yellow-600 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const currency = earnings?.currency ?? 'USD';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total earned</p>
          <p className="text-2xl font-bold text-gray-900">
            {currency} {(earnings?.total_earned ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pending payout</p>
          <p className="text-2xl font-bold text-yellow-600">
            {currency} {(earnings?.pending_payout ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Jobs completed</p>
          <p className="text-2xl font-bold text-gray-900">{earnings?.total_jobs ?? 0}</p>
        </div>
      </div>

      {/* Pending payout info */}
      {(earnings?.pending_payout ?? 0) > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-xl">💰</span>
          <div className="text-sm text-yellow-800">
            You have <strong>{currency} {(earnings?.pending_payout ?? 0).toFixed(2)}</strong> pending payout.
            Payouts are processed every Friday.
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm text-gray-400">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((t) => (
              <div key={t.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                    t.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    {t.payment_provider === 'ecocash' ? '📱' : t.payment_provider === 'onemoney' ? '💰' : '💵'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {t.transaction_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleDateString()} · {t.payment_provider ?? 'cash'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {t.currency} {t.amount.toFixed(2)}
                  </p>
                  <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                    t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
