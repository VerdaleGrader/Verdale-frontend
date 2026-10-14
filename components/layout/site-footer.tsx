import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LEGAL_DOCUMENTS } from '@/lib/legal';

/** On every page: the name, the Terms, the Privacy Policy and the contact address (Design System: SiteFooter). */
export function SiteFooter() {
  const t = useTranslations('Layout');
  return (
    <footer className="vd-footer mt-auto">
      <div className="vd-footer__inner">
        <span className="vd-footer__brand">Verdale</span>
        <nav aria-label={t('legalNav')} className="vd-footer__nav">
          <Link href={LEGAL_DOCUMENTS.terms.path}>{t('terms')}</Link>
          <Link href={LEGAL_DOCUMENTS.privacy.path}>{t('privacy')}</Link>
          <a href="mailto:help@kanonkc.com">help@kanonkc.com</a>
        </nav>
      </div>
    </footer>
  );
}
