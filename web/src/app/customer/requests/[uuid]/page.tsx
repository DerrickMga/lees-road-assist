'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock, Search, CheckCircle, Truck, MapPin, Wrench, PartyPopper,
  DollarSign, Smartphone, Banknote, Star, ArrowLeft,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ServiceRequest, Transaction } from '@/types';

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending', Icon: Clock },
  { key: 'searching', label: 'Finding Provider', Icon: Search },
  { key: 'accepted', label: 'Accepted', Icon: CheckCircle },
  { key: 'en_route', label: 'En Route', Icon: Truck },
  { key: 'arrived', label: 'Arrived', Icon: MapPin },
  { key: 'in_progress', label: 'In Progress', Icon: Wrench },
  { key: 'completed', label: 'Completed', Icon: PartyPopper },
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', Icon: DollarSign },
  { id: 'ecocash', label: 'EcoCash', Icon: Smartphone },
  { id: 'onemoney', label: 'OneMoney', Icon: Banknote },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  searching: 'bg-blue-100 text-blue-800',
  accepted: 'bg-teal-100 text-teal-800',
  en_route: 'bg-indigo-100 text-indigo-800',
  arrived: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function RequestDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cancel
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  // Payment
  const [payMethod, setPayMethod] = useState<string>('cash');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);

  // Rating
  const [ratingScore, setRatingScore] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<ServiceRequest>(`/requests/${uuid}`);
      setRequest(r);
      // Try to load existing transaction for this request
      try {
        const txns = await api.get<Transaction[]>('/payments/transactions');
        const t = txns.find((tx) => tx.request_id === r.id);
        if (t) setTransaction(t);
      } catch {
        // ignore — no transactions or not authorized
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load request.');
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.post(`/requests/${uuid}/cancel`, { reason: cancelReason || undefined });
      await load();
      setShowCancel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel request.');
    } finally {
      setCancelling(false);
    }
  }

  async function handlePay() {
    if (!request) return;
    setPayError('');
    setPaying(true);
    try {
      const txn = await api.post<Transaction>('/payments/initialize', {
        request_id: request.id,
        payment_provider: payMethod,
        amount: request.estimated_price ?? 0,
        currency: request.currency ?? 'USD',
      });
      setTransaction(txn);
      setPaySuccess(true);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  async function handleRating() {
    if (!request || ratingScore === 0) return;
    setRatingError('');
    setRating(true);
    try {
      await api.post('/ratings/', {
        request_id: request.id,
        to_user_id: 0, // provider user id not directly available; submit with 0 as fallback
        rating_score: ratingScore,
        review_text: reviewText || undefined,
      });
      setRatingDone(true);
    } catch (e) {
      setRatingError(e instanceof Error ? e.message : 'Failed to submit rating.');
    } finally {
      setRating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-600">{error || 'Request not found.'}</p>
        <button onClick={() => router.back()} className="text-yellow-600 hover:underline">← Back</button>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === request.current_status);
  const canCancel = ['pending', 'searching'].includes(request.current_status);
  const needsPayment: boolean = ['accepted', 'in_progress', 'completed'].includes(request.current_status) && !transaction;
  const canRate = request.current_status === 'completed' && !ratingDone;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1">
            <ArrowLeft size={14} /> Back to requests
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {request.service_type_name ?? 'Assistance Request'}
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{request.uuid}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_COLORS[request.current_status] ?? 'bg-gray-100 text-gray-700'}`}>
          {request.current_status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Status Timeline */}
      {request.current_status !== 'cancelled' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Progress</h2>
          <div className="flex items-center gap-1">
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentStepIndex;
              const active = i === currentStepIndex;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                      active ? 'bg-yellow-400 ring-4 ring-yellow-100' : done ? 'bg-green-400' : 'bg-gray-200'
                    }`}>
                      <step.Icon size={14} className={active ? 'text-black' : done ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <span className={`text-[10px] mt-1 text-center leading-tight ${active ? 'text-yellow-700 font-semibold' : done ? 'text-green-700' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < currentStepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request Details */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Details</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Service</dt>
            <dd className="font-medium text-gray-900 mt-0.5">{request.service_type_name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Channel</dt>
            <dd className="font-medium text-gray-900 mt-0.5 capitalize">{request.channel ?? 'app'}</dd>
          </div>
          {request.pickup_address && (
            <div className="col-span-2">
              <dt className="text-gray-500">Pickup address</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{request.pickup_address}</dd>
            </div>
          )}
          {request.issue_description && (
            <div className="col-span-2">
              <dt className="text-gray-500">Issue description</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{request.issue_description}</dd>
            </div>
          )}
          {request.estimated_price != null && (
            <div>
              <dt className="text-gray-500">Estimated cost</dt>
              <dd className="font-semibold text-gray-900 mt-0.5 text-lg">
                ${request.estimated_price.toFixed(2)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Requested</dt>
            <dd className="font-medium text-gray-900 mt-0.5">
              {new Date(request.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Payment Section */}
      {needsPayment && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-yellow-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Payment</h2>
          {paySuccess ? (
            <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-xl p-4">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold">Payment initiated</p>
                <p className="text-sm">Ref: {transaction?.internal_reference}</p>
              </div>
            </div>
          ) : (
            <>
              {payError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{payError}</div>}
              <p className="text-sm text-gray-500 mb-4">Select your preferred payment method:</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPayMethod(m.id)}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${
                      payMethod === m.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <m.Icon size={24} className={payMethod === m.id ? 'text-yellow-600' : 'text-gray-400'} />
                    <span className="text-xs font-medium text-gray-700">{m.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition"
              >
                {paying ? 'Processing…' : `Pay ${request.estimated_price != null ? `$${request.estimated_price.toFixed(2)}` : ''} via ${PAYMENT_METHODS.find((m) => m.id === payMethod)?.label}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Existing transaction */}
      {transaction && !needsPayment && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Payment</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Method</p>
              <p className="font-semibold capitalize">{transaction.payment_provider ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-semibold">${transaction.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                transaction.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {transaction.status}
              </span>
            </div>
          </div>
          {transaction?.internal_reference && (
            <p className="text-xs text-gray-400 mt-3 font-mono">Ref: {transaction.internal_reference}</p>
          )}
        </div>
      )}

      {/* Rating Section */}
      {canRate && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Rate your provider</h2>
          {ratingDone ? (
            <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-xl p-4">
              <span className="text-2xl">⭐</span>
              <p className="font-semibold">Thank you for your feedback!</p>
            </div>
          ) : (
            <>
              {ratingError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{ratingError}</div>}
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRatingScore(s)}
                    className="transition hover:scale-110"
                  >
                    <Star
                      size={32}
                      className={s <= ratingScore ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Leave a comment (optional)"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4 resize-none"
              />
              <button
                onClick={handleRating}
                disabled={ratingScore === 0 || rating}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition"
              >
                {rating ? 'Submitting…' : 'Submit Rating'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Cancel */}
      {canCancel && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {!showCancel ? (
            <button
              onClick={() => setShowCancel(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Cancel this request
            </button>
          ) : (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Cancel request</h3>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)"
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-3 resize-none"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowCancel(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Keep request
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition"
                >
                  {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
