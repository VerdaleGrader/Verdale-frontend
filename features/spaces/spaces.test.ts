import { describe, expect, it } from 'vitest';
import { abilitiesOf } from './abilities';
import { suggestSlug } from './slug';
import { visibilityWarning } from './components/space-settings';
import type { Space } from './types';

const base = { my_role: null, archived_at: null, is_personal: false } satisfies Pick<
  Space,
  'my_role' | 'archived_at' | 'is_personal'
>;

describe('abilitiesOf (what to show; Core decides what is allowed)', () => {
  it('a visitor or non-member sees no management and no members', () => {
    expect(abilitiesOf(base)).toEqual({
      isMember: false,
      archived: false,
      canManageSettings: false,
      canManageMembers: false,
      canViewMembers: false,
      canLeave: false,
      canAuthorProblems: false,
      canCreateProblems: false,
    });
  });

  it('owners and editors author problems; solvers do not; an archived Space is read-only', () => {
    for (const role of ['owner', 'editor'] as const) {
      expect(abilitiesOf({ ...base, my_role: role })).toMatchObject({
        canAuthorProblems: true,
        canCreateProblems: true,
      });
      expect(abilitiesOf({ ...base, my_role: role, archived_at: '2026-10-11T00:00:00Z' })).toMatchObject({
        canAuthorProblems: true,
        canCreateProblems: false,
      });
    }
    expect(abilitiesOf({ ...base, my_role: 'solver' })).toMatchObject({
      canAuthorProblems: false,
      canCreateProblems: false,
    });
  });

  it.each(['editor', 'solver'] as const)('%s can see members and leave, not manage', (role) => {
    const abilities = abilitiesOf({ ...base, my_role: role });
    expect(abilities).toMatchObject({
      canViewMembers: true,
      canLeave: true,
      canManageMembers: false,
      canManageSettings: false,
    });
  });

  it('an owner manages settings and members', () => {
    expect(abilitiesOf({ ...base, my_role: 'owner' })).toMatchObject({
      canManageSettings: true,
      canManageMembers: true,
      canLeave: true,
    });
  });

  it('an archived Space freezes management but members may still leave and see members', () => {
    expect(abilitiesOf({ ...base, my_role: 'owner', archived_at: '2026-10-11T00:00:00Z' })).toMatchObject({
      archived: true,
      canManageSettings: false,
      canManageMembers: false,
      canViewMembers: true,
      canLeave: true,
    });
  });

  it("a personal Space's owner cannot leave it, but another member could", () => {
    expect(abilitiesOf({ ...base, my_role: 'owner', is_personal: true }).canLeave).toBe(false);
    expect(abilitiesOf({ ...base, my_role: 'solver', is_personal: true }).canLeave).toBe(true);
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
