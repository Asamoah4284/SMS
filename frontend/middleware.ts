import { NextRequest, NextResponse } from 'next/server';

// Routes that don't need authentication
const PUBLIC_ROUTES = ['/login', '/invite', '/set-password', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('accessToken')?.value;

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    // If user is authenticated and tries to access auth pages, redirect to dashboard
    if (token && ['/login', '/invite', '/set-password', '/forgot-password'].includes(pathname)) {
      return NextResponse.redirect(new URL('/overview', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes require authentication
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
