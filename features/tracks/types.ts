import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

export type Track = Schemas['Track'];
export type TrackDetail = Schemas['TrackDetail'];
export type TrackCollection = Schemas['TrackCollection'];
export type TrackProblem = Schemas['TrackProblem'];
export type CollectionDetail = Schemas['CollectionDetail'];
export type TrackVisibility = Schemas['TrackVisibility'];
export type TrackMember = Schemas['TrackMember'];
export type Progress = Schemas['Progress'];
export type UserProgress = Schemas['UserProgress'];
export type MemberProgress = Schemas['MemberProgress'];

export const VISIBILITY_LABELS: Record<TrackVisibility, string> = {
  space: 'Everyone in the Space',
  members: 'Only people added to the Track',
};

/** What each privacy level means for who sees the Track, for the settings screen and the create form. */
export const VISIBILITY_EXPLANATIONS: Record<TrackVisibility, string> = {
  space:
    'Everyone who can see the Space sees this Track and the problems in it. In a public Space that includes visitors who are not logged in.',
  members:
    'Only people added to this Track (by invitation) see it and its problems. Owners and editors always see every Track.',
};

/** "3 of 8" with the share as a whole percent, for text next to a bar. */
export function progressText(progress: Progress): string {
  return `${progress.solved} of ${progress.total} solved`;
}

export function progressPercent(progress: Progress): number {
  return progress.total === 0 ? 0 : Math.round((progress.solved / progress.total) * 100);
}
