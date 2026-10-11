'use client';

import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/features/auth/hooks/auth-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
