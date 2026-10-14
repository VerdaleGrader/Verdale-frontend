import { Check, Code2, PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Section, SectionHeading } from './section';

// Full keys of messages "Landing.sides".
const SIDES = [
  {
    title: 'writers.title',
    icon: PenLine,
    who: ['writers.who.teachers', 'writers.who.organizers', 'writers.who.leaders'],
    points: ['writers.points.statements', 'writers.points.testcases', 'writers.points.publish', 'writers.points.edit'],
  },
  {
    title: 'solvers.title',
    icon: Code2,
    who: ['solvers.who.students', 'solvers.who.beginners', 'solvers.who.participants'],
    points: [
      'solvers.points.statements',
      'solvers.points.samples',
      'solvers.points.failures',
      'solvers.points.progress',
    ],
  },
] as const;

export function TwoSides() {
  const t = useTranslations('Landing.sides');
  return (
    <Section band titleId="sides-title">
      <SectionHeading eyebrow={t('eyebrow')} titleId="sides-title" title={t('title')} />
      <div className="grid gap-6 md:grid-cols-2">
        {SIDES.map(({ title, icon: Icon, who, points }) => (
          <div key={title} className="bg-bg border-border flex min-w-0 flex-col gap-5 rounded-lg border p-6 md:p-8">
            <div className="flex items-center gap-3">
              <span aria-hidden className="bg-surface-sunken inline-flex size-9 items-center justify-center rounded-md">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <h3 className="text-h2">{t(title)}</h3>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-caption text-text-muted">{t('madeFor')}</span>
              <ul className="flex flex-wrap gap-2">
                {who.map((item) => (
                  <li
                    key={item}
                    className="bg-surface-sunken border-border text-small inline-flex h-7 items-center rounded-sm border px-3 font-medium"
                  >
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>
            <ul className="flex flex-col gap-3.5">
              {points.map((point) => (
                <li key={point} className="text-prose flex items-start gap-3 !leading-6">
                  <Check aria-hidden className="text-text-muted mt-1 size-4 shrink-0" strokeWidth={1.75} />
                  <span>{t(point)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
