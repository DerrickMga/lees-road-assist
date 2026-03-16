'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ServiceRequest } from '@/types';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ProviderEarnings {
  total_earned: number;
  pending_payout: number;
  total_jobs: number;
  currency: string;
}

const STATUS_ACTIONS: Record<string, { label: string; next: string } | null> = {
  dispatched: { label: 'Mark Arrived', next: 'arrived' },
  en_route: { label: 'Mark Arrived', next: 'arrived' },
  arrived: { label: 'Start Job', next: 'start' },
  in_progress: { label: 'Complete', next: 'complete' },
};

export default function ProviderDashboardPage() {
  const [jobs, setJobs] = useState<ServiceRequest[]>([]);
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  function loadData() {
    setLoading(true);
    setError('');
    Promise.all([
      api.get<ServiceRequest[]>('/providers/jobs'),
      api.get<ProviderEarnings>('/providers/earnings'),
    ])
      .then(([j, e]) => { setJobs(j); setEarnings(e); })
      .catch((err) => {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          setError('Cannot reach the server. Make sure the backend is running.');
        } else {
          setError((err as Error).message ?? 'Failed to load data.');
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function handleAction(job: ServiceRequest, action: string) {
    if (!job.assignment_id) return;
    setActing(job.uuid);
    try {
      await api.post(`/providers/jobs/${job.assignment_id}/${action}`, {});
      const statusMap: Record<string, string> = {
        arrived: 'arrived', start: 'in_progress', complete: 'completed',
      };
      setJobs((prev) =>
        prev.map((j) =>
          j.uuid === job.uuid ? { ...j, current_status: statusMap[action] ?? j.current_status } : j
        )
      );
    } catch (e) {
      setError((e as Error).message ?? 'Action failed.');
    } finally {
      setActing(null);
    }
  }

  const activeJobs = jobs.filter((j) => !['completed', 'cancelled'].includes(j.current_status));
  const completedJobs = jobs.filter((j) => j.current_status === 'completed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <WifiOff size={16} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={loadData} className="text-red-600 underline text-xs">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Total Earned</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {earnings?.total_earned != null ? `${earnings.currency} ${earnings.total_earned.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Pending Payout</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {earnings?.pending_payout != null ? `${earnings.currency} ${earnings.pending_payout.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{activeJobs.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Completed Jobs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{completedJobs.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">All Assigned Jobs</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Reference', 'Service', 'Status', 'Location', 'Customer', 'Price', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((j) => {
                  const actionDef = STATUS_ACTIONS[j.current_status];
                  return (
                    <tr key={j.uuid} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-xs font-mono text-gray-500">{j.uuid.slice(0, 8)}…</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{j.service_type_name ?? `#${j.service_type_id}`}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          j.current_status === 'completed' ? 'bg-green-100 text-green-800' :
                          j.current_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          j.current_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          j.current_status === 'arrived' ? 'bg-purple-100 text-purple-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{j.current_status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 max-w-[180px] truncate">{j.pickup_address ?? '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">#{j.customer_user_id}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {j.final_price ? `USD ${j.final_price}` : j.estimated_price ? `~USD ${j.estimated_price}` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        {actionDef && j.assignment_id && (
                          <button
                            onClick={() => handleAction(j, actionDef.next)}
                            disabled={acting === j.uuid}
                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {acting === j.uuid ? '…' : actionDef.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">No jobs assigned yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
