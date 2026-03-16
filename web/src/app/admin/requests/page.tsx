'use client';

import { useEffect, useState } from 'react';
import RequestTable from '@/components/requests/RequestTable';
import { api } from '@/lib/api';
import { ServiceRequest } from '@/types';
import { REQUEST_STATUSES } from '@/lib/constants';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadRequests();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '200' };
      if (statusFilter) params.status_filter = statusFilter;
      const data = await api.get<ServiceRequest[]>('/admin/requests', params);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
        <div className="flex gap-3">
          <select
            title="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={loadRequests}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-800 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : (
          <>
            <div className="px-6 py-3 border-b text-sm text-gray-500">
              {requests.length} request{requests.length !== 1 ? 's' : ''}
            </div>
            <RequestTable requests={requests} />
          </>
        )}
      </div>
    </div>
  );
}
