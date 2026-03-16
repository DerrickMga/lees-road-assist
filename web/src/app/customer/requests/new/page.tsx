'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ServiceType, Vehicle } from '@/types';

const HARARE_LAT = -17.8292;
const HARARE_LNG = 31.0522;

const SERVICE_ICONS: Record<string, string> = {
  'Tyre Change': '🔄',
  'Jump Start': '⚡',
  'Fuel Delivery': '⛽',
  'Towing': '🚚',
  'Lockout': '🔑',
  'Mechanical': '🔧',
};

const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Cash on service',  icon: '💵' },
  { id: 'ecocash',  label: 'EcoCash',           icon: '📱' },
  { id: 'innbucks', label: 'InnBucks',           icon: '💳' },
  { id: 'onemoney', label: 'OneMoney',           icon: '💳' },
];

interface PriceEstimate {
  service_fee: number;
  callout_fee: number;
  towing_cost: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
}

export default function NewRequestPage() {
  const router = useRouter();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ServiceType[]>('/services/types').then(setServiceTypes).catch(console.error);
    api.get<Vehicle[]>('/vehicles/').then((v) => {
      setVehicles(v);
      const def = v.find((x) => x.is_default);
      if (def) setSelectedVehicle(def.id);
    }).catch(() => setVehicles([]));
  }, []);

  // Fetch price whenever service changes
  useEffect(() => {
    if (!selectedService) { setPriceEstimate(null); return; }
    setLoadingPrice(true);
    api.post<PriceEstimate>('/services/pricing/estimate', {
      service_type_code: selectedService.code,
      pickup_latitude: HARARE_LAT,
      pickup_longitude: HARARE_LNG,
    })
      .then(setPriceEstimate)
      .catch(() => setPriceEstimate(null))
      .finally(() => setLoadingPrice(false));
  }, [selectedService]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService) { setError('Please select a service type.'); return; }
    if (!pickupAddress.trim()) { setError('Please enter your pickup address.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const req = await api.post<{ uuid: string }>('/requests/', {
        service_type_id: selectedService.id,
        pickup_latitude: HARARE_LAT,
        pickup_longitude: HARARE_LNG,
        pickup_address: pickupAddress.trim(),
        issue_description: issueDescription.trim() || undefined,
        channel: 'web',
        vehicle_id: selectedVehicle ?? undefined,
      });
      // Navigate to checkout to complete payment
      router.push(`/customer/checkout/${req.uuid}?method=${paymentMethod}`);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-gray-900">Request Assistance</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>
        )}

        {/* Service Type */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            What do you need? <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.filter((t) => t.is_active).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedService(t)}
                className={`p-4 rounded-xl border-2 text-left transition ${
                  selectedService?.id === t.id
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{SERVICE_ICONS[t.name] ?? '🛠️'}</div>
                <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                {t.description && (
                  <div className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{t.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle Selection */}
        {vehicles.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Which vehicle? <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                className={`w-full p-3 rounded-xl border-2 text-left text-sm transition ${
                  selectedVehicle === null ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-gray-500">No specific vehicle</span>
              </button>
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVehicle(v.id)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition ${
                    selectedVehicle === v.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🚗</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {v.year ? `${v.year} ` : ''}{v.make} {v.model}
                        {v.is_default && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">Default</span>}
                      </p>
                      <p className="text-xs text-gray-400">{v.registration_number}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Location & Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Your location <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Corner Samora Machel & 4th Street, Harare"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-gray-400">Be as specific as possible for faster service.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              What happened? <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Describe the issue with your vehicle…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Price Estimate */}
        {selectedService && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 Price Estimate</h3>
            {loadingPrice ? (
              <div className="text-sm text-gray-400 animate-pulse">Calculating…</div>
            ) : priceEstimate ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>🔧 Service fee</span>
                  <span>${priceEstimate.service_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>📍 Callout fee</span>
                  <span>${priceEstimate.callout_fee.toFixed(2)}</span>
                </div>
                {priceEstimate.towing_cost > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>🚚 Towing</span>
                    <span>${priceEstimate.towing_cost.toFixed(2)}</span>
                  </div>
                )}
                {priceEstimate.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>🎉 Discount</span>
                    <span>-${priceEstimate.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
                  <span>Total</span>
                  <span className="text-yellow-600">${priceEstimate.total.toFixed(2)} {priceEstimate.currency}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Estimate based on standard rates. Final price confirmed at dispatch.</p>
              </div>
            ) : (
              <div className="text-sm text-gray-400">Price unavailable — our team will quote on arrival.</div>
            )}
          </div>
        )}

        {/* Payment Method */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-3">💳 Payment method</label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`p-3 rounded-xl border-2 text-left text-sm transition ${
                  paymentMethod === m.id
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="mr-1">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedService}
          className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition text-sm"
        >
          {submitting ? 'Submitting…' : priceEstimate ? `Request Assistance · $${priceEstimate.total.toFixed(2)}` : 'Request Assistance'}
        </button>
      </form>
    </div>
  );
}

