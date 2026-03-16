'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AdminProvider } from '@/types';
import { RefreshCw, ShieldCheck, UserX } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  suspended: 'Suspended',
  rejected: 'Rejected',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  async function loadProviders() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status_filter = statusFilter;
      const data = await api.get<AdminProvider[]>('/admin/providers', params);
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProviders();
  }, [statusFilter]);

  async function approveProvider(providerId: number) {
    setActionLoadingId(providerId);
    try {
      await api.post(`/admin/providers/${providerId}/approve`, {});
      setProviders((current) => current.map((provider) => (
        provider.id === providerId
          ? { ...provider, profile_status: 'approved' }
          : provider
      )));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve provider.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function suspendProvider(providerId: number) {
    setActionLoadingId(providerId);
    try {
      await api.post(`/admin/providers/${providerId}/suspend`, {});
      setProviders((current) => current.map((provider) => (
        provider.id === providerId
          ? { ...provider, profile_status: 'suspended' }
          : provider
      )));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to suspend provider.');
    } finally {
      setActionLoadingId(null);
    }
  }

  const filteredProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return providers;
    return providers.filter((provider) => {
      return (
        (provider.business_name || '').toLowerCase().includes(normalizedQuery)
        || provider.provider_type.toLowerCase().includes(normalizedQuery)
        || provider.profile_status.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [providers, query]);

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin Console</p>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Provider Management</h1>
            <p className="mt-1 text-sm text-slate-600">Approve, suspend, and review operational status for all service providers.</p>
          </div>
          <button
            onClick={loadProviders}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </section>

      <section className="surface-card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by business, type or status"
            className="min-w-72 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
            title="Filter providers by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No providers found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Business', 'Type', 'Status', 'Tier', 'Rating', 'Completed Jobs', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{provider.business_name || 'No business name'}</td>
                    <td className="px-4 py-3 text-sm capitalize text-slate-700">{provider.provider_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[provider.profile_status] || STATUS_STYLES.pending}`}>
                        {STATUS_LABELS[provider.profile_status] || provider.profile_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-slate-700">{provider.tier || 'bronze'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{provider.average_rating.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{provider.total_jobs_completed}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {provider.profile_status !== 'approved' && (
                          <button
                            onClick={() => approveProvider(provider.id)}
                            disabled={actionLoadingId === provider.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                          >
                            <ShieldCheck size={13} /> {actionLoadingId === provider.id ? '...' : 'Approve'}
                          </button>
                        )}
                        {provider.profile_status !== 'suspended' && (
                          <button
                            onClick={() => suspendProvider(provider.id)}
                            disabled={actionLoadingId === provider.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-60"
                          >
                            <UserX size={13} /> {actionLoadingId === provider.id ? '...' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
