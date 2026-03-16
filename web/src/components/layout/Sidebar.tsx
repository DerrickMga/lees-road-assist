'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  PlusCircle,
  UserCircle,
  Banknote,
  LogOut,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, getUserFullName } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
}

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Overview', Icon: LayoutDashboard, exact: true },
  { href: '/admin/requests', label: 'Requests', Icon: ClipboardList },
  { href: '/admin/riders', label: 'Riders', Icon: Truck },
  { href: '/admin/providers', label: 'Providers', Icon: Wrench },
  { href: '/admin/users', label: 'Users', Icon: Users },
  { href: '/admin/payments', label: 'Payments', Icon: CreditCard },
  { href: '/admin/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', Icon: Settings },
];

const customerNav: NavItem[] = [
  { href: '/customer/dashboard', label: 'My Requests', Icon: ClipboardList },
  { href: '/customer/requests/new', label: 'New Request', Icon: PlusCircle },
  { href: '/customer/profile', label: 'Profile', Icon: UserCircle },
];

const providerNav: NavItem[] = [
  { href: '/provider/dashboard', label: 'Jobs', Icon: Wrench },
  { href: '/provider/earnings', label: 'Earnings', Icon: Banknote },
  { href: '/provider/profile', label: 'Profile', Icon: UserCircle },
];

interface SidebarProps {
  variant?: 'admin' | 'customer' | 'provider';
}

export default function Sidebar({ variant = 'admin' }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const navItems =
    variant === 'customer' ? customerNav :
    variant === 'provider' ? providerNav :
    adminNav;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const roleLabel =
    variant === 'customer' ? 'Customer Portal' :
    variant === 'provider' ? 'Provider Portal' :
    'Admin Dashboard';

  return (
    <aside className="w-64 bg-gray-950 text-white h-full flex flex-col flex-shrink-0 border-r border-gray-800 overflow-y-auto">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center font-black text-black text-sm">L</div>
          <span className="text-base font-black text-white tracking-tight">Lee&apos;s Road Assist</span>
        </div>
        <p className="text-xs text-gray-500 pl-10">{roleLabel}</p>
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-sm font-bold text-black flex-shrink-0">
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{getUserFullName(user)}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-yellow-400 text-black font-semibold'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-gray-800">
        {confirmLogout ? (
          <div className="rounded-lg bg-gray-800 p-3 text-xs text-gray-300">
            <p className="mb-2 font-medium text-white">Sign out?</p>
            <div className="flex gap-2">
              <button
                onClick={signOut}
                className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md font-medium transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} strokeWidth={2} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}

