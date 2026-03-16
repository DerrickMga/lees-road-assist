import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function roleHome(role: string | undefined): string {
  switch (role) {
    case 'admin':
    case 'super_admin':
    case 'dispatch':
    case 'support':
      return '/admin';
    case 'provider':
    case 'tow_operator':
      return '/provider/dashboard';
    case 'customer':
      return '/customer/dashboard';
    default:
      return '/admin';
  }
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const role = request.cookies.get('role')?.value;
  const { pathname } = request.nextUrl;

  // Already logged in → redirect away from login page to role-appropriate dashboard
  // The landing page (/) stays accessible to everyone
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL(roleHome(role), request.url));
  }

  // Public paths — no auth required
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png'
  ) {
    return NextResponse.next();
  }

  // Protected — require token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}


