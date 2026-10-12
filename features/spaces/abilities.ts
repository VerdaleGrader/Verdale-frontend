import type { Role, Space } from './types';

export interface SpaceAbilities {
  isMember: boolean;
  /** Frozen when the Space is archived. */
  archived: boolean;
  /** Owner and administrator: name, description, members. */
  canManageSettings: boolean;
  /** Owner only: visibility, archive, handing the Space over. */
  canManageDanger: boolean;
  /** Owner and administrator: invitations, roles, removing members. */
  canManageMembers: boolean;
  canViewMembers: boolean;
  canLeave: boolean;
  /** Owner, administrator, editor and observer: drafts, hidden testcases, solutions, everybody's submissions (also in an archived Space, read-only). */
  canAuthorProblems: boolean;
  /** Owner, administrator and editor in a Space that is not archived: change problems, Tracks and Collections. */
  canEditProblems: boolean;
  /** Same people as `canEditProblems`. */
  canCreateProblems: boolean;
  /** Owner, administrator, editor and observer: the Space-wide submission pages and members' progression. */
  canReviewSubmissions: boolean;
}

/**
 * What to SHOW for the signed-in user, mirroring Core's permission table
 * (Verdale-core-service/src/permissions/can.ts). This only hides buttons that
 * would fail; Core checks every request again and is the source of truth.
 */
export function abilitiesOf(space: Pick<Space, 'my_role' | 'archived_at' | 'is_personal'>): SpaceAbilities {
  const role = space.my_role;
  const archived = space.archived_at !== null;
  const writes = role === 'owner' || role === 'administrator' || role === 'editor';
  const reads = writes || role === 'observer';
  const manages = role === 'owner' || role === 'administrator';
  return {
    isMember: role !== null,
    archived,
    canManageSettings: manages && !archived,
    canManageDanger: role === 'owner' && !archived,
    canManageMembers: manages && !archived,
    canViewMembers: role !== null,
    // The owner hands the Space over instead of leaving it.
    canLeave: role !== null && role !== 'owner',
    canAuthorProblems: reads,
    canEditProblems: writes && !archived,
    canCreateProblems: writes && !archived,
    canReviewSubmissions: reads,
  };
}

/**
 * Who may move a member from `from` (null: not a member yet, i.e. inviting) to `to`.
 * Mirrors canAssignRole in Core: the owner can do anything to anyone else; an
 * administrator only moves editors, observers and solvers among those three.
 */
export function canAssignRole(actorRole: Role | null, from: Role | null, to: Role): boolean {
  if (actorRole === 'owner') return from !== 'owner' && to !== 'owner';
  if (actorRole === 'administrator') {
    const below = (role: Role | null) => role === null || role === 'editor' || role === 'observer' || role === 'solver';
    return below(from) && below(to);
  }
  return false;
}

/** Who may remove a member (never themselves: leaving is a separate action). Mirrors canRemoveMember in Core. */
export function canRemoveMember(actorRole: Role | null, targetRole: Role): boolean {
  if (actorRole === 'owner') return targetRole !== 'owner';
  if (actorRole === 'administrator')
    return targetRole === 'editor' || targetRole === 'observer' || targetRole === 'solver';
  return false;
}
