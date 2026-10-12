import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

export type Track = Schemas['Track'];
export type TrackSummary = Schemas['TrackSummary'];
export type TrackDetail = Schemas['TrackDetail'];
export type TrackPrivacy = Schemas['TrackPrivacy'];
export type TrackMember = Schemas['TrackMember'];
export type TrackProgress = Schemas['TrackProgress'];
export type Collection = Schemas['Collection'];
export type CollectionSummary = Schemas['CollectionSummary'];
export type CollectionDetail = Schemas['CollectionDetail'];
export type CollectionInTrack = Schemas['CollectionInTrack'];
export type ProblemRef = Schemas['ProblemRef'];
export type Progress = Schemas['Progress'];

/** Who can see a Track, and what that means for the people looking at it. */
export const PRIVACY_LABELS: Record<TrackPrivacy, string> = {
  space: 'Everyone in the Space',
  members: 'Only people added to the Track',
};

export const PRIVACY_DESCRIPTIONS: Record<TrackPrivacy, string> = {
  space:
    'Everyone who can see the Space can open this Track. In a public Space that includes visitors who are not logged in.',
  members:
    'Only people added to the Track, by an invitation, can open it. The Space’s owner, administrators, editors and observers always see every Track.',
};

export const PRIVACY_OPTIONS = (Object.keys(PRIVACY_LABELS) as TrackPrivacy[]).map((value) => ({
  value,
  label: PRIVACY_LABELS[value],
  description: PRIVACY_DESCRIPTIONS[value],
}));

export const PROBLEM_STATUS_LABELS: Record<ProblemRef['status'], string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export const trackPath = (spaceSlug: string, trackSlug: string) => `/spaces/${spaceSlug}/tracks/${trackSlug}`;
export const collectionPath = (spaceSlug: string, collectionSlug: string) =>
  `/spaces/${spaceSlug}/collections/${collectionSlug}`;
