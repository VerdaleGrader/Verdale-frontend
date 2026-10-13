import { Code2, EyeOff, Gauge, ListChecks, Package, Scale } from 'lucide-react';
import { FINAL_VERDICTS } from '@/components/grader/verdict';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VerdictInfo } from '@/components/grader/verdict-info';
import { Section, SectionHeading } from './section';

const FEATURES = [
  {
    icon: Code2,
    title: 'Multiple languages',
    text: 'Solve in the language you prefer. Every language is compiled and run by the same judge.',
  },
  {
    icon: Package,
    title: 'Sandboxed runs',
    text: 'Every run is isolated, with no network and hard limits on time, memory and processes.',
  },
  {
    icon: EyeOff,
    title: 'Hidden tests stay hidden',
    text: 'Solvers see the visible samples. The other testcases never leave the server.',
  },
  {
    icon: Scale,
    title: 'One judge for both sides',
    text: 'Your reference solution runs in the same sandbox as every submission.',
  },
  {
    icon: ListChecks,
    title: 'Results for every test',
    text: 'Watch each test finish as it is judged, then see its time and memory.',
  },
  {
    icon: Gauge,
    title: 'Fair use limits',
    text: 'Submissions are rate limited per person, so one busy solver cannot hold up the queue.',
  },
];

export function Judge() {
  return (
    <Section id="judge" titleId="judge-title">
      <SectionHeading eyebrow="Judge and safety" titleId="judge-title" title="A judge you can trust with hidden tests.">
        Every submission and every reference solution runs in the same isolated sandbox, so a verdict means the same
        thing for everyone.
      </SectionHeading>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="bg-surface border-border flex min-w-0 flex-col gap-3 rounded-lg border p-6">
            <span aria-hidden className="bg-surface-sunken inline-flex size-9 items-center justify-center rounded-md">
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            <h3 className="text-h3">{title}</h3>
            <p className="text-body text-text-muted">{text}</p>
          </li>
        ))}
      </ul>
      <div className="bg-surface border-border flex flex-wrap items-center justify-between gap-5 rounded-lg border p-6">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-h3">Eight verdicts, always in words</h3>
            <VerdictInfo label="What each verdict means" />
          </div>
          <p className="text-body text-text-muted">Every result carries its name and an icon, never colour alone.</p>
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
