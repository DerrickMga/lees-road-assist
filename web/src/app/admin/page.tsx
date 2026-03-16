'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  AlertCircle,
  CheckCircle,
  Wrench,
  DollarSign,
  Truck,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import RequestTable from '@/components/requests/RequestTable';
import { api, ApiError } from '@/lib/api';
import { AdminSummary, AdminUser, ServiceRequest } from '@/types';

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [riderCount, setRiderCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, reqs, riders] = await Promise.all([
        api.get<AdminSummary>('/admin/dashboard/summary'),
        api.get<ServiceRequest[]>('/admin/requests', { limit: '20' }),
        api.get<AdminUser[]>('/admin/users', { role: 'tow_operator' }),
      ]);
      setSummary(sum);
      setRequests(reqs);
      setRiderCount(riders.length);
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Cannot reach the backend server. Make sure it is running on port 8000.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard data.');
      }
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time operations summary</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <WifiOff size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="Total Users"
          value={loading ? '—' : (summary?.total_users ?? '—')}
          icon={<Users size={18} />}
          color="blue"
          href="/admin/users"
        />
        <StatCard
          title="Active Jobs"
          value={loading ? '—' : (summary?.active_requests ?? '—')}
          icon={<AlertCircle size={18} />}
          color="orange"
          href="/admin/requests"
        />
        <StatCard
          title="Completed"
          value={loading ? '—' : (summary?.completed_requests ?? '—')}
          icon={<CheckCircle size={18} />}
          color="green"
          href="/admin/requests"
        />
        <StatCard
          title="Providers"
          value={loading ? '—' : (summary?.total_providers ?? '—')}
          icon={<Wrench size={18} />}
          color="purple"
          href="/admin/providers"
        />
        <StatCard
          title="Riders"
          value={loading ? '—' : (riderCount ?? '—')}
          icon={<Truck size={18} />}
          color="teal"
          href="/admin/riders"
        />
        <StatCard
          title="Revenue"
          value={loading ? '—' : (summary ? `${summary.currency} ${summary.total_revenue.toFixed(2)}` : '—')}
          icon={<DollarSign size={18} />}
          color="green"
          href="/admin/payments"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Requests</h2>
          <a href="/admin/requests" className="text-sm text-yellow-600 hover:text-yellow-700 font-medium">
            View all →
          </a>
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : (
          <RequestTable requests={requests} />
        )}
      </div>
    </div>
  );
}
