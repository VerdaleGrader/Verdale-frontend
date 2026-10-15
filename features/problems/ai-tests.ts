import { newTest, type DraftFile, type DraftTest } from './test-drafts';
import type { AiCategory, AiProvider, AiTestItem, AiTestJob } from './types';

/** The most inputs one request may ask for (Core: `AI_TEST_LIMITS.max_count`). */
export const AI_MAX_COUNT = 20;

export const AI_PROVIDERS: Array<{ value: AiProvider; label: string; company: string; description: string }> = [
  { value: 'gemini', label: 'Gemini', company: 'Google', description: 'Uses your own Gemini API key from Google.' },
  {
    value: 'claude',
    label: 'Claude',
    company: 'Anthropic',
    description: 'Uses your own Claude API key from Anthropic.',
  },
];

export const AI_CATEGORIES: Array<{ value: AiCategory; label: string; description: string }> = [
  { value: 'edge', label: 'Edge cases', description: 'Smallest sizes, boundary values and degenerate shapes.' },
  { value: 'max', label: 'Largest values', description: 'The largest values the constraints allow.' },
  { value: 'random', label: 'Random values', description: 'Random values within the constraints.' },
];

export const providerLabel = (provider: AiProvider) => AI_PROVIDERS.find((item) => item.value === provider)!.label;
export const providerCompany = (provider: AiProvider) => AI_PROVIDERS.find((item) => item.value === provider)!.company;

/** What is wrong with the number of testcases typed, or null when it is fine. */
export function countProblem(text: string): string | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return `Enter a whole number from 1 to ${AI_MAX_COUNT}.`;
  const count = Number(trimmed);
  if (count < 1 || count > AI_MAX_COUNT) return `Enter a number from 1 to ${AI_MAX_COUNT}.`;
  return null;
}

/** What to do next for the job-wide errors Core names; its own message says what happened. */
export function failureHint(code: string): string | null {
  switch (code) {
    case 'AI_KEY_INVALID':
      return 'Check the key on the provider’s site, save it again, then try again.';
    case 'AI_QUOTA_EXCEEDED':
      return 'Check the plan and billing of your provider account, or try again later.';
    case 'COMPILE_ERROR':
      return 'Fix the solution on the Solutions tab, or pick another one.';
    default:
      return null;
  }
}

export const isRunning = (job: AiTestJob) => job.status === 'generating' || job.status === 'computing';

/** The drafts the person can keep: items with an input and an output. */
export const usableItems = (job: AiTestJob) => job.items.filter((item) => item.status === 'ok');

/**
 * Turns the ticked drafts into rows of the testcases page. An item whose input the person edited gets the new
 * input (`stage` stores it) and no output: the old output belongs to the old input, so it is generated again after
 * saving.
 */
export async function draftsFromAi(
  items: AiTestItem[],
  edits: Record<string, string>,
  makeKey: () => string,
  stage: (text: string) => Promise<{ sha256: string; size_bytes: number; total_lines: number }>
): Promise<DraftTest[]> {
  const drafts: DraftTest[] = [];
  for (const item of items) {
    const edited = edits[item.id];
    if (edited !== undefined && edited !== item.input_text) {
      const staged = await stage(edited);
      const input: DraftFile = {
        sha256: staged.sha256,
        size: staged.size_bytes,
        totalLines: staged.total_lines,
        origin: 'paste',
        local: edited,
      };
      drafts.push(newTest(makeKey(), input, null, false));
      continue;
    }
    const input: DraftFile = {
      sha256: item.input!.sha256,
      size: item.input!.size_bytes,
      origin: 'paste',
      local: item.input_text ?? undefined,
    };
    const output: DraftFile | null = item.output
      ? { sha256: item.output.sha256, size: item.output.size_bytes, origin: 'generated' }
      : null;
    drafts.push(newTest(makeKey(), input, output, false));
  }
  return drafts;
}
