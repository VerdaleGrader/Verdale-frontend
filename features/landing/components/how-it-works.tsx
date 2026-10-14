import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { TestProgress } from '@/components/grader/test-progress';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import type { Verdict } from '@/components/grader/verdict';
import { Section, SectionHeading } from './section';

const ALL_AC: Verdict[] = Array.from({ length: 12 }, () => 'AC');

// Labels are keys of messages "Landing.how.limits"; the figures only illustrate the page.
const LIMITS = [
  ['time', '1 s'],
  ['memory', '256 MB'],
  ['testcases', '12'],
  ['visible', '2'],
] as const;

function Step({
  number,
  title,
  text,
  children,
}: {
  number: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <li className="bg-surface border-border flex min-w-0 flex-col gap-3 rounded-lg border p-6">
      <span className="text-mono-label text-text-muted">{number}</span>
      <h3 className="text-h3">{title}</h3>
      <p className="text-body text-text-muted">{text}</p>
      <div className="bg-surface-sunken mt-auto rounded-md p-3">{children}</div>
    </li>
  );
}

export function HowItWorks() {
  const t = useTranslations('Landing.how');
  return (
    <Section id="how" titleId="how-title">
      <SectionHeading eyebrow={t('eyebrow')} titleId="how-title" title={t('title')} />
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Step number="01" title={t('write.title')} text={t('write.text')}>
          <dl className="text-mono-label grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {LIMITS.map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-text-muted">{t(`limits.${name}`)}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Step>
        <Step number="02" title={t('prove.title')} text={t('prove.text')}>
          <TestProgress results={ALL_AC} />
        </Step>
        <Step number="03" title={t('publish.title')} text={t('publish.text')}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-strong">Pairs with sum K</span>
              <Badge tone="brand">{t('publish.badge')}</Badge>
            </div>
            <span className="text-caption text-text-muted">Week 2 · Hashing / Warm-up</span>
          </div>
        </Step>
        <Step number="04" title={t('solve.title')} text={t('solve.text')}>
          <div className="flex flex-col items-start gap-2">
            <VerdictBadge verdict="WA" detail={t('solve.wrongAnswer')} />
            <VerdictBadge verdict="AC" />
          </div>
        </Step>
      </ol>
    </Section>
  );
}
