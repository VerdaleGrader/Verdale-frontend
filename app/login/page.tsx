import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page';
import { LoginCard } from '@/features/auth/components/login-card';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('Meta'))('login') };
}

export default function LoginPage() {
  return (
    <PageContainer className="items-center py-16">
      <LoginCard />
    </PageContainer>
  );
}
