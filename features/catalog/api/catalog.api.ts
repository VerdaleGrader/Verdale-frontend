import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

/** Repository: pure calls to Core for Tracks, Collections, their members and progression. Errors are ApiError (lib/api.ts). */
export const catalogApi = {
  // --- Tracks ---------------------------------------------------------------

  /** The Tracks the caller can reach, in order. Staff can also ask for archived ones. */
  tracks: async (slug: string, includeArchived = false) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/tracks', {
          params: { path: { slug }, query: { include_archived: includeArchived || undefined } },
        })
      )
    ).items,

  track: (slug: string, trackSlug: string) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}', { params: { path: { slug, trackSlug } } })),

  createTrack: (slug: string, body: Schemas['CreateTrackRequest']) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/tracks', { params: { path: { slug } }, body })),

  updateTrack: (slug: string, trackSlug: string, body: Schemas['UpdateTrackRequest']) =>
    unwrap(coreApi.PATCH('/api/v1/spaces/{slug}/tracks/{trackSlug}', { params: { path: { slug, trackSlug } }, body })),

  /** The order of all active Tracks, every one named once. */
  reorderTracks: async (slug: string, trackSlugs: string[]) =>
    (
      await unwrap(
        coreApi.PUT('/api/v1/spaces/{slug}/tracks/order', {
          params: { path: { slug } },
          body: { track_slugs: trackSlugs },
        })
      )
    ).items,

  /** Exactly these Collections in this Track, in this order. */
  setTrackCollections: (slug: string, trackSlug: string, collectionSlugs: string[]) =>
    unwrap(
      coreApi.PUT('/api/v1/spaces/{slug}/tracks/{trackSlug}/collections', {
        params: { path: { slug, trackSlug } },
        body: { collection_slugs: collectionSlugs },
      })
    ),

  trackProgress: (slug: string, trackSlug: string) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/progress', { params: { path: { slug, trackSlug } } })),

  // --- Collections ------------------------------------------------------------

  collections: async (slug: string, includeArchived = false) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/collections', {
          params: { path: { slug }, query: { include_archived: includeArchived || undefined } },
        })
      )
    ).items,

  collection: (slug: string, collectionSlug: string) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/collections/{collectionSlug}', {
        params: { path: { slug, collectionSlug } },
      })
    ),

  createCollection: (slug: string, body: Schemas['CreateCollectionRequest']) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/collections', { params: { path: { slug } }, body })),

  updateCollection: (slug: string, collectionSlug: string, body: Schemas['UpdateCollectionRequest']) =>
    unwrap(
      coreApi.PATCH('/api/v1/spaces/{slug}/collections/{collectionSlug}', {
        params: { path: { slug, collectionSlug } },
        body,
      })
    ),

  /** Exactly these problems in this Collection, in this order. */
  setCollectionProblems: (slug: string, collectionSlug: string, problemSlugs: string[]) =>
    unwrap(
      coreApi.PUT('/api/v1/spaces/{slug}/collections/{collectionSlug}/problems', {
        params: { path: { slug, collectionSlug } },
        body: { problem_slugs: problemSlugs },
      })
    ),

  /** Add and remove several problems at once, keeping the order of the rest. */
  changeCollectionProblems: (slug: string, collectionSlug: string, change: { add?: string[]; remove?: string[] }) =>
    unwrap(
      coreApi.PATCH('/api/v1/spaces/{slug}/collections/{collectionSlug}/problems', {
        params: { path: { slug, collectionSlug } },
        body: change,
      })
    ),

  // --- Track members and invitations -------------------------------------------

  trackMembers: async (slug: string, trackSlug: string) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/members', { params: { path: { slug, trackSlug } } })
      )
    ).items,

  removeTrackMember: (slug: string, trackSlug: string, username: string) =>
    unwrap(
      coreApi.DELETE('/api/v1/spaces/{slug}/tracks/{trackSlug}/members/{username}', {
        params: { path: { slug, trackSlug, username } },
      })
    ),

  trackInvites: async (slug: string, trackSlug: string) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/invites', { params: { path: { slug, trackSlug } } })
      )
    ).items,

  createTrackInvite: (slug: string, trackSlug: string, body: Schemas['CreateTrackInviteRequest']) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/tracks/{trackSlug}/invites', {
        params: { path: { slug, trackSlug } },
        body,
      })
    ),

  revokeTrackInvite: (slug: string, trackSlug: string, inviteId: string) =>
    unwrap(
      coreApi.DELETE('/api/v1/spaces/{slug}/tracks/{trackSlug}/invites/{inviteId}', {
        params: { path: { slug, trackSlug, inviteId } },
      })
    ),
};
