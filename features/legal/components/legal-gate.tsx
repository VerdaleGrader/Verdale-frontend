'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { acceptTermsUrl, LEGAL_EXEMPT_PATHS } from '@/lib/legal';

/**
 * After the Terms or the Privacy Policy change, a signed-in person sees the
 * full-page notice at /accept-terms before anything else (GRD-122). Core
 * enforces it on every call (403 LEGAL_ACCEPTANCE_REQUIRED); this only sends
 * the person to the right page. The documents themselves stay readable.
 */
export function LegalGate() {
  const { auth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const required = auth.status === 'authenticated' && auth.user.legal.acceptance_required;
  const exempt = LEGAL_EXEMPT_PATHS.includes(pathname);

  useEffect(() => {
    if (required && !exempt) router.replace(acceptTermsUrl(pathname + window.location.search));
  }, [required, exempt, pathname, router]);

  return null;
}
