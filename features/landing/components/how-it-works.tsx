import { Badge } from '@/components/ui/badge';
import { TestProgress } from '@/components/grader/test-progress';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import type { Verdict } from '@/components/grader/verdict';
import { Section, SectionHeading } from './section';

const ALL_AC: Verdict[] = Array.from({ length: 12 }, () => 'AC');

const LIMITS = [
  ['Time limit', '1 s'],
  ['Memory', '256 MB'],
  ['Testcases', '12'],
  ['Visible', '2'],
];

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
  return (
    <Section id="how" titleId="how-title">
      <SectionHeading
        eyebrow="How it works"
        titleId="how-title"
        title="From a blank page to a judged submission in four steps."
      />
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Step
          number="01"
          title="Write it"
          text="Write the statement in Markdown with math, set time and memory limits, and add your testcases."
        >
          <dl className="text-mono-label grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {LIMITS.map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-text-muted">{name}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Step>
        <Step
          number="02"
          title="Prove it"
          text="Attach a reference solution. The problem can only be published once it passes every one of your tests."
        >
          <TestProgress results={ALL_AC} />
        </Step>
        <Step
          number="03"
          title="Publish it"
          text="Put the problem in a Collection, add it to a Track, and invite people by name or with a link."
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-strong">Pairs with sum K</span>
              <Badge tone="brand">Published</Badge>
            </div>
            <span className="text-caption text-text-muted">Week 2 · Hashing / Warm-up</span>
          </div>
        </Step>
        <Step
          number="04"
          title="Solve it"
          text="Solvers submit code and get a verdict for every test, with the time and memory it used."
        >
          <div className="flex flex-col items-start gap-2">
            <VerdictBadge verdict="WA" detail="Wrong answer on test 4" />
            <VerdictBadge verdict="AC" />
          </div>
        </Step>
      </ol>
    </Section>
  );
}
