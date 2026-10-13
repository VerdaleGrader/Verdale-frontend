import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page';
import { AcceptTermsCard } from '@/features/legal/components/accept-terms-card';

export const metadata: Metadata = { title: 'Accept the updated terms · Verdale', robots: { index: false } };

export default function AcceptTermsPage() {
  return (
    <PageContainer className="items-center py-16">
      <AcceptTermsCard />
    </PageContainer>
  );
}
