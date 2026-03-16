'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, getRoleHome } from '@/lib/auth';
import { AuthResponse } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

type ForgotStep = 'idle' | 'send' | 'reset' | 'success';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<ForgotStep>('idle');
  const [fpPhone, setFpPhone] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpPassword, setFpPassword] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/login', { phone, password });
      signIn(res.user, res.access_token);
      router.push(getRoleHome(res.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid phone or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSend = async (e: FormEvent) => {
    e.preventDefault();
    setFpError('');
    setFpLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_or_email: fpPhone }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFpError(d.detail || 'Could not send reset code.');
        return;
      }
      setForgotStep('reset');
    } finally {
      setFpLoading(false);
    }
  };

  const handleForgotReset = async (e: FormEvent) => {
    e.preventDefault();
    setFpError('');
    if (fpPassword !== fpConfirm) { setFpError('Passwords do not match.'); return; }
    if (fpPassword.length < 8) { setFpError('Password must be at least 8 characters.'); return; }
    setFpLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_or_email: fpPhone, otp_code: fpOtp, new_password: fpPassword }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFpError(d.detail || 'Reset failed. Check your code and try again.');
        return;
      }
      setForgotStep('success');
    } finally {
      setFpLoading(false);
    }
  };

  const closeForgot = () => {
    setForgotStep('idle');
    setFpPhone(''); setFpOtp(''); setFpPassword(''); setFpConfirm(''); setFpError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lee's Road Assist" className="h-16 mx-auto mb-4" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div className="text-3xl font-black text-yellow-400 tracking-tight">LEE&apos;S</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Road Assist</div>
          <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in to your account</p>
        </div>

        {/* Login form */}
        {forgotStep === 'idle' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 transition text-sm"
                placeholder="+263771000000"
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => setForgotStep('send')}
                  className="text-xs text-yellow-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 transition text-sm"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black py-3 rounded-xl font-semibold transition"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="text-center text-sm text-gray-500 pt-2">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-yellow-600 font-medium hover:underline">Create one</Link>
            </p>
          </form>
        )}

        {/* Forgot password — Step 1: enter phone */}
        {forgotStep === 'send' && (
          <form onSubmit={handleForgotSend} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={closeForgot} className="text-gray-400 hover:text-gray-700 text-xl leading-none">←</button>
              <h2 className="font-semibold text-gray-900">Reset your password</h2>
            </div>
            <p className="text-sm text-gray-500">Enter your phone number and we&apos;ll send you a reset code.</p>
            {fpError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{fpError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
              <input
                type="tel"
                value={fpPhone}
                onChange={(e) => setFpPhone(e.target.value)}
                required
                placeholder="+263771000000"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 transition text-sm"
              />
            </div>
            <button type="submit" disabled={fpLoading} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition">
              {fpLoading ? 'Sending…' : 'Send Reset Code'}
            </button>
          </form>
        )}

        {/* Forgot password — Step 2: enter OTP + new password */}
        {forgotStep === 'reset' && (
          <form onSubmit={handleForgotReset} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setForgotStep('send')} className="text-gray-400 hover:text-gray-700 text-xl leading-none">←</button>
              <h2 className="font-semibold text-gray-900">Enter new password</h2>
            </div>
            <p className="text-sm text-gray-500">A reset code was sent to <strong>{fpPhone}</strong>.</p>
            {fpError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{fpError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reset code</label>
              <input
                value={fpOtp}
                onChange={(e) => setFpOtp(e.target.value)}
                required
                maxLength={6}
                placeholder="123456"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={fpPassword}
                onChange={(e) => setFpPassword(e.target.value)}
                required
                placeholder="Min. 8 characters"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={fpConfirm}
                onChange={(e) => setFpConfirm(e.target.value)}
                required
                placeholder="Repeat password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 transition text-sm"
              />
            </div>
            <button type="submit" disabled={fpLoading} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition">
              {fpLoading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* Forgot password — Success */}
        {forgotStep === 'success' && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Password reset!</h2>
            <p className="text-sm text-gray-500 mb-6">Your password has been updated. Sign in with your new password.</p>
            <button onClick={closeForgot} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-xl transition">
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

