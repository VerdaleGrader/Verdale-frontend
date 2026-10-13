import Link from 'next/link';
import { LEGAL_DOCUMENTS } from '@/lib/legal';

/** On every page: the name, the Terms, the Privacy Policy and the contact address (Design System: SiteFooter). */
export function SiteFooter() {
  return (
    <footer className="vd-footer mt-auto">
      <div className="vd-footer__inner">
        <span className="vd-footer__brand">Verdale</span>
        <nav aria-label="Legal" className="vd-footer__nav">
          <Link href={LEGAL_DOCUMENTS.terms.path}>Terms</Link>
          <Link href={LEGAL_DOCUMENTS.privacy.path}>Privacy</Link>
          <a href="mailto:help@kanonkc.com">help@kanonkc.com</a>
        </nav>
      </div>
    </footer>
  );
}
