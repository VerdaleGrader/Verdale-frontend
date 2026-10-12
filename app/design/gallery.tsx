'use client';

import { useId, useMemo, useState } from 'react';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { CodeEditorFrame } from '@/components/grader/code-editor-frame';
import { DiffView } from '@/components/grader/diff-view';
import { ProblemStatement } from '@/components/grader/problem-statement';
import { SampleIO } from '@/components/grader/sample-io';
import { SubmissionTable } from '@/components/grader/submission-table';
import { TestProgress } from '@/components/grader/test-progress';
import { TestResultList } from '@/components/grader/test-result-list';
import { TestcaseList, type TestcaseItem } from '@/components/grader/testcase-list';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VerdictInfo } from '@/components/grader/verdict-info';
import { FINAL_VERDICTS, type Verdict } from '@/components/grader/verdict';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ChangeBadge, type ChangeKind } from '@/components/ui/change-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmOverwriteDialog } from '@/components/ui/confirm-overwrite-dialog';
import { Dialog } from '@/components/ui/dialog';
import { DragHandle } from '@/components/ui/drag-handle';
import { Dropdown } from '@/components/ui/dropdown';
import { FilePreview } from '@/components/ui/file-preview';
import { FileUploader, type UploadFile } from '@/components/ui/file-uploader';
import { TextField } from '@/components/ui/field';
import { FilterChips } from '@/components/ui/filter-chips';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { RadioGroup } from '@/components/ui/radio-group';
import { SortHeader, type SortDirection } from '@/components/ui/sort-header';
import { SortableLists, SortableListOf } from '@/components/ui/sortable-list';
import { StatSummary } from '@/components/ui/stat-summary';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toast } from '@/components/ui/toast';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { UnsavedBar } from '@/components/ui/unsaved-bar';

const LANGUAGES = [
  { value: 'python', label: 'Python 3' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
];

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Everything, including visibility and archiving.', locked: true },
  { value: 'administrator', label: 'Administrator', description: 'Manages members and problems.' },
  { value: 'editor', label: 'Editor', description: 'Writes and publishes problems.' },
  { value: 'observer', label: 'Observer', description: 'Reads everything, changes nothing.' },
  { value: 'solver', label: 'Solver', description: 'Solves published problems.' },
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

const TESTCASES: TestcaseItem[] = [
  { id: 1, position: 1, sample: true, verdict: 'AC', timeMs: 6 },
  { id: 2, position: 2, sample: true, verdict: 'AC', timeMs: 5 },
  { id: 3, position: 3, sample: false, verdict: 'AC', timeMs: 31 },
  { id: 4, position: 4, sample: false, verdict: 'WA', timeMs: 48 },
  { id: 5, position: 5, sample: false, verdict: 'SKIPPED' },
  { id: 6, position: 6, sample: false, verdict: 'SKIPPED' },
  ...Array.from({ length: 14 }, (_, index) => ({
    id: 7 + index,
    position: 7 + index,
    sample: false,
    verdict: 'SKIPPED' as const,
  })),
];

const LONG_EXPECTED = Array.from({ length: 120 }, (_, index) => String(index * 3)).join('\n');
const LONG_ACTUAL = Array.from({ length: 120 }, (_, index) =>
  index === 77 ? '231 ' : index === 78 ? '999' : String(index * 3)
).join('\n');

const FILE_TEXT = Array.from({ length: 24 }, (_, index) => `${index + 1} ${(index + 1) * 7}`).join('\n');

const CHANGES: ChangeKind[] = [
  'new',
  'moved',
  'now-visible',
  'now-hidden',
  'input-replaced',
  'output-changed',
  'new-output',
  'same',
  'kept',
  'removed',
];

interface Case {
  id: string;
  name: string;
}

const CASES: Case[] = Array.from({ length: 5 }, (_, index) => ({ id: `t${index + 1}`, name: `Testcase ${index + 1}` }));

/** Every design-system component with its states. Rendered once per theme by the page. */
export function Gallery() {
  const prefix = useId();
  const h = (name: string) => `${prefix}-${name}`;
  const running: Verdict[] = ['AC', 'AC', 'AC', 'RUNNING', 'QUEUED', 'QUEUED', 'QUEUED', 'QUEUED'];

  const [language, setLanguage] = useState('python');
  const [role, setRole] = useState('editor');
  const [page, setPage] = useState(2);
  const [filters, setFilters] = useState([
    { key: 'verdict', label: 'Verdict: Memory limit exceeded' },
    { key: 'language', label: 'Language: C 11' },
  ]);
  const [sort, setSort] = useState<{ column: 'when' | 'time'; direction: SortDirection }>({
    column: 'when',
    direction: 'desc',
  });
  const [selected, setSelected] = useState<TestcaseItem['id']>(4);
  const [visible, setVisible] = useState(true);
  const [mixed, setMixed] = useState<boolean | 'indeterminate'>('indeterminate');
  const [kind, setKind] = useState('input');
  const [dialog, setDialog] = useState<'xl' | 'overwrite' | null>(null);
  const [unsaved, setUnsaved] = useState(true);
  const [files, setFiles] = useState<UploadFile[]>([
    { id: 'a', name: '1.in', size: 18, status: 'done' },
    { id: 'b', name: '2.in', size: 3_400_000, status: 'uploading', progress: 62 },
    { id: 'c', name: '3.in', size: 15_000_000, status: 'rejected', message: 'Too large: at most 8 MiB.' },
    { id: 'd', name: '4.in', size: 90, status: 'error', message: 'Upload failed. Try again.' },
  ]);
  const [order, setOrder] = useState(CASES);
  const [left, setLeft] = useState(CASES.slice(0, 3));
  const [right, setRight] = useState(CASES.slice(3));
  const [failNext, setFailNext] = useState(false);

  const sortedRows = useMemo(
    () =>
      [
        {
          id: 1,
          when: '2 min ago',
          problem: 'Two sum',
          href: '/design',
          author: 'ada',
          language: 'C++',
          verdict: 'AC' as const,
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
          verdict: 'WA' as const,
          detail: 'Wrong answer on testcase 4',
          timeMs: 85,
          memoryKb: 9216,
        },
        {
          id: 3,
          when: 'yesterday',
          problem: 'Two sum',
          href: '/design',
          author: 'ploy',
          language: 'C',
          verdict: 'ISE' as const,
        },
      ].sort(
        (a, b) =>
          ((a.timeMs ?? 0) - (b.timeMs ?? 0)) * (sort.column === 'time' ? (sort.direction === 'asc' ? 1 : -1) : 1)
      ),
    [sort]
  );

  async function save(setter: (next: Case[]) => void, items: Case[], ids: string[]) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (failNext) {
      setFailNext(false);
      throw new Error('offline');
    }
    setter(ids.map((id) => items.find((item) => item.id === id)!));
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3" aria-labelledby={h('base')}>
        <h2 id={h('base')} className="text-h2">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" hint="Between 1 and 80 characters." defaultValue="Graph theory" />
          <TextField label="Slug" mono error="This slug is already taken." defaultValue="graph" />
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

      <section className="flex flex-col gap-4" aria-labelledby={h('controls')}>
        <h2 id={h('controls')} className="text-h2">
          Checkbox, radio, dropdown, toggle
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Checkbox label="Latest submission per member only" defaultChecked />
            <Checkbox label="Not ticked" />
            <Checkbox label="Some are ticked (mixed)" checked={mixed} onCheckedChange={setMixed} />
            <Checkbox
              label="Make this the primary solution"
              description="Used to generate expected output."
              defaultChecked
            />
            <Checkbox label="Disabled" disabled />
            <Checkbox label="Disabled and ticked" disabled defaultChecked />
          </div>
          <RadioGroup
            aria-label="Upload mode"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'input', label: 'Input and output files', description: 'One file each, paired by name.' },
              { value: 'set', label: 'One file for the whole set', description: 'Split by a separator line.' },
              { value: 'zip', label: 'A zip of many pairs' },
              { value: 'off', label: 'Not available', disabled: true },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Dropdown
            label="Role"
            value={role}
            onValueChange={setRole}
            options={ROLES}
            hint="Locked roles cannot be assigned by you."
          />
          <Dropdown
            label="Language"
            value={language}
            onValueChange={setLanguage}
            options={LANGUAGES}
            error="Choose a language the problem allows."
          />
          <Dropdown label="Disabled" disabled defaultValue="c" options={LANGUAGES} />
          <Dropdown aria-label="Small dropdown" size="sm" defaultValue="cpp" options={LANGUAGES} />
          <Dropdown label="With a placeholder" placeholder="Choose one" options={LANGUAGES} />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-small text-text-muted">
            A Toggle is a setting that applies at once, or that waits for Save on a page with an Unsaved changes bar
            (say so beside it).
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Toggle label="Visible to solvers" checked={visible} onCheckedChange={setVisible} />
            <Toggle label="Show whitespace" defaultChecked />
            <Toggle label="Off" />
            <Toggle label="Disabled" disabled />
            <Toggle label="Disabled and on" disabled defaultChecked />
            <Toggle aria-label="Visible to solvers, testcase 3" defaultChecked />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={h('verdicts')}>
        <h2 id={h('verdicts')} className="text-h2">
          Verdicts and judging
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {[...FINAL_VERDICTS, 'QUEUED', 'RUNNING', 'SKIPPED'].map((verdict) => (
            <VerdictBadge key={verdict} verdict={verdict as Verdict} />
          ))}
          <VerdictInfo current="WA" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[...FINAL_VERDICTS, 'QUEUED', 'RUNNING', 'SKIPPED'].map((verdict) => (
            <VerdictBadge key={verdict} verdict={verdict as Verdict} format="short" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict="WA" detail="Wrong answer on testcase 4" />
          <VerdictBadge verdict="RUNNING" detail="Running testcase 7 of 20" />
          <VerdictBadge verdict="ISE" detail="Internal error on testcase 10" />
          <span className="text-small text-text-muted">auto: full name, the code on a narrow screen</span>
          <VerdictBadge verdict="TLE" format="auto" />
        </div>
        <TestProgress results={running} />
        <TestProgress results={['AC', 'AC', 'AC', 'WA', 'SKIPPED', 'SKIPPED']} />
        <TestProgress
          results={['AC', 'AC', 'AC', 'RUNNING', 'QUEUED', 'QUEUED']}
          label="Generating output 4 of 6"
          ariaLabel="Generation progress"
        />
        <TestProgress
          results={['AC', 'AC', 'AC', 'AC', 'AC', 'AC']}
          label="All 6 outputs generated"
          ariaLabel="Generation progress"
        />
        <TestResultList
          rows={[
            { verdict: 'AC', timeMs: 12, memoryKb: 2048, sample: true },
            { verdict: 'AC', timeMs: 124, memoryKb: 15564 },
            { verdict: 'TLE', timeMs: 2000, memoryKb: 8192 },
          ]}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={h('lists')}>
        <h2 id={h('lists')} className="text-h2">
          Lists, filters and states
        </h2>
        <Breadcrumb
          items={[
            { label: 'Submissions', href: '/design' },
            { label: 'By member', href: '/design' },
            { label: 'Ploy Srisuk', href: '/design' },
            { label: 'Submission 4821' },
          ]}
        />
        <StatSummary
          stats={[
            { label: 'Tried', value: 42 },
            { label: 'Solved', value: 31, tone: 'brand' },
            { label: 'Submissions', value: 213 },
          ]}
        />
        <FilterChips
          filters={filters}
          onRemove={(key) => setFilters((current) => current.filter((filter) => filter.key !== key))}
          onClear={() => setFilters([])}
        />
        {filters.length === 0 && (
          <Button size="sm" onClick={() => setFilters([{ key: 'verdict', label: 'Verdict: Wrong answer' }])}>
            Add a filter chip
          </Button>
        )}
        <div className="vd-tablewrap">
          <table className="vd-table">
            <caption className="vd-sr">Sortable columns</caption>
            <thead>
              <tr>
                <SortHeader
                  direction={sort.column === 'when' ? sort.direction : undefined}
                  onSort={() =>
                    setSort({
                      column: 'when',
                      direction: sort.column === 'when' && sort.direction === 'desc' ? 'asc' : 'desc',
                    })
                  }
                >
                  Submitted
                </SortHeader>
                <th scope="col">Member</th>
                <SortHeader
                  numeric
                  direction={sort.column === 'time' ? sort.direction : undefined}
                  onSort={() =>
                    setSort({
                      column: 'time',
                      direction: sort.column === 'time' && sort.direction === 'asc' ? 'desc' : 'asc',
                    })
                  }
                >
                  Time
                </SortHeader>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="vd-muted">{row.when}</td>
                  <td>{row.author}</td>
                  <td className="is-num vd-mono">{row.timeMs ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={20} total={87} onPage={setPage} />
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState title="No submissions yet" description="Submissions appear here once members solve problems." />
          <ErrorState
            title="Submissions could not be loaded"
            error={new Error('Check your connection and try again.')}
            reference="req_8f3a2c19"
            onRetry={() => undefined}
          />
        </div>
        <TableSkeleton
          label="Loading submissions"
          columns={[
            { header: 'Submission', width: 48 },
            { header: 'Submitted' },
            { header: 'Member', width: 120 },
            { header: 'Verdict', width: 96 },
            { header: 'Time', numeric: true, width: 48 },
          ]}
        />
        <p className="text-small text-text-muted">Clickable rows (click empty space in a row, not its text or link):</p>
        <SubmissionTable rows={sortedRows} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={h('detail')}>
        <h2 id={h('detail')} className="text-h2">
          Submission detail
        </h2>
        <div className="flex flex-wrap items-start gap-4">
          <TestcaseList items={TESTCASES} selectedId={selected} onSelect={setSelected} />
          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
            <DiffView
              expected={'5\n1 4\n2 3\n5 0\n8 1\n7 7'}
              actual={'5\n1 4 \n3 2\n5  0\n81'}
              actualLabel="Output (Ploy Srisuk)"
            />
          </div>
        </div>
        <p className="text-small text-text-muted">Long output: matching lines fold away.</p>
        <DiffView expected={LONG_EXPECTED} actual={LONG_ACTUAL} />
        <p className="text-small text-text-muted">
          Left column renamed, to compare a saved output with a generated one.
        </p>
        <DiffView
          expected={'3\n9'}
          actual={'3\n8'}
          expectedLabel="Saved"
          actualLabel="Generated"
          actualName="the generated file"
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={h('banner')}>
        <h2 id={h('banner')} className="text-h2">
          Banner, menu, dialog
        </h2>
        <Banner tone="info" title="Judged on an older version">
          This submission was judged on version 2, not the current version 3.
        </Banner>
        <Banner tone="warning" title="3 testcases have no expected output" action={<Button size="sm">Generate</Button>}>
          Generate it from the primary solution before publishing.
        </Banner>
        <Banner tone="danger" title="Generation timed out" action={<Button size="sm">Try again</Button>}>
          The solution took longer than the time limit on testcase 7.
        </Banner>
        <Banner tone="brand" title="Generated 12 outputs">
          10 are the same as before; 2 are new.
        </Banner>
        <div className="flex flex-wrap items-center gap-2">
          <Menu
            trigger={
              <button type="button" className="vd-iconbtn" aria-label="More actions for testcase 3">
                <Plus className="size-4" aria-hidden />
              </button>
            }
          >
            <MenuLabel>Testcase 3</MenuLabel>
            <MenuItem icon={Pencil} shortcut="E">
              Replace files…
            </MenuItem>
            <MenuItem icon={Play} disabled>
              Run (disabled)
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={Trash2} danger>
              Remove
            </MenuItem>
          </Menu>
          <Button onClick={() => setDialog('xl')}>Open dialog xl</Button>
          <Button onClick={() => setDialog('overwrite')}>Confirm overwrite</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="vd-dialog" style={{ maxWidth: 'none' }}>
            <div className="vd-dialog__head">
              <p className="vd-dialog__title">Dialog md · 440 px</p>
            </div>
            <p className="vd-dialog__desc">Confirms and short forms.</p>
          </div>
          <div className="vd-dialog vd-dialog--lg" style={{ maxWidth: 'none' }}>
            <div className="vd-dialog__head">
              <p className="vd-dialog__title">Dialog lg · 640 px</p>
            </div>
            <p className="vd-dialog__desc">Forms with several fields.</p>
          </div>
        </div>
        <Dialog
          open={dialog === 'xl'}
          onClose={() => setDialog(null)}
          size="xl"
          title="Testcase 9 · 2.1 MB"
          description="Dialog xl, 960 px: View all for a long testcase file."
          footer={<Button onClick={() => setDialog(null)}>Close</Button>}
        >
          <FilePreview name="9.in" text={FILE_TEXT} />
        </Dialog>
        <ConfirmOverwriteDialog
          open={dialog === 'overwrite'}
          onClose={() => setDialog(null)}
          onConfirm={() => setDialog(null)}
          title="Overwrite expected outputs?"
          description="5 testcases already have an expected output. Untick any you want to keep."
          items={CASES.map((item, index) => ({
            id: item.id,
            label: item.name,
            detail: `${index + 1}.out · 12 KB${index < 2 ? ' · visible to solvers' : ''}`,
          }))}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={h('edit')}>
        <h2 id={h('edit')} className="text-h2">
          Edit Problem pieces
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {CHANGES.map((change) => (
            <ChangeBadge key={change} kind={change} from={7} onUndo={() => undefined} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <DragHandle label="Testcase 3" />
          <span className="text-small text-text-muted">Drag handle (a view-only role gets none)</span>
        </div>
        <FilePreview
          name="3.in"
          text={FILE_TEXT}
          totalLines={148_000}
          onViewAll={() => setDialog('xl')}
          rawHref="/design"
        />
        <FilePreview name="1.in" text={'4 9\n2 7 11 15\n'} />
        <FileUploader
          files={files}
          multiple
          label="Upload testcase files"
          hint="Plain text, at most 8 MiB each."
          onFiles={(chosen) =>
            setFiles((current) => [
              ...current,
              ...chosen.map((file, index) => ({
                id: `${file.name}-${current.length + index}`,
                name: file.name,
                size: file.size,
                status: 'done' as const,
              })),
            ])
          }
          onRemove={(id) => setFiles((current) => current.filter((file) => file.id !== id))}
        />
        <FileUploader
          files={[{ id: 'x', name: 'statement.pdf', size: 52_000, status: 'done' }]}
          label="Statement PDF"
          onFiles={() => undefined}
        />
        <div className="flex flex-col gap-2">
          <p className="text-small text-text-muted">
            Sortable list (drag the grip, or use the keyboard: Space, arrows, Space; or the more actions menu). The
            order of the whole list is sent in one call; turn on “Fail next save” to see it roll back.
          </p>
          <Toggle label="Fail next save" checked={failNext} onCheckedChange={setFailNext} />
          <SortableListOf
            label="Testcases"
            items={order}
            getId={(item) => item.id}
            getLabel={(item) => item.name}
            onReorder={(ids) => save(setOrder, order, ids)}
            renderItem={(item, context) => (
              <div className="flex items-center gap-2 px-2 py-1">
                {context.handle}
                <span className="vd-mono text-text-muted w-6 text-right">{context.index + 1}</span>
                <span className="flex-1">{item.name}</span>
                {context.moveMenu}
              </div>
            )}
          />
          <p className="text-small text-text-muted">View-only: order shown, no handle, no menu.</p>
          <SortableListOf
            label="Testcases (view only)"
            readOnly
            items={CASES.slice(0, 2)}
            getId={(item) => item.id}
            getLabel={(item) => item.name}
            onReorder={() => undefined}
            renderItem={(item, context) => (
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="vd-mono text-text-muted w-6 text-right">{context.index + 1}</span>
                {item.name}
              </div>
            )}
          />
          <p className="text-small text-text-muted">
            Two lists: move between them (drag across, or Move to … in the menu).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <SortableLists
              lists={[
                { id: 'left', label: 'Track A', items: left },
                { id: 'right', label: 'Track B', items: right },
              ]}
              getId={(item) => item.id}
              getLabel={(item) => item.name}
              emptyLabel="Drop a problem here"
              onReorder={async (next) => {
                await new Promise((resolve) => setTimeout(resolve, 300));
                const all = [...left, ...right];
                setLeft((next.left ?? []).map((id) => all.find((item) => item.id === id)!));
                setRight((next.right ?? []).map((id) => all.find((item) => item.id === id)!));
              }}
              renderItem={(item, context) => (
                <div className="flex items-center gap-2 px-2 py-1">
                  {context.handle}
                  <span className="flex-1">{item.name}</span>
                  {context.moveMenu}
                </div>
              )}
            />
          </div>
        </div>
        {unsaved ? (
          <UnsavedBar count={3} onSave={() => setUnsaved(false)} onDiscard={() => setUnsaved(false)} />
        ) : (
          <Button size="sm" onClick={() => setUnsaved(true)}>
            Show the unsaved changes bar again
          </Button>
        )}
        <UnsavedBar count={1} saving onSave={() => undefined} onDiscard={() => undefined} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={h('solve')}>
        <h2 id={h('solve')} className="text-h2">
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
        <CodeEditorFrame
          languages={LANGUAGES}
          language={language}
          onLanguageChange={setLanguage}
          status={<TestProgress results={running} />}
        >
          <pre className="vd-code" aria-label="Example code">
            {SAMPLE_CODE.map((parts, index) => (
              <span key={index} className={`ln${index === 1 ? 'is-active' : ''}`}>
                {parts.map(([kindOf, text], part) => (
                  <span key={part} className={kindOf ? `tk-${kindOf}` : undefined}>
                    {text}
                  </span>
                ))}
              </span>
            ))}
          </pre>
        </CodeEditorFrame>
      </section>
    </div>
  );
}
