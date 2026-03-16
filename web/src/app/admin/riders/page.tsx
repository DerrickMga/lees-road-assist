'use client';

import { useEffect, useState } from 'react';
import {
  Truck, Phone, Mail, RefreshCw, UserCheck, UserX, WifiOff, Plus, X, Eye, EyeOff, Copy, CheckCheck,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AdminUser } from '@/types';

interface CreatedCredentials {
  name: string;
  phone: string;
  password: string;
}

interface CreateRiderForm {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password: string;
  national_id: string;
  license_number: string;
}

const emptyForm: CreateRiderForm = {
  first_name: '', last_name: '', phone: '', email: '', password: '', national_id: '', license_number: '',
};

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateRiderForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadRiders(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRiders = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { role: 'tow_operator' };
      if (statusFilter) params.status_filter = statusFilter;
      const data = await api.get<AdminUser[]>('/admin/users', params);
      setRiders(data);
    } catch (err) {
      setError(err instanceof TypeError ? 'Cannot reach the backend server.' : (err instanceof ApiError ? err.message : 'Failed to load riders.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.first_name || !form.last_name || !form.phone || !form.password) {
      setFormError('First name, last name, phone and password are required.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<{ first_name: string; last_name: string; credentials: { phone: string; password: string } }>(
        '/admin/users/create',
        { ...form, role: 'tow_operator', provider_type: 'individual' } as Record<string, unknown>,
      );
      setCreated({ name: `${res.first_name} ${res.last_name}`, phone: res.credentials.phone, password: res.credentials.password });
      setForm(emptyForm);
      loadRiders();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create rider.');
    } finally {
      setCreating(false);
    }
  };

  const copyCredentials = async (creds: CreatedCredentials) => {
    await navigator.clipboard.writeText(`Name: ${creds.name}\nPhone: ${creds.phone}\nPassword: ${creds.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSuspend = async (userId: number) => {
    try {
      setActionLoading(userId);
      await api.post(`/admin/users/${userId}/suspend`, {});
      setRiders((prev) => prev.map((r) => (r.id === userId ? { ...r, status: 'suspended' } : r)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId: number) => {
    try {
      setActionLoading(userId);
      await api.post(`/admin/users/${userId}/activate`, {});
      setRiders((prev) => prev.map((r) => (r.id === userId ? { ...r, status: 'active' } : r)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-600',
      pending_verification: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Truck size={22} className="text-teal-600" />
            <h1 className="text-2xl font-bold text-gray-900">Riders / Tow Operators</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 pl-8">
            {loading ? '…' : `${riders.length} total · ${riders.filter(r => r.status === 'active').length} active`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            title="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
            <option value="pending_verification">Pending</option>
          </select>
          <button
            onClick={loadRiders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => { setShowCreate(true); setCreated(null); setFormError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors"
          >
            <Plus size={14} />
            Add Rider
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <WifiOff size={16} className="flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Rider', 'Contact', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {riders.map((rider) => (
                <tr key={rider.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {rider.first_name[0]}{rider.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{rider.first_name} {rider.last_name}</p>
                        <p className="text-xs text-gray-400">ID #{rider.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600"><Phone size={12} className="text-gray-400" />{rider.phone}</span>
                      {rider.email && <span className="flex items-center gap-1.5 text-xs text-gray-400"><Mail size={12} />{rider.email}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">{statusBadge(rider.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(rider.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {rider.status === 'active' ? (
                      <button onClick={() => handleSuspend(rider.id)} disabled={actionLoading === rider.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                        <UserX size={12} />{actionLoading === rider.id ? '…' : 'Suspend'}
                      </button>
                    ) : (
                      <button onClick={() => handleActivate(rider.id)} disabled={actionLoading === rider.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors">
                        <UserCheck size={12} />{actionLoading === rider.id ? '…' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {riders.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-16 text-center">
                  <Truck size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No riders found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Rider Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add New Rider</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
            </div>

            {created ? (
              /* Credentials display after creation */
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <UserCheck size={20} className="text-teal-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Rider created successfully!</p>
                    <p className="text-sm text-gray-500">Share these credentials with the rider</p>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 font-mono text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium text-gray-900">{created.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium text-gray-900">{created.phone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Password</span><span className="font-medium text-gray-900">{created.password}</span></div>
                </div>
                <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ⚠ Save these credentials now — the password will not be shown again.
                </p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => copyCredentials(created)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                    {copied ? <><CheckCheck size={15} className="text-green-600" /> Copied!</> : <><Copy size={15} /> Copy credentials</>}
                  </button>
                  <button onClick={() => { setCreated(null); setShowCreate(false); }}
                    className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{formError}</div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                    <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
                    <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number *</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+263771234567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email (optional)</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">National ID</label>
                    <input value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">License Number</label>
                    <input value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                    {creating ? 'Creating…' : 'Create Rider'}
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
