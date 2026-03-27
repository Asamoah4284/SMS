import { NextRequest, NextResponse } from 'next/server';

const STAFF_AUTH_ROUTES = ['/login', '/invite', '/set-password', '/forgot-password'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('accessToken')?.value;
  const parentToken = request.cookies.get('parentToken')?.value;

  // ── Parent portal ────────────────────────────────────────────────
  if (pathname.startsWith('/parent-portal')) {
    // The auth page itself (/parent-portal) is public
    if (pathname === '/parent-portal') {
      // Already authenticated → send straight to portal
      if (parentToken) {
        return NextResponse.redirect(new URL('/parent-portal/portal', request.url));
      }
      return NextResponse.next();
    }
    // All other /parent-portal/* routes require the parent token
    if (!parentToken) {
      return NextResponse.redirect(new URL('/parent-portal', request.url));
    }
    return NextResponse.next();
  }

  // ── Staff / admin routes ─────────────────────────────────────────
  if (STAFF_AUTH_ROUTES.includes(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL('/overview', request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
