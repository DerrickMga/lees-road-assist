'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ProviderProfile } from '@/types';
import { LogOut } from 'lucide-react';

const PROVIDER_TYPES = [
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'tow_operator', label: 'Tow Operator' },
  { value: 'roadside_assistant', label: 'Roadside Assistant' },
  { value: 'locksmith', label: 'Locksmith' },
  { value: 'fuel_delivery', label: 'Fuel Delivery' },
];

const STATUS_COLORS: Record<string, string> = {
  pending_verification: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  rejected: 'bg-gray-100 text-gray-700',
};

export default function ProviderProfilePage() {
  const { user, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [providerType, setProviderType] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');

  // Availability toggle
  const [available, setAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = await api.get<ProviderProfile & { is_available?: boolean }>('/providers/profile');
      setProfile(p);
      setBusinessName(p.business_name ?? '');
      setProviderType(p.provider_type ?? '');
      setServiceDescription(p.service_description ?? '');
      setAvailable((p as { is_available?: boolean }).is_available ?? false);
    } catch (e) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError('Cannot reach the server. Make sure the backend is running.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load profile.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await api.put('/providers/profile', {
        business_name: businessName || null,
        provider_type: providerType,
        service_description: serviceDescription || null,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability() {
    setTogglingAvailability(true);
    try {
      await api.post('/providers/availability', { is_available: !available });
      setAvailable(!available);
    } catch {
      // silently ignore
    } finally {
      setTogglingAvailability(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Provider Profile</h1>
        {confirmLogout ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Sign out?</span>
            <button onClick={signOut} className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium">Yes</button>
            <button onClick={() => setConfirmLogout(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs font-medium">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        )}
      </div>

      {/* Account + Status */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Account</h2>
          {profile && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[profile.profile_status] ?? 'bg-gray-100 text-gray-700'}`}>
              {profile.profile_status.replace('_', ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center text-2xl font-bold text-yellow-600 flex-shrink-0">
            {user?.first_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-sm text-gray-500">{user?.phone}</p>
          </div>
        </div>
        {profile && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile.total_jobs_completed}</p>
              <p className="text-xs text-gray-500">Jobs done</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile.average_rating.toFixed(1)}</p>
              <p className="text-xs text-gray-500">Avg rating</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 capitalize">{profile.provider_type.replace('_', ' ')}</p>
              <p className="text-xs text-gray-500">Type</p>
            </div>
          </div>
        )}
      </div>

      {/* Availability toggle */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Availability</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {available ? 'You are visible to customers and can receive jobs' : 'You are offline — no new jobs will be assigned'}
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={togglingAvailability}
            className={`relative w-12 h-6 rounded-full transition-colors ${available ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${available ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Edit Profile */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Business details</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">✅ Profile saved!</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. John's Roadside Repairs"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider type</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
            >
              <option value="">Select type…</option>
              {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service description</label>
            <textarea
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              rows={3}
              placeholder="Describe your services and experience…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="py-2.5 px-6 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition text-sm"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      {profile?.profile_status === 'pending_verification' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
          <div className="flex gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-semibold text-yellow-900">Verification pending</p>
              <p className="text-sm text-yellow-700 mt-1">
                Your profile is under review. You&apos;ll be notified via SMS once approved. Make sure to upload
                your required documents to speed up the process.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
