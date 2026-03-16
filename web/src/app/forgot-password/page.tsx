'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

type Step = 'send' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('send');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_or_email: phoneOrEmail }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Unable to send code');
        return;
      }
      setStep('reset');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_or_email: phoneOrEmail,
          otp_code: otp,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Reset failed');
        return;
      }
      setStep('done');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
        <p className="text-sm text-gray-500 mb-6">Use OTP verification to set a new password.</p>

        {step === 'send' && (
          <form onSubmit={sendCode} className="space-y-4">
            <input
              value={phoneOrEmail}
              onChange={(e) => setPhoneOrEmail(e.target.value)}
              required
              placeholder="Phone or email"
              className="w-full rounded-xl border border-gray-200 px-4 py-3"
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button className="w-full rounded-xl bg-yellow-400 py-3 font-semibold" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={resetPassword} className="space-y-4">
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              placeholder="OTP code"
              className="w-full rounded-xl border border-gray-200 px-4 py-3"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="New password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Confirm password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3"
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button className="w-full rounded-xl bg-yellow-400 py-3 font-semibold" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 p-4 text-green-700 text-sm">
              Password reset successful.
            </div>
            <Link href="/login" className="block w-full rounded-xl bg-yellow-400 py-3 text-center font-semibold">
              Back to Login
            </Link>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <Link href="/login" className="text-yellow-700 underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
