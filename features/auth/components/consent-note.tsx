import { LEGAL_DOCUMENTS } from '@/lib/legal';

/**
 * Under the sign-in buttons: signing in means accepting both documents (GRD-122).
 * Thai on purpose: the documents are Thai only. The links open in a new tab so a sign-in in progress is not lost.
 */
export function ConsentNote() {
  const { terms, privacy } = LEGAL_DOCUMENTS;
  return (
    <p className="vd-consent" lang="th">
      การล็อกอินถือว่าท่านยอมรับ
      <a href={terms.path} target="_blank" rel="noopener noreferrer">
        ข้อกำหนด
      </a>
      และ
      <a href={privacy.path} target="_blank" rel="noopener noreferrer">
        {privacy.name}
      </a>
    </p>
  );
}
