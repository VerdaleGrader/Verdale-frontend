import type { DropdownOption } from '@/components/ui/dropdown';
import { canAssignRole } from './abilities';
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from './types';

/**
 * The options of a role picker: every role that can be given, each with its description.
 * Roles the signed-in person may not hand out stay in the list, locked.
 * `from` is the member's current role, or null when inviting someone new.
 */
export function roleOptions(actorRole: Role | null, from: Role | null): DropdownOption[] {
  return ASSIGNABLE_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
    description: ROLE_DESCRIPTIONS[role],
    locked: !canAssignRole(actorRole, from, role),
  }));
}

/** Can the signed-in person change this member's role at all? */
export function canChangeRoleOf(actorRole: Role | null, from: Role): boolean {
  return roleOptions(actorRole, from).some((option) => !option.locked);
}
