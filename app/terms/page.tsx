import type { Metadata } from 'next';
import { useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LegalDocument } from '@/components/legal/legal-document';
import { PageContainer } from '@/components/layout/page';
import type { Locale } from '@/i18n/config';
import { effectiveLine, LEGAL_VERSIONS } from '@/lib/legal';
import { loadLegalContent } from '@/lib/legal-content';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('Meta'))('terms') };
}

// The text comes from content/legal/<language>/terms.md through lib/legal-bundle.gen.ts; open to everyone, no account needed.
export default function TermsPage() {
  const locale = useLocale() as Locale;
  return (
    <PageContainer className="py-10">
      <LegalDocument
        content={loadLegalContent('terms', locale)}
        effective={effectiveLine(LEGAL_VERSIONS.terms, locale)}
      />
    </PageContainer>
  );
}
