import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

/** Repository: pure calls to Core for Tracks, Collections, their members and progress. Errors are ApiError (lib/api.ts). */
export const tracksApi = {
  // --- tracks -------------------------------------------------------------

  list: async (slug: string) =>
    (await unwrap(coreApi.GET('/api/v1/spaces/{slug}/tracks', { params: { path: { slug } } }))).items,

  get: (slug: string, trackSlug: string) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}', { params: { path: { slug, trackSlug } } })),

  create: (slug: string, body: Schemas['CreateTrackRequest']) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/tracks', { params: { path: { slug } }, body })),

  update: (slug: string, trackSlug: string, body: Schemas['UpdateTrackRequest']) =>
    unwrap(coreApi.PATCH('/api/v1/spaces/{slug}/tracks/{trackSlug}', { params: { path: { slug, trackSlug } }, body })),

  archive: (slug: string, trackSlug: string) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/tracks/{trackSlug}/archive', { params: { path: { slug, trackSlug } } })),

  restore: (slug: string, trackSlug: string) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/tracks/{trackSlug}/restore', { params: { path: { slug, trackSlug } } })),

  /** The whole new order of the active Tracks in one request. */
  reorder: async (slug: string, trackIds: string[]) =>
    (
      await unwrap(
        coreApi.POST('/api/v1/spaces/{slug}/tracks/reorder', {
          params: { path: { slug } },
          body: { track_ids: trackIds },
        })
      )
    ).items,

  // --- Collections in a Track ---------------------------------------------

  addCollections: (slug: string, trackSlug: string, collectionSlugs: string[]) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/tracks/{trackSlug}/collections', {
        params: { path: { slug, trackSlug } },
        body: { collection_slugs: collectionSlugs },
      })
    ),

  removeCollections: (slug: string, trackSlug: string, collectionSlugs: string[]) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/tracks/{trackSlug}/collections/remove', {
        params: { path: { slug, trackSlug } },
        body: { collection_slugs: collectionSlugs },
      })
    ),

  reorderCollections: (slug: string, trackSlug: string, collectionIds: string[]) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/tracks/{trackSlug}/collections/reorder', {
        params: { path: { slug, trackSlug } },
        body: { collection_ids: collectionIds },
      })
    ),

  // --- members and invitations --------------------------------------------

  members: async (slug: string, trackSlug: string) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/members', { params: { path: { slug, trackSlug } } })
      )
    ).items,

  removeMember: (slug: string, trackSlug: string, username: string) =>
    unwrap(
      coreApi.DELETE('/api/v1/spaces/{slug}/tracks/{trackSlug}/members/{username}', {
        params: { path: { slug, trackSlug, username } },
      })
    ),

  invites: async (slug: string, trackSlug: string) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/invites', { params: { path: { slug, trackSlug } } })
      )
    ).items,

  createInvite: (slug: string, trackSlug: string, body: Schemas['CreateTrackInviteRequest']) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/tracks/{trackSlug}/invites', {
        params: { path: { slug, trackSlug } },
        body,
      })
    ),

  revokeInvite: (slug: string, trackSlug: string, inviteId: string) =>
    unwrap(
      coreApi.DELETE('/api/v1/spaces/{slug}/tracks/{trackSlug}/invites/{inviteId}', {
        params: { path: { slug, trackSlug, inviteId } },
      })
    ),

  // --- progress -----------------------------------------------------------

  myProgress: (slug: string, trackSlug: string) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/progress', { params: { path: { slug, trackSlug } } })),

  memberProgress: async (slug: string, trackSlug: string) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/progress/members', {
          params: { path: { slug, trackSlug } },
        })
      )
    ).items,

  // --- collections --------------------------------------------------------

  collections: async (slug: string) =>
    (await unwrap(coreApi.GET('/api/v1/spaces/{slug}/collections', { params: { path: { slug } } }))).items,

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

  archiveCollection: (slug: string, collectionSlug: string) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/collections/{collectionSlug}/archive', {
        params: { path: { slug, collectionSlug } },
      })
    ),

  restoreCollection: (slug: string, collectionSlug: string) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/collections/{collectionSlug}/restore', {
        params: { path: { slug, collectionSlug } },
      })
    ),

  addProblems: (slug: string, collectionSlug: string, problemSlugs: string[]) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/collections/{collectionSlug}/problems', {
        params: { path: { slug, collectionSlug } },
        body: { problem_slugs: problemSlugs },
      })
    ),

  removeProblems: (slug: string, collectionSlug: string, problemSlugs: string[]) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/collections/{collectionSlug}/problems/remove', {
        params: { path: { slug, collectionSlug } },
        body: { problem_slugs: problemSlugs },
      })
    ),

  reorderProblems: (slug: string, collectionSlug: string, problemIds: string[]) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/collections/{collectionSlug}/problems/reorder', {
        params: { path: { slug, collectionSlug } },
        body: { problem_ids: problemIds },
      })
    ),
};
