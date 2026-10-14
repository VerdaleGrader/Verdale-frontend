import type { Metadata } from 'next';
import { useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LegalDocument } from '@/components/legal/legal-document';
import { PageContainer } from '@/components/layout/page';
import type { Locale } from '@/i18n/config';
import { effectiveLine, LEGAL_VERSIONS } from '@/lib/legal';
import { loadLegalContent } from '@/lib/legal-content';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('Meta'))('privacy') };
}

// The text comes from content/legal/<language>/privacy.md through lib/legal-bundle.gen.ts; open to everyone, no account needed.
export default function PrivacyPage() {
  const locale = useLocale() as Locale;
  return (
    <PageContainer className="py-10">
      <LegalDocument
        content={loadLegalContent('privacy', locale)}
        effective={effectiveLine(LEGAL_VERSIONS.privacy, locale)}
      />
    </PageContainer>
  );
}
