import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

export interface ListParams {
  q?: string;
  page: number;
  pageSize: number;
}

/** Repository: pure calls to Core, no state. Errors are ApiError (lib/api.ts). */
export const spacesApi = {
  listPublic: ({ q, page, pageSize }: ListParams) =>
    unwrap(coreApi.GET('/api/v1/spaces', { params: { query: { q: q || undefined, page, page_size: pageSize } } })),

  listMine: ({ q, page, pageSize }: ListParams, archived: boolean) =>
    unwrap(
      coreApi.GET('/api/v1/me/spaces', {
        params: { query: { q: q || undefined, page, page_size: pageSize, archived } },
      })
    ),

  create: (body: Schemas['CreateSpaceRequest']) => unwrap(coreApi.POST('/api/v1/spaces', { body })),

  get: (slug: string) => unwrap(coreApi.GET('/api/v1/spaces/{slug}', { params: { path: { slug } } })),

  update: (slug: string, body: Schemas['UpdateSpaceRequest']) =>
    unwrap(coreApi.PATCH('/api/v1/spaces/{slug}', { params: { path: { slug } }, body })),

  archive: (slug: string) => unwrap(coreApi.POST('/api/v1/spaces/{slug}/archive', { params: { path: { slug } } })),

  members: async (slug: string) =>
    (await unwrap(coreApi.GET('/api/v1/spaces/{slug}/members', { params: { path: { slug } } }))).items,

  changeRole: (slug: string, username: string, role: Schemas['Role']) =>
    unwrap(
      coreApi.PATCH('/api/v1/spaces/{slug}/members/{username}', {
        params: { path: { slug, username } },
        body: { role },
      })
    ),

  removeMember: (slug: string, username: string) =>
    unwrap(coreApi.DELETE('/api/v1/spaces/{slug}/members/{username}', { params: { path: { slug, username } } })),

  leave: (slug: string) => unwrap(coreApi.POST('/api/v1/spaces/{slug}/leave', { params: { path: { slug } } })),

  invites: async (slug: string) =>
    (await unwrap(coreApi.GET('/api/v1/spaces/{slug}/invites', { params: { path: { slug } } }))).items,

  createInvite: (slug: string, body: Schemas['CreateInviteRequest']) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/invites', { params: { path: { slug } }, body })),

  revokeInvite: (slug: string, inviteId: string) =>
    unwrap(coreApi.DELETE('/api/v1/spaces/{slug}/invites/{inviteId}', { params: { path: { slug, inviteId } } })),

  // --- invitations addressed to me, or opened from a link ---------------------

  myInvites: async () => (await unwrap(coreApi.GET('/api/v1/me/invites'))).items,

  acceptMyInvite: (inviteId: string) =>
    unwrap(coreApi.POST('/api/v1/me/invites/{inviteId}/accept', { params: { path: { inviteId } } })),

  declineMyInvite: (inviteId: string) =>
    unwrap(coreApi.POST('/api/v1/me/invites/{inviteId}/decline', { params: { path: { inviteId } } })),

  previewInvite: (token: string) => unwrap(coreApi.GET('/api/v1/invites/{token}', { params: { path: { token } } })),

  acceptInvite: (token: string) =>
    unwrap(coreApi.POST('/api/v1/invites/{token}/accept', { params: { path: { token } } })),

  declineInvite: (token: string) =>
    unwrap(coreApi.POST('/api/v1/invites/{token}/decline', { params: { path: { token } } })),
};
