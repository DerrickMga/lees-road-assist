'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

interface ServiceRequest {
  id: number;
  uuid: string;
  service_type_name: string | null;
  pickup_address: string | null;
  estimated_price: number | null;
  final_price: number | null;
  currency: string;
  pricing_breakdown: {
    service_fee: number;
    callout_fee: number;
    towing_cost: number;
    subtotal: number;
    discount: number;
    total: number;
  } | null;
  current_status: string;
}

interface TransactionResult {
  id: number;
  internal_reference: string;
  status: string;
  redirect_url: string | null;
  poll_url: string | null;
}

const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Cash on service',  icon: '💵', description: 'Pay the technician directly on arrival' },
  { id: 'ecocash',  label: 'EcoCash',           icon: '📱', description: 'USSD push to your EcoCash number' },
  { id: 'innbucks', label: 'InnBucks',           icon: '💳', description: 'USSD push to your InnBucks number' },
  { id: 'onemoney', label: 'OneMoney',           icon: '💳', description: 'USSD push to your OneMoney number' },
];

export default function CheckoutPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState(searchParams.get('method') ?? 'cash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ServiceRequest>(`/requests/${requestId}`)
      .then(setRequest)
      .catch(() => setError('Could not load request details.'))
      .finally(() => setLoading(false));
  }, [requestId]);

  const amount = request?.final_price ?? request?.estimated_price ?? 0;
  const breakdown = request?.pricing_breakdown;

  async function handlePay() {
    if (!request) return;
    if (paymentMethod !== 'cash' && !phoneNumber.trim()) {
      setError('Please enter your mobile number for the USSD push.');
      return;
    }
    setError(null);
    setPaying(true);
    try {
      const txn = await api.post<TransactionResult>('/payments/initialize', {
        request_id: request.id,
        payment_provider: paymentMethod,
        amount,
        currency: request.currency,
        ...(phoneNumber.trim() ? { phone_number: phoneNumber.trim() } : {}),
      });

      if (txn.redirect_url) {
        // Browser redirect to Paynow payment page
        window.location.href = txn.redirect_url;
        return;
      }

      if (paymentMethod === 'cash') {
        setPaid(true);
      } else {
        // Mobile money — USSD push triggered; show pending
        setPaid(true);
      }
    } catch (err) {
      setError((err as Error).message ?? 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{borderColor:'var(--brand-navy)',borderTopColor:'transparent'}} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-lg">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error ?? 'Request not found.'}
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-gray-900">
            {paymentMethod === 'cash' ? 'Request Confirmed!' : 'Payment Initiated!'}
          </h2>
          <p className="text-gray-500 text-sm">
            {paymentMethod === 'cash'
              ? 'Your technician has been dispatched. Please have cash ready on arrival.'
              : `Check your phone for a ${PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label} USSD prompt to complete payment.`}
          </p>
          <p className="text-xs text-gray-400">Reference: <span className="font-mono">{request.uuid}</span></p>
          <button
            onClick={() => router.push(`/customer/requests/${request.uuid}`)}
            style={{background:'var(--brand-navy)'}}
            className="mt-2 w-full hover:opacity-90 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            Track Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-gray-900">Confirm & Pay</h1>
      </div>

      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>
        )}

        {/* Request Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Request Summary</h3>
          <div className="space-y-1.5 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Service</span>
              <span className="font-semibold text-gray-900">{request.service_type_name ?? '—'}</span>
            </div>
            {request.pickup_address && (
              <div className="flex justify-between">
                <span>Location</span>
                <span className="text-right max-w-[60%]">{request.pickup_address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Status</span>
              <span className="capitalize">{request.current_status}</span>
            </div>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 Price Breakdown</h3>
          {breakdown ? (
            <div className="space-y-1.5 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>🔧 Service fee</span>
                <span>${breakdown.service_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>📍 Callout fee</span>
                <span>${breakdown.callout_fee.toFixed(2)}</span>
              </div>
              {breakdown.towing_cost > 0 && (
                <div className="flex justify-between">
                  <span>🚚 Towing</span>
                  <span>${breakdown.towing_cost.toFixed(2)}</span>
                </div>
              )}
              {breakdown.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>🎉 Discount</span>
                  <span>-${breakdown.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900 text-base">
                <span>Total due</span>
                <span style={{color:'var(--brand-red)'}}>${breakdown.total.toFixed(2)} {request.currency}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between font-bold text-gray-900">
              <span>Total due</span>
              <span style={{color:'var(--brand-red)'}}>${amount.toFixed(2)} {request.currency}</span>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">Prices in USD. Final price confirmed at dispatch.</p>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-3">💳 Payment method</label>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`w-full p-3.5 rounded-xl border-2 text-left transition ${
                  paymentMethod === m.id
                    ? 'border-[#1b1f5c] bg-[#f4f5fb]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{m.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                    <p className="text-xs text-gray-400">{m.description}</p>
                  </div>
                  {paymentMethod === m.id && (
                    <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{background:'var(--brand-navy)'}}>✓</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Phone number for mobile money */}
        {paymentMethod !== 'cash' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              📱 Mobile number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              placeholder="e.g. 0771234567"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b1f5c]"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400">
              You will receive a USSD push notification to approve the payment.
            </p>
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={paying}
          style={{background:'var(--brand-navy)'}}
          className="w-full hover:opacity-90 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition"
        >
          {paying ? 'Processing…' : paymentMethod === 'cash'
            ? '✅ Confirm Request (Pay on Arrival)'
            : `💳 Pay $${amount.toFixed(2)} via ${PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}`
          }
        </button>
      </div>
    </div>
  );
}
