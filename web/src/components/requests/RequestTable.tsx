'use client';

import { ServiceRequest } from '@/types';
import { REQUEST_STATUSES } from '@/lib/constants';

interface RequestTableProps {
  requests: ServiceRequest[];
  onSelectRequest?: (request: ServiceRequest) => void;
}

export default function RequestTable({ requests, onSelectRequest }: RequestTableProps) {
  const getStatusBadge = (status: string) => {
    const statusInfo = REQUEST_STATUSES.find((s) => s.key === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      purple: 'bg-purple-100 text-purple-800',
      cyan: 'bg-cyan-100 text-cyan-800',
      orange: 'bg-orange-100 text-orange-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[statusInfo?.color || 'gray']}`}>
        {statusInfo?.label || status}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {requests.map((req) => (
            <tr
              key={req.uuid}
              className={`hover:bg-gray-50 ${onSelectRequest ? 'cursor-pointer' : ''}`}
              onClick={() => onSelectRequest?.(req)}
            >
              <td className="px-6 py-4 text-sm text-gray-500 font-mono">{req.uuid.slice(0, 8)}…</td>
              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                {req.service_type_name || `Type #${req.service_type_id}`}
              </td>
              <td className="px-6 py-4">{getStatusBadge(req.current_status)}</td>
              <td className="px-6 py-4 text-sm text-gray-500 capitalize">{req.channel}</td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {req.final_price
                  ? `${req.currency} ${req.final_price.toFixed(2)}`
                  : req.estimated_price
                  ? `~${req.currency} ${req.estimated_price.toFixed(2)}`
                  : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(req.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                No service requests found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

