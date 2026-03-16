'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AdminProvider } from '@/types';
import { Plus, X, Eye, EyeOff, Copy, Check, RefreshCw, Wrench } from 'lucide-react';

interface CreateProviderForm {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  business_name: string;
  provider_type: 'individual' | 'business';
  license_number: string;
  national_id: string;
  password: string;
}

interface CreatedCredentials {
  name: string;
  phone: string;
  password: string;
}

const EMPTY_FORM: CreateProviderForm = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  business_name: '',
  provider_type: 'individual',
  license_number: '',
  national_id: '',
  password: '',
};

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Create Provider modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateProviderForm>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProviders();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProviders = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status_filter = statusFilter;
      const data = await api.get<AdminProvider[]>('/admin/providers', params);
      setProviders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(id);
      await api.post(`/admin/providers/${id}/approve`, {});
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, profile_status: 'approved' } : p)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: number) => {
    try {
      setActionLoading(id);
      await api.post(`/admin/providers/${id}/suspend`, {});
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, profile_status: 'suspended' } : p)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setCredentials(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCredentials(null);
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const result = await api.post<{
        id: number;
        first_name: string;
        last_name: string;
        phone: string;
        credentials: { phone: string; password: string };
      }>('/admin/users/create', { ...form, role: 'provider' });
      setCredentials({
        name: `${result.first_name} ${result.last_name}`,
        phone: result.credentials.phone,
        password: result.credentials.password,
      });
      loadProviders();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create provider');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCopy = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(
      `Name: ${credentials.name}\nPhone: ${credentials.phone}\nPassword: ${credentials.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
      rejected: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
        <div className="flex gap-3">
          <select
            title="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
          <button onClick={loadProviders} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 flex items-center gap-1">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={openModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Plus size={16} /> Create Provider
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Business', 'Type', 'Status', 'Rating', 'Jobs', 'Actions'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {p.business_name || <span className="text-gray-400 italic">No name</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">{p.provider_type.replace('_', ' ')}</td>
                  <td className="px-6 py-4">{statusBadge(p.profile_status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {'⭐'.repeat(Math.round(p.average_rating))} {p.average_rating.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.total_jobs_completed}</td>
                  <td className="px-6 py-4 flex gap-2">
                    {p.profile_status !== 'approved' && (
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={actionLoading === p.id}
                        className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
                      >
                        {actionLoading === p.id ? '…' : 'Approve'}
                      </button>
                    )}
                    {p.profile_status !== 'suspended' && (
                      <button
                        onClick={() => handleSuspend(p.id)}
                        disabled={actionLoading === p.id}
                        className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                      >
                        {actionLoading === p.id ? '…' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No providers found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Provider Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <Wrench size={20} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Create Provider Account</h2>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {credentials ? (
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <span className="text-base">⚠</span>
                  <p>Save these credentials now — the password will <strong>not</strong> be shown again.</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name</span>
                    <span className="text-white">{credentials.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone</span>
                    <span className="text-green-400">{credentials.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Password</span>
                    <span className="text-yellow-300">{credentials.password}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy Credentials'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      required
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      required
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+254700000000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
                  <input
                    value={form.business_name}
                    onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Doe Auto Services"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Provider Type *</label>
                  <select
                    value={form.provider_type}
                    onChange={(e) => setForm((f) => ({ ...f, provider_type: e.target.value as 'individual' | 'business' }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">License Number</label>
                    <input
                      value={form.license_number}
                      onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="LIC-XXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">National ID</label>
                    <input
                      value={form.national_id}
                      onChange={(e) => setForm((f) => ({ ...f, national_id: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      required
                      minLength={6}
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Min. 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {formLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Creating…
                      </>
                    ) : (
                      'Create Provider'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
