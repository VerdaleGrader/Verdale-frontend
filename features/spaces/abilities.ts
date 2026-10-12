import type { Space } from './types';

export interface SpaceAbilities {
  isMember: boolean;
  /** Frozen when the Space is archived. */
  archived: boolean;
  canManageSettings: boolean;
  canManageMembers: boolean;
  canViewMembers: boolean;
  canLeave: boolean;
  /** Owners and editors: they see drafts, tests and solutions (also in an archived Space, read-only). */
  canAuthorProblems: boolean;
  /** Owners and editors in a Space that is not archived. */
  canCreateProblems: boolean;
}

/**
 * What to SHOW for the signed-in user, mirroring Core's permission table
 * (Verdale-core-service/docs/auth.md). This only hides buttons that would
 * fail; Core checks every request again and is the source of truth.
 */
export function abilitiesOf(space: Pick<Space, 'my_role' | 'archived_at' | 'is_personal'>): SpaceAbilities {
  const role = space.my_role;
  const archived = space.archived_at !== null;
  return {
    isMember: role !== null,
    archived,
    canManageSettings: role === 'owner' && !archived,
    canManageMembers: role === 'owner' && !archived,
    canViewMembers: role !== null,
    // A personal Space always has exactly one owner, who cannot leave it.
    canLeave: role !== null && !(space.is_personal && role === 'owner'),
    canAuthorProblems: role === 'owner' || role === 'editor',
    canCreateProblems: (role === 'owner' || role === 'editor') && !archived,
  };
}
