export interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  role: 'customer' | 'provider' | 'tow_operator' | 'admin' | 'super_admin' | 'dispatch' | 'support';
  status: 'active' | 'suspended' | 'inactive' | 'pending_verification';
  is_phone_verified: boolean;
  is_email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Vehicle {
  id: number;
  user_id: number;
  make: string;
  model: string;
  year: string | null;
  registration_number: string;
  colour: string | null;
  fuel_type: string | null;
  vehicle_class: string;
  is_default: boolean;
  created_at: string;
}

export interface VehicleCreate {
  make: string;
  model: string;
  year?: string;
  registration_number: string;
  colour?: string;
  fuel_type?: string;
  vehicle_class: string;
  is_default?: boolean;
}

export interface ServiceType {
  id: number;
  category_id: number;
  name: string;
  code: string;
  description: string | null;
  requires_tow_vehicle: boolean;
  estimated_duration_minutes: number | null;
  is_active: boolean;
}

export interface Provider {
  id: number;
  user_id: number;
  business_name: string | null;
  provider_type: string;
  profile_status: string;
  average_rating: number;
  total_jobs_completed: number;
}

export interface ServiceRequest {
  id: number;
  uuid: string;
  customer_user_id: number;
  vehicle_id: number | null;
  service_type_id: number;
  service_type_name: string | null;
  assignment_id: number | null;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_address: string | null;
  issue_description: string | null;
  priority_level: string;
  channel: string;
  current_status: string;
  estimated_price: number | null;
  final_price: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  service_request_id: number;
  customer_id: number;
  amount: number;
  currency: string;
  method: string;
  status: string;
  external_reference: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Transaction {
  id: number;
  user_id: number;
  request_id: number | null;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  payment_provider: string | null;
  internal_reference: string | null;
  external_reference: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  pending_amount: number;
}

export interface ProviderProfile {
  id: number;
  user_id: number;
  business_name: string | null;
  provider_type: string;
  profile_status: string;
  service_description: string | null;
  average_rating: number;
  total_jobs_completed: number;
  created_at: string;
}

export interface CustomerProfile {
  id: number;
  user_id: number;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_payment_method: string | null;
  created_at: string;
}

export interface Rating {
  id: number;
  request_id: number;
  from_user_id: number;
  to_user_id: number;
  rating_score: number;
  review_text: string | null;
  created_at: string;
}

export interface ProviderEarnings {
  total_earned: number;
  pending_payout: number;
  total_jobs: number;
  currency: string;
}

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
}

export interface AdminProvider {
  id: number;
  user_id: number;
  business_name: string | null;
  provider_type: string;
  profile_status: string;
  average_rating: number;
  total_jobs_completed: number;
}

export interface AdminSummary {
  total_users: number;
  active_requests: number;
  completed_requests: number;
  total_revenue: number;
  total_providers: number;
  currency: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DailyMetric {
  date: string;
  total_requests: number;
  completed_requests: number;
  cancelled_requests: number;
  total_revenue: number;
  average_response_minutes: number | null;
}

