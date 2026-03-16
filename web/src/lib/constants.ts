export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/v1/ws';

export const SERVICE_TYPES = [
  { key: 'battery_jumpstart', label: 'Battery Jumpstart', icon: '🔋' },
  { key: 'towing', label: 'Towing', icon: '🚛' },
  { key: 'puncture', label: 'Puncture / Tyre', icon: '🔧' },
  { key: 'fuel_delivery', label: 'Fuel Delivery', icon: '⛽' },
  { key: 'lockout', label: 'Lockout', icon: '🔑' },
  { key: 'overheating', label: 'Overheating', icon: '🌡️' },
  { key: 'mechanical', label: 'Mechanical', icon: '⚙️' },
  { key: 'vehicle_recovery', label: 'Vehicle Recovery', icon: '🚗' },
  { key: 'other', label: 'Other', icon: '❓' },
] as const;

export const REQUEST_STATUSES = [
  { key: 'pending', label: 'Pending', color: 'yellow' },
  { key: 'searching', label: 'Searching', color: 'blue' },
  { key: 'accepted', label: 'Accepted', color: 'indigo' },
  { key: 'en_route', label: 'En Route', color: 'purple' },
  { key: 'arrived', label: 'Arrived', color: 'cyan' },
  { key: 'in_progress', label: 'In Progress', color: 'orange' },
  { key: 'completed', label: 'Completed', color: 'green' },
  { key: 'cancelled', label: 'Cancelled', color: 'red' },
  { key: 'expired', label: 'Expired', color: 'gray' },
] as const;
