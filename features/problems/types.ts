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
export type TestLimits = Schemas['TestLimits'];
export type TextSlice = Schemas['TextSlice'];
export type StagedFile = Schemas['StagedFile'];
export type GenerateJob = Schemas['GenerateJob'];
export type GenerateRun = Schemas['GenerateRun'];
export type SaveTestCasesRequest = Schemas['SaveTestCasesRequest'];
export type ReferenceSolution = Schemas['ReferenceSolution'];
export type UpdateProblemRequest = Schemas['UpdateProblemRequest'];
export type ProblemVersion = Schemas['ProblemVersion'];
export type VerificationRun = Schemas['VerificationRun'];
export type VerificationTestResult = Schemas['VerificationTestResult'];
export type PublishedUpdateRequest = Schemas['PublishedUpdateRequest'];
export type UpdateOutcome = Schemas['UpdateOutcome'];
export type VersionHistoryEntry = Schemas['VersionHistoryEntry'];
export type VersionFields = Schemas['VersionFields'];

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

/** The state of one version, which the publish gate moves through: draft, verifying, verified, published. */
export const VERSION_STATUS_LABELS: Record<ProblemVersion['status'], string> = {
  draft: 'Draft',
  verifying: 'Verifying',
  verified: 'Verified',
  published: 'Published',
};

/** Memory is shown in MB (whole numbers); the API counts kilobytes. */
export const kilobytesToMegabytes = (kilobytes: number) => Math.round(kilobytes / 1024);
export const megabytesToKilobytes = (megabytes: number) => Math.round(megabytes * 1024);

export { formatBytes } from '@/lib/format';
