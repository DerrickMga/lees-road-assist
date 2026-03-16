'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Plus, ChevronRight, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { ServiceRequest } from '@/types';
import { SERVICE_TYPES, REQUEST_STATUSES } from '@/lib/constants';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  searching: 'bg-blue-100 text-blue-800',
  accepted: 'bg-teal-100 text-teal-800',
  en_route: 'bg-indigo-100 text-indigo-800',
  arrived: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-600',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZW', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function CustomerRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ServiceRequest[]>('/requests/')
      .then(setRequests)
      .catch(() => setError('Failed to load requests'))
      .finally(() => setLoading(false));
  }, []);

  const getServiceLabel = (typeId: number, typeName: string | null) =>
    typeName ?? SERVICE_TYPES.find(s => s.key === String(typeId))?.label ?? `Service #${typeId}`;

  const getStatusLabel = (key: string) =>
    REQUEST_STATUSES.find(s => s.key === key)?.label ?? key;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
        <button
          onClick={() => router.push('/customer/requests/new')}
          className="flex items-center gap-2 bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#253359] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1a2744] border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench className="w-14 h-14 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg font-medium">No requests yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Tap &quot;New Request&quot; when you need roadside assistance.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {requests.map(req => (
          <Link
            key={req.uuid}
            href={`/customer/requests/${req.uuid}`}
            className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 truncate">
                    {getServiceLabel(req.service_type_id, req.service_type_name)}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[req.current_status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {getStatusLabel(req.current_status)}
                  </span>
                </div>
                {req.pickup_address && (
                  <p className="text-sm text-gray-500 truncate">{req.pickup_address}</p>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatDate(req.created_at)}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
            </div>
            {req.final_price != null && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-sm font-medium text-gray-700">
                ${req.final_price.toFixed(2)} {req.currency}
              </div>
            )}
            {req.estimated_price != null && req.final_price == null && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-sm text-gray-500">
                Est. ${req.estimated_price.toFixed(2)} {req.currency}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
