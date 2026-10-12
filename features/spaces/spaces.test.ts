import { describe, expect, it } from 'vitest';
import { abilitiesOf, canAssignRole, canRemoveMember } from './abilities';
import { suggestSlug } from './slug';
import { visibilityWarning } from './components/space-settings';
import type { Space } from './types';

const base = { my_role: null, archived_at: null, is_personal: false } satisfies Pick<
  Space,
  'my_role' | 'archived_at' | 'is_personal'
>;

describe('abilitiesOf (what to show; Core decides what is allowed)', () => {
  const frozen = { archived_at: '2026-10-11T00:00:00Z' };

  it('a visitor or non-member sees no management and no members', () => {
    expect(abilitiesOf(base)).toEqual({
      isMember: false,
      archived: false,
      canManageSettings: false,
      canManageDanger: false,
      canManageMembers: false,
      canViewMembers: false,
      canLeave: false,
      canAuthorProblems: false,
      canEditProblems: false,
      canCreateProblems: false,
      canReviewSubmissions: false,
    });
  });

  it('owners, administrators and editors write problems; an observer reads them; a solver neither', () => {
    for (const role of ['owner', 'administrator', 'editor'] as const) {
      expect(abilitiesOf({ ...base, my_role: role })).toMatchObject({
        canAuthorProblems: true,
        canEditProblems: true,
        canCreateProblems: true,
        canReviewSubmissions: true,
      });
      expect(abilitiesOf({ ...base, my_role: role, ...frozen })).toMatchObject({
        canAuthorProblems: true,
        canEditProblems: false,
        canCreateProblems: false,
      });
    }
    expect(abilitiesOf({ ...base, my_role: 'observer' })).toMatchObject({
      canAuthorProblems: true,
      canReviewSubmissions: true,
      canEditProblems: false,
      canCreateProblems: false,
    });
    expect(abilitiesOf({ ...base, my_role: 'solver' })).toMatchObject({
      canAuthorProblems: false,
      canReviewSubmissions: false,
      canCreateProblems: false,
    });
  });

  it.each(['editor', 'observer', 'solver'] as const)('%s can see members and leave, not manage', (role) => {
    expect(abilitiesOf({ ...base, my_role: role })).toMatchObject({
      canViewMembers: true,
      canLeave: true,
      canManageMembers: false,
      canManageSettings: false,
      canManageDanger: false,
    });
  });

  it('an administrator runs settings and members but not the dangerous settings', () => {
    expect(abilitiesOf({ ...base, my_role: 'administrator' })).toMatchObject({
      canManageSettings: true,
      canManageMembers: true,
      canManageDanger: false,
      canLeave: true,
    });
  });

  it('the owner manages everything and hands the Space over instead of leaving', () => {
    expect(abilitiesOf({ ...base, my_role: 'owner' })).toMatchObject({
      canManageSettings: true,
      canManageMembers: true,
      canManageDanger: true,
      canLeave: false,
    });
  });

  it('an archived Space freezes management but members may still see members', () => {
    expect(abilitiesOf({ ...base, my_role: 'owner', ...frozen })).toMatchObject({
      archived: true,
      canManageSettings: false,
      canManageDanger: false,
      canManageMembers: false,
      canViewMembers: true,
    });
  });
});

describe('suggestSlug', () => {
  it.each([
    ['Graph Theory', 'graph-theory'],
    ['  Dynamic   Programming!! ', 'dynamic-programming'],
    ['Café Ünïcode', 'cafe-unicode'],
    ['日本語', ''],
    ['a'.repeat(50), 'a'.repeat(32)],
    ['ends with dash -----', 'ends-with-dash'],
  ])('%j -> %j', (name, slug) => {
    expect(suggestSlug(name)).toBe(slug);
  });
});

describe('visibilityWarning', () => {
  it('says what happens when going private, in words', () => {
    expect(visibilityWarning('public', 'private', 'Team')).toMatch(/lose access immediately/);
  });
  it('says who will see it when going public', () => {
    expect(visibilityWarning('private', 'public', 'Team')).toMatch(/visitors who are not logged in/);
  });
});

describe('canAssignRole and canRemoveMember (mirror Core)', () => {
  it('lets the owner assign any role to anyone but the owner, and never "owner" (that is a handover)', () => {
    for (const from of [null, 'administrator', 'editor', 'observer', 'solver'] as const) {
      for (const to of ['administrator', 'editor', 'observer', 'solver'] as const) {
        expect(canAssignRole('owner', from, to)).toBe(true);
      }
      expect(canAssignRole('owner', from, 'owner')).toBe(false);
    }
    expect(canAssignRole('owner', 'owner', 'editor')).toBe(false);
  });

  it('keeps administrators among editors, observers and solvers', () => {
    for (const from of [null, 'editor', 'observer', 'solver'] as const) {
      for (const to of ['editor', 'observer', 'solver'] as const) {
        expect(canAssignRole('administrator', from, to)).toBe(true);
      }
      expect(canAssignRole('administrator', from, 'administrator')).toBe(false);
    }
    expect(canAssignRole('administrator', 'administrator', 'editor')).toBe(false);
    expect(canAssignRole('administrator', 'owner', 'editor')).toBe(false);
  });

  it('gives everybody else nothing', () => {
    for (const actor of ['editor', 'observer', 'solver', null] as const) {
      expect(canAssignRole(actor, 'solver', 'editor')).toBe(false);
      expect(canRemoveMember(actor, 'solver')).toBe(false);
    }
  });

  it('removes: the owner anyone else, an administrator only editors, observers and solvers', () => {
    expect(canRemoveMember('owner', 'administrator')).toBe(true);
    expect(canRemoveMember('owner', 'owner')).toBe(false);
    expect(canRemoveMember('administrator', 'editor')).toBe(true);
    expect(canRemoveMember('administrator', 'administrator')).toBe(false);
    expect(canRemoveMember('administrator', 'owner')).toBe(false);
  });
});
