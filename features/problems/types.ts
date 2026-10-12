import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

export type Language = Schemas['Language'];
export type ProblemStatus = Schemas['ProblemStatus'];
export type ProblemSummary = Schemas['ProblemSummary'];
export type ProblemPage = Schemas['ProblemPage'];
export type Problem = Schemas['Problem'];
export type ProblemEditor = Schemas['ProblemEditor'];
export type ProblemConstraints = Schemas['ProblemConstraints'];
export type PublishCheck = Schemas['PublishCheck'];
export type TestCase = Schemas['TestCase'];
export type TestCaseList = Schemas['TestCaseList'];
export type ReferenceSolution = Schemas['ReferenceSolution'];
export type UpdateProblemRequest = Schemas['UpdateProblemRequest'];

export const LANGUAGE_LABELS: Record<Language, string> = { c: 'C', cpp: 'C++', python: 'Python 3' };
export const LANGUAGE_OPTIONS = (Object.keys(LANGUAGE_LABELS) as Language[]).map((value) => ({
  value,
  label: LANGUAGE_LABELS[value],
}));

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

/** Memory is shown in MB (whole numbers); the API counts kilobytes. */
export const kilobytesToMegabytes = (kilobytes: number) => Math.round(kilobytes / 1024);
export const megabytesToKilobytes = (megabytes: number) => Math.round(megabytes * 1024);

/** "8 MiB", "1.5 KiB", "812 bytes" for sizes of files and totals. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Number((bytes / (1024 * 1024)).toFixed(1))} MiB`;
  if (bytes >= 1024) return `${Number((bytes / 1024).toFixed(1))} KiB`;
  return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
}
