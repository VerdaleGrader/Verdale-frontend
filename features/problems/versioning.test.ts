import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { CONSTRAINTS } from '../test-support';
import { conflictLabel, fieldLabels, predictUpdate, versionErrorMessage } from './versioning';

const fields = CONSTRAINTS.version_fields;

describe('predictUpdate', () => {
  it('is none without changes', () => {
    expect(predictUpdate(fields, [], false).kind).toBe('none');
  });
  it('is minor when only minor fields change', () => {
    const result = predictUpdate(fields, ['title', 'statement'], false);
    expect(result).toMatchObject({ kind: 'minor', forced: false, majorFields: [] });
  });
  it('is major when one major field changes, and lists it', () => {
    const result = predictUpdate(fields, ['title', 'time_limit_ms'], false);
    expect(result).toMatchObject({ kind: 'major', forced: false, majorFields: ['time_limit_ms'] });
  });
  it('is major by force when nothing else makes it major', () => {
    expect(predictUpdate(fields, ['title'], true)).toMatchObject({ kind: 'major', forced: true });
    expect(predictUpdate(fields, [], true)).toMatchObject({ kind: 'major', forced: true });
  });
  it('follows the lists Core sends, not fixed names', () => {
    expect(predictUpdate({ major: ['title'], minor: [] }, ['title'], false).kind).toBe('major');
  });
});

describe('messages', () => {
  it('maps the gate error codes to clear text', () => {
    for (const code of [
      'VERIFY_IN_PROGRESS',
      'NO_VERIFICATION',
      'VERSION_CONFLICT',
      'DRAFT_EXISTS',
      'NO_DRAFT',
      'NOT_PUBLISHED',
      'MAJOR_FIELD_LOCKED',
    ]) {
      const message = versionErrorMessage(new ApiError(409, code, 'raw core text'));
      expect(message).not.toBe('raw core text');
    }
  });
  it('adds what is missing to VERIFY_BLOCKED and keeps unknown codes as Core said them', () => {
    const blocked = new ApiError(409, 'VERIFY_BLOCKED', 'x', [{ field: 'tests', message: 'Add a testcase.' }]);
    expect(versionErrorMessage(blocked)).toContain('Add a testcase.');
    expect(versionErrorMessage(new ApiError(500, 'OTHER', 'Core says no'))).toBe('Core says no');
  });
  it('reads the current label of a conflict', () => {
    expect(conflictLabel(new ApiError(409, 'VERSION_CONFLICT', 'x', [{ field: 'label', message: 'v2.3' }]))).toBe(
      'v2.3'
    );
  });
  it('names fields, falling back to the raw name', () => {
    expect(fieldLabels(['time_limit_ms', 'whatever'])).toBe('Time limit, whatever');
  });
});
