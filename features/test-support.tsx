import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider, type AuthState } from '@/features/auth/hooks/auth-provider';
import type { Problem, ProblemConstraints, ProblemEditor } from '@/features/problems/types';
import { abilitiesOf } from '@/features/spaces/abilities';
import { SpaceContext } from '@/features/spaces/components/space-shell';
import type { Role, Space } from '@/features/spaces/types';
import type { Submission, SubmissionSummary } from '@/features/submissions/api/submissions.api';

/** Builders and a renderer shared by component tests. Not a test file itself. */

export function makeSpace(role: Role | null = 'solver', overrides: Partial<Space> = {}): Space {
  return {
    id: 'sp1',
    name: 'Team',
    slug: 'team',
    description: '',
    visibility: 'public',
    is_personal: false,
    archived_at: null,
    created_at: '2026-10-11T00:00:00Z',
    my_role: role,
    ...overrides,
  };
}

export const USER = {
  id: 'u1',
  email: 'sol@example.com',
  username: 'sol',
  display_name: 'Sol',
  avatar_url: null,
  created_at: '2026-10-11T00:00:00Z',
};

export const AUTHENTICATED: AuthState = { status: 'authenticated', user: USER };
export const ANONYMOUS: AuthState = { status: 'anonymous', user: null };

export function renderInApp(
  ui: React.ReactNode,
  { space = makeSpace(), auth = AUTHENTICATED }: { space?: Space; auth?: AuthState } = {}
) {
  return render(
    <AuthProvider initial={auth}>
      <ToastProvider>
        <SpaceContext.Provider value={{ space, abilities: abilitiesOf(space), reload: () => undefined }}>
          {ui}
        </SpaceContext.Provider>
      </ToastProvider>
    </AuthProvider>
  );
}

export function makeProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'p1',
    slug: 'sum',
    status: 'published',
    space: { name: 'Team', slug: 'team' },
    title: 'Sum of two numbers',
    statement: '## Task\n\nRead $a$ and $b$ and print $a + b$.',
    statement_mode: 'markdown',
    statement_pdf: null,
    version_number: 1,
    time_limit_ms: 1000,
    memory_limit_kb: 262144,
    allowed_languages: ['c', 'cpp', 'python'],
    samples: [{ position: 1, input: '1 2\n', output: '3\n' }],
    accepts_submissions: true,
    created_by: { username: 'edith', display_name: 'Edith', avatar_url: null },
    published_at: '2026-10-11T00:00:00Z',
    ...overrides,
  };
}

export const CONSTRAINTS: ProblemConstraints = {
  title_max_length: 200,
  statement_max_length: 100000,
  time_limit_ms: { min: 100, max: 10000, default: 1000 },
  memory_limit_kb: { min: 16384, max: 1048576, default: 262144 },
  languages: ['c', 'cpp', 'python'],
  tests: {
    max_count: 100,
    max_total_bytes: 134217728,
    max_file_bytes: 8388608,
    max_sample_bytes: 65536,
    max_samples: 10,
  },
  images: { max_bytes: 2097152, content_types: ['image/png', 'image/jpeg', 'image/webp'] },
  solutions: { max_count: 5 },
  source_max_bytes: 65536,
  pdf: { max_bytes: 10485760, max_pages: 10 },
};

export function makeEditor(overrides: Partial<ProblemEditor> = {}): ProblemEditor {
  return {
    id: 'p1',
    slug: 'sum',
    status: 'draft',
    space: { name: 'Team', slug: 'team' },
    version: {
      id: 'v1',
      number: 1,
      status: 'draft',
      title: 'Sum of two numbers',
      statement: 'Read $a$ and $b$.',
      statement_mode: 'markdown',
      statement_pdf: null,
      time_limit_ms: 1000,
      memory_limit_kb: 262144,
      allowed_languages: ['c', 'cpp', 'python'],
      created_at: '2026-10-11T00:00:00Z',
      updated_at: '2026-10-11T00:00:00Z',
      published_at: null,
    },
    editable: true,
    created_by: { username: 'edith', display_name: 'Edith', avatar_url: null },
    created_at: '2026-10-11T00:00:00Z',
    updated_at: '2026-10-11T00:00:00Z',
    tests: { count: 2, sample_count: 1, missing_output_count: 0, total_bytes: 20 },
    solutions: { count: 1, has_primary: true },
    publish_checks: [
      { key: 'statement', ok: true, message: 'The statement is written.' },
      { key: 'languages', ok: true, message: 'At least one language is allowed.' },
      { key: 'tests', ok: true, message: '2 testcase(s) added.' },
      { key: 'sample_test', ok: true, message: '1 sample testcase(s) shown to solvers.' },
      { key: 'solution', ok: true, message: 'A primary reference solution is attached.' },
    ],
    can_publish: true,
    constraints: CONSTRAINTS,
    ...overrides,
  };
}

export function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 's1',
    number: 1,
    problem: { slug: 'sum', title: 'Sum of two numbers' },
    space: { name: 'Team', slug: 'team' },
    author: { username: 'sol', display_name: 'Sol', avatar_url: null },
    language: 'cpp',
    status: 'queued',
    verdict: null,
    time_ms: null,
    memory_kb: null,
    tests_passed: null,
    tests_total: 2,
    test_runs: [],
    created_at: '2026-10-11T00:00:00Z',
    judged_at: null,
    compile_message: null,
    error_code: null,
    results: [],
    can_rejudge: false,
    source: 'int main() { return 0; }',
    ...overrides,
  };
}

/** What creating or listing a submission returns: the full one without source, results and the like. */
export function makeSummary(overrides: Partial<SubmissionSummary> = {}): SubmissionSummary {
  const full = makeSubmission();
  return {
    id: full.id,
    number: full.number,
    problem: full.problem,
    space: full.space,
    author: full.author,
    language: full.language,
    status: full.status,
    verdict: full.verdict,
    time_ms: full.time_ms,
    memory_kb: full.memory_kb,
    tests_passed: full.tests_passed,
    tests_total: full.tests_total,
    test_runs: full.test_runs,
    created_at: full.created_at,
    judged_at: full.judged_at,
    ...overrides,
  };
}

/** Just enough of EventSource for components: tests push events by hand. */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  readyState = 1;
  closed = false;
  private listeners = new Map<string, Array<(event: unknown) => void>>();
  constructor(
    readonly url: string,
    readonly init?: EventSourceInit
  ) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  push(submission: Submission) {
    this.emit('submission', { data: JSON.stringify(submission) });
  }
  static get last() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
  }
}

/** Open a Dropdown by its accessible name and pick an option by its name. */
export async function chooseOption(name: string | RegExp, option: string | RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}
