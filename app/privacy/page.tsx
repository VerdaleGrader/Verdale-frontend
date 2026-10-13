import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/legal-document';
import { PageContainer } from '@/components/layout/page';
import { effectiveLine, LEGAL_VERSIONS } from '@/lib/legal';
import { loadLegalContent } from '@/lib/legal-content';

export const metadata: Metadata = { title: 'Privacy · Verdale' };
// Built once from content/legal/privacy.md; open to everyone, no account needed.
export const dynamic = 'force-static';

export default function PrivacyPage() {
  return (
    <PageContainer className="py-10">
      <LegalDocument content={loadLegalContent('privacy')} effective={effectiveLine(LEGAL_VERSIONS.privacy)} />
    </PageContainer>
  );
}
