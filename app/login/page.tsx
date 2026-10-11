import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page';
import { LoginCard } from '@/features/auth/components/login-card';

export const metadata: Metadata = { title: 'Log in · Verdale' };

export default function LoginPage() {
  return (
    <PageContainer className="items-center py-16">
      <LoginCard />
    </PageContainer>
  );
}
