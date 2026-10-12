import { ApiError, errorMessage } from '@/lib/api';

/** Core's message for a failed upload: the file-level details when there are any. */
export function uploadFailureMessage(error: unknown): string {
  if (error instanceof ApiError && error.details && error.details.length > 0) {
    return error.details.map((detail) => detail.message).join(' ');
  }
  return errorMessage(error);
}
