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

/** What each role can do, for hints next to role pickers. */
export const ROLE_HINTS: Record<Role, string> = {
  owner: 'Manages settings and members.',
  administrator: 'Manages members and problems.',
  editor: 'Creates and edits problems.',
  observer: 'Reads everything, changes nothing.',
  solver: 'Views problems and submits solutions.',
};
