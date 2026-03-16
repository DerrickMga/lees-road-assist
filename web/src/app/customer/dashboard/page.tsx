'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ServiceRequest } from '@/types';
import Link from 'next/link';
import { WifiOff, RefreshCw, CreditCard, Eye } from 'lucide-react';

export default function CustomerDashboardPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  function loadRequests() {
    setLoading(true);
    setError('');
    api.get<ServiceRequest[]>('/requests/')
      .then(setRequests)
      .catch((err) => {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          setError('Cannot reach the server. Make sure the backend is running.');
        } else {
          setError((err as Error).message ?? 'Failed to load requests.');
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadRequests(); }, []);

  async function handleCancel(uuid: string) {
    setCancelling(uuid);
    try {
      await api.post(`/requests/${uuid}/cancel`, {});
      setRequests((prev) =>
        prev.map((r) => r.uuid === uuid ? { ...r, current_status: 'cancelled' } : r)
      );
    } catch (e) {
      console.error(e);
    } finally {
      setCancelling(null);
    }
  }

  const active = requests.filter((r) => !['completed', 'cancelled'].includes(r.current_status));
  const completed = requests.filter((r) => r.current_status === 'completed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={loadRequests}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            href="/customer/requests/new"
            className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <span>+</span> New Request
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <WifiOff size={16} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={loadRequests} className="text-red-600 underline text-xs">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total', value: requests.length, color: 'blue' },
          { label: 'Active', value: active.length, color: 'yellow' },
          { label: 'Completed', value: completed.length, color: 'green' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-base font-semibold text-gray-900">All Requests</h2>
          </div>
          {requests.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 mb-4">No requests yet</p>
              <Link
                href="/customer/requests/new"
                className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Request Assistance
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Reference', 'Service', 'Status', 'Location', 'Date', 'Price', 'Actions'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requests.map((r) => {
                    const isActive = !['completed', 'cancelled'].includes(r.current_status);
                    const canPay = ['accepted', 'in_progress', 'completed'].includes(r.current_status)
                      && (r.estimated_price != null || r.final_price != null);
                    return (
                      <tr key={r.uuid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-xs font-mono text-gray-500">
                          <Link href={`/customer/requests/${r.uuid}`} className="hover:text-yellow-600 hover:underline">
                            {r.uuid.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{r.service_type_name ?? `#${r.service_type_id}`}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            r.current_status === 'completed' ? 'bg-green-100 text-green-800' :
                            r.current_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            r.current_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{r.current_status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{r.pickup_address ?? '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {r.final_price ? `$${r.final_price}` : r.estimated_price ? `~$${r.estimated_price}` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/customer/requests/${r.uuid}`}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                            >
                              <Eye size={12} /> View
                            </Link>
                            {canPay && (
                              <Link
                                href={`/customer/checkout/${r.uuid}`}
                                className="flex items-center gap-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded-lg px-2 py-1"
                              >
                                <CreditCard size={12} /> Pay
                              </Link>
                            )}
                            {isActive && (
                              <button
                                onClick={() => handleCancel(r.uuid)}
                                disabled={cancelling === r.uuid}
                                className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                              >
                                {cancelling === r.uuid ? 'Cancelling…' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
