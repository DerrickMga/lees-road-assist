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
    <aside className="w-64 text-white h-full flex flex-col flex-shrink-0 border-r border-slate-800/70 overflow-y-auto bg-[linear-gradient(180deg,#0d1d37_0%,#10284a_55%,#153563_100%)]">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-8 h-8 rounded-lg bg-[linear-gradient(145deg,#ffd365_0%,#f1b91f_100%)] shadow-sm shadow-amber-500/30 flex items-center justify-center font-black text-slate-950 text-sm">L</div>
          <span className="text-base font-black text-white tracking-tight">Lee&apos;s Road Assist</span>
        </div>
        <p className="text-xs text-slate-300/80 pl-10">{roleLabel}</p>
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 bg-white/5">
          <div className="w-8 h-8 rounded-full bg-[linear-gradient(145deg,#ffd365_0%,#f1b91f_100%)] flex items-center justify-center text-sm font-bold text-slate-950 flex-shrink-0">
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{getUserFullName(user)}</p>
            <p className="text-xs text-slate-300/80 capitalize">{user.role.replace('_', ' ')}</p>
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
                  ? 'bg-[linear-gradient(120deg,#ffd365_0%,#f1b91f_100%)] text-slate-950 font-semibold shadow-sm shadow-amber-500/35'
                  : 'text-slate-200/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-white/10">
        {confirmLogout ? (
          <div className="rounded-lg bg-black/20 p-3 text-xs text-slate-100/90 border border-white/10">
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
                className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-200/85 hover:bg-red-500/15 hover:text-red-300 transition-colors"
          >
            <LogOut size={16} strokeWidth={2} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}

