'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ProviderAsset, ProviderCapability, ProviderDocument, ProviderProfile, ServiceType } from '@/types';
import {
  Bike,
  Car,
  CheckCircle2,
  ClipboardList,
  FileBadge2,
  FilePlus2,
  LogOut,
  Plus,
  Radio,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react';

const PROFILE_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-slate-200 text-slate-700 border-slate-300',
};

const AVAILABILITY_STYLES: Record<string, string> = {
  available: 'bg-emerald-500',
  busy: 'bg-orange-500',
  on_break: 'bg-indigo-500',
  offline: 'bg-slate-400',
  suspended: 'bg-red-500',
};

const ASSET_TYPES = [
  { value: 'motorcycle', label: 'Motorcycle / Bike', Icon: Bike },
  { value: 'tow_truck', label: 'Tow Truck', Icon: Truck },
  { value: 'car', label: 'Service Car', Icon: Car },
  { value: 'van', label: 'Van', Icon: Truck },
  { value: 'pickup', label: 'Pickup', Icon: Truck },
  { value: 'toolkit', label: 'Toolkit / Equipment', Icon: Wrench },
  { value: 'recovery_trailer', label: 'Recovery Trailer', Icon: Truck },
];

const DOCUMENT_TYPES = [
  { value: 'id_document', label: 'ID Document' },
  { value: 'drivers_license', label: 'Driver\'s License' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'vehicle_registration', label: 'Vehicle Registration' },
  { value: 'roadworthiness', label: 'Roadworthiness' },
  { value: 'police_clearance', label: 'Police Clearance' },
];

function prettify(value: string | null | undefined) {
  if (!value) return 'Not set';
  return value.replace(/_/g, ' ');
}

export default function ProviderProfilePage() {
  const { user, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');

  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [assets, setAssets] = useState<ProviderAsset[]>([]);
  const [documents, setDocuments] = useState<ProviderDocument[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCapabilities, setSavingCapabilities] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const [removingDocumentId, setRemovingDocumentId] = useState<number | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [providerType, setProviderType] = useState('individual');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutReference, setPayoutReference] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('50');
  const [maxActiveJobs, setMaxActiveJobs] = useState('5');

  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<number[]>([]);

  const [assetType, setAssetType] = useState('motorcycle');
  const [assetRegistration, setAssetRegistration] = useState('');
  const [assetMake, setAssetMake] = useState('');
  const [assetModel, setAssetModel] = useState('');
  const [assetNotes, setAssetNotes] = useState('');

  const [documentType, setDocumentType] = useState('id_document');
  const [documentUrl, setDocumentUrl] = useState('');

  const available = profile?.availability_status === 'available';

  useEffect(() => {
    async function loadWorkspace() {
      setLoading(true);
      setError('');
      try {
        const [profileData, assetData, documentData, capabilityData, serviceTypeData] = await Promise.all([
          api.get<ProviderProfile>('/providers/profile'),
          api.get<ProviderAsset[]>('/providers/assets'),
          api.get<ProviderDocument[]>('/providers/documents'),
          api.get<ProviderCapability[]>('/providers/capabilities'),
          api.get<ServiceType[]>('/services/types'),
        ]);

        setProfile(profileData);
        setAssets(assetData);
        setDocuments(documentData);
        setServiceTypes(serviceTypeData);

        setBusinessName(profileData.business_name ?? '');
        setProviderType(profileData.provider_type ?? 'individual');
        setPhoneSecondary(profileData.phone_secondary ?? '');
        setNationalId(profileData.national_id ?? '');
        setLicenseNumber(profileData.license_number ?? '');
        setPayoutMethod(profileData.payout_method ?? '');
        setPayoutReference(profileData.payout_account_reference ?? '');
        setServiceRadiusKm(String(profileData.service_radius_km ?? 50));
        setMaxActiveJobs(String(profileData.max_active_jobs ?? 5));
        setSelectedCapabilityIds(capabilityData.map((item) => item.service_type_id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load provider workspace.');
      } finally {
        setLoading(false);
      }
    }

    loadWorkspace();
  }, []);

  useEffect(() => {
    if (!banner) {
      return;
    }
    const timeoutId = window.setTimeout(() => setBanner(''), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [banner]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    try {
      const updated = await api.put<ProviderProfile>('/providers/profile', {
        business_name: businessName || null,
        provider_type: providerType,
        phone_secondary: phoneSecondary || null,
        national_id: nationalId || null,
        license_number: licenseNumber || null,
        payout_method: payoutMethod || null,
        payout_account_reference: payoutReference || null,
        service_radius_km: Number(serviceRadiusKm || '0'),
        max_active_jobs: Number(maxActiveJobs || '0'),
      });
      setProfile(updated);
      setBanner('Provider profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleAvailability() {
    setTogglingAvailability(true);
    try {
      const nextStatus = available ? 'offline' : 'available';
      await api.post('/providers/availability', { status: nextStatus });
      setProfile((current) => (current ? { ...current, availability_status: nextStatus } : current));
      setBanner(`Availability set to ${nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability.');
    } finally {
      setTogglingAvailability(false);
    }
  }

  async function saveCapabilities() {
    setSavingCapabilities(true);
    try {
      await api.put<ProviderCapability[]>('/providers/capabilities', {
        service_type_ids: selectedCapabilityIds,
      });
      setBanner('Service capabilities updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service capabilities.');
    } finally {
      setSavingCapabilities(false);
    }
  }

  async function createAsset(event: FormEvent) {
    event.preventDefault();
    setSavingAsset(true);
    try {
      const created = await api.post<ProviderAsset>('/providers/assets', {
        asset_type: assetType,
        registration_number: assetRegistration || null,
        make: assetMake || null,
        model: assetModel || null,
        capacity_notes: assetNotes || null,
        is_active: true,
      });
      setAssets((current) => [created, ...current]);
      setAssetRegistration('');
      setAssetMake('');
      setAssetModel('');
      setAssetNotes('');
      setBanner('Vehicle or equipment added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add asset.');
    } finally {
      setSavingAsset(false);
    }
  }

  async function removeAsset(assetId: number) {
    setRemovingAssetId(assetId);
    try {
      await api.delete(`/providers/assets/${assetId}`);
      setAssets((current) => current.filter((item) => item.id !== assetId));
      setBanner('Asset removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove asset.');
    } finally {
      setRemovingAssetId(null);
    }
  }

  async function createDocument(event: FormEvent) {
    event.preventDefault();
    setSavingDocument(true);
    try {
      const created = await api.post<ProviderDocument>('/providers/documents', {
        document_type: documentType,
        file_url: documentUrl,
      });
      setDocuments((current) => [created, ...current]);
      setDocumentUrl('');
      setBanner('Compliance document added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add document.');
    } finally {
      setSavingDocument(false);
    }
  }

  async function removeDocument(documentId: number) {
    setRemovingDocumentId(documentId);
    try {
      await api.delete(`/providers/documents/${documentId}`);
      setDocuments((current) => current.filter((item) => item.id !== documentId));
      setBanner('Document removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove document.');
    } finally {
      setRemovingDocumentId(null);
    }
  }

  const capabilityMap = useMemo(() => new Set(selectedCapabilityIds), [selectedCapabilityIds]);

  const readinessItems = [
    { label: 'Profile basics', complete: Boolean(profile?.business_name && profile?.license_number) },
    { label: 'Vehicles and bikes', complete: assets.length > 0 },
    { label: 'Service capabilities', complete: selectedCapabilityIds.length > 0 },
    { label: 'Compliance documents', complete: documents.length > 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-300 border-t-orange-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 text-white shadow-xl">
        <div className="grid gap-8 px-6 py-7 md:grid-cols-[1.3fr_0.7fr] md:px-8">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-orange-300">Provider workspace</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">Build a provider profile that can actually be dispatched.</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300">
                  Add your bikes, vehicles, compliance documents and service capabilities so dispatch can match you correctly.
                </p>
              </div>
              {confirmLogout ? (
                <div className="rounded-2xl border border-white/15 bg-white/10 p-2 text-right text-xs">
                  <div className="mb-2 text-slate-200">Sign out now?</div>
                  <div className="flex gap-2">
                    <button onClick={signOut} className="rounded-xl bg-red-500 px-3 py-2 font-semibold text-white hover:bg-red-400">Yes</button>
                    <button onClick={() => setConfirmLogout(false)} className="rounded-xl bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/20">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmLogout(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
                >
                  <LogOut size={16} /> Sign out
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`rounded-full border px-3 py-1 font-semibold ${PROFILE_STATUS_STYLES[profile?.profile_status ?? 'pending'] ?? PROFILE_STATUS_STYLES.pending}`}>
                {prettify(profile?.profile_status)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-100">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-100">{user?.phone}</span>
              {user?.email && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-100">{user.email}</span>}
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Tier</div>
                <div className="mt-2 text-2xl font-bold capitalize">{profile?.tier ?? 'bronze'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Rating</div>
                <div className="mt-2 text-2xl font-bold">{profile?.average_rating?.toFixed(1) ?? '0.0'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Jobs done</div>
                <div className="mt-2 text-2xl font-bold">{profile?.total_jobs_completed ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Coverage</div>
                <div className="mt-2 text-2xl font-bold">{profile?.service_radius_km ?? 50}km</div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Dispatch visibility</div>
                <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                  <span className={`inline-block h-3 w-3 rounded-full ${AVAILABILITY_STYLES[profile?.availability_status ?? 'offline'] ?? AVAILABILITY_STYLES.offline}`} />
                  {prettify(profile?.availability_status)}
                </div>
              </div>
              <button
                onClick={toggleAvailability}
                disabled={togglingAvailability}
                aria-label={available ? 'Set provider offline' : 'Set provider available'}
                title={available ? 'Set provider offline' : 'Set provider available'}
                className={`relative h-7 w-14 rounded-full transition ${available ? 'bg-emerald-500' : 'bg-slate-600'} disabled:opacity-60`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${available ? 'left-8' : 'left-1'}`} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${item.complete ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
                    <CheckCircle2 size={13} /> {item.complete ? 'Ready' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {banner && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{banner}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-orange-100 p-3 text-orange-700"><ClipboardList size={18} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Business and compliance profile</h2>
              <p className="text-sm text-slate-500">Set the identity, payout, licensing and coverage details dispatch needs.</p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business or trading name</label>
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200" placeholder="Derrick Roadside Rescue" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Provider identity</label>
              <select title="Provider identity" value={providerType} onChange={(event) => setProviderType(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200">
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Secondary phone</label>
              <input value={phoneSecondary} onChange={(event) => setPhoneSecondary(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200" placeholder="+2637..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">National ID</label>
              <input value={nationalId} onChange={(event) => setNationalId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200" placeholder="63-123456A00" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">License number</label>
              <input value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200" placeholder="DL-009192" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payout method</label>
              <select title="Payout method" value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200">
                <option value="">Select payout method</option>
                <option value="ecocash">EcoCash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payout reference</label>
              <input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200" placeholder="EcoCash number or bank account" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Coverage radius (km)</label>
              <input type="number" min="1" title="Coverage radius in kilometers" placeholder="50" value={serviceRadiusKm} onChange={(event) => setServiceRadiusKm(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Max active jobs</label>
              <input type="number" min="1" title="Maximum active jobs" placeholder="5" value={maxActiveJobs} onChange={(event) => setMaxActiveJobs(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={savingProfile} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Radio size={18} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Service capabilities</h2>
              <p className="text-sm text-slate-500">Pick the services you can actually handle so dispatch can match correctly.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {serviceTypes.map((service) => (
              <label key={service.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${capabilityMap.has(service.id) ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                <input
                  type="checkbox"
                  checked={capabilityMap.has(service.id)}
                  onChange={() => {
                    setSelectedCapabilityIds((current) =>
                      current.includes(service.id)
                        ? current.filter((id) => id !== service.id)
                        : [...current, service.id],
                    );
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                />
                <div>
                  <div className="font-medium text-slate-900">{service.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{service.description || service.code}</div>
                  {service.requires_tow_vehicle && (
                    <div className="mt-2 inline-flex rounded-full bg-slate-900 px-2 py-1 text-[11px] font-medium text-white">Requires tow-capable vehicle</div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={saveCapabilities} disabled={savingCapabilities} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
              {savingCapabilities ? 'Saving...' : 'Save capabilities'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700"><Truck size={18} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Vehicles, bikes and equipment</h2>
              <p className="text-sm text-slate-500">Register every bike, truck, service van or toolkit you use in the field.</p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const AssetIcon = ASSET_TYPES.find((item) => item.value === asset.asset_type)?.Icon ?? Truck;
              return (
                <div key={asset.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm"><AssetIcon size={18} /></div>
                      <div>
                        <div className="font-semibold text-slate-900">{prettify(asset.asset_type)}</div>
                        <div className="text-xs text-slate-500">{asset.make || 'Unknown make'} {asset.model || ''}</div>
                      </div>
                    </div>
                    <button onClick={() => removeAsset(asset.id)} disabled={removingAssetId === asset.id} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                      {removingAssetId === asset.id ? '...' : 'Remove'}
                    </button>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div><span className="font-medium text-slate-800">Registration:</span> {asset.registration_number || 'Not provided'}</div>
                    <div><span className="font-medium text-slate-800">Notes:</span> {asset.capacity_notes || 'No notes added yet'}</div>
                  </div>
                </div>
              );
            })}
            {assets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                No vehicles or equipment added yet. Add at least one bike, tow truck, van or toolkit so dispatch understands your field capacity.
              </div>
            )}
          </div>

          <form onSubmit={createAsset} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Asset type</label>
              <select title="Asset type" value={assetType} onChange={(event) => setAssetType(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200">
                {ASSET_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Registration number</label>
              <input value={assetRegistration} onChange={(event) => setAssetRegistration(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200" placeholder="ABC1234" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Make</label>
              <input value={assetMake} onChange={(event) => setAssetMake(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200" placeholder="Toyota / Honda / Isuzu" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Model</label>
              <input value={assetModel} onChange={(event) => setAssetModel(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200" placeholder="Hilux / Fit / Boxer" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Capacity notes</label>
              <textarea value={assetNotes} onChange={(event) => setAssetNotes(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200" placeholder="Example: bike for battery jump-starts, truck with flatbed and winch, toolkit for lockouts" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={savingAsset} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                <Plus size={16} /> {savingAsset ? 'Adding...' : 'Add asset'}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><ShieldCheck size={18} /></div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Compliance documents</h2>
                <p className="text-sm text-slate-500">Keep your license, registration and ID links ready for review.</p>
              </div>
            </div>

            <div className="space-y-3">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{prettify(document.document_type)}</div>
                    <a href={document.file_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-sky-600 hover:underline">{document.file_url}</a>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${document.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {prettify(document.verification_status)}
                    </span>
                    <button onClick={() => removeDocument(document.id)} disabled={removingDocumentId === document.id} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                      {removingDocumentId === document.id ? '...' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">No documents uploaded yet.</div>
              )}
            </div>

            <form onSubmit={createDocument} className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Document type</label>
                <select title="Document type" value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200">
                  {DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">File URL</label>
                <input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200" placeholder="https://..." />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingDocument || !documentUrl.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  <FilePlus2 size={16} /> {savingDocument ? 'Adding...' : 'Add document'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><FileBadge2 size={18} /></div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Readiness summary</h2>
                <p className="text-sm text-slate-500">A quick view of what dispatch and compliance teams will see.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span>Profile status</span><span className="font-semibold capitalize text-slate-900">{prettify(profile?.profile_status)}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span>Identity model</span><span className="font-semibold capitalize text-slate-900">{prettify(profile?.provider_type)}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span>Assets listed</span><span className="font-semibold text-slate-900">{assets.length}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span>Documents uploaded</span><span className="font-semibold text-slate-900">{documents.length}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span>Capabilities selected</span><span className="font-semibold text-slate-900">{selectedCapabilityIds.length}</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
