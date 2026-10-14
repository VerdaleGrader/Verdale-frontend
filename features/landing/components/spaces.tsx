import { Link2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import type { Verdict } from '@/components/grader/verdict';
import { Section, SectionHeading } from './section';

// Keys of messages "Landing.spaces.roles".
const ROLES = ['roles', 'permissions', 'trackAccess'] as const;

const PROBLEMS: { name: string; verdict?: Verdict }[] = [
  { name: 'Pairs with sum K', verdict: 'AC' },
  { name: 'First unique character', verdict: 'WA' },
  { name: 'Group anagrams' },
];

/** An example Space. The names and counts are made up to show the shape of the product. */
function SpaceExample() {
  const t = useTranslations('Landing.spaces');
  return (
    <div
      role="img"
      aria-label={t('previewLabel')}
      className="bg-bg border-border flex min-w-0 flex-[1_1_560px] flex-col gap-4 rounded-lg border p-5"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="bg-accent-soft text-accent text-mono-label inline-flex size-9 items-center justify-center rounded-md"
        >
          A1
        </span>
        <div className="flex min-w-0 grow flex-col">
          <span className="text-caption text-text-muted">{t('space')}</span>
          <span className="text-h3">Algorithms 101</span>
        </div>
        <Badge icon={Lock}>{t('private')}</Badge>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="bg-surface border-border flex min-w-0 flex-[1_1_200px] flex-col gap-1 rounded-md border p-4">
          <span className="text-caption text-text-muted">{t('track')}</span>
          <span className="text-body-strong !font-semibold">Week 1 · Arrays</span>
          <span className="text-small text-text-muted pt-2">{t('week1Summary')}</span>
          <span className="text-mono-label text-brand-text">{t('solvedCount', { done: 7, total: 7 })}</span>
        </div>
        <div className="bg-surface border-border-strong flex min-w-0 flex-[2_1_300px] flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-text-muted">{t('track')}</span>
            <span className="text-body-strong !font-semibold">Week 2 · Hashing</span>
          </div>
          <div className="bg-surface-sunken flex flex-col gap-2 rounded-md p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-caption text-text-muted">{t('collection')} · Warm-up</span>
              <span className="text-mono-label text-text-muted">{t('solvedCount', { done: 1, total: 3 })}</span>
            </div>
            {PROBLEMS.map(({ name, verdict }) => (
              <div
                key={name}
                className="bg-surface border-border flex min-h-9 items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5"
              >
                <span className="min-w-0">{name}</span>
                {verdict ? (
                  <VerdictBadge verdict={verdict} format="short" />
                ) : (
                  <span className="text-caption text-text-muted !font-normal">{t('notTried')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-small text-text-muted">{t('note')}</p>
    </div>
  );
}

export function Spaces() {
  const t = useTranslations('Landing.spaces');
  return (
    <Section id="spaces" band titleId="spaces-title">
      <SectionHeading eyebrow={t('eyebrow')} titleId="spaces-title" title={t('title')}>
        {t('lead')}
      </SectionHeading>
      <div className="flex flex-wrap items-start gap-8">
        <SpaceExample />
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <h3 className="text-h3">{t('accessTitle')}</h3>
          <dl className="border-border border-t">
            {ROLES.map((role) => (
              <div key={role} className="border-border grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-b py-3">
                <dt className="text-body-strong">{t(`roles.${role}.name`)}</dt>
                <dd className="text-body text-text-muted">{t(`roles.${role}.text`)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-start gap-3 pt-2">
            <Link2 aria-hidden className="text-text-muted mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <p className="text-body text-text-muted">{t('invite')}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
