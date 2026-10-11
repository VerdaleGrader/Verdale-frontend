'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TextField, Select } from '@/components/ui/field';
import { Toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { CodeEditorFrame } from '@/components/grader/code-editor-frame';
import { DiffView } from '@/components/grader/diff-view';
import { ProblemStatement } from '@/components/grader/problem-statement';
import { SampleIO } from '@/components/grader/sample-io';
import { SubmissionTable } from '@/components/grader/submission-table';
import { TestProgress } from '@/components/grader/test-progress';
import { TestResultList } from '@/components/grader/test-result-list';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { FINAL_VERDICTS, type Verdict } from '@/components/grader/verdict';

const LANGUAGES = [
  { value: 'python', label: 'Python 3' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
];

type Part = [kind: 'kw' | 'fn' | 'com' | 'num' | '', text: string];

// Static highlighted lines, using the syntax-* tokens through the vd tk-* classes.
const SAMPLE_CODE: Part[][] = [
  [
    ['kw', 'def'],
    ['', ' '],
    ['fn', 'solve'],
    ['', '(numbers, target):'],
  ],
  [
    ['', '    seen = {}  '],
    ['com', '# value -> index'],
  ],
  [
    ['', '    '],
    ['kw', 'for'],
    ['', ' index, value '],
    ['kw', 'in'],
    ['', ' '],
    ['fn', 'enumerate'],
    ['', '(numbers):'],
  ],
  [
    ['', '        '],
    ['kw', 'if'],
    ['', ' target - value '],
    ['kw', 'in'],
    ['', ' seen:'],
  ],
  [
    ['', '            '],
    ['kw', 'return'],
    ['', ' seen[target - value], index'],
  ],
  [['', '        seen[value] = index']],
];

/** Every design-system component in one place, to review both themes side by side. Not linked from the app. */
export default function DesignPage() {
  const [language, setLanguage] = useState('python');
  const running: Verdict[] = ['AC', 'AC', 'AC', 'RUNNING', 'QUEUED', 'QUEUED', 'QUEUED', 'QUEUED'];
  return (
    <PageContainer>
      <PageHeader title="Design system" description="Components as built in code. Switch the theme in the header." />

      <section className="flex flex-col gap-3" aria-labelledby="d-base">
        <h2 id="d-base" className="text-h2">
          Base
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Submit</Button>
          <Button>Run samples</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Remove member</Button>
          <Button disabled>Disabled</Button>
          <Tooltip label="A tooltip">
            <Button size="sm">Hover or focus me</Button>
          </Tooltip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Private</Badge>
          <Badge tone="brand">Published</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="warning">Archived</Badge>
          <Badge tone="danger">Danger</Badge>
          <Avatar name="Ada Lovelace" size="sm" />
          <Avatar name="Ada Lovelace" />
          <Avatar name="Ada Lovelace" size="lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Name" hint="Between 1 and 80 characters." defaultValue="Graph theory" />
          <TextField label="Slug" mono error="This slug is already taken." defaultValue="graph" />
          <Select
            label="Visibility"
            options={[
              { value: 'private', label: 'Private' },
              { value: 'public', label: 'Public' },
            ]}
          />
        </div>
        <Tabs defaultValue="statement">
          <TabsList aria-label="Example tabs">
            <TabsTrigger value="statement">Statement</TabsTrigger>
            <TabsTrigger value="submissions" count={12}>
              Submissions
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2">
          <Toast tone="success" title="Problem published" description="Others can solve it now." />
          <Toast tone="danger" title="Could not save" description="Check your connection and try again." />
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="d-verdicts">
        <h2 id="d-verdicts" className="text-h2">
          Verdicts and judging
        </h2>
        <div className="flex flex-wrap gap-2">
          {[...FINAL_VERDICTS, 'QUEUED', 'RUNNING', 'SKIPPED'].map((verdict) => (
            <VerdictBadge key={verdict} verdict={verdict as Verdict} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {FINAL_VERDICTS.map((verdict) => (
            <VerdictBadge key={verdict} verdict={verdict} compact />
          ))}
        </div>
        <TestProgress results={running} />
        <TestProgress results={['AC', 'AC', 'AC', 'WA', 'SKIPPED', 'SKIPPED']} />
        <TestResultList
          rows={[
            { verdict: 'AC', timeMs: 12, memoryKb: 2048, sample: true },
            { verdict: 'AC', timeMs: 124, memoryKb: 15564 },
            { verdict: 'TLE', timeMs: 2000, memoryKb: 8192 },
          ]}
        />
        <SubmissionTable
          rows={[
            {
              id: 1,
              when: '2 min ago',
              problem: 'Two sum',
              href: '/design',
              author: 'ada',
              language: 'C++',
              verdict: 'AC',
              timeMs: 31,
              memoryKb: 2048,
              selected: true,
            },
            {
              id: 2,
              when: '1 hour ago',
              problem: 'Two sum',
              href: '/design',
              author: 'grace',
              language: 'Python',
              verdict: 'WA',
              detail: 'Wrong answer on test 4',
              timeMs: 85,
              memoryKb: 9216,
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="d-solve">
        <h2 id="d-solve" className="text-h2">
          Problem and solving
        </h2>
        <ProblemStatement title="Two sum" space="algorithms" limits={{ timeMs: 1000, memoryMb: 256 }} author="ada">
          <h2>Input</h2>
          <p>
            The first line holds <code>n</code> and <code>target</code>. The second line holds <code>n</code> integers.
          </p>
          <h2>Output</h2>
          <p>Print the two indexes, smaller first.</p>
        </ProblemStatement>
        <SampleIO
          index={1}
          input={'4 9\n2 7 11 15\n'}
          output={'0 1\n'}
          explanation="2 + 7 = 9, so the answer is indexes 0 and 1."
        />
        <DiffView expected={'0 1\n2 3'} actual={'0 1\n2 4'} />
        <CodeEditorFrame
          languages={LANGUAGES}
          language={language}
          onLanguageChange={(event) => setLanguage(event.target.value)}
          status={<TestProgress results={running} />}
        >
          <pre className="vd-code" aria-label="Example code">
            {SAMPLE_CODE.map((parts, index) => (
              <span key={index} className={`ln${index === 1 ? 'is-active' : ''}`}>
                {parts.map(([kind, text], part) => (
                  <span key={part} className={kind ? `tk-${kind}` : undefined}>
                    {text}
                  </span>
                ))}
              </span>
            ))}
          </pre>
        </CodeEditorFrame>
      </section>
    </PageContainer>
  );
}
