import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

export type Space = Schemas['Space'];
export type SpacePage = Schemas['SpacePage'];
export type Member = Schemas['Member'];
export type Invite = Schemas['Invite'];
export type Role = Schemas['Role'];
export type Visibility = Space['visibility'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  editor: 'Editor',
  observer: 'Observer',
  solver: 'Solver',
};

/** What each role can do, shown in role pickers and next to the member list. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Everything an administrator can do, plus visibility, archiving and handing the Space over. One per Space.',
  administrator:
    'Manages settings, members and invitations, and creates and edits problems, Tracks and Collections. Cannot change visibility, archive or hand over the Space, or manage other administrators.',
  editor:
    'Creates, edits and publishes problems, Tracks and Collections. Sees drafts, hidden testcases and every submission.',
  observer:
    'Sees testcases, expected output, the code of every submission and the members of the Space. Cannot edit or manage problems.',
  solver: 'Solves the problems in the Tracks they can reach and submits solutions.',
};

/** Roles that can be given to someone, strongest first. The owner is only ever handed over. */
export const ASSIGNABLE_ROLES = ['administrator', 'editor', 'observer', 'solver'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
