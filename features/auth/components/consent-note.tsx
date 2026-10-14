import { useTranslations } from 'next-intl';
import { LEGAL_DOCUMENTS } from '@/lib/legal';

/**
 * Under the sign-in buttons: signing in means accepting both documents (GRD-122).
 * The links open in a new tab so a sign-in in progress is not lost.
 */
export function ConsentNote() {
  const t = useTranslations('Login');
  const { terms, privacy } = LEGAL_DOCUMENTS;
  return (
    <p className="vd-consent">
      {t.rich('consent', {
        terms: (chunks) => (
          <a href={terms.path} target="_blank" rel="noopener noreferrer">
            {chunks}
          </a>
        ),
        privacy: (chunks) => (
          <a href={privacy.path} target="_blank" rel="noopener noreferrer">
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
