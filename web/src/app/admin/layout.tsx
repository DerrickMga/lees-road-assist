'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth, getUserFullName } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
import NotificationBell from '@/components/layout/NotificationBell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
      } else if (!['admin', 'super_admin', 'dispatch', 'support'].includes(user.role)) {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  const isAdmin = user && ['admin', 'super_admin', 'dispatch', 'support'].includes(user.role);

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100/70 backdrop-blur-sm">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar variant="admin" />
      <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
        <header className="h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <span className="text-sm text-gray-500">
            {user && <span className="font-medium text-gray-800">{getUserFullName(user)}</span>}
            {user && <span className="ml-2 capitalize text-gray-400 text-xs">{user.role.replace('_', ' ')}</span>}
          </span>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {confirmLogout ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Sign out?</span>
                <button onClick={signOut} className="px-2.5 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium">Yes</button>
                <button onClick={() => setConfirmLogout(false)} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmLogout(true)}
                title="Sign out"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
