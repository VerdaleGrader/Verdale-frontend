import { ApiError } from '@/lib/api';
import {
  VERSION_STATUS_LABELS,
  type ProblemEditor,
  type ProblemVersion,
  type VersionFields,
  type VersionHistoryEntry,
} from './types';

/** Display names of the fields Core lists in `constraints.version_fields`; an unknown name is shown as it is. */
const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  statement: 'Statement',
  statement_mode: 'Statement format',
  time_limit_ms: 'Time limit',
  memory_limit_kb: 'Memory limit',
  allowed_languages: 'Languages',
  tests: 'Testcases',
  solutions: 'Reference solutions',
};

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;
export const fieldLabels = (fields: string[]) => fields.map(fieldLabel).join(', ');

export interface UpdatePrediction {
  /** `none`: nothing changed and nothing forced. */
  kind: 'none' | 'minor' | 'major';
  /** Major only because the box is ticked. */
  forced: boolean;
  /** The changed fields that make it Major (from `version_fields.major`). */
  majorFields: string[];
  minorFields: string[];
}

/**
 * What the update will probably be, from the changed request fields and Force major. Core classifies the real
 * update with the same two lists, so this only predicts; Core's outcome wins.
 */
export function predictUpdate(fields: VersionFields, changed: string[], forceMajor: boolean): UpdatePrediction {
  const majorFields = changed.filter((field) => fields.major.includes(field));
  const minorFields = changed.filter((field) => !fields.major.includes(field));
  if (majorFields.length > 0) return { kind: 'major', forced: false, majorFields, minorFields };
  if (forceMajor) return { kind: 'major', forced: true, majorFields, minorFields };
  return { kind: minorFields.length > 0 ? 'minor' : 'none', forced: false, majorFields, minorFields };
}

/** True when the problem has a published version and a Major draft is open next to it. */
export const hasMajorDraft = (editor: Pick<ProblemEditor, 'version' | 'open_version'>) =>
  editor.open_version !== null && editor.open_version.id !== editor.version.id;

/** A published problem with no draft: edits go through the update flow. */
export const isUpdatable = (editor: Pick<ProblemEditor, 'status' | 'version'>) =>
  editor.status === 'published' && editor.version.status === 'published';

export const versionLabel = (version: Pick<ProblemVersion, 'label'> | null | undefined) => version?.label ?? '';

const MESSAGES: Record<string, string> = {
  VERIFY_BLOCKED: 'Verification cannot start yet. Finish the items in the checklist first.',
  VERIFY_IN_PROGRESS: 'A verification is already running. Wait for it to finish.',
  NO_VERIFICATION: 'This version has not been verified yet.',
  VERSION_CONFLICT: 'Someone else changed this problem while you were editing.',
  DRAFT_EXISTS: 'A Major draft is already open for this problem.',
  NO_DRAFT: 'There is no Major draft to work on.',
  NOT_PUBLISHED: 'This problem has never been published, so it has no Major draft.',
  MAJOR_FIELD_LOCKED:
    'Tests, reference solutions, limits and languages of a published version cannot be changed directly. Start a Major draft.',
  PUBLISH_BLOCKED: 'This version is not ready to publish. Check the list of requirements.',
};

/** Clear text for the error codes of the publish gate and versions; anything else keeps Core's own message. */
export function versionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const base = MESSAGES[error.errorCode];
    if (base) {
      const extra = (error.details ?? []).map((detail) => detail.message).filter(Boolean);
      return extra.length > 0 && error.errorCode === 'VERIFY_BLOCKED' ? `${base} ${extra.join(' ')}` : base;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

/** The current label Core puts in the `details` of a VERSION_CONFLICT (field `label`, or any v1.2 looking message). */
export function conflictLabel(error: ApiError): string | undefined {
  const details = error.details ?? [];
  const named = details.find((detail) => detail.field === 'label')?.message;
  return (
    named ??
    details.find((detail) => /^v\d+\.\d+$/.test(detail.message))?.message ??
    /v\d+\.\d+/.exec(error.message)?.[0]
  );
}

/** How a history entry reads in the list: its kind and, for state changes, "draft → verified". */
export function describeHistoryEntry(entry: VersionHistoryEntry): {
  kind: 'minor' | 'major' | 'state';
  label: string;
} {
  switch (entry.type) {
    case 'minor_update':
      return { kind: 'minor', label: 'Minor update' };
    case 'major_draft_created':
      return { kind: 'major', label: 'Major draft started' };
    case 'major_draft_discarded':
      return { kind: 'major', label: 'Major draft discarded' };
    case 'state_change': {
      const from = entry.state_from ? VERSION_STATUS_LABELS[entry.state_from] : '–';
      const to = entry.state_to ? VERSION_STATUS_LABELS[entry.state_to] : '–';
      return { kind: 'state', label: `${from} → ${to}` };
    }
  }
}
