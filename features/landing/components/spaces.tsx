import { Link2, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import type { Verdict } from '@/components/grader/verdict';
import { Section, SectionHeading } from './section';

const ROLES = [
  {
    name: 'Roles',
    text: 'Each member of a Space has a role, from managing the whole Space to only solving problems.',
  },
  {
    name: 'Permissions',
    text: 'A role sets what someone can change, such as members, problems and testcases, and what they can see.',
  },
  {
    name: 'Track access',
    text: 'Solvers see only the Tracks they belong to, and hidden testcases stay hidden from them.',
  },
];

const PROBLEMS: { name: string; verdict?: Verdict }[] = [
  { name: 'Pairs with sum K', verdict: 'AC' },
  { name: 'First unique character', verdict: 'WA' },
  { name: 'Group anagrams' },
];

/** An example Space. The names and counts are made up to show the shape of the product. */
function SpaceExample() {
  return (
    <div
      role="img"
      aria-label="Example Space Algorithms 101 with two Tracks. Week 2 Hashing holds the Collection Warm-up with three problems: one Accepted, one Wrong answer, one not tried."
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
          <span className="text-caption text-text-muted">Space</span>
          <span className="text-h3">Algorithms 101</span>
        </div>
        <Badge icon={Lock}>Private</Badge>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="bg-surface border-border flex min-w-0 flex-[1_1_200px] flex-col gap-1 rounded-md border p-4">
          <span className="text-caption text-text-muted">Track</span>
          <span className="text-body-strong !font-semibold">Week 1 · Arrays</span>
          <span className="text-small text-text-muted pt-2">2 Collections · 7 problems</span>
          <span className="text-mono-label text-brand-text">7 of 7 solved</span>
        </div>
        <div className="bg-surface border-border-strong flex min-w-0 flex-[2_1_300px] flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-text-muted">Track</span>
            <span className="text-body-strong !font-semibold">Week 2 · Hashing</span>
          </div>
          <div className="bg-surface-sunken flex flex-col gap-2 rounded-md p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-caption text-text-muted">Collection · Warm-up</span>
              <span className="text-mono-label text-text-muted">1 of 3 solved</span>
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
                  <span className="text-caption text-text-muted !font-normal">Not tried</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-small text-text-muted">
        A Collection can sit in several Tracks, and a problem in several Collections. Solvers see only the Tracks they
        belong to.
      </p>
    </div>
  );
}

export function Spaces() {
  return (
    <Section id="spaces" band titleId="spaces-title">
      <SectionHeading
        eyebrow="Spaces, Tracks and roles"
        titleId="spaces-title"
        title="Run a class, a club or a camp from one Space."
      >
        A Space holds your problems and your people. Tracks are the paths solvers follow, Collections are ordered sets
        of problems inside them, and roles with permissions decide who can see and change what.
      </SectionHeading>
      <div className="flex flex-wrap items-start gap-8">
        <SpaceExample />
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <h3 className="text-h3">The right access for everyone</h3>
          <dl className="border-border border-t">
            {ROLES.map(({ name, text }) => (
              <div key={name} className="border-border grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-b py-3">
                <dt className="text-body-strong">{name}</dt>
                <dd className="text-body text-text-muted">{text}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-start gap-3 pt-2">
            <Link2 aria-hidden className="text-text-muted mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <p className="text-body text-text-muted">
              Invite people one by one or with a link that expires. Revoke a link at any time.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
