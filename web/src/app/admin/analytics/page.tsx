'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DailyMetric } from '@/types';
import StatCard from '@/components/dashboard/StatCard';

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DailyMetric[]>('/admin/analytics/daily')
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totals = metrics.reduce(
    (acc, m) => ({
      requests: acc.requests + m.total_requests,
      completed: acc.completed + m.completed_requests,
      cancelled: acc.cancelled + m.cancelled_requests,
      revenue: acc.revenue + m.total_revenue,
    }),
    { requests: 0, completed: 0, cancelled: 0, revenue: 0 }
  );

  const completionRate = totals.requests > 0
    ? ((totals.completed / totals.requests) * 100).toFixed(1)
    : '0.0';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics — Last 30 Days</h1>

      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="Total Requests" value={totals.requests} icon="📋" color="blue" />
            <StatCard title="Completed" value={totals.completed} icon="✅" color="green" />
            <StatCard title="Cancelled" value={totals.cancelled} icon="❌" color="red" />
            <StatCard title="Revenue" value={`USD ${totals.revenue.toFixed(2)}`} icon="💰" color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Completion Rate</h3>
              <p className="text-4xl font-bold text-green-700">{completionRate}%</p>
              <p className="text-xs text-gray-400 mt-1">of all requests completed</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Avg Revenue / Day</h3>
              <p className="text-4xl font-bold text-green-700">
                USD {metrics.length > 0 ? (totals.revenue / metrics.length).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-gray-400 mt-1">over {metrics.length} recorded days</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">Daily Breakdown</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Requests', 'Completed', 'Cancelled', 'Revenue', 'Avg Response'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metrics.map((m, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{m.total_requests}</td>
                    <td className="px-6 py-4 text-sm text-green-700">{m.completed_requests}</td>
                    <td className="px-6 py-4 text-sm text-red-600">{m.cancelled_requests}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">USD {m.total_revenue.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {m.average_response_minutes ? `${m.average_response_minutes} min` : '—'}
                    </td>
                  </tr>
                ))}
                {metrics.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No analytics data yet</td>
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
