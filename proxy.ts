import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sends visitors without a session cookie to the login page before a
 * protected page renders. This only checks that a cookie exists; Core
 * validates the session on every API call, and the pages also react to a 401
 * (features/auth/hooks/use-require-auth.ts). Never rely on this for security.
 */
const SESSION_COOKIE = 'vd_session';

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything that needs an account. Public: /, /login, /explore, /spaces/<slug> (public Spaces), a published problem's page, /invites/<token>.
  matcher: [
    '/settings/:path*',
    '/spaces',
    '/spaces/new',
    '/spaces/:slug/manage/:path*',
    '/spaces/:slug/progress',
    '/spaces/:slug/settings',
    '/spaces/:slug/members',
    '/spaces/:slug/submissions/:path*',
    '/spaces/:slug/submissions',
    '/spaces/:slug/problems/new',
    '/spaces/:slug/problems/:problemSlug/edit/:path*',
    '/spaces/:slug/problems/:problemSlug/submissions/:path*',
  ],
};
