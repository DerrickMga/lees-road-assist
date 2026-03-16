'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Transaction } from '@/types';

export default function AdminPaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Transaction[]>('/payments/transactions', { limit: '100' })
      .then(setTransactions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      successful: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const total = transactions
    .filter((t) => t.status === 'successful' && t.transaction_type === 'payment')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg text-sm font-semibold">
          Total Revenue: USD {total.toFixed(2)}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['ID', 'Type', 'Amount', 'Provider', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">#{t.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 capitalize">{t.transaction_type.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{t.currency} {t.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{t.payment_provider || '—'}</td>
                  <td className="px-6 py-4">{statusBadge(t.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No transactions yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
