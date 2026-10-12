import {
  kilobytesToMegabytes,
  megabytesToKilobytes,
  type Language,
  type ProblemConstraints,
  type ProblemEditor,
} from '../types';

/** What the form holds. Numbers stay text while they are being typed. */
export interface StatementDraft {
  title: string;
  statement: string;
  timeLimitMs: string;
  memoryLimitMb: string;
  languages: Language[];
}

export function draftOf(editor: ProblemEditor): StatementDraft {
  const { version } = editor;
  return {
    title: version.title,
    statement: version.statement,
    timeLimitMs: String(version.time_limit_ms),
    memoryLimitMb: String(kilobytesToMegabytes(version.memory_limit_kb)),
    languages: [...version.allowed_languages].sort(),
  };
}

export type DraftErrors = Partial<Record<'title' | 'timeLimitMs' | 'memoryLimitMb' | 'languages', string>>;

/** Mistakes we can see without asking Core, so they never leave the browser. */
export function validateDraft(draft: StatementDraft, constraints: ProblemConstraints): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.title.trim()) errors.title = 'Enter a title.';
  else if (draft.title.trim().length > constraints.title_max_length) {
    errors.title = `Use at most ${constraints.title_max_length} characters.`;
  }
  const time = Number(draft.timeLimitMs);
  const { min: timeMin, max: timeMax } = constraints.time_limit_ms;
  if (draft.timeLimitMs.trim() === '' || !Number.isInteger(time))
    errors.timeLimitMs = 'Use a whole number of milliseconds.';
  else if (time < timeMin || time > timeMax) errors.timeLimitMs = `Use between ${timeMin} and ${timeMax} ms.`;
  const memory = Number(draft.memoryLimitMb);
  const memoryMin = Math.ceil(constraints.memory_limit_kb.min / 1024);
  const memoryMax = Math.floor(constraints.memory_limit_kb.max / 1024);
  if (draft.memoryLimitMb.trim() === '' || !Number.isInteger(memory))
    errors.memoryLimitMb = 'Use a whole number of megabytes.';
  else if (memory < memoryMin || memory > memoryMax)
    errors.memoryLimitMb = `Use between ${memoryMin} and ${memoryMax} MB.`;
  if (draft.languages.length === 0) errors.languages = 'Allow at least one language.';
  return errors;
}

/** Only what changed, in the shape Core expects. */
export function patchOf(draft: StatementDraft, saved: StatementDraft) {
  return {
    ...(draft.title.trim() !== saved.title ? { title: draft.title.trim() } : {}),
    ...(draft.statement !== saved.statement ? { statement: draft.statement } : {}),
    ...(draft.timeLimitMs !== saved.timeLimitMs ? { time_limit_ms: Number(draft.timeLimitMs) } : {}),
    ...(draft.memoryLimitMb !== saved.memoryLimitMb
      ? { memory_limit_kb: megabytesToKilobytes(Number(draft.memoryLimitMb)) }
      : {}),
    ...(draft.languages.join() !== saved.languages.join() ? { allowed_languages: draft.languages } : {}),
  };
}

export const SERVER_FIELDS: Record<string, keyof DraftErrors | 'statement'> = {
  title: 'title',
  statement: 'statement',
  time_limit_ms: 'timeLimitMs',
  memory_limit_kb: 'memoryLimitMb',
  allowed_languages: 'languages',
};
