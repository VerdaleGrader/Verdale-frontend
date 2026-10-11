'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './auth-provider';

/**
 * For pages that need a signed-in user. The proxy already turns away
 * visitors without a session cookie; this also catches a cookie that Core
 * no longer accepts (expired or logged out elsewhere). Core checks every
 * request regardless.
 */
export function useRequireAuth() {
  const { auth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (auth.status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.status, pathname, router]);

  return auth;
}
