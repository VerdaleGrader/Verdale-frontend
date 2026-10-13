import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import { LEGAL_VERSIONS } from '@/lib/legal';

/** Repository: pure calls to Core, no state. */
export const legalApi = {
  /** Accepts the versions of the documents this build shows; Core refuses (409) if they are no longer the current ones. */
  accept: () => unwrap(coreApi.POST('/api/v1/me/legal-acceptance', { body: { ...LEGAL_VERSIONS } })),
};
