'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

type Step = 'role' | 'details' | 'otp' | 'done';

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'customer' | 'provider'>('customer');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          password: form.password,
          email: form.email || undefined,
          role: role === 'provider' ? 'provider' : 'customer',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Registration failed. Please try again.');
        return;
      }
      // Account created — send OTP for phone verification
      await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_or_email: form.phone, purpose: 'verify_phone' }),
      });
      // Store token + user temporarily for auto-login after OTP
      sessionStorage.setItem('_reg_token', data.access_token);
      sessionStorage.setItem('_reg_user', JSON.stringify(data.user));
      setStep('otp');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_or_email: form.phone, otp_code: otp, purpose: 'verify_phone' }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Invalid OTP. Please try again.');
        return;
      }
      // OTP verified — sign in with the token we got at registration
      const token = sessionStorage.getItem('_reg_token') || '';
      const userJson = sessionStorage.getItem('_reg_user') || '{}';
      sessionStorage.removeItem('_reg_token');
      sessionStorage.removeItem('_reg_user');
      const user = JSON.parse(userJson);
      signIn(user, token);
      setStep('done');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setError('');
    await fetch(`${API}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_or_email: form.phone, purpose: 'verify_phone' }),
    });
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
          <p className="text-gray-500 mb-8">
            {role === 'provider'
              ? 'Your provider account has been created. Complete your profile to start accepting jobs.'
              : 'Your account has been created. You can now request roadside assistance anytime.'}
          </p>
          <button
            onClick={() => router.push(role === 'provider' ? '/provider/dashboard' : '/customer/dashboard')}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-xl transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-3xl font-black text-yellow-400 tracking-tight mb-1">LEE&apos;S</div>
          <div className="text-sm text-gray-500 font-medium uppercase tracking-widest">Road Assist</div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['role', 'details', 'otp'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                  s === step
                    ? 'bg-yellow-400 text-black'
                    : ['details', 'otp'].indexOf(s) <= ['role', 'details', 'otp'].indexOf(step)
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Step 1: Role selection */}
        {step === 'role' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Create your account</h2>
            <p className="text-gray-500 text-sm mb-6">How will you use Lee&apos;s Road Assist?</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => setRole('customer')}
                className={`p-5 rounded-xl border-2 text-left transition ${
                  role === 'customer' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">🚗</div>
                <div className="font-semibold text-gray-900">Customer</div>
                <div className="text-xs text-gray-500 mt-1">Request roadside help when you need it</div>
              </button>
              <button
                onClick={() => setRole('provider')}
                className={`p-5 rounded-xl border-2 text-left transition ${
                  role === 'provider' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">🔧</div>
                <div className="font-semibold text-gray-900">Provider</div>
                <div className="text-xs text-gray-500 mt-1">Offer roadside assistance services</div>
              </button>
            </div>
            <button
              onClick={() => setStep('details')}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-xl transition"
            >
              Continue
            </button>
            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{' '}
              <Link href="/login" className="text-yellow-600 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* Step 2: Personal details */}
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit}>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Personal details</h2>
            <p className="text-gray-500 text-sm mb-6">
              {role === 'provider' ? 'Provider account' : 'Customer account'}
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                  placeholder="John"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                  placeholder="Doe"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                placeholder="+263771000000"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john@example.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                name="confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={handleChange}
                required
                placeholder="Repeat your password"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('role')}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: OTP verification */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Verify your number</h2>
            <p className="text-gray-500 text-sm mb-6">
              We sent a 6-digit code to <strong>{form.phone}</strong>. Enter it below to activate your account.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                placeholder="123456"
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-2xl text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition mb-3"
            >
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>
            <button
              type="button"
              onClick={resendOtp}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Didn&apos;t receive a code? Resend
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
