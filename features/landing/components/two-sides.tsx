import { Check, Code2, PenLine } from 'lucide-react';
import { Section, SectionHeading } from './section';

const SIDES = [
  {
    title: 'For people who write problems',
    icon: PenLine,
    who: ['Teachers', 'Contest organizers', 'Club and camp leaders'],
    points: [
      'Statements in Markdown with math, or a PDF up to 10 pages',
      'Upload testcases and generate expected output from your own solution',
      'Publish only when your reference solution passes every test',
      'Edit after publishing: each change becomes a new version that is checked again',
    ],
  },
  {
    title: 'For people who solve them',
    icon: Code2,
    who: ['Students', 'Beginners learning to code', 'Contest participants'],
    points: [
      'Clear statements with samples you can copy in one click',
      'Run the samples before you submit',
      'See which test failed, with time and memory for each one',
      'Follow your progress through every Track you join',
    ],
  },
];

export function TwoSides() {
  return (
    <Section band titleId="sides-title">
      <SectionHeading
        eyebrow="Two sides of one judge"
        titleId="sides-title"
        title="Built for the person who writes the problem and the person who solves it."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {SIDES.map(({ title, icon: Icon, who, points }) => (
          <div key={title} className="bg-bg border-border flex min-w-0 flex-col gap-5 rounded-lg border p-6 md:p-8">
            <div className="flex items-center gap-3">
              <span aria-hidden className="bg-surface-sunken inline-flex size-9 items-center justify-center rounded-md">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <h3 className="text-h2">{title}</h3>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-caption text-text-muted">Made for</span>
              <ul className="flex flex-wrap gap-2">
                {who.map((item) => (
                  <li
                    key={item}
                    className="bg-surface-sunken border-border text-small inline-flex h-7 items-center rounded-sm border px-3 font-medium"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <ul className="flex flex-col gap-3.5">
              {points.map((point) => (
                <li key={point} className="text-prose flex items-start gap-3 !leading-6">
                  <Check aria-hidden className="text-text-muted mt-1 size-4 shrink-0" strokeWidth={1.75} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
