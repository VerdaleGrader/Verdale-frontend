import { Code2, EyeOff, Gauge, ListChecks, Package, Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FINAL_VERDICTS } from '@/components/grader/verdict';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VerdictInfo } from '@/components/grader/verdict-info';
import { Section, SectionHeading } from './section';

// Keys of messages "Landing.judge.features".
const FEATURES = [
  { key: 'languages', icon: Code2 },
  { key: 'sandbox', icon: Package },
  { key: 'hidden', icon: EyeOff },
  { key: 'oneJudge', icon: Scale },
  { key: 'results', icon: ListChecks },
  { key: 'limits', icon: Gauge },
] as const;

export function Judge() {
  const t = useTranslations('Landing.judge');
  return (
    <Section id="judge" titleId="judge-title">
      <SectionHeading eyebrow={t('eyebrow')} titleId="judge-title" title={t('title')}>
        {t('lead')}
      </SectionHeading>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, key }) => (
          <li key={key} className="bg-surface border-border flex min-w-0 flex-col gap-3 rounded-lg border p-6">
            <span aria-hidden className="bg-surface-sunken inline-flex size-9 items-center justify-center rounded-md">
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            <h3 className="text-h3">{t(`features.${key}.title`)}</h3>
            <p className="text-body text-text-muted">{t(`features.${key}.text`)}</p>
          </li>
        ))}
      </ul>
      <div className="bg-surface border-border flex flex-wrap items-center justify-between gap-5 rounded-lg border p-6">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-h3">{t('verdictsTitle')}</h3>
            <VerdictInfo label={t('verdictsInfo')} />
          </div>
          <p className="text-body text-text-muted">{t('verdictsText')}</p>
        </div>
        <ul className="flex min-w-0 flex-[2_1_480px] flex-wrap gap-2">
          {FINAL_VERDICTS.map((verdict) => (
            <li key={verdict}>
              <VerdictBadge verdict={verdict} />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
