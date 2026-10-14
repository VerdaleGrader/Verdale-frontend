import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page';
import { AcceptTermsCard } from '@/features/legal/components/accept-terms-card';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('Meta'))('acceptTerms'), robots: { index: false } };
}

export default function AcceptTermsPage() {
  return (
    <PageContainer className="items-center py-16">
      <AcceptTermsCard />
    </PageContainer>
  );
}
